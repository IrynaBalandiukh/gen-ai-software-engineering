# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm start            # Start server on PORT (default 3000)
npm test             # Run full test suite with coverage
npm run test:watch   # Watch mode
```

Run a single test file:
```bash
npx jest tests/test_ticket_api.test.js
```

Run tests matching a name pattern:
```bash
npx jest -t "auto-classify"
```

Coverage threshold is 85% for statements, branches, functions, and lines (configured in `jest.config.js`). `src/server.js` is excluded from coverage.

## Architecture

Layered Express API with in-memory storage — no database.

```
Routes → Services → Repositories
           ↕            ↕
       Validators    Parsers (CSV/JSON/XML)
           ↕
  ClassificationService → ClassificationLogger
```

**Entry points:**
- `src/server.js` — calls `app.listen()`, not imported by tests
- `src/app.js` — exports the configured Express app (used by supertest)

**Request lifecycle:**
1. `src/routes/tickets.js` — 7 endpoints, delegates everything to `ticketService`
2. `src/services/ticketService.js` — orchestrates validation, repo operations, classification
3. `src/repositories/ticketRepository.js` — in-memory `Map`, assigns UUID v4 and ISO-8601 timestamps
4. `src/middleware/errorHandler.js` — final middleware, normalizes all errors to `{error, message, details}`; includes stack unless `NODE_ENV=production`

**Auto-classification** (`src/services/classificationService.js`):
- Pure keyword-matching function, deterministic and side-effect-free
- Returns `{category, priority, confidence, reasoning, keywords_found}`
- Confidence = `min(matchCount / 5, 1.0)`; defaults to `category: other`, `priority: medium`
- Triggered by `?auto_classify=true` on POST, `POST /tickets/:id/auto-classify`, and always during bulk import

**Bulk import** (`POST /tickets/import`):
- Accepts multipart/form-data with a `file` field
- Format detected from `Content-Type` header or file extension
- Parsers in `src/parsers/` return `Promise<object[]>` from a Buffer
- Each row is validated individually; failures are collected, not thrown
- Every successfully parsed ticket is auto-classified before saving
- Returns `{imported, failed, errors[]}`

**Validation** (`src/validators/ticketValidator.js`): Joi schema. Required fields: `customer_id`, `customer_email`, `subject`, `description`. Defaults: `category: other`, `priority: medium`, `status: new`, `tags: []`.

## Tests

Test files live in `tests/`, fixtures in `tests/fixtures/`. Each test file clears the repository in `beforeEach` to ensure isolation.

| File | What it covers |
|---|---|
| `test_ticket_api.test.js` | HTTP endpoints via supertest (23 cases) |
| `test_ticket_model.test.js` | Validator, repository, and service unit tests |
| `test_categorization.test.js` | Classification logic (categories, priorities, confidence) |
| `test_import_csv.test.js` | CSV parser with fixture file |
| `test_import_json.test.js` | JSON parser — root array and envelope formats |
| `test_import_xml.test.js` | XML parser — single-child guard, malformed input |
| `test_integration.test.js` | Full lifecycle: create → update → delete, bulk import flows |
| `test_performance.test.js` | Time-bounded benchmarks (100 sequential creates < 500 ms, etc.) |

Fixture files: `tests/fixtures/sample_tickets_valid.{csv,json,xml}` and `…_invalid.{csv,json,xml}`.

## Key Design Decisions

- **In-memory only** — `ticketRepository` uses a `Map`; data is lost on restart. `repository.clear()` is the test reset mechanism.
- **No external calls** — classification is purely local keyword matching; no AI APIs.
- **Error contract** — all errors must set `err.statusCode` (or `err.status`) before reaching the error handler, or they default to 500.
- **CSV streaming** — `csvParser.js` wraps the buffer in a `Readable` stream to keep memory usage low for large imports.
- **XML single-child guard** — `xml2js` collapses a single `<ticket>` child into an object; the parser normalises it back to an array.
