import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

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
  roundHalfUp,
  evaluateBias,
  evaluateEntryZone,
  evaluateInvalidation,
  evaluateRiskReward,
  evaluateConfirmation,
  evaluateDrillSubmission,
  sanitizeDrillForStudent,
  reproduceDrillEvaluation,
} = await import("../lib/drill-evaluation-engine.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

describe("Task 5.2 — Deterministic Practical Drill Evaluation Engine Tests", () => {
  const standardRubric = {
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

  const standardBearishModel = {
    expectedBias: "BEARISH",
    isNoTradeValid: false,
    entryZone: { min: 2666.0, max: 2667.5, ideal: 2666.8, tolerance: 1.0 },
    invalidationPrice: { ideal: 2670.0, tolerance: 0.8 },
    targetPrice: { ideal: 2655.0, tolerance: 2.0 },
    minimumRiskRewardRatio: 2.0,
    requiredConfirmations: ["LIQUIDITY_SWEEP", "FVG_TAP"],
    validRationaleKeywords: ["sweep", "fvg", "rejection"],
  };

  test("1. Symmetric Half-Up Rounding behaves symmetrically for positive and negative values", () => {
    assert.strictEqual(roundHalfUp(1.4), 1);
    assert.strictEqual(roundHalfUp(1.5), 2);
    assert.strictEqual(roundHalfUp(1.6), 2);
    assert.strictEqual(roundHalfUp(0.5), 1);
    assert.strictEqual(roundHalfUp(0.0), 0);
    assert.strictEqual(roundHalfUp(-0.5), -1);
    assert.strictEqual(roundHalfUp(-1.4), -1);
    assert.strictEqual(roundHalfUp(-1.5), -2);
  });

  test("2. Normal Passing Case (Score >= 70, Stop-Loss >= 18) -> Status: PASSED", () => {
    const submission = {
      bias: "BEARISH",
      isNoTrade: false,
      entryPrice: 2666.8,
      invalidationPrice: 2670.2, // diff 0.2 <= tolerance 0.8 -> 25 pts
      targetPrice: 2655.0,
      selectedConfirmations: ["LIQUIDITY_SWEEP", "FVG_TAP"],
      rationaleText: "Asian high liquidity sweep into bearish FVG tap.",
    };

    const result = evaluateDrillSubmission({
      submission,
      modelAnswer: standardBearishModel,
      rubric: standardRubric,
      instructorDebrief: "Debrief note.",
    });

    assert.strictEqual(result.evaluationStatus, "PASSED");
    assert.strictEqual(result.isPassed, true);
    assert.strictEqual(result.safetyGatePassed, true);
    assert.ok(result.score >= 90, `Score should be >= 90, got: ${result.score}`);
    assert.strictEqual(result.invalidationScore, 25);
  });

  test("3. Score Below 70 -> Status: FAILED", () => {
    const submission = {
      bias: "BULLISH", // Wrong bias -> 0
      isNoTrade: false,
      entryPrice: 2660.0, // Chasing -> 0
      invalidationPrice: 2670.0, // Inverted for long -> 0
      targetPrice: 2655.0,
      selectedConfirmations: [],
      rationaleText: "",
    };

    const result = evaluateDrillSubmission({
      submission,
      modelAnswer: standardBearishModel,
      rubric: standardRubric,
    });

    assert.strictEqual(result.evaluationStatus, "FAILED");
    assert.strictEqual(result.isPassed, false);
    assert.ok(result.score < 70, `Score should be < 70, got: ${result.score}`);
  });

  test("4. Score >= 70 but Stop-Loss < 18 -> Status: FAILED_SAFETY_GATE", () => {
    // Student gets Bias (20) + Entry (25) + RR (15) + Confirm (15) = 75,
    // but places SL too tight inside wick (SL score = 12 < 18) -> Total = 87!
    const submission = {
      bias: "BEARISH", // 20
      isNoTrade: false,
      entryPrice: 2666.8, // 25
      invalidationPrice: 2668.0, // Diff = 2.0 (> 1.6 and <= 2.4) -> 12 pts (< 18)
      targetPrice: 2655.0, // 15
      selectedConfirmations: ["LIQUIDITY_SWEEP", "FVG_TAP"], // 10
      rationaleText: "Asian high liquidity sweep into fvg", // 5 -> confirm = 15
    };

    const result = evaluateDrillSubmission({
      submission,
      modelAnswer: standardBearishModel,
      rubric: standardRubric,
    });

    assert.ok(result.score >= 70, `Total score should be >= 70, got: ${result.score}`);
    assert.strictEqual(result.invalidationScore, 12, "Invalidation score should be 12 (tight wick deduction)");
    assert.strictEqual(result.safetyGatePassed, false, "Safety gate must fail (< 18)");
    assert.strictEqual(result.isPassed, false, "Must not pass overall despite score >= 70");
    assert.strictEqual(result.evaluationStatus, "FAILED_SAFETY_GATE", "Status must be FAILED_SAFETY_GATE");
  });

  test("5. Safety Gate exact boundary at 18/25 -> Status: PASSED", () => {
    // Diff between 2670.0 and 2671.4 is 1.4. Tolerance is 0.8. 1.4 <= 2.0 * 0.8 (1.6) -> 18 pts
    const submission = {
      bias: "BEARISH",
      isNoTrade: false,
      entryPrice: 2666.8,
      invalidationPrice: 2671.4, // Exactly inside 2x tolerance -> 18 pts
      targetPrice: 2655.0,
      selectedConfirmations: ["LIQUIDITY_SWEEP", "FVG_TAP"],
      rationaleText: "Sweep of Asian high with FVG rejection.",
    };

    const result = evaluateDrillSubmission({
      submission,
      modelAnswer: standardBearishModel,
      rubric: standardRubric,
    });

    assert.strictEqual(result.invalidationScore, 18, "Invalidation score must be exactly 18");
    assert.strictEqual(result.safetyGatePassed, true, "Safety gate must pass at 18");
    assert.strictEqual(result.evaluationStatus, "PASSED");
    assert.strictEqual(result.isPassed, true);
  });

  test("6. Safety Gate exact boundary at 20/25 (Pathway A Requirement) -> PASSED", () => {
    // Diff 1.0 <= 1.5 * tolerance (1.2) -> 20 pts
    const submission = {
      bias: "BEARISH",
      isNoTrade: false,
      entryPrice: 2666.8,
      invalidationPrice: 2671.0, // 20 pts
      targetPrice: 2655.0,
      selectedConfirmations: ["LIQUIDITY_SWEEP", "FVG_TAP"],
      rationaleText: "Sweep of Asian high with FVG rejection.",
    };

    const result = evaluateDrillSubmission({
      submission,
      modelAnswer: standardBearishModel,
      rubric: standardRubric,
    });

    assert.strictEqual(result.invalidationScore, 20, "Invalidation score must be exactly 20");
    assert.strictEqual(result.safetyGatePassed, true);
    assert.strictEqual(result.evaluationStatus, "PASSED");
  });

  test("7. Valid Contextual NO-TRADE -> 100/100, Stop-Loss 25/25, Safety Gate MET", () => {
    const noTradeModel = {
      ...standardBearishModel,
      isNoTradeValid: true,
      validNoTradeReasons: ["HIGH_IMPACT_NEWS_PENDING", "CHOPPY_RANGE"],
    };

    const submission = {
      bias: "BEARISH",
      isNoTrade: true,
      noTradeReason: "HIGH_IMPACT_NEWS_PENDING",
      rationaleText: "Menjelang rilis FOMC 15 menit lagi, spread dan volatilitas tinggi. Disiplin tidak entry.",
      selectedConfirmations: [],
    };

    const result = evaluateDrillSubmission({
      submission,
      modelAnswer: noTradeModel,
      rubric: standardRubric,
    });

    assert.strictEqual(result.score, 100, "Must earn 100/100 for disciplined capital preservation");
    assert.strictEqual(result.invalidationScore, 25, "Must earn 25/25 on invalidation without Stop-Loss price");
    assert.strictEqual(result.safetyGatePassed, true, "Safety gate must be MET in valid NO-TRADE");
    assert.strictEqual(result.evaluationStatus, "PASSED");
    assert.strictEqual(result.isPassed, true);
  });

  test("8. Invalid NO-TRADE on Confirmed Setup -> Penalized, Status: FAILED", () => {
    // Model answer states setup IS valid (isNoTradeValid = false)
    const submission = {
      bias: "BEARISH",
      isNoTrade: true, // Sitting out on A+ setup
      noTradeReason: "FEAR",
      rationaleText: "Takut rugi.",
    };

    const result = evaluateDrillSubmission({
      submission,
      modelAnswer: standardBearishModel,
      rubric: standardRubric,
    });

    assert.strictEqual(result.invalidationScore, 0, "Invalidation score must be 0 for unjustified inaction");
    assert.strictEqual(result.safetyGatePassed, false, "Safety gate must fail");
    assert.strictEqual(result.evaluationStatus, "FAILED");
    assert.strictEqual(result.isPassed, false);
  });

  test("9. Incomplete Submission: Missing Stop-Loss triggers immediate Safety Gate Failure", () => {
    const submission = {
      bias: "BEARISH",
      isNoTrade: false,
      entryPrice: 2666.8,
      invalidationPrice: undefined, // Missing!
      targetPrice: 2655.0,
      selectedConfirmations: ["LIQUIDITY_SWEEP"],
      rationaleText: "Forgot to set stop-loss.",
    };

    const result = evaluateDrillSubmission({
      submission,
      modelAnswer: standardBearishModel,
      rubric: standardRubric,
    });

    assert.strictEqual(result.invalidationScore, 0, "Missing Stop-Loss must yield 0 points");
    assert.strictEqual(result.safetyGatePassed, false, "Must fail safety gate");
    assert.strictEqual(result.evaluationStatus, "FAILED");
  });

  test("10. 100% Deterministic Repeated Evaluation", () => {
    const submission = {
      bias: "BEARISH",
      isNoTrade: false,
      entryPrice: 2666.8,
      invalidationPrice: 2670.0,
      targetPrice: 2655.0,
      selectedConfirmations: ["LIQUIDITY_SWEEP", "FVG_TAP"],
      rationaleText: "Asian high liquidity sweep into bearish FVG tap.",
    };

    const baseline = evaluateDrillSubmission({
      submission,
      modelAnswer: standardBearishModel,
      rubric: standardRubric,
    });

    for (let i = 0; i < 50; i++) {
      const repeated = evaluateDrillSubmission({
        submission,
        modelAnswer: standardBearishModel,
        rubric: standardRubric,
      });
      assert.strictEqual(repeated.score, baseline.score);
      assert.strictEqual(repeated.invalidationScore, baseline.invalidationScore);
      assert.strictEqual(repeated.evaluationStatus, baseline.evaluationStatus);
    }
  });

  test("11. Reproducibility using Stored Rubric Snapshot", () => {
    const answers = {
      bias: "BEARISH",
      isNoTrade: false,
      entryPrice: 2666.8,
      invalidationPrice: 2670.0,
      targetPrice: 2655.0,
      selectedConfirmations: ["LIQUIDITY_SWEEP"],
      rationaleText: "Asian high sweep",
    };

    const snapshotRubric = {
      ...standardRubric,
      overallPassingScore: 75,
      invalidationSafetyGatePoints: 20,
    };

    const original = evaluateDrillSubmission({
      submission: answers,
      modelAnswer: standardBearishModel,
      rubric: snapshotRubric,
      instructorDebrief: "Debrief 1",
    });

    const reproduced = reproduceDrillEvaluation(
      answers,
      standardBearishModel,
      snapshotRubric,
      "Debrief 1"
    );

    assert.deepStrictEqual(reproduced, original, "Reproduced evaluation must be identical to original");
  });

  test("12. Zero Answer-Key Leakage in sanitizeDrillForStudent", () => {
    const rawDrill = {
      id: "drill_secret_01",
      course_id: "course_1",
      course_slug: "course-1",
      lesson_id: "lesson_1",
      title: "Secret Drill",
      slug: "secret-drill",
      drill_type: "SETUP_EXECUTION",
      status: "PUBLISHED",
      drill_version: 1,
      rubric_version: 1,
      instrument: "XAUUSD",
      timeframe: "H1",
      data_period: "2024-10-14",
      data_source: "Tick Data",
      classification: "HISTORICAL_MARKET",
      timezone: "UTC",
      transformation_notes: "None",
      price_bounds: { minPrice: 2600, maxPrice: 2700, decimals: 2 },
      draft_chart_path: "data/drills/drafts/secret.webp",
      published_chart_url: "/drills/published/secret.webp",
      solution_overlay_path: "data/drills/solutions/secret_overlay.webp",
      context_prompt: "Public prompt",
      instructions: ["Step 1"],
      model_answer: standardBearishModel,
      rubric: standardRubric,
      instructor_debrief: "TOP SECRET INSTRUCTOR DEBRIEF TEXT",
      created_at: "",
      updated_at: "",
    };

    const sanitized = sanitizeDrillForStudent(rawDrill);

    assert.strictEqual(sanitized.id, "drill_secret_01");
    assert.strictEqual(sanitized.contextPrompt, "Public prompt");
    assert.strictEqual(sanitized.model_answer, undefined, "model_answer must NOT be exposed");
    assert.strictEqual(sanitized.solution_overlay_path, undefined, "solution_overlay_path must NOT be exposed");
    assert.strictEqual(sanitized.draft_chart_path, undefined, "draft_chart_path must NOT be exposed");
    assert.strictEqual(sanitized.instructor_debrief, undefined, "instructor_debrief must NOT be exposed");
    assert.ok(sanitized.rubricCriteriaSummary.length === 5);
  });
});
