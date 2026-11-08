import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handleJournalConsentRequest } from "@/lib/journal-api-handlers";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  const { searchParams } = new URL(req.url);

  const res = await handleJournalConsentRequest(user, "GET", {
    queryUserId: searchParams.get("userId"),
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format JSON tidak valid." }, { status: 400 });
  }

  const res = await handleJournalConsentRequest(user, "POST", { body });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser(req);
  const { searchParams } = new URL(req.url);
  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const res = await handleJournalConsentRequest(user, "DELETE", {
    queryUserId: searchParams.get("userId"),
    body,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

export async function PATCH(req: Request) {
  return DELETE(req);
}

