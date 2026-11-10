import { evaluateCourseCompletion } from "../progress";
import type { Lesson } from "../types";
import type {
  DbCourseProgress,
  DbLearningEvent,
  DbQuizSubmission,
  DbUser,
} from "../db";
import type {
  AdminCoursePerformanceItem,
  AdminEducationOverviewMetrics,
  AdminEngagementAndRetentionReport,
  AdminFullEducationIntelligenceBundle,
  AdminLessonDropOffItem,
  AdminQuestionDifficultyItem,
  AdminQuizIntelligenceReport,
  AdminQuizTopicPerformanceItem,
  AdminRetentionCohortItem,
  AdminTimePeriod,
  LearningDataStatus,
} from "./types";
import {
  buildNormalizedCurriculumCatalog,
  clampPercentage,
  filterStudentAccounts,
  normalizeProgressRecords,
  normalizeQuizSubmissionRecords,
  roundToOneDecimal,
  type NormalizedCurriculumCatalog,
  type NormalizedUserProgressRecord,
} from "./progress-normalizer";

export const MIN_SAFE_COHORT_SIZE = 3;
const DAY_MS = 86_400_000;

export function parseAdminTimePeriod(raw?: string | null): AdminTimePeriod {
  const norm = String(raw || "all").toLowerCase().trim();
  if (norm === "7d" || norm === "30d" || norm === "90d" || norm === "all") {
    return norm;
  }
  return "all";
}

function getPeriodWindow(
  period: AdminTimePeriod,
  nowMs: number
): { startMs: number | null; startUtc: string | null; endUtc: string; label: string } {
  const endUtc = new Date(nowMs).toISOString();
  if (period === "7d") {
    const startMs = nowMs - 7 * DAY_MS;
    return {
      startMs,
      startUtc: new Date(startMs).toISOString(),
      endUtc,
      label: "7 Hari Terakhir",
    };
  }
  if (period === "30d") {
    const startMs = nowMs - 30 * DAY_MS;
    return {
      startMs,
      startUtc: new Date(startMs).toISOString(),
      endUtc,
      label: "30 Hari Terakhir",
    };
  }
  if (period === "90d") {
    const startMs = nowMs - 90 * DAY_MS;
    return {
      startMs,
      startUtc: new Date(startMs).toISOString(),
      endUtc,
      label: "90 Hari Terakhir",
    };
  }
  return {
    startMs: null,
    startUtc: null,
    endUtc,
    label: "Seluruh Waktu (All Time)",
  };
}

function getIsoWeekKey(ms: number): string {
  const d = new Date(ms);
  const utcDate = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7
  );
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function buildAdminEducationIntelligence(params: {
  users: DbUser[];
  courseProgressRows: DbCourseProgress[];
  quizSubmissionRows: DbQuizSubmission[];
  learningEventRows: DbLearningEvent[];
  period?: AdminTimePeriod;
  catalog?: NormalizedCurriculumCatalog;
  referenceNowIso?: string;
}): AdminFullEducationIntelligenceBundle {
  const period = parseAdminTimePeriod(params.period);
  const nowMs =
    params.referenceNowIso && !Number.isNaN(Date.parse(params.referenceNowIso))
      ? Date.parse(params.referenceNowIso)
      : Date.now();
  const windowInfo = getPeriodWindow(period, nowMs);
  const catalog = params.catalog ?? buildNormalizedCurriculumCatalog();

  // Strictly count only student accounts (role === "USER")
  const students = filterStudentAccounts(params.users);
  const studentIdsSet = new Set(students.map((s) => s.id));

  const allProgress = normalizeProgressRecords(params.courseProgressRows).filter(
    (p) =>
      studentIdsSet.has(p.userId) &&
      catalog.publishedBySlug.has(p.courseSlug.toLowerCase())
  );

  const allQuizSubs = normalizeQuizSubmissionRecords(
    params.quizSubmissionRows
  ).filter(
    (q) =>
      studentIdsSet.has(q.userId) &&
      catalog.publishedBySlug.has(q.courseSlug.toLowerCase())
  );

  const allEvents = (params.learningEventRows || []).filter(
    (e) =>
      e &&
      studentIdsSet.has(e.user_id) &&
      typeof e.course_slug === "string" &&
      catalog.publishedBySlug.has(e.course_slug.toLowerCase())
  );

  // Filter records within selected time window where applicable
  const inWindow = (ms: number): boolean => {
    if (!Number.isFinite(ms) || ms <= 0) return false;
    if (windowInfo.startMs === null) return true;
    return ms >= windowInfo.startMs && ms <= nowMs + DAY_MS;
  };

  const windowQuizSubs = allQuizSubs.filter((q) => inWindow(q.createdAtMs));

  // Map per-student activity timestamps (all time vs in window)
  const studentAllTimestamps = new Map<string, number[]>();
  const studentActiveInWindow = new Set<string>();
  const studentStartedCourses = new Map<string, Set<string>>();
  const studentCompletedCourses = new Map<string, Set<string>>();
  const studentCompletedLessonsCount = new Map<string, number>();

  const recordStudentTimestamp = (userId: string, ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return;
    const arr = studentAllTimestamps.get(userId) || [];
    arr.push(ms);
    studentAllTimestamps.set(userId, arr);
    if (inWindow(ms)) {
      studentActiveInWindow.add(userId);
    }
  };

  for (const p of allProgress) {
    const ms = Date.parse(p.updatedAt);
    recordStudentTimestamp(p.userId, ms);
    if (p.startedAt) {
      recordStudentTimestamp(p.userId, Date.parse(p.startedAt));
    }
    const set = studentStartedCourses.get(p.userId) || new Set<string>();
    set.add(p.courseSlug.toLowerCase());
    studentStartedCourses.set(p.userId, set);
  }

  for (const q of allQuizSubs) {
    recordStudentTimestamp(q.userId, q.createdAtMs);
    const set = studentStartedCourses.get(q.userId) || new Set<string>();
    set.add(q.courseSlug.toLowerCase());
    studentStartedCourses.set(q.userId, set);
  }

  for (const e of allEvents) {
    recordStudentTimestamp(e.user_id, Date.parse(e.created_at));
    const set = studentStartedCourses.get(e.user_id) || new Set<string>();
    set.add(e.course_slug.toLowerCase());
    studentStartedCourses.set(e.user_id, set);
  }

  // Evaluate course and lesson completion across published courses
  let totalLessonCompletionsAcrossCohort = 0;
  const coursePerformanceList: AdminCoursePerformanceItem[] = [];
  const lessonDropOffList: AdminLessonDropOffItem[] = [];

  for (const course of catalog.publishedCourses) {
    const slugLower = course.slug.toLowerCase();
    const courseProgressRows = allProgress.filter(
      (p) => p.courseSlug.toLowerCase() === slugLower
    );
    const progressByUser = new Map<string, NormalizedUserProgressRecord>();
    for (const p of courseProgressRows) {
      progressByUser.set(p.userId, p);
    }

    const courseQuizRows = windowQuizSubs.filter(
      (q) => q.courseSlug.toLowerCase() === slugLower
    );
    const allTimeCourseQuizRows = allQuizSubs.filter(
      (q) => q.courseSlug.toLowerCase() === slugLower
    );
    const courseEventsRows = allEvents.filter(
      (e) => e.course_slug.toLowerCase() === slugLower
    );

    // Determine all students who started this course
    const startedUserIds = new Set<string>();
    for (const p of courseProgressRows) startedUserIds.add(p.userId);
    for (const q of allTimeCourseQuizRows) startedUserIds.add(q.userId);
    for (const e of courseEventsRows) startedUserIds.add(e.user_id);

    const flatLessons: Array<{
      moduleId: string;
      moduleTitle: string;
      moduleOrder: number;
      lesson: Lesson;
      lessonIndex: number; // 1-based
    }> = [];
    let runningIdx = 0;
    course.modules.forEach((mod, mIdx) => {
      if (!mod || !Array.isArray(mod.lessons)) return;
      mod.lessons.forEach((les) => {
        runningIdx += 1;
        flatLessons.push({
          moduleId: mod.id,
          moduleTitle: mod.title,
          moduleOrder: mIdx + 1,
          lesson: les,
          lessonIndex: runningIdx,
        });
      });
    });

    const lessonIndexById = new Map<string, number>();
    for (const item of flatLessons) {
      lessonIndexById.set(item.lesson.id, item.lessonIndex);
    }

    let completedStudentsCount = 0;
    let sumCompletionPct = 0;

    // Per-student completed lessons set and highest reached lesson index in this course
    const userValidCompletedSet = new Map<string, Set<string>>();
    const userMaxReachedIndex = new Map<string, number>();

    for (const uid of startedUserIds) {
      const prog = progressByUser.get(uid);
      const evalState = evaluateCourseCompletion(course, {
        completedLessonIds: prog?.completedLessonIds || [],
        quizScores: prog?.quizScores || {},
      });

      const validSet = new Set(evalState.validCompletedLessonIds);
      userValidCompletedSet.set(uid, validSet);

      totalLessonCompletionsAcrossCohort += evalState.completedCount;
      studentCompletedLessonsCount.set(
        uid,
        (studentCompletedLessonsCount.get(uid) || 0) + evalState.completedCount
      );
      sumCompletionPct += evalState.percentage;

      if (
        evalState.totalLessons > 0 &&
        evalState.isComplete &&
        evalState.allQuizzesPassed
      ) {
        completedStudentsCount += 1;
        const cSet = studentCompletedCourses.get(uid) || new Set<string>();
        cSet.add(slugLower);
        studentCompletedCourses.set(uid, cSet);
      }

      // Compute highest lesson index reached by this student in this course
      let maxIdx = 1; // Starting a course reaches at least lesson 1
      for (const lid of validSet) {
        const idx = lessonIndexById.get(lid) || 0;
        if (idx > maxIdx) maxIdx = idx;
      }
      if (prog?.lastLessonId) {
        const idx = lessonIndexById.get(prog.lastLessonId) || 0;
        if (idx > maxIdx) maxIdx = idx;
      }
      for (const q of allTimeCourseQuizRows) {
        if (q.userId === uid) {
          const idx = lessonIndexById.get(q.lessonId) || 0;
          if (idx > maxIdx) maxIdx = idx;
        }
      }
      for (const ev of courseEventsRows) {
        if (ev.user_id === uid && ev.lesson_id) {
          const idx = lessonIndexById.get(ev.lesson_id) || 0;
          if (idx > maxIdx) maxIdx = idx;
        }
      }
      userMaxReachedIndex.set(uid, maxIdx);
    }

    // Lesson-level drop-off / progression calculation
    let highestDropOffLessonId: string | null = null;
    let highestDropOffLessonTitle: string | null = null;
    let highestNotYetProceededRate: number | null = null;

    for (let i = 0; i < flatLessons.length; i++) {
      const item = flatLessons[i];
      const nextItem = i < flatLessons.length - 1 ? flatLessons[i + 1] : null;

      let reachedCount = 0;
      let completedCount = 0;
      let proceededToNextCount = 0;

      for (const uid of startedUserIds) {
        const validSet = userValidCompletedSet.get(uid) || new Set<string>();
        const maxReached = userMaxReachedIndex.get(uid) || 0;
        const hasReached =
          validSet.has(item.lesson.id) || maxReached >= item.lessonIndex;
        const hasCompleted = validSet.has(item.lesson.id);

        if (hasReached) reachedCount += 1;
        if (hasCompleted) {
          completedCount += 1;
          if (nextItem) {
            const reachedNext =
              validSet.has(nextItem.lesson.id) ||
              maxReached >= nextItem.lessonIndex;
            if (reachedNext) proceededToNextCount += 1;
          }
        }
      }

      const notYetProceededCount = Math.max(0, reachedCount - completedCount);
      const completionRate =
        reachedCount > 0
          ? clampPercentage((completedCount / reachedCount) * 100)
          : null;
      const notYetProceededRate =
        reachedCount > 0
          ? clampPercentage((notYetProceededCount / reachedCount) * 100)
          : null;

      const sampleStatus: LearningDataStatus =
        reachedCount === 0
          ? "NO_DATA"
          : reachedCount < MIN_SAFE_COHORT_SIZE
            ? "INSUFFICIENT_DATA"
            : "AVAILABLE";

      let statusLabel = "Belum Ada Data";
      if (sampleStatus === "INSUFFICIENT_DATA") {
        statusLabel = "Sampel Kecil (< 3 Siswa)";
      } else if (notYetProceededRate !== null) {
        if (notYetProceededRate >= 50) {
          statusLabel = "Perlu Perhatian (Banyak Belum Melanjutkan)";
        } else if (notYetProceededRate >= 25) {
          statusLabel = "Sedang Dipelajari (Sebagian Belum Melanjutkan)";
        } else {
          statusLabel = "Progres Lancar";
        }
      }

      if (
        notYetProceededRate !== null &&
        reachedCount >= 1 &&
        (highestNotYetProceededRate === null ||
          notYetProceededRate > highestNotYetProceededRate)
      ) {
        highestNotYetProceededRate = notYetProceededRate;
        highestDropOffLessonId = item.lesson.id;
        highestDropOffLessonTitle = item.lesson.title;
      }

      lessonDropOffList.push({
        courseId: course.id,
        courseSlug: course.slug,
        courseNumber: course.number,
        courseTitle: course.title,
        moduleId: item.moduleId,
        moduleTitle: item.moduleTitle,
        moduleOrder: item.moduleOrder,
        lessonId: item.lesson.id,
        lessonTitle: item.lesson.title,
        lessonType: item.lesson.type,
        lessonIndex: item.lessonIndex,
        reachedStudentsCount: reachedCount,
        completedStudentsCount: completedCount,
        proceededToNextCount: nextItem ? proceededToNextCount : null,
        completionRate,
        notYetProceededCount,
        notYetProceededRate,
        sampleSize: reachedCount,
        sampleStatus,
        statusLabel,
      });
    }

    const startedStudentsCount = startedUserIds.size;
    const inProgressStudentsCount = Math.max(
      0,
      startedStudentsCount - completedStudentsCount
    );
    const completionRate =
      startedStudentsCount > 0
        ? clampPercentage((completedStudentsCount / startedStudentsCount) * 100)
        : null;
    const averageLessonCompletionPercentage =
      startedStudentsCount > 0
        ? clampPercentage(sumCompletionPct / startedStudentsCount)
        : null;

    // Course quiz metrics
    const quizSubmissionsCount = courseQuizRows.length;
    let quizAverageScore: number | null = null;
    let quizPassRate: number | null = null;
    if (quizSubmissionsCount > 0) {
      const sumScore = courseQuizRows.reduce((a, b) => a + b.score, 0);
      quizAverageScore = roundToOneDecimal(sumScore / quizSubmissionsCount);
      const passedCount = courseQuizRows.filter((q) => {
        const meta = catalog.lessonsByCourseAndId.get(
          `${slugLower}::${q.lessonId}`
        );
        const passThresh =
          typeof meta?.lesson.passingScore === "number"
            ? meta.lesson.passingScore
            : 70;
        return q.score >= passThresh;
      }).length;
      quizPassRate = clampPercentage((passedCount / quizSubmissionsCount) * 100);
    }

    const sampleSizeStatus: LearningDataStatus =
      startedStudentsCount === 0
        ? "NO_DATA"
        : startedStudentsCount < MIN_SAFE_COHORT_SIZE
          ? "INSUFFICIENT_DATA"
          : "AVAILABLE";

    let needsContentAttention = false;
    let attentionReason: string | null = null;
    if (startedStudentsCount >= MIN_SAFE_COHORT_SIZE) {
      if (quizPassRate !== null && quizPassRate < 60) {
        needsContentAttention = true;
        attentionReason = `Tingkat kelulusan kuis rendah (${quizPassRate}%)`;
      } else if (
        highestNotYetProceededRate !== null &&
        highestNotYetProceededRate >= 60
      ) {
        needsContentAttention = true;
        attentionReason = `Tingkat 'Belum Melanjutkan' tinggi (${highestNotYetProceededRate}%) pada "${highestDropOffLessonTitle}"`;
      }
    }

    coursePerformanceList.push({
      courseId: course.id,
      courseSlug: course.slug,
      courseNumber: course.number,
      courseTitle: course.title,
      category: course.category,
      level: course.level,
      totalLessons: flatLessons.length,
      startedStudentsCount,
      completedStudentsCount,
      inProgressStudentsCount,
      completionRate,
      averageLessonCompletionPercentage,
      quizSubmissionsCount,
      quizAverageScore,
      quizPassRate,
      highestDropOffLessonId,
      highestDropOffLessonTitle,
      highestNotYetProceededRate,
      sampleSizeStatus,
      needsContentAttention,
      attentionReason,
    });
  }

  // ── Overview Metrics ───────────────────────────────────────────
  const totalRegisteredStudents = students.length;
  const studentsStartedAnyCourse = studentStartedCourses.size;
  const activeStudentsInPeriod = studentActiveInWindow.size;
  const studentsCompletedAtLeastOneCourse = Array.from(
    studentCompletedCourses.values()
  ).filter((s) => s.size >= 1).length;

  const overallCourseStartRate =
    totalRegisteredStudents > 0
      ? clampPercentage(
          (studentsStartedAnyCourse / totalRegisteredStudents) * 100
        )
      : null;

  const startedToCompletedConversionRate =
    studentsStartedAnyCourse > 0
      ? clampPercentage(
          (studentsCompletedAtLeastOneCourse / studentsStartedAnyCourse) * 100
        )
      : null;

  let completedZeroCourses = 0;
  let completedOneToTwoCourses = 0;
  let completedThreeOrMoreCourses = 0;
  for (const stu of students) {
    const count = studentCompletedCourses.get(stu.id)?.size || 0;
    if (count === 0) completedZeroCourses += 1;
    else if (count <= 2) completedOneToTwoCourses += 1;
    else completedThreeOrMoreCourses += 1;
  }

  const totalQuizSubmissionsInPeriod = windowQuizSubs.length;
  let aggregateQuizAverageScore: number | null = null;
  let aggregateQuizPassRate: number | null = null;
  let quizDataStatus: LearningDataStatus = "NO_DATA";

  if (totalQuizSubmissionsInPeriod > 0) {
    const sum = windowQuizSubs.reduce((a, b) => a + b.score, 0);
    aggregateQuizAverageScore = roundToOneDecimal(
      sum / totalQuizSubmissionsInPeriod
    );
    const passed = windowQuizSubs.filter((q) => {
      const meta = catalog.lessonsByCourseAndId.get(
        `${q.courseSlug.toLowerCase()}::${q.lessonId}`
      );
      const thresh =
        typeof meta?.lesson.passingScore === "number"
          ? meta.lesson.passingScore
          : 70;
      return q.score >= thresh;
    }).length;
    aggregateQuizPassRate = clampPercentage(
      (passed / totalQuizSubmissionsInPeriod) * 100
    );
    quizDataStatus =
      totalQuizSubmissionsInPeriod >= MIN_SAFE_COHORT_SIZE
        ? "AVAILABLE"
        : "INSUFFICIENT_DATA";
  }

  const smallCohortProtected =
    studentsStartedAnyCourse > 0 &&
    studentsStartedAnyCourse < MIN_SAFE_COHORT_SIZE;

  const overview: AdminEducationOverviewMetrics = {
    period,
    periodLabel: windowInfo.label,
    periodStartUtc: windowInfo.startUtc,
    periodEndUtc: windowInfo.endUtc,
    minSafeCohortThreshold: MIN_SAFE_COHORT_SIZE,
    smallCohortProtected,
    totalRegisteredStudents,
    studentsStartedAnyCourse,
    activeStudentsInPeriod,
    studentsCompletedAtLeastOneCourse,
    overallCourseStartRate,
    startedToCompletedConversionRate,
    totalLessonCompletionsAcrossCohort,
    totalQuizSubmissionsInPeriod,
    aggregateQuizAverageScore,
    aggregateQuizPassRate,
    quizDataStatus,
    courseCompletionDistribution: {
      completedZeroCourses,
      completedOneToTwoCourses,
      completedThreeOrMoreCourses,
    },
  };

  // ── Quiz & Question Difficulty Intelligence ─────────────────────
  const topicPerformance: AdminQuizTopicPerformanceItem[] = [];
  const allQuestionDifficulty: AdminQuestionDifficultyItem[] = [];
  const participatingStudentsSet = new Set<string>(
    windowQuizSubs.map((q) => q.userId)
  );

  for (const meta of catalog.quizLessons) {
    const { course, module: mod, lesson } = meta;
    const slugLower = course.slug.toLowerCase();
    const subs = windowQuizSubs.filter(
      (q) => q.courseSlug.toLowerCase() === slugLower && q.lessonId === lesson.id
    );
    const passingScore =
      typeof lesson.passingScore === "number" ? lesson.passingScore : 70;
    const uniqueStudents = new Set(subs.map((s) => s.userId)).size;

    let averageScore: number | null = null;
    let passingRate: number | null = null;
    if (subs.length > 0) {
      const sum = subs.reduce((a, b) => a + b.score, 0);
      averageScore = roundToOneDecimal(sum / subs.length);
      const passedCount = subs.filter((s) => s.score >= passingScore).length;
      passingRate = clampPercentage((passedCount / subs.length) * 100);
    }

    const sampleStatus: LearningDataStatus =
      subs.length === 0
        ? "NO_DATA"
        : subs.length < MIN_SAFE_COHORT_SIZE
          ? "INSUFFICIENT_DATA"
          : "AVAILABLE";

    topicPerformance.push({
      courseSlug: course.slug,
      courseNumber: course.number,
      courseTitle: course.title,
      moduleId: mod.id,
      moduleTitle: mod.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      passingScore,
      participatingStudentsCount: uniqueStudents,
      totalSubmissionsCount: subs.length,
      averageScore,
      passingRate,
      sampleStatus,
    });

    // Per-question accuracy (without exposing answer keys!)
    if (Array.isArray(lesson.quiz)) {
      for (const q of lesson.quiz) {
        let qAttempts = 0;
        let qCorrect = 0;
        for (const sub of subs) {
          if (typeof sub.answers[q.id] === "number") {
            qAttempts += 1;
            if (sub.answers[q.id] === q.correctAnswer) {
              qCorrect += 1;
            }
          }
        }
        const successRate =
          qAttempts > 0
            ? clampPercentage((qCorrect / qAttempts) * 100)
            : null;

        let difficultyStatus: AdminQuestionDifficultyItem["difficultyStatus"] =
          "INSUFFICIENT_SAMPLE";
        if (qAttempts >= MIN_SAFE_COHORT_SIZE && successRate !== null) {
          if (successRate < 50) {
            difficultyStatus = "HIGH_DIFFICULTY";
          } else if (successRate < 75) {
            difficultyStatus = "MODERATE_DIFFICULTY";
          } else {
            difficultyStatus = "WELL_UNDERSTOOD";
          }
        }

        allQuestionDifficulty.push({
          courseSlug: course.slug,
          courseTitle: course.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          questionId: q.id,
          questionText: q.question,
          attemptsCount: qAttempts,
          correctCount: qCorrect,
          successRate,
          difficultyStatus,
        });
      }
    }
  }

  const lowSuccessQuestions = allQuestionDifficulty
    .filter(
      (q) =>
        q.difficultyStatus === "HIGH_DIFFICULTY" ||
        (q.attemptsCount >= MIN_SAFE_COHORT_SIZE &&
          q.successRate !== null &&
          q.successRate < 60)
    )
    .sort((a, b) => (a.successRate ?? 100) - (b.successRate ?? 100));

  const quizzesReport: AdminQuizIntelligenceReport = {
    period,
    dataStatus: quizDataStatus,
    totalSubmissions: totalQuizSubmissionsInPeriod,
    participatingStudentsCount: participatingStudentsSet.size,
    overallAverageScore: aggregateQuizAverageScore,
    overallPassingRate: aggregateQuizPassRate,
    topicPerformance,
    lowSuccessQuestions,
    allQuestionDifficulty,
  };

  // ── Engagement & Retention Analytics ───────────────────────────
  let dailyActiveLearners = 0;
  let weeklyActiveLearners = 0;
  let monthlyActiveLearners = 0;
  let returningLearnersCount = 0;

  let activeLast7Days = 0;
  let inactive8To30Days = 0;
  let inactiveOver30Days = 0;
  let neverStarted = 0;

  // Cohort retention grouped by ISO week of first learning activity
  const cohortsMap = new Map<
    string,
    { size: number; returned: number }
  >();

  for (const stu of students) {
    const tsList = studentAllTimestamps.get(stu.id) || [];
    if (tsList.length === 0) {
      neverStarted += 1;
      continue;
    }

    const minMs = Math.min(...tsList);
    const maxMs = Math.max(...tsList);
    const uniqueDateKeys = new Set(
      tsList.map((t) => new Date(t).toISOString().slice(0, 10))
    );

    const diffFromNowMs = Math.max(0, nowMs - maxMs);
    if (diffFromNowMs <= DAY_MS) dailyActiveLearners += 1;
    if (diffFromNowMs <= 7 * DAY_MS) {
      weeklyActiveLearners += 1;
      activeLast7Days += 1;
    } else if (diffFromNowMs <= 30 * DAY_MS) {
      monthlyActiveLearners += 1;
      inactive8To30Days += 1;
    } else {
      inactiveOver30Days += 1;
    }
    if (diffFromNowMs <= 7 * DAY_MS) {
      monthlyActiveLearners += 1;
    }

    // Returning learner = active on >= 2 distinct UTC dates (or returned at least 1 day after first activity)
    const firstDateKey = new Date(minMs).toISOString().slice(0, 10);
    const latestDateKey = new Date(maxMs).toISOString().slice(0, 10);
    const hasReturnedLater =
      uniqueDateKeys.size >= 2 && latestDateKey > firstDateKey;
    if (hasReturnedLater) {
      returningLearnersCount += 1;
    }

    const cohortKey = getIsoWeekKey(minMs);
    const entry = cohortsMap.get(cohortKey) || { size: 0, returned: 0 };
    entry.size += 1;
    if (hasReturnedLater) {
      entry.returned += 1;
    }
    cohortsMap.set(cohortKey, entry);
  }

  const returningLearnersRate =
    studentsStartedAnyCourse > 0
      ? clampPercentage(
          (returningLearnersCount / studentsStartedAnyCourse) * 100
        )
      : null;

  const retentionCohorts: AdminRetentionCohortItem[] = Array.from(
    cohortsMap.entries()
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cohortKey, stats]) => {
      const smallCohortSuppressed = stats.size < MIN_SAFE_COHORT_SIZE;
      return {
        cohortKey,
        cohortSize: stats.size,
        returnedLearnersCount: smallCohortSuppressed ? null : stats.returned,
        retentionRate: smallCohortSuppressed
          ? null
          : clampPercentage((stats.returned / stats.size) * 100),
        smallCohortSuppressed,
        dataStatus: smallCohortSuppressed ? "INSUFFICIENT_DATA" : "AVAILABLE",
      };
    });

  const completedAtLeastOneLessonCount = Array.from(
    studentCompletedLessonsCount.values()
  ).filter((c) => c >= 1).length;
  const submittedAtLeastOneQuizCount = new Set(
    allQuizSubs.map((q) => q.userId)
  ).size;

  const engagementStatus: LearningDataStatus =
    studentsStartedAnyCourse === 0
      ? "NO_DATA"
      : studentsStartedAnyCourse < MIN_SAFE_COHORT_SIZE
        ? "INSUFFICIENT_DATA"
        : "AVAILABLE";

  const engagement: AdminEngagementAndRetentionReport = {
    period,
    dataStatus: engagementStatus,
    dailyActiveLearners,
    weeklyActiveLearners,
    monthlyActiveLearners,
    returningLearnersCount,
    returningLearnersRate,
    funnel: {
      registeredStudents: totalRegisteredStudents,
      startedAtLeastOneCourse: studentsStartedAnyCourse,
      completedAtLeastOneLesson: completedAtLeastOneLessonCount,
      submittedAtLeastOneQuiz: submittedAtLeastOneQuizCount,
      completedAtLeastOneCourse: studentsCompletedAtLeastOneCourse,
    },
    inactivityDistribution: {
      activeLast7Days,
      inactive8To30Days,
      inactiveOver30Days,
      neverStarted,
    },
    retentionCohorts,
    isTelemetryBufferAtCapacity: Boolean(
      params.learningEventRows && params.learningEventRows.length >= 10000
    ),
    continuityNote:
      (engagementStatus === "NO_DATA"
        ? "Belum ada aktivitas belajar siswa yang tercatat."
        : engagementStatus === "INSUFFICIENT_DATA"
          ? `Kohort aktif (${studentsStartedAnyCourse} siswa) masih di bawah ambang batas privasi minimum (${MIN_SAFE_COHORT_SIZE} siswa). Rincian retensi per-kohort disamarkan untuk menjaga privasi.`
          : "Metrik retensi dihitung berdasarkan kohort minggu aktivitas belajar pertama dan kembalinya siswa pada hari berikutnya.") +
      (params.learningEventRows && params.learningEventRows.length >= 10000
        ? " (Buffer telemetri aktivitas beroperasi dalam batas bergulir 10.000 event terbaru; progres kelas dan riwayat kuis tersimpan permanen sebagai SSOT)."
        : ""),
  };

  return {
    privacyGuarantee: "STRICT_EDUCATION_ONLY_NO_PRIVATE_JOURNAL",
    generatedAt: new Date(nowMs).toISOString(),
    overview,
    courses: coursePerformanceList,
    lessons: lessonDropOffList,
    quizzes: quizzesReport,
    engagement,
  };
}
