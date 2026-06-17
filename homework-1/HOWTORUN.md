# How to Run — Banking Transactions API

## Prerequisites

| Tool    | Version              | Check            |
| ------- | -------------------- | ---------------- |
| Node.js | 18 or newer          | `node --version` |
| npm     | bundled with Node.js | `npm --version`  |
| curl    | any recent           | `curl --version` |

Install Node.js from [nodejs.org](https://nodejs.org/) if needed. npm is included automatically.

---

## Environment setup

```bash
# Navigate to the project folder
cd homework-1

# Install dependencies (express + currency-codes)
npm install
```

---

## Running the application

### macOS / Linux

```bash
npm start
```

For auto-restart on file changes (development):

```bash
npm run dev
```

### Windows

```cmd
npm start
```

or

```powershell
npm start
```

### Using the helper scripts

| OS            | Command               |
| ------------- | --------------------- |
| macOS / Linux | `bash demo/run.sh`    |
| Windows       | `demo\run.bat` in CMD |

The scripts install dependencies and start the server in one step.

### Port override

```bash
# macOS / Linux
PORT=8080 npm start

# Windows Command Prompt
set PORT=8080 && npm start

# Windows PowerShell
$env:PORT=8080; npm start
```

---

## Startup output

```
Banking Transactions API running on http://localhost:3000
Health check: http://localhost:3000/health
```

Five seed transactions are loaded automatically so the API is immediately testable.

**Seed accounts:** `ACC-10001`, `ACC-10002`, `ACC-10003`

---

## Testing requests

### Quick smoke test

**macOS / Linux / Windows PowerShell**

```bash
# Health check
curl http://localhost:3000/health

# List all transactions
curl http://localhost:3000/transactions

# Check a balance
curl http://localhost:3000/accounts/ACC-10001/balance
```

**Windows Command Prompt**

```cmd
curl http://localhost:3000/health
curl http://localhost:3000/transactions
curl http://localhost:3000/accounts/ACC-10001/balance
```

---

### Create a transaction

**macOS / Linux / Windows PowerShell**

```bash
# Deposit
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":1000,"currency":"USD","type":"deposit"}'

# Withdrawal
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-10001","amount":200,"currency":"USD","type":"withdrawal"}'

# Transfer
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-10001","toAccount":"ACC-10002","amount":50,"currency":"USD","type":"transfer"}'
```

**Windows Command Prompt** (double quotes, inner quotes escaped with `\`)

```cmd
curl -X POST http://localhost:3000/transactions ^
  -H "Content-Type: application/json" ^
  -d "{\"toAccount\":\"ACC-10001\",\"amount\":1000,\"currency\":\"USD\",\"type\":\"deposit\"}"
```

**Windows PowerShell** (use `curl.exe` to avoid the `Invoke-WebRequest` alias)

```powershell
curl.exe -X POST http://localhost:3000/transactions `
  -H "Content-Type: application/json" `
  -d '{"toAccount":"ACC-10001","amount":1000,"currency":"USD","type":"deposit"}'
```

---

### Filter transactions

```bash
# By account
curl "http://localhost:3000/transactions?accountId=ACC-10001"

# By type
curl "http://localhost:3000/transactions?type=transfer"

# By date range
curl "http://localhost:3000/transactions?from=2024-01-01&to=2024-01-31"

# Combined
curl "http://localhost:3000/transactions?accountId=ACC-10001&type=transfer"
```

---

### Account endpoints

```bash
# Balance (single or multi-currency)
curl http://localhost:3000/accounts/ACC-10002/balance

# Summary (totals, count, most recent)
curl http://localhost:3000/accounts/ACC-10001/summary
```

---

## Automated test suite

The full test suite runs 54 test cases covering happy paths, validation errors, filters, and edge cases.

Start the server first (in a separate terminal), then run the suite:

### macOS / Linux

```bash
npm start                      # terminal 1
bash demo/sample-requests.sh     # terminal 2
```

### Windows

```bash
npm start                      # terminal 1
bash demo/sample-requests.sh     # terminal 2 (Git Bash)
```

---
