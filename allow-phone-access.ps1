# PowerShell script to allow phone access to Hustl server
# Run this as Administrator: Right-click PowerShell -> Run as Administrator, then run: .\allow-phone-access.ps1

Write-Host "Adding firewall rule for Hustl server on port 8080..." -ForegroundColor Yellow

# Add firewall rule to allow incoming connections on port 8080
netsh advfirewall firewall add rule name="Hustl Server Port 8080" dir=in action=allow protocol=TCP localport=8080

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Firewall rule added successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your server should now be accessible from your phone." -ForegroundColor Cyan
    Write-Host "Make sure your phone is on the same WiFi network." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To find your IP address, run: ipconfig | findstr IPv4" -ForegroundColor Yellow
} else {
    Write-Host "✗ Failed to add firewall rule. Make sure you're running as Administrator." -ForegroundColor Red
}

