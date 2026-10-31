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
        "[SECURITY NOTICE] COOKIE_SECURE=false aktif (mode akses HTTP sementara). Segera gunakan HTTPS dan hapus COOKIE_SECURE=false untuk keamanan penuh."
      );
    }
  }

  createServer(async (req, res) => {
    try {
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
