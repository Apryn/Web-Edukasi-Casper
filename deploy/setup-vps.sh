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

# 4. Setup PM2 (khusus casper-web)
echo ""
echo "▶ [4/6] Menjalankan casper-web dengan PM2 (single-instance)..."
pm2 restart casper-web --update-env 2>/dev/null || pm2 start ecosystem.config.cjs --only casper-web
pm2 save

# 5. Buka firewall port jika UFW aktif
echo ""
echo "▶ [5/6] Membuka port 83 di firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 83/tcp || true
fi

# 6. Konfigurasi Nginx di Port 83 (jangan menimpa konfigurasi yang sudah ada secara otomatis)
echo ""
echo "▶ [6/6] Memeriksa konfigurasi Nginx di port 83..."
echo "  Memeriksa sumber header Strict-Transport-Security (HSTS) di /etc/nginx/:"
grep -rn "Strict-Transport-Security" /etc/nginx/ 2>/dev/null || echo "  (Tidak ditemukan directive Strict-Transport-Security eksplisit di /etc/nginx/)"

if [ -f /etc/nginx/sites-available/casper-web ]; then
    echo "  ℹ️ File /etc/nginx/sites-available/casper-web sudah ada. Tidak menimpa secara otomatis demi keamanan virtual host."
    echo "  Isi konfigurasi saat ini:"
    cat /etc/nginx/sites-available/casper-web
else
    sudo tee /etc/nginx/sites-available/casper-web > /dev/null << 'EOF'
server {
    listen 83;
    server_name _;

    # Blokir akses langsung ke direktori/file database, backup, git, env, dan skrip internal
    location ~ ^/(data|data-backups|\.git|\.env|deploy|tests)(/|$) {
        deny all;
        return 404;
    }

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
    sudo ln -sf /etc/nginx/sites-available/casper-web /etc/nginx/sites-enabled/casper-web
    sudo nginx -t && sudo systemctl reload nginx
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
