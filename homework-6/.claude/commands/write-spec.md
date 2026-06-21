---
description: Generate specification.md for the multi-agent banking pipeline, following the project template and CLAUDE.md context. Use when the user asks to write, generate, or regenerate the project specification.
allowed-tools: Read, Write, Glob
---

# write-spec — Generate the project specification

Your job is to produce a complete, internally consistent `specification.md` for the
multi-agent banking transaction pipeline. **You define the shape of the document;
the content comes from `CLAUDE.md`.** Do not invent or restate domain rules here —
read them from `CLAUDE.md` so there is a single source of truth.

## Step 1 — Read the sources of truth (in this order)

Read these files before writing anything. They are the authority; do not invent
requirements that contradict them:

1. `CLAUDE.md` — the **primary source**: tech stack, the full pipeline-agent
   roster (Section 4), the business rules (Section 5), the message protocol, and
   the repo layout. Every objective, rule, agent, and filename in the spec must
   come from here. In particular, use the exact filenames from CLAUDE.md Section 8
   (e.g. the orchestrator is `main.ts`) — do not invent alternative names.
2. `sample-transactions.json` — the real input data. Ground every rule in the
   actual records (e.g. the invalid currency, the negative refund, the high-value wire).

If the user passed extra focus when invoking the command, treat it as additional
focus for this run (e.g. emphasize a particular agent or rule). Otherwise spec the
full pipeline.

## Step 2 — Produce `specification.md`

Write the result to `specification.md` (overwrite if it exists). It MUST contain
exactly these five sections, in order. Do not add or rename top-level sections.

### 1. High-Level Objective

One single sentence describing what the pipeline does.

### 2. Mid-Level Objectives

Derive **4–5 concrete, testable** bullet points **from the Business Rules section
of CLAUDE.md**. Do not restate the rules from memory — read them from CLAUDE.md.
Each bullet must be specific enough to write a test against (name the threshold,
the field, or the file it touches). Ensure you have covered every rule category
present in CLAUDE.md's Business Rules — at minimum these categories (take the exact
values from CLAUDE.md, not from here):

- fraud-review threshold with risk score,
- rejected transactions written to `shared/results/` with a `reason` field,
- audit logging,
- monetary handling and currency validation,
- where final results land.

### 3. Implementation Notes

List the technical constraints **as stated in CLAUDE.md** (Tech Stack + Business
Rules + Conventions). Do not introduce values that aren't in CLAUDE.md. Make sure
each of these constraint categories is represented, pulling the actual values from
CLAUDE.md:

- monetary type and rounding for settlement,
- currency validation standard,
- audit-trail contents (timestamp + agent + transaction id + outcome),
- PII handling,
- home country / cross-border definition,
- negative- and zero-amount handling,
- unusual-timing window and risk-score scheme,
- test framework, coverage target, and hard gate.

### 4. Context

Two sub-sections:

- **Beginning context** — files/state that exist at start (e.g. `sample-transactions.json`,
  empty `shared/` directories, `CLAUDE.md`).
- **Ending context** — files/state at end (e.g. `shared/results/` populated, pipeline
  summary report, the pipeline agent modules, the `main.ts` orchestrator, tests at the
  target coverage).

### 5. Low-Level Tasks

Create **one entry per pipeline agent listed in CLAUDE.md Section 4** (do not
hardcode the names or the count here — read the roster from CLAUDE.md so the spec
stays in sync if the roster changes). Each entry MUST use this exact block format,
not the template's wording:

```
Task: [Agent Name]
Prompt: "[The exact prompt you would give Claude Code to build this agent]"
File to CREATE: agents/[fileName].ts
Function to CREATE: [signature from CLAUDE.md, e.g. processMessage(message: Message): Message]
Details: [What the agent checks, transforms, or decides — tie to the CLAUDE.md business rules]
```

Notes for the Low-Level Tasks:

- Use the function signatures exactly as defined in CLAUDE.md Section 4 (most agents
  share one signature; the Reporting Agent has its own distinct signature — use
  whatever CLAUDE.md specifies).
- Reflect CLAUDE.md's flow: agents 1–4 run per transaction; the Reporting Agent runs
  **once after** the per-transaction loop (not inside the `processMessage` chain).
- Make each `Details` field concrete and testable (name the thresholds, the reject
  reasons, the fields read/written), referencing the sample data where relevant.
- Add a final Low-Level Task for the **integrator/orchestrator** (`main.ts`, as named
  in CLAUDE.md Section 8) that sets up `shared/` directories, loads
  `sample-transactions.json`, runs agents 1–4 in order per transaction, then calls
  the Reporting Agent once over the collected results — so the spec covers the full
  run path.

## Step 3 — Self-check before finishing

Confirm the generated `specification.md`:

- [ ] has all five sections in order,
- [ ] Mid-Level Objectives are testable and trace back to CLAUDE.md's Business Rules,
- [ ] **every** pipeline agent in CLAUDE.md Section 4 has its own Low-Level Task,
- [ ] the **integrator/orchestrator** (`main.ts`) has its own Low-Level Task,
- [ ] the Reporting Agent is described as running once after the loop, with its distinct signature,
- [ ] each agent's function signature matches CLAUDE.md,
- [ ] filenames match CLAUDE.md Section 8 (orchestrator is `main.ts`, not `integrator.ts`),
- [ ] no rule, value, or threshold contradicts CLAUDE.md or the sample data,
- [ ] uses TypeScript / decimal.js consistently (no Python, no FastMCP).

Then report a one-line summary of what was written and where.
