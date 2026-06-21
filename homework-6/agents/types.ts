// Shared types for the multi-agent banking pipeline.
// Every agent reads and writes the standard Message shape (see CLAUDE.md §3).

/** The raw transaction record as it appears in sample-transactions.json. */
export interface Transaction {
  transaction_id: string;
  timestamp: string; // ISO 8601 / UTC
  source_account: string; // PII — never log in plaintext
  destination_account: string; // PII — never log in plaintext
  amount: string; // decimal string — parse with decimal.js, never as a float
  currency: string; // ISO 4217
  transaction_type: string; // transfer | wire_transfer | refund | ...
  description: string;
  metadata: {
    channel: string;
    country: string;
  };
}

/** Final/intermediate decision status carried through the pipeline. */
export type Status = "validated" | "rejected" | "accepted" | "settled";

/**
 * The transaction data plus the decision fields each agent accumulates as the
 * message flows down the pipeline.
 */
export interface TransactionData extends Transaction {
  status: Status;
  reason?: string; // why a transaction was rejected (human-readable)
  risk_score?: number; // fraud risk score, integer 0–3
  fraud_flagged?: boolean; // true when the high-value fraud signal is present
  risk_signals?: string[]; // which fraud signals fired
  requiresRegulatoryReport?: boolean; // compliance regulatory flag (> $10,000)
  compliance_notes?: string[]; // regulatory observations
  settled_amount?: string; // decimal string, ROUND_HALF_UP to 2 dp
}

/** The standard message envelope passed between agents as JSON files. */
export interface Message {
  message_id: string; // uuid4
  timestamp: string; // ISO 8601 / UTC — when this hop was written
  source_agent: string; // the agent that produced this message
  target_agent: string; // the next agent in the flow ("" / "none" when final)
  message_type: string; // "transaction"
  data: TransactionData;
}

/** Aggregated pipeline summary produced by the Reporting Agent. */
export interface Summary {
  total_processed: number;
  accepted: number;
  rejected: number;
  flagged_for_fraud: number;
  rejection_reasons: string[];
}

/**
 * Per-transaction agent order. Each agent derives its next hop from this list
 * rather than hardcoding the target agent (see CLAUDE.md routing note).
 */
export const PIPELINE_ORDER = [
  "transaction_validator",
  "fraud_detector",
  "compliance_checker",
  "settlement_processor",
] as const;

export type AgentName = (typeof PIPELINE_ORDER)[number];

/** Returns the agent that follows `current`, or "none" if `current` is last. */
export function nextAgent(current: AgentName): string {
  const idx = PIPELINE_ORDER.indexOf(current);
  if (idx === -1 || idx === PIPELINE_ORDER.length - 1) return "none";
  return PIPELINE_ORDER[idx + 1];
}
