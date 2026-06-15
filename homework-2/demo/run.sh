#!/usr/bin/env bash
set -e

echo "=== Intelligent Customer Support Ticket System — Demo ==="
echo

cd "$(dirname "$0")/.."

echo "[1/3] Installing dependencies..."
npm install
echo

echo "[2/3] Starting server on http://localhost:3000 ..."
npm start &
SERVER_PID=$!
sleep 2
echo

cleanup() {
  echo
  echo "Stopping server (PID $SERVER_PID)..."
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "[3/3] Running demo requests..."
echo

echo "--- List tickets (expect empty array) ---"
curl -s http://localhost:3000/tickets
echo -e "\n"

echo "--- Create a ticket with auto-classify ---"
curl -s -X POST "http://localhost:3000/tickets?auto_classify=true" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "C001",
    "customer_email": "user@example.com",
    "customer_name": "Jane Smith",
    "subject": "Cannot login to my account",
    "description": "I have been unable to login for the past two days. Password reset did not help."
  }'
echo -e "\n"

echo "--- Bulk import sample CSV ---"
curl -s -X POST http://localhost:3000/tickets/import \
  -F "file=@demo/sample_tickets.csv"
echo -e "\n"

echo "--- List all tickets after import ---"
curl -s http://localhost:3000/tickets
echo -e "\n"

echo "Demo complete."
