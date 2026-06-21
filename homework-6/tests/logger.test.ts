// Unit tests — audit logger and PII masking.

import { afterEach, describe, expect, it, vi } from "vitest";
import { logAudit, maskAccount } from "../agents/logger.ts";

describe("logger.maskAccount", () => {
  it("masks all but the last 4 characters", () => {
    expect(maskAccount("ACC-1001")).toBe("***1001");
  });

  it("returns a masked placeholder for an undefined account", () => {
    expect(maskAccount(undefined)).toBe("***");
  });
});

describe("logger.logAudit", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns a structured entry with the non-PII fields", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const entry = logAudit("fraud_detector", "TXN001", "scored (score=0)");
    expect(entry.agent).toBe("fraud_detector");
    expect(entry.transaction_id).toBe("TXN001");
    expect(entry.outcome).toBe("scored (score=0)");
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
  });

  it("writes a single audit line to stdout", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logAudit("transaction_validator", "TXN001", "validated");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("transaction_validator");
    expect(log.mock.calls[0][0]).toContain("TXN001");
  });
});
