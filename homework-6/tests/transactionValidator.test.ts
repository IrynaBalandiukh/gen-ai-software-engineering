// Unit tests — Agent 1: Transaction Validator.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dryRun,
  processMessage,
  validate,
} from "../agents/transactionValidator.ts";
import { makeMessage } from "./helpers.ts";

describe("transactionValidator.validate", () => {
  it("accepts a clean USD transfer", () => {
    expect(validate(makeMessage().data)).toBeNull();
  });

  it("rejects a missing required field with the field name", () => {
    const data = makeMessage({ currency: "" }).data;
    expect(validate(data)).toBe("missing required field: currency");
  });

  it("rejects a non-ISO-4217 currency (TXN006's XYZ)", () => {
    const data = makeMessage({ currency: "XYZ" }).data;
    expect(validate(data)).toBe("invalid currency code (not ISO 4217): XYZ");
  });

  it("rejects an unparseable amount", () => {
    const data = makeMessage({ amount: "not-a-number" }).data;
    expect(validate(data)).toBe("amount is not a valid decimal: not-a-number");
  });

  it("rejects a zero amount", () => {
    const data = makeMessage({ amount: "0.00" }).data;
    expect(validate(data)).toBe("amount must be non-zero");
  });

  it("rejects a negative amount on a non-refund transaction", () => {
    const data = makeMessage({ amount: "-100.00", transaction_type: "transfer" }).data;
    expect(validate(data)).toBe(
      "negative amount not allowed for non-refund transaction",
    );
  });

  it("accepts a negative amount when the type is refund (TXN007)", () => {
    const data = makeMessage({ amount: "-100.00", transaction_type: "refund" }).data;
    expect(validate(data)).toBeNull();
  });
});

describe("transactionValidator.processMessage", () => {
  it("marks a valid transaction validated and routes to fraud_detector", () => {
    const out = processMessage(makeMessage());
    expect(out.data.status).toBe("validated");
    expect(out.data.reason).toBeUndefined();
    expect(out.source_agent).toBe("transaction_validator");
    expect(out.target_agent).toBe("fraud_detector");
  });

  it("rejects an invalid transaction and attaches a reason", () => {
    const out = processMessage(makeMessage({ currency: "XYZ" }));
    expect(out.data.status).toBe("rejected");
    expect(out.data.reason).toBe("invalid currency code (not ISO 4217): XYZ");
  });
});

describe("transactionValidator.dryRun (CLI helper)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prints a validation table over the real sample data", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const table = vi.spyOn(console, "table").mockImplementation(() => {});

    await dryRun();

    expect(table).toHaveBeenCalledTimes(1);
    const rows = table.mock.calls[0][0] as Array<{ id: string; result: string }>;
    expect(rows.length).toBeGreaterThan(0);
    // TXN006 carries the invalid XYZ currency in the sample data.
    const txn006 = rows.find((r) => r.id === "TXN006");
    expect(txn006?.result).toBe("INVALID");
    expect(log).toHaveBeenCalled();
  });
});
