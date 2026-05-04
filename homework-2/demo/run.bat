@echo off
setlocal

echo === Intelligent Customer Support Ticket System — Demo ===
echo.

cd /d "%~dp0.."

echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed.
    exit /b 1
)
echo.

echo [2/3] Starting server on http://localhost:3000 ...
start /b npm start
timeout /t 2 /nobreak >nul
echo.

echo [3/3] Running demo requests...
echo.

echo --- List tickets (expect empty array) ---
curl -s http://localhost:3000/tickets
echo.
echo.

echo --- Create a ticket with auto-classify ---
curl -s -X POST "http://localhost:3000/tickets?auto_classify=true" ^
  -H "Content-Type: application/json" ^
  -d "{\"customer_id\":\"C001\",\"customer_email\":\"user@example.com\",\"customer_name\":\"Jane Smith\",\"subject\":\"Cannot login to my account\",\"description\":\"I have been unable to login for the past two days. Password reset did not help.\"}"
echo.
echo.

echo --- Bulk import sample CSV ---
curl -s -X POST http://localhost:3000/tickets/import ^
  -F "file=@demo/sample_tickets.csv"
echo.
echo.

echo --- List all tickets after import ---
curl -s http://localhost:3000/tickets
echo.
echo.

echo Demo complete. Press any key to stop the server.
pause >nul

taskkill /f /im node.exe >nul 2>&1
echo Server stopped.
endlocal
