// Agent 5 — Reporting Agent
// Runs ONCE after the per-transaction loop. Aggregates all result messages into a
// pipeline Summary (feeds the MCP pipeline://summary resource). Not part of the
// per-transaction processMessage chain.

import { logAudit } from "./logger.ts";
import type { Message, Summary } from "./types.ts";

const AGENT_NAME = "reporting_agent";

/** Aggregate the collected result messages into a pipeline summary. */
export function generateReport(results: Message[]): Summary {
  const summary: Summary = {
    total_processed: results.length,
    accepted: 0,
    rejected: 0,
    flagged_for_fraud: 0,
    rejection_reasons: [],
  };

  for (const msg of results) {
    const { data } = msg;
    if (data.status === "rejected") {
      summary.rejected++;
      summary.rejection_reasons.push(
        `${data.transaction_id}: ${data.reason ?? "unknown"}`,
      );
    } else {
      // settled / accepted / validated-and-passed
      summary.accepted++;
    }
    if (data.fraud_flagged) summary.flagged_for_fraud++;
  }

  logAudit(
    AGENT_NAME,
    "ALL",
    `summary processed=${summary.total_processed} accepted=${summary.accepted} ` +
      `rejected=${summary.rejected} flagged=${summary.flagged_for_fraud}`,
  );

  return summary;
}
