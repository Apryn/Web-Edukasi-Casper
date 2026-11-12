#!/usr/bin/env bash
# =============================================================
#   SIGNAL CASPER - UPDATE APP DI VPS (SAFE DEPLOYMENT)
#   Kompatibel dijalankan dari commit 515ce00 maupun terbaru:
#     cp /var/www/casper-web/deploy/update.sh /tmp/casper-safe-update.sh
#     bash /tmp/casper-safe-update.sh
#   Atau langsung:
#     bash /var/www/casper-web/deploy/update.sh
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
    echo "   Menolak membuat proses PM2 baru secara otomatis dan tidak menyentuh proses PM2 lain."
    echo "   Periksa 'pm2 status' secara manual terlebih dahulu."
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
  const cookieLine = lines.find((l) => l.startsWith("COOKIE_SECURE="));
  const cookieVal = cookieLine ? cookieLine.slice("COOKIE_SECURE=".length).trim() : "true";
  console.log("   .env.production & PM2 casper-web tervalidasi (panjang JWT_SECRET:", secret.length, "karakter).");
  if (cookieVal === "false") {
    console.warn("   ⚠️ [PERINGATAN KEAMANAN] COOKIE_SECURE=false aktif di .env.production!");
    console.warn("      Konfigurasi ini HANYA untuk pengujian sementara melalui HTTP dan TIDAK AMAN untuk pengguna publik.");
    console.warn("      Jangan gunakan untuk pengguna sungguhan. Segera aktifkan HTTPS dan ubah ke COOKIE_SECURE=true.");
  }
' "$APP_DIR/.env.production"

# 2. Validasi struktural database production & prosedur migrasi aman (tanpa menimpa otomatis)
echo "▶ [2/9] Memeriksa struktur database production ($DB_FILE) & izin akses..."
if [ ! -d "$DATA_DIR" ] || [ ! -f "$DB_FILE" ] || [ ! -s "$DB_FILE" ]; then
    echo "❌ [STATUS DB: KOSONG / BELUM ADA] File $DB_FILE tidak ditemukan atau berukuran 0 byte!"
    echo "   Sistem menolak membuat atau menimpa database produksi secara otomatis."
    echo "   Instruksi pemeriksaan & migrasi manual:"
    echo "   1. Periksa isi direktori: ls -la $DATA_DIR"
    echo "   2. Salin database seed yang sudah terverifikasi ke $DB_FILE (chmod 600 $DB_FILE)"
    echo "   3. Jalankan ulang skrip ini setelah database terverifikasi."
    exit 1
fi
chmod 700 "$DATA_DIR"
chmod 600 "$DB_FILE"

node -e '
  const fs = require("fs");
  const dbPath = process.argv[1];
  let db;
  try {
    db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    console.error("❌ [STATUS DB: KORUP / JSON TIDAK VALID] File database tidak dapat diparse sebagai JSON!");
    console.error("   Sistem menolak menimpa database yang ada. Periksa secara manual atau gunakan deploy/restore-db.sh.");
    process.exit(1);
  }

  const printManualInstructions = (reason) => {
    console.error("❌ [STATUS DB: DATA BERBEDA / TIDAK SESUAI EKSPEKTASI] " + reason);
    console.error("   Sistem TIDAK menimpa database yang sudah ada demi melindungi data di VPS.");
    if (db && Array.isArray(db.users)) {
      const safeSummary = db.users.map((u) => ({
        id: u && u.id,
        email: u && u.email,
        role: u && u.role,
        hasValidBcryptPrefix: Boolean(u && typeof u.password_hash === "string" && u.password_hash.startsWith("$2b$") && u.password_hash.length === 60),
      }));
      console.error("   Ringkasan struktural saat ini (tanpa password_hash):", JSON.stringify({
        userCount: db.users.length,
        progressCount: Array.isArray(db.course_progress) ? db.course_progress.length : "invalid",
        quizSubmissionCount: Array.isArray(db.quiz_submissions) ? db.quiz_submissions.length : "invalid",
        users: safeSummary,
      }));
    }
    console.error("   Instruksi pemeriksaan manual (tanpa menampilkan password_hash / JWT_SECRET):");
    console.error("   node -e '\''const d=JSON.parse(require(\"fs\").readFileSync(\"/var/www/casper-web/data/academy.json\",\"utf8\")); console.log({users:d.users.map(u=>({id:u.id,email:u.email,role:u.role})),progress:d.course_progress});'\''");
    process.exit(1);
  };

  if (!Array.isArray(db.users) || !Array.isArray(db.course_progress) || !Array.isArray(db.quiz_submissions)) {
    printManualInstructions("Skema dasar JSON (users / course_progress / quiz_submissions) tidak lengkap.");
  }

  if (db.users.length === 0) {
    console.error("❌ [STATUS DB: KOSONG] Database memiliki struktur JSON tetapi users.length === 0!");
    console.error("   Sistem menolak menimpa otomatis. Silakan migrasi data akun admin secara manual terlebih dahulu.");
    process.exit(1);
  }

  const hasTestAccount = db.users.some(
    (u) => u && typeof u.email === "string" && (u.email.endsWith(".test") || u.email === "traderpro@signalcasper.test")
  );
  if (hasTestAccount) {
    printManualInstructions("Ditemukan akun pengujian (.test) di database production.");
  }

  const adminUser = db.users.find(
    (u) =>
      u &&
      u.email === "apriyanriyan23@gmail.com" &&
      u.role === "ADMIN" &&
      typeof u.password_hash === "string" &&
      u.password_hash.startsWith("$2b$") &&
      u.password_hash.length === 60
  );
  if (!adminUser) {
    printManualInstructions("Akun ADMIN utama (apriyanriyan23@gmail.com, role: ADMIN) tidak ditemukan atau tidak sesuai.");
  }

  const adminProg = db.course_progress.find(
    (p) => p && p.user_id === adminUser.id && p.course_slug === "trading-fundamentals"
  );
  if (!adminProg) {
    printManualInstructions("Progres belajar akun ADMIN pada kelas trading-fundamentals tidak ditemukan.");
  }

  const parseField = (val) => (typeof val === "string" ? JSON.parse(val) : val);
  let completedIds;
  let quizScores;
  try {
    completedIds = parseField(adminProg.completed_lesson_ids);
    quizScores = parseField(adminProg.quiz_scores);
  } catch {
    printManualInstructions("Field completed_lesson_ids atau quiz_scores pada progres ADMIN bukan JSON valid.");
  }

  if (!Array.isArray(completedIds) || completedIds.length === 0) {
    printManualInstructions("Isi progres belajar ADMIN tidak valid.");
  }

  console.log(
    "   [STATUS DB: VALID] Database berisi admin & progres yang benar -> Users:",
    db.users.length,
    "| Admin: " + adminUser.email + " (ADMIN) | CompletedLessons:",
    completedIds.length,
    "| Progress:",
    db.course_progress.length
  );
' "$DB_FILE"

# 3. Buat backup database sebelum perubahan kode
echo "▶ [3/9] Membuat backup database sebelum perubahan kode..."
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/casper-db-preupdate-$TIMESTAMP.tar.gz"
tar -czf "$BACKUP_FILE" -C "$APP_DIR" data
chmod 600 "$BACKUP_FILE"

# 4. Verifikasi isi arsip backup sebelum perubahan kode dilakukan
echo "▶ [4/9] Memverifikasi isi arsip backup ($BACKUP_FILE)..."
TAR_ENTRY=$(tar -tzf "$BACKUP_FILE" 2>/dev/null | grep -E '(^|\./)data/academy\.json$' | head -n 1 || true)
if [ ! -s "$BACKUP_FILE" ] || [ -z "$TAR_ENTRY" ]; then
    echo "❌ Arsip backup gagal diverifikasi (data/academy.json tidak ditemukan di dalam arsip)!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

tar -xzOf "$BACKUP_FILE" "$TAR_ENTRY" | node -e '
  const fs = require("fs");
  const srcDb = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const bakDb = JSON.parse(fs.readFileSync(0, "utf8"));
  const bakAdmin = Array.isArray(bakDb.users) && bakDb.users.find((u) => u && u.email === "apriyanriyan23@gmail.com" && u.role === "ADMIN");
  if (
    !bakAdmin ||
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

# 5. Catat dan validasi PREV_COMMIT sebelum proses merge
echo "▶ [5/9] Mencatat & memvalidasi commit aktif (PREV_COMMIT) sebelum merge..."
PREV_COMMIT=$(git rev-parse --verify --short HEAD 2>/dev/null || true)
if [ -z "$PREV_COMMIT" ] || ! git cat-file -e "${PREV_COMMIT}^{commit}" 2>/dev/null; then
    echo "❌ PREV_COMMIT tidak valid ($PREV_COMMIT)! Update dibatalkan sebelum merge."
    exit 1
fi
echo "   Commit aktif tervalidasi: $PREV_COMMIT"

# 6. Pastikan working tree bersih sebelum menarik kode baru
# Kompatibel dengan kondisi commit VPS 515ce00:
# Pada 515ce00, data/academy.json, data/backups/, dan data-backups/ belum masuk .gitignore.
# Gunakan -uall agar pemeriksaan melihat setiap file satu per satu dan hanya mengecualikan file data/backup yang aman.
echo "▶ [6/9] Memeriksa kebersihan working tree Git (kompatibel commit 515ce00)..."
if ! git ls-files --error-unmatch data/.gitkeep >/dev/null 2>&1 && [ -e "$DATA_DIR/.gitkeep" ]; then
    echo "❌ Ditemukan file untracked data/.gitkeep sebelum merge yang dapat memicu konflik merge! Hapus terlebih dahulu."
    exit 1
fi

DIRTY_STATUS=$(git status --porcelain -uall | grep -Ev '^\?\? (data/academy\.json|data/academy\.db(\.|-journal)?|data/backups/|data-backups/)' || true)
if [ -n "$DIRTY_STATUS" ]; then
    echo "❌ PERINGATAN: Working tree di VPS memiliki perubahan kode yang tidak aman! Proses dihentikan."
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
NEW_COMMIT=$(git rev-parse --verify --short HEAD)
echo "   Commit aktif setelah update: $NEW_COMMIT"

# 8. Install dependency dan build production (dengan rollback kode otomatis jika gagal, tanpa menyentuh DB)
echo "▶ [8/9] Menginstal dependensi & menjalankan build production..."
rollback_code_only() {
    echo "⚠️ Build atau instalasi dependensi gagal! Mengembalikan HANYA kode Git ke commit sebelumnya ($PREV_COMMIT)..."
    if git cat-file -e "${PREV_COMMIT}^{commit}" 2>/dev/null; then
        git reset --hard "$PREV_COMMIT"
    else
        echo "❌ PREV_COMMIT ($PREV_COMMIT) tidak valid saat rollback!"
    fi

    if [ -d "$DATA_DIR" ] && [ -s "$DB_FILE" ] && [ -d "$BACKUP_DIR" ] && [ -s "$BACKUP_FILE" ] && [ -f "$APP_DIR/.env.production" ]; then
        echo "   ✅ Integritas terjamin: data/, data-backups/, dan .env.production dipastikan tetap utuh."
    else
        echo "   ⚠️ Peringatan: Memeriksa kelengkapan data/, data-backups/, atau .env.production pasca-rollback!"
    fi

    if pm2 describe casper-web >/dev/null 2>&1; then
        echo "   ✅ Proses PM2 'casper-web' tetap berjalan (tidak dihentikan/direstart karena build gagal)."
        pm2 status casper-web
    fi
    echo "❌ Update dibatalkan."
    exit 1
}

if ! npm install --no-audit; then
    echo "⚠️ npm install gagal, membersihkan cache npm dan mencoba ulang..."
    npm cache clean --force || true
    npm install --no-audit || rollback_code_only
fi
rm -rf .next
npm run build || rollback_code_only
git checkout -- package-lock.json next-env.d.ts 2>/dev/null || true

# Pastikan file penting tetap utuh setelah build
if [ ! -d "$DATA_DIR" ] || [ ! -s "$DB_FILE" ] || [ ! -d "$BACKUP_DIR" ] || [ ! -s "$BACKUP_FILE" ] || [ ! -f "$APP_DIR/.env.production" ]; then
    echo "❌ Pemeriksaan integritas pasca-build gagal: data/, data-backups/, atau .env.production hilang!"
    exit 1
fi

# 9. Restart hanya casper-web setelah build berhasil (tanpa menyentuh proses PM2 lain)
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
