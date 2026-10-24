# =============================================================
#   SIGNAL CASPER - PUSH & DEPLOY KE VPS HOSTINGER
#   Jalankan dari PC Windows: .\deploy.ps1
# =============================================================

param(
    [string]$VPS_IP = "187.77.156.219",
    [string]$VPS_USER = "root",
    [string]$SSH_KEY = ""
)

$START_TIME = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "     SIGNAL CASPER - PUSH & DEPLOY KE VPS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Waktu  : $START_TIME" -ForegroundColor Gray
Write-Host "  Target : $VPS_USER@$VPS_IP" -ForegroundColor Gray
Write-Host ""

# 1. Cek git & push jika ada commit
Write-Host "-> [1/3] Memeriksa perubahan git lokal..." -ForegroundColor Yellow
$gitStatus = git status --porcelain 2>$null
if ($gitStatus) {
    Write-Host "   Ada perubahan lokal terdeteksi. Melakukan commit & push..." -ForegroundColor Gray
    git add .
    git commit -m "deploy: update web casper signal ($START_TIME)"
    git push origin main
    Write-Host "   Pushed ke GitHub!" -ForegroundColor Green
}
else {
    Write-Host "   Tidak ada perubahan file baru. Melanjutkan..." -ForegroundColor Gray
}

# 2. SSH command builder
$SSH_ARGS = @("-o", "StrictHostKeyChecking=no")
if ($SSH_KEY -ne "") {
    $SSH_ARGS += "-i", $SSH_KEY
}
$SSH_TARGET = "$VPS_USER@$VPS_IP"

# 3. Jalankan script update di VPS
Write-Host ""
Write-Host "-> [2/3] Menjalankan update script di VPS..." -ForegroundColor Yellow

$remoteCommand = "if [ -f /var/www/casper-web/deploy/update.sh ]; then bash /var/www/casper-web/deploy/update.sh; else echo 'Setup pertama kali...'; bash /var/www/casper-web/deploy/setup-vps.sh; fi"

ssh @SSH_ARGS $SSH_TARGET $remoteCommand

# 4. Selesai
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "     DEPLOY SELESAI!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Akses Web Casper di:" -ForegroundColor White
Write-Host "   http://$VPS_IP`:3000" -ForegroundColor Cyan
Write-Host ""
