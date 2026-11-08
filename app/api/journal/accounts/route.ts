import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handleJournalAccountsRequest } from "@/lib/journal-api-handlers";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  const { searchParams } = new URL(req.url);
  const queryUserId = searchParams.get("userId");
  const includeArchived = searchParams.get("includeArchived") !== "false";

  const res = await handleJournalAccountsRequest(user, "GET", {
    queryUserId,
    includeArchived,
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

  const res = await handleJournalAccountsRequest(user, "POST", { body });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

export async function PUT(req: Request) {
  const user = await getSessionUser(req);
  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format JSON tidak valid." }, { status: 400 });
  }

  const res = await handleJournalAccountsRequest(user, "PUT", { body });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

export async function PATCH(req: Request) {
  return PUT(req);
}

