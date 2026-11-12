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

# Periksa kelayakan database aktif di VPS
DB_STATUS="NEEDS_SEED"
if [ -f "$DB_FILE" ] && [ -s "$DB_FILE" ]; then
    DB_STATUS=$(node -e '
      const fs = require("fs");
      try {
        const db = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        if (!Array.isArray(db.users) || !Array.isArray(db.course_progress) || !Array.isArray(db.quiz_submissions)) {
          console.log("INVALID_SCHEMA"); process.exit(0);
        }
        const hasTest = db.users.some(u => u && typeof u.email === "string" && (u.email.endsWith(".test") || u.email.includes("test") || u.email === "traderpro@signalcasper.test"));
        if (hasTest) {
          console.log("HAS_TEST_ACCOUNT"); process.exit(0);
        }
        const admin = db.users.find(u => u && u.email === "apriyanriyan23@gmail.com" && u.role === "ADMIN");
        if (!admin) {
          console.log("NO_VALID_ADMIN"); process.exit(0);
        }
        const prog = db.course_progress.find(p => p && p.user_id === admin.id && p.course_slug === "trading-fundamentals");
        if (!prog) {
          console.log("NO_ADMIN_PROGRESS"); process.exit(0);
        }
        console.log("VALID");
      } catch (err) {
        console.log("CORRUPT");
      }
    ' "$DB_FILE" 2>/dev/null || echo "CHECK_FAILED")
fi

echo "   Status database di VPS saat ini: $DB_STATUS"

if [ "$DB_STATUS" != "VALID" ]; then
    if [ -f "/tmp/academy.admin-seed.json" ]; then
        if [ -f "$DB_FILE" ] && [ -s "$DB_FILE" ]; then
            echo "▶ [2/5] Database lama di VPS tidak memenuhi standar produksi ($DB_STATUS)."
            echo "        Mengarsipkan file lama ke $BACKUP_DIR..."
            cp "$DB_FILE" "$BACKUP_DIR/academy.pre-seed-archive.$(date +%s).json"
        fi
        echo "▶ [2/5] Memasang database admin bersih dari local seed (chmod 600)..."
        cp /tmp/academy.admin-seed.json "$DB_FILE"
        chmod 600 "$DB_FILE"
    else
        echo "❌ Database VPS tidak valid ($DB_STATUS) dan /tmp/academy.admin-seed.json tidak tersedia!"
        exit 1
    fi
else
    echo "▶ [2/5] Database produksi di VPS valid & siap. Mempertahankan data pengguna."
fi
rm -f /tmp/academy.admin-seed.json

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
rm -f "$APP_DIR/public/SIGNAL_CASPER_ACADEMY_FITUR_LENGKAP.pdf" 2>/dev/null || true
git fetch origin main
git merge --ff-only origin/main

echo "▶ [5/5] Menjalankan update script resmi..."
bash "$APP_DIR/deploy/update.sh"
