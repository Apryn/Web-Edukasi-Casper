import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
  recordLearningEvent,
  dismissRecommendationForUser,
  restoreRecommendationForUser,
} = await import("../lib/db.ts");

const {
  getCourseBySlug,
} = await import("../lib/courses-data.ts");

const {
  buildStudentLearningDashboardForUser,
} = await import("../lib/learning-intelligence/index.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

describe("Sprint 4 — Adaptive Learning Recommendation Engine Suite", () => {
  const dataDir = path.join(process.cwd(), "data");
  const isolatedDbFile = path.join(
    dataDir,
    `academy.test.s4.recs.${process.pid}.${Date.now()}.json`
  );

  const FIXED_NOW_ISO = "2026-04-08T12:00:00.000Z";

  const c1 = getCourseBySlug("trading-fundamentals");
  const c3 = getCourseBySlug("market-structure");
  const c4 = getCourseBySlug("support-and-resistance");
  const c1Lessons = c1.modules.flatMap((m) => m.lessons);
  const c3Lessons = c3.modules.flatMap((m) => m.lessons);
  const c4Lessons = c4.modules.flatMap((m) => m.lessons);
  const c1QuizLessons = c1Lessons.filter((l) => l.type === "quiz");
  const c1QuizLesson = c1QuizLessons[0] || c1Lessons[c1Lessons.length - 1];
  const c3QuizLesson = c3Lessons.find((l) => l.type === "quiz") || c3Lessons[c3Lessons.length - 1];

  const stuNew = {
    id: "rec_stu_new",
    email: "new@student.casper",
    name: "New Student",
    role: "USER",
    password_hash: "scrypt$mock",
    created_at: "2026-04-08T08:00:00.000Z",
  };
  const stuActive = {
    id: "rec_stu_active",
    email: "active@student.casper",
    name: "Active Student",
    role: "USER",
    password_hash: "scrypt$mock",
    created_at: "2026-04-01T08:00:00.000Z",
  };
  const stuFailedQuiz = {
    id: "rec_stu_failed_quiz",
    email: "failed@student.casper",
    name: "Failed Quiz Student",
    role: "USER",
    password_hash: "scrypt$mock",
    created_at: "2026-04-01T08:00:00.000Z",
  };
  const stuInactive = {
    id: "rec_stu_inactive",
    email: "inactive@student.casper",
    name: "Inactive Student",
    role: "USER",
    password_hash: "scrypt$mock",
    created_at: "2026-03-01T08:00:00.000Z",
  };
  const stuGraduated = {
    id: "rec_stu_graduated",
    email: "grad@student.casper",
    name: "Graduated C1 Student",
    role: "USER",
    password_hash: "scrypt$mock",
    created_at: "2026-03-20T08:00:00.000Z",
  };

  before(() => {
    const initialDb = {
      users: [stuNew, stuActive, stuFailedQuiz, stuInactive, stuGraduated],
      course_progress: [],
      quiz_submissions: [],
      custom_courses: [],
      admin_audit_logs: [],
      learning_events: [],
      recommendation_dismissals: [],
    };
    fs.writeFileSync(isolatedDbFile, JSON.stringify(initialDb, null, 2), "utf8");
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

  test("REC-01: New student with zero progress receives START_FOUNDATION recommendation pointing to first foundation course", () => {
    const report = buildStudentLearningDashboardForUser(stuNew.id, FIXED_NOW_ISO);
    const recs = report.recommendations;
    assert.ok(recs.length >= 1);
    const startRec = recs.find((r) => r.type === "START_FOUNDATION");
    assert.ok(startRec);
    assert.equal(startRec.priority, 72);
    assert.equal(startRec.courseSlug, "trading-fundamentals");
    assert.ok(startRec.explanation.length > 10);
    assert.ok(startRec.evidenceSummary.length > 5);
    assert.ok(startRec.destination.startsWith("/kelas/trading-fundamentals"));
  });

  test("REC-02: Student with active in-progress course (active < 7 days) receives CONTINUE_LEARNING and START_FOUNDATION (if jumped to C3)", () => {
    upsertUserProgress({
      id: "prog_rec_active_c3",
      userId: stuActive.id,
      courseSlug: "market-structure",
      completedLessonIds: [c3Lessons[0].id],
      quizScores: {},
      lastLessonId: c3Lessons[1].id,
    });
    recordLearningEvent({
      userId: stuActive.id,
      eventType: "LESSON_COMPLETED",
      courseId: c3.id,
      courseSlug: "market-structure",
      lessonId: c3Lessons[0].id,
      createdAt: "2026-04-07T09:30:00.000Z",
    });

    const report = buildStudentLearningDashboardForUser(stuActive.id, FIXED_NOW_ISO);
    const recs = report.recommendations;
    const continueRec = recs.find((r) => r.type === "CONTINUE_LEARNING");
    assert.ok(continueRec);
    assert.equal(continueRec.priority, 90);
    assert.equal(continueRec.courseSlug, "market-structure");
    assert.equal(
      continueRec.destination,
      `/kelas/market-structure?lesson=${c3Lessons[1].id}`
    );
  });

  test("REC-03 & REC-04: Student with failed quiz (< 70%) across multiple attempts receives top-priority RETRY_QUIZ (95) and REVIEW_WEAK_TOPIC (84)", () => {
    recordQuizSubmission({
      id: "rec_qsub_1",
      userId: stuFailedQuiz.id,
      courseSlug: "market-structure",
      lessonId: c3QuizLesson.id,
      score: 40,
      answers: { q1: 0 },
    });
    recordQuizSubmission({
      id: "rec_qsub_2",
      userId: stuFailedQuiz.id,
      courseSlug: "market-structure",
      lessonId: c3QuizLesson.id,
      score: 50,
      answers: { q1: 1 },
    });
    upsertUserProgress({
      id: "prog_rec_fail_c3",
      userId: stuFailedQuiz.id,
      courseSlug: "market-structure",
      completedLessonIds: c3Lessons.slice(0, -1).map((l) => l.id),
      quizScores: { [c3QuizLesson.id]: 50 },
      lastLessonId: c3QuizLesson.id,
    });

    const report = buildStudentLearningDashboardForUser(stuFailedQuiz.id, FIXED_NOW_ISO);
    const recs = report.recommendations;
    assert.ok(recs.length >= 2);
    assert.equal(recs[0].type, "RETRY_QUIZ");
    assert.equal(recs[0].priority, 95);
    assert.equal(recs[0].courseSlug, "market-structure");
    assert.equal(recs[0].lessonId, c3QuizLesson.id);
    assert.ok(recs[0].evidenceSummary.includes("50%"));

    const weakRec = recs.find((r) => r.type === "REVIEW_WEAK_TOPIC");
    assert.ok(weakRec);
    assert.equal(weakRec.priority, 84);
    assert.equal(weakRec.courseSlug, "market-structure");
  });

  test("REC-05: Student inactive >= 7 days with unfinished course receives RETURN_TO_LEARNING (priority 92)", () => {
    upsertUserProgress({
      id: "prog_rec_inactive_c4",
      userId: stuInactive.id,
      courseSlug: "support-and-resistance",
      completedLessonIds: [c4Lessons[0].id],
      quizScores: {},
      lastLessonId: c4Lessons[1].id,
    });
    // Backdate updated_at and started_at in DB to 2026-03-25 (14 days before FIXED_NOW_ISO 2026-04-08)
    const rawDb = JSON.parse(fs.readFileSync(isolatedDbFile, "utf8"));
    const row = rawDb.course_progress.find(
      (r) => r.user_id === stuInactive.id && r.course_slug === "support-and-resistance"
    );
    if (row) {
      row.started_at = "2026-03-20T10:00:00.000Z";
      row.updated_at = "2026-03-25T10:00:00.000Z";
    }
    fs.writeFileSync(isolatedDbFile, JSON.stringify(rawDb, null, 2), "utf8");
    // Reload test database cache by re-setting path
    setDatabasePathForTest(isolatedDbFile);

    const report = buildStudentLearningDashboardForUser(stuInactive.id, FIXED_NOW_ISO);
    const recs = report.recommendations;
    const returnRec = recs.find((r) => r.type === "RETURN_TO_LEARNING");
    assert.ok(returnRec);
    assert.equal(returnRec.priority, 92);
    assert.equal(returnRec.courseSlug, "support-and-resistance");
    assert.ok(returnRec.explanation.includes("14 hari"));
  });

  test("REC-06: Student who completed C1 receives ADVANCE_TO_NEXT_COURSE for the next curriculum course", () => {
    const c1PassedScores = {};
    for (const ql of c1QuizLessons) {
      c1PassedScores[ql.id] = 100;
      recordQuizSubmission({
        id: `rec_qsub_grad_${ql.id}`,
        userId: stuGraduated.id,
        courseSlug: "trading-fundamentals",
        lessonId: ql.id,
        score: 100,
        answers: { q1: 1 },
      });
    }
    upsertUserProgress({
      id: "prog_rec_grad_c1",
      userId: stuGraduated.id,
      courseSlug: "trading-fundamentals",
      completedLessonIds: c1Lessons.map((l) => l.id),
      quizScores: c1PassedScores,
      lastLessonId: c1QuizLesson.id,
      completedAt: "2026-04-07T10:00:00.000Z",
    });

    const report = buildStudentLearningDashboardForUser(stuGraduated.id, FIXED_NOW_ISO);
    const recs = report.recommendations;
    const advanceRec = recs.find((r) => r.type === "ADVANCE_TO_NEXT_COURSE");
    assert.ok(advanceRec);
    assert.equal(advanceRec.priority, 66);
    assert.ok(advanceRec.courseSlug !== "trading-fundamentals");
  });

  test("REC-07: Deterministic ranking, max cap (<= 5), dismissal, manual restore, and automatic resurfacing when evidence changes", () => {
    const initialReport = buildStudentLearningDashboardForUser(
      stuFailedQuiz.id,
      FIXED_NOW_ISO
    );
    const initialRecs = initialReport.recommendations;
    assert.ok(initialRecs.length <= 5);

    for (let i = 1; i < initialRecs.length; i++) {
      assert.ok(initialRecs[i - 1].priority >= initialRecs[i].priority);
    }

    const retryRec = initialRecs.find((r) => r.type === "RETRY_QUIZ");
    assert.ok(retryRec);

    // 1. Dismiss RETRY_QUIZ with current evidenceSignature
    dismissRecommendationForUser({
      userId: stuFailedQuiz.id,
      recommendationId: retryRec.recommendationId,
      evidenceSignature: retryRec.evidenceSignature,
    });

    const afterDismiss = buildStudentLearningDashboardForUser(
      stuFailedQuiz.id,
      FIXED_NOW_ISO
    ).recommendations;
    assert.equal(
      afterDismiss.some((r) => r.recommendationId === retryRec.recommendationId),
      false
    );

    // 2. When underlying evidence changes (student attempts quiz again and gets 60%, still < 70%),
    // the evidenceSignature changes and RETRY_QUIZ automatically resurfaces!
    recordQuizSubmission({
      id: "rec_qsub_3",
      userId: stuFailedQuiz.id,
      courseSlug: "market-structure",
      lessonId: c3QuizLesson.id,
      score: 60,
      answers: { q1: 1 },
    });
    upsertUserProgress({
      id: "prog_rec_fail_c3",
      userId: stuFailedQuiz.id,
      courseSlug: "market-structure",
      completedLessonIds: c3Lessons.slice(0, -1).map((l) => l.id),
      quizScores: { [c3QuizLesson.id]: 60 },
      lastLessonId: c3QuizLesson.id,
    });

    const afterNewAttempt = buildStudentLearningDashboardForUser(
      stuFailedQuiz.id,
      FIXED_NOW_ISO
    ).recommendations;
    const resurfaced = afterNewAttempt.find(
      (r) => r.recommendationId === retryRec.recommendationId
    );
    assert.ok(resurfaced, "Recommendation must resurface when evidenceSignature changes");
    assert.notEqual(resurfaced.evidenceSignature, retryRec.evidenceSignature);

    // 3. Dismiss again and test manual restore
    dismissRecommendationForUser({
      userId: stuFailedQuiz.id,
      recommendationId: resurfaced.recommendationId,
      evidenceSignature: resurfaced.evidenceSignature,
    });
    assert.equal(
      buildStudentLearningDashboardForUser(
        stuFailedQuiz.id,
        FIXED_NOW_ISO
      ).recommendations.some((r) => r.recommendationId === resurfaced.recommendationId),
      false
    );

    restoreRecommendationForUser(stuFailedQuiz.id, resurfaced.recommendationId);
    assert.equal(
      buildStudentLearningDashboardForUser(
        stuFailedQuiz.id,
        FIXED_NOW_ISO
      ).recommendations.some((r) => r.recommendationId === resurfaced.recommendationId),
      true
    );
  });
});
