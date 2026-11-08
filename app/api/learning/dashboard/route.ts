import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handleStudentLearningDashboardRequest } from "@/lib/learning-intelligence";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  const { searchParams } = new URL(req.url);
  const queryUserId = searchParams.get("userId") || searchParams.get("user_id");

  const res = handleStudentLearningDashboardRequest(user, { queryUserId });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

