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
    if [ -d "$APP_DIR" ]; then
        rm -rf "$APP_DIR"
    fi
    git clone "$REPO_URL" "$APP_DIR"
else
    echo "  Direktori sudah ada, pull terbaru..."
    cd "$APP_DIR"
    git pull origin main || git pull origin master
fi

cd "$APP_DIR"

# 3. Install packages & build
echo ""
echo "▶ [3/6] Install dependensi & Build Next.js..."
npm install
npm run build

# 4. Setup PM2
echo ""
echo "▶ [4/6] Menjalankan dengan PM2..."
pm2 delete casper-web 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

# 5. Buka firewall port jika UFW aktif
echo ""
echo "▶ [5/6] Membuka port 83 di firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 83/tcp || true
fi

# 6. Konfigurasi Nginx di Port 83
echo ""
echo "▶ [6/6] Menyiapkan konfigurasi Nginx di port 83..."
sudo tee /etc/nginx/sites-available/casper-web > /dev/null << 'EOF'
server {
    listen 83;
    server_name _;

    # Blokir akses langsung ke file database, git, dan environment
    location ~ ^/(data|\.git|\.env|data-backups) {
        deny all;
        return 404;
    }

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/casper-web /etc/nginx/sites-enabled/casper-web
sudo nginx -t && sudo systemctl reload nginx

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
