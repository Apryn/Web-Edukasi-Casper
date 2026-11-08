import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  handleJournalAnalyticsRequest,
  parseAnalyticsFiltersFromSearchParams,
} from "@/lib/journal-api-handlers";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  const { searchParams } = new URL(req.url);

  const queryUserId = searchParams.get("userId") || searchParams.get("studentId");
  const filters = parseAnalyticsFiltersFromSearchParams(searchParams);

  const res = await handleJournalAnalyticsRequest(user, {
    queryUserId,
    filters,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res.data, { status: res.status });
}

