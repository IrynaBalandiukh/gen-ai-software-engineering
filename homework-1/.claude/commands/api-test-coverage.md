# API Test Coverage Workflow

Analyze the banking transactions API codebase and produce comprehensive test coverage in three sequential steps. Complete each step fully before moving to the next.

---

## Step 1 — Review Routes, Validation, and Error Handling

Read every source file under `src/` and produce a structured audit with these sections:

### 1a. Route inventory

List every route in the format `METHOD /path — description`. Include query parameters and path parameters.

### 1b. Validation rules

For each route that validates input, list every rule that can pass or fail. For `POST /transactions`, enumerate:

- Each field checked
- The condition that triggers an error
- The exact error message returned
- The HTTP status code

### 1c. Error handling catalogue

List every distinct error response the API can return, grouped by source file. For each one record: trigger condition, HTTP status, response shape.

### 1d. Edge cases and gaps

Note any validation gaps, missing checks, or behaviour that could surprise a caller (e.g. floating-point rounding, case normalisation, filter interactions).

Do not write any tests yet. Output the audit as structured markdown.

---

## Step 2 — Design Test Cases

Using the audit from Step 1, design a complete test-case matrix. Organise cases by route. For every route produce:

- **Happy-path cases** — one per meaningful combination of valid inputs
- **Validation-error cases** — one per validation rule that can fail, including boundary values (e.g. amount = 0, amount with 3 decimal places, wrong account format, invalid currency)
- **Not-found cases** — where a resource lookup can return 404
- **Filter cases** — for `GET /transactions`, cover each filter alone and at least one combined-filter case
- **Edge cases** — identified gaps from Step 1d

Format each test case as:

```
TC-<number>: <short name>
  Route:      METHOD /path
  Input:      <request body or query params, or "none">
  Expected:   HTTP <status> — <brief description of response>
```

Number cases sequentially (TC-001, TC-002, …). Do not write HTTP request files yet.

---

## Step 3 — Write Sample API Requests

Create or rewrite the file `demo/sample-requests.sh` as a self-contained bash test runner.

Rules for the file:

- Define a `run_test` helper that accepts `TC-ID`, `name`, `expected HTTP status`, and the remaining args are passed directly to `curl -s`. The helper must:
  - Print a labelled separator block before each request: TC ID + name
  - Capture the response body and actual HTTP status code using `curl -s -w "%{http_code}" -o <tmpfile>`
  - Pretty-print the response with `jq .` if `jq` is available, otherwise print raw
  - Compare actual vs expected status and print `PASS` or `FAIL (expected NNN)`
  - Increment `$PASS` or `$FAIL` counters
- Define `BASE_URL="http://localhost:3000"` at the top
- Capture `TRANSACTION_ID` automatically from the TC-002 response body using `grep -oP '"id":"\K[^"]+'` — no manual copy-paste needed
- Group requests under clearly labelled `echo` section headers matching the route
- End the script with a summary line: `Results: N passed, N failed (total: N)`
- Requests must be runnable against `http://localhost:3000`
- After writing the file, print a summary table: TC ID | Route | Expected Status
