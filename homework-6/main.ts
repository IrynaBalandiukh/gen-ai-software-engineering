// Orchestrator / Integrator for the multi-agent banking pipeline.
// Runs with: `npx tsx main.ts` or `npm run pipeline`.
//
// Flow per transaction (CLAUDE.md §3):
//   shared/input -> shared/processing -> [validator -> fraud -> compliance ->
//   settlement] -> shared/output -> shared/results
// After every transaction has reached shared/results/, the Reporting Agent runs
// ONCE over the collected results to produce the pipeline summary.

import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { processMessage as validate } from "./agents/transactionValidator.ts";
import { processMessage as detectFraud } from "./agents/fraudDetector.ts";
import { processMessage as checkCompliance } from "./agents/complianceChecker.ts";
import { processMessage as settle } from "./agents/settlementProcessor.ts";
import { generateReport } from "./agents/reportingAgent.ts";
import type { Message, Summary, Transaction } from "./agents/types.ts";

const ROOT = dirname(fileURLToPath(import.meta.url));

// The per-transaction agent chain, in pipeline order.
const CHAIN = [validate, detectFraud, checkCompliance, settle];

/**
 * Run the full pipeline against the data in `baseDir` (which must contain
 * `sample-transactions.json`) and write outputs under `baseDir/shared/`.
 * Returns the aggregated pipeline summary. Defaults to the project root so
 * `npm run pipeline` works unchanged; tests pass a temp dir to stay isolated
 * from the real `shared/` tree.
 */
export async function runPipeline(baseDir: string = ROOT): Promise<Summary> {
  const SHARED = join(baseDir, "shared");
  const DIRS = {
    input: join(SHARED, "input"),
    processing: join(SHARED, "processing"),
    output: join(SHARED, "output"),
    results: join(SHARED, "results"),
  };

  /** Ensure the shared directories exist and are empty before a run. */
  async function resetSharedDirs(): Promise<void> {
    for (const dir of Object.values(DIRS)) {
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
    }
  }

  /** Wrap a raw transaction in the standard message envelope. */
  function wrap(txn: Transaction): Message {
    return {
      message_id: randomUUID(),
      timestamp: new Date().toISOString(),
      source_agent: "integrator",
      target_agent: "transaction_validator",
      message_type: "transaction",
      data: { ...txn, status: "validated" },
    };
  }

  /** Load sample-transactions.json and drop a message file in shared/input/. */
  async function seedInput(): Promise<string[]> {
    const raw = await readFile(
      join(baseDir, "sample-transactions.json"),
      "utf8",
    );
    const txns = JSON.parse(raw) as Transaction[];
    const ids: string[] = [];
    for (const txn of txns) {
      const msg = wrap(txn);
      await writeFile(
        join(DIRS.input, `${txn.transaction_id}.json`),
        JSON.stringify(msg, null, 2),
      );
      ids.push(txn.transaction_id);
    }
    return ids;
  }

  /** Run one transaction through the full agent chain, leaving it in results/. */
  async function processOne(txnId: string): Promise<Message> {
    const file = `${txnId}.json`;
    // input -> processing
    await rename(join(DIRS.input, file), join(DIRS.processing, file));

    let msg = JSON.parse(
      await readFile(join(DIRS.processing, file), "utf8"),
    ) as Message;

    for (const agent of CHAIN) {
      msg = agent(msg);
    }

    // processing -> output -> results
    await writeFile(join(DIRS.output, file), JSON.stringify(msg, null, 2));
    await rm(join(DIRS.processing, file), { force: true });
    await writeFile(join(DIRS.results, file), JSON.stringify(msg, null, 2));

    return msg;
  }

  console.log("=== Multi-Agent Banking Pipeline ===\n");
  await resetSharedDirs();

  const ids = await seedInput();
  console.log(`Loaded ${ids.length} transactions into shared/input/\n`);

  const results: Message[] = [];
  for (const id of ids) {
    results.push(await processOne(id));
  }

  // Reporting Agent runs ONCE after the loop.
  console.log("\n--- Reporting ---");
  const summary = generateReport(results);
  await writeFile(
    join(DIRS.results, "_summary.json"),
    JSON.stringify(summary, null, 2),
  );

  console.log("\n=== Pipeline Summary ===");
  console.log(`  Total processed:    ${summary.total_processed}`);
  console.log(`  Accepted/settled:   ${summary.accepted}`);
  console.log(`  Rejected:           ${summary.rejected}`);
  console.log(`  Flagged for fraud:  ${summary.flagged_for_fraud}`);
  if (summary.rejection_reasons.length) {
    console.log("  Rejection reasons:");
    for (const r of summary.rejection_reasons) console.log(`    - ${r}`);
  }

  const written = (await readdir(DIRS.results)).filter(
    (f) => f.endsWith(".json") && f !== "_summary.json",
  );
  console.log(
    `\n${written.length}/${ids.length} transactions written to shared/results/`,
  );

  return summary;
}

/** True when this module is executed directly (not imported by a test). */
function isDirectRun(): boolean {
  if (!process.argv[1]) return false;
  try {
    return (
      realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  runPipeline().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
