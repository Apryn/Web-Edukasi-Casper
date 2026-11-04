import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCourseBySlug } from "@/lib/courses-data";
import { evaluateCourseCompletion } from "@/lib/progress";
import {
  getUserCourseProgress,
  getAllUserProgress,
} from "@/lib/db";
import { validateAndPersistUserProgress } from "@/lib/server-progress";

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const SLUG_REGEX = /^[a-zA-Z0-9_-]{1,100}$/;

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get("userId") || searchParams.get("user_id");
  if (requestedUserId && requestedUserId.trim() !== user.id) {
    return NextResponse.json(
      { error: "Akses ditolak: tidak dapat membaca progres pengguna lain." },
      { status: 403 }
    );
  }
  const courseSlug = searchParams.get("courseSlug");

  if (courseSlug) {
    if (!SLUG_REGEX.test(courseSlug)) {
      return NextResponse.json({ error: "Format courseSlug tidak valid" }, { status: 400 });
    }

    const p = getUserCourseProgress(user.id, courseSlug);
    if (!p) {
      return NextResponse.json({ userId: user.id, progress: null });
    }
    const rawCompleted = safeJsonParse<string[]>(p.completed_lesson_ids, []);
    const quizScores = safeJsonParse<Record<string, number>>(p.quiz_scores, {});
    const course = getCourseBySlug(courseSlug);
    const completedLessonIds = course
      ? evaluateCourseCompletion(course, { completedLessonIds: rawCompleted, quizScores })
          .validCompletedLessonIds
      : rawCompleted;

    return NextResponse.json({
      userId: user.id,
      progress: {
        courseSlug: p.course_slug,
        completedLessonIds,
        quizScores,
        lastAccessedLessonId: p.last_lesson_id,
        updatedAt: p.updated_at,
      },
    });
  }

  const all = getAllUserProgress(user.id);
  const map: Record<string, unknown> = {};
  all.forEach((p) => {
    const rawCompleted = safeJsonParse<string[]>(p.completed_lesson_ids, []);
    const quizScores = safeJsonParse<Record<string, number>>(p.quiz_scores, {});
    const course = getCourseBySlug(p.course_slug);
    const completedLessonIds = course
      ? evaluateCourseCompletion(course, { completedLessonIds: rawCompleted, quizScores })
          .validCompletedLessonIds
      : rawCompleted;

    map[p.course_slug] = {
      courseSlug: p.course_slug,
      completedLessonIds,
      quizScores,
      lastAccessedLessonId: p.last_lesson_id,
      updatedAt: p.updated_at,
    };
  });

  return NextResponse.json({ userId: user.id, progressMap: map });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = validateAndPersistUserProgress(user.id, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      completedLessonIds: result.completedLessonIds,
      quizScores: result.quizScores,
    });
  } catch (err: unknown) {
    console.error("Save progress error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan progres ke database server" },
      { status: 500 }
    );
  }
}
