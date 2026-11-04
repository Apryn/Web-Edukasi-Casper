import type {
  Course,
  CoursePublicationStatus,
  LessonContentBlock,
  ContentBlockType,
  QuizQuestion,
} from "./types";
import { coursesC1C2 } from "./curriculum/c1-c2";
import { coursesC3C4 } from "./curriculum/c3-c4";
import { coursesC5C6 } from "./curriculum/c5-c6";
import { coursesC7C8 } from "./curriculum/c7-c8";
import { coursesC9 } from "./curriculum/c9";

export const coursesData: Course[] = [
  ...coursesC1C2,
  ...coursesC3C4,
  ...coursesC5C6,
  ...coursesC7C8,
  ...coursesC9,
];

export function sanitizeCurriculumText(input: unknown): string {
  const str = String(input ?? "");
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/vbscript\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "");
}

export function sanitizeMediaUrl(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined;
  const trimmed = String(input).trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:text/")
  ) {
    return undefined;
  }
  if (
    lower.startsWith("https://") ||
    lower.startsWith("http://localhost") ||
    lower.startsWith("http://127.0.0.1") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return undefined;
}

export function countCourseLessons(
  course: { modules?: Array<{ lessons?: unknown[] }> } | null | undefined
): number {
  if (!course || !Array.isArray(course.modules)) return 0;
  return course.modules.reduce(
    (sum, mod) => sum + (mod && Array.isArray(mod.lessons) ? mod.lessons.length : 0),
    0
  );
}

function normalizeContentBlock(
  rawBlock: Record<string, unknown>,
  idx: number
): LessonContentBlock {
  const validTypes: ContentBlockType[] = ["heading", "paragraph", "list", "callout", "image"];
  const rawType = String(rawBlock?.type || "paragraph") as ContentBlockType;
  const type: ContentBlockType = validTypes.includes(rawType) ? rawType : "paragraph";

  const block: LessonContentBlock = {
    id: sanitizeCurriculumText(rawBlock?.id || `blk-${idx + 1}`),
    type,
  };

  if (rawBlock?.text !== undefined) {
    block.text = sanitizeCurriculumText(rawBlock.text);
  }
  if (type === "heading") {
    block.level = rawBlock?.level === 3 ? 3 : 2;
  }
  if (type === "list") {
    block.style = rawBlock?.style === "ordered" ? "ordered" : "bullet";
    block.items = Array.isArray(rawBlock?.items)
      ? rawBlock.items.map((item) => sanitizeCurriculumText(item)).filter(Boolean)
      : [];
  }
  if (type === "callout") {
    const validVariants = ["info", "warning", "tip"] as const;
    const rawVariant = String(rawBlock?.variant || "info") as "info" | "warning" | "tip";
    block.variant = validVariants.includes(rawVariant) ? rawVariant : "info";
    if (rawBlock?.caption) {
      block.caption = sanitizeCurriculumText(rawBlock.caption);
    }
  }
  if (type === "image") {
    const safeImg = sanitizeMediaUrl(rawBlock?.imageUrl);
    if (safeImg) block.imageUrl = safeImg;
    if (rawBlock?.imageAlt) block.imageAlt = sanitizeCurriculumText(rawBlock.imageAlt);
    if (rawBlock?.caption) block.caption = sanitizeCurriculumText(rawBlock.caption);
  }

  return block;
}

function normalizeQuizQuestions(rawQuiz: unknown[]): QuizQuestion[] {
  return rawQuiz
    .filter((q): q is Record<string, unknown> => Boolean(q && typeof q === "object"))
    .map((q, qIdx) => {
      const options = Array.isArray(q.options)
        ? q.options.map((o) => sanitizeCurriculumText(o)).filter((o) => o.length > 0)
        : ["Pilihan A", "Pilihan B"];
      const safeOptions = options.length >= 2 ? options : [...options, "Pilihan B"];
      const rawCorrect = typeof q.correctAnswer === "number" ? Math.floor(q.correctAnswer) : 0;
      const correctAnswer =
        rawCorrect >= 0 && rawCorrect < safeOptions.length ? rawCorrect : 0;
      return {
        id: sanitizeCurriculumText(q.id || `q-${qIdx + 1}`),
        question: sanitizeCurriculumText(q.question || `Pertanyaan ${qIdx + 1}`),
        options: safeOptions,
        correctAnswer,
        explanation: sanitizeCurriculumText(
          q.explanation || "Jawaban telah diverifikasi oleh sistem evaluasi."
        ),
      };
    });
}

export function normalizeCourse(raw: Record<string, unknown>): Course {
  const modules = Array.isArray(raw.modules)
    ? raw.modules.map((mod: Record<string, unknown>, mIdx: number) => ({
        id: sanitizeCurriculumText(mod?.id || `mod-${mIdx + 1}`),
        title: sanitizeCurriculumText(mod?.title || `Modul ${mIdx + 1}`),
        description: sanitizeCurriculumText(mod?.description || ""),
        ...(typeof mod?.order === "number" && Number.isFinite(mod.order)
          ? { order: mod.order }
          : {}),
        lessons: Array.isArray(mod?.lessons)
          ? mod.lessons.map((les: Record<string, unknown>, lIdx: number) => {
              const contentBlocks = Array.isArray(les?.contentBlocks)
                ? les.contentBlocks
                    .filter(
                      (b: unknown): b is Record<string, unknown> =>
                        Boolean(b && typeof b === "object")
                    )
                    .map((b: Record<string, unknown>, bIdx: number) =>
                      normalizeContentBlock(b, bIdx)
                    )
                : undefined;

              let contentParagraphs = Array.isArray(les?.content)
                ? les.content.map((p) => sanitizeCurriculumText(p)).filter(Boolean)
                : [];

              if (contentParagraphs.length === 0 && contentBlocks && contentBlocks.length > 0) {
                contentParagraphs = contentBlocks
                  .map((b) =>
                    b.text ||
                    (Array.isArray(b.items) ? b.items.join(" ") : "") ||
                    b.caption ||
                    ""
                  )
                  .filter(Boolean);
              }
              if (contentParagraphs.length === 0) {
                contentParagraphs = ["Materi pembelajaran."];
              }

              const safeVideoUrl = sanitizeMediaUrl(les?.videoUrl);
              const rawPassingScore =
                typeof les?.passingScore === "number" &&
                Number.isFinite(les.passingScore) &&
                les.passingScore >= 1 &&
                les.passingScore <= 100
                  ? Math.round(les.passingScore)
                  : undefined;

              return {
                id: sanitizeCurriculumText(les?.id || `les-${mIdx + 1}-${lIdx + 1}`),
                slug: sanitizeCurriculumText(les?.slug || `materi-${lIdx + 1}`)
                  .toLowerCase()
                  .replace(/[^a-z0-9-_]+/g, "-"),
                title: sanitizeCurriculumText(les?.title || `Materi ${lIdx + 1}`),
                duration: sanitizeCurriculumText(les?.duration || "10 Menit"),
                type:
                  (les?.type as Course["modules"][number]["lessons"][number]["type"]) ||
                  "reading",
                summary: sanitizeCurriculumText(les?.summary || ""),
                content: contentParagraphs,
                ...(contentBlocks && contentBlocks.length > 0 ? { contentBlocks } : {}),
                ...(Array.isArray(les?.learningObjectives)
                  ? {
                      learningObjectives: les.learningObjectives
                        .map((item) => sanitizeCurriculumText(item))
                        .filter(Boolean),
                    }
                  : {}),
                ...(les?.applicationExample
                  ? { applicationExample: sanitizeCurriculumText(les.applicationExample) }
                  : {}),
                ...(les?.caseStudy ? { caseStudy: sanitizeCurriculumText(les.caseStudy) } : {}),
                ...(Array.isArray(les?.practicalSteps)
                  ? {
                      practicalSteps: les.practicalSteps
                        .map((item) => sanitizeCurriculumText(item))
                        .filter(Boolean),
                    }
                  : {}),
                ...(Array.isArray(les?.commonMistakes)
                  ? {
                      commonMistakes: les.commonMistakes
                        .map((item) => sanitizeCurriculumText(item))
                        .filter(Boolean),
                    }
                  : {}),
                ...(Array.isArray(les?.keyTakeaways)
                  ? {
                      keyTakeaways: les.keyTakeaways
                        .map((item) => sanitizeCurriculumText(item))
                        .filter(Boolean),
                    }
                  : {}),
                ...(Array.isArray(les?.references)
                  ? {
                      references: les.references
                        .map((item) => sanitizeCurriculumText(item))
                        .filter(Boolean),
                    }
                  : {}),
                ...(les?.visualDiagram
                  ? {
                      visualDiagram:
                        les.visualDiagram as Course["modules"][number]["lessons"][number]["visualDiagram"],
                    }
                  : {}),
                ...(les?.chartData && typeof les.chartData === "object"
                  ? {
                      chartData: {
                        title: sanitizeCurriculumText(
                          (les.chartData as Record<string, unknown>).title || "Studi Kasus Chart"
                        ),
                        description: sanitizeCurriculumText(
                          (les.chartData as Record<string, unknown>).description || ""
                        ),
                        timeframe: sanitizeCurriculumText(
                          (les.chartData as Record<string, unknown>).timeframe || "H1"
                        ),
                        bias: (["Bullish", "Bearish", "Neutral"].includes(
                          String((les.chartData as Record<string, unknown>).bias)
                        )
                          ? (les.chartData as Record<string, unknown>).bias
                          : "Neutral") as "Bullish" | "Bearish" | "Neutral",
                      },
                    }
                  : {}),
                ...(safeVideoUrl ? { videoUrl: safeVideoUrl } : {}),
                ...(les?.videoDuration
                  ? { videoDuration: sanitizeCurriculumText(les.videoDuration) }
                  : {}),
                ...(rawPassingScore !== undefined ? { passingScore: rawPassingScore } : {}),
                ...(Array.isArray(les?.quiz)
                  ? { quiz: normalizeQuizQuestions(les.quiz) }
                  : {}),
              };
            })
          : [],
      }))
    : [];

  const instructorObj =
    raw.instructor && typeof raw.instructor === "object"
      ? (raw.instructor as Record<string, unknown>)
      : null;

  let resolvedStatus: CoursePublicationStatus = "published";
  if (raw.status === "draft" || raw.status === "published" || raw.status === "archived") {
    resolvedStatus = raw.status;
  } else if (raw.published === false) {
    resolvedStatus = "draft";
  }

  const safeThumbnail = sanitizeMediaUrl(raw.thumbnailUrl);
  const safeCover = sanitizeMediaUrl(raw.coverUrl);

  return {
    id: sanitizeCurriculumText(raw.id || ""),
    slug: sanitizeCurriculumText(raw.slug || "")
      .toLowerCase()
      .trim(),
    number: sanitizeCurriculumText(raw.number || "SC-CUSTOM"),
    title: sanitizeCurriculumText(raw.title || ""),
    subtitle: sanitizeCurriculumText(raw.subtitle || "Materi Pembelajaran Khusus"),
    category: (raw.category as Course["category"]) || "Trading Foundation",
    level: (raw.level as Course["level"]) || "Beginner",
    duration: sanitizeCurriculumText(raw.duration || "1 Jam"),
    totalLessons: countCourseLessons({ modules }),
    status: resolvedStatus,
    ...(typeof raw.order === "number" && Number.isFinite(raw.order)
      ? { order: raw.order }
      : {}),
    ...(raw.isStaticBaseline !== undefined
      ? { isStaticBaseline: Boolean(raw.isStaticBaseline) }
      : {}),
    ...(raw.isOverridden !== undefined ? { isOverridden: Boolean(raw.isOverridden) } : {}),
    ...(safeThumbnail ? { thumbnailUrl: safeThumbnail } : {}),
    ...(safeCover ? { coverUrl: safeCover } : {}),
    ...(raw.featured ? { featured: Boolean(raw.featured) } : {}),
    instructor: instructorObj
      ? {
          name: sanitizeCurriculumText(instructorObj.name || "Casper Academic Admin"),
          role: sanitizeCurriculumText(instructorObj.role || "Verified Instructor"),
          ...(instructorObj.avatar
            ? { avatar: sanitizeCurriculumText(instructorObj.avatar) }
            : {}),
        }
      : {
          name: "Casper Academic Admin",
          role: "Verified Instructor",
        },
    overview: sanitizeCurriculumText(
      raw.overview || raw.description || "Deskripsi kurikulum kelas."
    ),
    objectives: Array.isArray(raw.objectives)
      ? raw.objectives.map((o) => sanitizeCurriculumText(o)).filter(Boolean)
      : ["Menguasai konsep dasar materi."],
    ...(Array.isArray(raw.competencies)
      ? {
          competencies: raw.competencies
            .map((c) => sanitizeCurriculumText(c))
            .filter(Boolean),
        }
      : {}),
    prerequisites: Array.isArray(raw.prerequisites)
      ? raw.prerequisites.map((p) => sanitizeCurriculumText(p)).filter(Boolean)
      : ["Kemauan belajar konsisten."],
    ...(Array.isArray(raw.courseSummary)
      ? {
          courseSummary: raw.courseSummary
            .map((s) => sanitizeCurriculumText(s))
            .filter(Boolean),
        }
      : {}),
    ...(Array.isArray(raw.references)
      ? {
          references: raw.references
            .map((r) => sanitizeCurriculumText(r))
            .filter(Boolean),
        }
      : {}),
    ...(raw.updatedAt ? { updatedAt: String(raw.updatedAt) } : {}),
    ...(raw.updatedBy ? { updatedBy: sanitizeCurriculumText(raw.updatedBy) } : {}),
    modules,
  };
}

export function sanitizeCourseForClient(course: Course): Course {
  const actualTotal = countCourseLessons(course);
  return {
    ...course,
    totalLessons: actualTotal,
    modules: course.modules.map((mod) => ({
      ...mod,
      lessons: mod.lessons.map((lesson) => ({
        ...lesson,
        quiz: lesson.quiz?.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
        })) as Course["modules"][number]["lessons"][number]["quiz"],
      })),
    })),
  };
}

function loadServerCustomCourses(): Course[] {
  if (typeof window !== "undefined") return [];
  try {
    const getBuiltin = (process as unknown as { getBuiltinModule?: (id: string) => unknown })
      .getBuiltinModule;
    const fs = (
      typeof getBuiltin === "function"
        ? getBuiltin("node:fs")
        : (eval("require") as NodeRequire)("node:fs")
    ) as typeof import("node:fs");
    const path = (
      typeof getBuiltin === "function"
        ? getBuiltin("node:path")
        : (eval("require") as NodeRequire)("node:path")
    ) as typeof import("node:path");
    const dbPath = path.join(process.cwd(), "data", "academy.json");
    if (!fs.existsSync(dbPath)) return [];
    const raw = fs.readFileSync(dbPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.custom_courses)) return [];
    return parsed.custom_courses
      .filter(
        (c: unknown): c is Record<string, unknown> =>
          Boolean(c && typeof c === "object" && "slug" in c && "title" in c)
      )
      .map((c: Record<string, unknown>) => normalizeCourse(c));
  } catch {
    return [];
  }
}

export function getStaticCourses(): Course[] {
  return coursesData.map((c, idx) => ({
    ...c,
    totalLessons: countCourseLessons(c),
    status: c.status || "published",
    order: typeof c.order === "number" ? c.order : idx + 1,
    isStaticBaseline: true,
    isOverridden: false,
  }));
}

export function getStaticBaselineCourse(idOrSlug: string): Course | undefined {
  const norm = String(idOrSlug || "").toLowerCase().trim();
  if (!norm) return undefined;
  return getStaticCourses().find(
    (c) => c.id.toLowerCase() === norm || c.slug.toLowerCase() === norm
  );
}

export interface GetCoursesOptions {
  includeDrafts?: boolean;
  includeArchived?: boolean;
}

export function getAllCourses(options?: GetCoursesOptions): Course[] {
  const staticList = getStaticCourses();
  const staticById = new Map<string, Course>();
  const staticBySlug = new Map<string, Course>();
  for (const sc of staticList) {
    staticById.set(sc.id.toLowerCase(), sc);
    staticBySlug.set(sc.slug.toLowerCase(), sc);
  }

  const storedList = loadServerCustomCourses();
  const overridesByStaticId = new Map<string, Course>();
  const customOnlyList: Course[] = [];

  for (const item of storedList) {
    const itemIdLower = String(item.id || "").toLowerCase();
    const itemSlugLower = String(item.slug || "").toLowerCase();
    const matchedStatic =
      staticById.get(itemIdLower) || staticBySlug.get(itemSlugLower);

    if (
      matchedStatic &&
      itemIdLower === matchedStatic.id.toLowerCase() &&
      itemSlugLower === matchedStatic.slug.toLowerCase()
    ) {
      overridesByStaticId.set(matchedStatic.id.toLowerCase(), {
        ...item,
        id: matchedStatic.id,
        slug: matchedStatic.slug,
        totalLessons: countCourseLessons(item),
        status: item.status || "published",
        order:
          typeof item.order === "number" ? item.order : matchedStatic.order,
        isStaticBaseline: true,
        isOverridden: true,
      });
    } else if (!staticBySlug.has(itemSlugLower) && !staticById.has(itemIdLower)) {
      customOnlyList.push({
        ...item,
        totalLessons: countCourseLessons(item),
        status: item.status || "published",
        isStaticBaseline: false,
        isOverridden: false,
      });
    }
  }

  const mergedStatic = staticList.map((sc, idx) => {
    const override = overridesByStaticId.get(sc.id.toLowerCase());
    if (override) {
      return {
        ...override,
        order: typeof override.order === "number" ? override.order : idx + 1,
      };
    }
    return sc;
  });

  const mergedCustom = customOnlyList.map((cc, idx) => ({
    ...cc,
    order:
      typeof cc.order === "number"
        ? cc.order
        : staticList.length + idx + 1,
  }));

  const combined = [...mergedStatic, ...mergedCustom].sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999)
  );

  return combined.filter((c) => {
    const st = c.status || "published";
    if (st === "published") return true;
    if (st === "draft") return Boolean(options?.includeDrafts);
    if (st === "archived") return Boolean(options?.includeArchived);
    return true;
  });
}

export function getCourseBySlug(
  slug: string,
  options?: GetCoursesOptions
): Course | undefined {
  const normalized = String(slug || "").toLowerCase().trim();
  if (!normalized) return undefined;
  return getAllCourses(options).find((c) => c.slug.toLowerCase() === normalized);
}

export function getCourseByIdOrSlugForAdmin(idOrSlug: string): Course | undefined {
  const normalized = String(idOrSlug || "").toLowerCase().trim();
  if (!normalized) return undefined;
  return getAllCourses({ includeDrafts: true, includeArchived: true }).find(
    (c) => c.id.toLowerCase() === normalized || c.slug.toLowerCase() === normalized
  );
}
