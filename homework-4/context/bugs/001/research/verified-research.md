# Verified Research — Batch 001 (Notes API)

## Verification Summary

- Result: PASS
- Research Quality: L3 Good (per research-quality-measurement skill)
- Scope: `src/app.js`, `src/db.js`; defects BUG-001, BUG-002, SEC-001 (+ one
  out-of-scope secondary observation). All references and snippets in
  `research/codebase-research.md` were opened and checked against live source.

## Verified Claims

| #   | Claim | Reference (file:line) | Snippet matches? | Status            |
| --- | ----- | --------------------- | ---------------- | ----------------- |
| 1   | BUG-001 offset bug: `const offset = page * limit;` | src/app.js:29 | yes | Verified |
| 2   | BUG-001 handler full context (`/notes`) | src/app.js:26–35 (actually 26–**36**) | yes | Partially Verified |
| 3   | BUG-001 root cause: 1-based `page` ⇒ offset skips first `limit` rows | src/app.js:27,29,33 | yes | Verified |
| 4   | BUG-001 supporting evidence: 12 seeded notes, page size 10 spans 2 pages | src/db.js:38–54 | yes | Verified |
| 5   | BUG-002 weak guard: `if (!title) {` | src/app.js:54 | yes | Verified |
| 6   | BUG-002 handler full context (`POST /notes`) | src/app.js:52–62 | yes | Verified |
| 7   | BUG-002 root cause: `body`/`owner` are `NOT NULL` but unvalidated | src/db.js:22–28 | yes | Verified |
| 8   | SEC-001 SQLi: term concatenated into query string | src/app.js:70 | yes | Verified |
| 9   | SEC-001 handler full context (`GET /search`) | src/app.js:67–73 | yes | Verified |
| 10  | SEC-001 contrast: `/notes` query is parameterized | src/app.js:32 | yes | Verified |
| 11  | SEC-001 contrast: `/notes/:id` query is parameterized | src/app.js:42 | yes | Verified |
| 12  | SEC-001 contrast: `INSERT` is parameterized | src/app.js:58 | yes | Verified |
| 13  | Secondary: plaintext password seeds | src/db.js:31–33 | yes | Verified |
| 14  | Secondary: plaintext password comparison in `/login` | src/app.js:81 | yes | Verified |

## Discrepancies Found

- **Claim #2 (BUG-001 full context range), non-critical.** The research labels
  the `/notes` handler block `src/app.js:26-35`, but the handler's closing
  `});` is on line **36** — the quoted range ends one line short (block actually
  spans 26–36). The quoted code is verbatim-correct and the defect-critical line
  (`src/app.js:29`) is exact, so this is a stale/imprecise range label only, not
  a blocking error. No other discrepancies: every defect-critical `file:line`,
  snippet, and root cause was confirmed against live source.

## Research Quality Assessment

- Level: L3 Good
- Reasoning: All three reported defects in `bug-context.md` are covered, every
  defect-critical reference (`src/app.js:29`, `:54`, `:70`) is exact, all quoted
  snippets match source verbatim, the contrast references (`:32`, `:42`, `:58`)
  and schema reference (`src/db.js:22-28`) are correct, and each root cause and
  proposed fix direction is concrete and directly actionable for the Bug Planner.
  The research does not reach L4 ("100% of references verified; all claims
  correct") solely because of one minor, non-blocking discrepancy — a context
  range label that undershoots its end line by one (claim #2). Per the rubric,
  this kind of stale line number caps the level at L3 while leaving the result a
  clear PASS: the Bug Planner may proceed without re-running research.

## References

- src/app.js:26–36 — `GET /notes` handler (BUG-001; offset at :29)
- src/app.js:32 — parameterized `/notes` query (SEC-001 contrast)
- src/app.js:41–47 — `GET /notes/:id` handler (parameterized query at :42)
- src/app.js:52–62 — `POST /notes` handler (BUG-002; guard at :54, INSERT at :58)
- src/app.js:67–73 — `GET /search` handler (SEC-001; concatenated query at :70)
- src/app.js:78–85 — `POST /login` handler (plaintext comparison at :81)
- src/db.js:15–29 — schema: `notes.title/body/owner` all `NOT NULL` (:22–28)
- src/db.js:31–33 — plaintext user seeds (`admin`/`s3cr3t`, `iryna`/`password123`)
- src/db.js:35–54 — 12 seeded notes (BUG-001 observability)
