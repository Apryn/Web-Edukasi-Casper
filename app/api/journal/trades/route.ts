import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handleJournalTradesRequest } from "@/lib/journal-api-handlers";
import type { TradeStatus, TradeDirection, TradeOutcome } from "@/lib/journal-types";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  const { searchParams } = new URL(req.url);

  const res = await handleJournalTradesRequest(user, "GET", {
    queryUserId: searchParams.get("userId"),
    filters: {
      accountId: searchParams.get("accountId") || undefined,
      status: (searchParams.get("status") as TradeStatus) || undefined,
      pair: searchParams.get("pair") || searchParams.get("symbol") || undefined,
      direction: (searchParams.get("direction") as TradeDirection) || undefined,
      outcome: (searchParams.get("outcome") as TradeOutcome) || undefined,
      strategyId: searchParams.get("strategyId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    },
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

  const res = await handleJournalTradesRequest(user, "POST", { body });
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

  const res = await handleJournalTradesRequest(user, "PUT", {
    tradeId: searchParams.get("tradeId"),
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

  const res = await handleJournalTradesRequest(user, "DELETE", {
    queryUserId: searchParams.get("userId"),
    tradeId: searchParams.get("tradeId"),
    body,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

