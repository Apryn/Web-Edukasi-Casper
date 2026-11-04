import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import {
  listAdminCourses,
  createAdminCourse,
  updateAdminCourse,
  patchAdminCourseAction,
  removeAdminCourse,
} from "@/lib/admin-course-service";

export const dynamic = "force-dynamic";

function revalidateCurriculumPaths(slug?: string) {
  try {
    revalidatePath("/belajar");
    revalidatePath("/dashboard");
    revalidatePath("/belajar/[slug]", "page");
    revalidatePath("/kelas/[slug]", "page");
    if (slug) {
      revalidatePath(`/belajar/${slug}`);
      revalidatePath(`/kelas/${slug}`);
    }
  } catch {
    // Ignore revalidatePath errors outside Next.js request context
  }
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  const result = listAdminCourses(user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    courses: result.data?.courses || [],
    auditLogs: result.data?.auditLogs || [],
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  try {
    const body = await req.json();
    const result = createAdminCourse(user, body || {});
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    revalidateCurriculumPaths(result.data?.course.slug);
    return NextResponse.json({
      success: true,
      course: result.data?.course,
    });
  } catch (err: unknown) {
    console.error("Create admin course error:", err);
    return NextResponse.json({ error: "Gagal menyimpan kelas baru" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await getSessionUser(req);
  try {
    const body = await req.json();
    const result = updateAdminCourse(user, body || {});
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.impact ? { impact: result.impact } : {}),
        },
        { status: result.status }
      );
    }
    revalidateCurriculumPaths(result.data?.course.slug);
    return NextResponse.json({
      success: true,
      course: result.data?.course,
    });
  } catch (err: unknown) {
    console.error("Update admin course error:", err);
    return NextResponse.json({ error: "Gagal memperbarui kurikulum kelas" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await getSessionUser(req);
  try {
    const body = await req.json();
    const result = patchAdminCourseAction(user, body || {});
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    revalidateCurriculumPaths(result.data?.course?.slug);
    return NextResponse.json({
      success: true,
      ...(result.data || {}),
    });
  } catch (err: unknown) {
    console.error("Patch admin course error:", err);
    return NextResponse.json({ error: "Gagal memproses aksi kelas" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getSessionUser(req);
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    const force = searchParams.get("force") === "true";

    const result = removeAdminCourse(user, { id, force });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    revalidateCurriculumPaths();
    return NextResponse.json({ success: true, deletedId: result.data?.deletedId });
  } catch (err: unknown) {
    console.error("Delete course error:", err);
    return NextResponse.json({ error: "Gagal menghapus kelas" }, { status: 500 });
  }
}
