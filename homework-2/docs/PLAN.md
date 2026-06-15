# Implementation Plan — Intelligent Customer Support Ticket System

> **Project:** Homework 2 — AI-Assisted Development Course
> **Date:** 2026-05-03

---

## Overview

This plan breaks the implementation into five ordered tasks, each building on the previous. Every subtask has an explicit acceptance criterion. Complete each task and verify its acceptance criteria before proceeding to the next.

---

## Dependency Order

The following chain governs implementation order. A module may not be implemented until all modules it depends on are complete and tested.

```
package.json (dependencies installed)
  └─► src/app.js + src/server.js
        └─► src/repositories/ticketRepository.js
              └─► src/validators/ticketValidator.js
                    └─► src/services/classificationService.js
                    │     └─► src/utils/classificationLogger.js
                    └─► src/parsers/{csv,json,xml}Parser.js
                          └─► src/services/ticketService.js
                                └─► src/routes/tickets.js
                                      └─► src/middleware/errorHandler.js
                                            └─► tests/* (all test files)
                                                  └─► docs/* (README, API_REFERENCE, TESTING_GUIDE)
```

Sample data files (`sample_tickets.{csv,json,xml}`) may be created at any time but must exist before integration tests run.

---

## Task 1: Multi-Format Ticket Import API

**Objective:** Stand up a working Express REST API with all six ticket CRUD endpoints and multi-format bulk import.

---

### Subtask 1.1 — Project Bootstrap

**Actions:**

1. Install runtime dependencies:
   ```
   npm install express uuid joi csv-parser xml2js multer
   ```
2. Install dev dependencies:
   ```
   npm install --save-dev jest supertest
   ```
3. Update `package.json` scripts:
   - `"start": "node src/server.js"`
   - `"test": "jest --coverage"`
   - `"test:watch": "jest --watch"`
4. Create `jest.config.js` at project root (see Subtask 3.1 for content).
5. Create `.gitignore` excluding `node_modules/`, `coverage/`, `.env`.

**Acceptance Criteria:**

- `npm install` completes with no errors.
- `package.json` lists all runtime and dev dependencies.
- `npm test` can discover and run files matching `tests/**/*.test.js`.

---

### Subtask 1.2 — In-Memory Ticket Repository

**File:** `src/repositories/ticketRepository.js`

**Actions:**

1. Declare a module-level `Map` named `store`.
2. Implement and export six functions:

| Function              | Behaviour                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `create(ticketData)`  | Assigns `id` (uuid v4), `created_at`, `updated_at`; stores and returns the ticket                 |
| `findById(id)`        | Returns the ticket or `undefined`                                                                 |
| `findAll(filters)`    | Accepts optional `{status, priority, category, customer_id}`; returns a filtered array            |
| `update(id, changes)` | Merges changes into the existing ticket, sets `updated_at`; returns updated ticket or `undefined` |
| `delete(id)`          | Removes from store; returns `true` if found, `false` if not                                       |
| `clear()`             | Empties the store entirely (used by tests in `beforeEach`)                                        |

**Acceptance Criteria:**

- `create` always returns an object with a valid UUID `id` and ISO-8601 `created_at`.
- `findAll({status: 'new'})` returns only tickets where `status === 'new'`.
- After `clear()`, `findAll()` returns an empty array.

---

### Subtask 1.3 — Ticket Validator

**File:** `src/validators/ticketValidator.js`

**Actions:**

1. Import `joi`.
2. Define a `ticketSchema` covering all model fields:

| Field                  | Rules                                         |
| ---------------------- | --------------------------------------------- |
| `customer_id`          | string, required                              |
| `customer_email`       | string, email format, required                |
| `customer_name`        | string, required                              |
| `subject`              | string, min 1, max 200, required              |
| `description`          | string, min 10, max 2000, required            |
| `category`             | enum (6 values), optional, default `'other'`  |
| `priority`             | enum (4 values), optional, default `'medium'` |
| `status`               | enum (5 values), optional, default `'new'`    |
| `assigned_to`          | string or null, optional                      |
| `tags`                 | array of strings, optional, default `[]`      |
| `metadata.source`      | enum (5 values), optional                     |
| `metadata.browser`     | string, optional                              |
| `metadata.device_type` | enum (3 values), optional                     |

3. Export `validate(data)` that calls `ticketSchema.validate(data, {abortEarly: false, allowUnknown: false})`.

**Acceptance Criteria:**

- `validate({})` returns errors listing at minimum `customer_id`, `customer_email`, `customer_name`, `subject`, `description`.
- `validate({customer_email: 'notanemail', ...rest})` returns an error specific to `customer_email`.
- A fully valid object passes with zero errors and all default values applied.

---

### Subtask 1.4 — Express App and Server

**Files:** `src/app.js`, `src/server.js`

**Actions:**

`src/app.js`:

1. Create and export an Express app.
2. Mount `express.json()`.
3. Mount `express.urlencoded({extended: false})`.
4. Mount the ticket router at `/tickets`.
5. Mount the error handler as the final middleware.
6. Do **not** call `listen` — export `app` only.

`src/server.js`:

1. Import `app`.
2. Call `app.listen(process.env.PORT || 3000, ...)` and log the port.

**Acceptance Criteria:**

- `node src/server.js` starts and logs a port number.
- `GET http://localhost:3000/tickets` returns JSON (not a crash or HTML error page).

---

### Subtask 1.5 — Error Handler Middleware

**File:** `src/middleware/errorHandler.js`

**Actions:**

1. Export a four-argument Express middleware `(err, req, res, next)`.
2. Resolve `statusCode` from `err.statusCode || err.status || 500`.
3. Always respond with:
   ```json
   { "error": true, "message": "...", "details": null }
   ```
4. In non-production environments, include `"stack": "..."` in the response body.

**Acceptance Criteria:**

- An error with `statusCode: 400` results in a 400 HTTP response.
- An error with no `statusCode` results in a 500 HTTP response.
- The response body always contains `error`, `message`, and `details` keys.

---

### Subtask 1.6 — File Parsers

**Files:** `src/parsers/csvParser.js`, `src/parsers/jsonParser.js`, `src/parsers/xmlParser.js`

**Actions:**

`csvParser.js`:

- Export `parseCSV(buffer)` returning a Promise.
- Create a `Readable` from the buffer, pipe through `csv-parser()`.
- Resolve with an array of row objects on success.
- Reject with a structured `{message, line}` error on stream error.

`jsonParser.js`:

- Export `parseJSON(buffer)` returning a Promise.
- Accept root array `[...]` or envelope `{"tickets": [...]}`.
- Reject with a descriptive error for any other shape or for malformed JSON.

`xmlParser.js`:

- Export `parseXML(buffer)` returning a Promise.
- Use `xml2js.parseStringPromise` with `{explicitArray: false, mergeAttrs: true}`.
- Extract the ticket list from `result.tickets.ticket`.
- Normalise: always return an array, even when only one child node is present.
- Reject with a structured error on malformed XML.

**Acceptance Criteria:**

- Each parser returns an array of plain objects from a valid corresponding fixture file.
- Each parser rejects with a human-readable message for malformed input.
- `parseJSON` accepts both `[...]` and `{"tickets":[...]}` shapes.
- `parseXML` returns an array of length 1 when the XML contains a single `<ticket>` element.

---

### Subtask 1.7 — Ticket Routes

**File:** `src/routes/tickets.js`

**Actions:**

1. Create an Express `Router`.
2. Configure `multer` with `memoryStorage()` and `limits: {fileSize: 5 * 1024 * 1024}`.
3. Implement the following routes (all async, each calls `next(err)` on error):

| Method   | Path                 | Delegates to                                    | Response code |
| -------- | -------------------- | ----------------------------------------------- | ------------- |
| `POST`   | `/`                  | `ticketService.createTicket(body, options)`     | 201           |
| `POST`   | `/import`            | `ticketService.importTickets(req.file, format)` | 207           |
| `GET`    | `/`                  | `ticketService.listTickets(filters)`            | 200           |
| `GET`    | `/:id`               | `ticketService.getTicket(id)`                   | 200 / 404     |
| `PUT`    | `/:id`               | `ticketService.updateTicket(id, body)`          | 200 / 404     |
| `DELETE` | `/:id`               | `ticketService.deleteTicket(id)`                | 204 / 404     |
| `POST`   | `/:id/auto-classify` | `ticketService.classifyTicket(id)`              | 200 / 404     |

4. Pass `auto_classify: req.query.auto_classify === 'true'` in the options object for `POST /`.
5. Detect import format from `req.file.mimetype`, falling back to filename extension.

**Acceptance Criteria:**

- `POST /tickets` with a valid body returns 201 and a ticket with a UUID `id`.
- `GET /tickets/:id` with an unknown UUID returns 404.
- `DELETE /tickets/:id` with a known UUID returns 204.
- `POST /tickets/import` with a valid CSV file returns 207 with `{total, successful, failed}`.

---

### Subtask 1.8 — Ticket Service

**File:** `src/services/ticketService.js`

**Actions:**

Export the following functions:

| Function                      | Logic                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `createTicket(data, options)` | validate → create in repo → if `options.auto_classify`, call classify → update → return ticket                         |
| `getTicket(id)`               | findById → if not found, throw `{statusCode: 404, message: 'Ticket not found'}`                                        |
| `listTickets(filters)`        | findAll(filters)                                                                                                       |
| `updateTicket(id, changes)`   | getTicket(id) → update in repo → return updated ticket                                                                 |
| `deleteTicket(id)`            | getTicket(id) → delete from repo → return `{deleted: true}`                                                            |
| `importTickets(file, format)` | select parser by format → parse buffer → loop: validate each row, classify valid rows, create in repo → return summary |
| `classifyTicket(id)`          | getTicket(id) → classify → update ticket in repo with classification result → return classification                    |

Import summary shape:

```json
{
  "total": 10,
  "successful": 8,
  "failed": 2,
  "errors": [{"row": 3, "message": "customer_email is required"}],
  "tickets": [...]
}
```

**Acceptance Criteria:**

- `createTicket` with invalid data throws an error with `statusCode: 400`.
- `getTicket('nonexistent-id')` throws an error with `statusCode: 404`.
- `importTickets` with a mix of valid and invalid rows returns both `successful > 0` and `failed > 0` without throwing.

---

### Subtask 1.9 — Sample Data Files

**Demo data deliverables (`demo/`):**

| File                  | Content                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `sample_tickets.csv`  | Header row + 50 data rows covering all 6 categories and 4 priorities |
| `sample_tickets.json` | Array of 20 ticket objects in the full model shape                   |
| `sample_tickets.xml`  | `<tickets>` root with 30 `<ticket>` children                         |

**Test fixtures** (`tests/fixtures/`):

| File                          | Content                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `sample_tickets_valid.csv`    | 5–10 fully valid rows                                                                    |
| `sample_tickets_invalid.csv`  | Rows with missing required fields, bad email, and invalid enum values                    |
| `sample_tickets_valid.json`   | Array of 5 valid ticket objects                                                          |
| `sample_tickets_invalid.json` | Array mixing valid and structurally broken objects                                       |
| `sample_tickets_valid.xml`    | `<tickets>` with 5 valid children                                                        |
| `sample_tickets_invalid.xml`  | Valid XML but tickets missing required fields; plus one intentionally malformed XML file |

**Acceptance Criteria:**

- `parseCSV(fs.readFileSync('sample_tickets.csv'))` resolves with exactly 50 rows.
- `parseJSON(fs.readFileSync('sample_tickets.json'))` resolves with exactly 20 objects.
- `parseXML(fs.readFileSync('sample_tickets.xml'))` resolves with exactly 30 objects.
- Each invalid fixture contains at least 2 records designed to trigger specific validation errors.

---

## Task 2: Auto-Classification Engine

**Objective:** Implement the deterministic keyword classification engine and its audit logger.

---

### Subtask 2.1 — Classification Service

**File:** `src/services/classificationService.js`

**Actions:**

1. Define static keyword maps:

```javascript
const CATEGORY_KEYWORDS = {
  account_access: [
    "login",
    "password",
    "2fa",
    "sign in",
    "sign out",
    "locked",
    "account",
    "authentication",
    "access denied",
  ],
  technical_issue: [
    "error",
    "crash",
    "bug",
    "not working",
    "broken",
    "exception",
    "timeout",
    "slow",
    "performance",
    "fail",
  ],
  billing_question: [
    "payment",
    "invoice",
    "charge",
    "refund",
    "subscription",
    "billing",
    "price",
    "cost",
    "receipt",
  ],
  feature_request: [
    "would like",
    "request",
    "suggest",
    "enhance",
    "add",
    "new feature",
    "improvement",
    "wish",
  ],
  bug_report: [
    "reproduce",
    "steps to reproduce",
    "expected",
    "actual",
    "regression",
    "defect",
    "version",
  ],
};

const PRIORITY_KEYWORDS = {
  urgent: ["can't access", "critical", "production down", "security"],
  high: ["important", "blocking", "asap"],
  low: ["minor", "cosmetic", "suggestion"],
};
```

2. Export `classify(subject, description)`:
   - Concatenate and lowercase: `text = (subject + ' ' + description).toLowerCase()`.
   - For each category: count and collect matching keywords.
   - Select the category with the highest match count; default to `'other'` if all counts are zero.
   - Compute `confidence = Math.min(totalCategoryMatches / 5, 1.0)`.
   - Evaluate priority in order: urgent → high → low → medium (medium is the default).
   - Build a human-readable `reasoning` string.
   - Call `classificationLogger.log(ticketId, result)` — note: `ticketId` is passed in from the service, so accept it as an optional third argument or log from the caller.
   - Return `{category, priority, confidence, reasoning, keywords_found}`.

**Acceptance Criteria:**

- `classify("can't access my account", "login is broken")` → `{category: 'account_access', priority: 'urgent'}`.
- `classify("suggest a minor improvement", "cosmetic change")` → `{priority: 'low'}`.
- `classify("hello", "hello world")` → `{category: 'other', priority: 'medium', confidence: 0}`.
- `confidence` is always in `[0, 1]`.
- `keywords_found` is always an array (may be empty).

---

### Subtask 2.2 — Classification Logger

**File:** `src/utils/classificationLogger.js`

**Actions:**

1. Export `log(ticketId, classificationResult)`.
2. Emit to `console.log` a single-line JSON string:
   ```json
   {
     "timestamp": "2026-05-03T12:00:00.000Z",
     "event": "ticket_classified",
     "ticket_id": "...",
     "category": "...",
     "priority": "...",
     "confidence": 0.6,
     "keywords_found": ["login", "password"]
   }
   ```

**Acceptance Criteria:**

- `log('abc-123', result)` emits a line that `JSON.parse` accepts without error.
- The emitted object always contains: `timestamp`, `event`, `ticket_id`, `category`, `priority`, `confidence`, `keywords_found`.

---

### Subtask 2.3 — Auto-Classify Route Verification

The `POST /:id/auto-classify` route was defined in Subtask 1.7. Verify end-to-end behaviour:

**Acceptance Criteria:**

- `POST /tickets/:id/auto-classify` with an existing ticket ID → 200 `{category, priority, confidence, reasoning, keywords_found}`.
- `POST /tickets/:id/auto-classify` with a non-existent ID → 404.
- `POST /tickets?auto_classify=true` creates a ticket and populates `category` and `priority` from the classifier result.

---

## Task 3: Test Suite

**Objective:** Achieve >85% statement, branch, function, and line coverage across all `src/**/*.js` files.

---

### Subtask 3.1 — Jest Configuration

**File:** `jest.config.js`

```javascript
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: ["src/**/*.js"],
  coverageThreshold: {
    global: { statements: 85, branches: 85, functions: 85, lines: 85 },
  },
  coverageReporters: ["text", "lcov", "html"],
};
```

**Acceptance Criteria:**

- `npm test` runs all files matching `tests/**/*.test.js`.
- `npm test -- --coverage` generates a terminal coverage table and `coverage/lcov-report/`.
- The test run fails if any metric drops below 85%.

---

### Subtask 3.2 — API Endpoint Tests

**File:** `tests/test_ticket_api.test.js`

**Pattern:** `import app from '../src/app.js'` + `supertest(app)`. Call `ticketRepository.clear()` in `beforeEach`.

**11 tests:**

| #   | Description                                          | Expected                               |
| --- | ---------------------------------------------------- | -------------------------------------- |
| 1   | `POST /tickets` with valid body                      | 201, ticket has UUID `id`              |
| 2   | `POST /tickets` missing required fields              | 400                                    |
| 3   | `POST /tickets` invalid email                        | 400, message mentions `customer_email` |
| 4   | `POST /tickets?auto_classify=true`                   | 201, ticket has non-null `category`    |
| 5   | `GET /tickets` empty store                           | 200, body is `[]`                      |
| 6   | `GET /tickets?status=new` after creating two tickets | 200, all items have `status: 'new'`    |
| 7   | `GET /tickets/:id` for existing ticket               | 200                                    |
| 8   | `GET /tickets/:id` for unknown UUID                  | 404                                    |
| 9   | `PUT /tickets/:id` with valid update body            | 200, `updated_at` has changed          |
| 10  | `DELETE /tickets/:id` for existing ticket            | 204                                    |
| 11  | `DELETE /tickets/:id` for unknown UUID               | 404                                    |

**Acceptance Criteria:** All 11 tests pass with no test-framework warnings.

---

### Subtask 3.3 — Ticket Model Validation Tests

**File:** `tests/test_ticket_model.test.js`

**9 tests:**

| #   | Input                                    | Expected                     |
| --- | ---------------------------------------- | ---------------------------- |
| 1   | Minimal valid ticket (5 required fields) | Passes, defaults applied     |
| 2   | Full valid ticket (all fields)           | Passes                       |
| 3   | Missing `customer_email`                 | Error names `customer_email` |
| 4   | `customer_email: 'notanemail'`           | Error names `customer_email` |
| 5   | `subject: ''` (length 0)                 | Error names `subject`        |
| 6   | `subject` of 201 chars                   | Error names `subject`        |
| 7   | `description` of 9 chars                 | Error names `description`    |
| 8   | `category: 'invalid_value'`              | Error names `category`       |
| 9   | `priority: 'invalid_value'`              | Error names `priority`       |

**Acceptance Criteria:** Each test asserts on the specific field name in the error detail.

---

### Subtask 3.4 — CSV Import Tests

**File:** `tests/test_import_csv.test.js`

**6 tests:**

| #   | Input                                    | Expected                                                 |
| --- | ---------------------------------------- | -------------------------------------------------------- |
| 1   | `sample_tickets_valid.csv`               | Resolves, correct row count                              |
| 2   | Same file                                | Every row object has `subject` and `customer_email` keys |
| 3   | Same file                                | No row is `null` or `undefined`                          |
| 4   | `sample_tickets_invalid.csv` (malformed) | Rejects with a string error message                      |
| 5   | Buffer containing only the header row    | Resolves with empty array                                |
| 6   | CSV with extra unknown columns           | Rows parsed without error                                |

**Acceptance Criteria:** All 6 tests use only files from `tests/fixtures/`.

---

### Subtask 3.5 — JSON Import Tests

**File:** `tests/test_import_json.test.js`

**5 tests:**

| #   | Input                                    | Expected                       |
| --- | ---------------------------------------- | ------------------------------ |
| 1   | `sample_tickets_valid.json` (root array) | Resolves, correct count        |
| 2   | `{"tickets": [...]}` envelope string     | Resolves, correct count        |
| 3   | `'{"broken": json'`                      | Rejects with error             |
| 4   | `'{"notTickets": []}'`                   | Rejects with descriptive error |
| 5   | `'[]'` (empty array)                     | Resolves with `[]`             |

**Acceptance Criteria:** All 5 pass.

---

### Subtask 3.6 — XML Import Tests

**File:** `tests/test_import_xml.test.js`

**5 tests:**

| #   | Input                                                       | Expected                                       |
| --- | ----------------------------------------------------------- | ---------------------------------------------- |
| 1   | `sample_tickets_valid.xml`                                  | Resolves, correct ticket count                 |
| 2   | Same file                                                   | Each object has a `subject` property           |
| 3   | `<tickets><ticket><subject>Hi</subject></ticket></tickets>` | Returns array of length 1 (single-child guard) |
| 4   | `<tickets><ticket>Unclosed`                                 | Rejects with error                             |
| 5   | `<root><items/></root>` (no `<tickets>` element)            | Rejects with descriptive error                 |

**Acceptance Criteria:** Test 3 explicitly guards against the xml2js single-child array-collapsing behaviour.

---

### Subtask 3.7 — Categorization Tests

**File:** `tests/test_categorization.test.js`

**10 tests:**

| #   | Input (subject, description)         | Expected                                                   |
| --- | ------------------------------------ | ---------------------------------------------------------- |
| 1   | `"login failed"`, `""`               | `category: 'account_access'`                               |
| 2   | `"can't access"`, `""`               | `priority: 'urgent'`                                       |
| 3   | `"payment refund"`, `""`             | `category: 'billing_question'`                             |
| 4   | `"app crashes on startup"`, `""`     | `category: 'technical_issue'`                              |
| 5   | `"suggest new feature"`, `""`        | `category: 'feature_request'`                              |
| 6   | `"steps to reproduce the bug"`, `""` | `category: 'bug_report'`                                   |
| 7   | `"hello"`, `"hello world"`           | `category: 'other'`, `priority: 'medium'`, `confidence: 0` |
| 8   | `"blocking production down"`, `""`   | `priority: 'urgent'` (urgent beats high)                   |
| 9   | Any input                            | `confidence` in `[0, 1]`                                   |
| 10  | Any matching input                   | `keywords_found` is an array containing matched strings    |

**Acceptance Criteria:** Tests invoke `classify()` directly, no HTTP layer involved.

---

### Subtask 3.8 — Integration Tests

**File:** `tests/test_integration.test.js`

**5 tests:**

| #   | Scenario                     | Verification                                                                              |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Full ticket lifecycle        | create → GET confirms existence → PUT changes subject → DELETE → GET returns 404          |
| 2   | Bulk CSV import              | Upload fixture → summary `successful > 0` → `GET /tickets` count increased                |
| 3   | Mixed import                 | Upload fixture with some invalid rows → both `successful > 0` and `failed > 0` in summary |
| 4   | Auto-classify on create      | `POST ?auto_classify=true` → `GET /:id` → `category` and `priority` are non-null          |
| 5   | Category filter after import | Import 5 tickets of two categories → `GET /tickets?category=X` returns only category X    |

**Acceptance Criteria:** All 5 tests pass end-to-end via supertest. No test depends on external network or filesystem state outside `tests/fixtures/`.

---

### Subtask 3.9 — Performance Tests

**File:** `tests/test_performance.test.js`

Note: all tests set `jest.setTimeout(10000)`.

**5 tests:**

| #   | Scenario                                        | Threshold                          |
| --- | ----------------------------------------------- | ---------------------------------- |
| 1   | Create 100 tickets sequentially                 | Total time < 500 ms                |
| 2   | `GET /tickets` with 500 tickets in store        | Response time < 100 ms             |
| 3   | 20 concurrent `POST /tickets` via `Promise.all` | All return 201; no request fails   |
| 4   | Classify 1 000 texts in a loop                  | Completes in < 200 ms              |
| 5   | Bulk import of 50-row CSV                       | Completes end-to-end in < 1 000 ms |

**Acceptance Criteria:** All 5 tests pass. Timings are logged with `console.log` for human review.

---

## Task 4: Multi-Level Documentation

**Objective:** Produce four documentation files targeting distinct audiences.

---

### Subtask 4.1 — README.md

**File:** `README.md` (project root)

**Required sections:**

1. Title + one-line description
2. Badge placeholders (coverage, Node.js version)
3. Features bullet list (7+ items)
4. Architecture diagram (embed Mermaid component graph from `docs/architecture.md`)
5. Prerequisites (`Node.js >= 18`)
6. Installation (`npm install`)
7. Running the server (`npm start`)
8. Running tests (`npm test`, with coverage `npm test -- --coverage`)
9. Abbreviated project structure tree
10. Environment variables table (`PORT`, default 3000)

**Acceptance Criteria:** All commands in the README work when executed. Mermaid diagram renders without syntax errors on GitHub.

---

### Subtask 4.2 — API_REFERENCE.md

**File:** `API_REFERENCE.md` (project root)

**Required sections:**

1. Base URL and versioning note
2. Authentication note (none)
3. Data models section — full ticket JSON schema with field descriptions and constraints table
4. One section per endpoint covering: method + path, description, request parameters/body table, response body, HTTP status codes table, cURL example
5. Error response format section with example
6. Enum values reference table (all enums in one place)

**Endpoints to document:** POST /tickets, POST /tickets/import, GET /tickets, GET /tickets/:id, PUT /tickets/:id, DELETE /tickets/:id, POST /tickets/:id/auto-classify.

**Acceptance Criteria:** Every route in `src/routes/tickets.js` has a documented section. Every cURL example is syntactically valid shell.

---

### Subtask 4.3 — ARCHITECTURE.md (root copy)

**File:** `ARCHITECTURE.md` (project root)

Copy the content of `docs/architecture.md` verbatim to the project root for GitHub discoverability.

**Acceptance Criteria:** Content is identical to `docs/architecture.md`.

---

### Subtask 4.4 — TESTING_GUIDE.md

**File:** `TESTING_GUIDE.md` (project root)

**Required sections:**

1. Test pyramid diagram (Mermaid)
2. How to run: all tests, single file, watch mode, coverage report
3. Test file descriptions table (file → what it covers → test count)
4. Sample test data locations and descriptions table
5. Manual testing checklist (15 items covering all endpoint and import scenarios)
6. Performance benchmarks table (operation → expected time → test file that verifies it)
7. Troubleshooting (5 common issues with solutions)

**Acceptance Criteria:** A QA engineer with no prior project knowledge can follow the guide to run the full suite and interpret the results.

---

## Task 5: Integration and Performance Verification

**Objective:** Confirm the test suite runs cleanly and meets the coverage gate.

---

### Subtask 5.1 — Verify Integration Tests

**Acceptance Criteria:**

- `npx jest tests/test_integration.test.js` exits with code 0.
- All 5 tests pass.
- No test touches the network or filesystem outside `tests/fixtures/`.

---

### Subtask 5.2 — Verify Performance Tests

**Acceptance Criteria:**

- `npx jest tests/test_performance.test.js` exits with code 0.
- All 5 tests pass.
- Timing assertions use generous thresholds that survive CI (see Subtask 3.9).

---

### Subtask 5.3 — Coverage Gate

**Actions:**

1. Run `npm test -- --coverage`.
2. Inspect the coverage summary table.
3. If any module is below 85%, add targeted tests to the appropriate test file.
4. Screenshot the terminal coverage table and save to `docs/screenshots/test_coverage.png`.

**Acceptance Criteria:**

- Overall statement, branch, function, and line coverage all >= 85%.
- `coverage/lcov-report/index.html` exists and is readable.
- `docs/screenshots/test_coverage.png` is a real screenshot (not a placeholder).

---

## Complete File Manifest

Every file that must exist at project completion:

### Root Level (10 files)

| File                  | Purpose                                                 |
| --------------------- | ------------------------------------------------------- |
| `package.json`        | Project metadata, scripts, and dependency declarations  |
| `jest.config.js`      | Jest runner configuration and 85% coverage thresholds   |
| `.gitignore`          | Excludes `node_modules/`, `coverage/`, `.env`           |
| `README.md`           | Developer-facing project overview and quick-start guide |
| `API_REFERENCE.md`    | API consumer reference with per-endpoint documentation  |
| `ARCHITECTURE.md`     | Root-level copy of `docs/architecture.md`               |
| `TESTING_GUIDE.md`    | QA engineer guide to running and interpreting tests     |
| `sample_tickets.csv`  | 50-row CSV sample data deliverable                      |
| `sample_tickets.json` | 20-object JSON sample data deliverable                  |
| `sample_tickets.xml`  | 30-node XML sample data deliverable                     |

### src/ (12 files)

| File                                    | Purpose                                                   |
| --------------------------------------- | --------------------------------------------------------- |
| `src/app.js`                            | Express application factory; mounts middleware and router |
| `src/server.js`                         | Process entry point; calls `app.listen()`                 |
| `src/routes/tickets.js`                 | All `/tickets` route handler definitions (7 routes)       |
| `src/services/ticketService.js`         | Business logic: CRUD orchestration and import pipeline    |
| `src/services/classificationService.js` | Keyword-matching classification and priority engine       |
| `src/repositories/ticketRepository.js`  | In-memory `Map`-backed ticket store                       |
| `src/parsers/csvParser.js`              | Parses CSV `Buffer` to row array                          |
| `src/parsers/jsonParser.js`             | Parses JSON `Buffer` to ticket array                      |
| `src/parsers/xmlParser.js`              | Parses XML `Buffer` to ticket array                       |
| `src/validators/ticketValidator.js`     | Joi schema and `validate()` export                        |
| `src/middleware/errorHandler.js`        | Central Express error middleware                          |
| `src/utils/classificationLogger.js`     | Structured JSON logger for classification audit trail     |

### tests/ (14 files)

| File                                         | Purpose                                  |
| -------------------------------------------- | ---------------------------------------- |
| `tests/test_ticket_api.test.js`              | 11 HTTP endpoint tests via supertest     |
| `tests/test_ticket_model.test.js`            | 9 Joi validation unit tests              |
| `tests/test_import_csv.test.js`              | 6 CSV parser tests                       |
| `tests/test_import_json.test.js`             | 5 JSON parser tests                      |
| `tests/test_import_xml.test.js`              | 5 XML parser tests                       |
| `tests/test_categorization.test.js`          | 10 classification engine unit tests      |
| `tests/test_integration.test.js`             | 5 end-to-end workflow tests              |
| `tests/test_performance.test.js`             | 5 timing and concurrency benchmark tests |
| `tests/fixtures/sample_tickets_valid.csv`    | Small valid CSV fixture                  |
| `tests/fixtures/sample_tickets_invalid.csv`  | CSV with deliberate validation errors    |
| `tests/fixtures/sample_tickets_valid.json`   | Small valid JSON fixture                 |
| `tests/fixtures/sample_tickets_invalid.json` | JSON with deliberate errors              |
| `tests/fixtures/sample_tickets_valid.xml`    | Small valid XML fixture                  |
| `tests/fixtures/sample_tickets_invalid.xml`  | XML with deliberate errors               |

### docs/ (3 files)

| File                                 | Purpose                              |
| ------------------------------------ | ------------------------------------ |
| `docs/architecture.md`               | Full technical architecture document |
| `docs/PLAN.md`                       | This implementation plan             |
| `docs/screenshots/test_coverage.png` | Screenshot of Jest coverage report   |

**Total: 39 files**

---

## Verification Checklist

Run through this list in order before submission:

- [ ] `npm install` completes without errors
- [ ] `npm start` launches the server on port 3000 and logs the port
- [ ] `curl -X POST http://localhost:3000/tickets` with a valid JSON body returns 201
- [ ] `curl http://localhost:3000/tickets` returns a JSON array
- [ ] `POST /tickets/import` with `sample_tickets.csv` returns 207 with `successful: 50`
- [ ] `POST /tickets/:id/auto-classify` returns `{category, priority, confidence, reasoning, keywords_found}`
- [ ] `npm test` runs 56 tests across 8 test files and all pass
- [ ] `npm test -- --coverage` shows >= 85% on all four metrics
- [ ] `docs/screenshots/test_coverage.png` is a real screenshot of the coverage output
- [ ] All three sample data files exist at root level with correct row counts (50, 20, 30)
- [ ] `README.md`, `API_REFERENCE.md`, `ARCHITECTURE.md`, `TESTING_GUIDE.md` all exist and contain valid Markdown
- [ ] No hardcoded absolute paths in any source file
- [ ] `.gitignore` excludes `node_modules/` and `coverage/`
