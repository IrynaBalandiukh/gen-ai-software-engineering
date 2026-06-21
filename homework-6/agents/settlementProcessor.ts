// Agent 4 — Settlement Processor
// Computes the settled amount with decimal.js (ROUND_HALF_UP, 2 dp) and sets the
// final status. Never settles an already-rejected transaction — it passes the
// rejected status and reason through unchanged.

import Decimal from "decimal.js";
import { logAudit } from "./logger.ts";
import { type Message, nextAgent } from "./types.ts";

const AGENT_NAME = "settlement_processor";

// Pin the rounding mode so settlement is deterministic regardless of global config.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

/** One-message-in / one-message-out: settle the transaction. */
export function processMessage(message: Message): Message {
  const { data } = message;

  if (data.status === "rejected") {
    logAudit(
      AGENT_NAME,
      data.transaction_id,
      `not settled (rejected: ${data.reason ?? "unknown"})`,
    );
    return forward(message);
  }

  const settled = new Decimal(data.amount).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  data.settled_amount = settled.toFixed(2);
  data.status = "settled";

  logAudit(
    AGENT_NAME,
    data.transaction_id,
    `settled amount=${data.settled_amount} ${data.currency}`,
  );

  return forward(message);
}

function forward(message: Message): Message {
  return {
    ...message,
    source_agent: AGENT_NAME,
    target_agent: nextAgent(AGENT_NAME), // "none" — this is the last per-txn agent
    timestamp: new Date().toISOString(),
    data: message.data,
  };
}
