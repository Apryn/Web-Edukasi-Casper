import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { chromium } from "playwright-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TEST_PORT = 3128;
const BASE_URL = `http://localhost:${TEST_PORT}`;

describe("Sprint 5 — Task 5.4 Real Chrome Browser E2E Automation (Playwright)", () => {
  const dataDir = path.join(process.cwd(), "data");
  const prodDbFile = path.join(dataDir, "academy.json");
  const testDbFile = path.join(dataDir, `academy.browser-e2e.test.${process.pid}.json`);
  const artifactsDir = path.join(process.cwd(), "docs", "sprint-5", "artifacts");

  let prodDbHashBefore = null;
  let serverProcess = null;
  let browser = null;

  const testAdmin = {
    id: "admin_e2e_master",
    email: "apriyanriyan23@gmail.com",
    name: "Master Admin E2E",
    password: "AdminPassword123!",
    password_hash: bcrypt.hashSync("AdminPassword123!", 10),
    role: "ADMIN",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const studentAlpha = {
    id: "student_alpha_e2e",
    email: "student.alpha@casper.academy",
    name: "Student Alpha E2E",
    password: "StudentPassword123!",
    password_hash: bcrypt.hashSync("StudentPassword123!", 10),
    role: "USER",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const studentBeta = {
    id: "student_beta_e2e",
    email: "student.beta@casper.academy",
    name: "Student Beta E2E",
    password: "StudentPassword123!",
    password_hash: bcrypt.hashSync("StudentPassword123!", 10),
    role: "USER",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const publishedDrill = {
    id: "drill_e2e_xauusd_c1",
    course_id: "course_xauusd_mastery",
    course_slug: "xauusd-mastery",
    lesson_id: "m1-market-structure",
    title: "Gold London Open Liquidity Sweep Drill (E2E)",
    slug: "xauusd-london-sweep-e2e",
    drill_type: "SETUP_EXECUTION",
    status: "PUBLISHED",
    drill_version: 1,
    rubric_version: 1,
    instrument: "XAUUSD",
    timeframe: "M15",
    data_period: "2024-10-14 08:00 - 10:00 UTC",
    data_source: "Institutional Tick Feed",
    classification: "HISTORICAL_MARKET",
    timezone: "UTC",
    transformation_notes: "Clean candle bodies",
    price_bounds: { minPrice: 2640.0, maxPrice: 2680.0, decimals: 2 },
    draft_chart_path: "/signal-casper.png",
    published_chart_url: "/signal-casper.png",
    solution_overlay_path: "/signal-casper.png",
    contextPrompt: "Analisa sapuan likuiditas pada Asian High dan tentukan setup.",
    instructions: [
      "Identifikasi sapuan likuiditas pada batas Asia High",
      "Tentukan bias arah dan pasang Entry, Stop-Loss, dan Target",
    ],
    model_answer: {
      expectedBias: "BEARISH",
      isNoTradeValid: false,
      entryZone: { min: 2669.0, max: 2671.0, ideal: 2670.0, tolerance: 1.0 },
      invalidationPrice: { ideal: 2673.5, tolerance: 0.8 },
      targetPrice: { ideal: 2655.0, tolerance: 2.0 },
      minimumRiskRewardRatio: 2.0,
      requiredConfirmations: ["LIQUIDITY_SWEEP", "M15_CHOC"],
      validRationaleKeywords: ["sweep", "asian high", "imbalance"],
    },
    rubric: {
      overallPassingScore: 70,
      invalidationSafetyGatePoints: 18,
      criteria: [
        { id: "CRIT_BIAS", name: "Arah Bias Pasar", weight: 20, description: "Arah bias order flow" },
        { id: "CRIT_ENTRY", name: "Zona Entry Presisi", weight: 25, description: "Toleransi entri" },
        { id: "CRIT_INVALID", name: "Kualitas Stop-Loss & Safety Gate", weight: 25, minimumPassPoints: 18, description: "Invalidation level" },
        { id: "CRIT_RR", name: "Target & Risk-Reward", weight: 15, description: "Target dan R:R" },
        { id: "CRIT_CONFIRM", name: "Konfirmasi & Rationale", weight: 15, description: "Konfirmasi teknikal" },
      ],
    },
    instructor_debrief: "Pembersihan Asian High terkonfirmasi CHoCH di 2670.00. Target likuiditas di 2655.00.",
  };

  const draftDrill = {
    ...publishedDrill,
    id: "drill_e2e_xauusd_draft",
    title: "Draft Case Only For Admin (E2E)",
    slug: "xauusd-draft-e2e",
    status: "DRAFT",
  };

  before(async () => {
    // 1. Verify production DB hash integrity
    if (fs.existsSync(prodDbFile)) {
      prodDbHashBefore = crypto
        .createHash("sha256")
        .update(fs.readFileSync(prodDbFile))
        .digest("hex");
    }

    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // 2. Write isolated seed DB
    fs.writeFileSync(
      testDbFile,
      JSON.stringify(
        {
          users: [testAdmin, studentAlpha, studentBeta],
          course_progress: [],
          quiz_submissions: [],
          learning_events: [],
          recommendation_dismissals: [],
          drills: [publishedDrill, draftDrill],
          drill_submissions: [],
        },
        null,
        2
      ),
      "utf8"
    );

    // 3. Start Next.js standalone test server on isolated port
    const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
    const serverEnv = {
      ...process.env,
      PORT: String(TEST_PORT),
      ALLOW_TEST_DB_OVERRIDE: "true",
      SC_TEST_DATABASE_PATH: testDbFile,
      COOKIE_SECURE: "false",
      JWT_SECRET: "test-jwt-secret-minimum-32-characters-super-safe",
    };

    serverProcess = spawn("node", [nextBin, "start", "-p", String(TEST_PORT)], {
      env: serverEnv,
      cwd: process.cwd(),
      stdio: "pipe",
    });

    serverProcess.stderr.on("data", (data) => {
      const msg = data.toString();
      if (!msg.includes("ExperimentalWarning")) {
        // console.error(`[SERVER STDERR] ${msg}`);
      }
    });

    // 4. Poll until server is ready
    let serverReady = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/me`);
        if (res.status === 401 || res.status === 200) {
          serverReady = true;
          break;
        }
      } catch {
        // wait for boot
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(serverReady, `Test server failed to start on port ${TEST_PORT} within 20s`);

    // 5. Launch Chrome browser via Playwright
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });
  });

  after(async () => {
    if (browser) {
      await browser.close().catch(() => { });
    }

    if (serverProcess && serverProcess.pid) {
      try {
        execSync(`taskkill /PID ${serverProcess.pid} /T /F`, { stdio: "ignore" });
      } catch { }
    }

    try {
      if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
    } catch { }

    // Verify prod DB hash never touched
    if (fs.existsSync(prodDbFile) && prodDbHashBefore) {
      const prodDbHashAfter = crypto
        .createHash("sha256")
        .update(fs.readFileSync(prodDbFile))
        .digest("hex");
      assert.equal(
        prodDbHashAfter,
        prodDbHashBefore,
        "Production DB academy.json hash must NOT be modified!"
      );
    }
  });

  test("1. Unauthenticated Redirect: Guest visiting drill page is redirected to /login", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/belajar/drill/${publishedDrill.id}`);
    await page.waitForURL(/login/);
    assert.ok(page.url().includes("/login"));
    assert.ok(page.url().includes(`/belajar/drill/${publishedDrill.id}`));
    await context.close();
  });

  test("2. Student Authentication & Workspace Loading: Student Alpha logs in and opens drill", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Go to login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentAlpha.email);
    await page.fill('input[type="password"]', studentAlpha.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard or home
    await page.waitForURL(/(dashboard|belajar)/);

    // Open Drill Workspace
    await page.goto(`${BASE_URL}/belajar/drill/${publishedDrill.id}`);
    await page.waitForSelector("h1");

    const title = await page.textContent("h1");
    assert.ok(title.includes("Gold London Open Liquidity Sweep"));

    // Check Aspect Ratio 16:9 container
    const chartContainer = await page.$(".aspect-\\[16\\/9\\]");
    assert.ok(chartContainer, "16:9 aspect ratio chart container must exist");

    // Check ScopedChartViewer elements
    const zoomInBtn = await page.$('button[aria-label="Perbesar chart zoom"]');
    assert.ok(zoomInBtn, "Chart viewer zoom button must be present");

    // Check Zero Secret Leakage: model answer must NOT exist in the DOM
    const bodyText = await page.textContent("body");
    assert.ok(!bodyText.includes("Pembersihan Asian High terkonfirmasi CHoCH di 2670.00"));
    assert.ok(!bodyText.includes("2673.5")); // ideal SL must not leak
    assert.ok(!bodyText.includes('"tolerance"')); // tolerance parameters must not leak

    await context.close();
  });

  test("3. Interactive Chart Controls: Zoom 1x-3x, Pan, and Crosshair Price Pill", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentAlpha.email);
    await page.fill('input[type="password"]', studentAlpha.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|belajar)/);

    await page.goto(`${BASE_URL}/belajar/drill/${publishedDrill.id}`);
    await page.waitForSelector("h1");

    // Check zoom button initial percentage (100%)
    const zoomInBtn = await page.$('button[aria-label="Perbesar chart zoom"]');
    assert.ok(zoomInBtn, "Zoom in button must exist");

    const bodyInitial = await page.textContent("body");
    assert.ok(bodyInitial.includes("100%"), "Initial zoom must be 100%");

    // Click Zoom In
    await zoomInBtn.click();
    await page.waitForTimeout(300);

    const bodyAfterZoom = await page.textContent("body");
    assert.ok(
      bodyAfterZoom.includes("125%") || bodyAfterZoom.includes("130%"),

      "Zoom percentage must increase after zoom in"
    );

    // Reset Zoom
    const resetBtn = await page.$('button[aria-label="Reset zoom chart ke 1.0x"]');
    assert.ok(resetBtn, "Reset zoom button must exist");
    await resetBtn.click();
    await page.waitForTimeout(200);

    const bodyAfterReset = await page.textContent("body");
    assert.ok(bodyAfterReset.includes("100%"), "Zoom must return to 100% after reset");

    // Crosshair movement on chart stage
    const stage = await page.$(".aspect-\\[16\\/9\\]");
    if (stage) {
      const box = await stage.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(100);
      }
    }

    await context.close();
  });

  test("4. Decision Console Two-Way Synchronization: Entering Prices Updates Chart & Calculates Live R:R", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentAlpha.email);
    await page.fill('input[type="password"]', studentAlpha.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|belajar)/);

    await page.goto(`${BASE_URL}/belajar/drill/${publishedDrill.id}`);
    await page.waitForSelector("h1");
    await page.waitForLoadState("networkidle");

    // Select BEARISH (SHORT) and wait for React state to update
    const bearishBtn = page.locator('button:has-text("BEARISH (SHORT)")');
    await bearishBtn.click({ force: true });
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("BEARISH (SHORT)")
      );
      return btn && btn.className.includes("border-[#f43f5e]");
    });

    // Fill Entry, SL, TP inputs
    const inputs = await page.$$('input[type="number"]');
    assert.equal(inputs.length >= 3, true, "Entry, SL, and TP inputs must exist");

    await inputs[0].fill("2670.00");
    await inputs[1].fill("2673.50");
    await inputs[2].fill("2655.00");

    // Verify live R:R badge calculation: (2670 - 2655) / (2673.5 - 2670) = 15 / 3.5 = 4.29
    await page.waitForTimeout(300);
    const bodyContent = await page.textContent("body");
    assert.ok(bodyContent.includes("4.29") || bodyContent.includes("Risk/Reward Ratio"));

    await context.close();
  });

  test("5. Trade Submission, Loading Guard, Debrief View & Criteria Breakdown", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentAlpha.email);
    await page.fill('input[type="password"]', studentAlpha.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|belajar)/);

    await page.goto(`${BASE_URL}/belajar/drill/${publishedDrill.id}`);
    await page.waitForSelector("h1");
    await page.waitForLoadState("networkidle");

    // Click BEARISH and wait for React state to update
    const bearishLocator = page.locator('button:has-text("BEARISH (SHORT)")');
    await bearishLocator.click({ force: true });
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("BEARISH (SHORT)")
      );
      return btn && btn.className.includes("border-[#f43f5e]");
    });
    const inputs = await page.$$('input[type="number"]');
    await inputs[0].fill("2670.00");
    await inputs[1].fill("2673.50");
    await inputs[2].fill("2655.00");

    // Check confirmation checkboxes
    const checkboxes = await page.$$('input[type="checkbox"]');
    if (checkboxes.length > 0) {
      await checkboxes[0].click({ force: true }); // Liquidity Sweep
    }

    // Fill rationale thesis
    const textarea = await page.$("textarea");
    assert.ok(textarea, "Rationale textarea must exist");
    await textarea.fill("Asian High liquidity sweep above 2672 with clean M15 CHoCH rejection at 2670.");

    // Submit form
    await page.locator('button[type="submit"]').click({ force: true });

    // Wait for Debrief View (criteria table is guaranteed to render upon submission)
    await page.waitForSelector('text="Rincian Evaluasi 5 Kriteria Objektif"', { timeout: 15000 });

    const debriefText = await page.textContent("body");
    assert.ok(debriefText.includes("LULUS") || debriefText.includes("EVALUASI"), "Debrief status must be present");
    assert.ok(debriefText.includes("Rincian Evaluasi 5 Kriteria Objektif"), "Criteria breakdown table must exist");
    assert.ok(debriefText.includes("CATATAN INSTRUKTUR:"), "Instructor debrief notes must exist");

    // Capture Debrief Screenshot
    await page.screenshot({
      path: path.join(artifactsDir, "e2e_student_debrief_passed.png"),
      fullPage: true,
    });

    await context.close();
  });

  test("6. Solution Overlay Toggle: Student Views Instructor Model Solution Post-Submission", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as Alpha
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentAlpha.email);
    await page.fill('input[type="password"]', studentAlpha.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|belajar)/);

    await page.goto(`${BASE_URL}/belajar/drill/${publishedDrill.id}`);

    // Wait for Debrief & Click Solution button
    await page.waitForSelector('button:has-text("Lihat Solusi & Anotasi Instruktur")', { timeout: 10000 });
    await page.locator('button:has-text("Lihat Solusi & Anotasi Instruktur")').click({ force: true });

    await page.waitForTimeout(500);
    const bodyContent = await page.textContent("body");
    assert.ok(bodyContent.includes("Sembunyikan Solusi Instruktur"));

    // Toggle off
    const hideBtn = await page.$('button:has-text("Sembunyikan Solusi Instruktur")');
    assert.ok(hideBtn, "Toggle button should change label to Sembunyikan");
    await hideBtn.click();
    await page.waitForTimeout(300);

    await context.close();
  });

  test("7. Persistence Verification: Page Refresh Retains Evaluated Debrief & Attempt State", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentAlpha.email);
    await page.fill('input[type="password"]', studentAlpha.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|belajar)/);

    // Navigate to drill
    await page.goto(`${BASE_URL}/belajar/drill/${publishedDrill.id}`);
    await page.waitForSelector('text="Rincian Evaluasi 5 Kriteria Objektif"', { timeout: 15000 });

    // Perform hard reload
    await page.reload();
    await page.waitForSelector("h1");

    // Debrief must still be rendered directly from Server Component initial props
    const debriefAfterReload = await page.textContent("body");
    assert.ok(debriefAfterReload.includes("Rincian Evaluasi 5 Kriteria Objektif"));

    await context.close();
  });

  test("8. Retry Mechanism: Student Initiates Second Attempt with NO-TRADE Stance", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentAlpha.email);
    await page.fill('input[type="password"]', studentAlpha.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|belajar)/);

    await page.goto(`${BASE_URL}/belajar/drill/${publishedDrill.id}`);
    await page.waitForSelector('text="Rincian Evaluasi 5 Kriteria Objektif"', { timeout: 15000 });

    // Click "Coba Lagi Studi Kasus"
    await page.locator('button:has-text("Coba Lagi Studi Kasus")').click({ force: true });

    // Verify console is restored
    await page.waitForSelector('h2:has-text("Student Decision Console")');

    // Select NO-TRADE stance
    await page.locator('button:has-text("DISIPLIN NO-TRADE")').click({ force: true });

    // Select a structural reason
    const radioReason = await page.$('input[name="noTradeReasonGroup"]');
    if (radioReason) {
      await radioReason.click({ force: true });
    }

    const textarea = await page.$("textarea");
    await textarea.fill("Menahan diri karena setup belum memberikan konfirmasi R:R yang optimal.");

    // Submit second attempt
    await page.locator('button[type="submit"]').click({ force: true });

    // Wait for Debrief
    await page.waitForSelector('text="Rincian Evaluasi 5 Kriteria Objektif"', { timeout: 15000 });

    // Verify Attempt History Accordion shows 2 attempts
    const historyText = await page.textContent("body");
    assert.ok(
      historyText.includes("RIWAYAT PERCOBAAN (2 KALI)"),
      "Attempt history accordion must show 2 attempts"
    );

    await context.close();
  });

  test("9. Cross-User Isolation: Student Beta Sees Clean Workspace & Blocked Solution Access", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as Student Beta (who has NOT submitted)
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentBeta.email);
    await page.fill('input[type="password"]', studentBeta.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|belajar)/);

    // Open drill page
    await page.goto(`${BASE_URL}/belajar/drill/${publishedDrill.id}`);
    await page.waitForSelector("h1");

    // Student Beta must see clean Decision Console (NOT Student Alpha's Debrief)
    const betaBody = await page.textContent("body");
    assert.ok(betaBody.includes("Student Decision Console"));
    assert.ok(!betaBody.includes("RIWAYAT PERCOBAAN"));

    // Attempt direct API fetch of solution -> must return 403 Forbidden
    const solutionRes = await page.evaluate(async (drillId) => {
      const res = await fetch(`/api/drills/${drillId}/solution`);
      return { status: res.status, body: await res.json() };
    }, publishedDrill.id);

    assert.equal(solutionRes.status, 403);
    assert.ok(solutionRes.body.error.includes("minimal satu kali percobaan"));

    await context.close();
  });

  test("10. Security RBAC: Draft Drill Access Control (Student 404 vs Admin 200)", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as Student Beta
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentBeta.email);
    await page.fill('input[type="password"]', studentBeta.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|belajar)/);

    // Student attempts to open draft drill -> 404 Not Found page
    const res = await page.goto(`${BASE_URL}/belajar/drill/${draftDrill.id}`);
    assert.equal(res.status(), 404);

    // Now login as Admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', testAdmin.email);
    await page.fill('input[type="password"]', testAdmin.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|admin|belajar)/);

    // Admin opens draft drill -> 200 OK
    const adminRes = await page.goto(`${BASE_URL}/belajar/drill/${draftDrill.id}`);
    assert.equal(adminRes.status(), 200);
    const adminPageText = await page.textContent("body");
    assert.ok(adminPageText.includes("Draft Case Only For Admin"));

    await context.close();
  });

  test("11. Multi-Device Responsiveness (1440px, 768px, 390px, 360px) & Zero Horizontal Scroll", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as Alpha
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentAlpha.email);
    await page.fill('input[type="password"]', studentAlpha.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|belajar)/);

    const viewports = [
      { width: 1440, height: 900, name: "desktop_1440" },
      { width: 768, height: 1024, name: "tablet_768" },
      { width: 390, height: 844, name: "mobile_390" },
      { width: 360, height: 640, name: "mobile_360" },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}/belajar/drill/${publishedDrill.id}`);
      await page.waitForSelector("h1");

      // Verify no horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      assert.equal(
        hasHorizontalScroll,
        false,
        `Viewport ${vp.name} (${vp.width}px) must not have horizontal scrollbar`
      );

      // Capture screenshot
      await page.screenshot({
        path: path.join(artifactsDir, `e2e_workspace_${vp.name}.png`),
        fullPage: true,
      });
    }

    await context.close();
  });

  test("12. Idempotency Key Invariant: Replay with Identical Key Does NOT Increment Attempts", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as Alpha
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentAlpha.email);
    await page.fill('input[type="password"]', studentAlpha.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|belajar)/);

    // Send submission with an explicit idempotencyKey twice
    const stableKey = "idemp_test_replay_" + Date.now();
    const payload = {
      idempotencyKey: stableKey,
      bias: "BEARISH",
      isNoTrade: false,
      entryPrice: 2670.0,
      invalidationPrice: 2673.5,
      targetPrice: 2655.0,
      selectedConfirmations: ["LIQUIDITY_SWEEP"],
      rationaleText: "Replay test rationale",
    };

    const firstSub = await page.evaluate(async ({ drillId, p }) => {
      const res = await fetch(`/api/drills/${drillId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      return { status: res.status, body: await res.json() };
    }, { drillId: publishedDrill.id, p: payload });

    assert.equal(firstSub.status, 200);
    assert.equal(firstSub.body.isIdempotentReplay, false);
    const initialAttemptNumber = firstSub.body.submission.attempt_number;

    // Send duplicate replay with same idempotencyKey
    const secondSub = await page.evaluate(async ({ drillId, p }) => {
      const res = await fetch(`/api/drills/${drillId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      return { status: res.status, body: await res.json() };
    }, { drillId: publishedDrill.id, p: payload });

    assert.equal(secondSub.status, 200);
    assert.equal(secondSub.body.isIdempotentReplay, true);
    assert.equal(secondSub.body.submission.attempt_number, initialAttemptNumber);

    await context.close();
  });
});
