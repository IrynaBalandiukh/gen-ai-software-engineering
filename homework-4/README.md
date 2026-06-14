# Homework 4 — Multi-Agent Bug-Fixing Pipeline

## Student & task summary

- **Student Name**: Iryna Balandiukh
- **Date Submitted**: 01.06.2026
- **AI Tools Used**: Claude Code

---

## Overview

This homework builds an automated **bug-fixing pipeline of AI agents** that
operates on a small, self-contained sample application. The agents research the
reported defects, fact-check that research, plan exact fixes, apply them,
security-review the changes, and generate unit tests — all chained behind a
**single command** that runs each agent in order and auto-loads its skills.

> **Run & test instructions live in [HOWTORUN.md](./HOWTORUN.md).**

---

## The sample application — Notes API

A minimal **REST API for notes**, deliberately kept simple so the pipeline can
produce concrete, demonstrable results.

- **Stack:** Node.js + Express, with an in-memory **SQLite** database
  (`better-sqlite3`). No external services, no disk persistence — a fresh DB is
  seeded on every start (12 notes, 2 users).
- **Tests:** Jest + supertest, each test running against an isolated in-memory DB.
- **Endpoints:** `GET /health`, `GET /notes` (paginated), `GET /notes/:id`,
  `POST /notes`, `GET /search`, `POST /login`.

The app ships with a small set of **seeded defects** (documented in
`context/bugs/001/bug-context.md`) that exist purely as work for the pipeline to
find and fix — that's the substrate the agents operate on.

---

## The agent pipeline

Six agents run in a strict order. The first three prepare and verify the work;
the last three change the code and prove it. The pipeline **stops on the first
failure**, and each stage's output is the next stage's input.

```
Bug Researcher → Research Verifier → Bug Planner
              → Bug Fixer → Security Verifier → Unit Test Generator
```

### What each agent does

| #   | Agent                     | Role                                                                                | Input                                    | Output                               | Model                       |
| --- | ------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------ | --------------------------- |
| 1   | **Bug Researcher**        | Locate each reported defect in source and quote it verbatim                         | `bug-context.md`                         | `research/codebase-research.md`      | `claude-opus-4-8`           |
| 2   | **Bug Research Verifier** | Fact-check every `file:line` and snippet against live source; rate research quality | `codebase-research.md`, `bug-context.md` | `research/verified-research.md`      | `claude-opus-4-8`           |
| 3   | **Bug Planner**           | Turn verified findings into exact before/after edits + test command                 | `verified-research.md`                   | `implementation-plan.md`             | `claude-opus-4-8`           |
| 4   | **Bug Fixer**             | Apply the plan to `src/`, run the test suite, document the result                   | `implementation-plan.md`                 | `fix-summary.md` + edits in `src/`   | `claude-sonnet-4-6`         |
| 5   | **Security Verifier**     | Security-review the changed code (injection, secrets, validation…); report only     | `fix-summary.md` + changed files         | `security-report.md`                 | `claude-opus-4-8`           |
| 6   | **Unit Test Generator**   | Write & run tests for the changed code only                                         | `fix-summary.md` + changed files         | `test-report.md` + tests in `tests/` | `claude-haiku-4-5-20251001` |

> Agents 1 and 3 (Researcher, Planner) are **supporting** stages that make the
> pipeline runnable end-to-end; agents 2, 4, 5, 6 are the four required agents.

### Why this design — the gain

- **Separation of concerns.** Researching, verifying, planning, fixing, securing,
  and testing are distinct jobs. Splitting them keeps each agent's prompt focused
  and its output auditable, instead of one agent doing everything opaquely.
- **A verification gate.** The Research Verifier exists because an LLM researcher
  can hallucinate a line number or misquote code. Nothing gets planned or fixed
  until the research is fact-checked and rated **PASS** — so errors are caught at
  the cheapest point, before any code changes.
- **Independent security review.** The Security Verifier is **read-only** and
  separate from the Fixer, so the same model that wrote a change isn't the only
  one judging its safety.
- **Regression tests as proof.** The Test Generator locks the corrected behaviour
  in place so a fix can't silently regress later.

### Skills (auto-loaded by the orchestrator)

| Skill                                    | Used by             | Purpose                                                                                                                      |
| ---------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `skills/research-quality-measurement.md` | Research Verifier   | Defines the **L1–L4 quality rubric** and the exact required sections of `verified-research.md`.                              |
| `skills/unit-tests-FIRST.md`             | Unit Test Generator | Defines the **FIRST** principles (Fast, Independent, Repeatable, Self-validating, Timely) every generated test must satisfy. |

`scripts/run-pipeline.js` reads each agent's frontmatter, **auto-loads** the
skills listed there, and inlines them into the agent's prompt — so skills are
applied without any manual step.

### Per-agent model choice (and why)

Each agent declares an explicit `model:` in its frontmatter, matched to its task:

- **`claude-opus-4-8` — Bug Researcher, Research Verifier, Bug Planner, Security
  Verifier.** These are the pipeline's reasoning-heavy stages: locating each
  defect, fact-checking the research, turning verified findings into an exact
  patch plan, and adversarially reviewing the changed code for security issues.
  Every one of them feeds something that's applied or trusted downstream, so the
  strongest model is justified — a wrong lead, an unverified claim, a faulty plan,
  or a missed injection is expensive to recover from later.
- **`claude-sonnet-4-6` — Bug Fixer.** Applying an explicit before/after plan and
  running the test command is precise, low-ambiguity execution: the hard reasoning
  was already done by the Planner. A fast, balanced model is the right
  cost/throughput trade-off here.
- **`claude-haiku-4-5` — Unit Test Generator.** Generating tests against an
  established framework and an explicit FIRST checklist is structured
  scaffolding; the fastest, cheapest model keeps the final stage quick while the
  skill supplies the rigor.

---

## Folder structure

```
homework-4/
├── README.md                     # this file
├── HOWTORUN.md                   # how to install, run, test, and run the pipeline
├── package.json                 # scripts: start, test, pipeline, pipeline:dry
├── src/                         # the Notes API
│   ├── server.js                #   HTTP entry point (npm start)
│   ├── app.js                   #   Express app + routes
│   └── db.js                    #   in-memory SQLite schema + seed data
├── tests/                       # Jest + supertest suite
├── agents/                      # the 6 agent definitions (*.agent.md)
│   ├── bug-researcher.agent.md
│   ├── research-verifier.agent.md
│   ├── bug-planner.agent.md
│   ├── bug-fixer.agent.md
│   ├── security-verifier.agent.md
│   └── unit-test-generator.agent.md
├── skills/
│   ├── research-quality-measurement.md   # rubric used by the Research Verifier
│   └── unit-tests-FIRST.md               # FIRST principles used by the Test Generator
├── scripts/
│   └── run-pipeline.js          # single-command orchestrator
├── context/bugs/001/            # one bug "batch": input + all agent artifacts
│   ├── bug-context.md           #   input: the reported defects
│   ├── research/
│   │   ├── codebase-research.md
│   │   └── verified-research.md
│   ├── implementation-plan.md
│   ├── fix-summary.md
│   ├── security-report.md
│   └── test-report.md
└── docs/screenshots/            # evidence: pipeline run, tests, security scan
```
