// Unit tests — Agent 3: Compliance Checker.

import { describe, expect, it } from "vitest";
import { processMessage } from "../agents/complianceChecker.ts";
import { makeMessage } from "./helpers.ts";

describe("complianceChecker.processMessage", () => {
  it("sets requiresRegulatoryReport on a transaction over $10,000", () => {
    const out = processMessage(makeMessage({ amount: "25000.00" }));
    expect(out.data.requiresRegulatoryReport).toBe(true);
    expect(out.data.compliance_notes).toContain(
      "regulatory report required (> $10,000)",
    );
  });

  it("does not require a report at or under the threshold", () => {
    const out = processMessage(makeMessage({ amount: "9999.99" }));
    expect(out.data.requiresRegulatoryReport).toBe(false);
  });

  it("records a cross-border note for non-US transactions", () => {
    const out = processMessage(
      makeMessage({ metadata: { channel: "api", country: "DE" } }),
    );
    expect(out.data.compliance_notes).toContain("cross-border (DE)");
  });

  it("records a restricted-currency note", () => {
    const out = processMessage(makeMessage({ currency: "IRR" }));
    expect(out.data.compliance_notes).toContain("restricted currency (IRR)");
  });

  it("uses absolute value for the threshold (large refund still reports)", () => {
    const out = processMessage(
      makeMessage({ amount: "-25000.00", transaction_type: "refund" }),
    );
    expect(out.data.requiresRegulatoryReport).toBe(true);
  });

  it("skips an already-rejected transaction and forwards it", () => {
    const out = processMessage(makeMessage({ status: "rejected", reason: "x" }));
    expect(out.data.requiresRegulatoryReport).toBeUndefined();
    expect(out.target_agent).toBe("settlement_processor");
  });

  it("routes to settlement_processor", () => {
    const out = processMessage(makeMessage());
    expect(out.source_agent).toBe("compliance_checker");
    expect(out.target_agent).toBe("settlement_processor");
  });
});
