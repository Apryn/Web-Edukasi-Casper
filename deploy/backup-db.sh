#!/usr/bin/env bash
# =============================================================
#   SIGNAL CASPER - SCRIPT BACKUP DATABASE OTOMATIS
#   Usage: bash /var/www/casper-web/deploy/backup-db.sh
#   Bisa dipasang di crontab: 0 3 * * * bash /var/www/casper-web/deploy/backup-db.sh
# =============================================================

set -e

APP_DIR="/var/www/casper-web"
DATA_DIR="$APP_DIR/data"
BACKUP_DIR="$APP_DIR/data-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/casper-db-$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

if [ ! -d "$DATA_DIR" ]; then
    echo "⚠️ Direktori data $DATA_DIR tidak ditemukan!"
    exit 1
fi

echo "📦 Membuat arsip database dari $DATA_DIR..."
tar -czf "$BACKUP_FILE" -C "$APP_DIR" data/

echo "✅ Backup berhasil dibuat: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"

# Hapus backup yang lebih tua dari 30 hari untuk menghemat storage
echo "🧹 Membersihkan backup lama (> 30 hari)..."
find "$BACKUP_DIR" -name "casper-db-*.tar.gz" -type f -mtime +30 -delete 2>/dev/null || true

echo "✨ Selesai!"
