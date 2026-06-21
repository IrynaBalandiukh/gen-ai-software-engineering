// Unit tests — Agent 5: Reporting Agent.

import { describe, expect, it } from "vitest";
import { generateReport } from "../agents/reportingAgent.ts";
import { makeMessage } from "./helpers.ts";

describe("reportingAgent.generateReport", () => {
  it("aggregates accepted, rejected, and flagged counts", () => {
    const results = [
      makeMessage({ transaction_id: "T1", status: "settled" }),
      makeMessage({ transaction_id: "T2", status: "settled", fraud_flagged: true }),
      makeMessage({
        transaction_id: "T3",
        status: "rejected",
        reason: "invalid currency code (not ISO 4217): XYZ",
      }),
    ];

    const summary = generateReport(results);

    expect(summary.total_processed).toBe(3);
    expect(summary.accepted).toBe(2);
    expect(summary.rejected).toBe(1);
    expect(summary.flagged_for_fraud).toBe(1);
    expect(summary.rejection_reasons).toEqual([
      "T3: invalid currency code (not ISO 4217): XYZ",
    ]);
  });

  it("falls back to 'unknown' when a rejected message has no reason", () => {
    const summary = generateReport([
      makeMessage({ transaction_id: "T9", status: "rejected", reason: undefined }),
    ]);
    expect(summary.rejection_reasons).toEqual(["T9: unknown"]);
  });

  it("handles an empty result set", () => {
    const summary = generateReport([]);
    expect(summary).toEqual({
      total_processed: 0,
      accepted: 0,
      rejected: 0,
      flagged_for_fraud: 0,
      rejection_reasons: [],
    });
  });
});
