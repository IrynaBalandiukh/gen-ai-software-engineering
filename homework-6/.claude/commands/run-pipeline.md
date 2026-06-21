---
description: Run the multi-agent banking pipeline end-to-end and summarize the results.
allowed-tools: Bash, Read, Glob
---

# /run-pipeline — Run the banking pipeline end-to-end

Run the full multi-agent banking pipeline and report what happened.

Steps:

1. **Check input exists.** Confirm `sample-transactions.json` is present in the
   project root. If it is missing, stop and tell the user.
2. **Clear shared state.** The orchestrator resets `shared/{input,processing,output,results}/`
   on startup, so no manual clearing is needed — but confirm the `shared/` tree
   exists (the run will recreate it).
3. **Run the pipeline.** Execute `npm run pipeline` (which runs `tsx main.ts`).
4. **Summarize results.** Read `shared/results/_summary.json` and report:
   total processed, accepted/settled, rejected, and flagged-for-fraud counts.
5. **Report rejections.** List every transaction that was rejected and its
   `reason` (from `_summary.json` `rejection_reasons`, or by reading the
   individual `shared/results/TXN*.json` files).

Finish with a one-line confirmation of how many transactions reached
`shared/results/` (expected: all of them).
