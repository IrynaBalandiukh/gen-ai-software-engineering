---
name: unit-tests-FIRST
description: >-
  The FIRST principles for unit tests (Fast, Independent, Repeatable,
  Self-validating, Timely). Defines what each principle means, how to satisfy it
  in this Jest/supertest project, and a checklist the Unit Test Generator must
  apply to every test it writes.
applies_to:
  - agents/unit-test-generator.agent.md
---

# Skill: Unit Testing with FIRST

Every test the **Unit Test Generator** produces must satisfy the five **FIRST**
properties. This skill defines each property, gives the project-specific rule,
and ends with a checklist to apply per test.

---

## F — Fast

Tests must run in milliseconds so the whole suite stays quick and is run often.

- Use the **in-memory** SQLite database (`createDb()` → `:memory:`); never touch
  disk or the network.
- Drive HTTP via `supertest(app)` in-process — do **not** start a real listener
  on a port.
- No `sleep`/timers; no real external services.

## I — Independent

Tests must not depend on each other or on execution order.

- Build a **fresh app + fresh DB in `beforeEach`** so every test starts from the
  same seeded state.
- Never share mutable state between tests; one test creating a note must not
  affect another's counts.
- Each test must pass when run alone (`jest -t "<name>"`) and in any order.

## R — Repeatable

Same result every run, on any machine, regardless of date, locale, or network.

- No reliance on `Date.now()`, random values, or wall-clock-dependent ordering;
  if time matters, inject or assert on shape, not exact timestamps.
- Because the DB is re-seeded per test, results are deterministic.
- No dependence on developer-specific env vars or ports.

## S — Self-validating

A test must decide pass/fail on its own via assertions — no human reading output.

- Assert on **HTTP status** and **response body** explicitly
  (`expect(res.status).toBe(...)`, `expect(res.body).toEqual/toHaveLength(...)`).
- No `console.log`-and-eyeball; every meaningful behaviour has an assertion.
- Prefer specific assertions (exact ids, exact status) over "truthy".

## T — Timely

Tests are written together with (or right after) the code change they cover.

- Generate tests **only for the changed code** in `fix-summary.md` (the three
  fixed endpoints), not the whole app.
- Each fix gets a test that **fails on the pre-fix code and passes after** — i.e.
  a regression test that pins the corrected behaviour.

---

## Per-test checklist (apply to every generated test)

- [ ] **Fast:** in-memory DB, in-process supertest, no I/O or sleeps.
- [ ] **Independent:** fresh `createApp(createDb())` in `beforeEach`; passes in isolation.
- [ ] **Repeatable:** no clock/random/order/env dependence.
- [ ] **Self-validating:** explicit status + body assertions; no manual inspection.
- [ ] **Timely:** targets only changed code; encodes the corrected behaviour as a regression.

---

## Coverage expectation for this project

For the changed endpoints, generate at minimum:

- **Pagination fix:** page 1 returns the true first page; page boundaries are
  contiguous; out-of-range page returns empty.
- **Validation fix:** missing `title`, missing `body`, and missing `owner` each
  return `400`; a complete payload returns `201`.
- **SQL-injection fix:** an injection payload (`' OR '1'='1`) returns no spurious
  rows; a normal term still matches; data is unchanged after an injection attempt.

Record the run result (pass/fail counts) in `test-report.md`.
