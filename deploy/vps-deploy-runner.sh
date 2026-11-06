#!/usr/bin/env bash
# =============================================================
#   SIGNAL CASPER WEB - VPS DEPLOY RUNNER
#   Eksekusi otomatis di dalam VPS hostinger
# =============================================================

set -euo pipefail
umask 077

APP_DIR="/var/www/casper-web"
DATA_DIR="$APP_DIR/data"
DB_FILE="$DATA_DIR/academy.json"
BACKUP_DIR="$APP_DIR/data-backups"

echo "=================================================="
echo "    🚀 SIGNAL CASPER WEB - VPS DEPLOY RUNNER"
echo "=================================================="

echo "▶ [1/5] Memastikan direktori dan izin data (700)..."
mkdir -p "$DATA_DIR" "$BACKUP_DIR"
chmod 700 "$DATA_DIR" "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ] || [ ! -s "$DB_FILE" ]; then
    if [ -f "/tmp/academy.admin-seed.json" ]; then
        echo "▶ [2/5] Memasang database awal ke $DB_FILE (chmod 600)..."
        cp /tmp/academy.admin-seed.json "$DB_FILE"
        chmod 600 "$DB_FILE"
        rm -f /tmp/academy.admin-seed.json
    else
        echo "❌ Database $DB_FILE belum ada dan /tmp/academy.admin-seed.json tidak ditemukan!"
        exit 1
    fi
else
    echo "▶ [2/5] Database $DB_FILE sudah ada. Mempertahankan database aktif."
    rm -f /tmp/academy.admin-seed.json
fi

if [ ! -f "$APP_DIR/.env.production" ]; then
    echo "▶ [3/5] Membuat .env.production awal..."
    GEN_SECRET=$(openssl rand -hex 32)
    cat << EOF > "$APP_DIR/.env.production"
NODE_ENV=production
PORT=3005
JWT_SECRET=${GEN_SECRET}
COOKIE_SECURE=false
EOF
    chmod 600 "$APP_DIR/.env.production"
    echo "   .env.production berhasil dibuat."
else
    echo "▶ [3/5] File .env.production sudah ada. Mempertahankan konfigurasi aktif."
fi

echo "▶ [4/5] Mengambil pembaruan Git terbaru (fast-forward)..."
cd "$APP_DIR"
git fetch origin main
git merge --ff-only origin/main

echo "▶ [5/5] Menjalankan update script resmi..."
bash "$APP_DIR/deploy/update.sh"
