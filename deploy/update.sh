#!/usr/bin/env bash
# =============================================================
#   SIGNAL CASPER - UPDATE APP DI VPS (SAFE DEPLOYMENT)
#   Usage di VPS: bash /var/www/casper-web/deploy/update.sh
# =============================================================

set -euo pipefail
umask 077

APP_DIR="/var/www/casper-web"
DATA_DIR="$APP_DIR/data"
DB_FILE="$DATA_DIR/academy.json"
BACKUP_DIR="$APP_DIR/data-backups"

echo "=================================================="
echo "    🔄 SIGNAL CASPER — SAFE UPDATE APP"
echo "=================================================="

# 1. Validasi direktori, proses PM2 casper-web, dan .env.production
echo "▶ [1/9] Memvalidasi direktori, proses PM2 casper-web, & .env.production..."
if [ ! -d "$APP_DIR/.git" ]; then
    echo "❌ Direktori git $APP_DIR tidak ditemukan! Update dibatalkan."
    exit 1
fi

cd "$APP_DIR"

if ! pm2 describe casper-web >/dev/null 2>&1; then
    echo "❌ Proses PM2 'casper-web' tidak ditemukan/terdaftar di PM2!"
    echo "   Menolak membuat proses PM2 baru secara otomatis. Periksa 'pm2 status' terlebih dahulu."
    exit 1
fi

if [ ! -f "$APP_DIR/.env.production" ]; then
    echo "❌ File $APP_DIR/.env.production tidak ditemukan! Update dibatalkan."
    exit 1
fi
chmod 600 "$APP_DIR/.env.production"

node -e '
  const fs = require("fs");
  const lines = fs.readFileSync(process.argv[1], "utf8").split(/\r?\n/);
  const jwtLine = lines.find((l) => l.startsWith("JWT_SECRET="));
  const secret = jwtLine ? jwtLine.slice("JWT_SECRET=".length).trim() : "";
  if (
    !secret ||
    secret.length < 32 ||
    secret === "casper-academy-secret-2026-production-v1" ||
    secret === "casper-academy-dev-only-secret-local"
  ) {
    console.error("❌ JWT_SECRET di .env.production tidak valid, kurang dari 32 karakter, atau menggunakan fallback secret!");
    process.exit(1);
  }
  console.log("   .env.production & PM2 casper-web tervalidasi (panjang JWT_SECRET:", secret.length, "karakter).");
' "$APP_DIR/.env.production"

# 2. Validasi database production & izin akses direktori
echo "▶ [2/9] Memvalidasi database production ($DB_FILE) & permission..."
if [ ! -d "$DATA_DIR" ] || [ ! -s "$DB_FILE" ]; then
    echo "❌ Database $DB_FILE tidak ditemukan atau kosong! Update dibatalkan."
    exit 1
fi
chmod 700 "$DATA_DIR"
chmod 600 "$DB_FILE"

node -e '
  const fs = require("fs");
  const db = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!Array.isArray(db.users) || !Array.isArray(db.course_progress) || !Array.isArray(db.quiz_submissions)) {
    console.error("❌ Skema database JSON tidak valid!");
    process.exit(1);
  }
  if (db.users.length === 0) {
    console.error("❌ Database tidak memiliki pengguna (users: 0)! Update dibatalkan.");
    process.exit(1);
  }
  const hasTestAccount = db.users.some((u) => u && typeof u.email === "string" && (u.email.endsWith(".test") || u.email === "traderpro@signalcasper.test"));
  if (hasTestAccount) {
    console.error("❌ Ditemukan akun pengujian (.test) di database production! Bersihkan terlebih dahulu sebelum update.");
    process.exit(1);
  }
  const adminUser = db.users.find((u) => u && u.email === "apryn@casper.com" && u.role === "ADMIN" && typeof u.password_hash === "string" && u.password_hash.startsWith("$2b$"));
  if (!adminUser) {
    console.error("❌ Akun ADMIN utama (apryn@casper.com) tidak ditemukan atau tidak valid! Update dibatalkan.");
    process.exit(1);
  }
  const adminProg = db.course_progress.find((p) => p && p.user_id === adminUser.id && p.course_slug === "trading-fundamentals");
  if (!adminProg) {
    console.error("❌ Progres belajar akun ADMIN (trading-fundamentals) tidak ditemukan! Update dibatalkan.");
    process.exit(1);
  }
  const parseField = (val) => (typeof val === "string" ? JSON.parse(val) : val);
  const completedIds = parseField(adminProg.completed_lesson_ids);
  const quizScores = parseField(adminProg.quiz_scores);
  if (!Array.isArray(completedIds) || !quizScores || typeof quizScores !== "object" || Array.isArray(quizScores)) {
    console.error("❌ Format completed_lesson_ids atau quiz_scores pada progres ADMIN tidak valid!");
    process.exit(1);
  }
  console.log("   Database production valid -> Users:", db.users.length, "| Admin: apryn@casper.com (ADMIN) | CompletedLessons:", completedIds.length, "| Progress:", db.course_progress.length);
' "$DB_FILE"

# 3. Buat backup database sebelum perubahan kode
echo "▶ [3/9] Membuat backup database sebelum perubahan kode..."
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/casper-db-preupdate-$TIMESTAMP.tar.gz"
tar -czf "$BACKUP_FILE" -C "$APP_DIR" data/
chmod 600 "$BACKUP_FILE"

# 4. Verifikasi isi arsip backup
echo "▶ [4/9] Memverifikasi isi arsip backup ($BACKUP_FILE)..."
if [ ! -s "$BACKUP_FILE" ] || ! tar -tzf "$BACKUP_FILE" | grep -qx "data/academy.json"; then
    echo "❌ Arsip backup gagal diverifikasi (data/academy.json tidak ditemukan di dalam arsip)!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

tar -xzOf "$BACKUP_FILE" data/academy.json | node -e '
  const fs = require("fs");
  const srcDb = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const bakDb = JSON.parse(fs.readFileSync(0, "utf8"));
  if (
    !Array.isArray(bakDb.users) ||
    bakDb.users.length !== srcDb.users.length ||
    bakDb.course_progress.length !== srcDb.course_progress.length ||
    bakDb.quiz_submissions.length !== srcDb.quiz_submissions.length
  ) {
    console.error("❌ Isi arsip backup tidak cocok dengan database sumber!");
    process.exit(1);
  }
  console.log("   Isi arsip terverifikasi identik -> Users:", bakDb.users.length, "| Progress:", bakDb.course_progress.length);
' "$DB_FILE"
ls -lh "$BACKUP_FILE"

# 5. Catat commit aktif
echo "▶ [5/9] Mencatat commit aktif sebelum update..."
PREV_COMMIT=$(git rev-parse --short HEAD)
echo "   Commit aktif saat ini: $PREV_COMMIT"

# 6. Pastikan working tree bersih sebelum menarik kode baru
# Catatan kompatibilitas commit 515ce00: pada 515ce00, data/academy.json dan data-backups/ belum ada di .gitignore,
# sehingga kita kecualikan untracked '?? data/' dan '?? data-backups/' agar tidak memicu false-positive sebelum merge.
echo "▶ [6/9] Memeriksa kebersihan working tree Git..."
DIRTY_STATUS=$(git status --porcelain | grep -Ev '^\?\? (data/|data-backups/)' || true)
if [ -n "$DIRTY_STATUS" ]; then
    echo "❌ PERINGATAN: Working tree di VPS tidak bersih! Proses dihentikan agar tidak ada perubahan lokal yang hilang."
    echo "Temuan file yang berubah / tidak terlacak:"
    echo "$DIRTY_STATUS"
    echo "Silakan periksa perubahan di atas sebelum menjalankan update."
    exit 1
fi
echo "   Working tree bersih."

# 7. Lakukan git fetch & update kode secara aman (fast-forward only)
echo "▶ [7/9] Mengambil pembaruan dari Git (fast-forward safe merge)..."
git fetch origin main
if ! git merge --ff-only origin/main; then
    echo "❌ Gagal melakukan fast-forward merge dari origin/main! Riwayat cabang lokal berbeda dengan remote."
    echo "Proses dihentikan tanpa mengubah file kerja maupun proses PM2."
    exit 1
fi
NEW_COMMIT=$(git rev-parse --short HEAD)
echo "   Commit aktif setelah update: $NEW_COMMIT"

# 8. Install dependency dan build production (dengan rollback kode otomatis jika gagal, tanpa menyentuh DB)
echo "▶ [8/9] Menginstal dependensi & menjalankan build production..."
rollback_code_only() {
    echo "⚠️ Build atau instalasi dependensi gagal! Mengembalikan kode Git ke commit sebelumnya ($PREV_COMMIT) tanpa mengubah database..."
    git reset --hard "$PREV_COMMIT"
    if [ -s "$DB_FILE" ] && [ -f "$APP_DIR/.env.production" ]; then
        echo "   Database ($DB_FILE) dan .env.production dipastikan tetap utuh."
    fi
    echo "❌ Update dibatalkan. Proses PM2 casper-web lama tidak dihentikan."
    exit 1
}

npm install --prefer-offline --no-audit || rollback_code_only
npm run build || rollback_code_only

# Pastikan file penting tetap utuh setelah build
if [ ! -s "$DB_FILE" ] || [ ! -f "$APP_DIR/.env.production" ]; then
    echo "❌ Pemeriksaan integritas pasca-build gagal: database atau .env.production hilang!"
    exit 1
fi

# 9. Restart hanya casper-web setelah build berhasil
echo "▶ [9/9] Merestart khusus proses PM2 casper-web (single-instance)..."
pm2 restart casper-web --update-env
pm2 save

echo ""
echo "=================================================="
echo "    ✅ UPDATE SELESAI & SUDAH AKTIF!"
echo "    Backup DB : $BACKUP_FILE"
echo "    Commit    : $PREV_COMMIT -> $NEW_COMMIT"
echo "    Rollback Kode (Tanpa Ubah DB): git reset --hard $PREV_COMMIT && npm run build && pm2 restart casper-web --update-env"
echo "=================================================="
pm2 status casper-web
