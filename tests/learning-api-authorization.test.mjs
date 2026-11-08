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
  upsertUserProgress,
  recordQuizSubmission,
} = await import("../lib/db.ts");

const {
  getCourseBySlug,
} = await import("../lib/courses-data.ts");

const {
  handleStudentLearningDashboardRequest,
  handleStudentLearningProgressRequest,
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

describe("Sprint 4 — Learning Intelligence API Authorization, Privacy & Zero-Leakage Suite", () => {
  const dataDir = path.join(process.cwd(), "data");
  const mainDbPath = path.join(dataDir, "academy.json");
  const isolatedDbFile = path.join(
    dataDir,
    `academy.test.s4.authz.${process.pid}.${Date.now()}.json`
  );

  let mainDbHashBefore = null;
  const c3 = getCourseBySlug("market-structure");
  const c4 = getCourseBySlug("support-and-resistance");
  const c3Lessons = c3.modules.flatMap((m) => m.lessons);
  const c4Lessons = c4.modules.flatMap((m) => m.lessons);
  const c3QuizLesson = c3Lessons.find((l) => l.type === "quiz") || c3Lessons[c3Lessons.length - 1];

  const studentA = {
    id: "s4_auth_student_a",
    email: "student.a@casper.academy",
    name: "Student Alpha",
    role: "USER",
  };
  const studentB = {
    id: "s4_auth_student_b",
    email: "student.b@casper.academy",
    name: "Student Beta",
    role: "USER",
  };
  const mentorActor = {
    id: "s4_auth_mentor_1",
    email: "mentor@casper.academy",
    name: "Mentor One",
    role: "MENTOR",
  };
  const adminActor = {
    id: "s4_auth_admin_1",
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
        { ...studentA, password_hash: "scrypt$mock", created_at: "2026-03-10T08:00:00.000Z" },
        { ...studentB, password_hash: "scrypt$mock", created_at: "2026-03-11T08:00:00.000Z" },
        { ...mentorActor, password_hash: "scrypt$mock", created_at: "2026-03-01T08:00:00.000Z" },
        { ...adminActor, password_hash: "scrypt$mock", created_at: "2026-01-01T08:00:00.000Z" },
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

    upsertUserProgress({
      id: "prog_auth_a_c3",
      userId: studentA.id,
      courseSlug: "market-structure",
      completedLessonIds: c3Lessons.slice(0, 2).map((l) => l.id),
      quizScores: { [c3QuizLesson.id]: 50 },
      lastLessonId: c3Lessons[2].id,
    });
    recordQuizSubmission({
      id: "qsub_auth_a_c3",
      userId: studentA.id,
      courseSlug: "market-structure",
      lessonId: c3QuizLesson.id,
      score: 50,
      answers: { q1: 1, q2: 0 },
    });

    upsertUserProgress({
      id: "prog_auth_b_c4",
      userId: studentB.id,
      courseSlug: "support-and-resistance",
      completedLessonIds: c4Lessons.slice(0, 3).map((l) => l.id),
      quizScores: {},
      lastLessonId: c4Lessons[2].id,
    });
  });

  after(() => {
    setDatabasePathForTest(null);
    if (fs.existsSync(isolatedDbFile)) {
      try {
        fs.unlinkSync(isolatedDbFile);
      } catch {}
    }
  });

  test("LSEC-01: Unauthenticated access to all student and admin learning endpoints returns 401", () => {
    assert.equal(handleStudentLearningDashboardRequest(null).status, 401);
    assert.equal(handleStudentLearningProgressRequest(null).status, 401);
    assert.equal(handleStudentRecommendationsRequest(null, "GET").status, 401);
    assert.equal(
      handleStudentRecommendationsRequest(null, "POST", { body: {} }).status,
      401
    );
    assert.equal(handleStudentLearningActivityRequest(null, "GET").status, 401);
    assert.equal(
      handleStudentLearningActivityRequest(null, "POST", { body: {} }).status,
      401
    );
    assert.equal(handleAdminEducationOverviewRequest(null).status, 401);
    assert.equal(handleAdminEducationCoursesRequest(null).status, 401);
    assert.equal(handleAdminEducationLessonsRequest(null).status, 401);
    assert.equal(handleAdminEducationQuizzesRequest(null).status, 401);
    assert.equal(handleAdminEducationEngagementRequest(null).status, 401);
  });

  test("LSEC-02: Student A accessing own learning dashboard, progress, recommendations, and activity succeeds (200/201)", () => {
    const dashRes = handleStudentLearningDashboardRequest(studentA);
    assert.equal(dashRes.status, 200);
    assert.equal(dashRes.data.userId, studentA.id);

    const progRes = handleStudentLearningProgressRequest(studentA);
    assert.equal(progRes.status, 200);
    assert.equal(progRes.data.userId, studentA.id);

    const recRes = handleStudentRecommendationsRequest(studentA, "GET");
    assert.equal(recRes.status, 200);
    assert.ok(Array.isArray(recRes.data.recommendations));

    // Dismiss & restore recommendation via API handler
    const firstRec = recRes.data.recommendations[0];
    assert.ok(firstRec);
    const dismissRes = handleStudentRecommendationsRequest(studentA, "POST", {
      body: {
        action: "dismiss",
        recommendationId: firstRec.recommendationId,
      },
    });
    assert.equal(dismissRes.status, 200);
    assert.equal(dismissRes.data.dismissedRecommendationsCount, 1);

    const restoreRes = handleStudentRecommendationsRequest(studentA, "POST", {
      body: {
        action: "restore",
        recommendationId: firstRec.recommendationId,
      },
    });
    assert.equal(restoreRes.status, 200);
    assert.equal(restoreRes.data.dismissedRecommendationsCount, 0);

    // Record LESSON_STARTED activity
    const postAct = handleStudentLearningActivityRequest(studentA, "POST", {
      body: {
        eventType: "LESSON_STARTED",
        courseSlug: "market-structure",
        lessonId: c3Lessons[2].id,
      },
    });
    assert.equal(postAct.status, 201);

    const getAct = handleStudentLearningActivityRequest(studentA, "GET");
    assert.equal(getAct.status, 200);
    assert.ok(getAct.data.continuity.recentEvents.length >= 1);
  });

  test("LSEC-03: Student A attempting to access Student B learning intelligence returns 403", () => {
    assert.equal(
      handleStudentLearningDashboardRequest(studentA, {
        queryUserId: studentB.id,
      }).status,
      403
    );
    assert.equal(
      handleStudentLearningProgressRequest(studentA, {
        queryUserId: studentB.id,
      }).status,
      403
    );
    assert.equal(
      handleStudentRecommendationsRequest(studentA, "GET", {
        queryUserId: studentB.id,
      }).status,
      403
    );
    assert.equal(
      handleStudentLearningActivityRequest(studentA, "GET", {
        queryUserId: studentB.id,
      }).status,
      403
    );
  });

  test("LSEC-04 & LSEC-06: Mentor and Student attempting to access cross-user learning or Admin Education Intelligence endpoints return 403", () => {
    // Mentor cannot read Student A's learning intelligence
    assert.equal(
      handleStudentLearningDashboardRequest(mentorActor, {
        queryUserId: studentA.id,
      }).status,
      403
    );

    // Student denied on all 5 Admin Education Intelligence endpoints
    assert.equal(handleAdminEducationOverviewRequest(studentA).status, 403);
    assert.equal(handleAdminEducationCoursesRequest(studentA).status, 403);
    assert.equal(handleAdminEducationLessonsRequest(studentA).status, 403);
    assert.equal(handleAdminEducationQuizzesRequest(studentA).status, 403);
    assert.equal(handleAdminEducationEngagementRequest(studentA).status, 403);

    // Mentor denied on all 5 Admin Education Intelligence endpoints
    assert.equal(handleAdminEducationOverviewRequest(mentorActor).status, 403);
    assert.equal(handleAdminEducationCoursesRequest(mentorActor).status, 403);
    assert.equal(handleAdminEducationLessonsRequest(mentorActor).status, 403);
    assert.equal(handleAdminEducationQuizzesRequest(mentorActor).status, 403);
    assert.equal(handleAdminEducationEngagementRequest(mentorActor).status, 403);
  });

  test("LSEC-05: Admin accessing all 5 aggregate Education Intelligence endpoints succeeds (200)", () => {
    assert.equal(
      handleAdminEducationOverviewRequest(adminActor, {
        period: "30d",
        includeBundle: true,
      }).status,
      200
    );
    assert.equal(
      handleAdminEducationCoursesRequest(adminActor, { period: "90d" }).status,
      200
    );
    assert.equal(
      handleAdminEducationLessonsRequest(adminActor, {
        period: "all",
        courseSlug: "market-structure",
      }).status,
      200
    );
    assert.equal(
      handleAdminEducationQuizzesRequest(adminActor, { period: "7d" }).status,
      200
    );
    assert.equal(
      handleAdminEducationEngagementRequest(adminActor, { period: "all" })
        .status,
      200
    );
  });

  test("LSEC-07: Invalid query parameters and invalid activity bodies return 400/404 safely", () => {
    assert.equal(
      handleAdminEducationOverviewRequest(adminActor, {
        period: "invalid_window",
      }).status,
      400
    );
    assert.equal(
      handleAdminEducationCoursesRequest(adminActor, { period: "999d" }).status,
      400
    );
    assert.equal(
      handleAdminEducationLessonsRequest(adminActor, { period: "yesterday" })
        .status,
      400
    );
    assert.equal(
      handleAdminEducationQuizzesRequest(adminActor, { period: "bad" }).status,
      400
    );
    assert.equal(
      handleAdminEducationEngagementRequest(adminActor, { period: "bad" })
        .status,
      400
    );

    // Invalid recommendation action
    assert.equal(
      handleStudentRecommendationsRequest(studentA, "POST", {
        body: { action: "invalid_action", recommendationId: "rec_1" },
      }).status,
      400
    );
    assert.equal(
      handleStudentRecommendationsRequest(studentA, "POST", {
        body: { action: "dismiss", recommendationId: "" },
      }).status,
      400
    );

    // Invalid activity eventType or non-existent courseSlug / lessonId
    assert.equal(
      handleStudentLearningActivityRequest(studentA, "POST", {
        body: { eventType: "HACK_EVENT", courseSlug: "market-structure" },
      }).status,
      400
    );
    assert.equal(
      handleStudentLearningActivityRequest(studentA, "POST", {
        body: {
          eventType: "LESSON_STARTED",
          courseSlug: "non-existent-course-999",
        },
      }).status,
      404
    );
    assert.equal(
      handleStudentLearningActivityRequest(studentA, "POST", {
        body: {
          eventType: "LESSON_STARTED",
          courseSlug: "market-structure",
          lessonId: "non-existent-lesson-999",
        },
      }).status,
      400
    );
  });

  test("LSEC-08 & LSEC-09: API responses NEVER leak quiz correctOptionIndex/correctAnswer or private trading journal fields", () => {
    const dashRes = handleStudentLearningDashboardRequest(studentA);
    const quizIntelRes = handleAdminEducationQuizzesRequest(adminActor, {
      period: "all",
    });
    const overviewRes = handleAdminEducationOverviewRequest(adminActor, {
      period: "all",
      includeBundle: true,
    });

    const combinedSerialized = JSON.stringify({
      dash: dashRes.data,
      quizIntel: quizIntelRes.data,
      overview: overviewRes.data,
    });

    // Zero quiz answer key leakage
    assert.equal(combinedSerialized.includes("correctOptionIndex"), false);
    assert.equal(combinedSerialized.includes("correctAnswer"), false);

    // Zero private trading journal leakage
    assert.equal(combinedSerialized.includes("netPnl"), false);
    assert.equal(combinedSerialized.includes("initialBalance"), false);
    assert.equal(combinedSerialized.includes("cashTransactions"), false);
    assert.equal(combinedSerialized.includes("entryPrice"), false);
    assert.equal(combinedSerialized.includes("stopLoss"), false);
  });

  test("LSEC-10: Production database data/academy.json remains 100% unmodified after test suite", () => {
    if (mainDbHashBefore && fs.existsSync(mainDbPath)) {
      const mainDbHashAfter = crypto
        .createHash("sha256")
        .update(fs.readFileSync(mainDbPath))
        .digest("hex");
      assert.equal(
        mainDbHashAfter,
        mainDbHashBefore,
        "data/academy.json must never be modified by Sprint 4 tests"
      );
    }
  });
});
