import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handleStudentLearningActivityRequest } from "@/lib/learning-intelligence";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  const { searchParams } = new URL(req.url);
  const queryUserId = searchParams.get("userId") || searchParams.get("user_id");

  const res = handleStudentLearningActivityRequest(user, "GET", { queryUserId });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  const { searchParams } = new URL(req.url);
  const queryUserId = searchParams.get("userId") || searchParams.get("user_id");

  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format JSON tidak valid." }, { status: 400 });
  }

  const res = handleStudentLearningActivityRequest(user, "POST", {
    queryUserId,
    body,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

