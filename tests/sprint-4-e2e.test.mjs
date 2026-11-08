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

const {
  setDatabasePathForTest,
} = await import("../lib/db.ts");

const {
  getCourseBySlug,
} = await import("../lib/courses-data.ts");

const {
  validateAndPersistUserProgress,
  evaluateAndRecordServerQuiz,
} = await import("../lib/server-progress.ts");

const {
  handleStudentLearningDashboardRequest,
  handleStudentRecommendationsRequest,
  handleStudentLearningActivityRequest,
  handleAdminEducationOverviewRequest,
  handleAdminEducationCoursesRequest,
  handleAdminEducationLessonsRequest,
  handleAdminEducationQuizzesRequest,
  handleAdminEducationEngagementRequest,
} = await import("../lib/learning-intelligence/index.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

describe("Sprint 4 Task 4.8 — End-to-End Student & Admin Learning Intelligence Verification", () => {
  const dataDir = path.join(process.cwd(), "data");
  const mainDbPath = path.join(dataDir, "academy.json");
  const isolatedDbFile = path.join(
    dataDir,
    `academy.test.s4.e2e.${process.pid}.${Date.now()}.json`
  );

  let mainDbHashBefore = null;
  const c1 = getCourseBySlug("trading-fundamentals");
  const c1Lessons = c1.modules.flatMap((m) => m.lessons);
  const c1QuizLessons = c1Lessons.filter((l) => l.type === "quiz");
  const c1ReadingLessons = c1Lessons.filter((l) => l.type !== "quiz");

  const student1 = {
    id: "s4_e2e_stu_1",
    email: "e2e.stu1@casper.academy",
    name: "E2E Student Satu",
    role: "USER",
  };
  const student2 = {
    id: "s4_e2e_stu_2",
    email: "e2e.stu2@casper.academy",
    name: "E2E Student Dua",
    role: "USER",
  };
  const student3 = {
    id: "s4_e2e_stu_3",
    email: "e2e.stu3@casper.academy",
    name: "E2E Student Tiga",
    role: "USER",
  };
  const adminUser = {
    id: "s4_e2e_admin",
    email: "apriyanriyan23@gmail.com",
    name: "Master Admin",
    role: "ADMIN",
  };

  before(() => {
    if (fs.existsSync(mainDbPath)) {
      mainDbHashBefore = crypto
        .createHash("sha256")
        .update(fs.readFileSync(mainDbPath))
        .digest("hex");
    }

    const seedDb = {
      users: [
        { ...student1, password_hash: "scrypt$mock", created_at: "2026-04-01T08:00:00.000Z" },
        { ...student2, password_hash: "scrypt$mock", created_at: "2026-04-01T09:00:00.000Z" },
        { ...student3, password_hash: "scrypt$mock", created_at: "2026-04-02T08:00:00.000Z" },
        { ...adminUser, password_hash: "scrypt$mock", created_at: "2026-01-01T00:00:00.000Z" },
      ],
      course_progress: [],
      quiz_submissions: [],
      custom_courses: [],
      admin_audit_logs: [],
      learning_events: [],
      recommendation_dismissals: [],
    };
    fs.writeFileSync(isolatedDbFile, JSON.stringify(seedDb, null, 2), "utf8");
    setDatabasePathForTest(isolatedDbFile);
  });

  after(() => {
    setDatabasePathForTest(null);
    if (fs.existsSync(isolatedDbFile)) {
      try {
        fs.unlinkSync(isolatedDbFile);
      } catch {}
    }
  });

  test("E2E-01: Student flow — starts course, completes reading lessons, fails quiz (<70%), sees RETRY_QUIZ recommendation, retries quiz (>=70%), and earns certificate", () => {
    // 1. Student 1 opens first lesson in classroom -> records LESSON_STARTED
    const startRes = handleStudentLearningActivityRequest(student1, "POST", {
      body: {
        eventType: "LESSON_STARTED",
        courseSlug: "trading-fundamentals",
        lessonId: c1ReadingLessons[0].id,
      },
    });
    assert.equal(startRes.status, 201);

    // 2. Student 1 completes all reading lessons via server-progress pipeline
    const readingIds = c1ReadingLessons.map((l) => l.id);
    const progRes = validateAndPersistUserProgress(student1.id, {
      courseSlug: "trading-fundamentals",
      completedLessonIds: readingIds,
      lastLessonId: c1QuizLessons[0].id,
    });
    assert.equal(progRes.ok, true);

    // 3. Student 1 submits first required quiz with wrong answers (< 70%)
    const firstQuiz = c1QuizLessons[0];
    const wrongAnswers = {};
    for (const q of firstQuiz.quiz || []) {
      wrongAnswers[q.id] = (q.correctAnswer + 1) % q.options.length;
    }
    const failQuizRes = evaluateAndRecordServerQuiz(student1.id, {
      courseSlug: "trading-fundamentals",
      lessonId: firstQuiz.id,
      answers: wrongAnswers,
    });
    assert.equal(failQuizRes.ok, true);
    assert.equal(failQuizRes.passed, false);
    assert.equal(failQuizRes.score, 0);

    // 4. Student 1 opens Learning Dashboard -> sees RETRY_QUIZ recommendation at rank 1
    const dashAfterFail = handleStudentLearningDashboardRequest(student1);
    assert.equal(dashAfterFail.status, 200);
    assert.equal(dashAfterFail.data.overall.coursesStarted, 1);
    assert.equal(dashAfterFail.data.overall.coursesCompleted, 0);
    assert.equal(dashAfterFail.data.recommendations[0].type, "RETRY_QUIZ");
    assert.equal(dashAfterFail.data.recommendations[0].lessonId, firstQuiz.id);

    // 5. Student 1 dismisses a secondary recommendation and restores it
    if (dashAfterFail.data.recommendations.length > 1) {
      const secRec = dashAfterFail.data.recommendations[1];
      const dis = handleStudentRecommendationsRequest(student1, "POST", {
        body: { action: "dismiss", recommendationId: secRec.recommendationId },
      });
      assert.equal(dis.status, 200);
      assert.equal(dis.data.dismissedRecommendationsCount, 1);

      const res = handleStudentRecommendationsRequest(student1, "POST", {
        body: { action: "restore", recommendationId: secRec.recommendationId },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.dismissedRecommendationsCount, 0);
    }

    // 6. Student 1 retries all required quizzes in trading-fundamentals with 100% score
    for (const ql of c1QuizLessons) {
      const rightAnswers = {};
      for (const q of ql.quiz || []) {
        rightAnswers[q.id] = q.correctAnswer;
      }
      const passRes = evaluateAndRecordServerQuiz(student1.id, {
        courseSlug: "trading-fundamentals",
        lessonId: ql.id,
        answers: rightAnswers,
      });
      assert.equal(passRes.ok, true);
      assert.equal(passRes.passed, true);
      assert.equal(passRes.score, 100);
    }

    // 7. Student 1 refreshes Learning Dashboard -> course is COMPLETED, certificate eligible, and ADVANCE_TO_NEXT_COURSE is recommended
    const dashAfterPass = handleStudentLearningDashboardRequest(student1);
    assert.equal(dashAfterPass.status, 200);
    assert.equal(dashAfterPass.data.overall.coursesCompleted, 1);
    assert.equal(dashAfterPass.data.overall.certificatesEarnedCount, 1);
    const c1Item = dashAfterPass.data.courseProgress.find(
      (c) => c.courseSlug === "trading-fundamentals"
    );
    assert.equal(c1Item.status, "COMPLETED");
    assert.equal(c1Item.isEligibleForCertificate, true);
    assert.ok(
      dashAfterPass.data.recommendations.some(
        (r) => r.type === "ADVANCE_TO_NEXT_COURSE"
      )
    );
  });

  test("E2E-02: Admin flow — inspects Education Intelligence across 7d/30d/90d/all periods, course performance, drop-off, quiz difficulty, and engagement funnel", () => {
    // Seed Student 2 and Student 3 with partial progress on trading-fundamentals so cohort size == 3 (>= MIN_SAFE_COHORT_SIZE)
    validateAndPersistUserProgress(student2.id, {
      courseSlug: "trading-fundamentals",
      completedLessonIds: [c1ReadingLessons[0].id],
      lastLessonId: c1ReadingLessons[1].id,
    });
    validateAndPersistUserProgress(student3.id, {
      courseSlug: "trading-fundamentals",
      completedLessonIds: [c1ReadingLessons[0].id, c1ReadingLessons[1].id],
      lastLessonId: c1QuizLessons[0].id,
    });

    for (const period of ["7d", "30d", "90d", "all"]) {
      const ovRes = handleAdminEducationOverviewRequest(adminUser, {
        period,
        includeBundle: true,
      });
      assert.equal(ovRes.status, 200);
      assert.equal(
        ovRes.data.privacyGuarantee,
        "STRICT_EDUCATION_ONLY_NO_PRIVATE_JOURNAL"
      );
      assert.equal(ovRes.data.overview.totalRegisteredStudents, 3);
      assert.equal(ovRes.data.overview.studentsStartedAnyCourse, 3);
      assert.equal(ovRes.data.overview.studentsCompletedAtLeastOneCourse, 1);
    }

    const coursesRes = handleAdminEducationCoursesRequest(adminUser, {
      period: "all",
    });
    assert.equal(coursesRes.status, 200);
    const c1CourseAdmin = coursesRes.data.courses.find(
      (c) => c.courseSlug === "trading-fundamentals"
    );
    assert.ok(c1CourseAdmin);
    assert.equal(c1CourseAdmin.startedStudentsCount, 3);
    assert.equal(c1CourseAdmin.completedStudentsCount, 1);
    assert.equal(c1CourseAdmin.inProgressStudentsCount, 2);
    assert.equal(c1CourseAdmin.sampleSizeStatus, "AVAILABLE");

    const lessonsRes = handleAdminEducationLessonsRequest(adminUser, {
      period: "all",
      courseSlug: "trading-fundamentals",
    });
    assert.equal(lessonsRes.status, 200);
    assert.equal(lessonsRes.data.lessons.length, c1Lessons.length);

    const quizRes = handleAdminEducationQuizzesRequest(adminUser, {
      period: "all",
    });
    assert.equal(quizRes.status, 200);
    assert.ok(quizRes.data.quizzes.totalSubmissions >= 3);

    const engRes = handleAdminEducationEngagementRequest(adminUser, {
      period: "all",
    });
    assert.equal(engRes.status, 200);
    assert.equal(engRes.data.engagement.funnel.registeredStudents, 3);
    assert.equal(engRes.data.engagement.funnel.startedAtLeastOneCourse, 3);
    assert.equal(engRes.data.engagement.funnel.completedAtLeastOneCourse, 1);
  });

  test("E2E-03: UI & CSS Contract Verification — StudentLearningWorkspace, AdminEducationIntelligencePanel, and responsive styles", () => {
    const studentUi = fs.readFileSync(
      path.join(process.cwd(), "app/dashboard/StudentLearningWorkspace.tsx"),
      "utf8"
    );
    const dashboardPage = fs.readFileSync(
      path.join(process.cwd(), "app/dashboard/page.tsx"),
      "utf8"
    );
    const adminUi = fs.readFileSync(
      path.join(process.cwd(), "app/admin/AdminEducationIntelligencePanel.tsx"),
      "utf8"
    );
    const adminPage = fs.readFileSync(
      path.join(process.cwd(), "app/admin/page.tsx"),
      "utf8"
    );
    const globalsCss = fs.readFileSync(
      path.join(process.cwd(), "app/globals.css"),
      "utf8"
    );

    assert.ok(dashboardPage.includes("StudentLearningWorkspace"));
    assert.ok(studentUi.includes("/api/learning/dashboard"));
    assert.ok(studentUi.includes("/api/learning/recommendations"));

    assert.ok(adminPage.includes("AdminEducationIntelligencePanel"));
    assert.ok(adminUi.includes("/api/admin/learning-intelligence/overview"));
    assert.ok(adminUi.includes("bundle.privacyGuarantee"));

    assert.ok(globalsCss.includes(".learning-workspace"));
    assert.ok(globalsCss.includes(".learning-kpi-grid"));
    assert.ok(globalsCss.includes(".learning-rec-grid"));
    assert.ok(globalsCss.includes("@media (max-width: 900px)"));
    assert.ok(globalsCss.includes("@media (max-width: 640px)"));

    if (mainDbHashBefore && fs.existsSync(mainDbPath)) {
      const mainDbHashAfter = crypto
        .createHash("sha256")
        .update(fs.readFileSync(mainDbPath))
        .digest("hex");
      assert.equal(mainDbHashAfter, mainDbHashBefore);
    }
  });
});
