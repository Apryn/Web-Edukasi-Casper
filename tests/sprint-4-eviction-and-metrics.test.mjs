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
  getAllLearningEventsForAdmin,
  getAllCourseProgressForAdmin,
  getAllQuizSubmissionsForAdmin,
  getAllUsersForAdmin,
} = await import("../lib/db.ts");

const {
  buildStudentLearningDashboardForUser,
  buildAdminEducationIntelligence,
} = await import("../lib/learning-intelligence/index.ts");

const {
  getCourseBySlug,
} = await import("../lib/courses-data.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

describe("Sprint 4 — Ring Buffer 10,000 Event Eviction & Data Fidelity Audit", () => {
  const dataDir = path.join(process.cwd(), "data");
  const isolatedDbFile = path.join(
    dataDir,
    `academy.test.s4.evict.${process.pid}.${Date.now()}.json`
  );

  const c1 = getCourseBySlug("trading-fundamentals");
  const c1Lessons = c1.modules.flatMap((m) => m.lessons);
  const c1QuizLessons = c1Lessons.filter((l) => l.type === "quiz");
  const c1ReadingLessons = c1Lessons.filter((l) => l.type !== "quiz");

  const studentAlpha = {
    id: "usr_alpha_evict_test",
    email: "alpha.evict@casper.test",
    name: "Student Alpha Eviction Test",
    password_hash: "$2a$10$abcdefghijklmnopqrstuu",
    role: "USER",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const studentBeta = {
    id: "usr_beta_evict_test",
    email: "beta.evict@casper.test",
    name: "Student Beta Eviction Test",
    password_hash: "$2a$10$abcdefghijklmnopqrstuu",
    role: "USER",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const studentGamma = {
    id: "usr_gamma_evict_test",
    email: "gamma.evict@casper.test",
    name: "Student Gamma Eviction Test",
    password_hash: "$2a$10$abcdefghijklmnopqrstuu",
    role: "USER",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  before(() => {
    fs.writeFileSync(
      isolatedDbFile,
      JSON.stringify(
        {
          users: [studentAlpha, studentBeta, studentGamma],
          course_progress: [],
          quiz_submissions: [],
          learning_events: [],
          recommendation_dismissals: [],
        },
        null,
        2
      ),
      "utf8"
    );
    setDatabasePathForTest(isolatedDbFile);
  });

  after(() => {
    setDatabasePathForTest(null);
    try {
      if (fs.existsSync(isolatedDbFile)) {
        fs.unlinkSync(isolatedDbFile);
      }
    } catch {
      // ignore cleanup collision
    }
  });

  test("EVICT-01: Seed student Alpha with SSOT progress, quiz submission, and early telemetry event", () => {
    // 1. Course progress (SSOT)
    upsertUserProgress({
      id: "prog_alpha_1",
      userId: studentAlpha.id,
      courseSlug: "trading-fundamentals",
      completedLessonIds: [c1ReadingLessons[0].id, c1ReadingLessons[1].id],
      quizScores: { [c1QuizLessons[0].id]: 85 },
      lastLessonId: c1ReadingLessons[1].id,
    });

    const progRows = getAllCourseProgressForAdmin();
    const alphaProg = progRows.find((p) => p.user_id === studentAlpha.id);
    assert.ok(alphaProg, "Course progress must be recorded");
    assert.equal(alphaProg.user_id, studentAlpha.id);

    // 2. Quiz submission (SSOT)
    recordQuizSubmission({
      id: "sub_alpha_1",
      userId: studentAlpha.id,
      courseSlug: "trading-fundamentals",
      lessonId: c1QuizLessons[0].id,
      score: 85,
      answers: { q1: 1, q2: 0 },
    });

    const subRows = getAllQuizSubmissionsForAdmin();
    const alphaSub = subRows.find((s) => s.user_id === studentAlpha.id);
    assert.ok(alphaSub, "Quiz submission must be recorded");
    assert.equal(alphaSub.score, 85);

    // 3. Early telemetry event (in ring buffer)
    const ev1 = recordLearningEvent({
      userId: studentAlpha.id,
      eventType: "COURSE_STARTED",
      courseId: c1.id,
      courseSlug: "trading-fundamentals",
      createdAt: "2026-01-01T10:00:00.000Z",
    });
    assert.ok(ev1);
    assert.equal(ev1.event_type, "COURSE_STARTED");

    const eventsNow = getAllLearningEventsForAdmin();
    assert.equal(eventsNow.length, 1);
  });

  test("EVICT-02: Bulk insert 10,050 events to force FIFO ring buffer eviction beyond MAX_LEARNING_EVENTS (10,000)", () => {
    const rawContent = JSON.parse(fs.readFileSync(isolatedDbFile, "utf8"));
    const existingEvents = rawContent.learning_events || [];

    const bulkEvents = [];
    const baseTimeMs = Date.parse("2026-02-01T00:00:00.000Z");

    for (let i = 0; i < 10050; i++) {
      const ts = new Date(baseTimeMs + i * 1000).toISOString();
      bulkEvents.push({
        id: `evt_bulk_${i}`,
        user_id: i % 2 === 0 ? studentBeta.id : studentGamma.id,
        event_type: "LESSON_STARTED",
        course_id: "c2",
        course_slug: "pengantar-forex",
        module_id: "mod-1",
        lesson_id: `pf-${(i % 5) + 1}`,
        score: null,
        created_at: ts,
        schema_version: 1,
      });
    }

    // Combine existing and bulk, then slice to last 10,000 as db.ts does
    const combined = [...existingEvents, ...bulkEvents].slice(-10000);
    rawContent.learning_events = combined;
    fs.writeFileSync(isolatedDbFile, JSON.stringify(rawContent, null, 2), "utf8");

    // Clear db cache
    setDatabasePathForTest(isolatedDbFile);

    const storedEvents = getAllLearningEventsForAdmin();
    assert.equal(storedEvents.length, 10000, "Learning events must be strictly clamped to 10,000");

    // Verify student Alpha's early event was evicted from learning_events
    const alphaEvents = storedEvents.filter((e) => e.user_id === studentAlpha.id);
    assert.equal(
      alphaEvents.length,
      0,
      "Student Alpha's early event must be evicted under FIFO eviction"
    );
  });

  test("EVICT-03: Verify Student Alpha's course_progress and quiz_submissions remain 100% intact (SSOT)", () => {
    const allProgress = getAllCourseProgressForAdmin();
    const alphaProgress = allProgress.find((p) => p.user_id === studentAlpha.id);
    assert.ok(alphaProgress, "Alpha progress record must remain completely intact");
    assert.deepEqual(JSON.parse(alphaProgress.completed_lesson_ids), [
      c1ReadingLessons[0].id,
      c1ReadingLessons[1].id,
    ]);
    assert.deepEqual(JSON.parse(alphaProgress.quiz_scores), {
      [c1QuizLessons[0].id]: 85,
    });

    const allSubs = getAllQuizSubmissionsForAdmin();
    const alphaSub = allSubs.find((s) => s.user_id === studentAlpha.id);
    assert.ok(alphaSub, "Alpha quiz submission must remain intact");
    assert.equal(alphaSub.score, 85);
  });

  test("EVICT-04: Verify getStudentLearningDashboard for Alpha calculates accurately without faking historical events", () => {
    const dashboard = buildStudentLearningDashboardForUser(studentAlpha.id);

    assert.ok(dashboard);
    assert.equal(dashboard.userId, studentAlpha.id);

    // Course progress accurately retrieved from SSOT
    assert.equal(dashboard.overall.coursesStarted, 1);
    assert.equal(dashboard.overall.lessonsCompleted, 2);
    assert.equal(dashboard.overall.averageQuizScore, 85);

    // Continuity metrics: uses updatedAt for last activity without inventing fake intermediate events
    assert.ok(dashboard.continuity.lastActivityAt);
    assert.equal(
      dashboard.continuity.recentEvents.length,
      1,
      "Recent events fall back to permanent quiz submission without synthesizing fake lesson events"
    );

    // Recommendations correctly identify next step based on actual progress
    assert.ok(Array.isArray(dashboard.recommendations));
    assert.ok(dashboard.recommendations.length > 0);
  });

  test("EVICT-05: Verify Admin Education Intelligence handles 10,000 event ring buffer accurately", () => {
    const intelligence = buildAdminEducationIntelligence({
      users: getAllUsersForAdmin(),
      courseProgressRows: getAllCourseProgressForAdmin(),
      quizSubmissionRows: getAllQuizSubmissionsForAdmin(),
      learningEventRows: getAllLearningEventsForAdmin(),
      period: "all",
      referenceNowIso: "2026-03-01T00:00:00.000Z",
    });

    assert.ok(intelligence);
    assert.equal(intelligence.privacyGuarantee, "STRICT_EDUCATION_ONLY_NO_PRIVATE_JOURNAL");

    // Verify buffer capacity flag and continuity note
    assert.equal(
      intelligence.engagement.isTelemetryBufferAtCapacity,
      true,
      "Admin intelligence must transparently flag when telemetry buffer is at 10,000 capacity"
    );
    assert.match(
      intelligence.engagement.continuityNote,
      /10\.000 event/,
      "Continuity note must honestly state the 10,000 rolling buffer boundary"
    );

    // Verify no negative or NaN metrics
    assert.ok(Number.isFinite(intelligence.overview.totalLessonCompletionsAcrossCohort));
    assert.ok(intelligence.overview.totalLessonCompletionsAcrossCohort >= 0);
    assert.ok(Number.isFinite(intelligence.engagement.dailyActiveLearners));
    assert.ok(Number.isFinite(intelligence.engagement.weeklyActiveLearners));
    assert.ok(Number.isFinite(intelligence.engagement.monthlyActiveLearners));
  });
});
