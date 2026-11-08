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
  upsertCustomCourse,
  getAllUsersForAdmin,
  getAllCourseProgressForAdmin,
  getAllQuizSubmissionsForAdmin,
  getAllLearningEventsForAdmin,
} = await import("../lib/db.ts");

const {
  getCourseBySlug,
} = await import("../lib/courses-data.ts");

const {
  buildStudentLearningDashboardForUser,
  buildAdminEducationIntelligence,
  MIN_SAFE_COHORT_SIZE,
} = await import("../lib/learning-intelligence/index.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

describe("Sprint 4 — Learning Intelligence Engine & Cohort Analytics Suite", () => {
  const dataDir = path.join(process.cwd(), "data");
  const isolatedDbFile = path.join(
    dataDir,
    `academy.test.s4.engine.${process.pid}.${Date.now()}.json`
  );

  const FIXED_NOW_ISO = "2026-04-08T12:00:00.000Z";

  const c1 = getCourseBySlug("trading-fundamentals");
  const c3 = getCourseBySlug("market-structure");
  const c1Lessons = c1.modules.flatMap((m) => m.lessons);
  const c3Lessons = c3.modules.flatMap((m) => m.lessons);
  const c1QuizLessons = c1Lessons.filter((l) => l.type === "quiz");
  const c3QuizLessons = c3Lessons.filter((l) => l.type === "quiz");
  const c1QuizLesson = c1QuizLessons[0] || c1Lessons[c1Lessons.length - 1];
  const c3QuizLesson = c3QuizLessons[0] || c3Lessons[c3Lessons.length - 1];

  const studentZero = {
    id: "stu_s4_zero",
    email: "zero@student.casper",
    name: "Zero Progress Student",
    role: "USER",
    password_hash: "scrypt$mock",
    created_at: "2026-03-16T08:00:00.000Z", // W12
  };
  const studentPartial = {
    id: "stu_s4_partial",
    email: "partial@student.casper",
    name: "Partial Student",
    role: "USER",
    password_hash: "scrypt$mock",
    created_at: "2026-03-16T09:00:00.000Z", // W12
  };
  const studentFailedQuiz = {
    id: "stu_s4_failed_quiz",
    email: "failedquiz@student.casper",
    name: "Failed Quiz Student",
    role: "USER",
    password_hash: "scrypt$mock",
    created_at: "2026-03-17T10:00:00.000Z", // W12
  };
  const studentCompleted = {
    id: "stu_s4_completed",
    email: "completed@student.casper",
    name: "Completed Student",
    role: "USER",
    password_hash: "scrypt$mock",
    created_at: "2026-03-18T10:00:00.000Z", // W12
  };
  const adminActor = {
    id: "adm_s4_main",
    email: "apriyanriyan23@gmail.com",
    name: "Master Admin",
    role: "ADMIN",
    password_hash: "scrypt$mock",
    created_at: "2026-01-01T00:00:00.000Z",
  };

  before(() => {
    const initialDb = {
      users: [
        studentZero,
        studentPartial,
        studentFailedQuiz,
        studentCompleted,
        adminActor,
      ],
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

  test("LIE-01: Student with zero progress returns NO_DATA status and 0% metrics without NaN", () => {
    const report = buildStudentLearningDashboardForUser(studentZero.id, FIXED_NOW_ISO);

    assert.equal(report.userId, studentZero.id);
    assert.equal(report.overall.dataStatus, "NO_DATA");
    assert.equal(report.overall.coursesStarted, 0);
    assert.equal(report.overall.coursesCompleted, 0);
    assert.equal(report.overall.coursesInProgress, 0);
    assert.equal(report.overall.lessonsCompleted, 0);
    assert.equal(report.overall.overallLessonCompletionRate, 0);
    assert.equal(report.overall.certificatesEarnedCount, 0);
    assert.ok(report.overall.totalPublishedCourses >= 9);
    assert.ok(report.overall.totalAvailableLessons > 0);
    assert.equal(report.quizIntelligence.dataStatus, "NO_DATA");
    assert.equal(report.quizIntelligence.averageScore, null);
    assert.equal(report.continuity.dataStatus, "NO_DATA");
    assert.equal(report.continuity.currentStreakDays, null);
    assert.equal(report.continuity.weeklyActivityTimeline.length, 7);
  });

  test("LIE-02: Student with started course and partial lesson completion calculates exact percentage and resume target", () => {
    const firstTwoIds = c3Lessons.slice(0, 2).map((l) => l.id);
    const thirdLessonId = c3Lessons[2].id;

    upsertUserProgress({
      id: "prog_partial_c3",
      userId: studentPartial.id,
      courseSlug: "market-structure",
      completedLessonIds: firstTwoIds,
      quizScores: {},
      lastLessonId: thirdLessonId,
    });

    const report = buildStudentLearningDashboardForUser(studentPartial.id, FIXED_NOW_ISO);
    assert.equal(report.overall.dataStatus, "AVAILABLE");
    assert.equal(report.overall.coursesStarted, 1);
    assert.equal(report.overall.coursesInProgress, 1);
    assert.equal(report.overall.coursesCompleted, 0);
    assert.equal(report.overall.lessonsCompleted, 2);

    const msCourse = report.courseProgress.find((c) => c.courseSlug === "market-structure");
    assert.ok(msCourse);
    assert.equal(msCourse.status, "IN_PROGRESS");
    assert.equal(msCourse.completedLessonsCount, 2);
    assert.equal(msCourse.totalEligibleLessons, c3Lessons.length);
    assert.equal(
      msCourse.completionPercentage,
      Math.round((2 / c3Lessons.length) * 100)
    );
    assert.equal(msCourse.isEligibleForCertificate, false);
    assert.equal(msCourse.nextEligibleLessonId, thirdLessonId);
    assert.equal(msCourse.continueUrl, `/kelas/market-structure?lesson=${thirdLessonId}`);
  });

  test("LIE-03: Student with 100% lessons completed but failed required quiz (< 70%) stays IN_PROGRESS and certificate ineligible", () => {
    const allC3Ids = c3Lessons.map((l) => l.id);
    recordQuizSubmission({
      id: "qsub_fail_1",
      userId: studentFailedQuiz.id,
      courseSlug: "market-structure",
      lessonId: c3QuizLesson.id,
      score: 50,
      answers: { q1: 1, q2: 0 },
    });
    upsertUserProgress({
      id: "prog_fail_c3",
      userId: studentFailedQuiz.id,
      courseSlug: "market-structure",
      completedLessonIds: allC3Ids,
      quizScores: { [c3QuizLesson.id]: 50 },
      lastLessonId: c3QuizLesson.id,
    });

    const report = buildStudentLearningDashboardForUser(
      studentFailedQuiz.id,
      FIXED_NOW_ISO
    );
    const msCourse = report.courseProgress.find((c) => c.courseSlug === "market-structure");
    assert.ok(msCourse);
    assert.ok(msCourse.completionPercentage < 100);
    assert.equal(msCourse.allQuizzesPassed, false);
    assert.equal(msCourse.status, "IN_PROGRESS");
    assert.equal(msCourse.isEligibleForCertificate, false);
    assert.equal(report.overall.coursesCompleted, 0);
    assert.equal(report.overall.certificatesEarnedCount, 0);
  });

  test("LIE-04: Student with completed lessons AND passed required quiz (>= 70%) achieves COMPLETED and certificate eligibility", () => {
    const allC3Ids = c3Lessons.map((l) => l.id);
    const passedScores = {};
    for (const ql of c3QuizLessons) {
      passedScores[ql.id] = 100;
      const perfectAnswers = {};
      for (const q of ql.quiz || []) {
        perfectAnswers[q.id] = q.correctAnswer;
      }
      recordQuizSubmission({
        id: `qsub_pass_${ql.id}`,
        userId: studentCompleted.id,
        courseSlug: "market-structure",
        lessonId: ql.id,
        score: 100,
        answers: perfectAnswers,
      });
    }

    upsertUserProgress({
      id: "prog_pass_c3",
      userId: studentCompleted.id,
      courseSlug: "market-structure",
      completedLessonIds: allC3Ids,
      quizScores: passedScores,
      lastLessonId: c3QuizLesson.id,
      completedAt: "2026-04-07T15:00:00.000Z",
    });

    const report = buildStudentLearningDashboardForUser(
      studentCompleted.id,
      FIXED_NOW_ISO
    );
    const msCourse = report.courseProgress.find((c) => c.courseSlug === "market-structure");
    assert.ok(msCourse);
    assert.equal(msCourse.completionPercentage, 100);
    assert.equal(msCourse.allQuizzesPassed, true);
    assert.equal(msCourse.status, "COMPLETED");
    assert.equal(msCourse.isEligibleForCertificate, true);
    assert.equal(report.overall.coursesCompleted, 1);
    assert.equal(report.overall.certificatesEarnedCount, 1);
  });

  test("LIE-05 & LIE-06: Multiple quiz attempts, retry calculation, weak topic (<70%) and strong topic (>=85%) classification", () => {
    // Second attempt on market-structure quiz for studentFailedQuiz (60% -> avg 55% < 70%)
    recordQuizSubmission({
      id: "qsub_fail_2",
      userId: studentFailedQuiz.id,
      courseSlug: "market-structure",
      lessonId: c3QuizLesson.id,
      score: 60,
      answers: { q1: 1, q2: 1 },
    });
    upsertUserProgress({
      id: "prog_fail_c3",
      userId: studentFailedQuiz.id,
      courseSlug: "market-structure",
      completedLessonIds: c3Lessons.map((l) => l.id),
      quizScores: { [c3QuizLesson.id]: 60 },
      lastLessonId: c3QuizLesson.id,
    });

    // Strong quiz on trading-fundamentals (90% >= 85%)
    recordQuizSubmission({
      id: "qsub_strong_c1",
      userId: studentFailedQuiz.id,
      courseSlug: "trading-fundamentals",
      lessonId: c1QuizLesson.id,
      score: 90,
      answers: { q1: 1 },
    });
    upsertUserProgress({
      id: "prog_strong_c1",
      userId: studentFailedQuiz.id,
      courseSlug: "trading-fundamentals",
      completedLessonIds: [c1Lessons[0].id, c1QuizLesson.id],
      quizScores: { [c1QuizLesson.id]: 90 },
      lastLessonId: c1QuizLesson.id,
    });

    const report = buildStudentLearningDashboardForUser(
      studentFailedQuiz.id,
      FIXED_NOW_ISO
    );
    const qi = report.quizIntelligence;

    assert.equal(qi.totalAttempts, 3);
    assert.equal(qi.uniqueQuizzesAttempted, 2);
    assert.equal(qi.weakTopicsCount, 1);
    assert.equal(qi.masteredTopicsCount, 1);

    const msTopic = qi.topics.find(
      (t) => t.courseSlug === "market-structure" && t.lessonId === c3QuizLesson.id
    );
    assert.ok(msTopic);
    assert.equal(msTopic.attemptsCount, 2);
    assert.equal(msTopic.latestScore, 60);
    assert.equal(msTopic.bestScore, 60);
    assert.equal(msTopic.averageScore, 55);
    assert.equal(msTopic.improvementDelta, 10);
    assert.equal(msTopic.isWeakTopic, true);
    assert.equal(msTopic.masteryLevel, "NEEDS_PRACTICE");

    const c1Topic = qi.topics.find(
      (t) => t.courseSlug === "trading-fundamentals" && t.lessonId === c1QuizLesson.id
    );
    assert.ok(c1Topic);
    assert.equal(c1Topic.bestScore, 90);
    assert.equal(c1Topic.isPassed, true);
    assert.equal(c1Topic.masteryLevel, "MASTERED");
  });

  test("LIE-07: Active learning days, current streak, longest streak, and 7-day activity window", () => {
    recordLearningEvent({
      userId: studentCompleted.id,
      eventType: "LESSON_COMPLETED",
      courseId: c3.id,
      courseSlug: "market-structure",
      lessonId: c3Lessons[0].id,
      createdAt: "2026-04-06T10:00:00.000Z",
    });
    recordLearningEvent({
      userId: studentCompleted.id,
      eventType: "LESSON_COMPLETED",
      courseId: c3.id,
      courseSlug: "market-structure",
      lessonId: c3Lessons[1].id,
      createdAt: "2026-04-07T10:00:00.000Z",
    });
    recordLearningEvent({
      userId: studentCompleted.id,
      eventType: "QUIZ_SUBMITTED",
      courseId: c3.id,
      courseSlug: "market-structure",
      lessonId: c3QuizLesson.id,
      score: 100,
      createdAt: "2026-04-08T10:00:00.000Z",
    });

    const report = buildStudentLearningDashboardForUser(
      studentCompleted.id,
      FIXED_NOW_ISO
    );
    const cont = report.continuity;
    assert.equal(cont.dataStatus, "AVAILABLE");
    assert.ok(cont.currentStreakDays >= 3);
    assert.ok(cont.longestStreakDays >= 3);
    assert.equal(cont.activeDaysLast7d, 3);
    assert.equal(cont.weeklyActivityTimeline.length, 7);
    assert.equal(cont.weeklyActivityTimeline[6].dateUtc, "2026-04-08");
    assert.ok(cont.weeklyActivityTimeline[6].eventsCount >= 1);
  });

  test("LIE-08 & LIE-09: Draft/archived courses excluded from published denominators while preserving archived student history & handling changed course structure", () => {
    upsertCustomCourse({
      id: "custom-draft-s4",
      slug: "custom-draft-s4",
      number: "C10",
      title: "Draft Advanced Course",
      subtitle: "Draft only",
      category: "Market Structure",
      level: "Advanced",
      duration: "2 Jam",
      totalLessons: 1,
      status: "draft",
      overview: "Draft course",
      modules: [
        {
          id: "mod-d1",
          title: "Draft Mod",
          lessons: [
            { id: "d-101", title: "Draft L1", duration: "10m", type: "reading", summary: "s" },
          ],
        },
      ],
    });

    upsertCustomCourse({
      id: "custom-arch-s4",
      slug: "custom-arch-s4",
      number: "C11",
      title: "Archived Legacy Course",
      subtitle: "Legacy",
      category: "Trading Foundation",
      level: "Beginner",
      duration: "1 Jam",
      totalLessons: 2,
      status: "archived",
      overview: "Archived course",
      modules: [
        {
          id: "mod-a1",
          title: "Arch Mod",
          lessons: [
            { id: "a-101", title: "Arch L1", duration: "10m", type: "reading", summary: "s" },
            { id: "a-102", title: "Arch L2", duration: "10m", type: "reading", summary: "s" },
          ],
        },
      ],
    });

    // Student has progress on the archived course + stale lesson IDs on market-structure
    upsertUserProgress({
      id: "prog_arch_s4",
      userId: studentPartial.id,
      courseSlug: "custom-arch-s4",
      completedLessonIds: ["a-101", "stale-deleted-lesson"],
      quizScores: {},
      lastLessonId: "a-101",
    });

    const firstTwoIds = c3Lessons.slice(0, 2).map((l) => l.id);
    upsertUserProgress({
      id: "prog_partial_c3",
      userId: studentPartial.id,
      courseSlug: "market-structure",
      completedLessonIds: [...firstTwoIds, "deleted-lesson-id-999"],
      quizScores: {},
      lastLessonId: c3Lessons[2].id,
    });

    const report = buildStudentLearningDashboardForUser(
      studentPartial.id,
      FIXED_NOW_ISO
    );

    // Draft course must NOT appear in published courseProgress
    assert.ok(!report.courseProgress.some((c) => c.courseSlug === "custom-draft-s4"));

    // Archived course must NOT appear in published courseProgress, but MUST be preserved in archivedCourseHistory
    assert.ok(!report.courseProgress.some((c) => c.courseSlug === "custom-arch-s4"));
    const archHist = report.archivedCourseHistory.find(
      (c) => c.courseSlug === "custom-arch-s4"
    );
    assert.ok(archHist);

    // Stale lesson ID in market-structure ignored; valid completed count remains 2
    const msCourse = report.courseProgress.find((c) => c.courseSlug === "market-structure");
    assert.equal(msCourse.completedLessonsCount, 2);
  });

  test("LIE-10: Admin course completion, lesson drop-off, quiz/question difficulty, retention cohort, and small-cohort suppression", () => {
    const bundle = buildAdminEducationIntelligence({
      users: getAllUsersForAdmin(),
      courseProgressRows: getAllCourseProgressForAdmin(),
      quizSubmissionRows: getAllQuizSubmissionsForAdmin(),
      learningEventRows: getAllLearningEventsForAdmin(),
      period: "all",
      referenceNowIso: FIXED_NOW_ISO,
    });

    assert.equal(bundle.privacyGuarantee, "STRICT_EDUCATION_ONLY_NO_PRIVATE_JOURNAL");
    assert.equal(bundle.overview.totalRegisteredStudents, 4); // admin excluded from student denominator
    assert.equal(bundle.overview.studentsStartedAnyCourse, 3); // partial, failedQuiz, completed
    assert.equal(bundle.overview.studentsCompletedAtLeastOneCourse, 1); // studentCompleted

    const msPerf = bundle.courses.find((c) => c.courseSlug === "market-structure");
    assert.ok(msPerf);
    assert.equal(msPerf.startedStudentsCount, 3); // >= MIN_SAFE_COHORT_SIZE (3)
    assert.equal(msPerf.sampleSizeStatus, "AVAILABLE");
    assert.equal(msPerf.completedStudentsCount, 1);
    assert.equal(msPerf.completionRate, 33.3);
    assert.equal(msPerf.inProgressStudentsCount, 2);

    // Small cohort check: trading-fundamentals has only 1 student (< 3)
    const c1Perf = bundle.courses.find((c) => c.courseSlug === "trading-fundamentals");
    assert.ok(c1Perf);
    assert.equal(c1Perf.startedStudentsCount, 1);
    assert.ok(c1Perf.startedStudentsCount < MIN_SAFE_COHORT_SIZE);
    assert.equal(c1Perf.sampleSizeStatus, "INSUFFICIENT_DATA");

    // Lesson drop-off items
    const msLessons = bundle.lessons.filter((l) => l.courseSlug === "market-structure");
    assert.equal(msLessons.length, c3Lessons.length);
    assert.equal(msLessons[0].reachedStudentsCount, 3);
    assert.equal(msLessons[0].completedStudentsCount, 3);

    // Quiz & question difficulty intelligence
    assert.ok(bundle.quizzes.topicPerformance.length > 0);
    assert.ok(bundle.quizzes.allQuestionDifficulty.length > 0);
    // Verify no correctAnswer or correctOptionIndex is leaked in question difficulty
    for (const q of bundle.quizzes.allQuestionDifficulty) {
      assert.equal("correctAnswer" in q, false);
      assert.equal("correctOptionIndex" in q, false);
    }

    // Engagement & retention cohort
    assert.equal(bundle.engagement.funnel.registeredStudents, 4);
    assert.equal(bundle.engagement.funnel.startedAtLeastOneCourse, 3);
    assert.equal(bundle.engagement.funnel.completedAtLeastOneCourse, 1);
    assert.ok(bundle.engagement.retentionCohorts.length > 0);
    const totalCohortLearners = bundle.engagement.retentionCohorts.reduce(
      (sum, c) => sum + c.cohortSize,
      0
    );
    assert.equal(totalCohortLearners, 3);
  });
});
