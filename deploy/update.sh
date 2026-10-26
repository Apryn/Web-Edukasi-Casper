#!/usr/bin/env bash
# =============================================================
#   SIGNAL CASPER - UPDATE APP DI VPS
#   Usage di VPS: bash /var/www/casper-web/deploy/update.sh
# =============================================================

set -e

APP_DIR="/var/www/casper-web"

echo "=================================================="
echo "    🔄 SIGNAL CASPER — UPDATE APP"
echo "=================================================="

cd "$APP_DIR"

echo "▶ [1/5] Backup database & data persisten..."
if [ -d "$APP_DIR/data" ]; then
    mkdir -p "$APP_DIR/data-backups"
    PRE_UPDATE_BACKUP="$APP_DIR/data-backups/pre-update-$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$PRE_UPDATE_BACKUP" -C "$APP_DIR" data/ 2>/dev/null || true
    echo "  📦 Backup berhasil dibuat di: $PRE_UPDATE_BACKUP"
fi

echo "▶ [2/5] Pull kode terbaru dari Git (clean sync)..."
git fetch origin main
git reset --hard origin/main

echo "▶ [2/4] Install dependensi jika ada perubahan..."
npm install --prefer-offline --no-audit

echo "▶ [3/4] Rebuild Next.js..."
npm run build

echo "▶ [4/4] Restart proses PM2 via ecosystem.config.cjs..."
pm2 delete casper-web 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "=================================================="
echo "    ✅ UPDATE SELESAI & SUDAH AKTIF!"
echo "=================================================="
pm2 status casper-web
