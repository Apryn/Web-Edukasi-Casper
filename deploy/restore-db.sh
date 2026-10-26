#!/usr/bin/env bash
# =============================================================
#   SIGNAL CASPER - SCRIPT PEMULIHAN (RESTORE) DATABASE
#   Usage: bash /var/www/casper-web/deploy/restore-db.sh [path-ke-file-backup.tar.gz]
# =============================================================

set -e

APP_DIR="/var/www/casper-web"
BACKUP_DIR="$APP_DIR/data-backups"
TARGET_BACKUP="$1"

if [ -z "$TARGET_BACKUP" ]; then
    echo "Mencari backup terbaru di $BACKUP_DIR..."
    TARGET_BACKUP=$(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -n 1)
fi

if [ -z "$TARGET_BACKUP" ] || [ ! -f "$TARGET_BACKUP" ]; then
    echo "❌ File backup tidak ditemukan!"
    echo "Usage: bash deploy/restore-db.sh /path/ke/file-backup.tar.gz"
    exit 1
fi

echo "⚠️ PERINGATAN: Memulihkan database dari: $TARGET_BACKUP"
echo "Proses ini akan menghentikan PM2 sementara dan mereplace direktori data/."

read -p "Lanjutkan? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "Operasi dibatalkan."
    exit 0
fi

# Stop PM2 sementara
pm2 stop casper-web 2>/dev/null || true

# Simpan snapshot darurat data sebelum di-overwrite
if [ -d "$APP_DIR/data" ]; then
    EMERGENCY_SNAP="$BACKUP_DIR/emergency-pre-restore-$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$EMERGENCY_SNAP" -C "$APP_DIR" data/ 2>/dev/null || true
    echo "📦 Snapshot darurat tersimpan di: $EMERGENCY_SNAP"
fi

# Ekstrak backup
tar -xzf "$TARGET_BACKUP" -C "$APP_DIR"
echo "✅ Berhasil memulihkan direktori data/ dari arsip."

# Restart PM2
pm2 start ecosystem.config.cjs
echo "🚀 PM2 casper-web telah dihidupkan kembali."
pm2 status casper-web
