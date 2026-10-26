import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getCourseBySlug } from "@/lib/courses-data";
import {
  getUserCourseProgress,
  upsertUserProgress,
  recordQuizSubmission,
} from "@/lib/db";

const PASSING_SCORE = 70; // 70% passing grade

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Sesi tidak valid atau telah berakhir. Silakan login kembali." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { courseSlug, lessonId, answers } = body;

    if (!courseSlug || typeof courseSlug !== "string") {
      return NextResponse.json({ error: "courseSlug tidak valid" }, { status: 400 });
    }

    if (!lessonId || typeof lessonId !== "string") {
      return NextResponse.json({ error: "lessonId tidak valid" }, { status: 400 });
    }

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json(
        { error: "Jawaban kuis harus berupa objek pemetaan id pertanyaan dan pilihan jawaban" },
        { status: 400 }
      );
    }

    // 1. Fetch course & lesson from server source of truth
    const course = getCourseBySlug(courseSlug);
    if (!course) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }

    let targetLesson = null;
    for (const mod of course.modules) {
      const found = mod.lessons.find((l) => l.id === lessonId);
      if (found) {
        targetLesson = found;
        break;
      }
    }

    if (!targetLesson || !targetLesson.quiz || targetLesson.quiz.length === 0) {
      return NextResponse.json(
        { error: "Materi ini tidak memiliki kuis evaluasi" },
        { status: 400 }
      );
    }

    const quizQuestions = targetLesson.quiz;
    let correctCount = 0;
    const reviewDetails: Array<{
      questionId: string;
      question: string;
      selectedAnswer: number;
      correctAnswer: number;
      isCorrect: boolean;
      explanation: string;
    }> = [];

    // 2. Evaluate answers against server-side truth
    quizQuestions.forEach((q) => {
      const selected = typeof answers[q.id] === "number" ? answers[q.id] : -1;
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
    const passed = score >= PASSING_SCORE;

    // 3. Record quiz submission in database
    const submissionId = crypto.randomUUID();
    recordQuizSubmission({
      id: submissionId,
      userId: user.id,
      courseSlug,
      lessonId,
      score,
      answers,
    });

    // 4. Update user course progress
    const existingProgress = getUserCourseProgress(user.id, courseSlug);
    let completedLessonIds: string[] = [];
    let currentQuizScores: Record<string, number> = {};

    if (existingProgress) {
      try {
        completedLessonIds = JSON.parse(existingProgress.completed_lesson_ids || "[]");
      } catch {
        completedLessonIds = [];
      }
      try {
        currentQuizScores = JSON.parse(existingProgress.quiz_scores || "{}");
      } catch {
        currentQuizScores = {};
      }
    }

    // Update highest score for this quiz
    const previousScore = currentQuizScores[lessonId] || 0;
    currentQuizScores[lessonId] = Math.max(previousScore, score);

    // Only mark quiz lesson as completed if student achieves passing grade (>= 70%)
    if (passed) {
      if (!completedLessonIds.includes(lessonId)) {
        completedLessonIds.push(lessonId);
      }
    } else if (previousScore < PASSING_SCORE && completedLessonIds.includes(lessonId)) {
      completedLessonIds = completedLessonIds.filter((id) => id !== lessonId);
    }

    upsertUserProgress({
      id: existingProgress ? existingProgress.id : crypto.randomUUID(),
      userId: user.id,
      courseSlug,
      completedLessonIds,
      quizScores: currentQuizScores,
      lastLessonId: lessonId,
    });

    // 5. Return sanitized evaluation result to student
    return NextResponse.json({
      success: true,
      score,
      correctCount,
      totalQuestions,
      passed,
      passingScore: PASSING_SCORE,
      review: reviewDetails,
      updatedProgress: {
        completedLessonIds,
        quizScores: currentQuizScores,
      },
    });
  } catch (err: unknown) {
    console.error("Quiz evaluation error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat mengevaluasi kuis." },
      { status: 500 }
    );
  }
}
