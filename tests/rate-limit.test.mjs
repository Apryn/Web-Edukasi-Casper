import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire, registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

// Pre-load CJS dependencies before registering TS hook
const cjsRequire = createRequire(import.meta.url);
cjsRequire("jsonwebtoken");
cjsRequire("bcryptjs");

let tsHook = null;
if (typeof registerHooks === "function" && typeof stripTypeScriptTypes === "function") {
  tsHook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        !path.extname(specifier) &&
        context.parentURL
      ) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        const candidateTs = path.resolve(parentDir, `${specifier}.ts`);
        if (fs.existsSync(candidateTs)) {
          return nextResolve(`${specifier}.ts`, context);
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.endsWith(".ts")) {
        const source = fs.readFileSync(fileURLToPath(url), "utf8");
        return {
          format: "module",
          shortCircuit: true,
          source: stripTypeScriptTypes(source),
        };
      }
      return nextLoad(url, context);
    },
  });
}

const {
  findUserByEmail,
  createUser,
  isValidDatabaseSchema,
  getDatabase,
} = await import("../lib/db.ts");

const { hashPassword } = await import("../lib/auth.ts");

const {
  checkLoginRateLimit,
  getClientIpFromRequest,
  setRateLimitClockForTest,
  configureRateLimitStoreForTest,
  resetRateLimitAllForTest,
} = await import("../lib/rate-limit.ts");

const {
  processLoginRequest,
  processRegisterRequest,
} = await import("../lib/server-auth.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

function makeRequest(url, body, ipHeaders = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...ipHeaders,
    },
    body: JSON.stringify(body),
  });
}

describe("Signal Casper Academy - Sprint 2 Task 1: Authentication Rate Limiting Tests", () => {
  const dataDir = path.join(process.cwd(), "data");
  const dbFile = path.join(dataDir, "academy.json");
  const testRateLimitFile = path.join(dataDir, "rate-limits.test.json");
  const prodRateLimitFile = path.join(dataDir, "rate-limits.json");

  let pristineDbSnapshot = null;
  let fakeNow = 1_700_000_000_000;
  let testStudentEmail = "";
  const testStudentPassword = "SecurePassword123!";

  before(async () => {
    if (fs.existsSync(dbFile)) {
      pristineDbSnapshot = fs.readFileSync(dbFile, "utf8");
    }

    configureRateLimitStoreForTest({
      filePath: testRateLimitFile,
      resetMemory: true,
    });
    setRateLimitClockForTest(() => fakeNow);

    // Create a temporary test user for login verification (restored in `after`)
    testStudentEmail = `ratelimit_student_${Date.now()}@casper.com`;
    const passwordHash = await hashPassword(testStudentPassword);
    createUser({
      id: "rl-user-" + crypto.randomUUID(),
      email: testStudentEmail,
      name: "Rate Limit Test User",
      passwordHash,
      role: "USER",
    });
  });

  beforeEach(() => {
    fakeNow = 1_700_000_000_000;
    setRateLimitClockForTest(() => fakeNow);
    resetRateLimitAllForTest();
  });

  after(() => {
    setRateLimitClockForTest(null);
    resetRateLimitAllForTest();
    configureRateLimitStoreForTest({
      filePath: null,
      resetMemory: true,
    });

    if (fs.existsSync(testRateLimitFile)) {
      fs.unlinkSync(testRateLimitFile);
    }
    if (fs.existsSync(prodRateLimitFile)) {
      fs.unlinkSync(prodRateLimitFile);
    }
    if (pristineDbSnapshot) {
      fs.writeFileSync(dbFile, pristineDbSnapshot, "utf8");
    }
  });

  test("1. Login normal tetap berhasil", async () => {
    const req = makeRequest(
      "http://localhost:3000/api/auth/login",
      { email: testStudentEmail, password: testStudentPassword },
      { "x-real-ip": "203.0.113.10" }
    );

    const res = await processLoginRequest(req, {
      email: testStudentEmail,
      password: testStudentPassword,
    });

    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.ok(res.token, "Token JWT harus dikembalikan saat login normal berhasil");
    assert.equal(res.user.email, testStudentEmail);
    assert.equal("password_hash" in res.user, false);
  });

  test("2. Login gagal tercatat dan tidak membocorkan apakah email terdaftar atau tidak", async () => {
    const ip = "203.0.113.20";

    const reqWrongPass = makeRequest(
      "http://localhost:3000/api/auth/login",
      { email: testStudentEmail, password: "WrongPassword999" },
      { "x-real-ip": ip }
    );
    const res1 = await processLoginRequest(reqWrongPass, {
      email: testStudentEmail,
      password: "WrongPassword999",
    });

    assert.equal(res1.ok, false);
    assert.equal(res1.status, 401);
    assert.equal(res1.error, "Email atau kata sandi tidak sesuai.");

    const statusAfter1 = checkLoginRateLimit(ip);
    assert.equal(statusAfter1.count, 1, "Kegagalan pertama harus tercatat (count = 1)");
    assert.equal(statusAfter1.remaining, 4);

    const reqUnregistered = makeRequest(
      "http://localhost:3000/api/auth/login",
      { email: "tidak_terdaftar_999@casper.com", password: "WrongPassword999" },
      { "x-real-ip": ip }
    );
    const res2 = await processLoginRequest(reqUnregistered, {
      email: "tidak_terdaftar_999@casper.com",
      password: "WrongPassword999",
    });

    assert.equal(res2.ok, false);
    assert.equal(res2.status, 401);
    assert.equal(
      res2.error,
      res1.error,
      "Pesan error untuk email tidak terdaftar harus identik dengan password salah"
    );
    assert.equal(checkLoginRateLimit(ip).count, 2);
  });

  test("3. Lima kegagalan login diproses sesuai batas", async () => {
    const ip = "203.0.113.30";

    for (let attempt = 1; attempt <= 5; attempt++) {
      const req = makeRequest(
        "http://localhost:3000/api/auth/login",
        { email: testStudentEmail, password: `Wrong_${attempt}` },
        { "x-real-ip": ip }
      );
      const res = await processLoginRequest(req, {
        email: testStudentEmail,
        password: `Wrong_${attempt}`,
      });
      assert.equal(
        res.status,
        401,
        `Percobaan gagal ke-${attempt} harus diproses dengan status 401`
      );
    }

    const statusAfter5 = checkLoginRateLimit(ip);
    assert.equal(statusAfter5.count, 5);
    assert.equal(statusAfter5.remaining, 0);
    assert.equal(statusAfter5.allowed, false, "Setelah 5 kegagalan, status allowed harus false");
  });

  test("4. Percobaan login berikutnya (ke-6) menghasilkan HTTP 429 dan pulih setelah 15 menit (tanpa lockout permanen)", async () => {
    const ip = "203.0.113.31";

    for (let attempt = 1; attempt <= 5; attempt++) {
      const req = makeRequest(
        "http://localhost:3000/api/auth/login",
        { email: testStudentEmail, password: `Wrong_${attempt}` },
        { "x-real-ip": ip }
      );
      await processLoginRequest(req, {
        email: testStudentEmail,
        password: `Wrong_${attempt}`,
      });
    }

    const req6 = makeRequest(
      "http://localhost:3000/api/auth/login",
      { email: testStudentEmail, password: testStudentPassword },
      { "x-real-ip": ip }
    );
    const res6 = await processLoginRequest(req6, {
      email: testStudentEmail,
      password: testStudentPassword,
    });

    assert.equal(res6.ok, false);
    assert.equal(res6.status, 429, "Percobaan ke-6 harus menghasilkan HTTP 429 Too Many Requests");

    // Majukan fake clock melewati 15 menit (901 detik) -> blokir berakhir otomatis
    fakeNow += 15 * 60 * 1000 + 1000;
    const resAfterUnblock = await processLoginRequest(req6, {
      email: testStudentEmail,
      password: testStudentPassword,
    });
    assert.equal(resAfterUnblock.ok, true);
    assert.equal(resAfterUnblock.status, 200);
  });

  test("5. Header Retry-After tersedia dan akurat pada respons HTTP 429", async () => {
    const ip = "203.0.113.32";

    for (let attempt = 1; attempt <= 5; attempt++) {
      const req = makeRequest(
        "http://localhost:3000/api/auth/login",
        { email: testStudentEmail, password: "Wrong" },
        { "x-real-ip": ip }
      );
      await processLoginRequest(req, { email: testStudentEmail, password: "Wrong" });
    }

    const reqBlocked = makeRequest(
      "http://localhost:3000/api/auth/login",
      { email: testStudentEmail, password: testStudentPassword },
      { "x-real-ip": ip }
    );
    const resAtStart = await processLoginRequest(reqBlocked, {
      email: testStudentEmail,
      password: testStudentPassword,
    });
    assert.equal(resAtStart.status, 429);
    assert.ok(resAtStart.headers && resAtStart.headers["Retry-After"], "Header Retry-After wajib ada");
    assert.equal(resAtStart.headers["Retry-After"], "900");

    // Majukan fake clock 5 menit (300 detik) -> Retry-After harus turun menjadi 600
    fakeNow += 5 * 60 * 1000;
    const resAfter5Min = await processLoginRequest(reqBlocked, {
      email: testStudentEmail,
      password: testStudentPassword,
    });
    assert.equal(resAfter5Min.status, 429);
    assert.equal(resAfter5Min.headers["Retry-After"], "600");
  });

  test("6. Login berhasil mereset penghitung kegagalan yang relevan", async () => {
    const ip = "203.0.113.40";

    for (let i = 1; i <= 4; i++) {
      const reqFail = makeRequest(
        "http://localhost:3000/api/auth/login",
        { email: testStudentEmail, password: "SalahPassword" },
        { "x-real-ip": ip }
      );
      const resFail = await processLoginRequest(reqFail, {
        email: testStudentEmail,
        password: "SalahPassword",
      });
      assert.equal(resFail.status, 401);
    }

    assert.equal(checkLoginRateLimit(ip).count, 4);

    const reqSuccess = makeRequest(
      "http://localhost:3000/api/auth/login",
      { email: testStudentEmail, password: testStudentPassword },
      { "x-real-ip": ip }
    );
    const resSuccess = await processLoginRequest(reqSuccess, {
      email: testStudentEmail,
      password: testStudentPassword,
    });
    assert.equal(resSuccess.ok, true);
    assert.equal(resSuccess.status, 200);

    const afterSuccessStatus = checkLoginRateLimit(ip);
    assert.equal(afterSuccessStatus.count, 0, "Login berhasil wajib mereset penghitung kegagalan ke 0");
    assert.equal(afterSuccessStatus.remaining, 5);
  });

  test("7. Register normal tetap berhasil", async () => {
    const ip = "203.0.113.50";
    const payload = {
      name: "Trader Normal",
      email: `reg_normal_${Date.now()}@casper.com`,
      password: "PasswordAman123",
    };
    const req = makeRequest("http://localhost:3000/api/auth/register", payload, {
      "x-real-ip": ip,
    });
    const res = await processRegisterRequest(req, payload);

    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.ok(res.token);
    assert.equal(res.user.email, payload.email.toLowerCase());
    assert.equal(res.user.role, "USER");
  });

  test("8. Percobaan register berlebihan (> 5 dalam 15 menit per IP) menghasilkan HTTP 429 beserta Retry-After", async () => {
    const ip = "203.0.113.51";

    for (let i = 1; i <= 5; i++) {
      const payload = {
        name: `Trader Batch ${i}`,
        email: `reg_batch_${i}_${Date.now()}@casper.com`,
        password: "PasswordAman123",
      };
      const req = makeRequest("http://localhost:3000/api/auth/register", payload, {
        "x-real-ip": ip,
      });
      const res = await processRegisterRequest(req, payload);
      assert.equal(res.status, 200, `Pendaftaran ke-${i} harus diizinkan`);
    }

    const payload6 = {
      name: "Spammer 6",
      email: `reg_spammer_6_${Date.now()}@casper.com`,
      password: "PasswordAman123",
    };
    const req6 = makeRequest("http://localhost:3000/api/auth/register", payload6, {
      "x-real-ip": ip,
    });
    const res6 = await processRegisterRequest(req6, payload6);

    assert.equal(res6.ok, false);
    assert.equal(res6.status, 429, "Percobaan register ke-6 dalam 15 menit harus menghasilkan HTTP 429");
    assert.equal(res6.headers["Retry-After"], "900");
  });

  test("9. IP berbeda mempunyai penghitung terpisah", async () => {
    const ipBlocked = "198.51.100.11";
    const ipClean = "198.51.100.22";

    for (let i = 1; i <= 5; i++) {
      const req = makeRequest(
        "http://localhost:3000/api/auth/login",
        { email: testStudentEmail, password: "WrongPassword" },
        { "x-real-ip": ipBlocked }
      );
      await processLoginRequest(req, { email: testStudentEmail, password: "WrongPassword" });
    }

    const blockedCheck = await processLoginRequest(
      makeRequest(
        "http://localhost:3000/api/auth/login",
        { email: testStudentEmail, password: testStudentPassword },
        { "x-real-ip": ipBlocked }
      ),
      { email: testStudentEmail, password: testStudentPassword }
    );
    assert.equal(blockedCheck.status, 429);

    const cleanCheck = await processLoginRequest(
      makeRequest(
        "http://localhost:3000/api/auth/login",
        { email: testStudentEmail, password: testStudentPassword },
        { "x-real-ip": ipClean }
      ),
      { email: testStudentEmail, password: testStudentPassword }
    );
    assert.equal(cleanCheck.ok, true);
    assert.equal(cleanCheck.status, 200);
  });

  test("10. Pengguna tidak bisa melewati limit hanya dengan mengganti email atau memalsukan X-Forwarded-For", async () => {
    const attackerIp = "198.51.100.77";

    for (let i = 1; i <= 5; i++) {
      const body = {
        email: `target_account_${i}@casper.com`,
        password: "BruteForcePassword123",
      };
      const req = makeRequest("http://localhost:3000/api/auth/login", body, {
        "x-forwarded-for": `10.0.0.${i}, 172.16.0.${i}, ${attackerIp}`,
      });
      assert.equal(getClientIpFromRequest(req), attackerIp);
      const res = await processLoginRequest(req, body);
      assert.equal(res.status, 401);
    }

    const body6 = {
      email: "target_account_6@casper.com",
      password: "BruteForcePassword123",
    };
    const req6 = makeRequest("http://localhost:3000/api/auth/login", body6, {
      "x-forwarded-for": `1.2.3.4, ${attackerIp}`,
    });
    const res6 = await processLoginRequest(req6, body6);
    assert.equal(res6.status, 429);
  });

  test("11. Data akun lama (admin apriyanriyan23@gmail.com) tidak berubah", () => {
    const admin = findUserByEmail("apriyanriyan23@gmail.com");
    assert.ok(admin, "Akun admin apriyanriyan23@gmail.com harus tetap ada");
    assert.equal(admin.id, "6b9ba627-6741-4ee6-bf50-892469db05bf");
    assert.equal(admin.role, "ADMIN");
    assert.ok(
      admin.password_hash.startsWith("$2b$") && admin.password_hash.length === 60,
      "Password hash admin tidak boleh berubah"
    );
  });

  test("12. Rate limiter tidak merusak database academy.json dan bertahan saat reload store tanpa menyimpan data sensitif", async () => {
    const ip = "198.51.100.99";

    for (let i = 1; i <= 5; i++) {
      const req = makeRequest(
        "http://localhost:3000/api/auth/login",
        { email: testStudentEmail, password: "SecretAttemptPassword!" },
        { "x-real-ip": ip }
      );
      await processLoginRequest(req, {
        email: testStudentEmail,
        password: "SecretAttemptPassword!",
      });
    }

    // Simulasi restart proses PM2 (kosongkan memori rate limiter dan muat ulang dari file rate-limits.test.json)
    configureRateLimitStoreForTest({
      filePath: testRateLimitFile,
      resetMemory: true,
    });

    const afterRestartStatus = checkLoginRateLimit(ip);
    assert.equal(
      afterRestartStatus.allowed,
      false,
      "Status blokir IP harus bertahan setelah proses restart dari rate-limits.json"
    );
    assert.equal(afterRestartStatus.retryAfterSeconds, 900);

    // Pastikan tidak ada password, email, atau token di file rate-limits
    const rawRl = fs.readFileSync(testRateLimitFile, "utf8");
    assert.equal(rawRl.includes("SecretAttemptPassword!"), false);
    assert.equal(rawRl.includes(testStudentEmail), false);
    assert.equal(rawRl.includes("$2b$"), false);

    // Pastikan database utama academy.json tetap valid 100%
    const db = getDatabase();
    assert.equal(isValidDatabaseSchema(db), true);
  });
});
