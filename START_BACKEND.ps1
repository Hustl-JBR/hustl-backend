# PowerShell script to start the Hustl backend server
# Run this script by right-clicking and selecting "Run with PowerShell"
# Or run: powershell -ExecutionPolicy Bypass -File START_BACKEND.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Hustl Backend Server Starter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to the script's directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Current directory: $scriptPath" -ForegroundColor Yellow
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  WARNING: .env file not found!" -ForegroundColor Red
    Write-Host "   Make sure you have created a .env file with your environment variables." -ForegroundColor Yellow
    Write-Host ""
}

# Generate Prisma client
Write-Host "📦 Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
Write-Host ""

# Start the server
Write-Host "🚀 Starting backend server..." -ForegroundColor Green
Write-Host "   Server will be available at: http://localhost:8080" -ForegroundColor Cyan
Write-Host "   Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm run dev

