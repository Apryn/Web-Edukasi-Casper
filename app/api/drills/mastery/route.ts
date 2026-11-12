/**
 * SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
 * Student Drill Mastery & Progress API Route
 *
 * GET /api/drills/mastery
 * Returns authenticated student's drill intelligence summary and adaptive recommendations.
 */

import { handleDrillMasteryGetRequest } from "@/lib/drill-api-handlers";

export async function GET(req: Request): Promise<Response> {
  return handleDrillMasteryGetRequest(req);
}

