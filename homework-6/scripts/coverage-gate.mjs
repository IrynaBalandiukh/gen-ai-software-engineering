#!/usr/bin/env node
// Claude Code PreToolUse coverage gate (Task 3).
//
// Wired in .claude/settings.json as a PreToolUse hook on the Bash tool. It reads
// the tool call from stdin; when the command is a `git push`, it runs the coverage
// report and BLOCKS the push (exit code 2) if coverage is below 80%. For any other
// command it exits 0 immediately, so normal tool use is unaffected.
//
// The 80% threshold itself lives in vitest.config.ts, so this stays a single
// source of truth: `npm run coverage` exits non-zero when coverage < 80%.

import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    // Malformed payload — don't block.
    process.exit(0);
  }

  const command = payload?.tool_input?.command ?? "";
  if (!/\bgit\s+push\b/.test(command)) {
    process.exit(0); // not a push — allow
  }

  console.error("[coverage-gate] git push detected — running coverage (hard gate 80%)...");
  try {
    execSync("npm run coverage", { cwd: projectRoot, stdio: "inherit" });
  } catch {
    console.error(
      "\n❌ Coverage gate failed: test coverage is below 80%. Push blocked.\n" +
        "   Run `npm run coverage` to see the report and raise coverage to >= 80%.",
    );
    process.exit(2); // exit code 2 tells Claude Code to block the tool call
  }

  console.error("[coverage-gate] ✅ coverage >= 80% — push allowed.");
  process.exit(0);
});
