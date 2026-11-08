<#
.SYNOPSIS
  Skrip One-Click Deploy Signal Casper Web ke VPS Hostinger.
.DESCRIPTION
  Menjalankan seluruh tahapan deployment dalam 1 sesi SSH:
  1. Validasi database lokal (admin tunggal).
  2. Mengirim file & memasang SSH Key secara otomatis (agar tidak minta password berulang).
  3. Mengarsipkan database pengujian lama di VPS dan memasang database admin bersih.
  4. Menjalankan git merge origin/main & build Next.js di VPS.
  5. Restart PM2 casper-web aman.
.USAGE
  powershell -ExecutionPolicy Bypass -File .\deploy.ps1
  atau cukup jalankan: .\deploy.bat
#>

param(
    [string]$VpsHost = "187.77.156.219",
    [string]$VpsUser = "root"
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   SIGNAL CASPER WEB -- ONE-CLICK DEPLOYER" -ForegroundColor Cyan
Write-Host "   Target VPS: $VpsUser@$VpsHost" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Validasi file database lokal
$LocalDbPath = Join-Path $PSScriptRoot "data\academy.json"
$RunnerScriptPath = Join-Path $PSScriptRoot "deploy\vps-deploy-runner.sh"

if (-not (Test-Path $LocalDbPath)) {
    Write-Host "[ERROR] File database lokal ($LocalDbPath) tidak ditemukan!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $RunnerScriptPath)) {
    Write-Host "[ERROR] File deploy runner ($RunnerScriptPath) tidak ditemukan!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/2] Memvalidasi integritas database admin lokal..." -ForegroundColor Yellow
$ValidationScript = @'
const fs = require('fs');
const db = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
if (!Array.isArray(db.users) || db.users.length !== 1) {
  console.error('Jumlah pengguna harus tepat 1');
  process.exit(1);
}
if (db.users[0].email !== 'apriyanriyan23@gmail.com' || db.users[0].role !== 'ADMIN') {
  console.error('User bukan admin apriyanriyan23@gmail.com');
  process.exit(1);
}
console.log('Database lokal valid. User: ' + db.users[0].email + ' | Role: ' + db.users[0].role);
'@

$NodeResult = node -e $ValidationScript $LocalDbPath
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Validasi database gagal: $NodeResult" -ForegroundColor Red
    exit 1
}
Write-Host "   OK: $NodeResult" -ForegroundColor Green

# 2. Persiapkan payload base64 untuk transfer 1-sesi SSH
$LocalDbBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($LocalDbPath))
$RunnerScriptBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($RunnerScriptPath))

# Cek apakah SSH Public Key lokal tersedia
$PubKeyPath = Join-Path $HOME ".ssh\id_ed25519.pub"
$PubKey = $null
if (Test-Path $PubKeyPath) {
    $PubKey = (Get-Content -Path $PubKeyPath -Raw).Trim()
}

$Commands = @(
    "mkdir -p /root/.ssh",
    "chmod 700 /root/.ssh",
    "touch /root/.ssh/authorized_keys",
    "chmod 600 /root/.ssh/authorized_keys"
)

if ($PubKey) {
    # Daftarkan SSH Key lokal ke VPS agar deploy berikutnya otomatis tanpa minta password sama sekali
    $Commands += "grep -qF '$PubKey' /root/.ssh/authorized_keys 2>/dev/null || echo '$PubKey' >> /root/.ssh/authorized_keys"
}

$Commands += "echo '$LocalDbBase64' | base64 -d > /tmp/academy.admin-seed.json"
$Commands += "echo '$RunnerScriptBase64' | base64 -d > /tmp/vps-deploy-runner.sh"
$Commands += "chmod +x /tmp/vps-deploy-runner.sh"
$Commands += "bash /tmp/vps-deploy-runner.sh"
$Commands += "rm -f /tmp/vps-deploy-runner.sh"

$RemoteCommand = $Commands -join " && "

# 3. Jalankan melalui 1 koneksi SSH tunggal (hanya 1x prompt password)
Write-Host "`n[2/2] Menghubungkan ke VPS & menjalankan deployment..." -ForegroundColor Yellow
Write-Host "   (Cukup masukkan password root VPS 1 kali jika diminta)" -ForegroundColor Gray

ssh -t -o StrictHostKeyChecking=accept-new "${VpsUser}@${VpsHost}" "$RemoteCommand"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Terjadi kegagalan saat menjalankan deployment di VPS!" -ForegroundColor Red
    exit 1
}

# 4. Selesai
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "   DEPLOYMENT BERHASIL SELESAI!" -ForegroundColor Green
Write-Host "   Buka di browser: http://${VpsHost}:83/login" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
