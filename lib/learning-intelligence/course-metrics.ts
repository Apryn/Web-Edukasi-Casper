import { evaluateCourseCompletion } from "../progress";
import type { Lesson } from "../types";
import type { DbLearningEvent } from "../db";
import type {
  CourseLearningStatus,
  LearningDataStatus,
  NormalizedCourseProgressItem,
  StudentOverallLearningMetrics,
} from "./types";
import {
  clampPercentage,
  roundToOneDecimal,
  type NormalizedCurriculumCatalog,
  type NormalizedQuizSubmissionRecord,
  type NormalizedUserProgressRecord,
} from "./progress-normalizer";

export interface StudentCourseMetricsComputation {
  overall: StudentOverallLearningMetrics;
  courseProgress: NormalizedCourseProgressItem[];
  archivedCourseHistory: Array<{
    courseSlug: string;
    completedLessonsCount: number;
    updatedAt: string;
  }>;
  continueLearning: {
    hasActiveCourse: boolean;
    course: NormalizedCourseProgressItem | null;
    primaryCtaLabel: string;
    primaryCtaUrl: string;
  };
}

export function computeStudentCourseMetrics(params: {
  catalog: NormalizedCurriculumCatalog;
  userProgressRows: NormalizedUserProgressRecord[];
  userQuizSubmissions: NormalizedQuizSubmissionRecord[];
  userEvents: DbLearningEvent[];
}): StudentCourseMetricsComputation {
  const { catalog, userProgressRows, userQuizSubmissions, userEvents } = params;

  const progressBySlug = new Map<string, NormalizedUserProgressRecord>();
  for (const p of userProgressRows) {
    progressBySlug.set(p.courseSlug.toLowerCase(), p);
  }

  const quizByCourseSlug = new Map<string, NormalizedQuizSubmissionRecord[]>();
  for (const sub of userQuizSubmissions) {
    const slug = sub.courseSlug.toLowerCase();
    const arr = quizByCourseSlug.get(slug) || [];
    arr.push(sub);
    quizByCourseSlug.set(slug, arr);
  }

  const eventsByCourseSlug = new Map<string, DbLearningEvent[]>();
  for (const evt of userEvents) {
    if (!evt || typeof evt.course_slug !== "string") continue;
    const slug = evt.course_slug.toLowerCase();
    const arr = eventsByCourseSlug.get(slug) || [];
    arr.push(evt);
    eventsByCourseSlug.set(slug, arr);
  }

  const courseProgress: NormalizedCourseProgressItem[] = [];
  let totalAvailableLessons = 0;
  let lessonsCompleted = 0;
  let coursesStarted = 0;
  let coursesCompleted = 0;
  let certificatesEarnedCount = 0;

  for (const course of catalog.publishedCourses) {
    const slugLower = course.slug.toLowerCase();
    const prog = progressBySlug.get(slugLower);
    const courseQuizSubs = quizByCourseSlug.get(slugLower) || [];
    const courseEvents = eventsByCourseSlug.get(slugLower) || [];

    const allLessons: Lesson[] = course.modules.flatMap((m) =>
      m && Array.isArray(m.lessons) ? m.lessons : []
    );
    const lessonMap = new Map<string, Lesson>();
    for (const l of allLessons) {
      lessonMap.set(l.id, l);
    }

    const evalState = evaluateCourseCompletion(course, {
      completedLessonIds: prog?.completedLessonIds || [],
      quizScores: prog?.quizScores || {},
    });

    totalAvailableLessons += evalState.totalLessons;
    lessonsCompleted += evalState.completedCount;

    const hasStarted =
      Boolean(prog) ||
      courseQuizSubs.length > 0 ||
      courseEvents.length > 0 ||
      evalState.completedCount > 0;

    const isCompleted =
      evalState.totalLessons > 0 &&
      evalState.isComplete &&
      evalState.allQuizzesPassed;

    let status: CourseLearningStatus = "NOT_STARTED";
    if (isCompleted) {
      status = "COMPLETED";
      coursesStarted += 1;
      coursesCompleted += 1;
    } else if (hasStarted) {
      status = "IN_PROGRESS";
      coursesStarted += 1;
    }

    if (evalState.isEligibleForCertificate) {
      certificatesEarnedCount += 1;
    }

    const completedSet = new Set(evalState.validCompletedLessonIds);
    const firstIncompleteLesson =
      allLessons.find((l) => !completedSet.has(l.id)) || null;

    let lastAccessedLessonId: string | null = null;
    if (prog?.lastLessonId && lessonMap.has(prog.lastLessonId)) {
      lastAccessedLessonId = prog.lastLessonId;
    } else if (evalState.validCompletedLessonIds.length > 0) {
      lastAccessedLessonId =
        evalState.validCompletedLessonIds[evalState.validCompletedLessonIds.length - 1];
    }

    const lastAccessedLessonTitle = lastAccessedLessonId
      ? lessonMap.get(lastAccessedLessonId)?.title || null
      : null;

    const nextEligibleLesson = firstIncompleteLesson;
    const targetResumeLessonId = isCompleted
      ? allLessons[0]?.id || null
      : lastAccessedLessonId && !completedSet.has(lastAccessedLessonId)
        ? lastAccessedLessonId
        : nextEligibleLesson?.id || lastAccessedLessonId || allLessons[0]?.id || null;

    const continueUrl = targetResumeLessonId
      ? `/kelas/${course.slug}?lesson=${encodeURIComponent(targetResumeLessonId)}`
      : `/kelas/${course.slug}`;

    // Quiz score summaries for this course
    let latestQuizScore: number | null = null;
    let bestQuizScore: number | null = null;
    if (courseQuizSubs.length > 0) {
      latestQuizScore = courseQuizSubs[courseQuizSubs.length - 1].score;
      bestQuizScore = Math.max(...courseQuizSubs.map((s) => s.score));
    } else if (prog && Object.keys(prog.quizScores).length > 0) {
      const vals = Object.values(prog.quizScores);
      latestQuizScore = vals[vals.length - 1];
      bestQuizScore = Math.max(...vals);
    }

    // Activity timestamps
    const timestampsMs: number[] = [];
    if (prog?.updatedAt) {
      const t = Date.parse(prog.updatedAt);
      if (Number.isFinite(t) && t > 0) timestampsMs.push(t);
    }
    for (const qs of courseQuizSubs) {
      if (qs.createdAtMs > 0) timestampsMs.push(qs.createdAtMs);
    }
    for (const ev of courseEvents) {
      const t = Date.parse(ev.created_at);
      if (Number.isFinite(t) && t > 0) timestampsMs.push(t);
    }

    const latestActivityAt =
      timestampsMs.length > 0
        ? new Date(Math.max(...timestampsMs)).toISOString()
        : null;
    const startedAt =
      prog?.startedAt ||
      (timestampsMs.length > 0
        ? new Date(Math.min(...timestampsMs)).toISOString()
        : null);
    const completedAt = isCompleted
      ? prog?.completedAt || latestActivityAt
      : null;

    courseProgress.push({
      courseId: course.id,
      courseSlug: course.slug,
      courseNumber: course.number,
      courseTitle: course.title,
      courseSubtitle: course.subtitle,
      category: course.category,
      level: course.level,
      order: course.order ?? 999,
      status,
      completedLessonsCount: evalState.completedCount,
      totalEligibleLessons: evalState.totalLessons,
      remainingLessonsCount: Math.max(
        0,
        evalState.totalLessons - evalState.completedCount
      ),
      completionPercentage: evalState.percentage,
      completedLessonIds: evalState.validCompletedLessonIds,
      hasQuiz: evalState.hasQuiz,
      allQuizzesPassed: evalState.allQuizzesPassed,
      isEligibleForCertificate: evalState.isEligibleForCertificate,
      latestQuizScore,
      bestQuizScore,
      lastAccessedLessonId,
      lastAccessedLessonTitle,
      nextEligibleLessonId: nextEligibleLesson?.id || null,
      nextEligibleLessonTitle: nextEligibleLesson?.title || null,
      continueUrl,
      startedAt,
      completedAt,
      latestActivityAt,
    });
  }

  // Track historical progress on archived/non-published courses separately without distorting published denominators
  const archivedCourseHistory: Array<{
    courseSlug: string;
    completedLessonsCount: number;
    updatedAt: string;
  }> = [];
  for (const prog of userProgressRows) {
    if (!catalog.publishedBySlug.has(prog.courseSlug.toLowerCase())) {
      archivedCourseHistory.push({
        courseSlug: prog.courseSlug,
        completedLessonsCount: prog.completedLessonIds.length,
        updatedAt: prog.updatedAt,
      });
    }
  }

  const totalPublishedCourses = catalog.publishedCourses.length;
  const coursesInProgress = Math.max(0, coursesStarted - coursesCompleted);
  const coursesNotStarted = Math.max(0, totalPublishedCourses - coursesStarted);

  const startedCourseCompletionRate =
    coursesStarted > 0
      ? clampPercentage((coursesCompleted / coursesStarted) * 100)
      : null;

  const overallLessonCompletionRate =
    totalAvailableLessons > 0
      ? clampPercentage((lessonsCompleted / totalAvailableLessons) * 100)
      : null;

  // Filter quiz submissions to published courses for overall quiz metrics
  const eligibleQuizSubs = userQuizSubmissions.filter((s) =>
    catalog.publishedBySlug.has(s.courseSlug.toLowerCase())
  );
  const totalQuizSubmissions = eligibleQuizSubs.length;

  let averageQuizScore: number | null = null;
  let quizScoreDataStatus: LearningDataStatus = "NO_DATA";
  if (totalQuizSubmissions > 0) {
    const sum = eligibleQuizSubs.reduce((acc, s) => acc + s.score, 0);
    averageQuizScore = roundToOneDecimal(sum / totalQuizSubmissions);
    quizScoreDataStatus =
      totalQuizSubmissions >= 2 ? "AVAILABLE" : "INSUFFICIENT_DATA";
  }

  const overallDataStatus: LearningDataStatus =
    coursesStarted === 0 && totalQuizSubmissions === 0 ? "NO_DATA" : "AVAILABLE";

  // Select Continue Learning target:
  // 1. Most recently active IN_PROGRESS course
  // 2. Otherwise, first NOT_STARTED course in curriculum order
  // 3. Otherwise, most recently completed course for review
  const inProgressCourses = courseProgress
    .filter((c) => c.status === "IN_PROGRESS")
    .sort((a, b) => {
      const tA = a.latestActivityAt ? Date.parse(a.latestActivityAt) : 0;
      const tB = b.latestActivityAt ? Date.parse(b.latestActivityAt) : 0;
      if (tB !== tA) return tB - tA;
      return a.order - b.order;
    });

  let targetContinueCourse: NormalizedCourseProgressItem | null = null;
  let primaryCtaLabel = "Mulai Belajar Fondasi";
  let primaryCtaUrl = "/belajar";
  let hasActiveCourse = false;

  if (inProgressCourses.length > 0) {
    targetContinueCourse = inProgressCourses[0];
    hasActiveCourse = true;
    primaryCtaLabel = targetContinueCourse.nextEligibleLessonTitle
      ? `Lanjutkan: ${targetContinueCourse.nextEligibleLessonTitle}`
      : "Lanjutkan Materi";
    primaryCtaUrl = targetContinueCourse.continueUrl;
  } else {
    const nextUnstarted = courseProgress.find((c) => c.status === "NOT_STARTED");
    if (nextUnstarted) {
      targetContinueCourse = nextUnstarted;
      hasActiveCourse = false;
      primaryCtaLabel =
        coursesCompleted > 0
          ? `Mulai Kelas Berikutnya: ${nextUnstarted.courseNumber}`
          : `Mulai Kelas Pertama: ${nextUnstarted.courseNumber}`;
      primaryCtaUrl = nextUnstarted.continueUrl;
    } else if (courseProgress.length > 0) {
      targetContinueCourse = courseProgress[0];
      hasActiveCourse = false;
      primaryCtaLabel = "Tinjau Kembali Materi";
      primaryCtaUrl = targetContinueCourse.continueUrl;
    }
  }

  return {
    overall: {
      dataStatus: overallDataStatus,
      totalPublishedCourses,
      coursesStarted,
      coursesCompleted,
      coursesInProgress,
      coursesNotStarted,
      startedCourseCompletionRate,
      totalAvailableLessons,
      lessonsCompleted,
      overallLessonCompletionRate,
      totalQuizSubmissions,
      averageQuizScore,
      quizScoreDataStatus,
      certificatesEarnedCount,
    },
    courseProgress,
    archivedCourseHistory,
    continueLearning: {
      hasActiveCourse,
      course: targetContinueCourse,
      primaryCtaLabel,
      primaryCtaUrl,
    },
  };
}

