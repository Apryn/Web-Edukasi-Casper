import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { getCustomCourses, upsertCustomCourse, deleteCustomCourse } from "@/lib/db";
import { getAllCourses } from "@/lib/courses-data";
import { Course } from "@/lib/types";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const staticCourses = getAllCourses();
  const customCourses = getCustomCourses();

  return NextResponse.json({
    courses: [...staticCourses, ...customCourses],
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, subtitle, category, level, duration, overview, objectives, modules } = body;

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      return NextResponse.json({ error: "Judul kelas wajib diisi (minimal 3 karakter)" }, { status: 400 });
    }

    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const newCourse: Course = {
      id: body.id || `custom-${crypto.randomUUID().slice(0, 8)}`,
      slug,
      number: body.number || `SC-ADMIN-${Date.now().toString().slice(-4)}`,
      title: title.trim(),
      subtitle: subtitle ? String(subtitle).trim() : "Materi Pembelajaran Khusus",
      category: category || "Trading Foundation",
      level: level || "Beginner",
      duration: duration || "1 Jam",
      totalLessons: Array.isArray(modules)
        ? modules.reduce((acc: number, m: any) => acc + (Array.isArray(m.lessons) ? m.lessons.length : 0), 0)
        : 1,
      instructor: {
        name: user.name || "Casper Academic Admin",
        role: "Verified Instructor",
      },
      overview: overview ? String(overview).trim() : "Deskripsi kurikulum kelas.",
      objectives: Array.isArray(objectives) ? objectives : ["Menguasai konsep dasar materi."],
      prerequisites: ["Kemauan belajar konsisten."],
      modules: Array.isArray(modules) && modules.length > 0
        ? modules
        : [
            {
              id: `mod-${crypto.randomUUID().slice(0, 6)}`,
              title: "Modul 1: Pengantar",
              description: "Pengenalan materi utama kelas.",
              lessons: [
                {
                  id: `les-${crypto.randomUUID().slice(0, 6)}`,
                  slug: "pengantar-materi",
                  title: "Materi Pengantar",
                  duration: "10 Menit",
                  type: "reading",
                  summary: "Ringkasan konsep awal.",
                  content: ["Selamat datang di kelas ini. Pelajari materi berikut dengan seksama."],
                },
              ],
            },
          ],
    };

    upsertCustomCourse(newCourse);

    return NextResponse.json({
      success: true,
      course: newCourse,
    });
  } catch (err: unknown) {
    console.error("Save custom course error:", err);
    return NextResponse.json({ error: "Gagal menyimpan kelas baru" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getSessionUser(req);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
    }

    deleteCustomCourse(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Delete course error:", err);
    return NextResponse.json({ error: "Gagal menghapus kelas" }, { status: 500 });
  }
}
