# Multi-Agent Banking Transaction Pipeline

## Student & task summary

- **Student Name**: Iryna Balandiukh
- **Date Submitted**: 21.06.2026
- **AI Tools Used**: Claude Code

---

## Overview

A TypeScript multi-agent pipeline that ingests raw JSON transactions and routes each one through a chain of cooperating agents — validation, fraud screening, compliance, and settlement — before aggregating every outcome into a single pipeline summary report written under `shared/results/`.

Each agent receives a standard JSON message, makes its decision, and passes the result to the next agent in the chain. Rejected transactions are written to `shared/results/` with a human-readable `reason` field. The Reporting Agent runs once after all transactions are processed and produces the pipeline summary.

---

## Pipeline Architecture

```
sample-transactions.json
         │
         ▼
    shared/input/
         │
         ▼
[1] Transaction Validator ──► [2] Fraud Detector ──► [3] Compliance Checker
                                                              │
                                                              ▼
                               shared/results/ ◄── [4] Settlement Processor
                                      │
                                      ▼  (once, after all transactions)
                               [5] Reporting Agent ──► _summary.json
```

Agents pass messages as JSON files through:

```
shared/
├── input/       ← integrator drops initial messages here
├── processing/  ← agent moves message here while working
├── output/      ← agent writes result here for next agent
└── results/     ← final outcomes (+ _summary.json) land here
```

---

## Agent Responsibilities

- **Transaction Validator** (`agents/transactionValidator.ts`) — checks required fields, validates ISO 4217 currency codes, and enforces amount rules using `decimal.js` (negative amounts allowed only for refunds; zero amounts always rejected).
- **Fraud Detector** (`agents/fraudDetector.ts`) — computes an integer risk score 0–3, adding +1 for each present signal: high value (> $10,000), unusual timing (UTC 00:00–05:00), and cross-border (`country !== "US"`). Flags for fraud review when the high-value signal is present.
- **Compliance Checker** (`agents/complianceChecker.ts`) — applies regulatory rules: sets `requiresRegulatoryReport: true` on any transaction over $10,000, distinct from the fraud risk score.
- **Settlement Processor** (`agents/settlementProcessor.ts`) — computes settled amount using `decimal.js` with `ROUND_HALF_UP` rounding to 2 decimal places; never settles already-rejected transactions.
- **Reporting Agent** (`agents/reportingAgent.ts`) — runs **once** after all transactions complete; aggregates results into a `Summary` (total processed, accepted, rejected, flagged for fraud, rejection reasons).

---

## Tech Stack

| Concern        | Choice                              |
| -------------- | ----------------------------------- |
| Language       | TypeScript (Node.js 20+, ESM)       |
| Monetary math  | `decimal.js` — never JS float       |
| Test framework | Vitest + `@vitest/coverage-v8`      |
| Coverage gate  | husky `pre-push` + Claude Code hook |
| Custom MCP     | `@modelcontextprotocol/sdk`         |
| Docs lookup    | context7 MCP (during code gen)      |

---

## Coverage

All 41 tests pass with **96.7% statement coverage** (gate: 80%, target: ≥ 90%).

---

## Skills (Claude Code slash commands)

| Command                  | What it does                                  |
| ------------------------ | --------------------------------------------- |
| `/write-spec`            | Generates `specification.md` from `CLAUDE.md` |
| `/run-pipeline`          | Runs the full pipeline and reports results    |
| `/validate-transactions` | Dry-run validation only (no side effects)     |
