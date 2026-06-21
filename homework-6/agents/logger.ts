// Audit logging helper.
// Every agent operation logs an ISO 8601 / UTC timestamp, the agent name, the
// transaction id, and the outcome — and NEVER logs PII (account numbers, names).

/** Masks a sensitive account identifier, e.g. "ACC-1001" -> "ACC-***1001". */
export function maskAccount(account: string | undefined): string {
  if (!account) return "***";
  const tail = account.slice(-4);
  return `***${tail}`;
}

/** Structured audit log entry. */
export interface AuditEntry {
  timestamp: string;
  agent: string;
  transaction_id: string;
  outcome: string;
}

/**
 * Writes an audit line to stdout. Only non-PII fields are emitted: timestamp,
 * agent, transaction id, and the outcome string.
 */
export function logAudit(
  agent: string,
  transactionId: string,
  outcome: string,
): AuditEntry {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    agent,
    transaction_id: transactionId,
    outcome,
  };
  console.log(
    `[${entry.timestamp}] ${entry.agent} txn=${entry.transaction_id} :: ${entry.outcome}`,
  );
  return entry;
}
