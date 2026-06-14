# Bug Context — Batch 001 (Notes API)

This file documents the reported defects in the Notes API (`src/`). It is the
entry point for the 4-agent pipeline: the Bug Researcher reads it, locates the
defects in source, and the downstream agents verify, fix, security-review, and
test the changes.

- **Application:** `src/` (Express + better-sqlite3 in-memory Notes API)
- **Run:** `npm start` → http://localhost:3000
- **Test:** `npm test`
- **Reported defects:** 2 logic bugs + 1 security vulnerability

---

## BUG-001 — Pagination off-by-one (logic)

- **Severity:** Medium (functional correctness)
- **Endpoint:** `GET /notes`
- **File:** `src/app.js` — `app.get('/notes', ...)`
- **Location:** offset calculation, `const offset = page * limit;`

### Description
The offset for SQL `LIMIT/OFFSET` pagination is computed as `page * limit`
instead of `(page - 1) * limit`. Because `page` is 1-based, the very first page
already skips the first `limit` records, and every page is shifted by one full
page. Some records are unreachable and `page=1` never returns the first items.

### Reproduction
With 12 notes in the database and default `limit=10`:
```
GET /notes?page=1&limit=10
```
- **Expected:** 10 notes, ids 1–10.
- **Actual:** 2 notes, ids 11–12 (offset = 1 * 10 = 10).

### Expected fix
`const offset = (page - 1) * limit;`

---

## BUG-002 — Incomplete input validation (logic)

- **Severity:** Medium (data integrity / unhandled 500)
- **Endpoint:** `POST /notes`
- **File:** `src/app.js` — `app.post('/notes', ...)`
- **Location:** validation guard, `if (!title) { ... }`

### Description
The create-note handler validates only `title`, even though `body` and `owner`
are also required (and `NOT NULL` in the schema). A request missing `body` or
`owner` passes validation, reaches the `INSERT`, and crashes with an unhandled
`SqliteError: NOT NULL constraint failed`, returning **HTTP 500** instead of a
clean **HTTP 400**.

### Reproduction
```
POST /notes  { "title": "x" }
```
- **Expected:** 400 with `{ "error": "title, body and owner are required" }`.
- **Actual:** 500 (NOT NULL constraint failed: notes.body).

### Expected fix
`if (!title || !body || !owner) { ... }`

---

## SEC-001 — SQL injection in search (security)

- **Severity:** Critical
- **Category:** CWE-89 SQL Injection
- **Endpoint:** `GET /search`
- **File:** `src/app.js` — `app.get('/search', ...)`
- **Location:** query construction,
  `"SELECT * FROM notes WHERE title LIKE '%" + term + "%'"`

### Description
The user-supplied `q` parameter is concatenated directly into the SQL string
instead of being passed as a bound parameter. This allows an attacker to alter
the query logic, bypass the filter, exfiltrate data, or run destructive
statements.

### Reproduction
```
GET /search?q=' OR '1'='1
```
- **Expected:** only notes whose title contains the literal term.
- **Actual:** returns **all 12 notes** (filter bypassed). A payload such as
  `'; DROP TABLE notes; --` would be destructive.

### Expected fix
Use a parameterized query and bind the term:
```js
db.prepare("SELECT * FROM notes WHERE title LIKE '%' || ? || '%'").all(term);
```

---

## Notes for the pipeline

- The smoke tests in `tests/smoke.test.js` represent the **baseline** and stay
  green; they do not yet cover these defects.
- The Unit Test Generator (agent 4) should add tests that fail on the buggy code
  and pass after the fixes (off-by-one pagination, validation, and an injection
  regression test for `/search`).
- A secondary security observation for the Security Verifier: user passwords are
  stored in **plaintext** in `src/db.js` and compared directly in `POST /login`.
  This is out of scope for the current fix batch but is a legitimate finding.
