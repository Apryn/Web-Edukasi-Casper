import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminStudentIntelligence } from "@/lib/admin-student-intelligence";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  const res = getAdminStudentIntelligence(user);

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

