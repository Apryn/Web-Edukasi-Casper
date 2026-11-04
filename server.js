const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  if (!dev) {
    const jwtSecret = (process.env.JWT_SECRET || "").trim();
    if (
      !jwtSecret ||
      jwtSecret.length < 32 ||
      jwtSecret === "casper-academy-secret-2026-production-v1" ||
      jwtSecret === "casper-academy-dev-only-secret-local"
    ) {
      console.error(
        "[CRITICAL SECURITY] Server menolak berjalan di production: JWT_SECRET wajib diset di .env.production (minimal 32 karakter) dan dilarang menggunakan fallback secret."
      );
      process.exit(1);
    }

    if (process.env.COOKIE_SECURE === "false") {
      console.warn(
        "[SECURITY WARNING] COOKIE_SECURE=false aktif (konfigurasi sementara khusus pengujian HTTP). Konfigurasi ini TIDAK AMAN untuk pengguna publik/sungguhan. Segera aktifkan HTTPS dan ubah ke COOKIE_SECURE=true."
      );
    }
  }

  createServer(async (req, res) => {
    try {
      // Harden client IP resolution against header spoofing:
      // Always strip any external x-casper-direct-ip sent by a client.
      delete req.headers["x-casper-direct-ip"];
      const remoteAddr = req.socket && req.socket.remoteAddress ? String(req.socket.remoteAddress) : "";
      const isLoopbackProxy =
        remoteAddr === "127.0.0.1" ||
        remoteAddr === "::1" ||
        remoteAddr === "::ffff:127.0.0.1";
      // If connection does NOT originate from local Nginx reverse proxy, bind directly to TCP socket IP
      // so client-supplied X-Forwarded-For / X-Real-IP headers cannot spoof the IP.
      if (remoteAddr && !isLoopbackProxy) {
        req.headers["x-casper-direct-ip"] = remoteAddr;
      }

      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Signal Casper Web running on http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error("Failed to start Next.js server:", err);
  process.exit(1);
});
