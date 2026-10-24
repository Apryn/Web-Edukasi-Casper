# Panduan Deployment Signal Casper

Panduan ini disiapkan khusus untuk server VPS Hostinger Anda (`187.77.156.219`).

---

## 💡 Bagaimana Cara Kerjanya Tanpa Domain?

Jika domain belum ada atau disiapkan nanti:
1. Web Next.js berjalan di background server menggunakan **PM2** di port `3000`.
2. Anda dan tim bisa langsung membuka web lewat IP server:
   ```
   http://187.77.156.219:3000
   ```
3. Port 80 dan 443 tetap aman digunakan untuk `motodoct.com` tanpa saling bentrok.

---

## 🚀 Cara Pasang Pertama Kali ke Server

### Langkah 1: Buat Repo di GitHub (sekali saja)
1. Buat repository baru di GitHub akun Anda (misal `Web-Casper-Signal`).
2. Di terminal PC lokal (di folder ini), jalankan:
   ```powershell
   git init
   git add .
   git commit -m "feat: initial commit web casper signal"
   git branch -M main
   git remote add origin https://github.com/Apryn/Web-Edukasi-Casper.git
   git push -u origin main
   ```

### Langkah 2: Setup di VPS (sekali saja)
Login ke VPS via terminal / SSH:
```bash
ssh root@187.77.156.219
```
Jalankan perintah ini:
```bash
git clone https://github.com/Apryn/Web-Edukasi-Casper.git /var/www/casper-web
cd /var/www/casper-web
bash deploy/setup-vps.sh
```
Web langsung live di `http://187.77.156.219:3000`.

---

## ⚡ Update Web Setelah Ada Perubahan Kode

Kapan saja Anda mengedit web di PC lokal:
Cukup jalankan satu perintah ini dari terminal Windows:
```powershell
.\deploy.ps1
```
Script akan otomatis:
1. Melakukan commit & push perubahan ke GitHub.
2. Menghubungi VPS `187.77.156.219`.
3. Menjalankan `git pull`, `npm run build`, dan reload PM2.

---

## 🌐 Nanti Jika Ingin Menambahkan Domain

Jika nanti Anda sudah punya domain (misal `casper.motodoct.com` atau `signalcasper.com`):
1. Arahkan **A Record** domain tersebut di DNS ke IP: `187.77.156.219`.
2. Edit file `/etc/nginx/sites-available/casper-web` di VPS:
   ```nginx
   server {
       listen 80;
       server_name domainanda.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
3. Aktifkan dan pasang SSL gratis:
   ```bash
   sudo ln -s /etc/nginx/sites-available/casper-web /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d domainanda.com
   ```
Web langsung bisa diakses lewat `https://domainanda.com`!
