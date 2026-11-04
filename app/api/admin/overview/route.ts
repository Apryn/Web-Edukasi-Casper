import { NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth";
import {
  getAllUsersForAdmin,
  getAllQuizSubmissionsForAdmin,
  getDatabaseHealth,
} from "@/lib/db";
import { getAllCourses } from "@/lib/courses-data";
import { listAdminCourses } from "@/lib/admin-course-service";

export const dynamic = "force-dynamic";

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
    const publishedCourses = getAllCourses();
    const adminCoursesResult = listAdminCourses(user);
    const allAdminCourses = adminCoursesResult.ok && adminCoursesResult.data
      ? adminCoursesResult.data.courses
      : publishedCourses;
    const auditLogs = adminCoursesResult.ok && adminCoursesResult.data
      ? adminCoursesResult.data.auditLogs
      : [];

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: users.length,
        totalCourses: publishedCourses.length,
        totalManagedCourses: allAdminCourses.length,
        totalQuizSubmissions: quizSubmissions.length,
        databaseStatus: health.status,
        backupCount: health.backupCount,
        lastBackupTime: health.lastBackupTime,
      },
      health,
      users: users.slice(-20).reverse(), // 20 most recent
      recentSubmissions: quizSubmissions.slice(-20).reverse(),
      courses: allAdminCourses,
      auditLogs,
    });
  } catch (err: unknown) {
    console.error("Admin overview error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data dashboard admin" },
      { status: 500 }
    );
  }
}
