import type { DbRecommendationDismissal } from "../db";
import type {
  AdaptiveLearningRecommendation,
  NormalizedCourseProgressItem,
  StudentLearningContinuityMetrics,
  StudentQuizIntelligenceSummary,
} from "./types";
import type { NormalizedCurriculumCatalog } from "./progress-normalizer";

export interface RecommendationGenerationResult {
  recommendations: AdaptiveLearningRecommendation[];
  allCandidatesIncludingDismissed: AdaptiveLearningRecommendation[];
  dismissedCount: number;
}

export function generateAdaptiveRecommendations(params: {
  catalog: NormalizedCurriculumCatalog;
  courseProgress: NormalizedCourseProgressItem[];
  quizIntelligence: StudentQuizIntelligenceSummary;
  continuity: StudentLearningContinuityMetrics;
  dismissals?: DbRecommendationDismissal[];
  generatedAtIso?: string;
}): RecommendationGenerationResult {
  const {
    catalog,
    courseProgress,
    quizIntelligence,
    continuity,
    dismissals = [],
    generatedAtIso,
  } = params;

  const generatedAt = generatedAtIso || new Date().toISOString();
  const candidates: Omit<AdaptiveLearningRecommendation, "rank" | "status">[] = [];

  // Map dismissals by recommendation_id -> evidence_signature
  const dismissalSignatureByRecId = new Map<string, string>();
  for (const d of dismissals) {
    if (d && d.recommendation_id) {
      dismissalSignatureByRecId.set(d.recommendation_id, d.evidence_signature || "");
    }
  }

  // Track (courseSlug::lessonId) already covered by higher-priority actions to avoid duplicate/contradictory CTAs
  const coveredDestinations = new Set<string>();

  // 1. Priority 95: RETRY_QUIZ — Student attempted a quiz on a published course and has not passed yet (bestScore < passingScore)
  const failedQuizTopics = quizIntelligence.topics
    .filter((t) => t.attemptsCount >= 1 && !t.isPassed)
    .sort((a, b) => (a.bestScore ?? 0) - (b.bestScore ?? 0));

  for (const ft of failedQuizTopics.slice(0, 2)) {
    const courseItem = courseProgress.find(
      (c) => c.courseSlug.toLowerCase() === ft.courseSlug.toLowerCase()
    );
    if (!courseItem) continue;

    const destKey = `${ft.courseSlug.toLowerCase()}::${ft.lessonId}`;
    coveredDestinations.add(destKey);

    const evidenceSignature = `retry:${ft.courseSlug}:${ft.lessonId}:attempts=${ft.attemptsCount}:best=${ft.bestScore}`;
    candidates.push({
      recommendationId: `rec_retry_quiz_${ft.courseId}_${ft.lessonId}`,
      type: "RETRY_QUIZ",
      priority: 95,
      courseId: ft.courseId,
      courseSlug: ft.courseSlug,
      courseNumber: courseItem.courseNumber,
      courseTitle: ft.courseTitle,
      moduleId: ft.moduleId,
      moduleTitle: ft.moduleTitle,
      lessonId: ft.lessonId,
      lessonTitle: ft.lessonTitle,
      shortTitle: `Ulangi Kuis: ${ft.lessonTitle}`,
      explanation: `Skor terbaik Anda pada evaluasi "${ft.lessonTitle}" saat ini ${ft.bestScore}% (syarat lulus minimal ${ft.passingScore}%). Tinjau kembali poin kunci modul dan ulangi kuis untuk membuka kelulusan materi ini.`,
      evidenceSummary: `${ft.attemptsCount} percobaan • Skor terbaik ${ft.bestScore}% (Target ≥ ${ft.passingScore}%)`,
      evidenceSignature,
      actionLabel: "Ulangi Evaluasi Kuis",
      destination: ft.actionUrl,
      generatedAt,
    });
  }

  // 2. Priority 92 / 80: RETURN_TO_LEARNING or CONTINUE_LEARNING on active incomplete courses
  const inProgressCourses = courseProgress
    .filter((c) => c.status === "IN_PROGRESS")
    .sort((a, b) => {
      const tA = a.latestActivityAt ? Date.parse(a.latestActivityAt) : 0;
      const tB = b.latestActivityAt ? Date.parse(b.latestActivityAt) : 0;
      if (tB !== tA) return tB - tA;
      return a.order - b.order;
    });

  const isReturningAfterInactivity =
    continuity.inactiveDays !== null && continuity.inactiveDays >= 7;

  for (const activeCourse of inProgressCourses.slice(0, 2)) {
    const targetLessonId =
      activeCourse.nextEligibleLessonId || activeCourse.lastAccessedLessonId;
    const targetLessonTitle =
      activeCourse.nextEligibleLessonTitle ||
      activeCourse.lastAccessedLessonTitle ||
      activeCourse.courseTitle;

    const destKey = `${activeCourse.courseSlug.toLowerCase()}::${targetLessonId || ""}`;

    if (isReturningAfterInactivity && candidates.every((c) => c.type !== "RETURN_TO_LEARNING")) {
      const evidenceSignature = `return:${activeCourse.courseSlug}:done=${activeCourse.completedLessonsCount}/${activeCourse.totalEligibleLessons}:inactive=${continuity.inactiveDays}`;
      coveredDestinations.add(destKey);
      candidates.push({
        recommendationId: `rec_return_${activeCourse.courseId}`,
        type: "RETURN_TO_LEARNING",
        priority: 92,
        courseId: activeCourse.courseId,
        courseSlug: activeCourse.courseSlug,
        courseNumber: activeCourse.courseNumber,
        courseTitle: activeCourse.courseTitle,
        moduleId: null,
        moduleTitle: null,
        lessonId: targetLessonId,
        lessonTitle: targetLessonTitle,
        shortTitle: `Kembali Belajar: ${activeCourse.courseTitle}`,
        explanation: `Anda belum melanjutkan aktivitas belajar selama ${continuity.inactiveDays} hari. Anda sudah menyelesaikan ${activeCourse.completedLessonsCount} dari ${activeCourse.totalEligibleLessons} materi (${activeCourse.completionPercentage}%) pada kelas ini.`,
        evidenceSummary: `Jeda ${continuity.inactiveDays} hari • Progres ${activeCourse.completedLessonsCount}/${activeCourse.totalEligibleLessons} materi (${activeCourse.completionPercentage}%)`,
        evidenceSignature,
        actionLabel: "Lanjutkan Kelas Sekarang",
        destination: activeCourse.continueUrl,
        generatedAt,
      });
      continue;
    }

    if (!coveredDestinations.has(destKey)) {
      coveredDestinations.add(destKey);
      const evidenceSignature = `continue:${activeCourse.courseSlug}:done=${activeCourse.completedLessonsCount}/${activeCourse.totalEligibleLessons}:next=${targetLessonId || "none"}`;
      candidates.push({
        recommendationId: `rec_continue_${activeCourse.courseId}`,
        type: "CONTINUE_LEARNING",
        priority: 90,
        courseId: activeCourse.courseId,
        courseSlug: activeCourse.courseSlug,
        courseNumber: activeCourse.courseNumber,
        courseTitle: activeCourse.courseTitle,
        moduleId: null,
        moduleTitle: null,
        lessonId: targetLessonId,
        lessonTitle: targetLessonTitle,
        shortTitle: `Lanjutkan ${activeCourse.courseNumber}: ${targetLessonTitle}`,
        explanation: `Anda telah menyelesaikan ${activeCourse.completedLessonsCount} dari ${activeCourse.totalEligibleLessons} materi (${activeCourse.completionPercentage}%) di "${activeCourse.courseTitle}". Selesaikan ${activeCourse.remainingLessonsCount} materi tersisa untuk menuntaskan kelas ini.`,
        evidenceSummary: `Progres ${activeCourse.completedLessonsCount}/${activeCourse.totalEligibleLessons} materi (${activeCourse.completionPercentage}%)`,
        evidenceSignature,
        actionLabel: "Lanjutkan Materi",
        destination: activeCourse.continueUrl,
        generatedAt,
      });
    }
  }

  // 3. Priority 84: REVIEW_WEAK_TOPIC — Topic with >= 2 attempts and averageScore < 70 (even if passed once or struggling)
  const weakTopicsWithMultipleAttempts = quizIntelligence.topics
    .filter((t) => t.attemptsCount >= 2 && (t.averageScore ?? 100) < 70)
    .sort((a, b) => (a.averageScore ?? 0) - (b.averageScore ?? 0));

  for (const wt of weakTopicsWithMultipleAttempts.slice(0, 2)) {
    // If RETRY_QUIZ already targets this exact lesson, still allow REVIEW_WEAK_TOPIC if no other weak topic exists or skip duplicate destination
    if (
      candidates.some(
        (c) =>
          c.courseSlug.toLowerCase() === wt.courseSlug.toLowerCase() &&
          c.lessonId === wt.lessonId &&
          c.type === "REVIEW_WEAK_TOPIC"
      )
    ) {
      continue;
    }
    const courseItem = courseProgress.find(
      (c) => c.courseSlug.toLowerCase() === wt.courseSlug.toLowerCase()
    );
    if (!courseItem) continue;

    const evidenceSignature = `weak:${wt.courseSlug}:${wt.lessonId}:attempts=${wt.attemptsCount}:avg=${wt.averageScore}`;
    candidates.push({
      recommendationId: `rec_weak_topic_${wt.courseId}_${wt.lessonId}`,
      type: "REVIEW_WEAK_TOPIC",
      priority: 84,
      courseId: wt.courseId,
      courseSlug: wt.courseSlug,
      courseNumber: courseItem.courseNumber,
      courseTitle: wt.courseTitle,
      moduleId: wt.moduleId,
      moduleTitle: wt.moduleTitle,
      lessonId: wt.lessonId,
      lessonTitle: wt.lessonTitle,
      shortTitle: `Perkuat Topik: ${wt.moduleTitle}`,
      explanation: `Rata-rata skor evaluasi Anda pada topik "${wt.lessonTitle}" adalah ${wt.averageScore}% dari ${wt.attemptsCount} percobaan. Mengulas kembali konsep dasar pada modul ini akan memperkuat fondasi analisis Anda.`,
      evidenceSummary: `Rata-rata ${wt.averageScore}% dari ${wt.attemptsCount} percobaan • Skor terakhir ${wt.latestScore}%`,
      evidenceSignature,
      actionLabel: "Pelajari Ulang Topik",
      destination: wt.actionUrl,
      generatedAt,
    });
  }

  // 4. Priority 78: NEXT_LESSON — When a student has an in-progress course where lastAccessedLessonId is already completed, suggest the specific next incomplete lesson
  for (const activeCourse of inProgressCourses) {
    if (!activeCourse.nextEligibleLessonId) continue;
    const destKey = `${activeCourse.courseSlug.toLowerCase()}::${activeCourse.nextEligibleLessonId}`;
    if (coveredDestinations.has(destKey)) continue;

    const meta = catalog.lessonsByCourseAndId.get(destKey);
    if (!meta) continue;

    coveredDestinations.add(destKey);
    const evidenceSignature = `next_lesson:${activeCourse.courseSlug}:${activeCourse.nextEligibleLessonId}:done=${activeCourse.completedLessonsCount}`;
    candidates.push({
      recommendationId: `rec_next_lesson_${activeCourse.courseId}_${activeCourse.nextEligibleLessonId}`,
      type: "NEXT_LESSON",
      priority: 78,
      courseId: activeCourse.courseId,
      courseSlug: activeCourse.courseSlug,
      courseNumber: activeCourse.courseNumber,
      courseTitle: activeCourse.courseTitle,
      moduleId: meta.module.id,
      moduleTitle: meta.module.title,
      lessonId: meta.lesson.id,
      lessonTitle: meta.lesson.title,
      shortTitle: `Materi Berikutnya: ${meta.lesson.title}`,
      explanation: `Langkah logis selanjutnya dalam silabus "${activeCourse.courseTitle}" adalah mempelajari "${meta.lesson.title}" pada ${meta.module.title}.`,
      evidenceSummary: `Urutan materi ke-${meta.lessonIndexInCourse + 1} dari ${activeCourse.totalEligibleLessons} pada ${activeCourse.courseNumber}`,
      evidenceSignature,
      actionLabel: "Buka Materi Berikutnya",
      destination: `/kelas/${activeCourse.courseSlug}?lesson=${encodeURIComponent(meta.lesson.id)}`,
      generatedAt,
    });
  }

  // 5. Priority 72: START_FOUNDATION — If the foundational course (first Beginner published course, e.g. SC-01) is NOT_STARTED
  const foundationCourse =
    courseProgress.find((c) => c.level === "Beginner" && c.order === 1) ||
    courseProgress.find((c) => c.level === "Beginner") ||
    courseProgress[0];

  if (foundationCourse && foundationCourse.status === "NOT_STARTED") {
    const hasStartedAdvancedFirst = courseProgress.some(
      (c) => c.status !== "NOT_STARTED" && c.order > foundationCourse.order
    );
    const evidenceSignature = `foundation:${foundationCourse.courseSlug}:status=${foundationCourse.status}:jumped=${hasStartedAdvancedFirst}`;
    candidates.push({
      recommendationId: `rec_foundation_${foundationCourse.courseId}`,
      type: "START_FOUNDATION",
      priority: hasStartedAdvancedFirst ? 86 : 72,
      courseId: foundationCourse.courseId,
      courseSlug: foundationCourse.courseSlug,
      courseNumber: foundationCourse.courseNumber,
      courseTitle: foundationCourse.courseTitle,
      moduleId: null,
      moduleTitle: null,
      lessonId: foundationCourse.nextEligibleLessonId,
      lessonTitle: foundationCourse.nextEligibleLessonTitle,
      shortTitle: `Mulai Fondasi Utama: ${foundationCourse.courseTitle}`,
      explanation: hasStartedAdvancedFirst
        ? `Anda telah membuka materi tingkat lanjutan sementara kelas prasyarat fondasi "${foundationCourse.courseTitle}" (${foundationCourse.courseNumber}) belum dimulai. Menyelesaikan kelas fondasi memastikan pemahaman mikrostruktur pasar yang utuh.`
        : `Awali perjalanan belajar Anda dari kelas fondasi "${foundationCourse.courseTitle}" (${foundationCourse.courseNumber}) yang mencakup ${foundationCourse.totalEligibleLessons} materi terstruktur.`,
      evidenceSummary: `${foundationCourse.courseNumber} (${foundationCourse.level}) • 0/${foundationCourse.totalEligibleLessons} materi selesai`,
      evidenceSignature,
      actionLabel: "Mulai Kelas Fondasi",
      destination: foundationCourse.continueUrl,
      generatedAt,
    });
  }

  // 6. Priority 66: ADVANCE_TO_NEXT_COURSE — Student has completed >= 1 course or is ready for the next unstarted course in sequence
  const completedCourses = courseProgress.filter((c) => c.status === "COMPLETED");
  if (completedCourses.length > 0) {
    const nextUnstartedCourse = courseProgress.find(
      (c) =>
        c.status === "NOT_STARTED" &&
        !candidates.some(
          (cand) =>
            cand.type === "START_FOUNDATION" && cand.courseId === c.courseId
        )
    );

    if (nextUnstartedCourse) {
      const latestCompleted =
        completedCourses[completedCourses.length - 1];
      const evidenceSignature = `advance:${nextUnstartedCourse.courseSlug}:after=${latestCompleted.courseSlug}:completedCount=${completedCourses.length}`;
      candidates.push({
        recommendationId: `rec_advance_${nextUnstartedCourse.courseId}`,
        type: "ADVANCE_TO_NEXT_COURSE",
        priority: 66,
        courseId: nextUnstartedCourse.courseId,
        courseSlug: nextUnstartedCourse.courseSlug,
        courseNumber: nextUnstartedCourse.courseNumber,
        courseTitle: nextUnstartedCourse.courseTitle,
        moduleId: null,
        moduleTitle: null,
        lessonId: nextUnstartedCourse.nextEligibleLessonId,
        lessonTitle: nextUnstartedCourse.nextEligibleLessonTitle,
        shortTitle: `Naik ke Tahap Berikutnya: ${nextUnstartedCourse.courseTitle}`,
        explanation: `Selamat atas kelulusan Anda pada "${latestCompleted.courseTitle}"! Lanjutkan kurikulum ke "${nextUnstartedCourse.courseTitle}" (${nextUnstartedCourse.courseNumber} • ${nextUnstartedCourse.level}).`,
        evidenceSummary: `${completedCourses.length} kelas telah lulus • Selanjutnya: ${nextUnstartedCourse.courseNumber}`,
        evidenceSignature,
        actionLabel: "Pelajari Kelas Berikutnya",
        destination: `/belajar/${nextUnstartedCourse.courseSlug}`,
        generatedAt,
      });
    }
  }

  // Deterministic ranking: priority DESC, then courseId ASC, then recommendationId ASC
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.recommendationId.localeCompare(b.recommendationId);
  });

  // Apply dismissal state (only suppressed if evidenceSignature matches; if evidence changed, automatically resurfaces!)
  const allCandidatesIncludingDismissed: AdaptiveLearningRecommendation[] =
    candidates.map((c, idx) => {
      const dismissedSig = dismissalSignatureByRecId.get(c.recommendationId);
      const isDismissed =
        dismissedSig !== undefined && dismissedSig === c.evidenceSignature;
      return {
        ...c,
        rank: idx + 1,
        status: isDismissed ? "DISMISSED" : "ACTIVE",
      };
    });

  const activeRecommendations = allCandidatesIncludingDismissed
    .filter((r) => r.status === "ACTIVE")
    .slice(0, 5)
    .map((r, idx) => ({
      ...r,
      rank: idx + 1,
    }));

  const dismissedCount = allCandidatesIncludingDismissed.filter(
    (r) => r.status === "DISMISSED"
  ).length;

  return {
    recommendations: activeRecommendations,
    allCandidatesIncludingDismissed,
    dismissedCount,
  };
}
