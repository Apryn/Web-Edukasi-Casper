import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import {
  getUserCourseProgress,
  getAllUserProgress,
  upsertUserProgress,
  recordQuizSubmission,
} from "@/lib/db";

// Helper for safe JSON parsing with fallback
function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Validation helpers
const SLUG_REGEX = /^[a-zA-Z0-9_-]{1,100}$/;

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseSlug = searchParams.get("courseSlug");

  if (courseSlug) {
    if (!SLUG_REGEX.test(courseSlug)) {
      return NextResponse.json({ error: "Format courseSlug tidak valid" }, { status: 400 });
    }

    const p = getUserCourseProgress(user.id, courseSlug);
    if (!p) {
      return NextResponse.json({ progress: null });
    }
    return NextResponse.json({
      progress: {
        courseSlug: p.course_slug,
        completedLessonIds: safeJsonParse<string[]>(p.completed_lesson_ids, []),
        quizScores: safeJsonParse<Record<string, number>>(p.quiz_scores, {}),
        lastAccessedLessonId: p.last_lesson_id,
        updatedAt: p.updated_at,
      },
    });
  }

  const all = getAllUserProgress(user.id);
  const map: Record<string, unknown> = {};
  all.forEach((p) => {
    map[p.course_slug] = {
      courseSlug: p.course_slug,
      completedLessonIds: safeJsonParse<string[]>(p.completed_lesson_ids, []),
      quizScores: safeJsonParse<Record<string, number>>(p.quiz_scores, {}),
      lastAccessedLessonId: p.last_lesson_id,
      updatedAt: p.updated_at,
    };
  });

  return NextResponse.json({ progressMap: map });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { courseSlug, completedLessonIds, lastLessonId, quizSubmission } = body;

    // 1. Validate courseSlug
    if (!courseSlug || typeof courseSlug !== "string" || !SLUG_REGEX.test(courseSlug)) {
      return NextResponse.json(
        { error: "courseSlug wajib diisi dengan format alfanumerik yang valid" },
        { status: 400 }
      );
    }

    // 2. Validate completedLessonIds
    const cleanCompletedLessonIds: string[] = [];
    if (completedLessonIds !== undefined) {
      if (!Array.isArray(completedLessonIds) || completedLessonIds.length > 500) {
        return NextResponse.json(
          { error: "completedLessonIds harus berupa array string maksimal 500 item" },
          { status: 400 }
        );
      }
      for (const id of completedLessonIds) {
        if (typeof id !== "string" || id.length > 100) {
          return NextResponse.json(
            { error: "Item di completedLessonIds tidak valid" },
            { status: 400 }
          );
        }
        cleanCompletedLessonIds.push(id.trim());
      }
    }

    // 3. Quiz Scores Security: Quiz scores must be evaluated and recorded strictly via /api/quiz/submit.
    // Client-supplied quizScores are ignored to prevent score tampering.
    const existingProgress = getUserCourseProgress(user.id, courseSlug);
    const verifiedQuizScores: Record<string, number> = existingProgress
      ? safeJsonParse<Record<string, number>>(existingProgress.quiz_scores, {})
      : {};

    // 4. Validate lastLessonId
    let cleanLastLessonId: string | undefined = undefined;
    if (lastLessonId !== undefined && lastLessonId !== null) {
      if (typeof lastLessonId !== "string" || lastLessonId.length > 100) {
        return NextResponse.json(
          { error: "lastLessonId tidak valid" },
          { status: 400 }
        );
      }
      cleanLastLessonId = lastLessonId.trim();
    }

    // 5. Upsert progress strictly bound to user.id using verified quiz scores
    upsertUserProgress({
      id: existingProgress ? existingProgress.id : crypto.randomUUID(),
      userId: user.id,
      courseSlug,
      completedLessonIds: cleanCompletedLessonIds,
      quizScores: verifiedQuizScores,
      lastLessonId: cleanLastLessonId,
    });

    // 6. Validate & record individual quiz submission if present
    if (quizSubmission) {
      if (
        typeof quizSubmission !== "object" ||
        quizSubmission === null ||
        typeof quizSubmission.lessonId !== "string" ||
        typeof quizSubmission.score !== "number"
      ) {
        return NextResponse.json(
          { error: "Format quizSubmission tidak valid" },
          { status: 400 }
        );
      }

      const cleanAnswers: Record<string, number> = {};
      if (quizSubmission.answers && typeof quizSubmission.answers === "object") {
        for (const [k, v] of Object.entries(quizSubmission.answers)) {
          if (typeof v === "number") {
            cleanAnswers[k] = v;
          }
        }
      }

      recordQuizSubmission({
        id: crypto.randomUUID(),
        userId: user.id,
        courseSlug,
        lessonId: String(quizSubmission.lessonId).slice(0, 100),
        score: Math.min(100, Math.max(0, Math.round(quizSubmission.score))),
        answers: cleanAnswers,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Save progress error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan progres ke database server" },
      { status: 500 }
    );
  }
}
