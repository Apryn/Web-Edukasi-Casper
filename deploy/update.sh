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

echo "▶ [1/4] Pull kode terbaru dari Git (clean sync)..."
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
