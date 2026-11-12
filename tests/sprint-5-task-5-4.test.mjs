import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire, registerHooks, stripTypeScriptTypes } from "node:module";

const cjsRequire = createRequire(import.meta.url);
cjsRequire("jsonwebtoken");
cjsRequire("bcryptjs");

if (typeof registerHooks === "function" && typeof stripTypeScriptTypes === "function") {
  registerHooks({
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
  setDatabasePathForTest,
  createUser,
} = await import(pathToFileURL(path.resolve("lib/db.ts")).href);

const { createToken } = await import(pathToFileURL(path.resolve("lib/auth.ts")).href);

const {
  saveDrillCase,
  clearSubmissionLocksForTest,
} = await import(pathToFileURL(path.resolve("lib/drill-storage.ts")).href);

const {
  handleDrillGetRequest,
  handleDrillSubmitRequest,
  handleDrillSolutionRequest,
} = await import(pathToFileURL(path.resolve("lib/drill-api-handlers.ts")).href);

describe("Task 5.4 — Student Drill Workspace & Decision Console Integration Tests", () => {
  const testDbPath = path.join(
    process.cwd(),
    "data",
    `academy.test.sprint5-task5-4.${process.pid}.json`
  );

  let studentToken = "";
  let studentBetaToken = "";
  let adminToken = "";

  const publishedDrill = {
    id: "drill_test_xauusd_c1_01",
    course_id: "course_xauusd_mastery",
    course_slug: "xauusd-mastery",
    lesson_id: "m1-market-structure",
    title: "Gold London Open Liquidity Sweep Drill",
    slug: "xauusd-london-sweep",
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
    draft_chart_path: "/drills/drafts/case1.webp",
    published_chart_url: "/drills/published/case1.webp",
    solution_overlay_path: "/drills/solutions/sol1.webp",
    contextPrompt: "Analisa sapuan likuiditas pada Asian High dan tentukan setup.",
    instructions: ["Tentukan bias", "Pasang Entry, SL, dan Target"],
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
        { id: "CRIT_BIAS", name: "Bias", weight: 20, description: "Bias" },
        { id: "CRIT_ENTRY", name: "Entry", weight: 25, description: "Entry" },
        { id: "CRIT_INVALID", name: "SL", weight: 25, minimumPassPoints: 18, description: "SL" },
        { id: "CRIT_RR", name: "RR", weight: 15, description: "RR" },
        { id: "CRIT_CONFIRM", name: "Confirm", weight: 15, description: "Confirm" },
      ],
    },
    instructor_debrief: "Pembersihan Asian High terkonfirmasi CHoCH di 2670.00.",
  };

  const draftDrill = {
    ...publishedDrill,
    id: "drill_test_xauusd_draft_01",
    title: "Draft Drill Case",
    slug: "xauusd-draft-case",
    status: "DRAFT",
  };

  before(async () => {
    fs.writeFileSync(
      testDbPath,
      JSON.stringify({
        users: [],
        course_progress: [],
        quiz_submissions: [],
        drills: [],
        drill_submissions: [],
      })
    );
    setDatabasePathForTest(testDbPath);
    clearSubmissionLocksForTest();

    // Create users
    const studentUser = createUser({
      id: "student_alpha_54",
      email: "student.alpha@test.com",
      name: "Student Alpha",
      passwordHash: "hash123",
      role: "USER",
    });

    const studentBeta = createUser({
      id: "student_beta_54",
      email: "student.beta@test.com",
      name: "Student Beta",
      passwordHash: "hash123",
      role: "USER",
    });

    const adminUser = createUser({
      id: "admin_master_54",
      email: "apriyanriyan23@gmail.com",
      name: "Master Admin",
      passwordHash: "hash123",
      role: "ADMIN",
    });

    studentToken = createToken({ userId: studentUser.id, email: studentUser.email, role: "USER" });
    studentBetaToken = createToken({ userId: studentBeta.id, email: studentBeta.email, role: "USER" });
    adminToken = createToken({ userId: adminUser.id, email: adminUser.email, role: "ADMIN" });

    // Save drills
    saveDrillCase(publishedDrill, { id: adminUser.id, email: adminUser.email });
    saveDrillCase(draftDrill, { id: adminUser.id, email: adminUser.email });
  });

  after(() => {
    setDatabasePathForTest(null);
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  test("1. Route Access: Returns 404 for non-existent drill", async () => {
    const req = new Request("http://localhost/api/drills/non_existent_drill");
    const res = await handleDrillGetRequest(req, "non_existent_drill");
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.match(body.error, /tidak ditemukan/i);
  });

  test("2. Route Access & Zero Secret Leakage: Published drill returns sanitized PublicDrillCase without model answer", async () => {
    const req = new Request(`http://localhost/api/drills/${publishedDrill.id}`);
    const res = await handleDrillGetRequest(req, publishedDrill.id);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.drill.id, publishedDrill.id);

    // CRITICAL: Ensure grading secrets are completely stripped
    assert.equal(body.drill.model_answer, undefined);
    assert.equal(body.drill.expectedBias, undefined);
    assert.equal(body.drill.entryZone, undefined);
    assert.equal(body.drill.invalidationPrice, undefined);
    assert.equal(body.drill.targetPrice, undefined);
    assert.equal(body.drill.solution_overlay_path, undefined);
  });

  test("3. Security RBAC: Draft drill returns 403 for students, accessible only for Admins", async () => {
    // Unauthenticated student -> 403
    const reqAnon = new Request(`http://localhost/api/drills/${draftDrill.id}`);
    const resAnon = await handleDrillGetRequest(reqAnon, draftDrill.id);
    assert.equal(resAnon.status, 403);

    // Regular student -> 403
    const reqStudent = new Request(`http://localhost/api/drills/${draftDrill.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const resStudent = await handleDrillGetRequest(reqStudent, draftDrill.id);
    assert.equal(resStudent.status, 403);

    // Admin -> 200
    const reqAdmin = new Request(`http://localhost/api/drills/${draftDrill.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const resAdmin = await handleDrillGetRequest(reqAdmin, draftDrill.id);
    assert.equal(resAdmin.status, 200);
    const bodyAdmin = await resAdmin.json();
    assert.equal(bodyAdmin.drill.id, draftDrill.id);
  });

  test("4. Decision Console Validation: Rejects invalid or incomplete submission payloads", async () => {
    // Missing Idempotency Key -> 400
    const reqNoIdemp = new Request(`http://localhost/api/drills/${publishedDrill.id}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bias: "BEARISH", entryPrice: 2670 }),
    });
    const resNoIdemp = await handleDrillSubmitRequest(reqNoIdemp, publishedDrill.id);
    assert.equal(resNoIdemp.status, 400);

    // Missing Prices for TRADE stance -> 400
    const reqNoPrices = new Request(`http://localhost/api/drills/${publishedDrill.id}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "test-key-invalid-prices",
        bias: "BEARISH",
        isNoTrade: false,
      }),
    });
    const resNoPrices = await handleDrillSubmitRequest(reqNoPrices, publishedDrill.id);
    assert.equal(resNoPrices.status, 400);

    // Inverted Stop-Loss for Bearish Position (SL below Entry) -> 400
    const reqInvertedSL = new Request(`http://localhost/api/drills/${publishedDrill.id}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "test-key-inverted-sl",
        bias: "BEARISH",
        isNoTrade: false,
        entryPrice: 2670.0,
        invalidationPrice: 2665.0, // Inverted! SL is below entry on a short
        targetPrice: 2655.0,
      }),
    });
    const resInvertedSL = await handleDrillSubmitRequest(reqInvertedSL, publishedDrill.id);
    assert.equal(resInvertedSL.status, 400);
    const bodyInverted = await resInvertedSL.json();
    assert.match(bodyInverted.error, /harus berada di atas harga entry/i);
  });

  test("5. Submission Flow & Deterministic Evaluation: Successful Trade Submission returns score and debrief", async () => {
    const submissionPayload = {
      idempotencyKey: "student-alpha-sub-001",
      bias: "BEARISH",
      isNoTrade: false,
      entryPrice: 2670.0,
      invalidationPrice: 2673.5, // Matches ideal SL
      targetPrice: 2655.0, // Matches ideal TP
      selectedConfirmations: ["LIQUIDITY_SWEEP", "M15_CHOC"],
      rationaleText: "Asian high liquidity sweep confirmed by M15 CHoCH and imbalance tap",
    };

    const req = new Request(`http://localhost/api/drills/${publishedDrill.id}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(submissionPayload),
    });

    const res = await handleDrillSubmitRequest(req, publishedDrill.id);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.isIdempotentReplay, false);
    assert.equal(body.submission.attempt_number, 1);
    assert.equal(body.submission.score, 100);
    assert.equal(body.submission.invalidation_score, 25);
    assert.equal(body.submission.safety_gate_passed, true);
    assert.equal(body.submission.evaluation_status, "PASSED");
    assert.equal(body.evaluation.criteriaBreakdown.length, 5);
  });

  test("6. Idempotency Key Deduplication: Retrying identical submission returns stored record without incrementing attempt", async () => {
    const submissionPayload = {
      idempotencyKey: "student-alpha-sub-001", // SAME KEY as Subtest 5
      bias: "BEARISH",
      isNoTrade: false,
      entryPrice: 2670.0,
      invalidationPrice: 2673.5,
      targetPrice: 2655.0,
    };

    const req = new Request(`http://localhost/api/drills/${publishedDrill.id}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(submissionPayload),
    });

    const res = await handleDrillSubmitRequest(req, publishedDrill.id);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.isIdempotentReplay, true, "Must flag as idempotent replay");
    assert.equal(body.submission.attempt_number, 1, "Attempt number must remain 1, NOT incremented");
  });

  test("7. Cross-User Isolation: Student Beta does not see or overwrite Student Alpha's attempts", async () => {
    // Check Beta's initial state
    const reqBetaInitial = new Request(`http://localhost/api/drills/${publishedDrill.id}`, {
      headers: { Authorization: `Bearer ${studentBetaToken}` },
    });
    const resBetaInitial = await handleDrillGetRequest(reqBetaInitial, publishedDrill.id);
    const bodyBetaInitial = await resBetaInitial.json();
    assert.equal(bodyBetaInitial.submissionsCount, 0, "Beta must have 0 submissions initially");
    assert.equal(bodyBetaInitial.userSummary, null);

    // Beta submits attempt
    const betaPayload = {
      idempotencyKey: "student-beta-sub-001",
      bias: "BULLISH", // Wrong bias on purpose
      isNoTrade: false,
      entryPrice: 2665.0,
      invalidationPrice: 2660.0,
      targetPrice: 2675.0,
      selectedConfirmations: [],
      rationaleText: "Wrong bias test",
    };

    const reqBetaSubmit = new Request(`http://localhost/api/drills/${publishedDrill.id}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentBetaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(betaPayload),
    });
    const resBetaSubmit = await handleDrillSubmitRequest(reqBetaSubmit, publishedDrill.id);
    const bodyBetaSubmit = await resBetaSubmit.json();
    assert.equal(bodyBetaSubmit.submission.attempt_number, 1, "Beta's first attempt is attempt 1");

    // Verify Alpha's summary is completely isolated and retains 100% score
    const reqAlphaCheck = new Request(`http://localhost/api/drills/${publishedDrill.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const resAlphaCheck = await handleDrillGetRequest(reqAlphaCheck, publishedDrill.id);
    const bodyAlphaCheck = await resAlphaCheck.json();
    assert.equal(bodyAlphaCheck.userSummary.bestScore, 100, "Alpha's score must remain isolated and untainted");
  });

  test("8. Solution Authorization: Solution is blocked (403) before first attempt, allowed (200) after submission", async () => {
    // Create new student Gamma with 0 attempts
    const studentGamma = createUser({
      id: "student_gamma_54",
      email: "student.gamma@test.com",
      name: "Student Gamma",
      passwordHash: "hash123",
      role: "USER",
    });
    const gammaToken = createToken({ userId: studentGamma.id, email: studentGamma.email, role: "USER" });

    // Gamma attempts to fetch solution -> 403 Forbidden
    const reqGamma = new Request(`http://localhost/api/drills/${publishedDrill.id}/solution`, {
      headers: { Authorization: `Bearer ${gammaToken}` },
    });
    const resGamma = await handleDrillSolutionRequest(reqGamma, publishedDrill.id);
    assert.equal(resGamma.status, 403);
    const bodyGamma = await resGamma.json();
    assert.ok(bodyGamma.error.includes("minimal satu kali percobaan"));

    // Alpha (who already submitted) attempts to fetch solution -> 200 OK
    const reqAlpha = new Request(`http://localhost/api/drills/${publishedDrill.id}/solution`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const resAlpha = await handleDrillSolutionRequest(reqAlpha, publishedDrill.id);
    assert.equal(resAlpha.status, 200);
    const bodyAlpha = await resAlpha.json();
    assert.equal(bodyAlpha.success, true);
    assert.ok(bodyAlpha.solutionOverlayUrl);
    assert.ok(bodyAlpha.instructorDebrief);
  });

  test("9. Debrief Persistence: Refreshing the page returns persisted latest submission and attempt history", async () => {
    const req = new Request(`http://localhost/api/drills/${publishedDrill.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const res = await handleDrillGetRequest(req, publishedDrill.id);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.submissionsCount, 1);
    assert.equal(body.latestSubmission.score, 100);
    assert.equal(body.latestSubmission.evaluation_status, "PASSED");
    assert.equal(body.history.length, 1);
  });
});
