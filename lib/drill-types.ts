/**
 * SIGNAL CASPER ACADEMY — SPRINT 5
 * Practical Learning & Interactive Drill Engine Types
 *
 * Formal data models for Drills, Immutable Submissions, Progress Projections,
 * Rubrics, and Pre-Session Checklists.
 */

export type DrillType =
  | "DIRECTION_BIAS"        // High timeframe order flow & bias analysis
  | "LEVEL_IDENTIFICATION"   // Key zone & liquidity pool identification
  | "SETUP_EXECUTION"       // Complete entry, invalidation, target & confirmation
  | "INVALIDATION_RISK";    // Invalidation placement & R:R feasibility analysis

export type DrillPublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface ChartPriceBounds {
  minPrice: number; // Lowest price visible on chart Y-axis
  maxPrice: number; // Highest price visible on chart Y-axis
  decimals: number; // Decimal precision (e.g. 2 for Gold, 0 for JPY)
}

export interface DrillModelAnswer {
  expectedBias: "BULLISH" | "BEARISH" | "SIDEWAYS_NEUTRAL";
  isNoTradeValid: boolean;
  validNoTradeReasons?: string[]; // e.g. ["LOW_RISK_REWARD", "MAJOR_NEWS_IMMINENT", "CHOPPY_RANGE"]
  
  // Numerical Zones (for Position Execution)
  entryZone: {
    min: number;
    max: number;
    ideal: number;
    tolerance: number; // e.g. ±1.50
  };
  invalidationPrice: {
    ideal: number;
    tolerance: number; // e.g. ±0.80
  };
  targetPrice: {
    ideal: number;
    tolerance: number; // e.g. ±2.50
  };
  minimumRiskRewardRatio: number; // e.g. 2.0 (1:2)
  
  // Structural confirmations & keywords
  requiredConfirmations: string[]; // e.g. ["LIQUIDITY_SWEEP", "M15_CHOC", "FVG_TAP"]
  validRationaleKeywords: string[]; // e.g. ["discount zone", "equal highs taken", "supply rejection"]
}

export type CriterionId =
  | "CRIT_BIAS"
  | "CRIT_ENTRY"
  | "CRIT_INVALID"
  | "CRIT_RR"
  | "CRIT_CONFIRM";

export interface DrillRubricCriterion {
  id: CriterionId;
  name: string;
  weight: number; // Total must sum exactly to 100 (20, 25, 25, 15, 15)
  minimumPassPoints?: number; // 18 for CRIT_INVALID
  description: string;
}

export interface DrillRubric {
  overallPassingScore: number; // Default 70
  invalidationSafetyGatePoints: number; // Default 18 (out of 25)
  criteria: DrillRubricCriterion[];
}

export interface DbDrillCase {
  id: string; // e.g. "drill_xauusd_c1_01"
  course_id: string; // "course_xauusd_basic"
  course_slug: string; // "xauusd-basic"
  lesson_id: string; // "c1-market-structure"
  title: string;
  slug: string;
  drill_type: DrillType;
  status: DrillPublicationStatus;
  
  // Dual Versioning
  drill_version: number; // Increments when model answer or price bounds change
  rubric_version: number; // Increments when weights or criteria change
  
  // Provenance & Transparency
  instrument: string; // "XAUUSD"
  timeframe: string; // "H1"
  data_period: string; // "2024-10-14 08:00 - 16:00 UTC"
  data_source: string; // "Institutional Tick History (Curated)"
  classification: "HISTORICAL_MARKET" | "SYNTHETIC_SIMULATION";
  timezone: string; // "UTC"
  transformation_notes: string; // e.g. "Asian session high highlighted; candle bodies unmodified"
  price_bounds: ChartPriceBounds;
  
  // Segregated Media Storage Paths (PNG & WebP only, zero SVG)
  draft_chart_path: string; // "data/drills/drafts/[id]/case_v1.webp" (Private)
  published_chart_url: string; // "/drills/published/[id]/v1/case.webp" (Public static)
  solution_overlay_path: string; // "data/drills/solutions/[id]/solution_v1.webp" (Private)
  
  // Prompts & Instructions
  context_prompt: string;
  instructions: string[];
  
  // Private Grading Secrets
  model_answer: DrillModelAnswer;
  rubric: DrillRubric;
  instructor_debrief: string;
  
  created_at: string;
  updated_at: string;
}

export interface StudentDrillAnswer {
  bias: "BULLISH" | "BEARISH" | "SIDEWAYS_NEUTRAL";
  isNoTrade: boolean;
  noTradeReason?: string;
  
  entryPrice?: number;
  invalidationPrice?: number;
  targetPrice?: number;
  calculatedRiskReward?: number;
  
  // Chart interaction coordinates (normalized 0.0 - 1.0)
  clickedCoordinates?: {
    entry?: { x: number; y: number };
    invalidation?: { x: number; y: number };
    target?: { x: number; y: number };
  };
  
  selectedConfirmations: string[];
  rationaleText: string;
}

export type CriterionCreditStatus = "FULL_CREDIT" | "PARTIAL_CREDIT" | "ZERO_CREDIT";

export interface CriterionEvaluationResult {
  criterionId: CriterionId;
  criterionName: string;
  pointsPossible: number;
  pointsEarned: number;
  status: CriterionCreditStatus;
  explanation: string;
}

export type DrillEvaluationStatus = "PASSED" | "FAILED_SAFETY_GATE" | "FAILED";

export interface DbDrillSubmission {
  id: string; // "sub_drill_1731234567_abc123"
  user_id: string;
  drill_id: string;
  drill_version: number; // Locked drill version at evaluation time
  rubric_version: number; // Locked rubric version at evaluation time
  attempt_number: number; // Atomic 1, 2, 3...
  idempotency_key: string; // Client UUID preventing double-submit
  
  score: number; // 0 - 100 (Final rounded integer)
  invalidation_score: number; // 0 - 25 (Final rounded integer)
  safety_gate_passed: boolean; // true if invalidation_score >= 18
  evaluation_status: DrillEvaluationStatus;
  
  rubric_snapshot: DrillRubric; // Frozen immutable rubric snapshot
  answers: StudentDrillAnswer;
  evaluation_breakdown: CriterionEvaluationResult[];
  debrief_text: string;
  created_at: string;
}

/**
 * Derived progress summary per student and drill.
 * Computed dynamically from immutable DbDrillSubmission records.
 */
export interface StudentDrillSummary {
  userId: string;
  drillId: string;
  attemptsCount: number;
  firstScore: number;
  firstAttemptPassed: boolean;
  latestScore: number;
  bestScore: number;
  isPassed: boolean;
  safetyGateMet: boolean;
  firstAttemptAt: string;
  lastAttemptAt: string;
}

export interface DbTradePreparationChecklist {
  id: string;
  user_id: string;
  session_type: "LONDON_OPEN" | "NEW_YORK_OPEN" | "ASIAN_SESSION" | "SWING_STUDY";
  psychological_ready: boolean;
  calendar_checked: boolean;
  setup_confirmed: boolean;
  risk_defined: boolean;
  execution_planned: boolean;
  risk_percentage: number; // e.g. 1.0%
  general_notes: string;
  advisory_verdict: "OPTIMAL" | "CAUTION_PROCEED_WITH_CARE" | "DO_NOT_TRADE_TODAY";
  created_at: string;
}

export interface PublicDrillCase {
  id: string;
  courseId: string;
  courseSlug: string;
  lessonId: string;
  title: string;
  slug: string;
  drillType: DrillType;
  drillVersion: number;
  rubricVersion: number;
  instrument: string;
  timeframe: string;
  dataPeriod: string;
  dataSource: string;
  classification: "HISTORICAL_MARKET" | "SYNTHETIC_SIMULATION";
  timezone: string;
  transformationNotes: string;
  priceBounds: ChartPriceBounds;
  chartAssetUrl: string;
  contextPrompt: string;
  instructions: string[];
  rubricCriteriaSummary: Array<{
    id: CriterionId;
    name: string;
    weight: number;
    safetyGateMin?: number;
  }>;
  passingScore: number;
  safetyGateMin: number;
  userSummary?: StudentDrillSummary | null;
}

// ── Task 5.5: Mastery, Weakness & Adaptive Recommendation Contracts ──

export type DrillTopicMasteryLevel =
  | "NO_DATA"
  | "NEEDS_PRACTICE"
  | "DEVELOPING"
  | "MASTERED";

export type DrillDiagnosticStatus =
  | "NO_DATA"
  | "INSUFFICIENT_DATA"
  | "STABLE_PROFICIENT"
  | "NEEDS_REFINEMENT"
  | "CRITICAL_RISK";

export type DrillTrajectoryDirection =
  | "IMPROVED"
  | "REGRESSED"
  | "NO_MATERIAL_CHANGE"
  | "NOT_APPLICABLE";

export interface StudentDrillTopicMastery {
  topicId: string;
  topicTitle: string;
  courseSlug: string;
  totalAvailableDrills: number;
  distinctDrillsAttempted: number;
  distinctDrillsPassed: number;
  pathAQualifiedCount: number;
  pathBQualifiedCount: number;
  averageScore: number | null;
  bestScore: number | null;
  masteryLevel: DrillTopicMasteryLevel;
  overallLevel?: DrillTopicMasteryLevel;
  totalValidDrillsCompleted?: number;
  totalAttemptsEvaluated?: number;
  masteryPath?: "PATH_A_FIRST_ATTEMPT_EXCELLENCE" | "PATH_B_SUSTAINED_COMPETENCY" | "NONE";
  allCriteriaMastered?: boolean;
  lastAttemptAt: string | null;
  masteredAt: string | null;
  nextRecommendedDrillId: string | null;
}

export interface StudentCriterionPerformancePerspective {
  criterionId: CriterionId;
  criterionName: string;
  weight: number;
  // Perspective 1: Current Competency (Latest valid attempt per distinct drill)
  currentProficiency: number | null;
  currentStatus: DrillDiagnosticStatus;
  // Perspective 2: Initial Performance (First valid attempt per distinct drill, attempt_number === 1)
  initialProficiency: number | null;
  initialSafetyGatePassed: boolean | null;
  // Perspective 3: Learning Trajectory (Progression vector between first and latest attempts)
  criterionTrajectoryDelta: number | null;
  trajectoryDirection: DrillTrajectoryDirection;
  // Metadata & Safety
  distinctCasesEvaluated: number;
  totalAttemptsEvaluated: number;
  safetyGateFailuresCount: number;
  warningFlags: string[];
  pedagogicalFlags: string[];
  pedagogicalFeedback: string;
}

export interface StudentDrillIntelligenceSummary {
  userId?: string;
  dataStatus: "NO_DATA" | "INSUFFICIENT_DATA" | "AVAILABLE";
  totalSubmissions: number;
  uniqueDrillsAttempted: number;
  totalAvailablePublishedDrills: number;
  overallPassRate: number | null;
  averageScore: number | null;
  safetyGateComplianceRate: number | null;
  overallTrajectoryDelta: number | null;
  overallTrajectoryDirection: DrillTrajectoryDirection;
  topics: StudentDrillTopicMastery[];
  criterionWeaknesses: StudentCriterionPerformancePerspective[];
  criticalSafetyAlert: boolean;
  generatedAt: string;
}

export type DrillRecommendationCategory =
  | "RESOLVE_CRITICAL_SAFETY_GATE"
  | "PRACTICE_WEAK_CRITERION"
  | "UNLOCK_MULTI_CASE_MASTERY"
  | "NEXT_PRACTICAL_DRILL"
  | "FOUNDATION_FIRST_DRILL";

export interface AdaptiveDrillRecommendation {
  recommendationId: string;
  category: DrillRecommendationCategory;
  priority: number;
  rank: number;
  drillId: string;
  drillTitle: string;
  drillType: DrillType;
  topicId: string;
  shortTitle: string;
  explanation: string;
  evidenceSummary: string;
  evidenceSignature: string;
  actionLabel: string;
  destinationUrl: string;
  status: "ACTIVE" | "DISMISSED";
  generatedAt: string;
}

