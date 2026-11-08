import type { CourseCategory, CourseLevel } from "../types";
import type { LearningEventType } from "../db";

export type LearningDataStatus = "NO_DATA" | "INSUFFICIENT_DATA" | "AVAILABLE";

export type CourseLearningStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type TopicMasteryLevel =
  | "NO_DATA"
  | "NEEDS_PRACTICE"
  | "DEVELOPING"
  | "MASTERED";

export type RecommendationCategory =
  | "CONTINUE_LEARNING"
  | "REVIEW_WEAK_TOPIC"
  | "RETRY_QUIZ"
  | "NEXT_LESSON"
  | "START_FOUNDATION"
  | "RETURN_TO_LEARNING"
  | "ADVANCE_TO_NEXT_COURSE";

export type AdminTimePeriod = "7d" | "30d" | "90d" | "all";

export interface NormalizedCourseProgressItem {
  courseId: string;
  courseSlug: string;
  courseNumber: string;
  courseTitle: string;
  courseSubtitle: string;
  category: CourseCategory;
  level: CourseLevel;
  order: number;
  status: CourseLearningStatus;
  completedLessonsCount: number;
  totalEligibleLessons: number;
  remainingLessonsCount: number;
  completionPercentage: number;
  completedLessonIds: string[];
  hasQuiz: boolean;
  allQuizzesPassed: boolean;
  isEligibleForCertificate: boolean;
  latestQuizScore: number | null;
  bestQuizScore: number | null;
  lastAccessedLessonId: string | null;
  lastAccessedLessonTitle: string | null;
  nextEligibleLessonId: string | null;
  nextEligibleLessonTitle: string | null;
  continueUrl: string;
  startedAt: string | null;
  completedAt: string | null;
  latestActivityAt: string | null;
}

export interface StudentOverallLearningMetrics {
  dataStatus: LearningDataStatus;
  totalPublishedCourses: number;
  coursesStarted: number;
  coursesCompleted: number;
  coursesInProgress: number;
  coursesNotStarted: number;
  startedCourseCompletionRate: number | null;
  totalAvailableLessons: number;
  lessonsCompleted: number;
  overallLessonCompletionRate: number | null;
  totalQuizSubmissions: number;
  averageQuizScore: number | null;
  quizScoreDataStatus: LearningDataStatus;
  certificatesEarnedCount: number;
}

export interface TopicMasteryMetric {
  topicId: string;
  topicTitle: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  category: CourseCategory;
  moduleId: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  passingScore: number;
  attemptsCount: number;
  averageScore: number | null;
  latestScore: number | null;
  bestScore: number | null;
  improvementDelta: number | null;
  isPassed: boolean;
  isWeakTopic: boolean;
  masteryLevel: TopicMasteryLevel;
  dataStatus: LearningDataStatus;
  lastAttemptAt: string | null;
  actionUrl: string;
}

export interface CategoryMasterySummary {
  category: CourseCategory;
  topicsWithDataCount: number;
  totalTopicsCount: number;
  attemptsCount: number;
  averageScore: number | null;
  masteryLevel: TopicMasteryLevel;
  dataStatus: LearningDataStatus;
}

export interface StudentQuizIntelligenceSummary {
  dataStatus: LearningDataStatus;
  totalAttempts: number;
  uniqueQuizzesAttempted: number;
  totalAvailableQuizzes: number;
  averageScore: number | null;
  passRate: number | null;
  weakTopicsCount: number;
  masteredTopicsCount: number;
  topics: TopicMasteryMetric[];
  categorySummaries: CategoryMasterySummary[];
}

export interface DailyLearningActivityBucket {
  dateUtc: string; // YYYY-MM-DD
  eventsCount: number;
  lessonsCompletedCount: number;
  quizzesSubmittedCount: number;
}

export interface StudentLearningContinuityMetrics {
  dataStatus: LearningDataStatus;
  lastActivityAt: string | null;
  inactiveDays: number | null;
  activeDaysLast7d: number;
  activeDaysLast30d: number;
  currentStreakDays: number | null;
  longestStreakDays: number | null;
  streakDataStatus: LearningDataStatus;
  recentEvents: Array<{
    id: string;
    eventType: LearningEventType;
    courseSlug: string;
    courseTitle: string;
    lessonId: string | null;
    lessonTitle: string | null;
    score: number | null;
    createdAt: string;
  }>;
  weeklyActivityTimeline: DailyLearningActivityBucket[];
}

export interface AdaptiveLearningRecommendation {
  recommendationId: string;
  type: RecommendationCategory;
  priority: number; // 1-100 deterministic score
  rank: number; // 1-based rank order
  courseId: string;
  courseSlug: string;
  courseNumber: string;
  courseTitle: string;
  moduleId: string | null;
  moduleTitle: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  shortTitle: string;
  explanation: string;
  evidenceSummary: string;
  evidenceSignature: string;
  actionLabel: string;
  destination: string;
  status: "ACTIVE" | "DISMISSED";
  generatedAt: string;
}

export interface StudentLearningDashboardReport {
  userId: string;
  generatedAt: string;
  overall: StudentOverallLearningMetrics;
  continueLearning: {
    hasActiveCourse: boolean;
    course: NormalizedCourseProgressItem | null;
    primaryCtaLabel: string;
    primaryCtaUrl: string;
  };
  recommendations: AdaptiveLearningRecommendation[];
  dismissedRecommendationsCount: number;
  courseProgress: NormalizedCourseProgressItem[];
  archivedCourseHistory: Array<{
    courseSlug: string;
    completedLessonsCount: number;
    updatedAt: string;
  }>;
  continuity: StudentLearningContinuityMetrics;
  quizIntelligence: StudentQuizIntelligenceSummary;
}

// ── Admin Education Intelligence Contracts ─────────────────────────

export interface AdminEducationOverviewMetrics {
  period: AdminTimePeriod;
  periodLabel: string;
  periodStartUtc: string | null;
  periodEndUtc: string;
  minSafeCohortThreshold: number;
  smallCohortProtected: boolean;
  totalRegisteredStudents: number;
  studentsStartedAnyCourse: number;
  activeStudentsInPeriod: number;
  studentsCompletedAtLeastOneCourse: number;
  overallCourseStartRate: number | null;
  startedToCompletedConversionRate: number | null;
  totalLessonCompletionsAcrossCohort: number;
  totalQuizSubmissionsInPeriod: number;
  aggregateQuizAverageScore: number | null;
  aggregateQuizPassRate: number | null;
  quizDataStatus: LearningDataStatus;
  courseCompletionDistribution: {
    completedZeroCourses: number;
    completedOneToTwoCourses: number;
    completedThreeOrMoreCourses: number;
  };
}

export interface AdminCoursePerformanceItem {
  courseId: string;
  courseSlug: string;
  courseNumber: string;
  courseTitle: string;
  category: CourseCategory;
  level: CourseLevel;
  totalLessons: number;
  startedStudentsCount: number;
  completedStudentsCount: number;
  inProgressStudentsCount: number;
  completionRate: number | null; // completed / started * 100
  averageLessonCompletionPercentage: number | null;
  quizSubmissionsCount: number;
  quizAverageScore: number | null;
  quizPassRate: number | null;
  highestDropOffLessonId: string | null;
  highestDropOffLessonTitle: string | null;
  highestNotYetProceededRate: number | null;
  sampleSizeStatus: LearningDataStatus;
  needsContentAttention: boolean;
  attentionReason: string | null;
}

export interface AdminLessonDropOffItem {
  courseId: string;
  courseSlug: string;
  courseNumber: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  lessonId: string;
  lessonTitle: string;
  lessonType: string;
  lessonIndex: number; // 1-based within course
  reachedStudentsCount: number;
  completedStudentsCount: number;
  proceededToNextCount: number | null;
  completionRate: number | null; // completed / reached * 100
  notYetProceededCount: number; // reached - completed
  notYetProceededRate: number | null; // (reached - completed) / reached * 100
  sampleSize: number;
  sampleStatus: LearningDataStatus;
  statusLabel: string; // e.g. "Lancar", "Perlu Perhatian (Belum Melanjutkan)", "Sampel Kecil"
}

export interface AdminQuestionDifficultyItem {
  courseSlug: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  questionId: string;
  questionText: string;
  attemptsCount: number;
  correctCount: number;
  successRate: number | null;
  difficultyStatus:
    | "INSUFFICIENT_SAMPLE"
    | "HIGH_DIFFICULTY"
    | "MODERATE_DIFFICULTY"
    | "WELL_UNDERSTOOD";
}

export interface AdminQuizTopicPerformanceItem {
  courseSlug: string;
  courseNumber: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  passingScore: number;
  participatingStudentsCount: number;
  totalSubmissionsCount: number;
  averageScore: number | null;
  passingRate: number | null;
  sampleStatus: LearningDataStatus;
}

export interface AdminQuizIntelligenceReport {
  period: AdminTimePeriod;
  dataStatus: LearningDataStatus;
  totalSubmissions: number;
  participatingStudentsCount: number;
  overallAverageScore: number | null;
  overallPassingRate: number | null;
  topicPerformance: AdminQuizTopicPerformanceItem[];
  lowSuccessQuestions: AdminQuestionDifficultyItem[];
  allQuestionDifficulty: AdminQuestionDifficultyItem[];
}

export interface AdminRetentionCohortItem {
  cohortKey: string; // e.g. "2026-W44"
  cohortSize: number;
  returnedLearnersCount: number | null; // null if suppressed for small cohort < 3
  retentionRate: number | null;
  smallCohortSuppressed: boolean;
  dataStatus: LearningDataStatus;
}

export interface AdminEngagementAndRetentionReport {
  period: AdminTimePeriod;
  dataStatus: LearningDataStatus;
  dailyActiveLearners: number;
  weeklyActiveLearners: number;
  monthlyActiveLearners: number;
  returningLearnersCount: number;
  returningLearnersRate: number | null;
  funnel: {
    registeredStudents: number;
    startedAtLeastOneCourse: number;
    completedAtLeastOneLesson: number;
    submittedAtLeastOneQuiz: number;
    completedAtLeastOneCourse: number;
  };
  inactivityDistribution: {
    activeLast7Days: number;
    inactive8To30Days: number;
    inactiveOver30Days: number;
    neverStarted: number;
  };
  retentionCohorts: AdminRetentionCohortItem[];
  continuityNote: string;
}

export interface AdminFullEducationIntelligenceBundle {
  privacyGuarantee: "STRICT_EDUCATION_ONLY_NO_PRIVATE_JOURNAL";
  generatedAt: string;
  overview: AdminEducationOverviewMetrics;
  courses: AdminCoursePerformanceItem[];
  lessons: AdminLessonDropOffItem[];
  quizzes: AdminQuizIntelligenceReport;
  engagement: AdminEngagementAndRetentionReport;
}

