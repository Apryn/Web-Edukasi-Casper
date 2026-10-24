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

echo "▶ [1/4] Pull kode terbaru dari Git..."
git pull origin main || git pull origin master

echo "▶ [2/4] Install dependensi jika ada perubahan..."
npm install --prefer-offline --no-audit

echo "▶ [3/4] Rebuild Next.js..."
npm run build

echo "▶ [4/4] Restart proses PM2..."
pm2 reload casper-web || pm2 restart casper-web

echo ""
echo "=================================================="
echo "    ✅ UPDATE SELESAI & SUDAH AKTIF!"
echo "=================================================="
pm2 status casper-web
