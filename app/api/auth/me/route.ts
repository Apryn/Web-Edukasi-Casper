import { NextResponse } from "next/server";
import { getSessionUser, sanitizeUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: sanitizeUser(user),
  });
}
