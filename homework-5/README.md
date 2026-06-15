# Homework 5 — Configure MCP Servers

## Student & task summary

- **Student Name**: Iryna Balandiukh
- **Date Submitted**: 15.06.2026
- **AI Tools Used**: Claude Code

---

Four MCP servers configured and verified in a single Claude Code project: three official servers (GitHub, Filesystem, Jira) and one custom FastMCP server built from scratch. Each server is registered in `.mcp.json`, tested with a live interaction, and documented with screenshots.

## Configured MCP Servers

| # | Server | Config key | Interaction performed |
|---|--------|------------|----------------------|
| 1 | **GitHub MCP** (`@modelcontextprotocol/server-github`) | `github` | Listed pull requests and commits for this repository |
| 2 | **Filesystem MCP** (`@modelcontextprotocol/server-filesystem`) | `filesystem` | Listed and read files inside the course project directory |
| 3 | **Jira MCP** (`mcp-atlassian`) | `jira` | Retrieved the last 5 bug tickets from a Jira project |
| 4 | **Custom FastMCP** (`server.py`) | `custom-mcp` | Called the `read` tool to return words from `lorem-ipsum.md` |

## Custom MCP Server

A minimal MCP server built with FastMCP. It exposes a resource URI and a callable tool that both return a configurable number of words from a local `lorem-ipsum.md` file.

| Type     | Name / URI                     | Description                                                                                              |
| -------- | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Resource | `lorem://content/{word_count}` | Returns the first `word_count` words from `lorem-ipsum.md`                                               |
| Tool     | `read`                         | Callable tool that accepts an optional `word_count` parameter (default: 30) and returns the same content |

## Project structure

```
homework-5/
├── README.md
├── HOWTORUN.md
├── .mcp.json                          # all 4 servers registered
├── custom-mcp-server/
│   ├── server.py                      # FastMCP server — resource + tool definitions
│   ├── lorem-ipsum.md                 # source text file
│   └── requirements.txt               # Python dependencies (fastmcp)
└── docs/
    └── screenshots/                   # one screenshot per MCP server
```
