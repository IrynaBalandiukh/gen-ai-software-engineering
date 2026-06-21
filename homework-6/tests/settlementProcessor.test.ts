// Unit tests — Agent 4: Settlement Processor.

import { describe, expect, it } from "vitest";
import { processMessage } from "../agents/settlementProcessor.ts";
import { makeMessage } from "./helpers.ts";

describe("settlementProcessor.processMessage", () => {
  it("settles a valid transaction to 2 decimal places and sets status", () => {
    const out = processMessage(makeMessage({ amount: "1500.00" }));
    expect(out.data.status).toBe("settled");
    expect(out.data.settled_amount).toBe("1500.00");
  });

  it("rounds with ROUND_HALF_UP to cash precision", () => {
    const out = processMessage(makeMessage({ amount: "100.005" }));
    expect(out.data.settled_amount).toBe("100.01");
  });

  it("keeps a fractional amount exact (TXN003 9999.99)", () => {
    const out = processMessage(makeMessage({ amount: "9999.99" }));
    expect(out.data.settled_amount).toBe("9999.99");
  });

  it("does not settle an already-rejected transaction", () => {
    const out = processMessage(
      makeMessage({ status: "rejected", reason: "invalid currency" }),
    );
    expect(out.data.status).toBe("rejected");
    expect(out.data.settled_amount).toBeUndefined();
    expect(out.data.reason).toBe("invalid currency");
  });

  it("is the last per-transaction hop (target_agent = none)", () => {
    const out = processMessage(makeMessage());
    expect(out.source_agent).toBe("settlement_processor");
    expect(out.target_agent).toBe("none");
  });
});
