# HOWTORUN — Notes API & 4-Agent Bug Pipeline

## 1. Install

```bash
npm install
```

---

## 2. Run the app

```bash
npm start
```

Prints `Notes API listening on http://localhost:3000`. Leave it running and open
a **second** terminal for requests. Stop with **Ctrl + C**.

**Custom port** (defaults to 3000):

| Shell             | Command                      |
| ----------------- | ---------------------------- |
| **PowerShell**    | `$env:PORT=4000; npm start`  |
| **cmd**           | `set PORT=4000 && npm start` |
| **macOS / Linux** | `PORT=4000 npm start`        |

---

## 3. API endpoints

The Notes API exposes these routes (server running on `http://localhost:3000`):

| Method & path    | Purpose                         | Body / query                   |
| ---------------- | ------------------------------- | ------------------------------ |
| `GET /health`    | Health check                    | —                              |
| `GET /notes`     | List notes (paginated)          | `?page=1&limit=10`             |
| `GET /notes/:id` | Get one note by id              | —                              |
| `POST /notes`    | Create a note                   | `{ "title", "body", "owner" }` |
| `GET /search`    | Search notes by title substring | `?q=<term>`                    |
| `POST /login`    | Log in                          | `{ "username", "password" }`   |

The database is in-memory and seeded on every start with **12 notes** and two
users: `admin` / `s3cr3t` and `iryna` / `password123`.

**curl** (macOS / Linux / Git Bash):

```bash
curl http://localhost:3000/health
curl "http://localhost:3000/notes?page=1&limit=10"
curl http://localhost:3000/notes/1
curl -X POST http://localhost:3000/notes -H "Content-Type: application/json" -d "{\"title\":\"Shopping\",\"body\":\"Milk and eggs\",\"owner\":\"iryna\"}"
curl "http://localhost:3000/search?q=Ideas"
curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"s3cr3t\"}"
```

**PowerShell** (its `curl` is an alias for `Invoke-WebRequest` — use
`Invoke-RestMethod` instead):

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod "http://localhost:3000/notes?page=1&limit=10"
Invoke-RestMethod http://localhost:3000/notes/1
Invoke-RestMethod -Method Post http://localhost:3000/notes -ContentType "application/json" -Body '{"title":"Shopping","body":"Milk and eggs","owner":"iryna"}'
Invoke-RestMethod "http://localhost:3000/search?q=Ideas"
Invoke-RestMethod -Method Post http://localhost:3000/login -ContentType "application/json" -Body '{"username":"admin","password":"s3cr3t"}'
```

---

## 4. Run the tests

```bash
npm test
```

Runs the full suite under `tests/` (Jest + supertest, a fresh in-memory DB per
test). Variations: `npx jest <file>` (one file), `npx jest --watch`,
`npx jest --coverage`.

---

## 5. Run the bug-fixing agent pipeline

This is an automated **bug-fixing pipeline of 6 agents** that research, verify,
plan, fix, security-review, and test the defects in `src/`. A single command
(`scripts/run-pipeline.js`) runs every agent strictly in order and auto-loads each
agent’s skills from its frontmatter:

1. **Bug Researcher** → locates each defect in source
2. **Bug Research Verifier** → fact-checks the research (uses the
   research-quality-measurement skill)
3. **Bug Planner** → turns verified findings into a before/after plan
4. **Bug Fixer** → applies the plan to `src/` and runs the tests
5. **Security Verifier** → reviews the changed code (report only)
6. **Unit Test Generator** → writes tests for the changed code (uses the
   unit-tests-FIRST skill)

**Requirements:** Node.js ≥ 18 (always); for a **live** run, the **Claude Code
CLI** (`claude`) on your PATH. The dry run needs only Node.

The pipeline’s artifacts are already committed under `context/bugs/XXX/`;
the commands below let you inspect or re-run it.

**Dry run** (free, no model calls, changes nothing):

```bash
npm run pipeline:dry
```

Prints each stage’s agent, model, skills, and tools — ideal for a screenshot.

**Live run** (needs the `claude` CLI on PATH):

```bash
npm run pipeline
```

Stages run strictly in order and stop on the first failure.

**Different batch** (default `001`):

| Shell             | Command                              |
| ----------------- | ------------------------------------ |
| **PowerShell**    | `$env:BATCH="002"; npm run pipeline` |
| **cmd**           | `set BATCH=002 && npm run pipeline`  |
| **macOS / Linux** | `BATCH=002 npm run pipeline`         |

> A live run executes agents with `--dangerously-skip-permissions` and can modify
> files under `src/` and `tests/`. Run on a clean git tree and review with
> `git diff`.

---
