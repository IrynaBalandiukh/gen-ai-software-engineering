# Project Context for AI-Powered Multi-Agent Banking Pipeline

> Project context and conventions for the multi-agent banking pipeline. This is
> the canonical reference for the stack, the agent roster, and the business rules
> that the specification, code, tests, and docs are built on.

---

## 1. Project Summary

A **multi-agent transaction processing pipeline** for a bank. Raw transactions
arrive as JSON. Each transaction flows through a chain of cooperating agents that
**validate**, **screen for fraud**, **check compliance**, and **settle** it; the
final accepted / rejected outcome (with reasons) lands in `shared/results/`. After
all transactions have been processed, a separate **Reporting** step aggregates the
collected results into a single pipeline summary (it does not run per-transaction
inside the chain — see Section 4).

This repository contains **two kinds of "agents"**:

| Kind                                         | Lives in                             | File type                 | Who runs it |
| -------------------------------------------- | ------------------------------------ | ------------------------- | ----------- |
| **Meta-agents** (Spec / Code / Tests / Docs) | `.claude/commands/`                  | Markdown slash commands & skills | Claude Code |
| **Pipeline agents** (Validator, Fraud, …)    | `agents/`                            | TypeScript code           | `tsx`/`node` |

The **meta-agents build the system**; the **pipeline agents are the system**.

---

## 2. Tech Stack

| Concern          | Choice                                   | Notes                                   |
| ---------------- | ---------------------------------------- | --------------------------------------- |
| Language         | **TypeScript** (Node.js 20+)             | ESM modules                             |
| Money            | **decimal.js**                           | NEVER use JS `number`/float for amounts |
| Runtime entry    | `npx tsx main.ts` / `npm run pipeline`   | Orchestrator starts agents in order     |
| Tests + coverage | **Vitest** + `@vitest/coverage-v8`       | Gate at 80%, target ≥ 90%               |
| Coverage gate    | husky `pre-push` hook **and** Claude Code `PreToolUse` hook | Both block a push if coverage < 80% |
| Custom MCP       | `@modelcontextprotocol/sdk` (TypeScript) | Run as `npx tsx mcp/server.ts`          |
| Docs lookup      | **context7 MCP**                         | Used during code generation             |

---

## 3. The Pipeline (agent flow)

```
sample-transactions.json
        │
        ▼
   shared/input/ ──► [1] Validator ──► [2] Fraud Detector ──► [3] Compliance Checker
                                                                      │
                                                                      ▼
                                          shared/results/ ◄── [4] Settlement Processor
                                                 │
                                                 ▼  (once, after all transactions)
                                          [5] Reporting ──► pipeline summary
```

Agents [1]–[4] run **per transaction**, in order. The Reporting Agent [5] runs
**once, after** every transaction has reached `shared/results/`, and aggregates
them into the summary.

Agents communicate by passing **JSON message files** through shared directories:

```
shared/
├── input/       ← integrator drops initial messages here
├── processing/  ← agent moves a message here while working
├── output/      ← agent writes its result here for the next agent
└── results/     ← final outcomes land here
```

**Standard message format** (every agent reads and writes this shape):

```json
{
  "message_id": "uuid4-string",
  "timestamp": "2026-03-16T10:00:00Z",
  "source_agent": "transaction_validator",
  "target_agent": "fraud_detector",
  "message_type": "transaction",
  "data": {
    "transaction_id": "TXN001",
    "amount": "1500.00",
    "currency": "USD",
    "status": "validated"
  }
}
```

**Routing note:** the JSON above is a single snapshot, not a fixed template.
`source_agent` and `target_agent` are rewritten at every hop — each agent sets
`source_agent` to itself and `target_agent` to the next agent in the flow. Do not
hardcode `fraud_detector` as the target; derive the next hop from the pipeline
order in Section 3.

---

## 4. Pipeline Agents (the system to build)

Minimum required is 3 (Validator, Fraud Detector, + one more). This project uses 5
for a realistic banking flow. Each is a TypeScript module under `agents/`.

| #   | Agent                     | File                             | Responsibility                                                                                                                                                                                                                                                          |
| --- | ------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Transaction Validator** | `agents/transactionValidator.ts` | Check required fields, positive decimal amount, valid ISO 4217 currency. Reject malformed transactions with a reason.                                                                                                                                                   |
| 2   | **Fraud Detector**        | `agents/fraudDetector.ts`        | Assign a risk score from high value (> $10,000), unusual timing, and cross-border signals. Flag for review above threshold.                                                                                                                                             |
| 3   | **Compliance Checker**    | `agents/complianceChecker.ts`    | Apply regulatory rules: reporting threshold (> $10,000), cross-border checks, currency restrictions. **On any transaction over $10,000, set `requiresRegulatoryReport: true` on the message — this is Compliance's distinct output, separate from Fraud's risk score.** |
| 4   | **Settlement Processor**  | `agents/settlementProcessor.ts`  | Compute the settled amount using decimal arithmetic (ROUND_HALF_UP) and set the final status. Does not settle already-rejected transactions.                                                                                                                            |
| 5   | **Reporting Agent**       | `agents/reportingAgent.ts`       | Runs **once after** all transactions are processed. Aggregates all outcomes into a pipeline summary report (feeds the MCP `pipeline://summary` resource).                                                                                                               |

Agents 1–4 each expose a **one-message-in / one-message-out** function, and run
per transaction inside the main loop:

```ts
processMessage(message: Message): Message
```

It reads one message, makes its decision, and returns the message for the next agent.

**Exception — Reporting Agent (5):** it aggregates all outcomes rather than
transforming a single message, so it has its own signature and is called **once,
after the per-transaction loop finishes** (not inside the `processMessage` chain):

```ts
generateReport(results: Message[]): Summary
```

It takes the collected result messages and returns a `Summary` (the pipeline
summary report that feeds the MCP `pipeline://summary` resource).

**`Summary` shape** (returned by `generateReport`, served by `pipeline://summary`):

```ts
interface Summary {
  total_processed: number; // all transactions that entered the pipeline
  accepted: number; // final status = accepted/settled
  rejected: number; // final status = rejected (any reason)
  flagged_for_fraud: number; // fraud review flag raised
  rejection_reasons: string[]; // human-readable reasons for each rejected txn
}
```

---

## 5. Business Rules (source of truth for the spec)

These are the concrete, testable rules the spec must encode. Drawn from the
assignment and the real shape of `sample-transactions.json`.

- **Monetary values:** use a precise decimal type (`decimal.js`) — **never** `float`/`number`.
- **Currency codes:** must be valid **ISO 4217** (USD, EUR, GBP, JPY, …). Reject unknown codes (e.g. `XYZ`).
- **Amounts:** must be a non-zero decimal. Rule (deterministic): a negative amount is valid **only** when `transaction_type === "refund"`; a negative amount with any other type is rejected with reason `"negative amount not allowed for non-refund transaction"`. A zero amount is always rejected (`"amount must be non-zero"`). All other amounts must be positive. (So TXN007's `-100.00` refund is accepted; a `-100.00` transfer would be rejected.)
- **Fraud flagging:** amount **> $10,000** (compared on absolute value) → flag for fraud review **with a risk score**.
- **Home country:** the bank's home country is **US**. Cross-border = `metadata.country !== "US"`.
- **Risk signals & scoring (deterministic):** the fraud risk score is an integer in the range **0–3**, starting at 0, with **+1 for each** of these signals that is present: high value (absolute amount > $10,000), unusual timing (transaction hour in **UTC** between 00:00 and 05:00, e.g. 02:47), and cross-border (`metadata.country !== "US"`). A transaction is **fraud-flagged** when the high-value signal is present (amount > $10,000). _(So TXN004 in DE at 02:47 under $10k → score 2, not flagged; TXN005 at $75,000 daytime US → score 1, flagged.)_
- **Compliance reporting:** any transaction **> $10,000** sets `requiresRegulatoryReport: true` (distinct from the fraud risk score — Compliance is a regulatory flag, Fraud is a risk assessment).
- **Rejected transactions:** written to `shared/results/` with a **`reason`** field explaining why.
- **Logging / audit trail:** every agent operation logs an **ISO 8601 timestamp**, the **agent name**, the **transaction id**, and the **outcome**.
- **PII:** treat **account numbers and names as sensitive** — never log them in plaintext (mask or omit).
- **Quality gate:** test coverage **≥ 90% target**, with a **hard gate at 80%** (push blocked below 80%).

---

## 6. Sample Data (the real input shape)

`sample-transactions.json` holds **8 records**. Five are edge cases the agents must
handle; the other three (TXN001, TXN003, TXN008) are normal USD transfers that
pass validation cleanly. Indicative amounts below define what the sample file
should contain (keep `sample-transactions.json` in sync with this table):

| Txn    | Amount / property       | Currency | Country | Type          | Which rule it exercises                              |
| ------ | ----------------------- | -------- | ------- | ------------- | ---------------------------------------------------- |
| TXN001 | `1500.00`               | USD      | US      | transfer      | Normal — passes cleanly                              |
| TXN002 | `25000.00`              | USD      | US      | wire_transfer | Fraud + compliance threshold (> $10k)                |
| TXN003 | `9999.99`               | USD      | US      | transfer      | Normal — just under threshold; fractional settlement |
| TXN004 | `500.00`, time `02:47Z` | EUR      | DE      | transfer      | Cross-border + unusual timing (score 2)              |
| TXN005 | `75000.00`              | USD      | US      | wire_transfer | High-value fraud flag                                |
| TXN006 | `200.00`                | XYZ      | US      | transfer      | Invalid ISO 4217 → validator rejects                 |
| TXN007 | `-100.00`               | GBP      | GB      | refund        | Negative allowed only for refund → accepted          |
| TXN008 | `3200.00`               | USD      | US      | transfer      | Normal — passes cleanly                              |

Transaction record fields: `transaction_id`, `timestamp`, `source_account`,
`destination_account`, `amount` (string), `currency`, `transaction_type`,
`description`, `metadata.channel`, `metadata.country`.

> The table above mirrors the actual `sample-transactions.json` shipped in this
> repo. Keep the two in sync: if you change the sample data, update this table (and
> the spec/tests) so the documented edge cases and their expected outcomes hold.

---

## 7. Context (begin / end state)

- **Beginning state:** a `sample-transactions.json` file with raw transaction records; empty `shared/` directories; this `CLAUDE.md`.
- **Ending state:** processed results in `shared/results/`, a pipeline summary report, and test coverage ≥ 90%.

---

## 8. Repository Layout (actual)

```
homework-6/
├── CLAUDE.md                     # this file (project context, auto-loaded by Claude Code)
├── specification.md              # generated by the /write-spec command
├── sample-transactions.json      # input data (8 records)
├── research-notes.md             # context7 queries (Task 4)
├── README.md                     # author: Iryna Balandiukh (Task 5 — pending)
├── HOWTORUN.md                   # step-by-step run guide (Task 5 — pending)
├── main.ts                       # orchestrator — exports runPipeline(); auto-runs when invoked directly
├── package.json                  # scripts: pipeline, validate, test, coverage, mcp
├── package-lock.json
├── tsconfig.json                 # TypeScript config (ESM, allowImportingTsExtensions)
├── vitest.config.ts              # Vitest + v8 coverage, 80% thresholds
├── agents/                       # PIPELINE CODE (TypeScript)
│   ├── transactionValidator.ts   # also a --dry-run CLI (used by /validate-transactions)
│   ├── fraudDetector.ts
│   ├── complianceChecker.ts
│   ├── settlementProcessor.ts
│   ├── reportingAgent.ts
│   ├── logger.ts                 # audit logging + PII masking
│   └── types.ts                  # shared Message/Summary types + pipeline order
├── mcp/
│   └── server.ts                 # custom MCP server on @modelcontextprotocol/sdk, run as `npx tsx mcp/server.ts`
├── .mcp.json                     # context7 + pipeline-status MCP servers
├── scripts/
│   └── coverage-gate.mjs         # Claude Code PreToolUse hook: blocks `git push` if coverage < 80%
├── tests/                        # Vitest suites
│   ├── helpers.ts                # shared message factory (not a test file)
│   ├── transactionValidator.test.ts
│   ├── fraudDetector.test.ts
│   ├── complianceChecker.test.ts
│   ├── settlementProcessor.test.ts
│   ├── reportingAgent.test.ts
│   ├── logger.test.ts
│   └── pipeline.integration.test.ts
├── shared/{input,processing,output,results}/
├── docs/screenshots/             # Task 5 — pending
├── .husky/
│   └── pre-push                  # git pre-push coverage gate (husky)
└── .claude/
    ├── commands/                 # SLASH COMMANDS / skills (each is a single .md file)
    │   ├── write-spec.md
    │   ├── run-pipeline.md
    │   └── validate-transactions.md
    ├── settings.json             # coverage-gate hook (PreToolUse → scripts/coverage-gate.mjs)
    └── settings.local.json       # local settings overrides
```

---

## 9. Meta-Agents (the four deliverable workflows)

| Meta-agent                    | Produces                      | Required "plus" feature                                   |
| ----------------------------- | ----------------------------- | --------------------------------------------------------- |
| **Agent 1 — Specification**   | `specification.md`            | Command: `/write-spec` (`.claude/commands/write-spec.md`) |
| **Agent 2 — Code generation** | pipeline code under `agents/` | Uses context7 MCP; logs 2+ queries in `research-notes.md` |
| **Agent 3 — Unit tests**      | tests under `tests/`          | Hook blocks push if coverage < 80%                        |
| **Agent 4 — Documentation**   | `README.md`, `HOWTORUN.md`    | README includes "Created by Iryna Balandiukh"             |

---

## 10. Conventions

- All timestamps in logs and messages are **ISO 8601 / UTC** (e.g. `2026-03-16T10:00:00Z`).
- Message and result files are JSON, one transaction per file, named by `transaction_id` or `message_id`.
- Agents are **pure where possible**: read a message, return a decision; side effects (file writes, logs) are explicit.
- No secrets or PII in logs, commits, or screenshots.
