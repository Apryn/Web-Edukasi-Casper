<#
.SYNOPSIS
  Skrip One-Click Deploy Signal Casper Web ke VPS Hostinger.
.DESCRIPTION
  Menjalankan seluruh tahapan deployment secara otomatis:
  1. Validasi database lokal (admin tunggal).
  2. Upload seed database ke VPS secara aman (/tmp/academy.admin-seed.json).
  3. Inisialisasi folder data, perizinan (700/600), dan .env.production di VPS jika belum ada.
  4. Menjalankan git safe update & build Next.js di VPS.
  5. Reload PM2 (hanya casper-web) & health check.
.USAGE
  powershell -ExecutionPolicy Bypass -File .\deploy.ps1
  atau cukup jalankan: .\deploy.bat
#>

param(
    [string]$VpsHost = "187.77.156.219",
    [string]$VpsUser = "root",
    [string]$AppDir = "/var/www/casper-web"
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   SIGNAL CASPER WEB -- ONE-CLICK DEPLOYER" -ForegroundColor Cyan
Write-Host "   Target VPS: $VpsUser@$VpsHost ($AppDir)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Validasi file database lokal
$LocalDbPath = Join-Path $PSScriptRoot "data\academy.json"
if (-not (Test-Path $LocalDbPath)) {
    Write-Host "[ERROR] File database lokal ($LocalDbPath) tidak ditemukan!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/4] Memvalidasi integritas database admin lokal..." -ForegroundColor Yellow
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

# 2. Upload file database admin ke /tmp VPS
Write-Host "`n[2/4] Mengunggah database seed ke VPS ($VpsHost)..." -ForegroundColor Yellow
Write-Host "   (Masukkan password VPS jika diminta oleh OpenSSH)" -ForegroundColor Gray
scp -o StrictHostKeyChecking=accept-new $LocalDbPath "${VpsUser}@${VpsHost}:/tmp/academy.admin-seed.json"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Gagal mengunggah database ke VPS!" -ForegroundColor Red
    exit 1
}
Write-Host "   OK: Database seed berhasil terunggah ke /tmp/academy.admin-seed.json" -ForegroundColor Green

# 3. Jalankan prosedur deployment aman di VPS via SSH
Write-Host "`n[3/4] Menjalankan automasi deployment di VPS..." -ForegroundColor Yellow
$RemoteCommand = @'
set -euo pipefail
APP_DIR="/var/www/casper-web"
DATA_DIR="$APP_DIR/data"
DB_FILE="$DATA_DIR/academy.json"
BACKUP_DIR="$APP_DIR/data-backups"

echo "==> [VPS 1/5] Memastikan direktori dan izin data (700)..."
mkdir -p "$DATA_DIR" "$BACKUP_DIR"
chmod 700 "$DATA_DIR" "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ] || [ ! -s "$DB_FILE" ]; then
    if [ -f "/tmp/academy.admin-seed.json" ]; then
        echo "==> [VPS 2/5] Memasang database awal ke $DB_FILE (chmod 600)..."
        cp /tmp/academy.admin-seed.json "$DB_FILE"
        chmod 600 "$DB_FILE"
        rm -f /tmp/academy.admin-seed.json
    else
        echo "ERROR: Database $DB_FILE belum ada dan /tmp/academy.admin-seed.json tidak ditemukan!"
        exit 1
    fi
else
    echo "==> [VPS 2/5] Database $DB_FILE sudah ada. Mempertahankan database aktif."
    rm -f /tmp/academy.admin-seed.json
fi

if [ ! -f "$APP_DIR/.env.production" ]; then
    echo "==> [VPS 3/5] Membuat .env.production..."
    cat << "EOF" > "$APP_DIR/.env.production"
NODE_ENV=production
PORT=3005
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECURE=false
EOF
    chmod 600 "$APP_DIR/.env.production"
fi

echo "==> [VPS 4/5] Memperbarui kode dari origin/main..."
cd "$APP_DIR"
git fetch origin main
git merge --ff-only origin/main

echo "==> [VPS 5/5] Menjalankan update dan restart PM2 aman..."
bash "$APP_DIR/deploy/update.sh"
'@

ssh -t -o StrictHostKeyChecking=accept-new "${VpsUser}@${VpsHost}" "$RemoteCommand"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Terjadi kegagalan saat menjalankan deployment di VPS!" -ForegroundColor Red
    exit 1
}

# 4. Selesai
Write-Host "`n[4/4] Deployment selesai!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   DEPLOYMENT BERHASIL SELESAI!" -ForegroundColor Green
Write-Host "   Buka di browser: http://${VpsHost}:83/login" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
