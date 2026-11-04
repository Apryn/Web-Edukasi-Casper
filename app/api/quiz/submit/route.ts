import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { evaluateAndRecordServerQuiz } from "@/lib/server-progress";

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
    const result = evaluateAndRecordServerQuiz(user.id, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      score: result.score,
      correctCount: result.correctCount,
      totalQuestions: result.totalQuestions,
      passed: result.passed,
      passingScore: result.passingScore,
      review: result.review,
      updatedProgress: result.updatedProgress,
    });
  } catch (err: unknown) {
    console.error("Quiz evaluation error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat mengevaluasi kuis." },
      { status: 500 }
    );
  }
}
