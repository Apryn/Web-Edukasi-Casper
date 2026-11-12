/**
 * SIGNAL CASPER ACADEMY — SPRINT 5
 * Deterministic Practical Drill Evaluation Engine
 *
 * Implements pure deterministic rubric evaluation, mandatory Invalidation Safety Gate (>=18/25),
 * contextual NO-TRADE scoring, symmetric half-up rounding, and payload sanitization.
 */

import type {
  CriterionEvaluationResult,
  DbDrillCase,
  DrillEvaluationStatus,
  DrillModelAnswer,
  DrillRubric,
  PublicDrillCase,
  StudentDrillAnswer,
  StudentDrillSummary,
} from "./drill-types";

// ── Symmetric Half-Up Rounding ────────────────────────────────────
// sign(x) * floor(|x| + 0.5)
export function roundHalfUp(val: number): number {
  if (!Number.isFinite(val)) return 0;
  const sign = val < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(val) + 0.5);
}

export interface DrillEvaluationResult {
  score: number;
  invalidationScore: number;
  safetyGatePassed: boolean;
  evaluationStatus: DrillEvaluationStatus;
  isPassed: boolean;
  passingScore: number;
  safetyGateRequirement: number;
  calculatedRiskReward: number | null;
  criteriaBreakdown: CriterionEvaluationResult[];
  instructorDebrief: string;
}

// ── Criterion Evaluators ──────────────────────────────────────────

export function evaluateBias(
  submittedBias: string | undefined,
  expectedBias: string,
  weight = 20
): CriterionEvaluationResult {
  const normSub = String(submittedBias || "").toUpperCase().trim();
  const normExp = String(expectedBias || "").toUpperCase().trim();

  if (normSub === normExp) {
    return {
      criterionId: "CRIT_BIAS",
      criterionName: "Bias & Market Context",
      pointsPossible: weight,
      pointsEarned: weight,
      status: "FULL_CREDIT",
      explanation: `Tepat. Bias arah order flow dominan adalah ${normExp}.`,
    };
  }

  return {
    criterionId: "CRIT_BIAS",
    criterionName: "Bias & Market Context",
    pointsPossible: weight,
    pointsEarned: 0,
    status: "ZERO_CREDIT",
    explanation: `Kurang tepat. Analisis struktur pasar menunjukkan bias ${normExp}, bukan ${normSub || "kosong"}.`,
  };
}

export function evaluateEntryZone(
  isNoTrade: boolean,
  isNoTradeValid: boolean,
  entryPrice: number | undefined,
  entryZone: { min: number; max: number; ideal: number; tolerance: number },
  weight = 25
): CriterionEvaluationResult {
  if (isNoTrade) {
    if (isNoTradeValid) {
      return {
        criterionId: "CRIT_ENTRY",
        criterionName: "Entry Zone Accuracy",
        pointsPossible: weight,
        pointsEarned: weight,
        status: "FULL_CREDIT",
        explanation: "Disiplin tinggi. Keputusan untuk tidak melakukan order entry tepat pada kondisi market probabilitas rendah ini.",
      };
    }
    return {
      criterionId: "CRIT_ENTRY",
      criterionName: "Entry Zone Accuracy",
      pointsPossible: weight,
      pointsEarned: 0,
      status: "ZERO_CREDIT",
      explanation: "Kondisi pasar memiliki setup terkonfirmasi dengan edge probabilitas tinggi. Keputusan NO-TRADE melewatkan eksekusi valid.",
    };
  }

  if (typeof entryPrice !== "number" || !Number.isFinite(entryPrice)) {
    return {
      criterionId: "CRIT_ENTRY",
      criterionName: "Entry Zone Accuracy",
      pointsPossible: weight,
      pointsEarned: 0,
      status: "ZERO_CREDIT",
      explanation: "Harga Entry tidak diisi atau tidak valid.",
    };
  }

  const { min, max, tolerance } = entryZone;

  // Inside exact zone
  if (entryPrice >= min && entryPrice <= max) {
    return {
      criterionId: "CRIT_ENTRY",
      criterionName: "Entry Zone Accuracy",
      pointsPossible: weight,
      pointsEarned: weight,
      status: "FULL_CREDIT",
      explanation: `Level entry ${entryPrice.toFixed(2)} tepat berada di dalam zona optimal (${min.toFixed(2)} - ${max.toFixed(2)}).`,
    };
  }

  // Within 1x tolerance
  if (entryPrice >= min - tolerance && entryPrice <= max + tolerance) {
    const points = roundHalfUp(weight * 0.72); // 18 pts
    return {
      criterionId: "CRIT_ENTRY",
      criterionName: "Entry Zone Accuracy",
      pointsPossible: weight,
      pointsEarned: points,
      status: "PARTIAL_CREDIT",
      explanation: `Level entry ${entryPrice.toFixed(2)} dapat diterima dengan toleransi, namun sedikit di luar zona ideal (${min.toFixed(2)} - ${max.toFixed(2)}).`,
    };
  }

  // Within 2x tolerance
  if (entryPrice >= min - 2 * tolerance && entryPrice <= max + 2 * tolerance) {
    const points = roundHalfUp(weight * 0.4); // 10 pts
    return {
      criterionId: "CRIT_ENTRY",
      criterionName: "Entry Zone Accuracy",
      pointsPossible: weight,
      pointsEarned: points,
      status: "PARTIAL_CREDIT",
      explanation: `Level entry ${entryPrice.toFixed(2)} terlalu jauh dari zona institusional (${min.toFixed(2)} - ${max.toFixed(2)}). Rentan chasing / front-running.`,
    };
  }

  return {
    criterionId: "CRIT_ENTRY",
    criterionName: "Entry Zone Accuracy",
    pointsPossible: weight,
    pointsEarned: 0,
    status: "ZERO_CREDIT",
    explanation: `Level entry ${entryPrice.toFixed(2)} berada jauh di luar batas toleransi struktur.`,
  };
}

export function evaluateInvalidation(
  isNoTrade: boolean,
  isNoTradeValid: boolean,
  noTradeReason: string | undefined,
  validNoTradeReasons: string[] = [],
  bias: string,
  entryPrice: number | undefined,
  invalidationPrice: number | undefined,
  idealSL: { ideal: number; tolerance: number },
  weight = 25
): CriterionEvaluationResult {
  // ── NO-TRADE Stance ─────────────────────────────────────────────
  if (isNoTrade) {
    if (isNoTradeValid) {
      const reason = String(noTradeReason || "").trim().toUpperCase();
      const matched = validNoTradeReasons.some((r) => r.toUpperCase() === reason);
      if (matched || reason.length > 5) {
        return {
          criterionId: "CRIT_INVALID",
          criterionName: "Invalidation (SL) Placement",
          pointsPossible: weight,
          pointsEarned: weight,
          status: "FULL_CREDIT",
          explanation: "Perlindungan modal sempurna. Menahan diri dari pasar berisiko tinggi adalah implementasi manajemen risiko institusional.",
        };
      }
      return {
        criterionId: "CRIT_INVALID",
        criterionName: "Invalidation (SL) Placement",
        pointsPossible: weight,
        pointsEarned: 18, // Exact Safety Gate pass
        status: "PARTIAL_CREDIT",
        explanation: "Keputusan NO-TRADE tepat menjaga modal, namun alasan invalidasi pasar belum spesifik.",
      };
    }
    return {
      criterionId: "CRIT_INVALID",
      criterionName: "Invalidation (SL) Placement",
      pointsPossible: weight,
      pointsEarned: 0,
      status: "ZERO_CREDIT",
      explanation: "Pasar memiliki setup valid dengan batas invalidasi terdefinisi jelas. Penolakan entry tanpa alasan valid dinilai 0.",
    };
  }

  // ── Position Stance ─────────────────────────────────────────────
  if (
    typeof invalidationPrice !== "number" ||
    !Number.isFinite(invalidationPrice) ||
    typeof entryPrice !== "number" ||
    !Number.isFinite(entryPrice)
  ) {
    return {
      criterionId: "CRIT_INVALID",
      criterionName: "Invalidation (SL) Placement",
      pointsPossible: weight,
      pointsEarned: 0,
      status: "ZERO_CREDIT",
      explanation: "Stop-Loss (Invalidasi) tidak diisi. Trading tanpa stop-loss adalah pelanggaran fatal manajemen risiko.",
    };
  }

  const normBias = String(bias || "").toUpperCase().trim();

  // Inverted / Illegal Stop-Loss checks
  if (normBias === "BEARISH" && invalidationPrice <= entryPrice) {
    return {
      criterionId: "CRIT_INVALID",
      criterionName: "Invalidation (SL) Placement",
      pointsPossible: weight,
      pointsEarned: 0,
      status: "ZERO_CREDIT",
      explanation: "Stop-Loss untuk posisi Bearish/Short harus berada di ATAS harga Entry. Stop-loss terbalik fatal.",
    };
  }
  if (normBias === "BULLISH" && invalidationPrice >= entryPrice) {
    return {
      criterionId: "CRIT_INVALID",
      criterionName: "Invalidation (SL) Placement",
      pointsPossible: weight,
      pointsEarned: 0,
      status: "ZERO_CREDIT",
      explanation: "Stop-Loss untuk posisi Bullish/Long harus berada di BAWAH harga Entry. Stop-loss terbalik fatal.",
    };
  }

  const { ideal, tolerance } = idealSL;
  const diff = Math.abs(invalidationPrice - ideal);

  if (diff <= tolerance) {
    return {
      criterionId: "CRIT_INVALID",
      criterionName: "Invalidation (SL) Placement",
      pointsPossible: weight,
      pointsEarned: weight, // 25 pts
      status: "FULL_CREDIT",
      explanation: `Stop-Loss ${invalidationPrice.toFixed(2)} sangat presisi di atas/bawah level pembatalan struktur institusional (${ideal.toFixed(2)}).`,
    };
  }

  if (diff <= 1.5 * tolerance) {
    return {
      criterionId: "CRIT_INVALID",
      criterionName: "Invalidation (SL) Placement",
      pointsPossible: weight,
      pointsEarned: 20, // 20 pts (Meets Safety Gate)
      status: "FULL_CREDIT",
      explanation: `Stop-Loss ${invalidationPrice.toFixed(2)} aman dan memenuhi standar keselamatan struktural dengan buffer wajar.`,
    };
  }

  if (diff <= 2.0 * tolerance) {
    return {
      criterionId: "CRIT_INVALID",
      criterionName: "Invalidation (SL) Placement",
      pointsPossible: weight,
      pointsEarned: 18, // 18 pts (Exact Safety Gate Boundary)
      status: "PARTIAL_CREDIT",
      explanation: `Stop-Loss ${invalidationPrice.toFixed(2)} memenuhi batas keselamatan minimum (18/25), namun buffer risiko sedikit berlebih.`,
    };
  }

  // Too tight inside wick noise or excessively far
  if (diff > 3.0 * tolerance) {
    return {
      criterionId: "CRIT_INVALID",
      criterionName: "Invalidation (SL) Placement",
      pointsPossible: weight,
      pointsEarned: 8, // 8 pts (Fails Safety Gate)
      status: "ZERO_CREDIT",
      explanation: `Stop-Loss ${invalidationPrice.toFixed(2)} terlalu jauh dari struktur (${ideal.toFixed(2)}), merusak efisiensi risiko dan gagal memenuhi safety gate.`,
    };
  }

  return {
    criterionId: "CRIT_INVALID",
    criterionName: "Invalidation (SL) Placement",
    pointsPossible: weight,
    pointsEarned: 12, // 12 pts (Fails Safety Gate)
    status: "PARTIAL_CREDIT",
    explanation: `Stop-Loss ${invalidationPrice.toFixed(2)} ditempatkan terlalu ketat di dalam wick likuiditas. Rentan terpicu noise pasar (gagal safety gate).`,
  };
}

export function evaluateRiskReward(
  isNoTrade: boolean,
  isNoTradeValid: boolean,
  entryPrice: number | undefined,
  invalidationPrice: number | undefined,
  targetPrice: number | undefined,
  minRR = 2.0,
  weight = 15
): { result: CriterionEvaluationResult; calculatedRR: number | null } {
  if (isNoTrade) {
    if (isNoTradeValid) {
      return {
        result: {
          criterionId: "CRIT_RR",
          criterionName: "Risk/Reward Viability",
          pointsPossible: weight,
          pointsEarned: weight,
          status: "FULL_CREDIT",
          explanation: "Menghindari trade dengan rasio imbal hasil/risiko negatif menjaga nilai ekspektasi (Expected Value) akun.",
        },
        calculatedRR: null,
      };
    }
    return {
      result: {
        criterionId: "CRIT_RR",
        criterionName: "Risk/Reward Viability",
        pointsPossible: weight,
        pointsEarned: 0,
        status: "ZERO_CREDIT",
        explanation: "Peluang risk/reward yang menguntungkan terlewatkan akibat keputusan NO-TRADE yang tidak kontekstual.",
      },
      calculatedRR: null,
    };
  }

  if (
    typeof entryPrice !== "number" ||
    typeof invalidationPrice !== "number" ||
    typeof targetPrice !== "number" ||
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(invalidationPrice) ||
    !Number.isFinite(targetPrice)
  ) {
    return {
      result: {
        criterionId: "CRIT_RR",
        criterionName: "Risk/Reward Viability",
        pointsPossible: weight,
        pointsEarned: 0,
        status: "ZERO_CREDIT",
        explanation: "Level Target (TP), Entry, atau SL tidak lengkap sehingga rasio Risk/Reward tidak dapat dihitung.",
      },
      calculatedRR: null,
    };
  }

  const risk = Math.abs(entryPrice - invalidationPrice);
  const reward = Math.abs(targetPrice - entryPrice);

  if (risk === 0) {
    return {
      result: {
        criterionId: "CRIT_RR",
        criterionName: "Risk/Reward Viability",
        pointsPossible: weight,
        pointsEarned: 0,
        status: "ZERO_CREDIT",
        explanation: "Jarak risiko 0; harga Stop-Loss sama dengan harga Entry.",
      },
      calculatedRR: 0,
    };
  }

  const rr = Math.round((reward / risk) * 100) / 100;

  if (rr >= minRR) {
    return {
      result: {
        criterionId: "CRIT_RR",
        criterionName: "Risk/Reward Viability",
        pointsPossible: weight,
        pointsEarned: weight,
        status: "FULL_CREDIT",
        explanation: `Rasio Risk/Reward 1:${rr.toFixed(2)} memenuhi standar minimum institusional (≥ 1:${minRR.toFixed(1)}).`,
      },
      calculatedRR: rr,
    };
  }

  if (rr >= 1.5) {
    return {
      result: {
        criterionId: "CRIT_RR",
        criterionName: "Risk/Reward Viability",
        pointsPossible: weight,
        pointsEarned: 10,
        status: "PARTIAL_CREDIT",
        explanation: `Rasio Risk/Reward 1:${rr.toFixed(2)} dapat diterima (≥ 1:1.5), namun di bawah target ideal institusional 1:${minRR.toFixed(1)}.`,
      },
      calculatedRR: rr,
    };
  }

  if (rr >= 1.0) {
    return {
      result: {
        criterionId: "CRIT_RR",
        criterionName: "Risk/Reward Viability",
        pointsPossible: weight,
        pointsEarned: 5,
        status: "PARTIAL_CREDIT",
        explanation: `Rasio Risk/Reward 1:${rr.toFixed(2)} marjinal. Potensi keuntungan tidak sebanding dengan risiko.`,
      },
      calculatedRR: rr,
    };
  }

  return {
    result: {
      criterionId: "CRIT_RR",
      criterionName: "Risk/Reward Viability",
      pointsPossible: weight,
      pointsEarned: 0,
      status: "ZERO_CREDIT",
      explanation: `Rasio Risk/Reward 1:${rr.toFixed(2)} merugikan (risiko lebih besar daripada potensi keuntungan).`,
    },
    calculatedRR: rr,
  };
}

export function evaluateConfirmation(
  isNoTrade: boolean,
  isNoTradeValid: boolean,
  noTradeReason: string | undefined,
  validNoTradeReasons: string[] = [],
  selectedConfirmations: string[] = [],
  requiredConfirmations: string[] = [],
  rationaleText: string = "",
  validKeywords: string[] = [],
  weight = 15
): CriterionEvaluationResult {
  if (isNoTrade) {
    if (isNoTradeValid) {
      const reason = String(noTradeReason || "").trim().toUpperCase();
      const matched = validNoTradeReasons.some((r) => r.toUpperCase() === reason);
      const normRationale = String(rationaleText || "").trim();
      if ((matched || reason.length > 5) && normRationale.length >= 15) {
        return {
          criterionId: "CRIT_CONFIRM",
          criterionName: "Structural Confirmation",
          pointsPossible: weight,
          pointsEarned: weight,
          status: "FULL_CREDIT",
          explanation: "Konfirmasi kondisi NO-TRADE tepat. Alasan dan rationale struktural mendukung penuh keputusan menahan modal.",
        };
      }
      return {
        criterionId: "CRIT_CONFIRM",
        criterionName: "Structural Confirmation",
        pointsPossible: weight,
        pointsEarned: 10,
        status: "PARTIAL_CREDIT",
        explanation: "Keputusan NO-TRADE tepat, namun deskripsi alasan struktural perlu diperjelas.",
      };
    }
    return {
      criterionId: "CRIT_CONFIRM",
      criterionName: "Structural Confirmation",
      pointsPossible: weight,
      pointsEarned: 0,
      status: "ZERO_CREDIT",
      explanation: "Konfirmasi struktur pasar valid dilewatkan tanpa dasar analisis yang tepat.",
    };
  }

  const selectedSet = new Set(selectedConfirmations.map((c) => String(c).toUpperCase().trim()));
  const requiredSet = new Set(requiredConfirmations.map((c) => String(c).toUpperCase().trim()));

  let matchedConfirmations = 0;
  for (const req of requiredSet) {
    if (selectedSet.has(req)) {
      matchedConfirmations++;
    }
  }

  const confirmRatio = requiredSet.size > 0 ? matchedConfirmations / requiredSet.size : 1;
  const tagPoints = roundHalfUp(10 * confirmRatio);

  // Rationale keyword checks
  const normRationale = String(rationaleText || "").toLowerCase();
  let keywordMatches = 0;
  for (const kw of validKeywords) {
    if (normRationale.includes(kw.toLowerCase())) {
      keywordMatches++;
    }
  }

  let keywordPoints = 0;
  if (normRationale.length >= 15) {
    keywordPoints = keywordMatches >= 2 ? 5 : keywordMatches === 1 ? 3 : 2;
  }

  const totalPoints = Math.min(weight, tagPoints + keywordPoints);

  if (totalPoints >= 12) {
    return {
      criterionId: "CRIT_CONFIRM",
      criterionName: "Structural Confirmation",
      pointsPossible: weight,
      pointsEarned: totalPoints,
      status: "FULL_CREDIT",
      explanation: `Konfirmasi struktur lengkap (${matchedConfirmations}/${requiredSet.size} konfirmasi cocok). Rationale analisis terartikulasi baik.`,
    };
  }

  if (totalPoints >= 7) {
    return {
      criterionId: "CRIT_CONFIRM",
      criterionName: "Structural Confirmation",
      pointsPossible: weight,
      pointsEarned: totalPoints,
      status: "PARTIAL_CREDIT",
      explanation: `Sebagian konfirmasi struktur terpenuhi (${matchedConfirmations}/${requiredSet.size}). Perjelas landasan entry pada alasan analisis.`,
    };
  }

  return {
    criterionId: "CRIT_CONFIRM",
    criterionName: "Structural Confirmation",
    pointsPossible: weight,
    pointsEarned: totalPoints,
    status: "ZERO_CREDIT",
    explanation: "Konfirmasi struktur tidak memadai dan alasan analisis tidak menyertakan konsep likuiditas yang tepat.",
  };
}

// ── Main Deterministic Evaluator Function ──────────────────────────

export function evaluateDrillSubmission(params: {
  submission: StudentDrillAnswer;
  modelAnswer: DrillModelAnswer;
  rubric: DrillRubric;
  instructorDebrief?: string;
}): DrillEvaluationResult {
  const { submission, modelAnswer, rubric, instructorDebrief = "" } = params;

  const biasCrit = rubric.criteria.find((c) => c.id === "CRIT_BIAS");
  const entryCrit = rubric.criteria.find((c) => c.id === "CRIT_ENTRY");
  const invalidCrit = rubric.criteria.find((c) => c.id === "CRIT_INVALID");
  const rrCrit = rubric.criteria.find((c) => c.id === "CRIT_RR");
  const confirmCrit = rubric.criteria.find((c) => c.id === "CRIT_CONFIRM");

  // 1. Evaluate Bias
  const biasEval = evaluateBias(submission.bias, modelAnswer.expectedBias, biasCrit?.weight || 20);

  // 2. Evaluate Entry Zone
  const entryEval = evaluateEntryZone(
    submission.isNoTrade,
    modelAnswer.isNoTradeValid,
    submission.entryPrice,
    modelAnswer.entryZone,
    entryCrit?.weight || 25
  );

  // 3. Evaluate Invalidation (Stop-Loss)
  const invalidEval = evaluateInvalidation(
    submission.isNoTrade,
    modelAnswer.isNoTradeValid,
    submission.noTradeReason,
    modelAnswer.validNoTradeReasons || [],
    submission.bias,
    submission.entryPrice,
    submission.invalidationPrice,
    modelAnswer.invalidationPrice,
    invalidCrit?.weight || 25
  );

  // 4. Evaluate Risk/Reward
  const rrEval = evaluateRiskReward(
    submission.isNoTrade,
    modelAnswer.isNoTradeValid,
    submission.entryPrice,
    submission.invalidationPrice,
    submission.targetPrice,
    modelAnswer.minimumRiskRewardRatio || 2.0,
    rrCrit?.weight || 15
  );

  // 5. Evaluate Confirmations
  const confirmEval = evaluateConfirmation(
    submission.isNoTrade,
    modelAnswer.isNoTradeValid,
    submission.noTradeReason,
    modelAnswer.validNoTradeReasons || [],
    submission.selectedConfirmations || [],
    modelAnswer.requiredConfirmations || [],
    submission.rationaleText || "",
    modelAnswer.validRationaleKeywords || [],
    confirmCrit?.weight || 15
  );

  const breakdown: CriterionEvaluationResult[] = [
    biasEval,
    entryEval,
    invalidEval,
    rrEval.result,
    confirmEval,
  ];

  const totalPointsEarned = breakdown.reduce((sum, c) => sum + c.pointsEarned, 0);
  const finalScore = roundHalfUp(totalPointsEarned);
  const invalidationScore = roundHalfUp(invalidEval.pointsEarned);

  const safetyGateRequirement = rubric.invalidationSafetyGatePoints ?? 18;
  const overallPassingScore = rubric.overallPassingScore ?? 70;

  const safetyGatePassed = invalidationScore >= safetyGateRequirement;
  const isPassed = finalScore >= overallPassingScore && safetyGatePassed;

  let evaluationStatus: DrillEvaluationStatus;
  if (finalScore >= overallPassingScore) {
    evaluationStatus = safetyGatePassed ? "PASSED" : "FAILED_SAFETY_GATE";
  } else {
    evaluationStatus = "FAILED";
  }

  return {
    score: finalScore,
    invalidationScore,
    safetyGatePassed,
    evaluationStatus,
    isPassed,
    passingScore: overallPassingScore,
    safetyGateRequirement,
    calculatedRiskReward: rrEval.calculatedRR,
    criteriaBreakdown: breakdown,
    instructorDebrief,
  };
}

// ── Payload Sanitizer: Strips Grading Secrets for Students ─────────

export function sanitizeDrillForStudent(
  drill: DbDrillCase,
  userSummary?: StudentDrillSummary | null
): PublicDrillCase {
  const criteriaSummary = (drill.rubric?.criteria || []).map((c) => ({
    id: c.id,
    name: c.name,
    weight: c.weight,
    safetyGateMin: c.minimumPassPoints,
  }));

  return {
    id: drill.id,
    courseId: drill.course_id,
    courseSlug: drill.course_slug,
    lessonId: drill.lesson_id,
    title: drill.title,
    slug: drill.slug,
    drillType: drill.drill_type,
    drillVersion: drill.drill_version,
    rubricVersion: drill.rubric_version,
    instrument: drill.instrument,
    timeframe: drill.timeframe,
    dataPeriod: drill.data_period,
    dataSource: drill.data_source,
    classification: drill.classification,
    timezone: drill.timezone,
    transformationNotes: drill.transformation_notes,
    priceBounds: structuredClone(drill.price_bounds),
    chartAssetUrl: drill.published_chart_url,
    contextPrompt: drill.context_prompt,
    instructions: [...(drill.instructions || [])],
    rubricCriteriaSummary: criteriaSummary,
    passingScore: drill.rubric?.overallPassingScore || 70,
    safetyGateMin: drill.rubric?.invalidationSafetyGatePoints || 18,
    userSummary: userSummary ? structuredClone(userSummary) : null,
  };
}

// ── Reproducibility Audit Function ────────────────────────────────

export function reproduceDrillEvaluation(
  answers: StudentDrillAnswer,
  modelAnswer: DrillModelAnswer,
  rubricSnapshot: DrillRubric,
  debriefText = ""
): DrillEvaluationResult {
  return evaluateDrillSubmission({
    submission: answers,
    modelAnswer,
    rubric: rubricSnapshot,
    instructorDebrief: debriefText,
  });
}
