// Agent 2 — Fraud Detector
// Computes an integer risk score 0–3 (+1 per signal) and raises a fraud-review
// flag when the high-value signal is present. Skips already-rejected transactions.

import Decimal from "decimal.js";
import { logAudit } from "./logger.ts";
import { type Message, nextAgent } from "./types.ts";

const AGENT_NAME = "fraud_detector";

const HIGH_VALUE_THRESHOLD = new Decimal(10000);
const HOME_COUNTRY = "US";

/** True when amount (absolute) is strictly greater than $10,000. */
function isHighValue(amount: string): boolean {
  return new Decimal(amount).abs().greaterThan(HIGH_VALUE_THRESHOLD);
}

/** True when the UTC hour of the timestamp is in [00:00, 05:00). */
function isUnusualTiming(timestamp: string): boolean {
  const hour = new Date(timestamp).getUTCHours();
  return hour >= 0 && hour < 5;
}

/** True when the transaction originates outside the bank's home country. */
function isCrossBorder(country: string | undefined): boolean {
  return country !== HOME_COUNTRY;
}

/** One-message-in / one-message-out: score the transaction for fraud risk. */
export function processMessage(message: Message): Message {
  const { data } = message;

  if (data.status === "rejected") {
    logAudit(AGENT_NAME, data.transaction_id, "skipped (already rejected)");
    return forward(message);
  }

  const signals: string[] = [];
  const highValue = isHighValue(data.amount);
  if (highValue) signals.push("high_value");
  if (isUnusualTiming(data.timestamp)) signals.push("unusual_timing");
  if (isCrossBorder(data.metadata?.country)) signals.push("cross_border");

  data.risk_score = signals.length; // integer 0–3
  data.risk_signals = signals;
  data.fraud_flagged = highValue; // flagged only when high-value signal present

  const outcome = data.fraud_flagged
    ? `flagged for fraud review (score=${data.risk_score}, signals=[${signals.join(",")}])`
    : `scored (score=${data.risk_score}, signals=[${signals.join(",")}])`;
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
