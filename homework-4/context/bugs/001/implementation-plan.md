# Implementation Plan — Batch 001 (Notes API)

**Source of truth:** `context/bugs/001/research/verified-research.md` (Result:
**PASS**, L3 Good). Only PASS-verified claims are used below. Precondition met —
proceeding.

## Overview

Three defects to fix, in order. All changes are confined to `src/app.js`. They
are independent of one another (no ordering dependency), but are sequenced by
ascending line number so edits do not interfere:

1. **BUG-001** — Pagination off-by-one (`GET /notes`, line 29).
2. **BUG-002** — Incomplete input validation (`POST /notes`, line 54).
3. **SEC-001** — SQL injection in search (`GET /search`, line 70).

> Dependency note: Each edit targets a distinct, non-overlapping line and stands
> alone. Apply in the order below to keep line numbers stable as you go.

---

## Change 1 — BUG-001: Pagination off-by-one

- **File:** `src/app.js`
- **Location:** `GET /notes` handler, offset calculation (line 29)
- **Verified claims:** #1, #3, #4

**Before** (verbatim):
```js
    const offset = page * limit;
```

**After:**
```js
    const offset = (page - 1) * limit;
```

**Rationale:** `page` is 1-based (line 27 defaults it to `1`). With
`offset = page * limit`, page 1 computes offset `10` and skips the first
`limit` rows, so ids 1–10 are unreachable and `page=1` returns ids 11–12 only.
`(page - 1) * limit` makes page 1 → offset 0, correctly returning the first
`limit` rows.

---

## Change 2 — BUG-002: Incomplete input validation

- **File:** `src/app.js`
- **Location:** `POST /notes` handler, validation guard (line 54)
- **Verified claims:** #5, #6, #7

**Before** (verbatim):
```js
    if (!title) {
```

**After:**
```js
    if (!title || !body || !owner) {
```

**Rationale:** `title`, `body`, and `owner` are all `NOT NULL` in the schema
(`src/db.js:22–28`), but only `title` is validated. A request missing `body` or
`owner` reaches the `INSERT` (line 58) and crashes with a `SqliteError: NOT NULL
constraint failed`, returning HTTP 500. Guarding all three required fields
returns the existing clean HTTP 400 instead. `title`, `body`, and `owner` are
already destructured on line 53, so no further changes are needed. The existing
error message (`'title, body and owner are required'`) already matches.

---

## Change 3 — SEC-001: SQL injection in search

- **File:** `src/app.js`
- **Location:** `GET /search` handler, query construction (lines 69–71)
- **Verified claims:** #8, #9 (contrast claims #10, #11, #12 confirm the
  parameterized pattern used elsewhere)

**Before** (verbatim):
```js
    const rows = db
      .prepare("SELECT * FROM notes WHERE title LIKE '%" + term + "%'")
      .all();
```

**After:**
```js
    const rows = db
      .prepare("SELECT * FROM notes WHERE title LIKE '%' || ? || '%'")
      .all(term);
```

**Rationale:** The user-supplied `term` is concatenated directly into the SQL
string (CWE-89), allowing filter bypass (`' OR '1'='1`) or destructive payloads
(`'; DROP TABLE notes; --`). Binding `term` as a parameter and constructing the
`LIKE` pattern with SQL string concatenation (`'%' || ? || '%'`) treats the
input as data, not code. This matches the parameterized style already used for
`/notes` (`:32`), `/notes/:id` (`:42`), and the `INSERT` (`:58`).

---

## Validation

- **Command:** `npm test`
- **Expected outcome:** all tests pass. The existing smoke tests in
  `tests/smoke.test.js` (baseline) stay green, and any defect-specific tests
  added by the downstream Unit Test Generator for the off-by-one pagination,
  input validation, and `/search` injection regression pass against the fixed
  code.

---

## References

- BUG-001 — `src/app.js:29` (offset calculation), handler `src/app.js:26–36`
- BUG-002 — `src/app.js:54` (validation guard), handler `src/app.js:52–62`;
  schema `src/db.js:22–28`
- SEC-001 — `src/app.js:70` (concatenated query), handler `src/app.js:67–73`;
  parameterized contrasts at `src/app.js:32`, `:42`, `:58`
