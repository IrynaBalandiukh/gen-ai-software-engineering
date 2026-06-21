// Integration test — the full pipeline, end to end, in an isolated temp dir.
// Copies the real sample-transactions.json into a tmp base dir and runs
// runPipeline() against it so the real shared/ tree is never touched.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runPipeline } from "../main.ts";
import type { Message, Summary } from "../agents/types.ts";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("pipeline integration", () => {
  let baseDir: string;
  let summary: Summary;

  beforeAll(async () => {
    // Quiet the orchestrator's console output during the test run.
    vi.spyOn(console, "log").mockImplementation(() => {});
    baseDir = await mkdtemp(join(tmpdir(), "pipeline-test-"));
    await cp(
      join(PROJECT_ROOT, "sample-transactions.json"),
      join(baseDir, "sample-transactions.json"),
    );
    summary = await runPipeline(baseDir);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await rm(baseDir, { recursive: true, force: true });
  });

  it("writes every transaction to shared/results/", async () => {
    const resultsDir = join(baseDir, "shared", "results");
    const files = (await readdir(resultsDir)).filter(
      (f) => f.endsWith(".json") && f !== "_summary.json",
    );
    expect(files.length).toBe(8); // TXN001..TXN008
  });

  it("produces a summary consistent with the sample data", () => {
    expect(summary.total_processed).toBe(8);
    expect(summary.rejected).toBe(1); // only TXN006 (invalid XYZ currency)
    expect(summary.accepted).toBe(7);
    expect(summary.flagged_for_fraud).toBe(2); // TXN002 + TXN005
    expect(summary.rejection_reasons.some((r) => r.startsWith("TXN006"))).toBe(
      true,
    );
  });

  it("writes the _summary.json file matching the returned summary", async () => {
    const raw = await readFile(
      join(baseDir, "shared", "results", "_summary.json"),
      "utf8",
    );
    expect(JSON.parse(raw)).toEqual(summary);
  });

  it("settles a clean transaction and rejects the invalid one", async () => {
    const resultsDir = join(baseDir, "shared", "results");
    const txn001 = JSON.parse(
      await readFile(join(resultsDir, "TXN001.json"), "utf8"),
    ) as Message;
    const txn006 = JSON.parse(
      await readFile(join(resultsDir, "TXN006.json"), "utf8"),
    ) as Message;

    expect(txn001.data.status).toBe("settled");
    expect(txn001.data.settled_amount).toBe("1500.00");
    expect(txn006.data.status).toBe("rejected");
    expect(txn006.data.reason).toContain("ISO 4217");
  });

  it("flags TXN005 for fraud and requires a regulatory report", async () => {
    const txn005 = JSON.parse(
      await readFile(
        join(baseDir, "shared", "results", "TXN005.json"),
        "utf8",
      ),
    ) as Message;
    expect(txn005.data.fraud_flagged).toBe(true);
    expect(txn005.data.requiresRegulatoryReport).toBe(true);
  });
});
