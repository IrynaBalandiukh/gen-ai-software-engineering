# How to Run — Multi-Agent Banking Pipeline

## Prerequisites

- Node.js 20+
- npm

---

## 1. Install dependencies

```bash
cd homework-6
npm install
```

---

## 2. Run the full pipeline

```bash
npm run pipeline
```

This runs `npx tsx main.ts`, which:
1. Resets `shared/{input,processing,output,results}/`
2. Loads `sample-transactions.json` (8 transactions)
3. Routes each transaction through: Validator → Fraud Detector → Compliance Checker → Settlement Processor
4. Runs the Reporting Agent once and writes `shared/results/_summary.json`
5. Prints a pipeline summary to stdout

---

## 3. Validate transactions only (dry run)

```bash
npm run validate
```

Runs the Transaction Validator against `sample-transactions.json` without executing the full pipeline or writing to `shared/`. Prints a table of valid/invalid results.

---

## 4. Run tests

```bash
npm test
```

Runs all 41 unit and integration tests in `tests/` using Vitest.

---

## 5. Check test coverage

```bash
npm run coverage
```

Generates a coverage report (v8). The hard gate is **80%**; the target is **≥ 90%**. A `git push` is blocked if coverage falls below 80% (enforced by `.husky/pre-push` and the Claude Code `PreToolUse` hook in `.claude/settings.json`).

---

## 6. Start the custom MCP server

```bash
npm run mcp
```

Starts `mcp/server.ts` over stdio. Exposes:
- Tool `get_transaction_status <transaction_id>` — status from `shared/results/`
- Tool `list_pipeline_results` — summary of all processed transactions
- Resource `pipeline://summary` — latest run summary as text

Requires a prior `npm run pipeline` run to populate `shared/results/`.

---

## 7. Configure the git hooks path (one-time, if hooks aren't firing)

The `pre-push` coverage gate lives in `homework-6/.husky/`. If you cloned the repo from the parent directory, point git at the hooks folder:

```bash
git config core.hooksPath homework-6/.husky
```

This is also done automatically by `npm install` via the `prepare` script in `package.json`.

---

## Expected output (pipeline run)

```
=== Multi-Agent Banking Pipeline ===

Loaded 8 transactions into shared/input/

--- Reporting ---

=== Pipeline Summary ===
  Total processed:    8
  Accepted/settled:   7
  Rejected:           1
  Flagged for fraud:  2
  Rejection reasons:
    - TXN006: invalid currency code (not ISO 4217): XYZ

8/8 transactions written to shared/results/
```
