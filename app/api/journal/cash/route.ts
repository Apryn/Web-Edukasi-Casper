import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handleJournalCashRequest } from "@/lib/journal-api-handlers";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  const { searchParams } = new URL(req.url);

  const res = await handleJournalCashRequest(user, "GET", {
    queryUserId: searchParams.get("userId"),
    accountId: searchParams.get("accountId"),
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

  const res = await handleJournalCashRequest(user, "POST", { body });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

export async function PUT(req: Request) {
  const user = await getSessionUser(req);
  const { searchParams } = new URL(req.url);
  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format JSON tidak valid." }, { status: 400 });
  }

  const res = await handleJournalCashRequest(user, "PUT", {
    transactionId: searchParams.get("transactionId"),
    body,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

export async function PATCH(req: Request) {
  return PUT(req);
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

  const res = await handleJournalCashRequest(user, "DELETE", {
    queryUserId: searchParams.get("userId"),
    transactionId: searchParams.get("transactionId"),
    body,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

