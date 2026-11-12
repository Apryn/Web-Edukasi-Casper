import { isAdmin, type DbUser, type SafeUser } from "../auth";
import {
  dismissRecommendationForUser,
  getAllCourseProgressForAdmin,
  getAllLearningEventsForAdmin,
  getAllQuizSubmissionsForAdmin,
  getAllUserProgress,
  getAllUsersForAdmin,
  getLearningEventsForUser,
  getQuizSubmissionsForUser,
  getRecommendationDismissalsForUser,
  recordLearningEvent,
  restoreRecommendationForUser,
  type LearningEventType,
} from "../db";
import { getCourseBySlug } from "../courses-data";
import type {
  AdaptiveLearningRecommendation,
  AdminCoursePerformanceItem,
  AdminEducationOverviewMetrics,
  AdminEngagementAndRetentionReport,
  AdminFullEducationIntelligenceBundle,
  AdminLessonDropOffItem,
  AdminQuizIntelligenceReport,
  AdminTimePeriod,
  StudentLearningContinuityMetrics,
  StudentLearningDashboardReport,
} from "./types";
import {
  buildNormalizedCurriculumCatalog,
  normalizeProgressRecords,
  normalizeQuizSubmissionRecords,
} from "./progress-normalizer";
import { computeStudentCourseMetrics } from "./course-metrics";
import { computeStudentQuizAndTopicMastery } from "./quiz-topic-metrics";
import { computeStudentContinuityMetrics } from "./engagement-metrics";
import { generateAdaptiveRecommendations } from "./recommendation-engine";
import {
  buildAdminEducationIntelligence,
  parseAdminTimePeriod,
} from "./admin-education-intelligence";
import { getAllDrills, getAllSubmissionsForUser } from "../drill-storage";
import { computeStudentDrillIntelligence } from "../drill-mastery-engine";
import { generateAdaptiveDrillRecommendations } from "../drill-recommendation-engine";

export interface LearningApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

type SessionActor = DbUser | SafeUser | null | undefined;

function verifyOwnUserAccess(
  actor: SessionActor,
  requestedUserId?: string | null
): { ok: true; userId: string } | { ok: false; status: number; error: string } {
  if (!actor || !actor.id) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Sesi tidak ditemukan atau telah berakhir.",
    };
  }
  if (requestedUserId && requestedUserId.trim() !== actor.id) {
    return {
      ok: false,
      status: 403,
      error:
        "Akses ditolak: Anda tidak memiliki izin untuk mengakses data pembelajaran pengguna lain.",
    };
  }
  return { ok: true, userId: actor.id };
}

function verifyAdminAccess(
  actor: SessionActor
): { ok: true; adminId: string } | { ok: false; status: number; error: string } {
  if (!actor || !actor.id) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Sesi tidak ditemukan.",
    };
  }
  if (!isAdmin(actor)) {
    return {
      ok: false,
      status: 403,
      error:
        "Akses ditolak: Endpoint Education Intelligence hanya dapat diakses oleh Administrator.",
    };
  }
  return { ok: true, adminId: actor.id };
}

export function buildStudentLearningDashboardForUser(
  userId: string,
  referenceNowIso?: string
): StudentLearningDashboardReport {
  const catalog = buildNormalizedCurriculumCatalog();
  const rawProgress = getAllUserProgress(userId);
  const rawQuizSubs = getQuizSubmissionsForUser(userId);
  const userEvents = getLearningEventsForUser(userId);
  const dismissals = getRecommendationDismissalsForUser(userId);

  const userProgressRows = normalizeProgressRecords(rawProgress);
  const userQuizSubmissions = normalizeQuizSubmissionRecords(rawQuizSubs);

  const courseMetrics = computeStudentCourseMetrics({
    catalog,
    userProgressRows,
    userQuizSubmissions,
    userEvents,
  });

  const quizIntelligence = computeStudentQuizAndTopicMastery({
    catalog,
    userProgressRows,
    userQuizSubmissions,
  });

  const continuity = computeStudentContinuityMetrics({
    catalog,
    userProgressRows,
    userQuizSubmissions,
    userEvents,
    referenceNowIso,
  });

  const generatedAt = referenceNowIso || new Date().toISOString();
  const recResult = generateAdaptiveRecommendations({
    catalog,
    courseProgress: courseMetrics.courseProgress,
    quizIntelligence,
    continuity,
    dismissals,
    generatedAtIso: generatedAt,
  });

  // Task 5.5: Practical Drill Intelligence & Adaptive Recommendations (Modular, Non-Breaking)
  const publishedDrills = getAllDrills({ status: "PUBLISHED" });
  const drillSubmissions = getAllSubmissionsForUser(userId);
  const drillIntelligence = computeStudentDrillIntelligence(
    userId,
    publishedDrills,
    drillSubmissions
  );
  const drillRecommendations = generateAdaptiveDrillRecommendations({
    userId,
    publishedDrills,
    submissions: drillSubmissions,
    intelligenceSummary: drillIntelligence,
    dismissals,
  });

  return {
    userId,
    generatedAt,
    overall: courseMetrics.overall,
    continueLearning: courseMetrics.continueLearning,
    recommendations: recResult.recommendations,
    dismissedRecommendationsCount: recResult.dismissedCount,
    courseProgress: courseMetrics.courseProgress,
    archivedCourseHistory: courseMetrics.archivedCourseHistory,
    continuity,
    quizIntelligence,
    drillIntelligence,
    drillRecommendations,
  };
}

export function handleStudentLearningDashboardRequest(
  actor: SessionActor,
  options?: { queryUserId?: string | null }
): LearningApiResult<StudentLearningDashboardReport> {
  const auth = verifyOwnUserAccess(actor, options?.queryUserId);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }
  const report = buildStudentLearningDashboardForUser(auth.userId);
  return { ok: true, status: 200, data: report };
}

export function handleStudentRecommendationsRequest(
  actor: SessionActor,
  method: "GET" | "POST",
  options?: {
    queryUserId?: string | null;
    body?: Record<string, unknown> | null;
  }
): LearningApiResult<{
  recommendations: AdaptiveLearningRecommendation[];
  dismissedRecommendationsCount: number;
}> {
  const bodyUserId =
    options?.body && typeof options.body.userId === "string"
      ? options.body.userId
      : null;
  const auth = verifyOwnUserAccess(
    actor,
    options?.queryUserId || bodyUserId
  );
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }

  if (method === "POST") {
    const body = options?.body;
    if (!body || typeof body !== "object") {
      return { ok: false, status: 400, error: "Payload request tidak valid." };
    }
    const action = String(body.action || "dismiss").toLowerCase().trim();
    const recommendationId =
      typeof body.recommendationId === "string"
        ? body.recommendationId.trim()
        : "";

    if (action === "dismiss") {
      if (!recommendationId) {
        return {
          ok: false,
          status: 400,
          error: "recommendationId wajib diisi untuk menyembunyikan rekomendasi.",
        };
      }
      // Verify recommendation ownership & current evidence signature
      const currentReport = buildStudentLearningDashboardForUser(auth.userId);
      const targetRec = currentReport.recommendations.find(
        (r) => r.recommendationId === recommendationId
      );
      if (!targetRec) {
        return {
          ok: false,
          status: 404,
          error: "Rekomendasi tidak ditemukan atau sudah tidak aktif.",
        };
      }
      dismissRecommendationForUser({
        userId: auth.userId,
        recommendationId: targetRec.recommendationId,
        evidenceSignature: targetRec.evidenceSignature,
      });
    } else if (action === "restore") {
      restoreRecommendationForUser(
        auth.userId,
        recommendationId || undefined
      );
    } else {
      return {
        ok: false,
        status: 400,
        error: 'Action harus berupa "dismiss" atau "restore".',
      };
    }
  }

  const updated = buildStudentLearningDashboardForUser(auth.userId);
  return {
    ok: true,
    status: 200,
    data: {
      recommendations: updated.recommendations,
      dismissedRecommendationsCount: updated.dismissedRecommendationsCount,
    },
  };
}

export function handleStudentLearningProgressRequest(
  actor: SessionActor,
  options?: { queryUserId?: string | null }
): LearningApiResult<{
  userId: string;
  overall: StudentLearningDashboardReport["overall"];
  courseProgress: StudentLearningDashboardReport["courseProgress"];
  quizIntelligence: StudentLearningDashboardReport["quizIntelligence"];
}> {
  const auth = verifyOwnUserAccess(actor, options?.queryUserId);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }
  const report = buildStudentLearningDashboardForUser(auth.userId);
  return {
    ok: true,
    status: 200,
    data: {
      userId: auth.userId,
      overall: report.overall,
      courseProgress: report.courseProgress,
      quizIntelligence: report.quizIntelligence,
    },
  };
}

export function handleStudentLearningActivityRequest(
  actor: SessionActor,
  method: "GET" | "POST",
  options?: {
    queryUserId?: string | null;
    body?: Record<string, unknown> | null;
  }
): LearningApiResult<{
  userId: string;
  continuity: StudentLearningContinuityMetrics;
}> {
  const bodyUserId =
    options?.body && typeof options.body.userId === "string"
      ? options.body.userId
      : null;
  const auth = verifyOwnUserAccess(
    actor,
    options?.queryUserId || bodyUserId
  );
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }

  if (method === "POST") {
    const body = options?.body;
    if (!body || typeof body !== "object") {
      return { ok: false, status: 400, error: "Payload request tidak valid." };
    }
    const eventType = String(body.eventType || "") as LearningEventType;
    if (eventType !== "LESSON_STARTED" && eventType !== "COURSE_STARTED") {
      return {
        ok: false,
        status: 400,
        error:
          "Endpoint ini hanya mengizinkan pencatatan LESSON_STARTED atau COURSE_STARTED.",
      };
    }
    const courseSlug = String(body.courseSlug || "").toLowerCase().trim();
    const lessonId =
      typeof body.lessonId === "string" ? body.lessonId.trim() : null;
    const course = getCourseBySlug(courseSlug);
    if (!course) {
      return { ok: false, status: 404, error: "Kelas tidak ditemukan." };
    }

    let moduleId: string | null = null;
    if (lessonId) {
      let foundLesson = false;
      for (const mod of course.modules) {
        if (mod.lessons.some((l) => l.id === lessonId)) {
          foundLesson = true;
          moduleId = mod.id;
          break;
        }
      }
      if (!foundLesson) {
        return {
          ok: false,
          status: 400,
          error: "lessonId tidak ditemukan dalam silabus kelas.",
        };
      }
    }

    recordLearningEvent({
      userId: auth.userId,
      eventType,
      courseId: course.id,
      courseSlug: course.slug,
      moduleId,
      lessonId,
    });
  }

  const report = buildStudentLearningDashboardForUser(auth.userId);
  return {
    ok: true,
    status: method === "POST" ? 201 : 200,
    data: {
      userId: auth.userId,
      continuity: report.continuity,
    },
  };
}

// ── Admin Education Intelligence Handlers ──────────────────────────

function computeAdminBundle(periodRaw?: string | null): AdminFullEducationIntelligenceBundle {
  const period: AdminTimePeriod = parseAdminTimePeriod(periodRaw);
  const users = getAllUsersForAdmin() as unknown as DbUser[];
  const courseProgressRows = getAllCourseProgressForAdmin();
  const quizSubmissionRows = getAllQuizSubmissionsForAdmin();
  const learningEventRows = getAllLearningEventsForAdmin();

  return buildAdminEducationIntelligence({
    users,
    courseProgressRows,
    quizSubmissionRows,
    learningEventRows,
    period,
  });
}

export function handleAdminEducationOverviewRequest(
  actor: SessionActor,
  options?: { period?: string | null; includeBundle?: boolean }
): LearningApiResult<{
  privacyGuarantee: "STRICT_EDUCATION_ONLY_NO_PRIVATE_JOURNAL";
  overview: AdminEducationOverviewMetrics;
  bundle?: AdminFullEducationIntelligenceBundle;
}> {
  const auth = verifyAdminAccess(actor);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }
  if (
    options?.period &&
    !["7d", "30d", "90d", "all"].includes(options.period.toLowerCase().trim())
  ) {
    return {
      ok: false,
      status: 400,
      error: 'Parameter period tidak valid. Gunakan "7d", "30d", "90d", atau "all".',
    };
  }
  const bundle = computeAdminBundle(options?.period);
  return {
    ok: true,
    status: 200,
    data: {
      privacyGuarantee: bundle.privacyGuarantee,
      overview: bundle.overview,
      ...(options?.includeBundle ? { bundle } : {}),
    },
  };
}

export function handleAdminEducationCoursesRequest(
  actor: SessionActor,
  options?: { period?: string | null }
): LearningApiResult<{
  privacyGuarantee: "STRICT_EDUCATION_ONLY_NO_PRIVATE_JOURNAL";
  period: AdminTimePeriod;
  courses: AdminCoursePerformanceItem[];
}> {
  const auth = verifyAdminAccess(actor);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }
  if (
    options?.period &&
    !["7d", "30d", "90d", "all"].includes(options.period.toLowerCase().trim())
  ) {
    return { ok: false, status: 400, error: "Parameter period tidak valid." };
  }
  const bundle = computeAdminBundle(options?.period);
  return {
    ok: true,
    status: 200,
    data: {
      privacyGuarantee: bundle.privacyGuarantee,
      period: bundle.overview.period,
      courses: bundle.courses,
    },
  };
}

export function handleAdminEducationLessonsRequest(
  actor: SessionActor,
  options?: { period?: string | null; courseSlug?: string | null }
): LearningApiResult<{
  privacyGuarantee: "STRICT_EDUCATION_ONLY_NO_PRIVATE_JOURNAL";
  period: AdminTimePeriod;
  lessons: AdminLessonDropOffItem[];
}> {
  const auth = verifyAdminAccess(actor);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }
  if (
    options?.period &&
    !["7d", "30d", "90d", "all"].includes(options.period.toLowerCase().trim())
  ) {
    return { ok: false, status: 400, error: "Parameter period tidak valid." };
  }
  const bundle = computeAdminBundle(options?.period);
  const slugFilter = options?.courseSlug
    ? options.courseSlug.toLowerCase().trim()
    : null;
  const lessons = slugFilter
    ? bundle.lessons.filter((l) => l.courseSlug.toLowerCase() === slugFilter)
    : bundle.lessons;

  return {
    ok: true,
    status: 200,
    data: {
      privacyGuarantee: bundle.privacyGuarantee,
      period: bundle.overview.period,
      lessons,
    },
  };
}

export function handleAdminEducationQuizzesRequest(
  actor: SessionActor,
  options?: { period?: string | null }
): LearningApiResult<{
  privacyGuarantee: "STRICT_EDUCATION_ONLY_NO_PRIVATE_JOURNAL";
  quizzes: AdminQuizIntelligenceReport;
}> {
  const auth = verifyAdminAccess(actor);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }
  if (
    options?.period &&
    !["7d", "30d", "90d", "all"].includes(options.period.toLowerCase().trim())
  ) {
    return { ok: false, status: 400, error: "Parameter period tidak valid." };
  }
  const bundle = computeAdminBundle(options?.period);
  return {
    ok: true,
    status: 200,
    data: {
      privacyGuarantee: bundle.privacyGuarantee,
      quizzes: bundle.quizzes,
    },
  };
}

export function handleAdminEducationEngagementRequest(
  actor: SessionActor,
  options?: { period?: string | null }
): LearningApiResult<{
  privacyGuarantee: "STRICT_EDUCATION_ONLY_NO_PRIVATE_JOURNAL";
  engagement: AdminEngagementAndRetentionReport;
}> {
  const auth = verifyAdminAccess(actor);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }
  if (
    options?.period &&
    !["7d", "30d", "90d", "all"].includes(options.period.toLowerCase().trim())
  ) {
    return { ok: false, status: 400, error: "Parameter period tidak valid." };
  }
  const bundle = computeAdminBundle(options?.period);
  return {
    ok: true,
    status: 200,
    data: {
      privacyGuarantee: bundle.privacyGuarantee,
      engagement: bundle.engagement,
    },
  };
}

