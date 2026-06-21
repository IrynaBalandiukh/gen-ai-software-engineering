// Custom MCP server (Task 4) — makes the banking pipeline queryable.
//
// Exposes:
//   - Tool  get_transaction_status(transaction_id)  -> status from shared/results/
//   - Tool  list_pipeline_results()                 -> summary of all processed txns
//   - Resource pipeline://summary                    -> latest run summary as text
//
// Run as:  npx tsx mcp/server.ts   (configured in .mcp.json as "pipeline-status").
// Communicates over stdio, per the MCP stdio transport.
//
// PII note: account numbers/names are never returned — only decision fields
// (status, reason, amounts, flags), consistent with the project's PII rule.

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS_DIR = join(ROOT, "shared", "results");

/** Non-PII view of a processed transaction result. */
interface ResultView {
  transaction_id: string;
  status: string;
  currency?: string;
  settled_amount?: string;
  reason?: string;
  fraud_flagged?: boolean;
  risk_score?: number;
  requiresRegulatoryReport?: boolean;
}

/** Read one result file and project it to a non-PII view. */
async function readResult(transactionId: string): Promise<ResultView | null> {
  try {
    const raw = await readFile(
      join(RESULTS_DIR, `${transactionId}.json`),
      "utf8",
    );
    const msg = JSON.parse(raw);
    const d = msg.data ?? {};
    return {
      transaction_id: d.transaction_id ?? transactionId,
      status: d.status ?? "unknown",
      currency: d.currency,
      settled_amount: d.settled_amount,
      reason: d.reason,
      fraud_flagged: d.fraud_flagged,
      risk_score: d.risk_score,
      requiresRegulatoryReport: d.requiresRegulatoryReport,
    };
  } catch {
    return null;
  }
}

/** Read every TXN*.json result into non-PII views. */
async function readAllResults(): Promise<ResultView[]> {
  let files: string[];
  try {
    files = await readdir(RESULTS_DIR);
  } catch {
    return [];
  }
  const ids = files
    .filter((f) => f.endsWith(".json") && f !== "_summary.json")
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
  const views: ResultView[] = [];
  for (const id of ids) {
    const v = await readResult(id);
    if (v) views.push(v);
  }
  return views;
}

/** Read the latest pipeline summary text (or a friendly message if absent). */
async function readSummaryText(): Promise<string> {
  try {
    const raw = await readFile(join(RESULTS_DIR, "_summary.json"), "utf8");
    const s = JSON.parse(raw);
    const lines = [
      "Pipeline Summary",
      "================",
      `Total processed:   ${s.total_processed}`,
      `Accepted/settled:  ${s.accepted}`,
      `Rejected:          ${s.rejected}`,
      `Flagged for fraud: ${s.flagged_for_fraud}`,
    ];
    if (Array.isArray(s.rejection_reasons) && s.rejection_reasons.length) {
      lines.push("Rejection reasons:");
      for (const r of s.rejection_reasons) lines.push(`  - ${r}`);
    }
    return lines.join("\n");
  } catch {
    return "No pipeline summary found. Run `npm run pipeline` first to generate shared/results/_summary.json.";
  }
}

const server = new McpServer({
  name: "pipeline-status",
  version: "1.0.0",
});

// Tool: get_transaction_status -------------------------------------------------
server.registerTool(
  "get_transaction_status",
  {
    description:
      "Get the current processing status of a single transaction from shared/results/.",
    inputSchema: { transaction_id: z.string() },
  },
  async ({ transaction_id }) => {
    const view = await readResult(transaction_id);
    if (!view) {
      return {
        content: [
          {
            type: "text",
            text: `No result found for transaction '${transaction_id}'. It may not have been processed yet — run \`npm run pipeline\`.`,
          },
        ],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(view, null, 2) }],
    };
  },
);

// Tool: list_pipeline_results --------------------------------------------------
server.registerTool(
  "list_pipeline_results",
  {
    description:
      "List a summary of all processed transactions (id, status, amount, flags).",
    inputSchema: {},
  },
  async () => {
    const views = await readAllResults();
    if (!views.length) {
      return {
        content: [
          {
            type: "text",
            text: "No processed transactions found. Run `npm run pipeline` to populate shared/results/.",
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: views.length, results: views }, null, 2),
        },
      ],
    };
  },
);

// Resource: pipeline://summary -------------------------------------------------
server.registerResource(
  "pipeline-summary",
  "pipeline://summary",
  {
    title: "Pipeline Run Summary",
    description: "The latest multi-agent pipeline run summary as text.",
    mimeType: "text/plain",
  },
  async (uri) => ({
    contents: [{ uri: uri.href, text: await readSummaryText() }],
  }),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Note: do NOT console.log to stdout — stdout is the MCP transport channel.
  console.error("[pipeline-status] MCP server connected over stdio.");
}

main().catch((err) => {
  console.error("[pipeline-status] fatal:", err);
  process.exit(1);
});
