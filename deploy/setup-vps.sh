#!/usr/bin/env bash
# =============================================================
#   SIGNAL CASPER - SETUP PERTAMA KALI DI VPS HOSTINGER
#   Target: 187.77.156.219
#   Usage di VPS: bash deploy/setup-vps.sh
# =============================================================

set -e

APP_DIR="/var/www/casper-web"
APP_PORT=3005
REPO_URL="https://github.com/Apryn/Web-Edukasi-Casper.git"

echo "=================================================="
echo "    🚀 SETUP SIGNAL CASPER WEB LANDING PAGE"
echo "=================================================="

# 1. Update & dependencies
echo ""
echo "▶ [1/6] Memeriksa Node.js & Git..."
if ! command -v git &> /dev/null; then
    sudo apt update && sudo apt install -y git
fi

if ! command -v node &> /dev/null; then
    echo "  Menginstall Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Pastikan PM2 terpasang
if ! command -v pm2 &> /dev/null; then
    echo "  Menginstall PM2..."
    sudo npm install -g pm2
fi

# 2. Buat direktori app jika belum ada
echo ""
echo "▶ [2/6] Mempersiapkan direktori aplikasi di $APP_DIR..."
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www

if [ ! -d "$APP_DIR/.git" ]; then
    echo "  Clone repository..."
    if [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
        echo "❌ Direktori $APP_DIR sudah ada dan tidak kosong namun bukan repositori Git. Hentikan untuk mencegah kehilangan data."
        exit 1
    fi
    git clone "$REPO_URL" "$APP_DIR"
else
    echo "  Direktori sudah ada, memeriksa kebersihan working tree..."
    cd "$APP_DIR"
    if [ -n "$(git status --porcelain)" ]; then
        echo "❌ Working tree di $APP_DIR memiliki perubahan lokal. Hentikan setup otomatis."
        git status -s
        exit 1
    fi
    git fetch origin main
    git merge --ff-only origin/main
fi

cd "$APP_DIR"

# 3. Install packages & build
echo ""
echo "▶ [3/6] Install dependensi & Build Next.js..."
npm install
npm run build

# 4. Setup PM2 (khusus casper-web, tanpa membuat proses baru secara otomatis jika belum dikonfigurasi)
echo ""
echo "▶ [4/6] Memeriksa proses PM2 casper-web (single-instance)..."
if pm2 describe casper-web >/dev/null 2>&1; then
    pm2 restart casper-web --update-env
    pm2 save
else
    echo "  ⚠️ Proses PM2 'casper-web' belum terdaftar. Menolak membuat proses PM2 baru secara otomatis."
    echo "  Jalankan secara manual setelah pemeriksaan: pm2 start ecosystem.config.cjs --only casper-web && pm2 save"
fi

# 5. Buka firewall port jika UFW aktif
echo ""
echo "▶ [5/6] Membuka port 83 di firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 83/tcp || true
fi

# 6. Pemeriksaan Read-Only Konfigurasi Nginx & HSTS (tidak mengubah Nginx/HSTS secara otomatis)
echo ""
echo "▶ [6/6] Memeriksa konfigurasi Nginx & HSTS secara read-only (tanpa modifikasi otomatis)..."
echo "  Memeriksa sumber header Strict-Transport-Security (HSTS) di /etc/nginx/:"
grep -rn "Strict-Transport-Security" /etc/nginx/ 2>/dev/null || echo "  (Tidak ditemukan directive Strict-Transport-Security eksplisit di /etc/nginx/)"

if [ -f /etc/nginx/sites-available/casper-web ]; then
    echo "  ℹ️ File /etc/nginx/sites-available/casper-web sudah ada (tidak diubah secara otomatis)."
else
    echo "  ℹ️ File /etc/nginx/sites-available/casper-web belum ada. Silakan buat secara manual setelah meninjau konfigurasi."
fi

echo ""
echo "=================================================="
echo "    ✅ SETUP SELESAI!"
echo "=================================================="
echo "  Web Casper sudah aktif!"
echo "  Bisa langsung dibuka di browser lewat IP:"
echo "  👉 http://187.77.156.219:83"
echo ""
echo "  (Nanti saat sudah ada domain, cukup arahkan domain ke Nginx & pasang SSL certbot)"
echo "=================================================="
