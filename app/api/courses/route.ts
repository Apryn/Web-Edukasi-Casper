import { NextResponse } from "next/server";
import { getAllCourses, sanitizeCourseForClient } from "@/lib/courses-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const courses = getAllCourses().map(sanitizeCourseForClient);
  return NextResponse.json({ courses });
}

