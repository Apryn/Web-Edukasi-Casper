#!/usr/bin/env bash
# =============================================================
#   SIGNAL CASPER - SCRIPT PEMULIHAN (RESTORE) DATABASE AMAN
#   Usage: bash /var/www/casper-web/deploy/restore-db.sh [path-ke-file-backup.tar.gz]
# =============================================================

set -euo pipefail
umask 077

APP_DIR="/var/www/casper-web"
DATA_DIR="$APP_DIR/data"
BACKUP_DIR="$APP_DIR/data-backups"
TARGET_BACKUP="${1:-}"

if ! pm2 describe casper-web >/dev/null 2>&1; then
    echo "❌ Proses PM2 'casper-web' tidak terdaftar di PM2! Operasi restore dibatalkan."
    exit 1
fi

if [ -z "$TARGET_BACKUP" ]; then
    echo "Mencari backup terbaru di $BACKUP_DIR..."
    TARGET_BACKUP=$(ls -t "$BACKUP_DIR"/casper-db-*.tar.gz 2>/dev/null | head -n 1 || true)
fi

if [ -z "$TARGET_BACKUP" ] || [ ! -s "$TARGET_BACKUP" ]; then
    echo "❌ File backup tidak ditemukan atau kosong!"
    echo "Usage: bash deploy/restore-db.sh /path/ke/file-backup.tar.gz"
    exit 1
fi

# 1. Pastikan backup valid sebelum proses restore
echo "🔍 [1/5] Memverifikasi isi arsip $TARGET_BACKUP sebelum restore..."
if ! tar -tzf "$TARGET_BACKUP" | grep -qx "data/academy.json"; then
    echo "❌ Arsip $TARGET_BACKUP tidak berisi data/academy.json! Restore dibatalkan."
    exit 1
fi

# 2. Ekstrak ke direktori staging sementara & validasi file pengganti sebelum menyentuh database aktif
echo "🔍 [2/5] Mengekstrak dan memvalidasi file pengganti di direktori staging..."
STAGING_DIR=$(mktemp -d "$APP_DIR/.restore-staging.XXXXXX")
cleanup_staging() {
    rm -rf "$STAGING_DIR" 2>/dev/null || true
}
trap cleanup_staging EXIT

tar -xzf "$TARGET_BACKUP" -C "$STAGING_DIR"

if [ ! -s "$STAGING_DIR/data/academy.json" ]; then
    echo "❌ File hasil ekstraksi staging data/academy.json kosong! Restore dibatalkan."
    exit 1
fi

node -e '
  const fs = require("fs");
  const db = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!Array.isArray(db.users) || !Array.isArray(db.course_progress) || !Array.isArray(db.quiz_submissions)) {
    console.error("❌ Skema data/academy.json di staging tidak valid!");
    process.exit(1);
  }
  if (db.users.length === 0) {
    console.error("❌ Arsip backup tidak memiliki pengguna (users: 0)! Restore dibatalkan.");
    process.exit(1);
  }
  console.log("   File pengganti tervalidasi -> Users:", db.users.length, "| Progress:", db.course_progress.length, "| QuizSubmissions:", db.quiz_submissions.length);
' "$STAGING_DIR/data/academy.json"

echo "⚠️ PERINGATAN: Memulihkan database dari: $TARGET_BACKUP"
echo "Proses ini hanya akan menghentikan PM2 casper-web sementara dan mengganti direktori data/."

read -p "Lanjutkan? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "Operasi dibatalkan."
    exit 0
fi

# 3. Buat backup kondisi database saat ini sebelum menggantinya
echo "📦 [3/5] Membuat backup kondisi database saat ini sebelum restore..."
mkdir -p "$BACKUP_DIR"
if [ -d "$DATA_DIR" ] && [ -s "$DATA_DIR/academy.json" ]; then
    EMERGENCY_SNAP="$BACKUP_DIR/emergency-pre-restore-$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$EMERGENCY_SNAP" -C "$APP_DIR" data/
    if ! tar -tzf "$EMERGENCY_SNAP" | grep -qx "data/academy.json"; then
        echo "❌ Gagal memverifikasi snapshot darurat sebelum restore! Operasi dibatalkan demi keamanan data."
        exit 1
    fi
    echo "   Snapshot darurat tersimpan & terverifikasi di: $EMERGENCY_SNAP"
fi

# 4. Stop hanya proses PM2 casper-web dan lakukan pertukaran dengan rollback otomatis jika gagal
echo "🔄 [4/5] Menghentikan sementara casper-web & mengganti database secara atomik..."
pm2 stop casper-web 2>/dev/null || true

ROLLBACK_DIR="$APP_DIR/.data-rollback-$$"
rm -rf "$ROLLBACK_DIR" 2>/dev/null || true

if [ -d "$DATA_DIR" ]; then
    mv "$DATA_DIR" "$ROLLBACK_DIR"
fi

if mv "$STAGING_DIR/data" "$DATA_DIR"; then
    chmod 700 "$DATA_DIR"
    chmod 600 "$DATA_DIR/academy.json"
    # Verifikasi ulang database aktif setelah dipindahkan
    if node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if(!Array.isArray(d.users)||d.users.length===0) process.exit(1);' "$DATA_DIR/academy.json"; then
        rm -rf "$ROLLBACK_DIR" 2>/dev/null || true
        echo "✅ Berhasil memulihkan dan memverifikasi direktori data/."
    else
        echo "❌ Validasi pasca-restore gagal! Mengembalikan database sebelumnya..."
        rm -rf "$DATA_DIR" 2>/dev/null || true
        if [ -d "$ROLLBACK_DIR" ]; then
            mv "$ROLLBACK_DIR" "$DATA_DIR"
        fi
        pm2 restart casper-web --update-env
        exit 1
    fi
else
    echo "❌ Gagal memindahkan direktori staging! Mengembalikan database sebelumnya..."
    if [ -d "$ROLLBACK_DIR" ]; then
        mv "$ROLLBACK_DIR" "$DATA_DIR"
    fi
    pm2 restart casper-web --update-env
    exit 1
fi

# 5. Restart hanya PM2 casper-web
echo "🚀 [5/5] Menghidupkan kembali khusus PM2 casper-web..."
pm2 restart casper-web --update-env
pm2 status casper-web
