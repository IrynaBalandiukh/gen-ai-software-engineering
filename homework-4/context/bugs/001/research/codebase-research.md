# Codebase Research — Batch 001 (Notes API)

Investigation of the three reported defects in `bug-context.md` against the
application source under `src/`. No code was modified. Each section pinpoints the
exact `file:line`, quotes the offending code verbatim, states the root cause, and
proposes a fix direction for the Bug Planner.

---

## BUG-001 — Pagination off-by-one (logic)

- **Location:** `src/app.js:29`
- **Current code:**
  ```js
  const offset = page * limit;
  ```
  Full context (`src/app.js:26-35`):
  ```js
  app.get('/notes', (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = page * limit;

    const rows = db
      .prepare('SELECT * FROM notes ORDER BY id LIMIT ? OFFSET ?')
      .all(limit, offset);

    res.json({ page, limit, notes: rows });
  });
  ```
- **Root cause:** `page` is 1-based (defaults to `1`), but the offset is computed
  as `page * limit`. For `page=1, limit=10` the offset becomes `10`, so the first
  page already skips the first 10 records. Every page is shifted forward by one
  full page and the first `limit` records are unreachable.
- **Proposed fix direction:** Compute the offset relative to a zero-based page
  index — `const offset = (page - 1) * limit;` — so `page=1` yields offset `0`.
- **References:** `src/app.js:26-35` (handler), `src/db.js:38-54` (12 seeded
  notes confirm page size 10 spans two pages, making the bug observable).

---

## BUG-002 — Incomplete input validation (logic)

- **Location:** `src/app.js:54`
- **Current code:**
  ```js
  if (!title) {
    return res.status(400).json({ error: 'title, body and owner are required' });
  }
  ```
  Full context (`src/app.js:52-62`):
  ```js
  app.post('/notes', (req, res) => {
    const { title, body, owner } = req.body || {};
    if (!title) {
      return res.status(400).json({ error: 'title, body and owner are required' });
    }
    const info = db
      .prepare('INSERT INTO notes (title, body, owner) VALUES (?, ?, ?)')
      .run(title, body, owner);
    const created = db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  });
  ```
- **Root cause:** The validation guard checks only `title`, but `body` and `owner`
  are also `NOT NULL` in the schema (`src/db.js:22-28`). A request missing `body`
  or `owner` passes the guard, reaches the `INSERT`, and throws
  `SqliteError: NOT NULL constraint failed`, surfacing as an unhandled HTTP 500
  instead of a clean HTTP 400.
- **Proposed fix direction:** Extend the guard to require all three fields —
  `if (!title || !body || !owner) { ... }` — matching the error message that
  already states "title, body and owner are required".
- **References:** `src/app.js:52-62` (handler), `src/db.js:22-28` (notes table
  schema: `title`, `body`, `owner` all `NOT NULL`).

---

## SEC-001 — SQL injection in search (security, CWE-89)

- **Location:** `src/app.js:70`
- **Current code:**
  ```js
  .prepare("SELECT * FROM notes WHERE title LIKE '%" + term + "%'")
  ```
  Full context (`src/app.js:67-73`):
  ```js
  app.get('/search', (req, res) => {
    const term = String(req.query.q || '');
    const rows = db
      .prepare("SELECT * FROM notes WHERE title LIKE '%" + term + "%'")
      .all();
    res.json({ q: term, notes: rows });
  });
  ```
- **Root cause:** The user-supplied `q` parameter (`term`) is concatenated
  directly into the SQL string rather than bound as a parameter. An attacker can
  break out of the string literal and alter query logic — e.g. `?q=' OR '1'='1`
  bypasses the filter and returns all rows; `'; DROP TABLE notes; --` could be
  destructive.
- **Proposed fix direction:** Use a parameterized/prepared statement and bind the
  term, keeping the wildcards in SQL:
  ```js
  db.prepare("SELECT * FROM notes WHERE title LIKE '%' || ? || '%'").all(term);
  ```
- **References:** `src/app.js:67-73` (handler), contrast with the correctly
  parameterized queries at `src/app.js:32` (`/notes`), `src/app.js:42`
  (`/notes/:id`), and `src/app.js:58` (`INSERT`).

---

## Secondary observation (out of scope, for Security Verifier)

`bug-context.md:105-107` flags that user passwords are stored in **plaintext**
and compared directly. Confirmed:
- Plaintext seed values: `src/db.js:31-33` (`insertUser.run('admin', 's3cr3t')`,
  `insertUser.run('iryna', 'password123')`).
- Plaintext comparison: `src/app.js:81` (`user.password !== password`).

This is a legitimate finding but explicitly **out of scope** for batch 001; noted
here only as a pointer for the Security Verifier.

---

## Summary

| Defect id | Location        | Severity |
|-----------|-----------------|----------|
| BUG-001   | `src/app.js:29` | Medium   |
| BUG-002   | `src/app.js:54` | Medium   |
| SEC-001   | `src/app.js:70` | Critical |
