/**
 * SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
 * Pure Mastery & Weakness Calculation Engine
 *
 * Implements deterministic, anti-farming multi-case mastery evaluation,
 * canonical 5-criterion weakness profiling, and learning trajectory tracking
 * via single-pass O(N) memory streaming over immutable drill submissions.
 */

import type {
  DbDrillCase,
  DbDrillSubmission,
  CriterionId,
  CriterionEvaluationResult,
  StudentDrillTopicMastery,
  StudentCriterionPerformancePerspective,
  StudentDrillIntelligenceSummary,
  DrillTopicMasteryLevel,
  DrillDiagnosticStatus,
  DrillTrajectoryDirection,
} from "./drill-types";

// ── 1. Validation & Integrity Guards ─────────────────────────────────

/**
 * Validates whether a submission record satisfies all A_valid integrity invariants.
 * Corrupt or malformed records are quarantined defensively and excluded
 * from positive or negative analytics.
 */
export function validateSubmissionIntegrity(sub: unknown): sub is DbDrillSubmission {
  if (!sub || typeof sub !== "object") return false;
  const s = sub as Record<string, unknown>;

  if (typeof s.id !== "string" || s.id.trim().length === 0) return false;
  if (typeof s.user_id !== "string" || s.user_id.trim().length === 0) return false;
  if (typeof s.drill_id !== "string" || s.drill_id.trim().length === 0) return false;
  if (typeof s.attempt_number !== "number" || !Number.isInteger(s.attempt_number) || s.attempt_number < 1) {
    return false;
  }
  if (typeof s.score !== "number" || Number.isNaN(s.score) || s.score < 0 || s.score > 100) {
    return false;
  }
  if (
    typeof s.invalidation_score !== "number" ||
    Number.isNaN(s.invalidation_score) ||
    s.invalidation_score < 0 ||
    s.invalidation_score > 25
  ) {
    return false;
  }
  if (typeof s.safety_gate_passed !== "boolean") return false;
  if (!Array.isArray(s.evaluation_breakdown) || s.evaluation_breakdown.length === 0) return false;
  if (!s.rubric_snapshot || typeof s.rubric_snapshot !== "object") return false;
  if (typeof s.created_at !== "string" || Number.isNaN(Date.parse(s.created_at))) return false;

  return true;
}

// ── 2. Single-Pass Memory Streaming Buckets ──────────────────────────

type CompatibleCriterionItem = CriterionEvaluationResult & {
  criterion_id?: CriterionId;
  points_earned?: number;
  points_possible?: number;
};

export interface DrillEvidenceBucket {
  drillId: string;
  firstSubmittedAttempt: DbDrillSubmission | null;
  firstValidAttempt: DbDrillSubmission | null;
  latestValidAttempt: DbDrillSubmission | null;
  validAttemptsCount: number;
  totalAttemptsCount: number;
  allValidSubmissions: DbDrillSubmission[];
}

/**
 * Aggregates a student's full historical submissions into per-drill evidence buckets
 * in a single linear pass O(N) using O(D) auxiliary space.
 * 100% mathematically equivalent to full-history scans without data windowing.
 */
export function buildDrillEvidenceBuckets(
  submissions: DbDrillSubmission[]
): Map<string, DrillEvidenceBucket> {
  const buckets = new Map<string, DrillEvidenceBucket>();

  // Ensure chronological ordering so single-pass bucket assignment is deterministic
  const sorted = [...submissions].sort((a, b) => {
    const timeA = Date.parse(a.created_at) || 0;
    const timeB = Date.parse(b.created_at) || 0;
    if (timeA !== timeB) return timeA - timeB;
    return (a.attempt_number || 0) - (b.attempt_number || 0);
  });

  for (const sub of sorted) {
    const drillId = sub.drill_id;
    if (!drillId) continue;

    let bucket = buckets.get(drillId);
    if (!bucket) {
      bucket = {
        drillId,
        firstSubmittedAttempt: null,
        firstValidAttempt: null,
        latestValidAttempt: null,
        validAttemptsCount: 0,
        totalAttemptsCount: 0,
        allValidSubmissions: [],
      };
      buckets.set(drillId, bucket);
    }

    bucket.totalAttemptsCount++;

    // Track attempt_number === 1 regardless of validity to check firstSubmittedAttempt
    if (sub.attempt_number === 1 && !bucket.firstSubmittedAttempt) {
      bucket.firstSubmittedAttempt = sub;
    }

    // Integrity check
    if (validateSubmissionIntegrity(sub)) {
      if (!bucket.firstValidAttempt) {
        bucket.firstValidAttempt = sub;
      }
      bucket.latestValidAttempt = sub;
      bucket.validAttemptsCount++;
      bucket.allValidSubmissions.push(sub);
    }
  }

  return buckets;
}

// ── 3. Multi-Case Topic Mastery Engine ───────────────────────────────

export function computeStudentTopicMastery(params: {
  userId: string;
  publishedDrills: DbDrillCase[];
  buckets: Map<string, DrillEvidenceBucket>;
}): StudentDrillTopicMastery[] {
  const { publishedDrills, buckets } = params;

  // Group published drills by topic
  const topicMap = new Map<string, { topicTitle: string; courseSlug: string; drills: DbDrillCase[] }>();

  for (const drill of publishedDrills) {
    const topicId = drill.lesson_id || drill.course_slug || "general-drills";
    const topicTitle = drill.title.split("—")[0]?.trim() || drill.title.split("-")[0]?.trim() || topicId;
    const courseSlug = drill.course_slug || "general";

    let entry = topicMap.get(topicId);
    if (!entry) {
      entry = { topicTitle, courseSlug, drills: [] };
      topicMap.set(topicId, entry);
    }
    entry.drills.push(drill);
  }

  const results: StudentDrillTopicMastery[] = [];

  for (const [topicId, { topicTitle, courseSlug, drills }] of topicMap.entries()) {
    const totalAvailableDrills = drills.length;
    let distinctDrillsAttempted = 0;
    let distinctDrillsPassed = 0;
    let pathAQualifiedCount = 0;
    let pathBQualifiedCount = 0;

    let totalScoreSum = 0;
    let bestScoreMax: number | null = null;
    let lastAttemptDate: string | null = null;
    let nextRecommendedDrillId: string | null = null;

    for (const drill of drills) {
      const bucket = buckets.get(drill.id);
      if (!bucket || bucket.validAttemptsCount === 0) {
        if (!nextRecommendedDrillId) {
          nextRecommendedDrillId = drill.id;
        }
        continue;
      }

      distinctDrillsAttempted++;

      const latest = bucket.latestValidAttempt;
      if (latest) {
        totalScoreSum += latest.score;
        if (bestScoreMax === null || latest.score > bestScoreMax) {
          bestScoreMax = latest.score;
        }
        if (!lastAttemptDate || Date.parse(latest.created_at) > Date.parse(lastAttemptDate)) {
          lastAttemptDate = latest.created_at;
        }

        // Check if latest valid attempt passes
        if (latest.score >= 70 && latest.safety_gate_passed) {
          distinctDrillsPassed++;
        }
      }

      // Check Path A Qualification:
      // Must be firstSubmittedAttempt (attempt_number === 1), valid, score >= 80, invalidation >= 20, safety gate true
      const firstSub = bucket.firstSubmittedAttempt;
      if (
        firstSub &&
        validateSubmissionIntegrity(firstSub) &&
        firstSub.attempt_number === 1 &&
        firstSub.score >= 80 &&
        firstSub.invalidation_score >= 20 &&
        firstSub.safety_gate_passed === true
      ) {
        pathAQualifiedCount++;
      }

      // Check Path B Qualification:
      // Must be latestValidAttempt, score >= 70, invalidation >= 18, safety gate true
      if (
        latest &&
        latest.score >= 70 &&
        latest.invalidation_score >= 18 &&
        latest.safety_gate_passed === true
      ) {
        pathBQualifiedCount++;
      }
    }

    const averageScore =
      distinctDrillsAttempted > 0
        ? Math.round((totalScoreSum / distinctDrillsAttempted) * 10) / 10
        : null;

    let totalTopicAttempts = 0;
    for (const drill of drills) {
      const bucket = buckets.get(drill.id);
      if (bucket) totalTopicAttempts += bucket.validAttemptsCount;
    }

    // Determine 4-state formal mastery
    let masteryLevel: DrillTopicMasteryLevel = "NO_DATA";
    let masteryPath: "PATH_A_FIRST_ATTEMPT_EXCELLENCE" | "PATH_B_SUSTAINED_COMPETENCY" | "NONE" = "NONE";

    if (distinctDrillsAttempted === 0) {
      masteryLevel = "NO_DATA";
    } else if (pathAQualifiedCount >= 2) {
      masteryLevel = "MASTERED";
      masteryPath = "PATH_A_FIRST_ATTEMPT_EXCELLENCE";
    } else if (pathBQualifiedCount >= 2) {
      masteryLevel = "MASTERED";
      masteryPath = "PATH_B_SUSTAINED_COMPETENCY";
    } else if (distinctDrillsPassed >= 1) {
      masteryLevel = "DEVELOPING";
    } else {
      masteryLevel = "NEEDS_PRACTICE";
    }

    results.push({
      topicId,
      topicTitle,
      courseSlug,
      totalAvailableDrills,
      distinctDrillsAttempted,
      distinctDrillsPassed,
      pathAQualifiedCount,
      pathBQualifiedCount,
      averageScore,
      bestScore: bestScoreMax,
      masteryLevel,
      overallLevel: masteryLevel,
      totalValidDrillsCompleted: distinctDrillsPassed,
      totalAttemptsEvaluated: totalTopicAttempts,
      masteryPath,
      allCriteriaMastered: masteryLevel === "MASTERED",
      lastAttemptAt: lastAttemptDate,
      masteredAt: masteryLevel === "MASTERED" ? lastAttemptDate : null,
      nextRecommendedDrillId,
    });
  }

  return results;
}

export function computeStudentDrillMastery(
  userId: string,
  topicOrCourseSlug: string,
  publishedDrills: DbDrillCase[],
  submissions: DbDrillSubmission[]
): StudentDrillTopicMastery {
  const userSubmissions = submissions.filter((s) => s.user_id === userId);
  const buckets = buildDrillEvidenceBuckets(userSubmissions);
  const topicSummaries = computeStudentTopicMastery({
    userId,
    publishedDrills,
    buckets,
  });

  const matched =
    topicSummaries.find(
      (t) => t.topicId === topicOrCourseSlug || t.courseSlug === topicOrCourseSlug
    ) || topicSummaries[0];

  if (matched) {
    return matched;
  }

  return {
    topicId: topicOrCourseSlug,
    topicTitle: topicOrCourseSlug,
    courseSlug: topicOrCourseSlug,
    totalAvailableDrills: publishedDrills.length,
    distinctDrillsAttempted: 0,
    distinctDrillsPassed: 0,
    pathAQualifiedCount: 0,
    pathBQualifiedCount: 0,
    averageScore: null,
    bestScore: null,
    masteryLevel: "NO_DATA",
    overallLevel: "NO_DATA",
    totalValidDrillsCompleted: 0,
    totalAttemptsEvaluated: 0,
    masteryPath: "NONE",
    allCriteriaMastered: false,
    lastAttemptAt: null,
    masteredAt: null,
    nextRecommendedDrillId: null,
  };
}

// ── 4. Canonical Criterion Weakness & Trajectory Engine ───────────────

const CANONICAL_CRITERIA: Array<{ id: CriterionId; name: string; weight: number }> = [
  { id: "CRIT_BIAS", name: "Bias & Regime Pasar", weight: 20 },
  { id: "CRIT_ENTRY", name: "Zona Entry Presisi", weight: 25 },
  { id: "CRIT_INVALID", name: "Proteksi Invalidation (Safety Gate)", weight: 25 },
  { id: "CRIT_RR", name: "Rasio Risk-to-Reward", weight: 15 },
  { id: "CRIT_CONFIRM", name: "Checklist Konfirmasi & Tesis", weight: 15 },
];

export function computeCriterionWeaknesses(params: {
  publishedDrills: DbDrillCase[];
  buckets: Map<string, DrillEvidenceBucket>;
}): StudentCriterionPerformancePerspective[] {
  const { publishedDrills, buckets } = params;

  // Filter buckets for drills that are currently PUBLISHED
  const publishedIds = new Set(publishedDrills.map((d) => d.id));
  const activeBuckets: DrillEvidenceBucket[] = [];

  for (const [drillId, bucket] of buckets.entries()) {
    if (publishedIds.has(drillId) && bucket.validAttemptsCount > 0 && bucket.latestValidAttempt) {
      activeBuckets.push(bucket);
    }
  }

  const distinctCasesEvaluated = activeBuckets.length;
  const results: StudentCriterionPerformancePerspective[] = [];

  for (const criterion of CANONICAL_CRITERIA) {
    const cId = criterion.id;
    let totalAttemptsEvaluated = 0;
    let safetyGateFailuresCount = 0;

    // Accumulators for Current Competency (latestValidAttempt)
    let currentEarnedSum = 0;
    let currentPossibleSum = 0;
    const currentScores: number[] = [];

    // Accumulators for Initial Performance (firstValidAttempt)
    let initialEarnedSum = 0;
    let initialPossibleSum = 0;
    let initialSafetyPassedCount = 0;

    // Multi-attempt drills for Trajectory
    let multiAttemptCount = 0;
    let criterionTrajectoryDeltaSum = 0;

    for (const bucket of activeBuckets) {
      totalAttemptsEvaluated += bucket.validAttemptsCount;

      const latest = bucket.latestValidAttempt;
      const firstValid = bucket.firstValidAttempt;

      if (latest && Array.isArray(latest.evaluation_breakdown)) {
        const item = (latest.evaluation_breakdown as CompatibleCriterionItem[]).find(
          (b) => b.criterionId === cId || b.criterion_id === cId
        );
        if (item) {
          const earned = item.pointsEarned ?? item.points_earned ?? 0;
          const possible = item.pointsPossible ?? item.points_possible ?? 0;
          currentEarnedSum += earned;
          currentPossibleSum += possible;
          if (possible > 0) {
            currentScores.push((earned / possible) * 100);
          }
        }
        if (cId === "CRIT_INVALID" && (!latest.safety_gate_passed || latest.invalidation_score < 18)) {
          safetyGateFailuresCount++;
        }
      }

      if (firstValid && Array.isArray(firstValid.evaluation_breakdown)) {
        const item = (firstValid.evaluation_breakdown as CompatibleCriterionItem[]).find(
          (b) => b.criterionId === cId || b.criterion_id === cId
        );
        if (item) {
          const earned = item.pointsEarned ?? item.points_earned ?? 0;
          const possible = item.pointsPossible ?? item.points_possible ?? 0;
          initialEarnedSum += earned;
          initialPossibleSum += possible;
        }
        if (firstValid.safety_gate_passed) {
          initialSafetyPassedCount++;
        }
      }

      if (
        bucket.validAttemptsCount >= 2 &&
        latest &&
        firstValid &&
        Array.isArray(latest.evaluation_breakdown) &&
        Array.isArray(firstValid.evaluation_breakdown)
      ) {
        const latestBreakdown = latest.evaluation_breakdown as CompatibleCriterionItem[];
        const firstBreakdown = firstValid.evaluation_breakdown as CompatibleCriterionItem[];
        const latestItem = latestBreakdown.find((b) => b.criterionId === cId || b.criterion_id === cId);
        const firstItem = firstBreakdown.find((b) => b.criterionId === cId || b.criterion_id === cId);
        if (latestItem && firstItem) {
          const lEarned = latestItem.pointsEarned ?? latestItem.points_earned ?? 0;
          const lPossible = latestItem.pointsPossible ?? latestItem.points_possible ?? 0;
          const fEarned = firstItem.pointsEarned ?? firstItem.points_earned ?? 0;
          const fPossible = firstItem.pointsPossible ?? firstItem.points_possible ?? 0;
          if (lPossible > 0 && fPossible > 0) {
            const latestPct = (lEarned / lPossible) * 100;
            const firstPct = (fEarned / fPossible) * 100;
            criterionTrajectoryDeltaSum += latestPct - firstPct;
            multiAttemptCount++;
          }
        }
      }
    }

    // Compute proficiencies
    const currentProficiency =
      distinctCasesEvaluated > 0 && currentPossibleSum > 0
        ? Math.round((currentEarnedSum / currentPossibleSum) * 1000) / 10
        : null;

    const initialProficiency =
      distinctCasesEvaluated > 0 && initialPossibleSum > 0
        ? Math.round((initialEarnedSum / initialPossibleSum) * 1000) / 10
        : null;

    const initialSafetyGatePassed =
      distinctCasesEvaluated > 0 ? initialSafetyPassedCount === distinctCasesEvaluated : null;

    // Trajectory metric (raw score points, rounded to 1 decimal place)
    let criterionTrajectoryDelta: number | null = null;
    let trajectoryDirection: DrillTrajectoryDirection = "NOT_APPLICABLE";

    if (multiAttemptCount > 0) {
      criterionTrajectoryDelta = Math.round((criterionTrajectoryDeltaSum / multiAttemptCount) * 10) / 10;
      if (criterionTrajectoryDelta >= 15.0) {
        trajectoryDirection = "IMPROVED";
      } else if (criterionTrajectoryDelta <= -15.0) {
        trajectoryDirection = "REGRESSED";
      } else {
        trajectoryDirection = "NO_MATERIAL_CHANGE";
      }
    }

    // Formal Warning Flags
    const warningFlags: string[] = [];

    // Check borderline safety
    if (cId === "CRIT_INVALID") {
      const hasBorderline = activeBuckets.some(
        (b) => b.latestValidAttempt && b.latestValidAttempt.invalidation_score === 18
      );
      if (hasBorderline) warningFlags.push("WARN_BORDERLINE_SAFETY");
    }

    // Check high variance
    if (currentScores.length >= 2) {
      const mean = currentScores.reduce((acc, v) => acc + v, 0) / currentScores.length;
      const variance =
        currentScores.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / currentScores.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev >= 20.0) warningFlags.push("WARN_HIGH_VARIANCE");
    }

    // Check trajectory regression
    if (criterionTrajectoryDelta !== null && criterionTrajectoryDelta <= -15.0) {
      warningFlags.push("WARN_TRAJECTORY_REGRESSION");
    }

    // Canonical Classifier Decision Tree (Strict Disjoint Boundaries)
    let currentStatus: DrillDiagnosticStatus = "NO_DATA";

    if (distinctCasesEvaluated === 0 || currentProficiency === null) {
      currentStatus = "NO_DATA";
    } else if (distinctCasesEvaluated < 2) {
      currentStatus = "INSUFFICIENT_DATA";
    } else {
      // N_distinct >= 2
      if (cId === "CRIT_INVALID") {
        if (safetyGateFailuresCount > 0 || currentProficiency < 60.0) {
          currentStatus = "CRITICAL_RISK";
        } else if (currentProficiency < 75.0) {
          currentStatus = "NEEDS_REFINEMENT";
        } else {
          currentStatus = "STABLE_PROFICIENT";
        }
      } else {
        // Non-invalidation criteria never become CRITICAL_RISK
        if (currentProficiency < 75.0) {
          currentStatus = "NEEDS_REFINEMENT";
        } else {
          currentStatus = "STABLE_PROFICIENT";
        }
      }
    }

    // Secondary Pedagogical Flags (Informative annotations, do not alter status)
    const pedagogicalFlags: string[] = [];
    let pedagogicalFeedback = "";

    if (cId === "CRIT_INVALID") {
      if (currentStatus === "CRITICAL_RISK") {
        pedagogicalFlags.push("FLAG_INVALIDATION_VULNERABLE");
        pedagogicalFeedback =
          "Proteksi Stop-Loss berisiko tinggi. Invalidation diletakkan terlalu sempit atau melanggar batas risiko struktural.";
      } else if (currentStatus === "NEEDS_REFINEMENT") {
        pedagogicalFeedback =
          "Penempatan Invalidation cukup aman namun membutuhkan kalibrasi presisi pada level swing point.";
      } else {
        pedagogicalFeedback = "Disiplin proteksi modal dan penempatan Invalidation solid dan konsisten.";
      }
    } else if (cId === "CRIT_ENTRY") {
      if (currentProficiency !== null && currentProficiency < 65.0) {
        pedagogicalFlags.push("FLAG_PREMATURE_ENTRY");
        pedagogicalFeedback =
          "Kecenderungan masuk terlalu awal sebelum konfirmasi atau retest zona diskon/premium selesai.";
      } else if (currentStatus === "NEEDS_REFINEMENT") {
        pedagogicalFeedback = "Akurasi penempatan level entry membutuhkan latihan pada zona diskon.";
      } else {
        pedagogicalFeedback = "Presisi eksekusi zona entry stabil dan sesuai metodologi.";
      }
    } else if (cId === "CRIT_RR") {
      if (currentProficiency !== null && currentProficiency < 65.0) {
        pedagogicalFlags.push("FLAG_SUBOPTIMAL_RR");
        pedagogicalFeedback =
          "Sering menerima rasio Risk-to-Reward asimetris yang kurang optimal (< 1:2.0).";
      } else if (currentStatus === "NEEDS_REFINEMENT") {
        pedagogicalFeedback = "Target profit perlu dipetakan ke likuiditas lawan yang lebih proporsional.";
      } else {
        pedagogicalFeedback = "Pemetaan Risk-to-Reward asimetris sangat baik (>= 1:2.0).";
      }
    } else if (cId === "CRIT_CONFIRM") {
      if (currentProficiency !== null && currentProficiency < 60.0) {
        pedagogicalFlags.push("FLAG_CONFIRMATION_DEFICIT");
        pedagogicalFeedback =
          "Checklist konfirmasi struktural dan argumen tesis analisa sering terlewat.";
      } else if (currentStatus === "NEEDS_REFINEMENT") {
        pedagogicalFeedback = "Rasionalisasi tesis analisa grafik perlu diuraikan lebih lengkap.";
      } else {
        pedagogicalFeedback = "Verifikasi konfirmasi checklist struktural lengkap dan akurat.";
      }
    } else if (cId === "CRIT_BIAS") {
      if (currentStatus === "NEEDS_REFINEMENT") {
        pedagogicalFeedback = "Analisa arah aliran pesanan (order flow) dan regime pasar perlu diperkuat.";
      } else {
        pedagogicalFeedback = "Identifikasi directional bias dan tren pasar sangat akurat.";
      }
    }

    results.push({
      criterionId: cId,
      criterionName: criterion.name,
      weight: criterion.weight,
      currentProficiency,
      currentStatus,
      initialProficiency,
      initialSafetyGatePassed,
      criterionTrajectoryDelta,
      trajectoryDirection,
      distinctCasesEvaluated,
      totalAttemptsEvaluated,
      safetyGateFailuresCount,
      warningFlags,
      pedagogicalFlags,
      pedagogicalFeedback,
    });
  }

  return results;
}

// ── 5. Complete Student Intelligence Summary Generator ───────────────

export function computeStudentDrillIntelligence(
  userId: string,
  publishedDrills: DbDrillCase[],
  allSubmissions: DbDrillSubmission[]
): StudentDrillIntelligenceSummary {
  // Defensive filter: only submissions belonging to this user
  const userSubmissions = allSubmissions.filter((s) => s.user_id === userId);

  // Single-pass O(N) streaming aggregation
  const buckets = buildDrillEvidenceBuckets(userSubmissions);

  // Filter for published drills
  const publishedDrillMap = new Map(publishedDrills.map((d) => [d.id, d]));
  const attemptedPublishedDrills: DrillEvidenceBucket[] = [];

  for (const [drillId, bucket] of buckets.entries()) {
    if (publishedDrillMap.has(drillId) && bucket.validAttemptsCount > 0) {
      attemptedPublishedDrills.push(bucket);
    }
  }

  const uniqueDrillsAttempted = attemptedPublishedDrills.length;
  const totalAvailablePublishedDrills = publishedDrills.length;

  // Topics Mastery
  const topics = computeStudentTopicMastery({
    userId,
    publishedDrills,
    buckets,
  });

  // Criterion Weaknesses & Perspectives
  const criterionWeaknesses = computeCriterionWeaknesses({
    publishedDrills,
    buckets,
  });

  // Calculate overall trajectory delta across drills with >= 2 valid attempts
  let multiAttemptDrillsCount = 0;
  let totalScoreDeltaSum = 0;

  for (const bucket of attemptedPublishedDrills) {
    if (bucket.validAttemptsCount >= 2 && bucket.firstValidAttempt && bucket.latestValidAttempt) {
      totalScoreDeltaSum += bucket.latestValidAttempt.score - bucket.firstValidAttempt.score;
      multiAttemptDrillsCount++;
    }
  }

  let overallTrajectoryDelta: number | null = null;
  let overallTrajectoryDirection: DrillTrajectoryDirection = "NOT_APPLICABLE";

  if (multiAttemptDrillsCount > 0) {
    overallTrajectoryDelta = Math.round((totalScoreDeltaSum / multiAttemptDrillsCount) * 10) / 10;
    if (overallTrajectoryDelta >= 15.0) {
      overallTrajectoryDirection = "IMPROVED";
    } else if (overallTrajectoryDelta <= -15.0) {
      overallTrajectoryDirection = "REGRESSED";
    } else {
      overallTrajectoryDirection = "NO_MATERIAL_CHANGE";
    }
  }

  // Summary Metrics
  let totalPassedCount = 0;
  let scoreSum = 0;
  let safetyPassedCount = 0;

  for (const bucket of attemptedPublishedDrills) {
    const latest = bucket.latestValidAttempt;
    if (latest) {
      scoreSum += latest.score;
      if (latest.score >= 70 && latest.safety_gate_passed) {
        totalPassedCount++;
      }
      if (latest.safety_gate_passed && latest.invalidation_score >= 18) {
        safetyPassedCount++;
      }
    }
  }

  const overallPassRate =
    uniqueDrillsAttempted > 0
      ? Math.round((totalPassedCount / uniqueDrillsAttempted) * 1000) / 10
      : null;

  const averageScore =
    uniqueDrillsAttempted > 0
      ? Math.round((scoreSum / uniqueDrillsAttempted) * 10) / 10
      : null;

  const safetyGateComplianceRate =
    uniqueDrillsAttempted > 0
      ? Math.round((safetyPassedCount / uniqueDrillsAttempted) * 1000) / 10
      : null;

  const invalidCriterion = criterionWeaknesses.find((c) => c.criterionId === "CRIT_INVALID");
  const criticalSafetyAlert = invalidCriterion?.currentStatus === "CRITICAL_RISK";

  let dataStatus: "NO_DATA" | "INSUFFICIENT_DATA" | "AVAILABLE" = "NO_DATA";
  if (uniqueDrillsAttempted === 0) {
    dataStatus = "NO_DATA";
  } else if (uniqueDrillsAttempted === 1) {
    dataStatus = "INSUFFICIENT_DATA";
  } else {
    dataStatus = "AVAILABLE";
  }

  return {
    userId,
    dataStatus,
    totalSubmissions: userSubmissions.length,
    uniqueDrillsAttempted,
    totalAvailablePublishedDrills,
    overallPassRate,
    averageScore,
    safetyGateComplianceRate,
    overallTrajectoryDelta,
    overallTrajectoryDirection,
    topics,
    criterionWeaknesses,
    criticalSafetyAlert,
    generatedAt: new Date().toISOString(),
  };
}
