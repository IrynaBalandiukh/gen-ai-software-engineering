#!/usr/bin/env bash
# Banking Transactions API — Test Runner
# Usage: bash demo/test-requests.sh
# Requires: curl  (jq optional — pretty-prints JSON if available)

BASE_URL="http://localhost:3000"
TRANSACTION_ID=""
PASS=0
FAIL=0
LAST_RESPONSE=""

SEP="------------------------------------------------------------"

# Runs one test: prints label, response, HTTP status, PASS/FAIL
# Sets LAST_RESPONSE so the caller can extract values (e.g. ID from TC-002)
run_test() {
  local id="$1" name="$2" expected="$3"; shift 3

  printf "\n%s\n%-10s %s\n%s\n" "$SEP" "$id" "$name" "$SEP"

  local tmp; tmp=$(mktemp)
  local actual; actual=$(curl -s -w "%{http_code}" -o "$tmp" "$@")
  LAST_RESPONSE=$(cat "$tmp"); rm -f "$tmp"

  if command -v jq &>/dev/null; then
    echo "$LAST_RESPONSE" | jq . 2>/dev/null || echo "$LAST_RESPONSE"
  else
    echo "$LAST_RESPONSE"
  fi

  if [[ "$actual" == "$expected" ]]; then
    printf "=> HTTP %s  PASS\n" "$actual"
    ((PASS++))
  else
    printf "=> HTTP %s  FAIL  (expected %s)\n" "$actual" "$expected"
    ((FAIL++))
  fi
}


# =============================================================================
echo -e "\n============================================================"
echo   "  GET /health"
echo   "============================================================"

run_test "TC-001" "Health check — success" "200" \
  "$BASE_URL/health"


# =============================================================================
echo -e "\n============================================================"
echo   "  POST /transactions — happy path"
echo   "============================================================"

run_test "TC-002" "Create deposit — captures ID for TC-044" "201" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":1000,"currency":"USD","type":"deposit"}'
TRANSACTION_ID=$(echo "$LAST_RESPONSE" | grep -oP '"id":"\K[^"]+')

run_test "TC-003" "Create withdrawal — minimal valid body" "201" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-10001","amount":100,"currency":"USD","type":"withdrawal"}'

run_test "TC-004" "Create transfer — minimal valid body" "201" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-10001","toAccount":"ACC-10002","amount":50,"currency":"USD","type":"transfer"}'

run_test "TC-005" "Create transaction with explicit status=pending" "201" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":200,"currency":"USD","type":"deposit","status":"pending"}'

run_test "TC-006" "Create transaction with explicit status=failed" "201" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-10001","amount":50,"currency":"USD","type":"withdrawal","status":"failed"}'

run_test "TC-007" "Amount with exactly 2 decimal places — boundary valid" "201" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":99.99,"currency":"USD","type":"deposit"}'

run_test "TC-008" "Currency code normalised from lowercase — stored as USD" "201" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":100,"currency":"usd","type":"deposit"}'

run_test "TC-009" "Account numbers normalised from lowercase — stored uppercased" "201" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"acc-10001","toAccount":"acc-10002","amount":25,"currency":"USD","type":"transfer"}'


# =============================================================================
echo -e "\n============================================================"
echo   "  POST /transactions — validation errors: amount"
echo   "============================================================"

run_test "TC-010" "Amount missing" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","currency":"USD","type":"deposit"}'

run_test "TC-011" "Amount = 0 — boundary, not positive" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":0,"currency":"USD","type":"deposit"}'

run_test "TC-012" "Amount negative" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":-100,"currency":"USD","type":"deposit"}'

run_test "TC-013" "Amount with 3 decimal places" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":10.001,"currency":"USD","type":"deposit"}'

run_test "TC-014" "Amount as string" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":"100","currency":"USD","type":"deposit"}'

run_test "TC-015" "Amount negative with 3 decimal places — both errors fire" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":-1.234,"currency":"USD","type":"deposit"}'


# =============================================================================
echo -e "\n============================================================"
echo   "  POST /transactions — validation errors: currency"
echo   "============================================================"

run_test "TC-016" "Currency missing" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":100,"type":"deposit"}'

run_test "TC-017" "Currency not a valid ISO 4217 code" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":100,"currency":"XYZ","type":"deposit"}'


# =============================================================================
echo -e "\n============================================================"
echo   "  POST /transactions — validation errors: type"
echo   "============================================================"

run_test "TC-018" "Type missing" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":100,"currency":"USD"}'

run_test "TC-019" "Type invalid value" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":100,"currency":"USD","type":"credit"}'


# =============================================================================
echo -e "\n============================================================"
echo   "  POST /transactions — validation errors: account presence"
echo   "============================================================"

run_test "TC-020" "Withdrawal without fromAccount" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"currency":"USD","type":"withdrawal"}'

run_test "TC-021" "Transfer without fromAccount" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10002","amount":100,"currency":"USD","type":"transfer"}'

run_test "TC-022" "Deposit without toAccount" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"currency":"USD","type":"deposit"}'

run_test "TC-023" "Transfer without toAccount" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-10001","amount":100,"currency":"USD","type":"transfer"}'

run_test "TC-024" "Transfer with both accounts missing — two errors in details" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"currency":"USD","type":"transfer"}'


# =============================================================================
echo -e "\n============================================================"
echo   "  POST /transactions — validation errors: account format"
echo   "============================================================"

run_test "TC-025" "fromAccount invalid format" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"123456","amount":100,"currency":"USD","type":"withdrawal"}'

run_test "TC-026" "toAccount invalid format" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACCOUNT-001","amount":100,"currency":"USD","type":"deposit"}'


# =============================================================================
echo -e "\n============================================================"
echo   "  POST /transactions — validation errors: status"
echo   "============================================================"

run_test "TC-027" "Status invalid value" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":100,"currency":"USD","type":"deposit","status":"approved"}'

run_test "TC-028" "Multiple errors simultaneously — amount + currency both fail" "400" \
  -X POST "$BASE_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-10001","amount":"bad","currency":"XYZ","type":"deposit"}'


# =============================================================================
echo -e "\n============================================================"
echo   "  GET /transactions — happy path"
echo   "============================================================"

run_test "TC-029" "List all transactions — no filters" "200" \
  "$BASE_URL/transactions"

run_test "TC-030" "Filter by accountId" "200" \
  "$BASE_URL/transactions?accountId=ACC-10001"

run_test "TC-031" "Filter by type=deposit" "200" \
  "$BASE_URL/transactions?type=deposit"

run_test "TC-032" "Filter by type=withdrawal" "200" \
  "$BASE_URL/transactions?type=withdrawal"

run_test "TC-033" "Filter by type=transfer" "200" \
  "$BASE_URL/transactions?type=transfer"

run_test "TC-034" "Filter by from date" "200" \
  "$BASE_URL/transactions?from=2024-02-01"

run_test "TC-035" "Filter by to date" "200" \
  "$BASE_URL/transactions?to=2024-01-20"

run_test "TC-036" "Filter by date range — January 2024" "200" \
  "$BASE_URL/transactions?from=2024-01-10&to=2024-01-31"

run_test "TC-037" "Combined filter — accountId + type" "200" \
  "$BASE_URL/transactions?accountId=ACC-10001&type=transfer"

run_test "TC-038" "Combined filter — accountId + date range" "200" \
  "$BASE_URL/transactions?accountId=ACC-10002&from=2024-01-01&to=2024-01-31"


# =============================================================================
echo -e "\n============================================================"
echo   "  GET /transactions — validation errors"
echo   "============================================================"

run_test "TC-039" "Invalid type filter" "400" \
  "$BASE_URL/transactions?type=credit"

run_test "TC-040" "Invalid from date" "400" \
  "$BASE_URL/transactions?from=not-a-date"

run_test "TC-041" "Invalid to date" "400" \
  "$BASE_URL/transactions?to=not-a-date"


# =============================================================================
echo -e "\n============================================================"
echo   "  GET /transactions — edge cases"
echo   "============================================================"

run_test "TC-042" "accountId with no matches — 200 empty array, not 404" "200" \
  "$BASE_URL/transactions?accountId=ACC-99999"

run_test "TC-043" "Single-day range — to is end-of-day inclusive" "200" \
  "$BASE_URL/transactions?from=2024-01-15&to=2024-01-15"


# =============================================================================
echo -e "\n============================================================"
echo   "  GET /transactions/:id"
echo   "============================================================"

run_test "TC-044" "Get existing transaction by ID (captured from TC-002)" "200" \
  "$BASE_URL/transactions/$TRANSACTION_ID"

run_test "TC-045" "Get non-existent transaction ID — 404" "404" \
  "$BASE_URL/transactions/00000000-0000-0000-0000-000000000000"


# =============================================================================
echo -e "\n============================================================"
echo   "  GET /accounts/:accountId/balance"
echo   "============================================================"

run_test "TC-046" "Single-currency balance — ACC-10001 (USD only)" "200" \
  "$BASE_URL/accounts/ACC-10001/balance"

run_test "TC-047" "Multi-currency balance — ACC-10002 (USD + EUR)" "200" \
  "$BASE_URL/accounts/ACC-10002/balance"

run_test "TC-048" "Account with only pending transactions — 404" "404" \
  "$BASE_URL/accounts/ACC-10003/balance"

run_test "TC-049" "Unknown accountId — 404" "404" \
  "$BASE_URL/accounts/ACC-99999/balance"


# =============================================================================
echo -e "\n============================================================"
echo   "  GET /accounts/:accountId/summary"
echo   "============================================================"

run_test "TC-050" "Summary with mixed types — ACC-10001" "200" \
  "$BASE_URL/accounts/ACC-10001/summary"

run_test "TC-051" "Summary for multi-currency account — ACC-10002" "200" \
  "$BASE_URL/accounts/ACC-10002/summary"

run_test "TC-052" "Unknown accountId — 404" "404" \
  "$BASE_URL/accounts/ACC-99999/summary"


# =============================================================================
echo -e "\n============================================================"
echo   "  Not-found route"
echo   "============================================================"

run_test "TC-053" "GET to unknown route — 404" "404" \
  "$BASE_URL/unknown-path"

run_test "TC-054" "POST to unknown route — 404" "404" \
  -X POST "$BASE_URL/unknown-path" \
  -H "Content-Type: application/json" \
  -d '{}'


# =============================================================================
echo ""
echo "============================================================"
printf "  Results: %d passed, %d failed  (total: %d)\n" "$PASS" "$FAIL" "$((PASS + FAIL))"
echo "============================================================"
