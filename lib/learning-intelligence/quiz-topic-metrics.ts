import type { CourseCategory } from "../types";
import type {
  CategoryMasterySummary,
  LearningDataStatus,
  StudentQuizIntelligenceSummary,
  TopicMasteryLevel,
  TopicMasteryMetric,
} from "./types";
import {
  roundToOneDecimal,
  type NormalizedCurriculumCatalog,
  type NormalizedQuizSubmissionRecord,
  type NormalizedUserProgressRecord,
} from "./progress-normalizer";

const CANONICAL_CATEGORIES: CourseCategory[] = [
  "Trading Foundation",
  "Technical Analysis",
  "Market Structure",
  "Risk & Psychology",
  "Specialized Asset",
];

function classifyMasteryLevel(
  attemptsCount: number,
  bestScore: number | null,
  averageScore: number | null,
  passingScore: number
): TopicMasteryLevel {
  if (attemptsCount === 0 || bestScore === null || averageScore === null) {
    return "NO_DATA";
  }
  if (bestScore < passingScore || averageScore < 70) {
    return "NEEDS_PRACTICE";
  }
  if (averageScore >= 85) {
    return "MASTERED";
  }
  return "DEVELOPING";
}

export function computeStudentQuizAndTopicMastery(params: {
  catalog: NormalizedCurriculumCatalog;
  userProgressRows: NormalizedUserProgressRecord[];
  userQuizSubmissions: NormalizedQuizSubmissionRecord[];
}): StudentQuizIntelligenceSummary {
  const { catalog, userProgressRows, userQuizSubmissions } = params;

  const progressBySlug = new Map<string, NormalizedUserProgressRecord>();
  for (const p of userProgressRows) {
    progressBySlug.set(p.courseSlug.toLowerCase(), p);
  }

  // Group submissions by (courseSlug, lessonId) in chronological order
  const subsByCourseAndLesson = new Map<string, NormalizedQuizSubmissionRecord[]>();
  for (const sub of userQuizSubmissions) {
    const key = `${sub.courseSlug.toLowerCase()}::${sub.lessonId}`;
    const list = subsByCourseAndLesson.get(key) || [];
    list.push(sub);
    subsByCourseAndLesson.set(key, list);
  }

  const topics: TopicMasteryMetric[] = [];
  let totalAttempts = 0;
  let totalScoreSum = 0;
  let passedSubmissionsCount = 0;
  let uniqueQuizzesAttempted = 0;

  for (const meta of catalog.quizLessons) {
    const { course, module: mod, lesson } = meta;
    const key = `${course.slug.toLowerCase()}::${lesson.id}`;
    const subs = subsByCourseAndLesson.get(key) || [];
    const prog = progressBySlug.get(course.slug.toLowerCase());
    const fallbackProgScore =
      prog && typeof prog.quizScores[lesson.id] === "number"
        ? prog.quizScores[lesson.id]
        : null;

    const passingScore =
      typeof lesson.passingScore === "number" ? lesson.passingScore : 70;

    let attemptsCount = subs.length;
    let averageScore: number | null = null;
    let latestScore: number | null = null;
    let bestScore: number | null = null;
    let improvementDelta: number | null = null;
    let lastAttemptAt: string | null = null;

    if (subs.length > 0) {
      uniqueQuizzesAttempted += 1;
      const scores = subs.map((s) => s.score);
      const sum = scores.reduce((a, b) => a + b, 0);
      averageScore = roundToOneDecimal(sum / subs.length);
      latestScore = scores[scores.length - 1];
      bestScore = Math.max(...scores);
      if (fallbackProgScore !== null && fallbackProgScore > bestScore) {
        bestScore = fallbackProgScore;
      }
      if (subs.length >= 2) {
        improvementDelta = roundToOneDecimal(scores[scores.length - 1] - scores[0]);
      }
      lastAttemptAt = subs[subs.length - 1].createdAt;

      totalAttempts += subs.length;
      totalScoreSum += sum;
      passedSubmissionsCount += subs.filter((s) => s.score >= passingScore).length;
    } else if (fallbackProgScore !== null) {
      // Historical quiz_scores entry in course_progress without a matching quiz_submissions row
      attemptsCount = 1;
      uniqueQuizzesAttempted += 1;
      averageScore = fallbackProgScore;
      latestScore = fallbackProgScore;
      bestScore = fallbackProgScore;
      lastAttemptAt = prog?.updatedAt || null;

      totalAttempts += 1;
      totalScoreSum += fallbackProgScore;
      if (fallbackProgScore >= passingScore) {
        passedSubmissionsCount += 1;
      }
    }

    const masteryLevel = classifyMasteryLevel(
      attemptsCount,
      bestScore,
      averageScore,
      passingScore
    );
    const isPassed = bestScore !== null && bestScore >= passingScore;
    const isWeakTopic = masteryLevel === "NEEDS_PRACTICE";
    const dataStatus: LearningDataStatus =
      attemptsCount === 0
        ? "NO_DATA"
        : attemptsCount === 1
          ? "INSUFFICIENT_DATA"
          : "AVAILABLE";

    topics.push({
      topicId: `${course.slug}:${mod.id}:${lesson.id}`,
      topicTitle: `${mod.title} — ${lesson.title}`,
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      category: course.category,
      moduleId: mod.id,
      moduleTitle: mod.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      passingScore,
      attemptsCount,
      averageScore,
      latestScore,
      bestScore,
      improvementDelta,
      isPassed,
      isWeakTopic,
      masteryLevel,
      dataStatus,
      lastAttemptAt,
      actionUrl: `/kelas/${course.slug}?lesson=${encodeURIComponent(lesson.id)}`,
    });
  }

  // Category-level aggregation
  const categorySummaries: CategoryMasterySummary[] = CANONICAL_CATEGORIES.map(
    (category) => {
      const catTopics = topics.filter((t) => t.category === category);
      const activeTopics = catTopics.filter((t) => t.attemptsCount > 0);
      const catAttempts = activeTopics.reduce((acc, t) => acc + t.attemptsCount, 0);

      let avgScore: number | null = null;
      let masteryLevel: TopicMasteryLevel = "NO_DATA";
      let dataStatus: LearningDataStatus = "NO_DATA";

      if (activeTopics.length > 0) {
        const weightedSum = activeTopics.reduce(
          (acc, t) => acc + (t.averageScore ?? 0) * t.attemptsCount,
          0
        );
        avgScore = roundToOneDecimal(weightedSum / catAttempts);
        const minBest = Math.min(...activeTopics.map((t) => t.bestScore ?? 0));
        masteryLevel = classifyMasteryLevel(catAttempts, minBest, avgScore, 70);
        dataStatus = catAttempts >= 2 ? "AVAILABLE" : "INSUFFICIENT_DATA";
      }

      return {
        category,
        topicsWithDataCount: activeTopics.length,
        totalTopicsCount: catTopics.length,
        attemptsCount: catAttempts,
        averageScore: avgScore,
        masteryLevel,
        dataStatus,
      };
    }
  );

  const overallAverageScore =
    totalAttempts > 0 ? roundToOneDecimal(totalScoreSum / totalAttempts) : null;
  const passRate =
    totalAttempts > 0
      ? roundToOneDecimal((passedSubmissionsCount / totalAttempts) * 100)
      : null;

  const weakTopicsCount = topics.filter((t) => t.isWeakTopic).length;
  const masteredTopicsCount = topics.filter(
    (t) => t.masteryLevel === "MASTERED"
  ).length;

  const summaryStatus: LearningDataStatus =
    totalAttempts === 0
      ? "NO_DATA"
      : totalAttempts < 2
        ? "INSUFFICIENT_DATA"
        : "AVAILABLE";

  return {
    dataStatus: summaryStatus,
    totalAttempts,
    uniqueQuizzesAttempted,
    totalAvailableQuizzes: catalog.quizLessons.length,
    averageScore: overallAverageScore,
    passRate,
    weakTopicsCount,
    masteredTopicsCount,
    topics,
    categorySummaries,
  };
}

