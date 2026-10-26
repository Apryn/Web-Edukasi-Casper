import { NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth";
import {
  getAllUsersForAdmin,
  getAllQuizSubmissionsForAdmin,
  getDatabaseHealth,
  getCustomCourses,
} from "@/lib/db";
import { getAllCourses } from "@/lib/courses-data";

export async function GET(req: Request) {
  const user = await getSessionUser(req);

  // 1. Strict server-side admin role verification
  if (!user || !isAdmin(user)) {
    return NextResponse.json(
      { error: "Akses ditolak. Endpoint ini hanya dapat diakses oleh Administrator." },
      { status: 403 }
    );
  }

  try {
    const users = getAllUsersForAdmin();
    const quizSubmissions = getAllQuizSubmissionsForAdmin();
    const health = getDatabaseHealth();
    const staticCourses = getAllCourses();
    const customCourses = getCustomCourses();

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: users.length,
        totalCourses: staticCourses.length + customCourses.length,
        totalQuizSubmissions: quizSubmissions.length,
        databaseStatus: health.status,
        backupCount: health.backupCount,
        lastBackupTime: health.lastBackupTime,
      },
      health,
      users: users.slice(-20).reverse(), // 20 most recent
      recentSubmissions: quizSubmissions.slice(-20).reverse(),
      courses: [...staticCourses, ...customCourses],
    });
  } catch (err: unknown) {
    console.error("Admin overview error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data dashboard admin" },
      { status: 500 }
    );
  }
}
