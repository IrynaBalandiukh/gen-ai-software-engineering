# 🏦 Homework 1: Banking Transactions API

> **Student Name**: Iryna Balandiukh
> **Date Submitted**: 2026-04-29
> **AI Tools Used**: Claude Code (claude-sonnet-4-6)

---

## 📋 Project Overview

The API manages financial transactions (deposits, withdrawals, transfers) across accounts. It supports multi-currency balances, transaction history filtering, and per-account summaries. All state is held in memory — no database is required.

**Seed data:** 5 transactions across accounts `ACC-10001`, `ACC-10002`, `ACC-10003` are loaded at startup so every endpoint is immediately testable.

This project was built as part of an AI-assisted development exercise. The goal was to design and implement a banking transactions API while using AI coding tools throughout the process — from initial scaffolding to validation logic, edge-case handling, and test coverage.

### Features Implemented

#### Tasks 1–3 (Required)

| Feature               | Details                                                              |
| --------------------- | -------------------------------------------------------------------- |
| Create transaction    | `POST /transactions` — deposit, withdrawal, transfer                 |
| List transactions     | `GET /transactions` with filtering                                   |
| Get by ID             | `GET /transactions/:id`                                              |
| Account balance       | `GET /accounts/:id/balance` — single and multi-currency              |
| Input validation      | Amount, currency (ISO 4217), type, account format                    |
| Transaction filtering | By `accountId`, `type`, date range (`from`/`to`), or any combination |
| Error handling        | Global 404 + 500 handlers; all responses are JSON                    |

#### Task 4 (Additional Feature: Option A)

| Feature         | Details                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Account summary | `GET /accounts/:id/summary` — total deposits, total withdrawals, transaction count, most recent transaction date |

---

### Architecture Decisions

#### ESM modules (`"type": "module"`)

The project uses native ES modules (`import`/`export`) rather than CommonJS `require`. This aligns with the direction of the Node.js ecosystem and avoids the `__dirname`/`__filename` workarounds needed in mixed-module setups.

#### `Map` for in-memory storage

Transactions are stored in a `Map` keyed by UUID rather than an array. Lookups by ID are O(1) instead of O(n), and there is no risk of accidentally mutating the wrong entry by index. The seed data is read from `demo/sample-data.json` at startup and inserted into the same `Map`, so seeded and created transactions are handled uniformly.

#### Validator as Express middleware

Validation lives in `src/validators/transactionValidator.js` and is applied as middleware (`validateTransaction`) on the `POST /transactions` route. This keeps the route handler focused on business logic and makes it straightforward to reuse or swap the validator independently.

#### Separate concerns for error handling

`src/utils/errorHandlers.js` provides two Express handlers — `notFound` (catch-all 404) and `errorHandler` (global 500). Registering them last in `src/index.js` means any unmatched route or thrown error is always returned as JSON rather than Express's default HTML error page.

#### Multi-currency balance shape

The balance endpoint returns different shapes depending on whether the account has activity in one or multiple currencies. A single-currency account returns `{ balance, currency }` for simplicity; a multi-currency account returns a `currencies` array. This avoids forcing single-currency consumers to unwrap an array.

#### Floating-point safety

All balance and summary totals are rounded to two decimal places using `Math.round(value * 100) / 100` before being returned. This prevents values like `175.50000000001` from appearing in responses due to IEEE 754 arithmetic.

#### `status` defaults to `completed`

The transaction model includes `status` (pending | completed | failed). The balance endpoint only counts `completed` transactions, which means creating a `pending` transaction does not affect the reported balance — a realistic constraint for a banking API.

---

### Project Structure

```
homework-1/
├── src/
│   ├── index.js                    Express app setup and server entry point
│   ├── routes/
│   │   ├── transactions.js         POST /transactions, GET /transactions, GET /transactions/:id
│   │   └── accounts.js             GET /accounts/:id/balance, GET /accounts/:id/summary
│   ├── validators/
│   │   └── transactionValidator.js Transaction input validation middleware
│   ├── utils/
│   │   └── errorHandlers.js        Global 404 + 500 handlers
│   └── storage/
│       └── store.js                In-memory Map with 5 seed transactions
├── demo/
│   ├── sample-requests.http        All endpoints with examples (VS Code REST Client)
│   ├── sample-requests.sh          Automated test suite (54 test cases)
│   ├── sample-data.json            Seed data reference
│   ├── run.sh                      One-step startup script (macOS/Linux)
│   └── run.bat                     One-step startup script (Windows)
├── docs/screenshots/               AI interaction and API screenshots
├── package.json
├── HOWTORUN.md                     Step-by-step run instructions
└── TASKS.md                        Original homework task specification
```

---

### Running

See [HOWTORUN.md](HOWTORUN.md) for setup, platform-specific instructions, port override, and the test suite.

---

### Endpoints

| Method | Endpoint                       | Description                                | Key parameters                                                     |
| ------ | ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------ |
| `GET`  | `/health`                      | Health check                               | —                                                                  |
| `POST` | `/transactions`                | Create a transaction                       | `fromAccount`, `toAccount`, `amount`, `currency`, `type`, `status` |
| `GET`  | `/transactions`                | List transactions                          | `?accountId`, `?type`, `?from`, `?to`                              |
| `GET`  | `/transactions/:id`            | Get transaction by ID                      | —                                                                  |
| `GET`  | `/accounts/:accountId/balance` | Account balance (single or multi-currency) | —                                                                  |
| `GET`  | `/accounts/:accountId/summary` | Account summary                            | —                                                                  |

**Validation rules for `POST /transactions`:**

- `amount` — positive number, max 2 decimal places
- `currency` — valid ISO 4217 code (e.g. USD, EUR, GBP)
- `type` — `deposit` | `withdrawal` | `transfer`
- `fromAccount` — required for withdrawal and transfer; format `ACC-XXXXX`
- `toAccount` — required for deposit and transfer; format `ACC-XXXXX`
- `status` — optional, defaults to `completed`; `pending` | `completed` | `failed`

**Response format:** all responses use `{ "success": true, "data": ... }` on success and `{ "success": false, "error": "...", "details": [...] }` on error. HTTP status codes: `200` (GET), `201` (created), `400` (validation), `404` (not found), `500` (server error).

<div align="center">

_This project was completed as part of the AI-Assisted Development course._

</div>
