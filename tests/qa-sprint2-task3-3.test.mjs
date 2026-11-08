import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire, registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

const cjsRequire = createRequire(import.meta.url);
cjsRequire("jsonwebtoken");
cjsRequire("bcryptjs");

let tsHook = null;
if (typeof registerHooks === "function" && typeof stripTypeScriptTypes === "function") {
  tsHook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        !path.extname(specifier) &&
        context.parentURL
      ) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        const candidateTs = path.resolve(parentDir, `${specifier}.ts`);
        if (fs.existsSync(candidateTs)) {
          return nextResolve(`${specifier}.ts`, context);
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.endsWith(".ts")) {
        const source = fs.readFileSync(fileURLToPath(url), "utf8");
        return {
          format: "module",
          shortCircuit: true,
          source: stripTypeScriptTypes(source),
        };
      }
      return nextLoad(url, context);
    },
  });
}

// Import modules
const {
  getAllCourses,
  getStaticCourses,
  getCourseBySlug,
  getStaticBaselineCourse,
  getCourseByIdOrSlugForAdmin,
  countCourseLessons,
  normalizeCourse,
  sanitizeCourseForClient,
  sanitizeCurriculumText,
  sanitizeMediaUrl,
} = await import("../lib/courses-data.ts");

const {
  getDatabase,
  findUserByEmail,
  findUserById,
  getUserCourseProgress,
  upsertUserProgress,
  getAllUserProgress,
  recordQuizSubmission,
  getQuizSubmissionsForUser,
  upsertCustomCourse,
  deleteCustomCourse,
  resetStaticCourseOverride,
  getAdminAuditLogs,
  getDatabaseHealth,
  STATIC_ID_TO_SLUG,
  STATIC_SLUG_TO_ID,
} = await import("../lib/db.ts");

const {
  signToken,
  verifyToken,
  isAdmin,
  isMasterAdmin,
  isMentorOrAdmin,
} = await import("../lib/auth.ts");

const {
  evaluateCourseCompletion,
  calculateCoursePercentage,
  getStoredProgress,
} = await import("../lib/progress.ts");

const {
  validateAndPersistUserProgress,
  evaluateAndRecordServerQuiz,
} = await import("../lib/server-progress.ts");

const {
  listAdminCourses,
  createAdminCourse,
  updateAdminCourse,
  patchAdminCourseAction,
  removeAdminCourse,
} = await import("../lib/admin-course-service.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

describe("Sprint 2 Task 3.3 — Deep Functional, Security & Data Integrity QA", () => {
  const dataDir = path.join(process.cwd(), "data");
  const dbFile = path.join(dataDir, "academy.json");
  let pristineSnapshot = null;

  const adminUser = {
    id: "6b9ba627-6741-4ee6-bf50-892469db05bf",
    email: "apriyanriyan23@gmail.com",
    name: "Ryan",
    role: "ADMIN",
  };

  const studentA = {
    id: "student-qa-a-" + crypto.randomUUID().slice(0, 8),
    email: "student.a@casper.test",
    name: "Student Alpha",
    role: "USER",
  };

  const studentB = {
    id: "student-qa-b-" + crypto.randomUUID().slice(0, 8),
    email: "student.b@casper.test",
    name: "Student Beta",
    role: "USER",
  };

  before(() => {
    if (fs.existsSync(dbFile)) {
      pristineSnapshot = fs.readFileSync(dbFile, "utf8");
    }
  });

  after(() => {
    if (pristineSnapshot) {
      fs.writeFileSync(dbFile, pristineSnapshot, "utf8");
    }
  });

  // ────────────────────────────────────────────────────────────────
  // 1. FUNCTIONAL QA: COURSE MANAGEMENT
  // ────────────────────────────────────────────────────────────────
  test("1. Functional QA: Course Management (C1-C9 List, Create, Metadata, Status, Reorder, Reset Baseline, Delete)", () => {
    // A. List courses: All 9 core courses exist with enriched metrics
    const listRes = listAdminCourses(adminUser);
    assert.equal(listRes.ok, true);
    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.courses.length >= 9, "Harus memuat minimal 9 kelas kurikulum inti");

    const c1 = listRes.data.courses.find((c) => c.slug === "trading-fundamentals");
    assert.ok(c1, "C1 Trading Fundamentals harus ada");
    assert.equal(c1.isStaticBaseline, true);
    assert.equal(c1.isOverridden, false);
    assert.equal(typeof c1.enrolledUsersCount, "number");
    assert.equal(typeof c1.quizQuestionsCount, "number");

    // B. Create Custom Course
    const customSlug = "qa-course-algo-" + Date.now();
    const createRes = createAdminCourse(adminUser, {
      title: "Algorithmic Order Flow Architecture",
      slug: customSlug,
      subtitle: "Desain sistem eksekusi HFT",
      category: "Specialized Asset",
      level: "Advanced",
      duration: "3 Jam",
      status: "published",
      overview: "Materi pengantar sistem order flow kuantitatif.",
    });
    assert.equal(createRes.ok, true, `Create course gagal: ${createRes.error}`);
    const createdCourse = createRes.data.course;
    assert.equal(createdCourse.slug, customSlug);
    assert.equal(createdCourse.status, "published");
    assert.equal(createdCourse.isStaticBaseline, false);

    // C. Change Status to Draft and Archived
    const draftRes = patchAdminCourseAction(adminUser, {
      action: "set-status",
      courseId: createdCourse.id,
      status: "draft",
    });
    assert.equal(draftRes.ok, true);
    assert.equal(draftRes.data.course.status, "draft");

    // Hidden from public catalog
    assert.equal(getAllCourses().some((c) => c.slug === customSlug), false);

    const archiveRes = patchAdminCourseAction(adminUser, {
      action: "set-status",
      courseId: createdCourse.id,
      status: "archived",
    });
    assert.equal(archiveRes.ok, true);
    assert.equal(archiveRes.data.course.status, "archived");
    assert.equal(getAllCourses().some((c) => c.slug === customSlug), false);

    // Restore to published
    const publishRes = patchAdminCourseAction(adminUser, {
      action: "set-status",
      courseId: createdCourse.id,
      status: "published",
    });
    assert.equal(publishRes.ok, true);
    assert.equal(getAllCourses().some((c) => c.slug === customSlug), true);

    // D. Reorder Courses
    const reorderRes = patchAdminCourseAction(adminUser, {
      action: "reorder",
      courseId: createdCourse.id,
      direction: "up",
    });
    assert.equal(reorderRes.ok, true);

    // E. Reset to Factory Baseline on C1
    // First override C1
    const overrideC1 = updateAdminCourse(adminUser, {
      id: "c1",
      subtitle: "Subjudul C1 Modifikasi QA",
    });
    assert.equal(overrideC1.ok, true);
    assert.equal(overrideC1.data.course.isOverridden, true);

    // Reset baseline
    const resetRes = patchAdminCourseAction(adminUser, {
      action: "reset-baseline",
      courseId: "c1",
    });
    assert.equal(resetRes.ok, true);
    assert.equal(resetRes.data.course.isOverridden, false);
    const baseline = getStaticBaselineCourse("c1");
    assert.equal(resetRes.data.course.subtitle, baseline.subtitle);

    // F. Safe Delete
    const deleteRes = removeAdminCourse(adminUser, { id: createdCourse.id, force: true });
    assert.equal(deleteRes.ok, true);
    assert.equal(deleteRes.data.deletedId, createdCourse.id);
  });

  // ────────────────────────────────────────────────────────────────
  // 2. FUNCTIONAL QA: MODULE & LESSON MANAGEMENT
  // ────────────────────────────────────────────────────────────────
  test("2. Functional QA: Module & Lesson Tree (Add/Edit/Delete, Move, Reorder, ID Integrity, Duplicate Rejection)", () => {
    const slug = "qa-tree-" + Date.now();
    const createRes = createAdminCourse(adminUser, {
      title: "Market Microstructure Testing",
      slug,
      modules: [
        {
          id: "mod-qa-1",
          title: "Modul 1: Order Book",
          description: "Depth of market",
          lessons: [
            {
              id: "les-qa-1",
              slug: "materi-orderbook",
              title: "Pelajaran 1.1: Level 2 Data",
              duration: "10 Menit",
              type: "reading",
              summary: "Ringkasan L2 data",
              content: ["Paragraf 1"],
            },
            {
              id: "les-qa-2",
              slug: "materi-matching-engine",
              title: "Pelajaran 1.2: Matching Engine",
              duration: "15 Menit",
              type: "reading",
              summary: "Ringkasan matching engine",
              content: ["Paragraf matching engine"],
            },
          ],
        },
      ],
    });
    assert.equal(createRes.ok, true);
    const courseId = createRes.data.course.id;

    try {
      // A. Rejection of Duplicate Module ID
      const dupModRes = updateAdminCourse(adminUser, {
        id: courseId,
        title: "Market Microstructure Testing",
        modules: [
          { id: "mod-dup", title: "Modul A", description: "", lessons: [] },
          { id: "mod-dup", title: "Modul B", description: "", lessons: [] },
        ],
      });
      assert.equal(dupModRes.ok, false);
      assert.equal(dupModRes.status, 400);
      assert.match(dupModRes.error, /Konflik ID modul duplikat/);

      // B. Rejection of Duplicate Lesson ID
      const dupLesRes = updateAdminCourse(adminUser, {
        id: courseId,
        title: "Market Microstructure Testing",
        modules: [
          {
            id: "mod-1",
            title: "Modul A",
            description: "",
            lessons: [
              { id: "les-dup", slug: "l1", title: "L1", type: "reading", content: ["A"] },
              { id: "les-dup", slug: "l2", title: "L2", type: "reading", content: ["B"] },
            ],
          },
        ],
      });
      assert.equal(dupLesRes.ok, false);
      assert.equal(dupLesRes.status, 400);
      assert.match(dupLesRes.error, /Konflik ID pelajaran duplikat/);

      // C. Move Lesson between Modules: Move les-qa-2 from Modul 1 to Modul 2
      const movedRes = updateAdminCourse(adminUser, {
        id: courseId,
        title: "Market Microstructure Testing",
        modules: [
          {
            id: "mod-qa-1",
            title: "Modul 1: Order Book",
            description: "Depth of market",
            lessons: [
              {
                id: "les-qa-1",
                slug: "materi-orderbook",
                title: "Pelajaran 1.1: Level 2 Data",
                duration: "10 Menit",
                type: "reading",
                content: ["Paragraf 1"],
              },
            ],
          },
          {
            id: "mod-qa-2",
            title: "Modul 2: Eksekusi Pasar",
            description: "Mekanisme eksekusi order",
            lessons: [
              {
                id: "les-qa-2",
                slug: "materi-matching-engine",
                title: "Pelajaran 2.1: Matching Engine",
                duration: "15 Menit",
                type: "reading",
                content: ["Paragraf matching engine"],
              },
            ],
          },
        ],
      });
      assert.equal(movedRes.ok, true);
      assert.equal(movedRes.data.course.modules.length, 2);
      assert.equal(movedRes.data.course.modules[0].lessons.length, 1);
      assert.equal(movedRes.data.course.modules[1].lessons.length, 1);
      assert.equal(movedRes.data.course.modules[1].lessons[0].id, "les-qa-2");
    } finally {
      removeAdminCourse(adminUser, { id: courseId, force: true });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // 3. FUNCTIONAL QA: CONTENT EDITOR BLOCK TYPES
  // ────────────────────────────────────────────────────────────────
  test("3. Functional QA: Content Editor Block Types (Headings, Paragraphs, Lists, Callouts, SVG Diagram Enum, Chart Study, Video)", () => {
    const rawCourse = {
      title: "Content Blocks Comprehensive Test",
      slug: "qa-content-" + Date.now(),
      modules: [
        {
          id: "m1",
          title: "Modul Konten",
          lessons: [
            {
              id: "l1",
              slug: "les-konten",
              title: "Materi Blok Lengkap",
              duration: "20 Menit",
              type: "chart-study",
              summary: "Ringkasan blok",
              contentBlocks: [
                { id: "b1", type: "heading", level: 2, text: "Heading Utama H2" },
                { id: "b2", type: "heading", level: 3, text: "Sub-Heading H3" },
                { id: "b3", type: "paragraph", text: "Paragraf teks biasa dengan format." },
                { id: "b4", type: "list", style: "bullet", items: ["Poin A", "Poin B"] },
                { id: "b5", type: "list", style: "ordered", items: ["Langkah 1", "Langkah 2"] },
                { id: "b6", type: "callout", variant: "info", caption: "INFO", text: "Kotak informasi edukatif." },
                { id: "b7", type: "callout", variant: "warning", caption: "PERINGATAN", text: "Risiko volatilitas tinggi." },
                { id: "b8", type: "callout", variant: "tip", caption: "TIPS PRO", text: "Gunakan limit order." },
                { id: "b9", type: "image", imageUrl: "https://example.com/chart.png", imageAlt: "Chart Analisis", caption: "Studi kasus H1" },
              ],
              visualDiagram: "liquidity-orderbook",
              chartData: {
                title: "Studi Kasus XAUUSD H1",
                description: "Rejection di support 2340",
                timeframe: "H1",
                bias: "Bullish",
              },
              videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              videoDuration: "12:30",
              practicalSteps: ["Identifikasi level HTF", "Tunggu konfirmasi LTF"],
              caseStudy: "Contoh setup transaksi pada sesi London overlap.",
              commonMistakes: ["FOMO entry tanpa konfirmasi"],
              keyTakeaways: ["Disiplin eksekusi adalah kunci profitabilitas konsisten."],
            },
          ],
        },
      ],
    };

    const normalized = normalizeCourse(rawCourse);
    const les = normalized.modules[0].lessons[0];

    assert.equal(les.contentBlocks?.length, 9);
    assert.equal(les.contentBlocks?.[0].level, 2);
    assert.equal(les.contentBlocks?.[1].level, 3);
    assert.equal(les.contentBlocks?.[3].style, "bullet");
    assert.equal(les.contentBlocks?.[4].style, "ordered");
    assert.equal(les.contentBlocks?.[5].variant, "info");
    assert.equal(les.contentBlocks?.[6].variant, "warning");
    assert.equal(les.contentBlocks?.[7].variant, "tip");
    assert.equal(les.visualDiagram, "liquidity-orderbook");
    assert.equal(les.chartData?.bias, "Bullish");
    assert.equal(les.videoUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(les.practicalSteps?.length, 2);
    assert.equal(les.commonMistakes?.length, 1);
    assert.equal(les.keyTakeaways?.length, 1);
  });

  // ────────────────────────────────────────────────────────────────
  // 4. FUNCTIONAL QA: QUIZ EDITOR & EVALUATION CONSISTENCY
  // ────────────────────────────────────────────────────────────────
  test("4. Functional QA: Quiz Editor (Passing Score, Practice Quiz vs Required Evaluation, Review Accuracy)", () => {
    const quizCourseSlug = "qa-quiz-" + Date.now();
    const createRes = createAdminCourse(adminUser, {
      title: "Quiz Evaluation Precision Test",
      slug: quizCourseSlug,
      modules: [
        {
          id: "m-quiz",
          title: "Modul Uji Kuis",
          description: "Evaluasi kuis",
          lessons: [
            // Practice quiz on reading lesson
            {
              id: "l-read-practice",
              slug: "materi-bacaan",
              title: "Materi 1: Teori Dasar",
              duration: "10 Menit",
              type: "reading",
              summary: "Ringkasan materi",
              content: ["Materi teks."],
              quiz: [
                {
                  id: "q-prac-1",
                  question: "Apakah ini kuis latihan?",
                  options: ["Ya", "Bukan"],
                  correctAnswer: 0,
                  explanation: "Ini kuis latihan pemahaman materi.",
                },
              ],
            },
            // Mandatory evaluation quiz lesson with custom passing score (80%)
            {
              id: "l-eval-mandatory",
              slug: "evaluasi-modul",
              title: "Materi 2: Evaluasi Akhir Modul",
              duration: "20 Menit",
              type: "quiz",
              summary: "Evaluasi kelulusan modul",
              content: ["Kerjakan soal berikut."],
              passingScore: 80,
              quiz: [
                {
                  id: "q-mand-1",
                  question: "Soal 1: Berapa target RRR minimum?",
                  options: ["1:1", "1:2", "1:0.5"],
                  correctAnswer: 1,
                  explanation: "RRR minimum institusional adalah 1:2.",
                },
                {
                  id: "q-mand-2",
                  question: "Soal 2: Apa parameter stop loss?",
                  options: ["Berdasarkan emosi", "Berdasarkan struktur pasar"],
                  correctAnswer: 1,
                  explanation: "Stop loss harus selalu objektif berbasis struktur pasar.",
                },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(createRes.ok, true);
    const courseId = createRes.data.course.id;

    try {
      const studentId = "student-quiz-" + crypto.randomUUID().slice(0, 8);

      // A. Practice Quiz: Answer wrong does NOT delete completed lesson
      validateAndPersistUserProgress(studentId, {
        courseSlug: quizCourseSlug,
        completedLessonIds: ["l-read-practice"],
      });

      const wrongPractice = evaluateAndRecordServerQuiz(studentId, {
        courseSlug: quizCourseSlug,
        lessonId: "l-read-practice",
        answers: { "q-prac-1": 1 }, // Wrong answer
      });
      assert.equal(wrongPractice.ok, true);
      assert.equal(wrongPractice.passed, false);
      assert.equal(wrongPractice.score, 0);

      // l-read-practice must remain in completedLessonIds because it is a reading lesson!
      const progAfterWrong = getUserCourseProgress(studentId, quizCourseSlug);
      const completedIds = JSON.parse(progAfterWrong.completed_lesson_ids);
      assert.ok(
        completedIds.includes("l-read-practice"),
        "Kuis latihan salah tidak boleh membatalkan kelulusan materi bacaan"
      );

      // B. Mandatory Evaluation: Passing score 80% enforced
      // 1 of 2 correct = 50% (< 80%) -> Fail, lesson NOT marked completed
      const failEval = evaluateAndRecordServerQuiz(studentId, {
        courseSlug: quizCourseSlug,
        lessonId: "l-eval-mandatory",
        answers: { "q-mand-1": 1, "q-mand-2": 0 }, // 1 correct, 1 wrong
      });
      assert.equal(failEval.ok, true);
      assert.equal(failEval.score, 50);
      assert.equal(failEval.passed, false);
      assert.equal(failEval.passingScore, 80);

      const progAfterFail = getUserCourseProgress(studentId, quizCourseSlug);
      const completedAfterFail = JSON.parse(progAfterFail.completed_lesson_ids);
      assert.equal(
        completedAfterFail.includes("l-eval-mandatory"),
        false,
        "Pelajaran evaluasi gagal tidak boleh ditandai selesai"
      );

      // 2 of 2 correct = 100% (>= 80%) -> Pass, lesson marked completed
      const passEval = evaluateAndRecordServerQuiz(studentId, {
        courseSlug: quizCourseSlug,
        lessonId: "l-eval-mandatory",
        answers: { "q-mand-1": 1, "q-mand-2": 1 }, // 2 correct
      });
      assert.equal(passEval.ok, true);
      assert.equal(passEval.score, 100);
      assert.equal(passEval.passed, true);
      assert.equal(passEval.passingScore, 80);

      const progAfterPass = getUserCourseProgress(studentId, quizCourseSlug);
      const completedAfterPass = JSON.parse(progAfterPass.completed_lesson_ids);
      assert.ok(
        completedAfterPass.includes("l-eval-mandatory"),
        "Pelajaran evaluasi lulus harus ditandai selesai"
      );
    } finally {
      removeAdminCourse(adminUser, { id: courseId, force: true });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // 5. SECURITY QA: AUTHORIZATION, DRAFT/ARCHIVED, QUIZ LEAKAGE, XSS
  // ────────────────────────────────────────────────────────────────
  test("5. Security QA: Strict Authorization Across All Methods, Draft/Archived Isolation, Quiz Answer Leakage & XSS Neutralization", () => {
    // A. Authorization checks across all admin service methods
    const unauth = null;
    const userRole = studentA;

    // GET
    assert.equal(listAdminCourses(unauth).status, 403);
    assert.equal(listAdminCourses(userRole).status, 403);

    // POST
    assert.equal(createAdminCourse(unauth, { title: "Test" }).status, 403);
    assert.equal(createAdminCourse(userRole, { title: "Test" }).status, 403);

    // PUT
    assert.equal(updateAdminCourse(unauth, { id: "c1" }).status, 403);
    assert.equal(updateAdminCourse(userRole, { id: "c1" }).status, 403);

    // PATCH
    assert.equal(patchAdminCourseAction(unauth, { action: "set-status" }).status, 403);
    assert.equal(patchAdminCourseAction(userRole, { action: "set-status" }).status, 403);

    // DELETE
    assert.equal(removeAdminCourse(unauth, { id: "c1" }).status, 403);
    assert.equal(removeAdminCourse(userRole, { id: "c1" }).status, 403);

    // B. Draft and Archived Protection on Progress & Quiz APIs
    const secretSlug = "qa-secret-draft-" + Date.now();
    const createDraft = createAdminCourse(adminUser, {
      title: "Secret Unreleased Curriculum",
      slug: secretSlug,
      status: "draft",
      modules: [
        {
          id: "m-sec",
          title: "Modul Rahasia",
          lessons: [
            {
              id: "l-sec-1",
              slug: "materi-rahasia",
              title: "Materi Rahasia",
              type: "quiz",
              content: ["Materi"],
              quiz: [
                {
                  id: "q-sec-1",
                  question: "Kunci rahasia?",
                  options: ["A", "B"],
                  correctAnswer: 0,
                  explanation: "Penjelasan rahasia",
                },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(createDraft.ok, true);

    try {
      // 1. Regular student progress on draft course is strictly 403 rejected
      const studentProgRes = validateAndPersistUserProgress(studentA.id, {
        courseSlug: secretSlug,
        completedLessonIds: ["l-sec-1"],
      });
      assert.equal(
        studentProgRes.ok,
        false,
        "Siswa biasa tidak boleh mengirim progres ke kelas draft"
      );
      assert.equal(studentProgRes.status, 403);

      // 2. Regular student quiz submission on draft course is strictly 403 rejected
      const studentQuizRes = evaluateAndRecordServerQuiz(studentA.id, {
        courseSlug: secretSlug,
        lessonId: "l-sec-1",
        answers: { "q-sec-1": 0 },
      });
      assert.equal(
        studentQuizRes.ok,
        false,
        "Siswa biasa tidak boleh mengirim kuis ke kelas draft"
      );
      assert.equal(studentQuizRes.status, 403);

      // C. Quiz Answer Leakage Prevention
      const rawDraftCourse = createDraft.data.course;
      const sanitized = sanitizeCourseForClient(rawDraftCourse);
      const sanitizedQuiz = sanitized.modules[0].lessons[0].quiz[0];

      assert.equal(
        "correctAnswer" in sanitizedQuiz,
        false,
        "correctAnswer TIDAK BOLEH bocor pada sanitizedCourse"
      );
      assert.equal(
        "explanation" in sanitizedQuiz,
        false,
        "explanation TIDAK BOLEH bocor pada sanitizedCourse"
      );
      assert.ok(sanitizedQuiz.id, "ID soal tetap ada");
      assert.ok(sanitizedQuiz.question, "Pertanyaan tetap ada");
      assert.ok(Array.isArray(sanitizedQuiz.options), "Pilihan jawaban tetap ada");

      // D. XSS & Malicious Media URL Neutralization
      const xssRaw = "<script>alert('XSS')</script><b>Aman</b><iframe src='//bad.com'></iframe><img src=x onerror=alert(1)>";
      const sanitizedText = sanitizeCurriculumText(xssRaw);
      assert.equal(sanitizedText.includes("<script>"), false);
      assert.equal(sanitizedText.includes("<iframe>"), false);
      assert.equal(sanitizedText.includes("onerror"), false);

      const maliciousUrl1 = "javascript:alert(1)";
      const maliciousUrl2 = "vbscript:msgbox(1)";
      const maliciousUrl3 = "data:text/html,<script>alert(1)</script>";
      const safeUrl = "https://cdn.casper.academy/diagrams/market.svg";

      assert.equal(sanitizeMediaUrl(maliciousUrl1), undefined);
      assert.equal(sanitizeMediaUrl(maliciousUrl2), undefined);
      assert.equal(sanitizeMediaUrl(maliciousUrl3), undefined);
      assert.equal(sanitizeMediaUrl(safeUrl), safeUrl);
    } finally {
      removeAdminCourse(adminUser, { id: createDraft.data.course.id, force: true });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // 6. DATA INTEGRITY QA: PROGRESS PRESERVATION ACROSS CURRICULUM EDITS
  // ────────────────────────────────────────────────────────────────
  test("6. Data Integrity QA: Student A & B Multi-Scenario Integrity (Edit Title, Content, Move, Delete Lesson, Quiz & Baseline Reset)", () => {
    const slug = "qa-integrity-" + Date.now();
    const createRes = createAdminCourse(adminUser, {
      title: "Data Integrity Stress Course",
      slug,
      modules: [
        {
          id: "m-int-1",
          title: "Modul 1: Dasar",
          lessons: [
            { id: "l-int-1", slug: "materi-1", title: "Materi 1.1", type: "reading", content: ["Isi 1"] },
            { id: "l-int-2", slug: "materi-2", title: "Materi 1.2", type: "reading", content: ["Isi 2"] },
          ],
        },
        {
          id: "m-int-2",
          title: "Modul 2: Evaluasi",
          lessons: [
            {
              id: "l-int-eval",
              slug: "evaluasi-akhir",
              title: "Evaluasi Akhir Modul",
              type: "quiz",
              passingScore: 70,
              content: ["Ujian."],
              quiz: [
                {
                  id: "q-int-1",
                  question: "Soal integritas data?",
                  options: ["Pilihan Benar", "Pilihan Salah"],
                  correctAnswer: 0,
                  explanation: "Penjelasan.",
                },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(createRes.ok, true);
    const courseId = createRes.data.course.id;

    try {
      // Setup: Student A completes l-int-1 & l-int-eval (100% complete)
      validateAndPersistUserProgress(studentA.id, {
        courseSlug: slug,
        completedLessonIds: ["l-int-1", "l-int-2"],
      });
      evaluateAndRecordServerQuiz(studentA.id, {
        courseSlug: slug,
        lessonId: "l-int-eval",
        answers: { "q-int-1": 0 },
      });

      // Student B completes only l-int-1 (in progress)
      validateAndPersistUserProgress(studentB.id, {
        courseSlug: slug,
        completedLessonIds: ["l-int-1"],
      });

      // SCENARIO 1: Admin edits title of completed lesson
      const renameRes = updateAdminCourse(adminUser, {
        id: courseId,
        title: "Data Integrity Stress Course",
        modules: [
          {
            id: "m-int-1",
            title: "Modul 1: Dasar",
            lessons: [
              { id: "l-int-1", slug: "materi-1", title: "Materi 1.1: Judul Telah Diperbarui", type: "reading", content: ["Isi 1"] },
              { id: "l-int-2", slug: "materi-2", title: "Materi 1.2", type: "reading", content: ["Isi 2"] },
            ],
          },
          createRes.data.course.modules[1],
        ],
      });
      assert.equal(renameRes.ok, true);

      // Student A & B progress still intact
      const progA1 = getUserCourseProgress(studentA.id, slug);
      assert.deepEqual(JSON.parse(progA1.completed_lesson_ids).sort(), ["l-int-1", "l-int-2", "l-int-eval"].sort());
      const progB1 = getUserCourseProgress(studentB.id, slug);
      assert.deepEqual(JSON.parse(progB1.completed_lesson_ids), ["l-int-1"]);

      // SCENARIO 2: Admin edits content of completed lesson
      const editContentRes = updateAdminCourse(adminUser, {
        id: courseId,
        title: "Data Integrity Stress Course",
        modules: [
          {
            id: "m-int-1",
            title: "Modul 1: Dasar",
            lessons: [
              { id: "l-int-1", slug: "materi-1", title: "Materi 1.1: Judul Telah Diperbarui", type: "reading", content: ["Isi baru yang telah direvisi."] },
              { id: "l-int-2", slug: "materi-2", title: "Materi 1.2", type: "reading", content: ["Isi 2"] },
            ],
          },
          createRes.data.course.modules[1],
        ],
      });
      assert.equal(editContentRes.ok, true);
      const progA2 = getUserCourseProgress(studentA.id, slug);
      assert.equal(JSON.parse(progA2.completed_lesson_ids).length, 3);

      // SCENARIO 3: Admin moves lesson between modules (l-int-1 moved to Modul 2)
      const moveRes = updateAdminCourse(adminUser, {
        id: courseId,
        title: "Data Integrity Stress Course",
        modules: [
          {
            id: "m-int-1",
            title: "Modul 1: Dasar",
            lessons: [
              { id: "l-int-2", slug: "materi-2", title: "Materi 1.2", type: "reading", content: ["Isi 2"] },
            ],
          },
          {
            id: "m-int-2",
            title: "Modul 2: Evaluasi",
            lessons: [
              { id: "l-int-1", slug: "materi-1", title: "Materi 1.1: Judul Telah Diperbarui", type: "reading", content: ["Isi baru."] },
              createRes.data.course.modules[1].lessons[0],
            ],
          },
        ],
      });
      assert.equal(moveRes.ok, true);
      const evalCompletionA = evaluateCourseCompletion(moveRes.data.course, {
        completedLessonIds: JSON.parse(getUserCourseProgress(studentA.id, slug).completed_lesson_ids),
        quizScores: JSON.parse(getUserCourseProgress(studentA.id, slug).quiz_scores),
      });
      assert.equal(evalCompletionA.percentage, 100);
      assert.equal(evalCompletionA.isComplete, true);

      // SCENARIO 4: Admin attempts deleting completed lesson (l-int-1) without force
      const deleteCompletedNoForce = updateAdminCourse(adminUser, {
        id: courseId,
        title: "Data Integrity Stress Course",
        modules: [
          {
            id: "m-int-1",
            title: "Modul 1: Dasar",
            lessons: [
              { id: "l-int-2", slug: "materi-2", title: "Materi 1.2", type: "reading", content: ["Isi 2"] },
            ],
          },
          {
            id: "m-int-2",
            title: "Modul 2: Evaluasi",
            lessons: [createRes.data.course.modules[1].lessons[0]], // l-int-1 removed
          },
        ],
      });
      assert.equal(deleteCompletedNoForce.ok, false);
      assert.equal(deleteCompletedNoForce.status, 409);
      assert.ok(deleteCompletedNoForce.impact.affectedLessonUsersCount > 0);

      // SCENARIO 5: Admin changes passing score from 70% to 85%
      // Student A who scored 100% remains passed and eligible
      const updateScoreRes = updateAdminCourse(adminUser, {
        id: courseId,
        title: "Data Integrity Stress Course",
        modules: [
          moveRes.data.course.modules[0],
          {
            id: "m-int-2",
            title: "Modul 2: Evaluasi",
            lessons: [
              moveRes.data.course.modules[1].lessons[0],
              {
                ...moveRes.data.course.modules[1].lessons[1],
                passingScore: 85,
              },
            ],
          },
        ],
      });
      assert.equal(updateScoreRes.ok, true);

      const evalScoreA = evaluateCourseCompletion(updateScoreRes.data.course, {
        completedLessonIds: JSON.parse(getUserCourseProgress(studentA.id, slug).completed_lesson_ids),
        quizScores: JSON.parse(getUserCourseProgress(studentA.id, slug).quiz_scores),
      });
      assert.equal(evalScoreA.isEligibleForCertificate, true);
    } finally {
      removeAdminCourse(adminUser, { id: courseId, force: true });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // 7. DATABASE & CONCURRENCY QA: ATOMIC WRITES & ROLLBACK
  // ────────────────────────────────────────────────────────────────
  test("7. Database & Concurrency QA: Concurrent Updates, Atomic File Locking, Quarantine & Backup Recovery", () => {
    const slug1 = "qa-conc-1-" + Date.now();
    const slug2 = "qa-conc-2-" + Date.now();

    const c1Res = createAdminCourse(adminUser, { title: "Concurrent A", slug: slug1 });
    const c2Res = createAdminCourse(adminUser, { title: "Concurrent B", slug: slug2 });
    assert.equal(c1Res.ok, true);
    assert.equal(c2Res.ok, true);

    try {
      // A. Concurrent updates to two different courses
      const update1 = () =>
        updateAdminCourse(adminUser, { id: c1Res.data.course.id, subtitle: "Updated A" });
      const update2 = () =>
        updateAdminCourse(adminUser, { id: c2Res.data.course.id, subtitle: "Updated B" });

      const [res1, res2] = [update1(), update2()];
      assert.equal(res1.ok, true);
      assert.equal(res2.ok, true);

      // B. Concurrent updates to the same course
      const resA = updateAdminCourse(adminUser, { id: c1Res.data.course.id, subtitle: "Subtitle Alpha" });
      const resB = updateAdminCourse(adminUser, { id: c1Res.data.course.id, subtitle: "Subtitle Beta" });
      assert.equal(resA.ok, true);
      assert.equal(resB.ok, true);

      // Verify JSON health
      const health = getDatabaseHealth();
      assert.equal(health.status, "healthy");
      assert.ok(health.backupCount >= 0);
    } finally {
      removeAdminCourse(adminUser, { id: c1Res.data.course.id, force: true });
      removeAdminCourse(adminUser, { id: c2Res.data.course.id, force: true });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // 8. AUDIT LOG QA: COMPLETE EVENT RECORDING & TAMPER PROOFING
  // ────────────────────────────────────────────────────────────────
  test("8. Audit Log QA: Action Recording (Create, Update, Status, Reset, Delete) & User Access Denial", () => {
    const testSlug = "qa-audit-" + Date.now();
    const createRes = createAdminCourse(adminUser, { title: "Audit Verification Course", slug: testSlug });
    assert.equal(createRes.ok, true);
    const courseId = createRes.data.course.id;

    try {
      // 1. Status change
      patchAdminCourseAction(adminUser, {
        action: "set-status",
        courseId,
        status: "draft",
      });

      // 2. Course update
      updateAdminCourse(adminUser, {
        id: courseId,
        subtitle: "Audited update summary",
      });

      // 3. Check logs
      const logs = getAdminAuditLogs(10);
      assert.ok(logs.length > 0);

      const latestAction = logs[0];
      assert.ok(latestAction.admin_id, "Admin ID harus tercatat");
      assert.ok(latestAction.admin_email, "Admin email harus tercatat");
      assert.ok(latestAction.created_at, "Timestamp harus tercatat");
      assert.ok(latestAction.action, "Action harus tercatat");
      assert.ok(latestAction.summary, "Summary perubahan harus tercatat");

      // Regular student CANNOT read audit logs
      const studentAttempt = listAdminCourses(studentA);
      assert.equal(studentAttempt.ok, false);
      assert.equal(studentAttempt.status, 403);
    } finally {
      removeAdminCourse(adminUser, { id: courseId, force: true });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // 9. RESPONSIVE & USABILITY QA: CSS RULES & BREAKPOINTS
  // ────────────────────────────────────────────────────────────────
  test("9. Responsive & Usability QA: CSS Breakpoints, Grid Collapse & Horizontal Overflow Protection", () => {
    const cssPath = path.join(process.cwd(), "app", "globals.css");
    const css = fs.readFileSync(cssPath, "utf8");

    // A. Curriculum split grid collapsing on tablets/mobile
    assert.match(
      css,
      /\.admin-curriculum-grid\s*\{[^}]*grid-template-columns:\s*1fr\s*!important/,
      "CSS harus memiliki rule responsif untuk .admin-curriculum-grid pada breakpoint mobile/tablet"
    );

    // B. Form rows collapsing to single column on mobile
    assert.match(
      css,
      /\.admin-form-row\s*\{[^}]*grid-template-columns:\s*1fr\s*!important/,
      "CSS harus meruntuhkan form row menjadi 1 kolom pada mobile"
    );

    // C. Admin tabs wrapping
    assert.match(
      css,
      /\.admin-tabs\s*\{[^}]*flex-wrap:\s*wrap/,
      "CSS harus mengizinkan wrapping tab pada layar sempit"
    );

    // D. Table overflow protection
    assert.match(
      css,
      /\.admin-table\s*\{[^}]*overflow-x:\s*auto/,
      "CSS harus melindungi tabel admin dengan overflow-x auto"
    );
  });
});
