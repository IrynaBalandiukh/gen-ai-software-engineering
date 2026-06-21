// Agent 1 — Transaction Validator
// Checks required fields, valid ISO 4217 currency, and amount rules using
// decimal.js. Rejects malformed transactions with a human-readable reason.

import Decimal from "decimal.js";
import { logAudit } from "./logger.ts";
import { type Message, nextAgent } from "./types.ts";

const AGENT_NAME = "transaction_validator";

// A pragmatic subset of ISO 4217 codes sufficient for the sample data and tests.
// IRR/KPW/SYP are valid ISO 4217 codes subject to compliance restrictions —
// they must pass validation so the Compliance Checker can apply its restricted-
// currency scrutiny (rather than being silently blocked before reaching it).
const VALID_CURRENCIES = new Set([
  "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD",
  "CNY", "HKD", "SGD", "SEK", "NOK", "DKK", "PLN", "ZAR",
  "IRR", "KPW", "SYP",
]);

const REQUIRED_FIELDS: Array<keyof Message["data"]> = [
  "transaction_id",
  "timestamp",
  "source_account",
  "destination_account",
  "amount",
  "currency",
  "transaction_type",
];

/** Returns a rejection reason string, or null when the transaction is valid. */
export function validate(data: Message["data"]): string | null {
  for (const field of REQUIRED_FIELDS) {
    const value = data[field];
    if (value === undefined || value === null || value === "") {
      return `missing required field: ${field}`;
    }
  }

  if (!VALID_CURRENCIES.has(data.currency)) {
    return `invalid currency code (not ISO 4217): ${data.currency}`;
  }

  let amount: Decimal;
  try {
    amount = new Decimal(data.amount);
  } catch {
    return `amount is not a valid decimal: ${data.amount}`;
  }

  if (amount.isZero()) {
    return "amount must be non-zero";
  }

  if (amount.isNegative() && data.transaction_type !== "refund") {
    return "negative amount not allowed for non-refund transaction";
  }

  return null;
}

/** One-message-in / one-message-out: validate the transaction in message.data. */
export function processMessage(message: Message): Message {
  const { data } = message;
  const reason = validate(data);

  if (reason) {
    data.status = "rejected";
    data.reason = reason;
    logAudit(AGENT_NAME, data.transaction_id, `rejected: ${reason}`);
  } else {
    data.status = "validated";
    logAudit(AGENT_NAME, data.transaction_id, "validated");
  }

  return {
    ...message,
    source_agent: AGENT_NAME,
    target_agent: nextAgent(AGENT_NAME),
    timestamp: new Date().toISOString(),
    data,
  };
}

// --- Dry-run CLI: `tsx agents/transactionValidator.ts --dry-run` ----------------
// Validates every transaction in sample-transactions.json without running the
// full pipeline. Used by the /validate-transactions skill (Task 3).
export async function dryRun(): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const samplePath = join(here, "..", "sample-transactions.json");
  const raw = await readFile(samplePath, "utf8");
  const txns = JSON.parse(raw) as Array<Message["data"]>;

  let valid = 0;
  let invalid = 0;
  const rows: Array<{ id: string; result: string; reason: string }> = [];

  for (const t of txns) {
    const reason = validate(t);
    if (reason) {
      invalid++;
      rows.push({ id: t.transaction_id, result: "INVALID", reason });
    } else {
      valid++;
      rows.push({ id: t.transaction_id, result: "valid", reason: "" });
    }
  }

  console.log(`\nValidation dry-run — ${txns.length} transactions`);
  console.log(`  valid:   ${valid}`);
  console.log(`  invalid: ${invalid}\n`);
  console.table(rows);
}

if (process.argv.includes("--dry-run")) {
  dryRun().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
