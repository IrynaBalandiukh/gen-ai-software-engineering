# How to Run — Intelligent Customer Support Ticket System

## Prerequisites

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **npm** v8 or later (bundled with Node.js)

Verify your versions:

```bash
node --version
npm --version
```

---

## Install Dependencies

Run once after cloning the repository (all OS):

```bash
npm install
```

---

## Run the Application

### Default (port 3000)

**macOS / Linux:**

```bash
npm start
```

**Windows (PowerShell):**

```powershell
npm start
```

**Windows (Command Prompt):**

```cmd
npm start
```

The server starts at `http://localhost:3000`.

### Custom Port

**macOS / Linux:**

```bash
PORT=8080 npm start
```

**Windows (PowerShell):**

```powershell
$env:PORT=8080; npm start
```

**Windows (Command Prompt):**

```cmd
set PORT=8080 && npm start
```

### Verify the Server is Running

```bash
curl http://localhost:3000/tickets
```

Expected response: `[]` (empty array when no tickets exist).

---

## Quick Demo Scripts

The `demo/` directory contains scripts that install dependencies, start the server, and run a set of sample API calls automatically.

**macOS / Linux:**

```bash
chmod +x demo/run.sh
./demo/run.sh
```

**Windows (Command Prompt):**

```cmd
demo\run.bat
```

Each script:
1. Runs `npm install`
2. Starts the server in the background on port 3000
3. Lists tickets (empty), creates one ticket with auto-classification, bulk-imports `demo/sample_tickets.csv`, then lists all tickets
4. Stops the server on exit

---

## API Endpoints

| Method   | Path                         | Description                                                                                 |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| `POST`   | `/tickets`                   | Create a ticket                                                                             |
| `GET`    | `/tickets`                   | List all tickets (supports `?status=`, `?priority=`, `?category=`, `?customer_id=` filters) |
| `GET`    | `/tickets/:id`               | Get a ticket by ID                                                                          |
| `PUT`    | `/tickets/:id`               | Update a ticket                                                                             |
| `DELETE` | `/tickets/:id`               | Delete a ticket                                                                             |
| `POST`   | `/tickets/import`            | Bulk import tickets from a CSV, JSON, or XML file                                           |
| `POST`   | `/tickets/:id/auto-classify` | Auto-classify an existing ticket                                                            |

### Create a ticket (example)

**macOS / Linux:**

```bash
curl -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "C001",
    "customer_email": "user@example.com",
    "customer_name": "Jane Smith",
    "subject": "Cannot login to my account",
    "description": "I have been unable to login for the past two days. Password reset did not help."
  }'
```

**Windows (PowerShell):**

```powershell
curl -X POST http://localhost:3000/tickets `
  -H "Content-Type: application/json" `
  -d '{
    "customer_id": "C001",
    "customer_email": "user@example.com",
    "customer_name": "Jane Smith",
    "subject": "Cannot login to my account",
    "description": "I have been unable to login for the past two days. Password reset did not help."
  }'
```

**Windows (Command Prompt):**

```cmd
curl -X POST http://localhost:3000/tickets ^
  -H "Content-Type: application/json" ^
  -d "{\"customer_id\":\"C001\",\"customer_email\":\"user@example.com\",\"customer_name\":\"Jane Smith\",\"subject\":\"Cannot login to my account\",\"description\":\"I have been unable to login for the past two days. Password reset did not help.\"}"
```

Add `?auto_classify=true` to classify the ticket automatically on creation:

**macOS / Linux:**

```bash
curl -X POST "http://localhost:3000/tickets?auto_classify=true" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**Windows (PowerShell):**

```powershell
curl -X POST "http://localhost:3000/tickets?auto_classify=true" `
  -H "Content-Type: application/json" `
  -d '{ ... }'
```

**Windows (Command Prompt):**

```cmd
curl -X POST "http://localhost:3000/tickets?auto_classify=true" ^
  -H "Content-Type: application/json" ^
  -d "{ ... }"
```

### Bulk import (example)

**macOS / Linux:**

```bash
curl -X POST http://localhost:3000/tickets/import \
  -F "file=@demo/sample_tickets.csv"
```

**Windows (PowerShell):**

```powershell
curl -X POST http://localhost:3000/tickets/import `
  -F "file=@demo/sample_tickets.csv"
```

**Windows (Command Prompt):**

```cmd
curl -X POST http://localhost:3000/tickets/import ^
  -F "file=@demo/sample_tickets.csv"
```

Supported formats: `.csv`, `.json`, `.xml` (max 5 MB).

---

## Run Tests

### Full test suite

```bash
npm test
```

This runs all files matching `tests/**/*.test.js` and prints a coverage summary to the terminal. The run **fails** if coverage drops below 85% on any metric (statements, branches, functions, lines).

### Watch mode (re-runs on file save)

```bash
npm run test:watch
```

### Single test file

```bash
npx jest tests/test_ticket_api.test.js
```

### Tests matching a name pattern

```bash
npx jest --testNamePattern "should create a ticket"
```

---

## Check Coverage

Coverage is collected automatically when you run `npm test`. After the run, three report formats are written to `coverage/`:

| Format         | Location                          | How to view                                                     |
| -------------- | --------------------------------- | --------------------------------------------------------------- |
| Terminal table | printed to stdout                 | read in the terminal                                            |
| LCOV           | `coverage/lcov.info`              | import into editor plugins (e.g., Coverage Gutters for VS Code) |
| HTML           | `coverage/lcov-report/index.html` | open in a browser                                               |

### Open the HTML report

**macOS:**

```bash
open coverage/lcov-report/index.html
```

**Linux:**

```bash
xdg-open coverage/lcov-report/index.html
```

**Windows (PowerShell):**

```powershell
Start-Process coverage\lcov-report\index.html
```

**Windows (Command Prompt):**

```cmd
start coverage\lcov-report\index.html
```

The HTML report shows per-file and per-line coverage so you can see exactly which branches are untested.

### Coverage thresholds

Defined in `jest.config.js`:

```
statements : 85%
branches   : 85%
functions  : 85%
lines      : 85%
```

`npm test` exits with a non-zero code if any threshold is not met.

---

## Project Structure (quick reference)

```
src/
  app.js                    Express app (no listener — used by tests)
  server.js                 Starts the HTTP listener
  routes/tickets.js         Route definitions
  services/
    ticketService.js        Orchestration logic
    classificationService.js  Keyword-based auto-classifier
  repositories/
    ticketRepository.js     In-memory Map data store
  validators/
    ticketValidator.js      Joi validation schemas
  parsers/
    csvParser.js / jsonParser.js / xmlParser.js
  middleware/
    errorHandler.js         Central error handler
  utils/
    classificationLogger.js Structured JSON logging

tests/
  fixtures/                 Sample CSV / JSON / XML files (valid + invalid)
  test_ticket_api.test.js   REST API integration tests
  test_categorization.test.js
  test_import_csv/json/xml.test.js
  test_ticket_model.test.js
  test_integration.test.js
  test_performance.test.js
```

> **Note:** Data is stored in memory only. All tickets are lost when the server restarts.
