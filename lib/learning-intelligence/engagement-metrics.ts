import type { DbLearningEvent } from "../db";
import type {
  DailyLearningActivityBucket,
  StudentLearningContinuityMetrics,
} from "./types";
import type {
  NormalizedCurriculumCatalog,
  NormalizedQuizSubmissionRecord,
  NormalizedUserProgressRecord,
} from "./progress-normalizer";

const DAY_MS = 86_400_000;

function toUtcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function parseUtcDateKeyToMidnightMs(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00.000Z`);
}

export function computeStudentContinuityMetrics(params: {
  catalog: NormalizedCurriculumCatalog;
  userProgressRows: NormalizedUserProgressRecord[];
  userQuizSubmissions: NormalizedQuizSubmissionRecord[];
  userEvents: DbLearningEvent[];
  referenceNowIso?: string;
}): StudentLearningContinuityMetrics {
  const {
    catalog,
    userProgressRows,
    userQuizSubmissions,
    userEvents,
    referenceNowIso,
  } = params;

  const nowMs =
    referenceNowIso && !Number.isNaN(Date.parse(referenceNowIso))
      ? Date.parse(referenceNowIso)
      : Date.now();
  const todayUtcKey = toUtcDateKey(nowMs);
  const todayMidnightMs = parseUtcDateKeyToMidnightMs(todayUtcKey);

  // Collect all valid qualifying timestamps and daily buckets without fabricating history
  const activeDatesSet = new Set<string>();
  const timestampsMs: number[] = [];

  const dailyBucketsMap = new Map<
    string,
    { eventsCount: number; lessonsCompletedCount: number; quizzesSubmittedCount: number }
  >();

  // Initialize 7-day timeline (from today - 6 days to today)
  for (let i = 6; i >= 0; i--) {
    const key = toUtcDateKey(todayMidnightMs - i * DAY_MS);
    dailyBucketsMap.set(key, {
      eventsCount: 0,
      lessonsCompletedCount: 0,
      quizzesSubmittedCount: 0,
    });
  }

  // Track quiz submissions already represented in learning_events so we don't double-count
  const quizEventKeys = new Set<string>();

  for (const ev of userEvents) {
    if (!ev || typeof ev.created_at !== "string") continue;
    const ms = Date.parse(ev.created_at);
    if (!Number.isFinite(ms) || ms <= 0 || ms > nowMs + DAY_MS) continue;
    const dateKey = toUtcDateKey(ms);
    activeDatesSet.add(dateKey);
    timestampsMs.push(ms);

    if (ev.event_type === "QUIZ_SUBMITTED" && ev.lesson_id) {
      quizEventKeys.add(`${ev.course_slug.toLowerCase()}::${ev.lesson_id}::${dateKey}`);
    }

    const bucket = dailyBucketsMap.get(dateKey);
    if (bucket) {
      bucket.eventsCount += 1;
      if (ev.event_type === "LESSON_COMPLETED") {
        bucket.lessonsCompletedCount += 1;
      } else if (ev.event_type === "QUIZ_SUBMITTED") {
        bucket.quizzesSubmittedCount += 1;
      }
    }
  }

  for (const sub of userQuizSubmissions) {
    if (sub.createdAtMs <= 0 || sub.createdAtMs > nowMs + DAY_MS) continue;
    const dateKey = toUtcDateKey(sub.createdAtMs);
    activeDatesSet.add(dateKey);
    timestampsMs.push(sub.createdAtMs);

    const dedupKey = `${sub.courseSlug.toLowerCase()}::${sub.lessonId}::${dateKey}`;
    const bucket = dailyBucketsMap.get(dateKey);
    if (bucket && !quizEventKeys.has(dedupKey)) {
      bucket.eventsCount += 1;
      bucket.quizzesSubmittedCount += 1;
    }
  }

  for (const prog of userProgressRows) {
    const ms = Date.parse(prog.updatedAt);
    if (Number.isFinite(ms) && ms > 0 && ms <= nowMs + DAY_MS) {
      const dateKey = toUtcDateKey(ms);
      if (!activeDatesSet.has(dateKey)) {
        activeDatesSet.add(dateKey);
        const bucket = dailyBucketsMap.get(dateKey);
        if (bucket) {
          bucket.eventsCount += 1;
        }
      }
      timestampsMs.push(ms);
    }
  }

  const weeklyActivityTimeline: DailyLearningActivityBucket[] = Array.from(
    dailyBucketsMap.entries()
  ).map(([dateUtc, counts]) => ({
    dateUtc,
    eventsCount: counts.eventsCount,
    lessonsCompletedCount: counts.lessonsCompletedCount,
    quizzesSubmittedCount: counts.quizzesSubmittedCount,
  }));

  if (timestampsMs.length === 0) {
    return {
      dataStatus: "NO_DATA",
      lastActivityAt: null,
      inactiveDays: null,
      activeDaysLast7d: 0,
      activeDaysLast30d: 0,
      currentStreakDays: null,
      longestStreakDays: null,
      streakDataStatus: "NO_DATA",
      recentEvents: [],
      weeklyActivityTimeline,
    };
  }

  const maxMs = Math.max(...timestampsMs);
  const lastActivityAt = new Date(maxMs).toISOString();
  const inactiveDays = Math.max(0, Math.floor((nowMs - maxMs) / DAY_MS));

  const sortedDateKeys = Array.from(activeDatesSet).sort();
  let activeDaysLast7d = 0;
  let activeDaysLast30d = 0;

  for (const dk of sortedDateKeys) {
    const dMs = parseUtcDateKeyToMidnightMs(dk);
    const diffDays = Math.round((todayMidnightMs - dMs) / DAY_MS);
    if (diffDays >= 0 && diffDays < 7) activeDaysLast7d += 1;
    if (diffDays >= 0 && diffDays < 30) activeDaysLast30d += 1;
  }

  // Calculate streaks across sorted unique UTC dates
  let longestStreakDays = 0;
  let runningStreak = 0;
  let prevMidnightMs: number | null = null;

  for (const dk of sortedDateKeys) {
    const dMs = parseUtcDateKeyToMidnightMs(dk);
    if (prevMidnightMs === null) {
      runningStreak = 1;
    } else {
      const gapDays = Math.round((dMs - prevMidnightMs) / DAY_MS);
      if (gapDays === 1) {
        runningStreak += 1;
      } else if (gapDays > 1) {
        runningStreak = 1;
      }
    }
    if (runningStreak > longestStreakDays) {
      longestStreakDays = runningStreak;
    }
    prevMidnightMs = dMs;
  }

  // Current streak is valid if the learner was active today or yesterday (UTC)
  const latestDateKey = sortedDateKeys[sortedDateKeys.length - 1];
  const latestDateMidnightMs = parseUtcDateKeyToMidnightMs(latestDateKey);
  const daysSinceLatestDate = Math.round(
    (todayMidnightMs - latestDateMidnightMs) / DAY_MS
  );
  let currentStreakDays = 0;
  if (daysSinceLatestDate <= 1) {
    currentStreakDays = 1;
    for (let i = sortedDateKeys.length - 2; i >= 0; i--) {
      const currMs = parseUtcDateKeyToMidnightMs(sortedDateKeys[i + 1]);
      const prevMs = parseUtcDateKeyToMidnightMs(sortedDateKeys[i]);
      if (Math.round((currMs - prevMs) / DAY_MS) === 1) {
        currentStreakDays += 1;
      } else {
        break;
      }
    }
  }

  // Build recent events feed (combining explicit learning_events and quiz_submissions if no event existed)
  const recentFeed: StudentLearningContinuityMetrics["recentEvents"] = [];
  const seenFeedKeys = new Set<string>();

  for (const ev of [...userEvents].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  )) {
    const course = catalog.allCoursesBySlug.get(ev.course_slug.toLowerCase());
    const lessonMeta = ev.lesson_id
      ? catalog.lessonsByCourseAndId.get(
          `${ev.course_slug.toLowerCase()}::${ev.lesson_id}`
        )
      : undefined;
    const dedup = `${ev.event_type}:${ev.course_slug}:${ev.lesson_id || ""}:${ev.created_at.slice(0, 16)}`;
    if (seenFeedKeys.has(dedup)) continue;
    seenFeedKeys.add(dedup);

    recentFeed.push({
      id: ev.id,
      eventType: ev.event_type,
      courseSlug: ev.course_slug,
      courseTitle: course?.title || ev.course_slug,
      lessonId: ev.lesson_id,
      lessonTitle: lessonMeta?.lesson.title || null,
      score: ev.score,
      createdAt: ev.created_at,
    });
  }

  for (const sub of [...userQuizSubmissions].reverse()) {
    const dedup = `QUIZ_SUBMITTED:${sub.courseSlug}:${sub.lessonId}:${sub.createdAt.slice(0, 16)}`;
    if (seenFeedKeys.has(dedup)) continue;
    seenFeedKeys.add(dedup);
    const course = catalog.allCoursesBySlug.get(sub.courseSlug.toLowerCase());
    const lessonMeta = catalog.lessonsByCourseAndId.get(
      `${sub.courseSlug.toLowerCase()}::${sub.lessonId}`
    );
    recentFeed.push({
      id: `sub_${sub.id}`,
      eventType: "QUIZ_SUBMITTED",
      courseSlug: sub.courseSlug,
      courseTitle: course?.title || sub.courseSlug,
      lessonId: sub.lessonId,
      lessonTitle: lessonMeta?.lesson.title || sub.lessonId,
      score: sub.score,
      createdAt: sub.createdAt,
    });
  }

  recentFeed.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return {
    dataStatus: "AVAILABLE",
    lastActivityAt,
    inactiveDays,
    activeDaysLast7d,
    activeDaysLast30d,
    currentStreakDays,
    longestStreakDays,
    streakDataStatus: "AVAILABLE",
    recentEvents: recentFeed.slice(0, 12),
    weeklyActivityTimeline,
  };
}
