import type { Course, CourseModule, Lesson } from "../types";
import type {
  DbCourseProgress,
  DbLearningEvent,
  DbQuizSubmission,
  DbRecommendationDismissal,
  DbUser,
} from "../db";
import { getAllCourses } from "../courses-data";

export interface FlattenedLessonMeta {
  course: Course;
  module: CourseModule;
  moduleIndex: number;
  lesson: Lesson;
  lessonIndexInCourse: number; // 0-based
  nextLessonInCourse: Lesson | null;
}

export interface NormalizedUserProgressRecord {
  id: string;
  userId: string;
  courseSlug: string;
  completedLessonIds: string[];
  quizScores: Record<string, number>;
  lastLessonId: string | null;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
}

export interface NormalizedQuizSubmissionRecord {
  id: string;
  userId: string;
  courseSlug: string;
  lessonId: string;
  score: number;
  answers: Record<string, number>;
  createdAt: string;
  createdAtMs: number;
}

export interface NormalizedCurriculumCatalog {
  publishedCourses: Course[];
  publishedBySlug: Map<string, Course>;
  allCoursesBySlug: Map<string, Course>;
  lessonsByCourseAndId: Map<string, FlattenedLessonMeta>;
  quizLessons: FlattenedLessonMeta[];
}

export function roundToOneDecimal(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 10) / 10;
}

export function clampPercentage(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.min(100, Math.max(0, roundToOneDecimal(val)));
}

export function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function buildNormalizedCurriculumCatalog(
  explicitCourses?: Course[]
): NormalizedCurriculumCatalog {
  const allCourses =
    explicitCourses ?? getAllCourses({ includeDrafts: true, includeArchived: true });

  const publishedCourses = allCourses
    .filter((c) => (c.status || "published") === "published")
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const publishedBySlug = new Map<string, Course>();
  for (const c of publishedCourses) {
    publishedBySlug.set(c.slug.toLowerCase().trim(), c);
  }

  const allCoursesBySlug = new Map<string, Course>();
  for (const c of allCourses) {
    allCoursesBySlug.set(c.slug.toLowerCase().trim(), c);
  }

  const lessonsByCourseAndId = new Map<string, FlattenedLessonMeta>();
  const quizLessons: FlattenedLessonMeta[] = [];

  for (const course of publishedCourses) {
    const flatCourseLessons: Array<{
      module: CourseModule;
      moduleIndex: number;
      lesson: Lesson;
    }> = [];

    course.modules.forEach((mod, modIdx) => {
      if (!mod || !Array.isArray(mod.lessons)) return;
      mod.lessons.forEach((lesson) => {
        if (!lesson || !lesson.id) return;
        flatCourseLessons.push({ module: mod, moduleIndex: modIdx, lesson });
      });
    });

    flatCourseLessons.forEach((item, idx) => {
      const nextItem =
        idx < flatCourseLessons.length - 1 ? flatCourseLessons[idx + 1].lesson : null;
      const meta: FlattenedLessonMeta = {
        course,
        module: item.module,
        moduleIndex: item.moduleIndex,
        lesson: item.lesson,
        lessonIndexInCourse: idx,
        nextLessonInCourse: nextItem,
      };
      lessonsByCourseAndId.set(`${course.slug.toLowerCase()}::${item.lesson.id}`, meta);
      if (Array.isArray(item.lesson.quiz) && item.lesson.quiz.length > 0) {
        quizLessons.push(meta);
      }
    });
  }

  return {
    publishedCourses,
    publishedBySlug,
    allCoursesBySlug,
    lessonsByCourseAndId,
    quizLessons,
  };
}

export function normalizeProgressRecords(
  rawRows: DbCourseProgress[]
): NormalizedUserProgressRecord[] {
  if (!Array.isArray(rawRows)) return [];

  const byUserAndCourse = new Map<string, NormalizedUserProgressRecord>();

  for (const row of rawRows) {
    if (!row || typeof row !== "object") continue;
    const userId = String(row.user_id || "").trim();
    const courseSlug = String(row.course_slug || "").toLowerCase().trim();
    if (!userId || !courseSlug) continue;

    const rawCompleted = safeParseJson<unknown[]>(row.completed_lesson_ids, []);
    const completedLessonIds = Array.isArray(rawCompleted)
      ? Array.from(
          new Set(
            rawCompleted
              .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
              .map((id) => id.trim())
          )
        )
      : [];

    const rawScores = safeParseJson<Record<string, unknown>>(row.quiz_scores, {});
    const quizScores: Record<string, number> = {};
    if (rawScores && typeof rawScores === "object" && !Array.isArray(rawScores)) {
      for (const [k, v] of Object.entries(rawScores)) {
        if (typeof v === "number" && Number.isFinite(v)) {
          quizScores[k.trim()] = Math.max(0, Math.min(100, Math.round(v)));
        }
      }
    }

    const updatedAt =
      row.updated_at && !Number.isNaN(Date.parse(row.updated_at))
        ? new Date(row.updated_at).toISOString()
        : new Date(0).toISOString();
    const startedAt =
      row.started_at && !Number.isNaN(Date.parse(row.started_at))
        ? new Date(row.started_at).toISOString()
        : updatedAt;
    const completedAt =
      row.completed_at && !Number.isNaN(Date.parse(row.completed_at))
        ? new Date(row.completed_at).toISOString()
        : null;

    const key = `${userId}::${courseSlug}`;
    const existing = byUserAndCourse.get(key);
    if (!existing || Date.parse(updatedAt) >= Date.parse(existing.updatedAt)) {
      byUserAndCourse.set(key, {
        id: String(row.id || key),
        userId,
        courseSlug,
        completedLessonIds,
        quizScores,
        lastLessonId:
          typeof row.last_lesson_id === "string" && row.last_lesson_id.trim()
            ? row.last_lesson_id.trim()
            : null,
        startedAt,
        completedAt,
        updatedAt,
      });
    }
  }

  return Array.from(byUserAndCourse.values());
}

export function normalizeQuizSubmissionRecords(
  rawRows: DbQuizSubmission[]
): NormalizedQuizSubmissionRecord[] {
  if (!Array.isArray(rawRows)) return [];
  const list: NormalizedQuizSubmissionRecord[] = [];
  const seenIds = new Set<string>();

  for (const row of rawRows) {
    if (!row || typeof row !== "object") continue;
    const id = String(row.id || "").trim();
    const userId = String(row.user_id || "").trim();
    const courseSlug = String(row.course_slug || "").toLowerCase().trim();
    const lessonId = String(row.lesson_id || "").trim();
    if (!userId || !courseSlug || !lessonId) continue;
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);

    const rawScore = typeof row.score === "number" && Number.isFinite(row.score) ? row.score : 0;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    const rawAnswers = safeParseJson<Record<string, unknown>>(row.answers, {});
    const answers: Record<string, number> = {};
    if (rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)) {
      for (const [qId, opt] of Object.entries(rawAnswers)) {
        if (typeof opt === "number" && Number.isFinite(opt)) {
          answers[qId.trim()] = Math.floor(opt);
        }
      }
    }

    const parsedTime = row.created_at ? Date.parse(row.created_at) : NaN;
    const createdAtMs = Number.isFinite(parsedTime) ? parsedTime : 0;
    const createdAt = new Date(createdAtMs).toISOString();

    list.push({
      id: id || `${userId}_${courseSlug}_${lessonId}_${createdAtMs}`,
      userId,
      courseSlug,
      lessonId,
      score,
      answers,
      createdAt,
      createdAtMs,
    });
  }

  return list.sort((a, b) => {
    if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
    return a.id.localeCompare(b.id);
  });
}

export function filterStudentAccounts(users: DbUser[]): DbUser[] {
  if (!Array.isArray(users)) return [];
  return users.filter((u) => {
    if (!u || typeof u !== "object") return false;
    const role = String(u.role || "USER").toUpperCase().trim();
    return role === "USER";
  });
}

export type { DbLearningEvent, DbRecommendationDismissal };

