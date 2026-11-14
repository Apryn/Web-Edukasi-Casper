/**
 * SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
 * Adaptive Practical Drill Recommendation Engine
 *
 * Generates pedagogically targeted chart study recommendations using
 * stable evidence signatures grounded in latestValidAttempt, a 5-tier
 * deterministic priority queue, and candidate drill selection pipelines.
 */

import type {
  DbDrillCase,
  DbDrillSubmission,
  StudentDrillIntelligenceSummary,
  AdaptiveDrillRecommendation,
  DrillRecommendationCategory,
} from "./drill-types";
import {
  buildDrillEvidenceBuckets,
} from "./drill-mastery-engine";

export interface DbRecommendationDismissal {
  id?: string;
  user_id: string;
  recommendation_id?: string;
  evidence_signature: string;
  dismissed_at: string;
}

export function generateAdaptiveDrillRecommendations(params: {
  userId: string;
  publishedDrills: DbDrillCase[];
  submissions: DbDrillSubmission[];
  intelligenceSummary: StudentDrillIntelligenceSummary;
  dismissals?: DbRecommendationDismissal[];
}): AdaptiveDrillRecommendation[] {
  const { userId, publishedDrills, submissions, intelligenceSummary, dismissals = [] } = params;

  // Filter only published drills
  const activePublishedDrills = publishedDrills
    .filter((d) => d.status === "PUBLISHED")
    .sort((a, b) => {
      // Deterministic tie-breaking: primary by order_index, secondary by id
      const orderA = (a as unknown as { order_index?: number }).order_index ?? 0;
      const orderB = (b as unknown as { order_index?: number }).order_index ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.id.localeCompare(b.id);
    });

  if (activePublishedDrills.length === 0) {
    return [];
  }

  // Pre-build buckets for fast lookup
  const userSubmissions = submissions.filter((s) => s.user_id === userId);
  const buckets = buildDrillEvidenceBuckets(userSubmissions);

  // Set of dismissed signatures
  const dismissedSignatures = new Set(
    dismissals
      .filter((d) => d.user_id === userId)
      .map((d) => d.evidence_signature)
  );

  const candidates: Array<{
    category: DrillRecommendationCategory;
    priority: number;
    drill: DbDrillCase;
    topicId: string;
    shortTitle: string;
    explanation: string;
    evidenceSummary: string;
    evidenceSignature: string;
    actionLabel: string;
  }> = [];

  // Helper: Candidate Drill Selection Pipeline (Tier 1 -> Tier 2)
  function findBestCandidateDrill(
    drillPool: DbDrillCase[],
    predicate?: (d: DbDrillCase) => boolean
  ): DbDrillCase | null {
    const pool = predicate ? drillPool.filter(predicate) : drillPool;

    // Tier 1: Unattempted (validAttemptsCount === 0)
    for (const d of pool) {
      const b = buckets.get(d.id);
      if (!b || b.validAttemptsCount === 0) {
        return d;
      }
    }

    // Tier 2: Incomplete / Unpassed
    for (const d of pool) {
      const b = buckets.get(d.id);
      if (b && b.latestValidAttempt) {
        const passed = b.latestValidAttempt.score >= 70 && b.latestValidAttempt.safety_gate_passed;
        if (!passed) {
          return d;
        }
      }
    }

    return null;
  }

  // ── Rule 1: Safety Gate Override (Priority 98) ────────────────────
  const failedSafetyBucket = Array.from(buckets.values()).find((b) => {
    const drill = activePublishedDrills.find((d) => d.id === b.drillId);
    return (
      drill &&
      b.latestValidAttempt &&
      (!b.latestValidAttempt.safety_gate_passed || b.latestValidAttempt.invalidation_score < 18)
    );
  });

  if (failedSafetyBucket && failedSafetyBucket.latestValidAttempt) {
    const triggerSub = failedSafetyBucket.latestValidAttempt;
    const candidate =
      findBestCandidateDrill(activePublishedDrills, (d) => d.drill_type === "INVALIDATION_RISK") ||
      findBestCandidateDrill(activePublishedDrills, (d) => d.id !== failedSafetyBucket.drillId) ||
      activePublishedDrills.find((d) => d.id === failedSafetyBucket.drillId) ||
      null;

    if (candidate) {
      const signature = `drill:safety_gate:drill=${failedSafetyBucket.drillId}:latestValidSubId=${triggerSub.id}:sl=${triggerSub.invalidation_score}`;
      candidates.push({
        category: "RESOLVE_CRITICAL_SAFETY_GATE",
        priority: 98,
        drill: candidate,
        topicId: candidate.lesson_id || candidate.course_slug,
        shortTitle: "Latih Proteksi Stop-Loss",
        explanation:
          "Percobaan praktik terakhir Anda melanggar batas keselamatan invalidasi modal (Safety Gate). Lakukan kalibrasi Stop-Loss struktural sebelum mengeksekusi setup berikutnya.",
        evidenceSummary: `Skor Invalidation terakhir: ${triggerSub.invalidation_score}/25 pada studi kasus #${failedSafetyBucket.drillId}.`,
        evidenceSignature: signature,
        actionLabel: "Perbaiki Proteksi Invalidation",
      });
    }
  }

  // ── Rule 2: Targeted Weakness Practice (Priority 88) ──────────────
  const weakCriteria = intelligenceSummary.criterionWeaknesses
    .filter((c) => c.currentStatus === "NEEDS_REFINEMENT" && c.currentProficiency !== null)
    .sort((a, b) => (a.currentProficiency ?? 100) - (b.currentProficiency ?? 100));

  if (weakCriteria.length > 0) {
    const targetWeakness = weakCriteria[0];
    const cId = targetWeakness.criterionId;

    // Match drill type
    const matchesCriteria = (d: DbDrillCase) => {
      if (cId === "CRIT_ENTRY") return d.drill_type === "LEVEL_IDENTIFICATION" || d.drill_type === "SETUP_EXECUTION";
      if (cId === "CRIT_RR") return d.drill_type === "SETUP_EXECUTION";
      if (cId === "CRIT_CONFIRM" || cId === "CRIT_BIAS") return d.drill_type === "DIRECTION_BIAS";
      return true;
    };

    const candidate =
      findBestCandidateDrill(activePublishedDrills, matchesCriteria) ||
      findBestCandidateDrill(activePublishedDrills);

    // Get chronologically latest valid attempt across active published drill buckets
    const publishedIds = new Set(activePublishedDrills.map((d) => d.id));
    let latestValidSub: DbDrillSubmission | null = null;
    for (const b of buckets.values()) {
      if (!publishedIds.has(b.drillId)) continue;
      const candidateSub = b.latestValidAttempt;
      if (!candidateSub) continue;
      if (
        !latestValidSub ||
        Date.parse(candidateSub.created_at) > Date.parse(latestValidSub.created_at) ||
        (Date.parse(candidateSub.created_at) === Date.parse(latestValidSub.created_at) &&
          candidateSub.id.localeCompare(latestValidSub.id) > 0)
      ) {
        latestValidSub = candidateSub;
      }
    }
    const latestValidSubId = latestValidSub ? latestValidSub.id : "none";

    if (candidate) {
      const prof = targetWeakness.currentProficiency ?? 0;
      const signature = `drill:weak:crit=${cId}:latestValidSubId=${latestValidSubId}:prof=${prof.toFixed(2)}:cases=${targetWeakness.distinctCasesEvaluated}`;
      candidates.push({
        category: "PRACTICE_WEAK_CRITERION",
        priority: 88,
        drill: candidate,
        topicId: candidate.lesson_id || candidate.course_slug,
        shortTitle: `Fokus Perbaikan: ${targetWeakness.criterionName}`,
        explanation: `Profisiensi terkini Anda pada kriteria ${targetWeakness.criterionName} berada di bawah ambang stabilitas (${prof.toFixed(1)}%). Selesaikan latihan terfokus untuk memperbaiki presisi.`,
        evidenceSummary: `Profisiensi ${targetWeakness.criterionName}: ${prof.toFixed(1)}% dari ${targetWeakness.distinctCasesEvaluated} studi kasus berbeda.`,
        evidenceSignature: signature,
        actionLabel: `Latih ${targetWeakness.criterionName}`,
      });
    }
  }

  // ── Rule 3: Multi-Case Completion (Priority 80) ───────────────────
  const developingTopic = intelligenceSummary.topics.find(
    (t) => t.masteryLevel === "DEVELOPING"
  );

  if (developingTopic) {
    const topicDrills = activePublishedDrills.filter(
      (d) => (d.lesson_id || d.course_slug) === developingTopic.topicId
    );
    const candidate = findBestCandidateDrill(topicDrills);

    // Find the drill that was passed in this topic
    let passedValidSubId = "first_pass";
    for (const d of topicDrills) {
      const b = buckets.get(d.id);
      if (b && b.latestValidAttempt && b.latestValidAttempt.score >= 70 && b.latestValidAttempt.safety_gate_passed) {
        passedValidSubId = b.latestValidAttempt.id;
        break;
      }
    }

    if (candidate) {
      const signature = `drill:multicase:topic=${developingTopic.topicId}:passedValidSubId=${passedValidSubId}:candidate=${candidate.id}`;
      candidates.push({
        category: "UNLOCK_MULTI_CASE_MASTERY",
        priority: 80,
        drill: candidate,
        topicId: developingTopic.topicId,
        shortTitle: "Tuntaskan Bukti Kasus Kedua",
        explanation: `Anda telah lulus pada satu studi kasus di topik ${developingTopic.topicTitle}. Buktikan konsistensi analisa pada kasus kedua untuk meraih status MASTERED.`,
        evidenceSummary: `Topik ${developingTopic.topicTitle}: 1 dari 2 kasus pembuktian berhasil diselesaikan.`,
        evidenceSignature: signature,
        actionLabel: "Buktikan Kasus Kedua",
      });
    }
  }

  // ── Rule 4: Next Practical Drill (Priority 70) ────────────────────
  // Only applies once the student has attempted at least 1 valid drill;
  // NO_DATA (uniqueDrillsAttempted === 0) is handled exclusively by Rule 5.
  const unattemptedGeneral = findBestCandidateDrill(activePublishedDrills);
  if (
    unattemptedGeneral &&
    candidates.length === 0 &&
    intelligenceSummary.uniqueDrillsAttempted > 0
  ) {
    const signature = `drill:next:candidate=${unattemptedGeneral.id}`;
    candidates.push({
      category: "NEXT_PRACTICAL_DRILL",
      priority: 70,
      drill: unattemptedGeneral,
      topicId: unattemptedGeneral.lesson_id || unattemptedGeneral.course_slug,
      shortTitle: "Lanjutkan Praktik Grafik",
      explanation: "Lanjutkan silabus trading praktis Anda dengan menyelesaikan studi kasus analisa grafik berikutnya.",
      evidenceSummary: `Studi kasus berikutnya: ${unattemptedGeneral.title}.`,
      evidenceSignature: signature,
      actionLabel: "Mulai Studi Kasus",
    });
  }

  // ── Rule 5: Zero-Data Onboarding (Priority 60) ────────────────────
  if (intelligenceSummary.uniqueDrillsAttempted === 0) {
    const firstDrill = activePublishedDrills[0];
    const signature = `drill:onboard:first_case:target=${firstDrill.id}`;
    candidates.push({
      category: "FOUNDATION_FIRST_DRILL",
      priority: 60,
      drill: firstDrill,
      topicId: firstDrill.lesson_id || firstDrill.course_slug,
      shortTitle: "Mulai Praktik Chart Pertama",
      explanation: "Uji pemahaman analisa teknikal Anda melalui studi kasus grafik interaktif pertama.",
      evidenceSummary: "Belum ada riwayat pengerjaan drill praktis.",
      evidenceSignature: signature,
      actionLabel: "Buka Chart Workspace",
    });
  }

  // Sort candidates by priority descending, filter out dismissed, and cap at 2
  const finalRecommendations: AdaptiveDrillRecommendation[] = [];
  let rank = 1;

  for (const item of candidates.sort((a, b) => b.priority - a.priority)) {
    if (finalRecommendations.length >= 2) break;

    const isDismissed = dismissedSignatures.has(item.evidenceSignature);
    if (!isDismissed) {
      finalRecommendations.push({
        recommendationId: `rec_drill_${item.drill.id}_${item.category.toLowerCase()}`,
        category: item.category,
        priority: item.priority,
        rank: rank++,
        drillId: item.drill.id,
        drillTitle: item.drill.title,
        drillType: item.drill.drill_type,
        topicId: item.topicId,
        shortTitle: item.shortTitle,
        explanation: item.explanation,
        evidenceSummary: item.evidenceSummary,
        evidenceSignature: item.evidenceSignature,
        actionLabel: item.actionLabel,
        destinationUrl: `/belajar/drill/${item.drill.id}`,
        status: "ACTIVE",
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return finalRecommendations;
}
