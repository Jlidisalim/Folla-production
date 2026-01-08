# Ngrok Tunnel Starter
# This script starts ngrok tunnel for Paymee webhook testing

Write-Host "Starting ngrok tunnel on port 4002..." -ForegroundColor Cyan
Write-Host ""

$ngrokPath = "C:\Users\salim\AppData\Local\Microsoft\WinGet\Links\ngrok.exe"

if (Test-Path $ngrokPath) {
    Write-Host "Found ngrok at: $ngrokPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Copy the 'Forwarding' URL (https://....ngrok-free.app) from below:" -ForegroundColor Yellow
    Write-Host "Then update backend/.env with:" -ForegroundColor Yellow
    Write-Host "  PAYMEE_WEBHOOK_URL=https://YOUR-URL.ngrok-free.app/api/paymee/webhook" -ForegroundColor Yellow
    Write-Host "  PAYMEE_MODE=dynamic" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the tunnel when done." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    
    & $ngrokPath http 4002
} else {
    Write-Host "ERROR: ngrok not found at expected location!" -ForegroundColor Red
    Write-Host "Please restart PowerShell and run: ngrok http 4002" -ForegroundColor Yellow
}
