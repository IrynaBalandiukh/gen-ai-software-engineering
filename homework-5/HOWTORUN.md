# How to Run — Custom MCP Server

## Prerequisites

- Python 3.10+
- `pip` available in your terminal
- Claude Code CLI (for MCP integration)

---

## 1. Install dependencies

From inside the `custom-mcp-server/` directory:

```bash
pip install -r requirements.txt
```

`requirements.txt` contains:

```
fastmcp
```

---

## 2. Run the server (standalone test)

```bash
python server.py
```

The server starts on stdio transport by default (as required by the MCP protocol). You should see FastMCP initialisation output. This is a standalone test only. When connected via MCP configuration (step 3),
Claude Code launches the server automatically — no separate terminal needed.

---

## 3. Connect via MCP configuration

The `.mcp.json` at the project root already registers all four servers. Replace placeholder values with your own credentials before running:

- `GITHUB_TOKEN` — a GitHub personal access token with `repo` scope
- `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN` — your Atlassian instance URL, email, and API token

To connect only the custom MCP server in a fresh environment, add the following entry to your `.mcp.json` (project root) or `~/.claude/mcp.json` (global):

```json
{
  "mcpServers": {
    "custom-mcp": {
      "type": "stdio",
      "command": "python",
      "args": ["/absolute/path/to/custom-mcp-server/server.py"]
    }
  }
}
```

Replace `/absolute/path/to/custom-mcp-server/server.py` with the actual absolute path on your machine.

**Windows example:**

```json
"args": [
  "C:\\Users\\YourName\\Projects\\homework-5\\custom-mcp-server\\server.py"
]
```

After saving, reload Claude Code (`/mcp` → refresh, or restart the CLI). The server named `custom-mcp` should appear as connected.

---

## 4. Verify the MCP config is active

In Claude Code, run:

```
/mcp
```

You should see `custom-mcp` listed as a connected server with the `read` tool available.

---

## 5. Use / test the `read` tool

### From Claude Code chat

Ask Claude to call the tool directly:

```
Use the read tool from custom-mcp to get 20 words.
```

Or with the default word count:

```
Call the read tool.
```

### From the MCP resource URI

Claude can also read the resource directly:

```
Read the resource lorem://content/50
```

This returns the first 50 words from `lorem-ipsum.md`.

### Expected output (default 30 words)

```
Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis
nostrud exercitation ullamco laboris nisi
```
