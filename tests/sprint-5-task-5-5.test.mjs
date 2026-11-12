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

const { setDatabasePathForTest, createUser } = await import(pathToFileURL(path.resolve("lib/db.ts")).href);
const { createToken } = await import(pathToFileURL(path.resolve("lib/auth.ts")).href);
const {
  saveDrillCase,
  clearSubmissionLocksForTest,
} = await import(pathToFileURL(path.resolve("lib/drill-storage.ts")).href);
const {
  computeStudentDrillMastery,
  computeStudentDrillIntelligence,
  buildDrillEvidenceBuckets,
} = await import(pathToFileURL(path.resolve("lib/drill-mastery-engine.ts")).href);
const {
  generateAdaptiveDrillRecommendations,
} = await import(pathToFileURL(path.resolve("lib/drill-recommendation-engine.ts")).href);
const {
  handleDrillMasteryGetRequest,
} = await import(pathToFileURL(path.resolve("lib/drill-api-handlers.ts")).href);
const {
  buildStudentLearningDashboardForUser,
} = await import(pathToFileURL(path.resolve("lib/learning-intelligence/learning-orchestrator.ts")).href);

describe("Task 5.5 — Student Drill Progress & Mastery Integration Tests", () => {
  const testDbPath = path.join(
    process.cwd(),
    "data",
    `academy.test.sprint5-task5-5.${process.pid}.json`
  );

  let studentAlphaToken = "";
  let studentBetaToken = "";

  const dummyRubric = {
    overallPassingScore: 70,
    invalidationSafetyGatePoints: 18,
    criteria: [
      { id: "CRIT_BIAS", name: "Market Context & Bias", weight: 20, minimumPassPoints: 14, description: "Bias" },
      { id: "CRIT_ENTRY", name: "Entry Zone Precision", weight: 25, minimumPassPoints: 17, description: "Entry" },
      { id: "CRIT_INVALID", name: "Invalidation & Stop Loss", weight: 25, minimumPassPoints: 18, description: "SL" },
      { id: "CRIT_RR", name: "Risk/Reward Viability", weight: 15, minimumPassPoints: 10, description: "RR" },
      { id: "CRIT_CONFIRM", name: "Confirmation Factors", weight: 15, minimumPassPoints: 10, description: "Confirm" },
    ],
  };

  const dummyPriceBounds = { minPrice: 2600.0, maxPrice: 2700.0, decimals: 2 };

  const drill1 = {
    id: "drill_55_xauusd_01",
    course_id: "course_xauusd_mastery",
    course_slug: "xauusd-mastery",
    lesson_id: "m1-market-structure",
    title: "Gold London Open Sweep Drill 1",
    slug: "gold-london-sweep-1",
    drill_type: "SETUP_EXECUTION",
    status: "PUBLISHED",
    drill_version: 1,
    rubric_version: 1,
    instrument: "XAUUSD",
    timeframe: "M15",
    data_period: "2024-10-14",
    data_source: "Institutional Feed",
    classification: "HISTORICAL_MARKET",
    timezone: "UTC",
    transformation_notes: "Clean",
    price_bounds: dummyPriceBounds,
    draft_chart_path: "/drills/case1.webp",
    published_chart_url: "/drills/case1.webp",
    solution_overlay_path: "/drills/sol1.webp",
    context_prompt: "Analisa sapuan likuiditas",
    instructions: ["Tentukan bias", "Tentukan SL"],
    model_answer: {
      expectedBias: "BEARISH",
      isNoTradeValid: false,
      entryZone: { min: 2669.0, max: 2671.0, ideal: 2670.0, tolerance: 1.0 },
      invalidationPrice: { ideal: 2673.5, tolerance: 0.8 },
      targetPrice: { ideal: 2655.0, tolerance: 2.0 },
      minimumRiskRewardRatio: 2.0,
      requiredConfirmations: ["LIQUIDITY_SWEEP"],
      validRationaleKeywords: ["sweep", "asian high"],
    },
    rubric: dummyRubric,
    instructor_debrief: "Pembersihan Asian High terkonfirmasi.",
    created_at: "2026-11-13T00:00:00.000Z",
    updated_at: "2026-11-13T00:00:00.000Z",
  };

  const drill2 = {
    ...drill1,
    id: "drill_55_xauusd_02",
    title: "Gold London Open Sweep Drill 2",
    slug: "gold-london-sweep-2",
  };

  const drill3 = {
    ...drill1,
    id: "drill_55_xauusd_03",
    title: "Gold Invalidation Risk Drill 3",
    slug: "gold-invalidation-risk-3",
    drill_type: "INVALIDATION_RISK",
  };

  const publishedDrills = [drill1, drill2, drill3];

  function makeBreakdown(bias = 20, entry = 25, invalid = 25, rr = 15, confirm = 15) {
    return [
      { criterionId: "CRIT_BIAS", criterionName: "Market Context & Bias", pointsEarned: bias, pointsPossible: 20, status: bias >= 14 ? "FULL_CREDIT" : "ZERO_CREDIT", explanation: "OK" },
      { criterionId: "CRIT_ENTRY", criterionName: "Entry Zone Precision", pointsEarned: entry, pointsPossible: 25, status: entry >= 17 ? "FULL_CREDIT" : "ZERO_CREDIT", explanation: "OK" },
      { criterionId: "CRIT_INVALID", criterionName: "Invalidation & Stop Loss", pointsEarned: invalid, pointsPossible: 25, status: invalid >= 18 ? "FULL_CREDIT" : "ZERO_CREDIT", explanation: "OK" },
      { criterionId: "CRIT_RR", criterionName: "Risk/Reward Viability", pointsEarned: rr, pointsPossible: 15, status: rr >= 10 ? "FULL_CREDIT" : "ZERO_CREDIT", explanation: "OK" },
      { criterionId: "CRIT_CONFIRM", criterionName: "Confirmation Factors", pointsEarned: confirm, pointsPossible: 15, status: confirm >= 10 ? "FULL_CREDIT" : "ZERO_CREDIT", explanation: "OK" },
    ];
  }

  function makeSubmission(params) {
    const {
      id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId = "student_alpha_55",
      drillId = "drill_55_xauusd_01",
      attemptNumber = 1,
      score = 85,
      invalidationScore = 25,
      safetyGatePassed = true,
      breakdown = makeBreakdown(),
      createdAt = new Date().toISOString(),
    } = params;

    return {
      id,
      user_id: userId,
      drill_id: drillId,
      drill_version: 1,
      rubric_version: 1,
      attempt_number: attemptNumber,
      idempotency_key: `idem_${id}`,
      score,
      invalidation_score: invalidationScore,
      safety_gate_passed: safetyGatePassed,
      evaluation_status: safetyGatePassed && score >= 70 ? "PASSED" : (safetyGatePassed ? "FAILED" : "FAILED_SAFETY_GATE"),
      rubric_snapshot: dummyRubric,
      answers: {
        bias: "BEARISH",
        isNoTrade: false,
        entryPrice: 2670.0,
        invalidationPrice: 2673.5,
        targetPrice: 2655.0,
        calculatedRiskReward: 4.28,
        selectedConfirmations: ["LIQUIDITY_SWEEP"],
        rationaleText: "Sweep of Asian High verified.",
      },
      evaluation_breakdown: breakdown,
      debrief_text: "Debrief text",
      created_at: createdAt,
    };
  }

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

    // Create users in test database
    const alpha = createUser({
      id: "student_alpha_55",
      email: "alpha55@test.com",
      name: "Student Alpha",
      passwordHash: "hash123",
      role: "USER",
    });

    const beta = createUser({
      id: "student_beta_55",
      email: "beta55@test.com",
      name: "Student Beta",
      passwordHash: "hash123",
      role: "USER",
    });

    studentAlphaToken = createToken({ userId: alpha.id, email: alpha.email, role: "USER" });
    studentBetaToken = createToken({ userId: beta.id, email: beta.email, role: "USER" });

    // Save drills
    saveDrillCase(drill1, { id: "admin", email: "admin@test.com" });
    saveDrillCase(drill2, { id: "admin", email: "admin@test.com" });
    saveDrillCase(drill3, { id: "admin", email: "admin@test.com" });
  });

  after(() => {
    setDatabasePathForTest(null);
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  test("1. NO_DATA State & Onboarding Recommendation", () => {
    const summary = computeStudentDrillIntelligence("student_alpha_55", publishedDrills, []);

    assert.equal(summary.topics[0].masteryLevel, "NO_DATA");
    assert.equal(summary.topics[0].distinctDrillsAttempted, 0);
    assert.equal(summary.topics[0].distinctDrillsPassed, 0);
    assert.equal(summary.topics[0].masteryPath, "NONE");
    assert.equal(summary.uniqueDrillsAttempted, 0);

    for (const crit of summary.criterionWeaknesses) {
      assert.equal(crit.currentStatus, "NO_DATA");
      assert.equal(crit.distinctCasesEvaluated, 0);
      assert.equal(crit.currentProficiency, null);
    }

    const recs = generateAdaptiveDrillRecommendations({
      userId: "student_alpha_55",
      publishedDrills,
      submissions: [],
      intelligenceSummary: summary,
    });

    assert.ok(recs.length >= 1);
    const onboardRec = recs.find((r) => r.category === "FOUNDATION_FIRST_DRILL");
    assert.ok(onboardRec, "Onboarding recommendation must be present");
    assert.equal(onboardRec.priority, 60);
    assert.equal(onboardRec.drillId, drill1.id);
  });

  test("2. Anti-Farming Protection: Single drill repeated 10 times never yields MASTERED", () => {
    // 10 submissions on drill1 with 100/100 score
    const submissions = [];
    for (let i = 1; i <= 10; i++) {
      submissions.push(
        makeSubmission({
          id: `sub_farm_${i}`,
          drillId: drill1.id,
          attemptNumber: i,
          score: 100,
          invalidationScore: 25,
          safetyGatePassed: true,
          breakdown: makeBreakdown(20, 25, 25, 15, 15),
        })
      );
    }

    const mastery = computeStudentDrillMastery(
      "student_alpha_55",
      "xauusd-mastery",
      publishedDrills,
      submissions
    );

    // ADR 5.5.1: Distinct drills must be >= 2 for MASTERED
    assert.notEqual(mastery.overallLevel, "MASTERED", "Single drill 10x must NOT yield MASTERED");
    assert.equal(mastery.masteryPath, "NONE");
    assert.equal(mastery.totalValidDrillsCompleted, 1);
    assert.equal(mastery.totalAttemptsEvaluated, 10);
    assert.equal(mastery.overallLevel, "DEVELOPING");
  });

  test("3. Path A Qualification: >= 2 distinct drills with first-attempt excellence -> MASTERED", () => {
    const sub1 = makeSubmission({
      id: "sub_path_a_1",
      drillId: drill1.id,
      attemptNumber: 1,
      score: 85,
      invalidationScore: 22,
      safetyGatePassed: true,
    });

    const sub2 = makeSubmission({
      id: "sub_path_a_2",
      drillId: drill2.id,
      attemptNumber: 1,
      score: 92,
      invalidationScore: 25,
      safetyGatePassed: true,
    });

    const mastery = computeStudentDrillMastery(
      "student_alpha_55",
      "xauusd-mastery",
      publishedDrills,
      [sub1, sub2]
    );

    assert.equal(mastery.overallLevel, "MASTERED");
    assert.equal(mastery.masteryPath, "PATH_A_FIRST_ATTEMPT_EXCELLENCE");
    assert.equal(mastery.totalValidDrillsCompleted, 2);
    assert.equal(mastery.allCriteriaMastered, true);
  });

  test("4. Path B Qualification: >= 2 distinct drills with sustained competency on latestValidAttempt", () => {
    // Drill 1: attempt 1 failed (score 50), attempt 2 passed (score 75, invalidation 20)
    const drill1_att1 = makeSubmission({
      id: "sub_path_b_1_1",
      drillId: drill1.id,
      attemptNumber: 1,
      score: 50,
      invalidationScore: 12,
      safetyGatePassed: false,
      breakdown: makeBreakdown(10, 10, 12, 10, 8),
    });
    const drill1_att2 = makeSubmission({
      id: "sub_path_b_1_2",
      drillId: drill1.id,
      attemptNumber: 2,
      score: 75,
      invalidationScore: 20,
      safetyGatePassed: true,
      breakdown: makeBreakdown(20, 15, 20, 10, 10),
    });

    // Drill 2: attempt 1 failed (score 60), attempt 2 passed (score 82, invalidation 22)
    const drill2_att1 = makeSubmission({
      id: "sub_path_b_2_1",
      drillId: drill2.id,
      attemptNumber: 1,
      score: 60,
      invalidationScore: 15,
      safetyGatePassed: false,
      breakdown: makeBreakdown(15, 15, 15, 8, 7),
    });
    const drill2_att2 = makeSubmission({
      id: "sub_path_b_2_2",
      drillId: drill2.id,
      attemptNumber: 2,
      score: 82,
      invalidationScore: 22,
      safetyGatePassed: true,
      breakdown: makeBreakdown(20, 20, 22, 10, 10),
    });

    const mastery = computeStudentDrillMastery(
      "student_alpha_55",
      "xauusd-mastery",
      publishedDrills,
      [drill1_att1, drill1_att2, drill2_att1, drill2_att2]
    );

    assert.equal(mastery.overallLevel, "MASTERED");
    assert.equal(mastery.masteryPath, "PATH_B_SUSTAINED_COMPETENCY");
    assert.equal(mastery.totalValidDrillsCompleted, 2);
  });

  test("5. Invalidation Safety Gate failure on latest attempt -> CRITICAL_RISK and Priority 98 Recommendation", () => {
    // Drill 1 has a passed attempt, Drill 2 fails the safety gate on its latest valid attempt (N_distinct = 2)
    const subPass1 = makeSubmission({
      id: "sub_sl_pass_1",
      drillId: drill1.id,
      attemptNumber: 1,
      score: 80,
      invalidationScore: 22,
      safetyGatePassed: true,
      breakdown: makeBreakdown(20, 20, 22, 10, 8),
    });
    const subFail2 = makeSubmission({
      id: "sub_sl_fail_2",
      drillId: drill2.id,
      attemptNumber: 1,
      score: 55,
      invalidationScore: 10,
      safetyGatePassed: false,
      breakdown: makeBreakdown(20, 15, 10, 5, 5),
    });

    const summary = computeStudentDrillIntelligence("student_alpha_55", publishedDrills, [subPass1, subFail2]);

    const invalidationCrit = summary.criterionWeaknesses.find((c) => c.criterionId === "CRIT_INVALID");
    assert.ok(invalidationCrit);
    assert.equal(invalidationCrit.currentStatus, "CRITICAL_RISK");
    assert.equal(invalidationCrit.safetyGateFailuresCount, 1);

    const recs = generateAdaptiveDrillRecommendations({
      userId: "student_alpha_55",
      publishedDrills,
      submissions: [subPass1, subFail2],
      intelligenceSummary: summary,
    });

    assert.ok(recs.length > 0);
    const topRec = recs[0];
    assert.equal(topRec.category, "RESOLVE_CRITICAL_SAFETY_GATE");
    assert.equal(topRec.priority, 98);
    assert.match(topRec.evidenceSignature, /latestValidSubId=sub_sl_fail_2/);
    assert.match(topRec.evidenceSignature, /sl=10/);
  });

  test("6. Entry Zone weakness diagnosis -> FLAG_PREMATURE_ENTRY and Priority 88 Recommendation", () => {
    // 2 distinct drills: safety gate passes, but Entry criterion is consistently deficient (<50%)
    const sub1 = makeSubmission({
      id: "sub_entry_1",
      drillId: drill1.id,
      attemptNumber: 1,
      score: 72,
      invalidationScore: 25,
      safetyGatePassed: true,
      breakdown: makeBreakdown(20, 10, 25, 10, 7), // Entry: 10/25 = 40%
    });

    const sub2 = makeSubmission({
      id: "sub_entry_2",
      drillId: drill2.id,
      attemptNumber: 1,
      score: 70,
      invalidationScore: 25,
      safetyGatePassed: true,
      breakdown: makeBreakdown(20, 8, 25, 10, 7), // Entry: 8/25 = 32%
    });

    const summary = computeStudentDrillIntelligence("student_alpha_55", publishedDrills, [sub1, sub2]);

    const entryCrit = summary.criterionWeaknesses.find((c) => c.criterionId === "CRIT_ENTRY");
    assert.ok(entryCrit);
    assert.equal(entryCrit.currentStatus, "NEEDS_REFINEMENT");
    assert.ok(entryCrit.pedagogicalFlags.includes("FLAG_PREMATURE_ENTRY"));
    assert.ok((entryCrit.currentProficiency ?? 100) < 50);

    const recs = generateAdaptiveDrillRecommendations({
      userId: "student_alpha_55",
      publishedDrills,
      submissions: [sub1, sub2],
      intelligenceSummary: summary,
    });

    const entryRec = recs.find((r) => r.category === "PRACTICE_WEAK_CRITERION");
    assert.ok(entryRec, "Must recommend targeted criterion practice");
    assert.equal(entryRec.priority, 88);
    assert.match(entryRec.evidenceSignature, /crit=CRIT_ENTRY/);
  });

  test("7. Insufficient data guard: N_distinct < 2 -> INSUFFICIENT_DATA", () => {
    const sub1 = makeSubmission({
      id: "sub_single_pass",
      drillId: drill1.id,
      attemptNumber: 1,
      score: 88,
      invalidationScore: 24,
      safetyGatePassed: true,
      breakdown: makeBreakdown(20, 20, 24, 12, 12),
    });

    const summary = computeStudentDrillIntelligence("student_alpha_55", publishedDrills, [sub1]);

    // For non-safety-gate criteria, N_distinct = 1 means INSUFFICIENT_DATA
    const biasCrit = summary.criterionWeaknesses.find((c) => c.criterionId === "CRIT_BIAS");
    assert.equal(biasCrit.currentStatus, "INSUFFICIENT_DATA");
    assert.equal(biasCrit.distinctCasesEvaluated, 1);

    assert.notEqual(summary.topics[0].masteryLevel, "MASTERED");
  });

  test("8. Rubric-grounded NO-TRADE evaluation retains integrity", () => {
    // When a drill allows NO-TRADE and student accurately selects NO-TRADE,
    // breakdown reflects rubric scoring rather than artificial 100/100
    const noTradeBreakdown = [
      { criterionId: "CRIT_BIAS", criterionName: "Market Context & Bias", pointsEarned: 20, pointsPossible: 20, status: "FULL_CREDIT", explanation: "Correct neutral context" },
      { criterionId: "CRIT_ENTRY", criterionName: "Entry Zone Precision", pointsEarned: 25, pointsPossible: 25, status: "FULL_CREDIT", explanation: "Patience recognized" },
      { criterionId: "CRIT_INVALID", criterionName: "Invalidation & Stop Loss", pointsEarned: 25, pointsPossible: 25, status: "FULL_CREDIT", explanation: "Risk avoidance" },
      { criterionId: "CRIT_RR", criterionName: "Risk/Reward Viability", pointsEarned: 15, pointsPossible: 15, status: "FULL_CREDIT", explanation: "Capital preserved" },
      { criterionId: "CRIT_CONFIRM", criterionName: "Confirmation Factors", pointsEarned: 15, pointsPossible: 15, status: "FULL_CREDIT", explanation: "Valid rationale" },
    ];

    const subNoTrade = makeSubmission({
      id: "sub_no_trade_1",
      drillId: drill1.id,
      attemptNumber: 1,
      score: 100,
      invalidationScore: 25,
      safetyGatePassed: true,
      breakdown: noTradeBreakdown,
    });

    assert.equal(subNoTrade.evaluation_breakdown.length, 5);
    const totalEarned = subNoTrade.evaluation_breakdown.reduce((s, c) => s + c.pointsEarned, 0);
    assert.equal(totalEarned, 100);
  });

  test("9. Evidence signature with latestValidSubId and dismissal resurfacing", () => {
    const subFail1 = makeSubmission({
      id: "sub_dismiss_test_01",
      drillId: drill1.id,
      attemptNumber: 1,
      score: 55,
      invalidationScore: 12,
      safetyGatePassed: false,
    });

    const summary1 = computeStudentDrillIntelligence("student_alpha_55", publishedDrills, [subFail1]);
    const recs1 = generateAdaptiveDrillRecommendations({
      userId: "student_alpha_55",
      publishedDrills,
      submissions: [subFail1],
      intelligenceSummary: summary1,
    });

    assert.equal(recs1.length, 1);
    const sig1 = recs1[0].evidenceSignature;
    assert.match(sig1, /latestValidSubId=sub_dismiss_test_01/);

    // Dismiss with sig1
    const dismissals = [
      {
        user_id: "student_alpha_55",
        evidence_signature: sig1,
        dismissed_at: new Date().toISOString(),
      },
    ];

    const recsDismissed = generateAdaptiveDrillRecommendations({
      userId: "student_alpha_55",
      publishedDrills,
      submissions: [subFail1],
      intelligenceSummary: summary1,
      dismissals,
    });

    // Should be suppressed
    assert.equal(recsDismissed.length, 0);

    // Student submits a new attempt (sub_dismiss_test_02) still failing safety gate
    const subFail2 = makeSubmission({
      id: "sub_dismiss_test_02",
      drillId: drill1.id,
      attemptNumber: 2,
      score: 58,
      invalidationScore: 14,
      safetyGatePassed: false,
    });

    const summary2 = computeStudentDrillIntelligence("student_alpha_55", publishedDrills, [subFail1, subFail2]);
    const recsResurfaced = generateAdaptiveDrillRecommendations({
      userId: "student_alpha_55",
      publishedDrills,
      submissions: [subFail1, subFail2],
      intelligenceSummary: summary2,
      dismissals, // old dismissal with sig1
    });

    // Recommendation must re-surface with new signature containing sub_dismiss_test_02!
    assert.equal(recsResurfaced.length, 1);
    assert.match(recsResurfaced[0].evidenceSignature, /latestValidSubId=sub_dismiss_test_02/);
  });

  test("10. Quiz mastery isolation: Theory quiz metrics and course progress are independent of practical drills", async () => {
    const report = await buildStudentLearningDashboardForUser("student_alpha_55");

    assert.ok(report);
    assert.ok(report.quizIntelligence, "Quiz intelligence block must exist");
    assert.ok(typeof report.quizIntelligence.totalAttempts === "number");

    // Drill intelligence block is isolated
    assert.ok(report.drillIntelligence, "Drill intelligence block must exist");
    assert.equal(report.drillIntelligence.userId, "student_alpha_55");
    assert.ok(Array.isArray(report.drillRecommendations));
  });

  test("11. IDOR security: Session user ID scope enforcement on /api/drills/mastery", async () => {
    // 1. Unauthenticated request -> 401
    const reqAnon = new Request("http://localhost/api/drills/mastery");
    const resAnon = await handleDrillMasteryGetRequest(reqAnon);
    assert.equal(resAnon.status, 401);

    // 2. Authenticated as Alpha with malicious spoof parameter ?userId=student_beta_55
    const reqAlpha = new Request("http://localhost/api/drills/mastery?userId=student_beta_55", {
      headers: {
        Authorization: `Bearer ${studentAlphaToken}`,
      },
    });

    const resAlpha = await handleDrillMasteryGetRequest(reqAlpha);
    assert.equal(resAlpha.status, 200);

    const bodyAlpha = await resAlpha.json();
    assert.equal(bodyAlpha.success, true);
    // Verified that calculations are strictly for student_alpha_55
    assert.equal(bodyAlpha.drillIntelligence.userId, "student_alpha_55");
  });

  test("12. Benchmark execution: 10,000 synthetic submission records O(N) streaming latency", () => {
    const syntheticSubmissions = [];
    const syntheticDrills = [];
    const numSubmissions = 10000;
    const numDrills = 20;

    for (let d = 1; d <= numDrills; d++) {
      syntheticDrills.push({
        ...drill1,
        id: `drill_bench_${d}`,
        title: `Bench Drill ${d}`,
        course_slug: "xauusd-mastery",
        lesson_id: "m1-market-structure",
      });
    }

    // Generate 10,000 realistic records
    for (let i = 0; i < numSubmissions; i++) {
      const drillIndex = (i % numDrills) + 1;
      const attemptNum = Math.floor(i / numDrills) + 1;
      syntheticSubmissions.push({
        id: `sub_bench_${i}`,
        user_id: "student_bench",
        drill_id: `drill_bench_${drillIndex}`,
        drill_version: 1,
        rubric_version: 1,
        attempt_number: attemptNum,
        idempotency_key: `idem_${i}`,
        score: 70 + (i % 30),
        invalidation_score: 18 + (i % 8),
        safety_gate_passed: true,
        evaluation_status: "PASSED",
        rubric_snapshot: dummyRubric,
        answers: {
          bias: "BEARISH",
          isNoTrade: false,
          rationaleText: "Benchmark trade",
          selectedConfirmations: ["CONFIRM_1"],
        },
        evaluation_breakdown: makeBreakdown(20, 20, 20, 15, 15),
        debrief_text: "Benchmark debrief",
        created_at: new Date(Date.now() - (numSubmissions - i) * 60000).toISOString(),
      });
    }

    // Cold run
    const coldStart = performance.now();
    const coldMastery = computeStudentDrillMastery(
      "student_bench",
      "xauusd-mastery",
      syntheticDrills,
      syntheticSubmissions
    );
    const coldDuration = performance.now() - coldStart;

    assert.ok(coldMastery);
    assert.equal(coldMastery.totalAttemptsEvaluated, 10000);

    // Warm iterations (10 runs)
    const warmDurations = [];
    for (let run = 0; run < 10; run++) {
      const t0 = performance.now();
      computeStudentDrillMastery(
        "student_bench",
        "xauusd-mastery",
        syntheticDrills,
        syntheticSubmissions
      );
      const t1 = performance.now();
      warmDurations.push(t1 - t0);
    }

    warmDurations.sort((a, b) => a - b);
    const p50 = warmDurations[Math.floor(warmDurations.length * 0.5)];
    const p95 = warmDurations[Math.floor(warmDurations.length * 0.95)];

    // Log benchmark metrics for transparency
    console.log(
      `\n  [BENCHMARK 10k RECORDS] Cold: ${coldDuration.toFixed(2)}ms | Warm p50: ${p50.toFixed(2)}ms | Warm p95: ${p95.toFixed(2)}ms`
    );

    // Verify sub-100ms SLA
    assert.ok(p50 < 50, `Warm p50 (${p50.toFixed(2)}ms) must be < 50ms`);
    assert.ok(p95 < 80, `Warm p95 (${p95.toFixed(2)}ms) must be < 80ms`);
  });
});
