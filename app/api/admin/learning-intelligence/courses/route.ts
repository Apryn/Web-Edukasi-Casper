import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handleAdminEducationCoursesRequest } from "@/lib/learning-intelligence";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");

  const res = handleAdminEducationCoursesRequest(user, { period });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

