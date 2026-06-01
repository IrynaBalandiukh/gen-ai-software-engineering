# Security Report — Batch 001 (Notes API)

**Agent:** security-verifier (Task 3) · **Mode:** Review-only (no code edits)
**Date:** 2026-06-01
**Scope:** Changes described in `context/bugs/001/fix-summary.md` and the source
files they touch (`src/app.js`), with adjacent context from `src/db.js`,
`src/server.js`, and `package.json`.

---

## Summary

**Overall posture:** Acceptable for the in-scope change set, with one important
caveat — the reported **SQL injection (SEC-001) is fully remediated**, and the
two functional fixes (BUG-001, BUG-002) introduce **no new security
vulnerabilities**. The `/search` query is now properly parameterized.

However, the surrounding code contains **pre-existing security issues that are
out of scope for this batch but real and must not be silently dropped** — most
notably **plaintext password storage** and an **insecure (non-constant-time)
plaintext password comparison** in the login path. These were not introduced by
the fixes but are reported here per the agent's mandate.

**SEC-001 status: ✅ REMEDIATED.**

---

## Confirmed-Fixed

### SEC-001 — SQL injection in `/search` — ✅ FIXED
- **File:** `src/app.js:69–71`
- **Before:** the search term was concatenated directly into the SQL string
  (`"... title LIKE '%" + term + "%'"`), allowing a crafted `q` value to break
  out of the literal and alter the query.
- **After:**
  ```js
  const rows = db
    .prepare("SELECT * FROM notes WHERE title LIKE '%' || ? || '%'")
    .all(term);
  ```
  The user input is now passed as a **bound parameter** (`?`), and the wildcards
  are composed via SQL string concatenation (`||`) *around* the bound value, not
  around the raw input. The term can no longer alter query structure. Injection
  payloads such as `' OR '1'='1` and `'; DROP TABLE notes; --` are treated as
  literal search text. **Verified remediated.**
- **Note:** `term` is also coerced with `String(req.query.q || '')`
  (`src/app.js:68`), which defends against array/object query-param type
  confusion (e.g. `?q[]=a&q[]=b`). Good practice.

### Other parameterized queries reviewed — all safe
- `src/app.js:32` (`/notes` list) — `LIMIT ? OFFSET ?`, parameterized. ✅
- `src/app.js:42` (`/notes/:id`) — `WHERE id = ?`, parameterized. ✅
- `src/app.js:58` (`/notes` insert) — `VALUES (?, ?, ?)`, parameterized. ✅
- `src/app.js:80` (`/login`) — `WHERE username = ?`, parameterized. ✅

No SQL injection vectors remain in the reviewed code.

---

## Findings

> Findings below are ordered by severity. CRITICAL/HIGH items in `src/db.js` and
> the `/login` handler are **pre-existing and out of scope for batch 001** (the
> fixes did not touch them), but are reported because they are genuine.

### F-1 — HIGH — Plaintext password storage
- **File:** `src/db.js:19, 31–33` (schema `password TEXT`; seeded plaintext
  values `'s3cr3t'`, `'password123'`)
- **Description:** User passwords are stored as plaintext. A read of the `users`
  table (via SQLi elsewhere, a backup, or DB access) discloses every credential
  directly. This also forces the insecure comparison in F-2.
- **Remediation:** Store a salted, slow password hash (e.g. `bcrypt`, `scrypt`,
  or `argon2`). Hash on user creation; never persist or log plaintext.

### F-2 — HIGH — Insecure password comparison in `/login`
- **File:** `src/app.js:81` — `if (!user || user.password !== password)`
- **Description:** Authentication compares the supplied password to a stored
  plaintext value using JavaScript `!==`. Two problems: (1) it relies on
  plaintext storage (F-1); (2) `!==` is **not constant-time**, leaking timing
  information that can assist password recovery. There is no account lockout or
  rate limiting, so the endpoint is also brute-forceable.
- **Remediation:** Compare against a stored hash using the hashing library's
  verify function (e.g. `bcrypt.compare`), which is designed to be
  constant-time. Add rate limiting / lockout on repeated failures.

### F-3 — MEDIUM — Hardcoded credentials in source
- **File:** `src/db.js:32–33` — `insertUser.run('admin', 's3cr3t')`,
  `insertUser.run('iryna', 'password123')`
- **Description:** Admin/user credentials are hardcoded and committed to the
  repository. Even as seed/demo data, these are weak, well-known once the repo is
  shared, and risk being carried into a real deployment.
- **Remediation:** Move seed credentials out of source (env vars / a seeding
  script run only in dev), use strong generated passwords, and store them
  hashed (see F-1). Never commit real credentials.

### F-4 — LOW — Unbounded / unvalidated pagination parameters
- **File:** `src/app.js:27–29` (`/notes`)
- **Description:** `page` and `limit` come from `parseInt(...) || default`.
  A negative `page` (e.g. `?page=-5`) yields a negative `OFFSET`, and a very
  large `limit` (e.g. `?limit=1000000`) is passed straight to SQL, enabling a
  cheap resource-exhaustion request. Not an injection (values are
  parameterized), but missing bounds checking.
- **Remediation:** Clamp `page >= 1` and `1 <= limit <= MAX` (e.g. 100); reject
  or coerce out-of-range values.

### F-5 — LOW — No brute-force / rate-limiting protection on `/login`
- **File:** `src/app.js:78–85`
- **Description:** The login endpoint has no rate limiting, throttling, or
  lockout, allowing unlimited credential-guessing attempts. Compounds F-1/F-2.
- **Remediation:** Add rate limiting (e.g. `express-rate-limit`) and/or
  progressive backoff / temporary lockout per account or IP.

### F-6 — INFO — No security middleware / hardening headers
- **File:** `src/app.js:14–15`, `src/server.js`
- **Description:** The app uses only `express.json()`. There are no security
  headers (e.g. via `helmet`), no body-size limit on the JSON parser (default
  ~100kb, but not explicitly set), and no centralized error handler, so an
  unexpected DB/runtime error could surface a stack trace to clients.
- **Remediation:** Add `helmet`, set an explicit `express.json({ limit })`, and
  add an error-handling middleware that returns a generic 500 without internal
  details. CSRF is low-priority here (token-less JSON API, no cookie auth) but
  reassess if cookie-based sessions are introduced.

### F-7 — INFO — `/search` LIKE wildcards in user input are not escaped
- **File:** `src/app.js:70`
- **Description:** Not a vulnerability — the value is safely bound. But `%` and
  `_` in `q` are interpreted as LIKE wildcards, so a user-supplied `%` matches
  everything. This is a functional/behavioral note, not a security issue.
- **Remediation (optional):** If literal matching is desired, escape `%`, `_`,
  and the escape char and add `ESCAPE '\'` to the query.

---

## Dependencies

- `express ^4.19.2` and `better-sqlite3 ^11.3.0` are reasonably current major
  lines with no known critical advisories at the versions pinned here.
- **Recommendation:** Run `npm audit` (and enable Dependabot or equivalent) as
  part of CI to catch advisories over time. No unsafe or abandoned direct
  dependencies were observed. (Not run live in this review environment.)

---

## Conclusion

- The batch-001 fixes are **security-safe**: SEC-001 is genuinely closed, and
  BUG-001 / BUG-002 add no new vulnerabilities.
- The highest-risk issues found (F-1, F-2) are **pre-existing** in the
  authentication/storage layer and outside this batch's scope, but should be
  scheduled as follow-up security work before any non-demo use.

**Gate recommendation for batch 001: PASS** (no blocking issues introduced by
the changes). Track F-1–F-3 as separate security tickets.

---

## References

- Changed code: `src/app.js:26–36` (BUG-001), `src/app.js:52–62` (BUG-002),
  `src/app.js:67–73` (SEC-001).
- Adjacent context: `src/db.js:12–57`, `src/app.js:78–85`, `package.json`.
- Input: `context/bugs/001/fix-summary.md`.
- OWASP: A03:2021 Injection; A07:2021 Identification & Authentication Failures;
  A02:2021 Cryptographic Failures (plaintext passwords).
- CWE-89 (SQLi), CWE-256/CWE-257 (plaintext password storage), CWE-208
  (timing-based info exposure), CWE-307 (improper restriction of auth attempts).
