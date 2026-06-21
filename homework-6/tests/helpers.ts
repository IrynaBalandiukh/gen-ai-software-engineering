// Shared test helpers — build standard pipeline messages without repeating the
// envelope boilerplate in every test. Not a test file (no `.test.ts` suffix), so
// Vitest does not run it directly.

import { randomUUID } from "node:crypto";
import type { Message, TransactionData } from "../agents/types.ts";

/** Sensible defaults for a clean, valid USD transfer. */
const DEFAULT_DATA: TransactionData = {
  transaction_id: "TXN000",
  timestamp: "2026-03-16T12:00:00Z",
  source_account: "ACC-1000",
  destination_account: "ACC-2000",
  amount: "1000.00",
  currency: "USD",
  transaction_type: "transfer",
  description: "test transaction",
  metadata: { channel: "online", country: "US" },
  status: "validated",
};

/** Build a Message, overriding any data fields you care about for the test. */
export function makeMessage(overrides: Partial<TransactionData> = {}): Message {
  return {
    message_id: randomUUID(),
    timestamp: "2026-03-16T12:00:00Z",
    source_agent: "integrator",
    target_agent: "transaction_validator",
    message_type: "transaction",
    data: { ...DEFAULT_DATA, ...overrides },
  };
}
