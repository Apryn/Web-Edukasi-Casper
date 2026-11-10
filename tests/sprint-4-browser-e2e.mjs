import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { chromium } from "playwright-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TEST_PORT = 3088;
const BASE_URL = `http://localhost:${TEST_PORT}`;

describe("Sprint 4 — Real Browser E2E Automation (Playwright + Chrome 156)", () => {
  const dataDir = path.join(process.cwd(), "data");
  const prodDbFile = path.join(dataDir, "academy.json");
  const testDbFile = path.join(dataDir, `academy.browser-e2e.test.${process.pid}.json`);
  const testJournalsDir = path.join(dataDir, `test_journals_browser_e2e_${process.pid}`);
  const artifactsDir = path.join(process.cwd(), "docs", "sprint-4", "artifacts");

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

  before(async () => {
    // 1. Verify production DB hash integrity
    if (fs.existsSync(prodDbFile)) {
      prodDbHashBefore = crypto
        .createHash("sha256")
        .update(fs.readFileSync(prodDbFile))
        .digest("hex");
    }

    // 2. Ensure test journals dir and artifacts dir exist
    if (!fs.existsSync(testJournalsDir)) {
      fs.mkdirSync(testJournalsDir, { recursive: true });
    }
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // 3. Write isolated seed DB
    fs.writeFileSync(
      testDbFile,
      JSON.stringify(
        {
          users: [testAdmin, studentAlpha, studentBeta],
          course_progress: [],
          quiz_submissions: [],
          learning_events: [],
          recommendation_dismissals: [],
        },
        null,
        2
      ),
      "utf8"
    );

    // 4. Start Next.js standalone test server on isolated port
    const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
    const serverEnv = {
      ...process.env,
      PORT: String(TEST_PORT),
      ALLOW_TEST_DB_OVERRIDE: "true",
      SC_TEST_DATABASE_PATH: testDbFile,
      SC_TEST_JOURNALS_DIR: testJournalsDir,
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

    // 5. Poll until server is ready
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

    // 6. Launch Chrome browser via Playwright
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });
  });

  after(async () => {
    if (browser) {
      await browser.close().catch(() => {});
    }

    if (serverProcess && serverProcess.pid) {
      try {
        execSync(`taskkill /PID ${serverProcess.pid} /T /F`, { stdio: "ignore" });
      } catch {
        // process may have already exited
      }
    }

    // Clean up isolated test scratch files
    try {
      if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
    } catch {}
    try {
      if (fs.existsSync(testJournalsDir)) {
        fs.rmSync(testJournalsDir, { recursive: true, force: true });
      }
    } catch {}

    // Verify production DB remains strictly unmodified
    if (prodDbHashBefore && fs.existsSync(prodDbFile)) {
      const prodDbHashAfter = crypto
        .createHash("sha256")
        .update(fs.readFileSync(prodDbFile))
        .digest("hex");
      assert.equal(
        prodDbHashAfter,
        prodDbHashBefore,
        "Production data/academy.json was modified during browser tests!"
      );
    }
  });

  test("BROWSER-01: Student Authentication, Navigation to Dashboard & KPI Verification", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 1. Open login page
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    assert.ok(await page.locator("#email").isVisible(), "Login email input must be visible");

    // 2. Perform student login
    await page.fill("#email", studentAlpha.email);
    await page.fill("#password", studentAlpha.password);
    await page.click('button[type="submit"]');

    // 3. Verify successful redirect to /dashboard
    await page.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 10000 });
    assert.match(page.url(), /\/dashboard$/, "Must navigate to /dashboard");

    // 4. Verify Student Learning Workspace KPI cards render
    await page.waitForSelector(".learning-workspace", { timeout: 10000 });
    const kpiCards = await page.locator(".learning-kpi-card").count();
    assert.ok(kpiCards >= 3, "At least 3 KPI cards should be present");

    // 5. Verify Continue Learning card presence
    const continueSection = page.locator(".learning-continue-banner");
    assert.ok(await continueSection.isVisible(), "Continue Learning banner should be displayed");

    // 6. Click Continue Learning CTA button
    const ctaLink = continueSection.locator(".learning-continue-cta a.button-primary");
    assert.ok(await ctaLink.isVisible());
    const ctaHref = await ctaLink.getAttribute("href");
    assert.ok(ctaHref && (ctaHref.includes("/belajar/") || ctaHref.includes("/kelas/")));

    await context.close();
  });

  test("BROWSER-02: Student Learning Flow — Lesson Completion, Quiz Evaluation, and Retry Recommendation", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 1. Authenticate as studentAlpha
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill("#email", studentAlpha.email);
    await page.fill("#password", studentAlpha.password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 10000 });

    // 2. Complete reading lesson via Classroom UI interaction
    await page.goto(`${BASE_URL}/kelas/trading-fundamentals?lesson=tf-1-1`, { waitUntil: "networkidle" });
    const completeToggleBtn = page.locator("button.complete-toggle-btn");
    await completeToggleBtn.waitFor({ timeout: 10000 });
    await completeToggleBtn.click();
    await page.waitForTimeout(500);

    // 3. Open quiz in Classroom UI and intentionally submit incorrect answers to trigger RETRY_QUIZ
    await page.goto(`${BASE_URL}/kelas/trading-fundamentals?lesson=tf-quiz-1`, { waitUntil: "networkidle" });
    await page.waitForSelector(".quiz-container", { timeout: 10000 });

    // Select wrong options (index 3 / last option) for each question
    const quizCards = page.locator(".quiz-card");
    const cardsCount = await quizCards.count();
    for (let i = 0; i < cardsCount; i++) {
      const card = quizCards.nth(i);
      const options = card.locator("button.quiz-option");
      const optCount = await options.count();
      // Select option D (index 3 or last) which is incorrect for all questions in this quiz
      await options.nth(optCount - 1).click();
    }

    // Submit quiz via UI button
    const submitBtn = page.locator("button.quiz-submit-btn");
    await submitBtn.click();
    await page.waitForSelector(".quiz-eval-banner", { timeout: 10000 });
    const bannerClass = await page.locator(".quiz-eval-banner").getAttribute("class");
    assert.match(bannerClass, /failed/, "Quiz evaluation banner must show failed status for incorrect answers");

    // 4. Return to dashboard and verify RETRY_QUIZ recommendation appears in UI
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForSelector(".learning-workspace", { timeout: 10000 });

    const recCard = page.locator(".learning-rec-card").first();
    await recCard.waitFor({ timeout: 5000 });
    const recText = await recCard.innerText();
    assert.match(recText, /ULANGI KUIS|RETRY_QUIZ|Kuis/i, "Retry quiz recommendation must be shown");

    // 5. Dismiss recommendation via UI button
    const dismissBtn = recCard.locator(".learning-rec-dismiss");
    await dismissBtn.click();
    await page.waitForTimeout(500);

    // Verify restore button appears
    const restoreBtn = page.locator('button:has-text("Pulihkan")');
    await restoreBtn.waitFor({ timeout: 5000 });
    assert.ok(await restoreBtn.isVisible(), "Restore dismissed recommendation button must appear");

    // 6. Restore recommendation via UI button
    await restoreBtn.click();
    await page.waitForTimeout(500);
    assert.ok(await recCard.isVisible(), "Restored recommendation must reappear");

    // 7. Retake quiz in Classroom UI and pass (>= 70%)
    await page.goto(`${BASE_URL}/kelas/trading-fundamentals?lesson=tf-quiz-1`, { waitUntil: "networkidle" });
    await page.waitForSelector(".quiz-container", { timeout: 10000 });

    const retakeBtn = page.locator('button:has-text("Ulangi Kuis")');
    if (await retakeBtn.isVisible()) {
      await retakeBtn.click();
      await page.waitForTimeout(300);
    }

    // Now select correct options (Card 0: option 1, Card 1: option 2, Card 2: option 0)
    const correctIndices = [1, 2, 0];
    const retryCards = page.locator(".quiz-card");
    const retryCardsCount = await retryCards.count();
    for (let i = 0; i < retryCardsCount; i++) {
      const card = retryCards.nth(i);
      const targetIdx = correctIndices[i] !== undefined ? correctIndices[i] : 0;
      await card.locator("button.quiz-option").nth(targetIdx).click();
    }

    const retrySubmitBtn = page.locator("button.quiz-submit-btn");
    await retrySubmitBtn.click();
    await page.waitForSelector(".quiz-eval-banner.passed", { timeout: 10000 });
    assert.ok(await page.locator(".quiz-eval-banner.passed").isVisible(), "Quiz must pass with >= 70%");

    // 8. Refresh dashboard and verify persistence from DB
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".learning-workspace", { timeout: 10000 });
    const updatedKpi = await page.locator(".learning-kpi-value").first().innerText();
    assert.ok(updatedKpi !== "NO DATA", "KPI value must be populated after completing lessons");

    await context.close();
  });

  test("BROWSER-03: Admin Flow — Education Intelligence Filtering, Cohorts, and Small-Cohort Protection", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 1. Log in as master admin
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill("#email", testAdmin.email);
    await page.fill("#password", testAdmin.password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 10000 });

    // 2. Open /admin
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await page.waitForSelector(".admin-tabs", { timeout: 10000 });

    // 3. Switch to "Education Intelligence" tab
    const eduTab = page.locator('button.admin-tab:has-text("Education Intelligence")');
    await eduTab.click();
    await page.waitForSelector(".admin-intelligence-panel", { timeout: 10000 });

    // 4. Test period filter buttons (7d, 30d, 90d, all)
    const periodButtons = ["7 Hari", "30 Hari", "90 Hari", "Seluruh Waktu"];
    for (const label of periodButtons) {
      const btn = page.locator(`.admin-intelligence-panel button.admin-btn:has-text("${label}")`);
      await btn.click();
      await page.waitForTimeout(300);
      assert.match(await btn.getAttribute("class"), /admin-btn-primary/);
    }

    // 5. Inspect Sub-views: Courses, Lessons Drop-off, Quizzes, Engagement
    // Sub-view: Courses
    const coursesSubNav = page.locator('button:has-text("Performa Kelas")');
    await coursesSubNav.click();
    await page.waitForTimeout(300);
    assert.ok(await page.locator("table.admin-table").isVisible(), "Course performance table must render");

    // Sub-view: Lessons Drop-off
    const lessonsSubNav = page.locator('button:has-text("Drop-Off Materi")');
    await lessonsSubNav.click();
    await page.waitForTimeout(300);
    assert.ok(await page.locator("table.admin-table").isVisible(), "Lesson drop-off table must render");

    // Sub-view: Quizzes
    const quizzesSubNav = page.locator('button:has-text("Inteligensi Kuis")');
    await quizzesSubNav.click();
    await page.waitForTimeout(300);

    // Sub-view: Engagement & Cohorts
    const engagementSubNav = page.locator('button:has-text("Engagement, Funnel & Retensi")');
    await engagementSubNav.click();
    await page.waitForTimeout(300);

    // 6. Verify small-cohort privacy protection notice
    const panelText = await page.locator(".admin-intelligence-panel").innerText();
    assert.match(
      panelText,
      /PROTEKSI KOHORT KECIL AKTIF|disamarkan untuk menjaga privasi|ambang batas privasi minimum/i,
      "Small cohort privacy notice must be active when student sample is small"
    );

    await context.close();
  });

  test("BROWSER-04: Security & Cross-Role Isolation QA", async () => {
    // 1. Student context blocked from admin
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await studentPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await studentPage.fill("#email", studentAlpha.email);
    await studentPage.fill("#password", studentAlpha.password);
    await studentPage.click('button[type="submit"]');
    await studentPage.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 10000 });

    // Student attempts to call /api/admin/overview
    const adminApiCheck = await studentPage.evaluate(async () => {
      const res = await fetch("/api/admin/overview");
      return { status: res.status };
    });
    assert.equal(adminApiCheck.status, 403, "Student must receive HTTP 403 when requesting admin endpoints");

    // Student attempts to call /api/admin/learning-intelligence/overview
    const adminIntelCheck = await studentPage.evaluate(async () => {
      const res = await fetch("/api/admin/learning-intelligence/overview");
      return { status: res.status };
    });
    assert.equal(adminIntelCheck.status, 403, "Student must receive HTTP 403 for admin education intelligence");

    // 2. Admin context blocked from private trading journal endpoints
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await adminPage.fill("#email", testAdmin.email);
    await adminPage.fill("#password", testAdmin.password);
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 10000 });

    const journalAccessCheck = await adminPage.evaluate(async (studentId) => {
      const res = await fetch(`/api/journal/trades?userId=${encodeURIComponent(studentId)}`);
      return { status: res.status };
    }, studentAlpha.id);
    assert.equal(
      journalAccessCheck.status,
      403,
      "Admin cannot access student private trading journals (HTTP 403 strict guarantee)"
    );

    // 3. Answer keys not leaked to student in /api/courses
    const coursesPayload = await studentPage.evaluate(async () => {
      const res = await fetch("/api/courses");
      return await res.json();
    });
    const c1 = (coursesPayload.courses || coursesPayload).find(
      (c) => c.slug === "trading-fundamentals"
    );
    const quizItem = c1.modules.flatMap((m) => m.lessons).find((l) => l.type === "quiz");
    if (quizItem && Array.isArray(quizItem.quiz)) {
      for (const q of quizItem.quiz) {
        assert.equal(
          q.correctAnswer,
          undefined,
          "Question correctAnswer must NOT be leaked in public/student API responses"
        );
      }
    }

    await studentContext.close();
    await adminContext.close();
  });

  test("BROWSER-05: Multi-Viewport Responsive Layout Verification & Visual Artifacts", async () => {
    const viewports = [
      { name: "desktop-1440", width: 1440, height: 900 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "mobile-390", width: 390, height: 844 },
      { name: "mobile-360", width: 360, height: 780 },
    ];

    for (const vp of viewports) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      // Log in as studentAlpha
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
      await page.fill("#email", studentAlpha.email);
      await page.fill("#password", studentAlpha.password);
      await page.click('button[type="submit"]');
      await page.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 10000 });
      await page.waitForSelector(".learning-workspace", { timeout: 10000 });

      // Check horizontal overflow: scrollWidth must equal clientWidth (within 2px tolerance)
      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        return { docWidth, winWidth, hasOverflow: docWidth > winWidth + 2 };
      });
      assert.equal(
        overflow.hasOverflow,
        false,
        `Viewport ${vp.name} (${vp.width}px) must not have horizontal page overflow (doc: ${overflow.docWidth}, win: ${overflow.winWidth})`
      );

      // Save screenshot artifact for audit review
      const shotPath = path.join(artifactsDir, `dashboard-${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      assert.ok(fs.existsSync(shotPath), `Screenshot ${shotPath} must be written`);

      await context.close();
    }
  });
});
