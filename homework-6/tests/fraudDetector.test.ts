// Unit tests — Agent 2: Fraud Detector.

import { describe, expect, it } from "vitest";
import { processMessage } from "../agents/fraudDetector.ts";
import { makeMessage } from "./helpers.ts";

describe("fraudDetector.processMessage", () => {
  it("scores a clean domestic daytime transaction 0 and does not flag it", () => {
    const out = processMessage(makeMessage({ amount: "1500.00" }));
    expect(out.data.risk_score).toBe(0);
    expect(out.data.fraud_flagged).toBe(false);
    expect(out.data.risk_signals).toEqual([]);
  });

  it("flags a high-value transaction (TXN002 $25,000) with the high_value signal", () => {
    const out = processMessage(makeMessage({ amount: "25000.00" }));
    expect(out.data.risk_score).toBe(1);
    expect(out.data.fraud_flagged).toBe(true);
    expect(out.data.risk_signals).toContain("high_value");
  });

  it("scores cross-border + unusual timing as 2 without flagging (TXN004)", () => {
    const out = processMessage(
      makeMessage({
        amount: "500.00",
        currency: "EUR",
        timestamp: "2026-03-16T02:47:00Z",
        metadata: { channel: "api", country: "DE" },
      }),
    );
    expect(out.data.risk_score).toBe(2);
    expect(out.data.fraud_flagged).toBe(false);
    expect(out.data.risk_signals).toEqual(
      expect.arrayContaining(["unusual_timing", "cross_border"]),
    );
  });

  it("scores all three signals as 3 and flags it", () => {
    const out = processMessage(
      makeMessage({
        amount: "75000.00",
        timestamp: "2026-03-16T03:00:00Z",
        metadata: { channel: "api", country: "DE" },
      }),
    );
    expect(out.data.risk_score).toBe(3);
    expect(out.data.fraud_flagged).toBe(true);
  });

  it("compares high value on absolute amount (large refund flags)", () => {
    const out = processMessage(
      makeMessage({ amount: "-20000.00", transaction_type: "refund" }),
    );
    expect(out.data.fraud_flagged).toBe(true);
    expect(out.data.risk_signals).toContain("high_value");
  });

  it("skips an already-rejected transaction and forwards it untouched", () => {
    const msg = makeMessage({ status: "rejected", reason: "bad currency" });
    const out = processMessage(msg);
    expect(out.data.risk_score).toBeUndefined();
    expect(out.data.fraud_flagged).toBeUndefined();
    expect(out.source_agent).toBe("fraud_detector");
    expect(out.target_agent).toBe("compliance_checker");
  });

  it("routes a scored transaction to compliance_checker", () => {
    const out = processMessage(makeMessage());
    expect(out.source_agent).toBe("fraud_detector");
    expect(out.target_agent).toBe("compliance_checker");
  });
});
