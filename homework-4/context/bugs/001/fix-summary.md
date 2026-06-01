# Fix Summary — Batch 001 (Notes API)

**Overall Status:** All 3 changes applied. Tests passing (2/2).

---

## Changes Made

### Change 1 — BUG-001: Pagination off-by-one

- **File:** `src/app.js`
- **Location:** `GET /notes` handler, line 29

**Before:**
```js
    const offset = page * limit;
```

**After:**
```js
    const offset = (page - 1) * limit;
```

**Result:** Applied successfully. Tests pass.

---

### Change 2 — BUG-002: Incomplete input validation

- **File:** `src/app.js`
- **Location:** `POST /notes` handler, line 54

**Before:**
```js
    if (!title) {
```

**After:**
```js
    if (!title || !body || !owner) {
```

**Result:** Applied successfully. Tests pass.

---

### Change 3 — SEC-001: SQL injection in search

- **File:** `src/app.js`
- **Location:** `GET /search` handler, lines 69–71

**Before:**
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

**Result:** Applied successfully. Tests pass.

---

## Test Run

**Command:** `npm test`

```
PASS tests/smoke.test.js
  Notes API smoke test
    ✓ GET /health returns ok (48 ms)
    ✓ GET /notes returns seeded notes (6 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
```

**Outcome:** All tests passed.

---

## Manual Verification Steps

### BUG-001 — Pagination off-by-one

Start the server: `node src/server.js` (or `npm start` if configured).

```sh
# Page 1 should return the first batch of notes (ids 1–10 if ≥10 exist)
curl "http://localhost:3000/notes?page=1&limit=10"
# Expect: notes array starting from id 1

# Page 2 should return the next batch (ids 11–20)
curl "http://localhost:3000/notes?page=2&limit=10"
# Expect: notes array starting from id 11, no overlap with page 1
```

### BUG-002 — Incomplete input validation

```sh
# Missing body — should return 400, not 500
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}'
# Expect: 400

# Missing owner — should return 400, not 500
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Some body"}'
# Expect: 400

# All fields present — should return 201
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Some body","owner":"alice"}'
# Expect: 201
```

### SEC-001 — SQL injection in search

```sh
# Normal search — should work correctly
curl "http://localhost:3000/search?q=hello"
# Expect: notes whose title contains "hello"

# SQL injection attempt — should return empty results or benign matches, NOT all notes
curl "http://localhost:3000/search?q=%27+OR+%271%27%3D%271"
# Expect: empty notes array (the injection string is treated as a literal search term)

# Destructive payload — should be safely ignored
curl "http://localhost:3000/search?q=%27%3B+DROP+TABLE+notes%3B+--"
# Expect: empty notes array; a subsequent /notes call should still return data
curl "http://localhost:3000/notes"
# Expect: notes still present (table not dropped)
```

---

## References

- BUG-001 — `src/app.js:29` (offset calculation); handler `src/app.js:26–36`
- BUG-002 — `src/app.js:54` (validation guard); handler `src/app.js:52–62`; schema `src/db.js:22–28`
- SEC-001 — `src/app.js:70` (query construction); handler `src/app.js:67–73`
