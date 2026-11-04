import crypto from "node:crypto";
import { getCourseBySlug } from "./courses-data";
import {
  getUserCourseProgress,
  upsertUserProgress,
  recordQuizSubmission,
} from "./db";
import type { Lesson } from "./types";

const SLUG_REGEX = /^[a-zA-Z0-9_-]{1,100}$/;
const PASSING_SCORE = 70; // 70% passing grade

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export interface ProgressValidationResult {
  ok: boolean;
  status: number;
  error?: string;
  completedLessonIds?: string[];
  quizScores?: Record<string, number>;
}

/**
 * Validates and persists user progress on the server:
 * - Rejects `quizSubmission` injection from client (`400`)
 * - Validates `courseSlug` against static & custom courses (`400` / `404`)
 * - Validates every ID in `completedLessonIds` & `lastLessonId` against the course syllabus (`400`)
 * - Requires server-verified quiz score >= 70 for quiz-type lessons in `completedLessonIds` (`400`)
 * - Ignores any client-supplied `quizScores`
 */
export function validateAndPersistUserProgress(
  userId: string,
  body: unknown
): ProgressValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Payload request tidak valid." };
  }

  const payload = body as Record<string, unknown>;

  // 0. Reject cross-user progress tampering attempts (403 Forbidden)
  const claimedUserId =
    typeof payload.userId === "string"
      ? payload.userId.trim()
      : typeof payload.user_id === "string"
        ? payload.user_id.trim()
        : undefined;
  if (claimedUserId && claimedUserId !== userId) {
    return {
      ok: false,
      status: 403,
      error: "Akses ditolak: tidak dapat mengakses atau memodifikasi progres pengguna lain.",
    };
  }

  // 1. Reject quizSubmission injection on /api/progress (strictly only allowed via /api/quiz/submit)
  if ("quizSubmission" in payload && payload.quizSubmission !== undefined) {
    return {
      ok: false,
      status: 400,
      error:
        "Injeksi quizSubmission ditolak. Pencatatan hasil kuis hanya diizinkan melalui POST /api/quiz/submit.",
    };
  }

  const { courseSlug, completedLessonIds, lastLessonId } = payload;

  // 2. Validate courseSlug & look up course syllabus (static or custom)
  if (!courseSlug || typeof courseSlug !== "string" || !SLUG_REGEX.test(courseSlug)) {
    return {
      ok: false,
      status: 400,
      error: "courseSlug wajib diisi dengan format alfanumerik yang valid.",
    };
  }

  const course = getCourseBySlug(courseSlug, {
    includeDrafts: true,
    includeArchived: true,
  });
  if (!course) {
    return {
      ok: false,
      status: 404,
      error: `Kelas "${courseSlug}" tidak ditemukan.`,
    };
  }

  const lessonMap = new Map<string, Lesson>();
  for (const mod of course.modules) {
    if (mod && Array.isArray(mod.lessons)) {
      for (const lesson of mod.lessons) {
        lessonMap.set(lesson.id, lesson);
      }
    }
  }

  // 3. Load server-verified quiz scores & historical completed lessons (never trust client quizScores)
  const existingProgress = getUserCourseProgress(userId, courseSlug);
  const verifiedQuizScores: Record<string, number> = existingProgress
    ? safeJsonParse<Record<string, number>>(existingProgress.quiz_scores, {})
    : {};
  const existingServerCompletedSet = new Set<string>(
    existingProgress
      ? safeJsonParse<string[]>(existingProgress.completed_lesson_ids, [])
      : []
  );

  // 4. Validate completedLessonIds strictly against course syllabus & quiz passing threshold
  const cleanCompletedLessonIds: string[] = [];
  if (completedLessonIds !== undefined) {
    if (!Array.isArray(completedLessonIds) || completedLessonIds.length > 500) {
      return {
        ok: false,
        status: 400,
        error: "completedLessonIds harus berupa array string maksimal 500 item.",
      };
    }

    for (const rawId of completedLessonIds) {
      if (typeof rawId !== "string" || !rawId.trim() || rawId.length > 100) {
        return {
          ok: false,
          status: 400,
          error: "Item di completedLessonIds tidak valid.",
        };
      }
      const id = rawId.trim();
      const lesson = lessonMap.get(id);
      if (!lesson) {
        // If this lesson ID was previously completed on the server before an admin removed
        // the lesson from the syllabus, gracefully ignore the orphaned ID instead of failing sync.
        if (existingServerCompletedSet.has(id)) {
          continue;
        }
        return {
          ok: false,
          status: 400,
          error: `ID pelajaran "${id}" tidak valid atau tidak terdaftar dalam silabus kelas "${courseSlug}".`,
        };
      }

      const isQuizLesson = lesson.type === "quiz";
      if (isQuizLesson) {
        const requiredScore =
          typeof lesson.passingScore === "number" ? lesson.passingScore : PASSING_SCORE;
        const serverQuizScore = verifiedQuizScores[id] ?? 0;
        const grandfatheredPass =
          existingServerCompletedSet.has(id) && serverQuizScore >= PASSING_SCORE;
        if (serverQuizScore < requiredScore && !grandfatheredPass) {
          return {
            ok: false,
            status: 400,
            error: `ID pelajaran bertipe quiz ("${id}") hanya dapat diselesaikan jika skor kuis server minimal ${requiredScore}.`,
          };
        }
      }

      cleanCompletedLessonIds.push(id);
    }
  }

  const deduplicatedCompletedIds = Array.from(new Set(cleanCompletedLessonIds));

  // 5. Validate lastLessonId against syllabus if provided
  let cleanLastLessonId: string | undefined = undefined;
  if (lastLessonId !== undefined && lastLessonId !== null && lastLessonId !== "") {
    if (typeof lastLessonId !== "string" || lastLessonId.length > 100) {
      return {
        ok: false,
        status: 400,
        error: "lastLessonId tidak valid.",
      };
    }
    const trimmedLast = lastLessonId.trim();
    if (!lessonMap.has(trimmedLast)) {
      if (
        existingServerCompletedSet.has(trimmedLast) ||
        existingProgress?.last_lesson_id === trimmedLast
      ) {
        cleanLastLessonId = deduplicatedCompletedIds[deduplicatedCompletedIds.length - 1];
      } else {
        return {
          ok: false,
          status: 400,
          error: `lastLessonId "${trimmedLast}" tidak ditemukan dalam silabus kelas "${courseSlug}".`,
        };
      }
    } else {
      cleanLastLessonId = trimmedLast;
    }
  }

  // 6. Persist strictly bound to userId with server-verified quizScores
  upsertUserProgress({
    id: existingProgress ? existingProgress.id : crypto.randomUUID(),
    userId,
    courseSlug,
    completedLessonIds: deduplicatedCompletedIds,
    quizScores: verifiedQuizScores,
    lastLessonId: cleanLastLessonId,
  });

  return {
    ok: true,
    status: 200,
    completedLessonIds: deduplicatedCompletedIds,
    quizScores: verifiedQuizScores,
  };
}

export interface ServerQuizEvalResult {
  ok: boolean;
  status: number;
  error?: string;
  score?: number;
  correctCount?: number;
  totalQuestions?: number;
  passed?: boolean;
  passingScore?: number;
  review?: Array<{
    questionId: string;
    question: string;
    selectedAnswer: number;
    correctAnswer: number;
    isCorrect: boolean;
    explanation: string;
  }>;
  updatedProgress?: {
    completedLessonIds: string[];
    quizScores: Record<string, number>;
  };
}

/**
 * Evaluates a quiz submission on the server against static or custom course syllabus,
 * records the submission in `quiz_submissions`, and updates `course_progress` (marking
 * the quiz lesson complete only if score >= 70).
 */
export function evaluateAndRecordServerQuiz(
  userId: string,
  body: unknown
): ServerQuizEvalResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Payload kuis tidak valid" };
  }

  const rawQuizBody = body as Record<string, unknown>;
  const claimedQuizUserId =
    typeof rawQuizBody.userId === "string"
      ? rawQuizBody.userId.trim()
      : typeof rawQuizBody.user_id === "string"
        ? rawQuizBody.user_id.trim()
        : undefined;
  if (claimedQuizUserId && claimedQuizUserId !== userId) {
    return {
      ok: false,
      status: 403,
      error: "Akses ditolak: tidak dapat mengakses atau memodifikasi progres pengguna lain.",
    };
  }

  const { courseSlug, lessonId, answers } = body as {
    courseSlug?: unknown;
    lessonId?: unknown;
    answers?: unknown;
  };

  if (!courseSlug || typeof courseSlug !== "string") {
    return { ok: false, status: 400, error: "courseSlug tidak valid" };
  }

  if (!lessonId || typeof lessonId !== "string") {
    return { ok: false, status: 400, error: "lessonId tidak valid" };
  }

  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return {
      ok: false,
      status: 400,
      error: "Jawaban kuis harus berupa objek pemetaan id pertanyaan dan pilihan jawaban",
    };
  }

  const answerMap = answers as Record<string, number>;

  // 1. Fetch course & lesson from server source of truth (static or custom courses)
  const course = getCourseBySlug(courseSlug, {
    includeDrafts: true,
    includeArchived: true,
  });
  if (!course) {
    return { ok: false, status: 404, error: "Kelas tidak ditemukan" };
  }

  const validLessonIds = new Set<string>();
  let targetLesson: Lesson | null = null;
  for (const mod of course.modules) {
    for (const l of mod.lessons) {
      validLessonIds.add(l.id);
      if (l.id === lessonId) {
        targetLesson = l;
      }
    }
  }

  if (!targetLesson || !targetLesson.quiz || targetLesson.quiz.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Materi ini tidak memiliki kuis evaluasi",
    };
  }

  const lessonPassingScore =
    typeof targetLesson.passingScore === "number"
      ? targetLesson.passingScore
      : PASSING_SCORE;

  const quizQuestions = targetLesson.quiz;
  let correctCount = 0;
  const reviewDetails: NonNullable<ServerQuizEvalResult["review"]> = [];

  // 2. Evaluate answers against server-side truth
  quizQuestions.forEach((q) => {
    const selected = typeof answerMap[q.id] === "number" ? answerMap[q.id] : -1;
    const isCorrect = selected === q.correctAnswer;
    if (isCorrect) {
      correctCount++;
    }

    reviewDetails.push({
      questionId: q.id,
      question: q.question,
      selectedAnswer: selected,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation: q.explanation || "Jawaban telah diverifikasi oleh sistem evaluasi.",
    });
  });

  const totalQuestions = quizQuestions.length;
  const score = Math.round((correctCount / totalQuestions) * 100);
  const passed = score >= lessonPassingScore;

  // 3. Record quiz submission in database
  const submissionId = crypto.randomUUID();
  recordQuizSubmission({
    id: submissionId,
    userId,
    courseSlug,
    lessonId,
    score,
    answers: answerMap,
  });

  // 4. Update user course progress
  const existingProgress = getUserCourseProgress(userId, courseSlug);
  let completedLessonIds: string[] = [];
  let currentQuizScores: Record<string, number> = {};

  if (existingProgress) {
    try {
      const parsedIds = JSON.parse(existingProgress.completed_lesson_ids || "[]");
      completedLessonIds = Array.isArray(parsedIds)
        ? parsedIds.filter((id) => typeof id === "string" && validLessonIds.has(id))
        : [];
    } catch {
      completedLessonIds = [];
    }
    try {
      currentQuizScores = JSON.parse(existingProgress.quiz_scores || "{}");
    } catch {
      currentQuizScores = {};
    }
  }

  // Update highest score for this quiz (never lower an existing higher score)
  const previousScore = currentQuizScores[lessonId] || 0;
  currentQuizScores[lessonId] = Math.max(previousScore, score);

  const isMandatoryQuizLesson = targetLesson.type === "quiz";

  // Mandatory evaluation lessons (type === "quiz") require >= lessonPassingScore to be completed.
  // Practice quizzes on non-quiz lessons (reading/video/chart-study) must NEVER revoke lesson completion on failure (BUG-03).
  if (passed) {
    if (!completedLessonIds.includes(lessonId)) {
      completedLessonIds.push(lessonId);
    }
  } else if (
    isMandatoryQuizLesson &&
    previousScore < lessonPassingScore &&
    completedLessonIds.includes(lessonId)
  ) {
    completedLessonIds = completedLessonIds.filter((id) => id !== lessonId);
  }

  completedLessonIds = Array.from(new Set(completedLessonIds));

  upsertUserProgress({
    id: existingProgress ? existingProgress.id : crypto.randomUUID(),
    userId,
    courseSlug,
    completedLessonIds,
    quizScores: currentQuizScores,
    lastLessonId: lessonId,
  });

  return {
    ok: true,
    status: 200,
    score,
    correctCount,
    totalQuestions,
    passed,
    passingScore: lessonPassingScore,
    review: reviewDetails,
    updatedProgress: {
      completedLessonIds,
      quizScores: currentQuizScores,
    },
  };
}

