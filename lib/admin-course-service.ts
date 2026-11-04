import crypto from "node:crypto";
import { isAdmin, type SafeUser } from "./auth";
import {
  getAllCourses,
  getCourseByIdOrSlugForAdmin,
  getStaticBaselineCourse,
  normalizeCourse,
  sanitizeCurriculumText,
} from "./courses-data";
import {
  upsertCustomCourse,
  deleteCustomCourse,
  resetStaticCourseOverride,
  getCourseProgressImpact,
  getAdminAuditLogs,
  STATIC_ID_TO_SLUG,
  STATIC_SLUG_TO_ID,
  type DbUser,
} from "./db";
import type { Course, CoursePublicationStatus } from "./types";

export interface AdminServiceResult<T = unknown> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  impact?: {
    enrolledUsersCount?: number;
    affectedLessonUsersCount?: number;
    affectedLessonIds?: string[];
  };
}

function verifyAdminUser(
  user: DbUser | SafeUser | null | undefined
): { ok: true; admin: DbUser | SafeUser } | { ok: false; status: number; error: string } {
  if (!user || !isAdmin(user)) {
    return {
      ok: false,
      status: 403,
      error: "Akses ditolak: Hanya Administrator yang diizinkan mengelola kurikulum.",
    };
  }
  return { ok: true, admin: user };
}

function validateCourseStructureIntegrity(
  course: Course
): { ok: true } | { ok: false; error: string } {
  if (!course.title || course.title.trim().length < 3) {
    return { ok: false, error: "Judul kelas wajib diisi (minimal 3 karakter)." };
  }
  if (!course.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(course.slug)) {
    return {
      ok: false,
      error: "Slug kelas tidak valid (gunakan huruf kecil, angka, dan tanda hubung).",
    };
  }

  const moduleIds = new Set<string>();
  const lessonIds = new Set<string>();

  for (let mIdx = 0; mIdx < course.modules.length; mIdx++) {
    const mod = course.modules[mIdx];
    if (!mod.id || !mod.id.trim()) {
      return { ok: false, error: `Modul ke-${mIdx + 1} wajib memiliki ID modul.` };
    }
    if (moduleIds.has(mod.id)) {
      return {
        ok: false,
        error: `Konflik ID modul duplikat: "${mod.id}" digunakan lebih dari satu kali.`,
      };
    }
    moduleIds.add(mod.id);

    if (!mod.title || !mod.title.trim()) {
      return { ok: false, error: `Judul pada modul "${mod.id}" wajib diisi.` };
    }

    for (let lIdx = 0; lIdx < mod.lessons.length; lIdx++) {
      const les = mod.lessons[lIdx];
      if (!les.id || !les.id.trim()) {
        return {
          ok: false,
          error: `Pelajaran ke-${lIdx + 1} pada modul "${mod.title}" wajib memiliki ID pelajaran.`,
        };
      }
      if (lessonIds.has(les.id)) {
        return {
          ok: false,
          error: `Konflik ID pelajaran duplikat: "${les.id}" digunakan lebih dari satu kali dalam kelas ini.`,
        };
      }
      lessonIds.add(les.id);

      if (!les.title || !les.title.trim()) {
        return {
          ok: false,
          error: `Judul pelajaran "${les.id}" pada modul "${mod.title}" wajib diisi.`,
        };
      }

      if (Array.isArray(les.quiz) && les.quiz.length > 0) {
        const questionIds = new Set<string>();
        for (let qIdx = 0; qIdx < les.quiz.length; qIdx++) {
          const q = les.quiz[qIdx];
          if (!q.id || !q.id.trim()) {
            return {
              ok: false,
              error: `Soal ke-${qIdx + 1} pada pelajaran "${les.title}" wajib memiliki ID soal.`,
            };
          }
          if (questionIds.has(q.id)) {
            return {
              ok: false,
              error: `Konflik ID soal duplikat "${q.id}" pada pelajaran "${les.title}".`,
            };
          }
          questionIds.add(q.id);

          if (!q.question || !q.question.trim()) {
            return {
              ok: false,
              error: `Teks pertanyaan ke-${qIdx + 1} pada pelajaran "${les.title}" wajib diisi.`,
            };
          }
          if (!Array.isArray(q.options) || q.options.length < 2) {
            return {
              ok: false,
              error: `Soal "${q.question}" wajib memiliki minimal 2 pilihan jawaban.`,
            };
          }
          if (
            typeof q.correctAnswer !== "number" ||
            q.correctAnswer < 0 ||
            q.correctAnswer >= q.options.length
          ) {
            return {
              ok: false,
              error: `Indeks kunci jawaban benar (correctAnswer) pada soal "${q.question}" tidak valid.`,
            };
          }
        }
      }
    }
  }

  return { ok: true };
}

export function listAdminCourses(
  user: DbUser | SafeUser | null | undefined
): AdminServiceResult<{
  courses: Array<
    Course & {
      enrolledUsersCount: number;
      quizSubmissionsCount: number;
      modulesCount: number;
      quizQuestionsCount: number;
    }
  >;
  auditLogs: ReturnType<typeof getAdminAuditLogs>;
}> {
  const auth = verifyAdminUser(user);
  if (!auth.ok) return auth;

  const allCourses = getAllCourses({ includeDrafts: true, includeArchived: true });
  const enriched = allCourses.map((c) => {
    const impact = getCourseProgressImpact(c.slug);
    const quizQuestionsCount = c.modules.reduce(
      (sum, m) =>
        sum +
        m.lessons.reduce(
          (lSum, l) => lSum + (Array.isArray(l.quiz) ? l.quiz.length : 0),
          0
        ),
      0
    );
    return {
      ...c,
      enrolledUsersCount: impact.enrolledUsersCount,
      quizSubmissionsCount: impact.quizSubmissionsCount,
      modulesCount: c.modules.length,
      quizQuestionsCount,
    };
  });

  return {
    ok: true,
    status: 200,
    data: {
      courses: enriched,
      auditLogs: getAdminAuditLogs(40),
    },
  };
}

export function createAdminCourse(
  user: DbUser | SafeUser | null | undefined,
  body: Record<string, unknown>
): AdminServiceResult<{ course: Course }> {
  const auth = verifyAdminUser(user);
  if (!auth.ok) return auth;

  const title = typeof body.title === "string" ? sanitizeCurriculumText(body.title).trim() : "";
  if (!title || title.length < 3) {
    return {
      ok: false,
      status: 400,
      error: "Judul kelas wajib diisi (minimal 3 karakter)",
    };
  }

  const rawSlugSource =
    typeof body.slug === "string" && body.slug.trim().length > 0 ? body.slug : title;
  const slug = rawSlugSource
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  if (!slug) {
    return { ok: false, status: 400, error: "Slug kelas tidak valid" };
  }

  const courseId =
    typeof body.id === "string" && body.id.trim().length > 0
      ? body.id.trim()
      : `custom-${crypto.randomUUID().slice(0, 8)}`;

  // Reject conflict with static or existing custom courses
  const allExisting = getAllCourses({ includeDrafts: true, includeArchived: true });
  if (STATIC_SLUG_TO_ID.has(slug) || STATIC_ID_TO_SLUG.has(courseId.toLowerCase())) {
    return {
      ok: false,
      status: 409,
      error: `Konflik slug atau ID: "${slug}" sudah digunakan oleh kelas kurikulum inti.`,
    };
  }
  const duplicate = allExisting.find(
    (c) => c.slug.toLowerCase() === slug || c.id.toLowerCase() === courseId.toLowerCase()
  );
  if (duplicate) {
    return {
      ok: false,
      status: 409,
      error: `Konflik slug atau ID: "${slug}" sudah digunakan oleh kelas lain.`,
    };
  }

  const defaultModules = [
    {
      id: `mod-${crypto.randomUUID().slice(0, 6)}`,
      title: "Modul 1: Pengantar & Konsep Utama",
      description: `Pembahasan materi dasar untuk ${title}`,
      lessons: [
        {
          id: `les-${crypto.randomUUID().slice(0, 6)}`,
          slug: "materi-pengantar",
          title: `Materi 1: Pengantar ${title}`,
          duration: "15 Menit",
          type: "reading",
          summary: typeof body.overview === "string" && body.overview.trim()
            ? body.overview.trim()
            : `Ringkasan materi pembelajaran untuk ${title}.`,
          learningObjectives: [
            `Memahami kerangka dasar ${title}.`,
            "Menerapkan prinsip analisis secara sistematis dan terukur.",
          ],
          content: [
            typeof body.overview === "string" && body.overview.trim()
              ? body.overview.trim()
              : `Selamat datang di kelas ${title}. Materi ini dirancang secara terstruktur untuk membangun pemahaman konseptual dan praktik yang disiplin.`,
          ],
          keyTakeaways: [
            "Pahami struktur dasar dan objektif analisis sebelum mengeksekusi transaksi.",
            "Selalu kombinasikan analisis teknikal dengan manajemen risiko yang ketat.",
          ],
        },
      ],
    },
  ];

  const resolvedModules =
    Array.isArray(body.modules) && body.modules.length > 0 ? body.modules : defaultModules;

  const nextOrder =
    typeof body.order === "number" && Number.isFinite(body.order)
      ? body.order
      : allExisting.length + 1;

  const newCourse = normalizeCourse({
    ...body,
    id: courseId,
    slug,
    number:
      typeof body.number === "string" && body.number.trim()
        ? body.number.trim()
        : `SC-${String(allExisting.length + 1).padStart(2, "0")}`,
    title,
    subtitle:
      typeof body.subtitle === "string" && body.subtitle.trim()
        ? body.subtitle.trim()
        : "Materi Pembelajaran Khusus",
    category: body.category || "Trading Foundation",
    level: body.level || "Beginner",
    duration: body.duration || "2 Jam",
    status: body.status || "published",
    order: nextOrder,
    isStaticBaseline: false,
    isOverridden: false,
    instructor:
      body.instructor && typeof body.instructor === "object"
        ? body.instructor
        : {
            name: auth.admin.name || "Casper Market Research",
            role: "Lead Trading Analyst",
          },
    overview:
      typeof body.overview === "string" && body.overview.trim()
        ? body.overview.trim()
        : "Deskripsi kurikulum kelas.",
    objectives: Array.isArray(body.objectives) && body.objectives.length > 0
      ? body.objectives
      : ["Menguasai konsep dasar materi secara terstruktur."],
    competencies: Array.isArray(body.competencies)
      ? body.competencies
      : ["Mampu mengaplikasikan kerangka analisis secara mandiri."],
    prerequisites: Array.isArray(body.prerequisites) && body.prerequisites.length > 0
      ? body.prerequisites
      : ["Kemauan belajar konsisten dan disiplin."],
    courseSummary: Array.isArray(body.courseSummary)
      ? body.courseSummary
      : [`Intisari pembelajaran kelas ${title}.`],
    references: Array.isArray(body.references)
      ? body.references
      : ["Signal Casper Academy Institutional Curriculum Notes"],
    updatedAt: new Date().toISOString(),
    updatedBy: auth.admin.email,
    modules: resolvedModules,
  });

  const validation = validateCourseStructureIntegrity(newCourse);
  if (!validation.ok) {
    return { ok: false, status: 400, error: validation.error };
  }

  try {
    upsertCustomCourse(newCourse as unknown as Record<string, unknown>, {
      allowStaticOverride: false,
      audit: {
        adminId: auth.admin.id,
        adminEmail: auth.admin.email,
        action: "COURSE_CREATE",
        summary: `Membuat kelas baru "${newCourse.title}" (${newCourse.slug}).`,
      },
    });
    return {
      ok: true,
      status: 200,
      data: { course: newCourse },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menyimpan kelas baru.";
    return {
      ok: false,
      status: msg.includes("Konflik") ? 409 : 400,
      error: msg,
    };
  }
}

export function updateAdminCourse(
  user: DbUser | SafeUser | null | undefined,
  body: Record<string, unknown>
): AdminServiceResult<{ course: Course }> {
  const auth = verifyAdminUser(user);
  if (!auth.ok) return auth;

  const rawCourse = (body.course && typeof body.course === "object"
    ? body.course
    : body) as Record<string, unknown>;
  const targetId = String(rawCourse.id || "").trim();
  if (!targetId) {
    return { ok: false, status: 400, error: "ID kelas wajib disertakan untuk pembaruan." };
  }

  const existingCourse = getCourseByIdOrSlugForAdmin(targetId);
  if (!existingCourse) {
    return {
      ok: false,
      status: 404,
      error: `Kelas dengan ID "${targetId}" tidak ditemukan.`,
    };
  }

  const isStatic = STATIC_ID_TO_SLUG.has(existingCourse.id.toLowerCase());
  const lockedSlug = isStatic
    ? STATIC_ID_TO_SLUG.get(existingCourse.id.toLowerCase())!
    : existingCourse.slug;

  const requestedSlug =
    typeof rawCourse.slug === "string" && rawCourse.slug.trim()
      ? rawCourse.slug
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "")
      : lockedSlug;

  if (isStatic && requestedSlug !== lockedSlug) {
    return {
      ok: false,
      status: 400,
      error: `Slug kelas kurikulum inti ("${lockedSlug}") bersifat permanen dan tidak dapat diubah demi menjaga integritas progres siswa.`,
    };
  }

  // Merge with existing course fields so partial metadata updates keep existing modules if modules not omitted
  const mergedRaw: Record<string, unknown> = {
    ...existingCourse,
    ...rawCourse,
    id: existingCourse.id,
    slug: isStatic ? lockedSlug : requestedSlug,
    isStaticBaseline: isStatic,
    isOverridden: isStatic,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.admin.email,
  };

  const normalized = normalizeCourse(mergedRaw);
  const validation = validateCourseStructureIntegrity(normalized);
  if (!validation.ok) {
    return { ok: false, status: 400, error: validation.error };
  }

  // Check if any previously existing lesson IDs were deleted and whether students have completed them
  const oldLessonIds = existingCourse.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const newLessonIdsSet = new Set(
    normalized.modules.flatMap((m) => m.lessons.map((l) => l.id))
  );
  const removedLessonIds = oldLessonIds.filter((id) => !newLessonIdsSet.has(id));

  const forceDeleteLessons = Boolean(
    body.forceDeleteLessons || rawCourse.forceDeleteLessons
  );

  if (removedLessonIds.length > 0 && !forceDeleteLessons) {
    const impact = getCourseProgressImpact(existingCourse.slug, removedLessonIds);
    if (impact.affectedLessonUsersCount > 0) {
      return {
        ok: false,
        status: 409,
        error: `Terdapat ${impact.affectedLessonUsersCount} siswa yang telah menyelesaikan materi (${impact.affectedLessonIds.join(", ")}) yang akan dihapus. Konfirmasi penghapusan jika Anda tetap ingin melanjutkan.`,
        impact,
      };
    }
  }

  try {
    upsertCustomCourse(normalized as unknown as Record<string, unknown>, {
      allowStaticOverride: isStatic,
      migrateSlugFrom:
        !isStatic && requestedSlug !== existingCourse.slug && body.migrateSlug === true
          ? existingCourse.slug
          : undefined,
      audit: {
        adminId: auth.admin.id,
        adminEmail: auth.admin.email,
        action: "COURSE_UPDATE",
        summary: `Memperbarui kurikulum kelas "${normalized.title}" (${normalized.modules.length} modul, ${normalized.totalLessons} pelajaran).`,
      },
    });

    const refreshed = getCourseByIdOrSlugForAdmin(normalized.id) || normalized;
    return {
      ok: true,
      status: 200,
      data: { course: refreshed },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui kelas.";
    return {
      ok: false,
      status: msg.includes("Konflik") || msg.includes("progres siswa") ? 409 : 400,
      error: msg,
    };
  }
}

export function patchAdminCourseAction(
  user: DbUser | SafeUser | null | undefined,
  body: Record<string, unknown>
): AdminServiceResult<{ course?: Course; courses?: Course[] }> {
  const auth = verifyAdminUser(user);
  if (!auth.ok) return auth;

  const action = String(body.action || "").trim();

  if (action === "set-status") {
    const courseId = String(body.courseId || body.id || "").trim();
    const status = String(body.status || "") as CoursePublicationStatus;
    if (!["published", "draft", "archived"].includes(status)) {
      return {
        ok: false,
        status: 400,
        error: "Status publikasi harus bernilai 'published', 'draft', atau 'archived'.",
      };
    }
    const existing = getCourseByIdOrSlugForAdmin(courseId);
    if (!existing) {
      return { ok: false, status: 404, error: "Kelas tidak ditemukan." };
    }
    const isStatic = STATIC_ID_TO_SLUG.has(existing.id.toLowerCase());
    const updated: Course = {
      ...existing,
      status,
      isStaticBaseline: isStatic,
      isOverridden: isStatic ? true : existing.isOverridden,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.admin.email,
    };
    upsertCustomCourse(updated as unknown as Record<string, unknown>, {
      allowStaticOverride: isStatic,
      audit: {
        adminId: auth.admin.id,
        adminEmail: auth.admin.email,
        action: "COURSE_STATUS_CHANGE",
        summary: `Mengubah status kelas "${existing.title}" menjadi "${status}".`,
      },
    });
    return {
      ok: true,
      status: 200,
      data: { course: getCourseByIdOrSlugForAdmin(existing.id) || updated },
    };
  }

  if (action === "reorder") {
    const all = getAllCourses({ includeDrafts: true, includeArchived: true });
    let nextOrderedIds: string[] = [];

    if (Array.isArray(body.orderedCourseIds)) {
      nextOrderedIds = body.orderedCourseIds.map((id) => String(id));
    } else if (body.courseId && (body.direction === "up" || body.direction === "down")) {
      const targetId = String(body.courseId);
      const ids = all.map((c) => c.id);
      const idx = ids.indexOf(targetId);
      if (idx === -1) {
        return { ok: false, status: 404, error: "Kelas tidak ditemukan untuk diurutkan." };
      }
      const swapIdx = body.direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx >= 0 && swapIdx < ids.length) {
        const temp = ids[idx];
        ids[idx] = ids[swapIdx];
        ids[swapIdx] = temp;
      }
      nextOrderedIds = ids;
    } else {
      return { ok: false, status: 400, error: "Parameter pengurutan kelas tidak valid." };
    }

    const courseById = new Map(all.map((c) => [c.id, c]));
    nextOrderedIds.forEach((id, idx) => {
      const c = courseById.get(id);
      if (!c) return;
      const newOrder = idx + 1;
      if (c.order !== newOrder || c.isOverridden || !c.isStaticBaseline) {
        const isStatic = STATIC_ID_TO_SLUG.has(c.id.toLowerCase());
        upsertCustomCourse(
          {
            ...c,
            order: newOrder,
            isStaticBaseline: isStatic,
            isOverridden: isStatic,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.admin.email,
          } as unknown as Record<string, unknown>,
          {
            allowStaticOverride: isStatic,
          }
        );
      }
    });

    return {
      ok: true,
      status: 200,
      data: {
        courses: getAllCourses({ includeDrafts: true, includeArchived: true }),
      },
    };
  }

  if (action === "reset-baseline") {
    const courseId = String(body.courseId || body.id || "").trim();
    const baseline = getStaticBaselineCourse(courseId);
    if (!baseline) {
      return {
        ok: false,
        status: 400,
        error: `Kelas "${courseId}" bukan kelas kurikulum inti (C1-C9) dan tidak memiliki factory baseline.`,
      };
    }
    resetStaticCourseOverride(baseline.id, {
      adminId: auth.admin.id,
      adminEmail: auth.admin.email,
    });
    return {
      ok: true,
      status: 200,
      data: {
        course: getCourseByIdOrSlugForAdmin(baseline.id) || baseline,
      },
    };
  }

  return {
    ok: false,
    status: 400,
    error: `Aksi PATCH "${action}" tidak dikenali.`,
  };
}

export function removeAdminCourse(
  user: DbUser | SafeUser | null | undefined,
  params: { id: string; force?: boolean }
): AdminServiceResult<{ deletedId: string }> {
  const auth = verifyAdminUser(user);
  if (!auth.ok) return auth;

  const id = String(params.id || "").trim();
  if (!id) {
    return { ok: false, status: 400, error: "Parameter id kelas wajib diisi." };
  }

  try {
    deleteCustomCourse(id, {
      protectActiveProgress: true,
      force: Boolean(params.force),
      audit: {
        adminId: auth.admin.id,
        adminEmail: auth.admin.email,
      },
    });
    return {
      ok: true,
      status: 200,
      data: { deletedId: id },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus kelas.";
    const status = msg.includes("progres siswa aktif") ? 409 : 400;
    return {
      ok: false,
      status,
      error: msg,
    };
  }
}

