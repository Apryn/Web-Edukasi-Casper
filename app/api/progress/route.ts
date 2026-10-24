import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import {
  getUserCourseProgress,
  getAllUserProgress,
  upsertUserProgress,
  recordQuizSubmission,
} from "@/lib/db";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseSlug = searchParams.get("courseSlug");

  if (courseSlug) {
    const p = getUserCourseProgress(user.id, courseSlug);
    if (!p) {
      return NextResponse.json({ progress: null });
    }
    return NextResponse.json({
      progress: {
        courseSlug: p.course_slug,
        completedLessonIds: JSON.parse(p.completed_lesson_ids || "[]"),
        quizScores: JSON.parse(p.quiz_scores || "{}"),
        lastAccessedLessonId: p.last_lesson_id,
        updatedAt: p.updated_at,
      },
    });
  }

  const all = getAllUserProgress(user.id);
  const map: Record<string, any> = {};
  all.forEach((p) => {
    map[p.course_slug] = {
      courseSlug: p.course_slug,
      completedLessonIds: JSON.parse(p.completed_lesson_ids || "[]"),
      quizScores: JSON.parse(p.quiz_scores || "{}"),
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
    const { courseSlug, completedLessonIds, quizScores, lastLessonId, quizSubmission } = body;

    if (!courseSlug) {
      return NextResponse.json({ error: "courseSlug is required" }, { status: 400 });
    }

    // Upsert progress
    upsertUserProgress({
      id: crypto.randomUUID(),
      userId: user.id,
      courseSlug,
      completedLessonIds: completedLessonIds || [],
      quizScores: quizScores || {},
      lastLessonId,
    });

    // If there is an individual quiz submission, record it
    if (quizSubmission) {
      recordQuizSubmission({
        id: crypto.randomUUID(),
        userId: user.id,
        courseSlug,
        lessonId: quizSubmission.lessonId,
        score: quizSubmission.score,
        answers: quizSubmission.answers || {},
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Save progress error:", err);
    return NextResponse.json({ error: "Gagal menyimpan progres ke database server" }, { status: 500 });
  }
}
