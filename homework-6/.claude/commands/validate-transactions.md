---
description: Validate all transactions in sample-transactions.json without running the full pipeline.
allowed-tools: Bash, Read
---

# /validate-transactions — Validate transactions (dry run)

Validate every transaction in `sample-transactions.json` **without** running the
full pipeline (no fraud/compliance/settlement, no writes to `shared/results/`).

Steps:

1. **Run the validator in dry-run mode.** Execute `npm run validate` (which runs
   `tsx agents/transactionValidator.ts --dry-run`). This validates each record
   against the required-field, ISO 4217 currency, and amount rules only.
2. **Report counts.** From the dry-run output, state: total count, valid count,
   invalid count.
3. **Show the results table.** Present the per-transaction table the dry-run
   prints (id, result, reason), so the user can see exactly which transactions
   failed and why (e.g. TXN006's invalid `XYZ` currency).

Do not run the full pipeline or modify `shared/` — this command is read-only
validation.
