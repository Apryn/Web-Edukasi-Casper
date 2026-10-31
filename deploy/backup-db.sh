#!/usr/bin/env bash
# =============================================================
#   SIGNAL CASPER - SCRIPT BACKUP DATABASE & VERIFIKASI ISI
#   Usage: bash /var/www/casper-web/deploy/backup-db.sh
#   Bisa dipasang di crontab: 0 3 * * * bash /var/www/casper-web/deploy/backup-db.sh
# =============================================================

set -euo pipefail
umask 077

APP_DIR="/var/www/casper-web"
DATA_DIR="$APP_DIR/data"
DB_FILE="$DATA_DIR/academy.json"
BACKUP_DIR="$APP_DIR/data-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/casper-db-$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if [ ! -d "$DATA_DIR" ]; then
    echo "❌ Direktori data $DATA_DIR tidak ditemukan!"
    exit 1
fi
chmod 700 "$DATA_DIR"

if [ ! -s "$DB_FILE" ]; then
    echo "❌ File database $DB_FILE tidak ditemukan atau kosong (0 bytes)! Backup dibatalkan."
    exit 1
fi
chmod 600 "$DB_FILE"

echo "🔍 Memvalidasi struktur JSON $DB_FILE sebelum backup..."
node -e '
  const fs = require("fs");
  const raw = fs.readFileSync(process.argv[1], "utf8");
  const db = JSON.parse(raw);
  if (!Array.isArray(db.users) || !Array.isArray(db.course_progress) || !Array.isArray(db.quiz_submissions)) {
    console.error("❌ Struktur database JSON tidak valid!");
    process.exit(1);
  }
  if (db.users.length === 0) {
    console.error("❌ Database tidak memiliki akun pengguna (users: 0)!");
    process.exit(1);
  }
  console.log("   Statistik DB sumber -> Users:", db.users.length, "| Progress:", db.course_progress.length, "| QuizSubmissions:", db.quiz_submissions.length);
' "$DB_FILE"

echo "📦 Membuat arsip database dari $DATA_DIR..."
tar -czf "$BACKUP_FILE" -C "$APP_DIR" data/
chmod 600 "$BACKUP_FILE"

echo "🔍 Memverifikasi integritas isi arsip $BACKUP_FILE..."
if ! tar -tzf "$BACKUP_FILE" | grep -qx "data/academy.json"; then
    echo "❌ Arsip tidak memuat data/academy.json!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

tar -xzOf "$BACKUP_FILE" data/academy.json | node -e '
  const fs = require("fs");
  const raw = fs.readFileSync(0, "utf8");
  const db = JSON.parse(raw);
  if (!Array.isArray(db.users) || db.users.length === 0) {
    console.error("❌ Isi data/academy.json di dalam arsip tidak valid atau kosong!");
    process.exit(1);
  }
  console.log("   Verifikasi isi arsip OK -> Users:", db.users.length, "| Progress:", db.course_progress.length, "| QuizSubmissions:", db.quiz_submissions.length);
'

echo "✅ Backup terverifikasi berhasil dibuat: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"

# Hapus backup yang lebih tua dari 30 hari untuk menghemat storage
echo "🧹 Membersihkan backup lama (> 30 hari)..."
find "$BACKUP_DIR" -name "casper-db-*.tar.gz" -type f -mtime +30 -delete 2>/dev/null || true

echo "✨ Selesai!"
