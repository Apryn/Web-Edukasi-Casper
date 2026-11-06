<#
.SYNOPSIS
  Skrip One-Click Deploy Signal Casper Web ke VPS Hostinger.
.DESCRIPTION
  Menjalankan seluruh tahapan deployment secara otomatis:
  1. Validasi database lokal (admin tunggal).
  2. Upload seed database & runner ke VPS via scp.
  3. Menjalankan runner script di VPS via ssh.
  4. Selesai & verifikasi.
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

Write-Host "`n[1/3] Memvalidasi integritas database admin lokal..." -ForegroundColor Yellow
$ValidationScript = @'
const fs = require('fs');
const db = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
if (!Array.isArray(db.users) || db.users.length !== 1) {
  console.error('Jumlah pengguna harus tepat 1');
  process.exit(1);
}
if (db.users[0].email !== 'apryn@casper.com' || db.users[0].role !== 'ADMIN') {
  console.error('User bukan admin apryn@casper.com');
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

# 2. Upload file database dan runner ke /tmp VPS
Write-Host "`n[2/3] Mengunggah file database & deploy runner ke VPS ($VpsHost)..." -ForegroundColor Yellow
Write-Host "   (Masukkan password root VPS jika diminta oleh OpenSSH)" -ForegroundColor Gray

scp -o StrictHostKeyChecking=accept-new $LocalDbPath "${VpsUser}@${VpsHost}:/tmp/academy.admin-seed.json"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Gagal mengunggah database ke VPS!" -ForegroundColor Red
    exit 1
}

scp -o StrictHostKeyChecking=accept-new $RunnerScriptPath "${VpsUser}@${VpsHost}:/tmp/vps-deploy-runner.sh"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Gagal mengunggah script runner ke VPS!" -ForegroundColor Red
    exit 1
}
Write-Host "   OK: File berhasil diunggah ke /tmp di VPS" -ForegroundColor Green

# 3. Jalankan prosedur deployment di VPS via SSH
Write-Host "`n[3/3] Menjalankan automasi deployment di VPS..." -ForegroundColor Yellow
ssh -t -o StrictHostKeyChecking=accept-new "${VpsUser}@${VpsHost}" "bash /tmp/vps-deploy-runner.sh && rm -f /tmp/vps-deploy-runner.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Terjadi kegagalan saat menjalankan deployment di VPS!" -ForegroundColor Red
    exit 1
}

# 4. Selesai
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "   DEPLOYMENT BERHASIL SELESAI!" -ForegroundColor Green
Write-Host "   Buka di browser: http://${VpsHost}:83/login" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
