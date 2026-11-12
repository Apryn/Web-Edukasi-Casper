import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire, registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

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
  setDatabasePathForTest,
  getDatabase,
  executeMutation,
} = await import("../lib/db.ts");

const {
  saveDrillCase,
  getDrillById,
  getAllDrills,
  recordDrillSubmission,
  getDrillSubmissions,
  getStudentDrillSummary,
  computeStudentDrillSummary,
  withSubmissionLock,
  clearSubmissionLocksForTest,
  validateRubricIntegrity,
  validateModelAnswerConsistency,
} = await import("../lib/drill-storage.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

describe("Task 5.1 — Data Model & Storage Integration Tests", () => {
  const TEST_DB_PATH = path.join(process.cwd(), "data", "academy.task51.test.json");

  function resetTestDb() {
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {}
    }
    const initialData = {
      users: [
        {
          id: "usr_admin_test",
          email: "admin@casper.internal",
          name: "Test Admin",
          password_hash: "hash",
          role: "ADMIN",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "usr_student_alpha",
          email: "alpha@casper.internal",
          name: "Student Alpha",
          password_hash: "hash",
          role: "USER",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      course_progress: [],
      quiz_submissions: [],
      drills: [],
      drill_submissions: [],
      trade_preparation_checklists: [],
    };
    fs.writeFileSync(TEST_DB_PATH, JSON.stringify(initialData, null, 2), "utf8");
    setDatabasePathForTest(TEST_DB_PATH);
  }

  function cleanupTestDb() {
    setDatabasePathForTest(null);
    clearSubmissionLocksForTest();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {}
    }
  }

  before(() => {
    resetTestDb();
  });

  after(() => {
    cleanupTestDb();
  });

  const mockRubric = {
    overallPassingScore: 70,
    invalidationSafetyGatePoints: 18,
    criteria: [
      { id: "CRIT_BIAS", name: "Bias & Market Context", weight: 20, description: "Bias arah" },
      { id: "CRIT_ENTRY", name: "Entry Zone Accuracy", weight: 25, description: "Akurasi entry" },
      { id: "CRIT_INVALID", name: "Invalidation (SL) Placement", weight: 25, minimumPassPoints: 18, description: "Stop-Loss" },
      { id: "CRIT_RR", name: "Risk/Reward Viability", weight: 15, description: "Rasio RR" },
      { id: "CRIT_CONFIRM", name: "Structural Confirmation", weight: 15, description: "Konfirmasi struktur" },
    ],
  };

  const mockModelAnswer = {
    expectedBias: "BEARISH",
    isNoTradeValid: false,
    entryZone: { min: 2666.0, max: 2667.5, ideal: 2666.8, tolerance: 1.0 },
    invalidationPrice: { ideal: 2670.0, tolerance: 0.8 },
    targetPrice: { ideal: 2655.0, tolerance: 2.0 },
    minimumRiskRewardRatio: 2.0,
    requiredConfirmations: ["LIQUIDITY_SWEEP", "FVG_TAP"],
    validRationaleKeywords: ["sweep", "fvg", "rejection"],
  };

  const mockDrillCase = {
    id: "drill_xauusd_c1_01",
    course_id: "course_xauusd_basic",
    course_slug: "xauusd-basic",
    lesson_id: "c1-market-structure",
    title: "Studi Kasus 01: Liquidity Sweep H1",
    slug: "xauusd-liquidity-sweep-h1",
    drill_type: "SETUP_EXECUTION",
    status: "DRAFT",
    drill_version: 1,
    rubric_version: 1,
    instrument: "XAUUSD",
    timeframe: "H1",
    data_period: "2024-10-14 08:00 - 16:00 UTC",
    data_source: "Institutional Tick History (Curated)",
    classification: "HISTORICAL_MARKET",
    timezone: "UTC",
    transformation_notes: "Asian high highlighted",
    price_bounds: { minPrice: 2640.0, maxPrice: 2680.0, decimals: 2 },
    draft_chart_path: "data/drills/drafts/drill_xauusd_c1_01/case_v1.webp",
    published_chart_url: "/drills/published/drill_xauusd_c1_01/v1/case.webp",
    solution_overlay_path: "data/drills/solutions/drill_xauusd_c1_01/solution_v1.webp",
    context_prompt: "Analisis sweep pada Asian High.",
    instructions: ["Tentukan bias", "Tentukan level"],
    model_answer: mockModelAnswer,
    rubric: mockRubric,
    instructor_debrief: "Penjelasan kasus Judas Swing.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  test("1. Backward Compatibility: Database loads cleanly when new collections are absent", () => {
    const legacyData = {
      users: [{ id: "u1", email: "u1@test.com", name: "U1", password_hash: "h", role: "USER", created_at: "", updated_at: "" }],
      course_progress: [],
      quiz_submissions: [],
    };
    fs.writeFileSync(TEST_DB_PATH, JSON.stringify(legacyData, null, 2), "utf8");
    setDatabasePathForTest(TEST_DB_PATH);

    const db = getDatabase();
    assert.ok(Array.isArray(db.users), "users must be array");
    assert.ok(Array.isArray(db.drills), "drills must default to array");
    assert.ok(Array.isArray(db.drill_submissions), "drill_submissions must default to array");
    assert.ok(Array.isArray(db.trade_preparation_checklists), "trade_preparation_checklists must default to array");
    assert.strictEqual(db.drills.length, 0);
  });

  test("2. Rubric Integrity Validation: Rejects weight != 100 or safety gate > weight", () => {
    const invalidRubricSum = {
      overallPassingScore: 70,
      invalidationSafetyGatePoints: 18,
      criteria: [
        { id: "CRIT_BIAS", name: "Bias", weight: 30, description: "" },
        { id: "CRIT_ENTRY", name: "Entry", weight: 30, description: "" },
        { id: "CRIT_INVALID", name: "SL", weight: 20, description: "" },
      ],
    };
    const res1 = validateRubricIntegrity(invalidRubricSum);
    assert.strictEqual(res1.ok, false);
    assert.match(res1.error || "", /100 poin/);

    const invalidSafetyGate = {
      overallPassingScore: 70,
      invalidationSafetyGatePoints: 30,
      criteria: [
        { id: "CRIT_BIAS", name: "Bias", weight: 20, description: "" },
        { id: "CRIT_ENTRY", name: "Entry", weight: 25, description: "" },
        { id: "CRIT_INVALID", name: "SL", weight: 25, description: "" },
        { id: "CRIT_RR", name: "RR", weight: 15, description: "" },
        { id: "CRIT_CONFIRM", name: "Confirm", weight: 15, description: "" },
      ],
    };
    const res2 = validateRubricIntegrity(invalidSafetyGate);
    assert.strictEqual(res2.ok, false);
    assert.match(res2.error || "", /tidak boleh melebihi bobot/);
  });

  test("3. Model Answer Consistency: Rejects inverted stop-loss in model answer", () => {
    const badBearishModel = {
      ...mockModelAnswer,
      expectedBias: "BEARISH",
      entryZone: { min: 2660, max: 2665, ideal: 2662, tolerance: 1 },
      invalidationPrice: { ideal: 2650, tolerance: 1 },
    };
    const res = validateModelAnswerConsistency(badBearishModel);
    assert.strictEqual(res.ok, false);
    assert.match(res.error || "", /harus berada di atas zona Entry/);
  });

  test("4. Drill Case CRUD & Dual Versioning (drill_version & rubric_version)", () => {
    const admin = { id: "usr_admin_test", email: "admin@casper.internal" };
    const created = saveDrillCase(mockDrillCase, admin);
    assert.strictEqual(created.drill_version, 1);
    assert.strictEqual(created.rubric_version, 1);

    const retrieved = getDrillById("drill_xauusd_c1_01");
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.title, mockDrillCase.title);

    // Update model answer -> increments drill_version
    const updatedModelCase = {
      ...mockDrillCase,
      model_answer: {
        ...mockModelAnswer,
        minimumRiskRewardRatio: 2.5,
      },
    };
    const afterModelUpdate = saveDrillCase(updatedModelCase, admin);
    assert.strictEqual(afterModelUpdate.drill_version, 2);
    assert.strictEqual(afterModelUpdate.rubric_version, 1);

    // Update rubric -> increments rubric_version
    const updatedRubricCase = {
      ...afterModelUpdate,
      rubric: {
        ...mockRubric,
        invalidationSafetyGatePoints: 20,
      },
    };
    const afterRubricUpdate = saveDrillCase(updatedRubricCase, admin);
    assert.strictEqual(afterRubricUpdate.drill_version, 2);
    assert.strictEqual(afterRubricUpdate.rubric_version, 2);
  });

  test("5. Immutable Submission Recording & Atomic Attempt Numbering", async () => {
    const userId = "usr_student_alpha";
    const drillId = "drill_xauusd_c1_01";

    const answers = {
      bias: "BEARISH",
      isNoTrade: false,
      entryPrice: 2666.8,
      invalidationPrice: 2670.0,
      targetPrice: 2655.0,
      selectedConfirmations: ["LIQUIDITY_SWEEP"],
      rationaleText: "Sweep of Asian high confirmed",
    };

    const breakdown = [
      { criterionId: "CRIT_BIAS", criterionName: "Bias", pointsPossible: 20, pointsEarned: 20, status: "FULL_CREDIT", explanation: "OK" },
      { criterionId: "CRIT_ENTRY", criterionName: "Entry", pointsPossible: 25, pointsEarned: 25, status: "FULL_CREDIT", explanation: "OK" },
      { criterionId: "CRIT_INVALID", criterionName: "SL", pointsPossible: 25, pointsEarned: 22, status: "FULL_CREDIT", explanation: "OK" },
      { criterionId: "CRIT_RR", criterionName: "RR", pointsPossible: 15, pointsEarned: 15, status: "FULL_CREDIT", explanation: "OK" },
      { criterionId: "CRIT_CONFIRM", criterionName: "Confirm", pointsPossible: 15, pointsEarned: 10, status: "PARTIAL_CREDIT", explanation: "OK" },
    ];

    // Attempt 1
    const res1 = await recordDrillSubmission({
      userId,
      drillId,
      drillVersion: 1,
      rubricVersion: 1,
      idempotencyKey: "idemp-key-001",
      score: 92,
      invalidationScore: 22,
      safetyGatePassed: true,
      evaluationStatus: "PASSED",
      rubricSnapshot: mockRubric,
      answers,
      evaluationBreakdown: breakdown,
      debriefText: "Great job.",
    });

    assert.strictEqual(res1.isIdempotentReplay, false);
    assert.strictEqual(res1.submission.attempt_number, 1);
    assert.strictEqual(res1.submission.score, 92);
    assert.strictEqual(res1.submission.rubric_snapshot.invalidationSafetyGatePoints, 18);

    // Attempt 2
    const res2 = await recordDrillSubmission({
      userId,
      drillId,
      drillVersion: 1,
      rubricVersion: 1,
      idempotencyKey: "idemp-key-002",
      score: 95,
      invalidationScore: 25,
      safetyGatePassed: true,
      evaluationStatus: "PASSED",
      rubricSnapshot: mockRubric,
      answers,
      evaluationBreakdown: breakdown,
      debriefText: "Even better.",
    });

    assert.strictEqual(res2.isIdempotentReplay, false);
    assert.strictEqual(res2.submission.attempt_number, 2);

    const allSubs = getDrillSubmissions(userId, drillId);
    assert.strictEqual(allSubs.length, 2);
    assert.strictEqual(allSubs[0].attempt_number, 1);
    assert.strictEqual(allSubs[1].attempt_number, 2);
  });

  test("6. Idempotency Key deduplicates network retries without incrementing attempts", async () => {
    const userId = "usr_student_alpha";
    const drillId = "drill_xauusd_c1_01";

    const duplicateReplay = await recordDrillSubmission({
      userId,
      drillId,
      drillVersion: 1,
      rubricVersion: 1,
      idempotencyKey: "idemp-key-001",
      score: 92,
      invalidationScore: 22,
      safetyGatePassed: true,
      evaluationStatus: "PASSED",
      rubricSnapshot: mockRubric,
      answers: { bias: "BEARISH", isNoTrade: false, selectedConfirmations: [], rationaleText: "" },
      evaluationBreakdown: [],
      debriefText: "",
    });

    assert.strictEqual(duplicateReplay.isIdempotentReplay, true, "Must flag as idempotent replay");
    assert.strictEqual(duplicateReplay.submission.attempt_number, 1, "Must retain original attempt_number 1");

    const allSubs = getDrillSubmissions(userId, drillId);
    assert.strictEqual(allSubs.length, 2, "Must NOT append duplicate submission to database");
  });

  test("7. Derived Progress Summary accurately aggregates from immutable history", () => {
    const userId = "usr_student_alpha";
    const drillId = "drill_xauusd_c1_01";

    const summary = getStudentDrillSummary(userId, drillId);
    assert.ok(summary);
    assert.strictEqual(summary?.attemptsCount, 2);
    assert.strictEqual(summary?.firstScore, 92);
    assert.strictEqual(summary?.latestScore, 95);
    assert.strictEqual(summary?.bestScore, 95);
    assert.strictEqual(summary?.isPassed, true);
    assert.strictEqual(summary?.safetyGateMet, true);
  });

  test("8. Concurrent Submission Locking (withSubmissionLock) guarantees atomic attempt numbering", async () => {
    const userId = "usr_student_beta";
    const drillId = "drill_xauusd_c1_01";

    const promises = Array.from({ length: 5 }, (_, i) => {
      return recordDrillSubmission({
        userId,
        drillId,
        drillVersion: 1,
        rubricVersion: 1,
        idempotencyKey: `concurrent-key-${i}`,
        score: 70 + i,
        invalidationScore: 18,
        safetyGatePassed: true,
        evaluationStatus: "PASSED",
        rubricSnapshot: mockRubric,
        answers: { bias: "BEARISH", isNoTrade: false, selectedConfirmations: [], rationaleText: `Run ${i}` },
        evaluationBreakdown: [],
        debriefText: "",
      });
    });

    const results = await Promise.all(promises);
    const attemptNumbers = results.map((r) => r.submission.attempt_number).sort((a, b) => a - b);
    assert.deepStrictEqual(attemptNumbers, [1, 2, 3, 4, 5], "Attempt numbers must be strictly sequential 1, 2, 3, 4, 5 without race collision");

    const userSubs = getDrillSubmissions(userId, drillId);
    assert.strictEqual(userSubs.length, 5);
  });
});
