// Agent 3 — Compliance Checker
// Applies regulatory rules. On any transaction > $10,000 sets
// requiresRegulatoryReport: true (distinct from the fraud risk score). Also
// records cross-border and currency-restriction observations. Skips rejected txns.

import Decimal from "decimal.js";
import { logAudit } from "./logger.ts";
import { type Message, nextAgent } from "./types.ts";

const AGENT_NAME = "compliance_checker";

const REPORTING_THRESHOLD = new Decimal(10000);
const HOME_COUNTRY = "US";

// Currencies subject to extra regulatory scrutiny (illustrative restriction list).
const RESTRICTED_CURRENCIES = new Set<string>(["IRR", "KPW", "SYP"]);

/** One-message-in / one-message-out: apply regulatory checks. */
export function processMessage(message: Message): Message {
  const { data } = message;

  if (data.status === "rejected") {
    logAudit(AGENT_NAME, data.transaction_id, "skipped (already rejected)");
    return forward(message);
  }

  const notes: string[] = [];

  const overThreshold = new Decimal(data.amount)
    .abs()
    .greaterThan(REPORTING_THRESHOLD);
  data.requiresRegulatoryReport = overThreshold;
  if (overThreshold) {
    notes.push("regulatory report required (> $10,000)");
  }

  if (data.metadata?.country !== HOME_COUNTRY) {
    notes.push(`cross-border (${data.metadata?.country})`);
  }

  if (RESTRICTED_CURRENCIES.has(data.currency)) {
    notes.push(`restricted currency (${data.currency})`);
  }

  data.compliance_notes = notes;

  const outcome = `report=${data.requiresRegulatoryReport}` +
    (notes.length ? ` notes=[${notes.join("; ")}]` : "");
  logAudit(AGENT_NAME, data.transaction_id, outcome);

  return forward(message);
}

function forward(message: Message): Message {
  return {
    ...message,
    source_agent: AGENT_NAME,
    target_agent: nextAgent(AGENT_NAME),
    timestamp: new Date().toISOString(),
    data: message.data,
  };
}
