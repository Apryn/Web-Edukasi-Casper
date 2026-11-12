# SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
## EXISTING ARCHITECTURE & INTEGRATION AUDIT

**Document Identifier:** `docs/sprint-5/task-5-5/task-5-5-existing-architecture-audit.md`  
**Author:** Senior Software Architect & Technical Auditor  
**Status:** READ-ONLY ARCHITECTURAL AUDIT  
**Baseline Hash (`data/academy.json`):** `9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8`  
**Timestamp:** 2026-11-12T21:36:00+07:00  

---

## 1. AUDIT PURPOSE & SCOPE

This document provides a factual, empirical audit of the existing codebase across both **Sprint 4 (Learning Intelligence & Recommendation Engine)** and **Sprint 5 (Practical Drill Engine, Tasks 5.1–5.4)**. The objective is to identify all architectural touchpoints, data contracts, and dependency graphs required to design **Task 5.5: Student Drill Progress & Mastery Integration** without creating regressions, contaminating metric domains, or modifying production files.

Every finding in this document is labeled strictly with one of four verification classifications:
- `[VERIFIED IN SOURCE]` — Directly inspected and confirmed in the local TypeScript codebase.
- `[INFERRED]` — Logically deduced from confirmed source patterns and contracts.
- `[NOT VERIFIED]` — Stated in prior specifications or documentation but not yet directly implemented in source code.
- `[RECOMMENDATION]` — Architectural recommendation proposed for Task 5.5 implementation.

---

## 2. INVENTORY OF ACTUAL CODEBASE IMPLEMENTATIONS

### 2.1 Sprint 5 Implementation Inventory (Practical Drill Engine)

| File / Component | Actual Path | Verification Status | Architectural Role & Implementation Details |
| :--- | :--- | :---: | :--- |
| **Drill Types & Schemas** | `lib/drill-types.ts` | `[VERIFIED IN SOURCE]` | Exports `DbDrillCase`, `DbDrillSubmission`, `DrillModelAnswer`, `DrillRubric`, `StudentDrillAnswer`, `StudentDrillSummary`, `PublicDrillCase`, and `CriterionId`. Contains frozen rubric definition and 5 canonical criteria (`CRIT_BIAS`, `CRIT_ENTRY`, `CRIT_INVALID`, `CRIT_RR`, `CRIT_CONFIRM`). |
| **Drill Storage Service** | `lib/drill-storage.ts` | `[VERIFIED IN SOURCE]` | Implements `recordDrillSubmission`, `getDrillSubmissions`, `getAllSubmissionsForUser`, `computeStudentDrillSummary`, `getStudentDrillSummary`, and concurrency mutex `withSubmissionLock(userId, drillId)`. Uses atomic `executeMutation` from `lib/db.ts`. |
| **Deterministic Evaluation** | `lib/drill-evaluation-engine.ts` | `[VERIFIED IN SOURCE]` | Implements `evaluateDrillSubmission`, `sanitizeDrillForStudent`, and `reproduceDrillEvaluation`. Enforces hard Invalidation Safety Gate ($\ge 18/25$ on `CRIT_INVALID`), symmetric half-up rounding (`roundHalfUp`), and NO-TRADE evaluation logic. |
| **Drill API Handlers** | `lib/drill-api-handlers.ts` | `[VERIFIED IN SOURCE]` | Implements portable Web-standard controllers: `handleDrillGetRequest`, `handleDrillSubmitRequest`, and `handleDrillSolutionRequest`. Completely strips secrets from unauthenticated or pre-submission requests. |
| **API Endpoints** | `app/api/drills/[id]/route.ts`<br>`app/api/drills/[id]/submit/route.ts`<br>`app/api/drills/[id]/solution/route.ts` | `[VERIFIED IN SOURCE]` | 1-line delegates forwarding Next.js App Router requests to `lib/drill-api-handlers.ts`. |
| **Student Workspace UI** | `components/drills/StudentDrillWorkspace.tsx` | `[VERIFIED IN SOURCE]` | Interactive client component managing 16:9 chart stage, two-way coordinate syncing, dual stance toggle (Trade vs NO-TRADE), live R:R calculation, debrief view, and retry flow. |
| **Workspace Page Route** | `app/belajar/drill/[id]/page.tsx` | `[VERIFIED IN SOURCE]` | Authenticated Server Component route. Redirects unauthenticated users to `/login`, blocks DRAFT drills for non-admins with 404, loads isolated submissions, and passes sanitized public drill props. |

### 2.2 Sprint 4 Implementation Inventory (Learning Intelligence & Continuity)

| File / Component | Actual Path | Verification Status | Architectural Role & Implementation Details |
| :--- | :--- | :---: | :--- |
| **Learning Intelligence Types** | `lib/learning-intelligence/types.ts` | `[VERIFIED IN SOURCE]` | Defines `StudentLearningDashboardReport`, `StudentQuizIntelligenceSummary`, `TopicMasteryMetric`, `AdaptiveLearningRecommendation`, `StudentOverallLearningMetrics`, and `StudentLearningContinuityMetrics`. |
| **Learning Orchestrator** | `lib/learning-intelligence/learning-orchestrator.ts` | `[VERIFIED IN SOURCE]` | Main facade function `generateStudentLearningDashboardReport(userId)` that aggregates course progress, quiz topic mastery, continuity streaks, and recommendations into one report. |
| **Recommendation Engine** | `lib/learning-intelligence/recommendation-engine.ts` | `[VERIFIED IN SOURCE]` | Generates prioritized recommendations (`RETRY_QUIZ`, `CONTINUE_LEARNING`, `RETURN_TO_LEARNING`, `REVIEW_WEAK_TOPIC`). Computes deterministic `evidenceSignature` and manages dismissal suppression. |
| **Quiz Topic Metrics** | `lib/learning-intelligence/quiz-topic-metrics.ts` | `[VERIFIED IN SOURCE]` | Aggregates `quiz_submissions` per topic. Calculates `attemptsCount`, `bestScore`, `averageScore`, `isPassed`, and assigns `TopicMasteryLevel` (`NO_DATA`, `NEEDS_PRACTICE`, `DEVELOPING`, `MASTERED`). |
| **Progress Normalizer** | `lib/learning-intelligence/progress-normalizer.ts` | `[VERIFIED IN SOURCE]` | Normalizes raw curriculum data into catalog items with completion percentages, certificate eligibility, and next lesson pointers. |
| **Engagement & Continuity** | `lib/learning-intelligence/engagement-metrics.ts` | `[VERIFIED IN SOURCE]` | Analyzes `learning_events` and submission dates to calculate active streaks, inactive days, and weekly activity timelines. |
| **Admin Education Intelligence** | `lib/learning-intelligence/admin-education-intelligence.ts` | `[VERIFIED IN SOURCE]` | Computes aggregated, privacy-preserving education statistics for mentors/admins (drop-off rates, average quiz scores) across time periods (`7d`, `30d`, `90d`, `all`). |

---

## 3. DEPENDENCY & DATA FLOW MAP

```
[DATA SOURCE LAYER]
   ├── data/academy.json (DatabaseSchema)
   │     ├── users: DbUser[]
   │     ├── course_progress: DbCourseProgress[]
   │     ├── quiz_submissions: DbQuizSubmission[] [SPRINT 4 SOURCE OF TRUTH]
   │     ├── learning_events: DbLearningEvent[]   [TELEMETRY ONLY]
   │     ├── recommendation_dismissals: DbRecommendationDismissal[]
   │     ├── drills: DbDrillCase[]                [SPRINT 5 DRILL DEFINITIONS]
   │     └── drill_submissions: DbDrillSubmission[] [SPRINT 5 SOURCE OF TRUTH]
   │
   v
[SERVICE & SERIALIZATION LAYER]
   ├── lib/db.ts -> executeMutation (Global single-writer lock)
   ├── lib/drill-storage.ts -> withSubmissionLock(userId, drillId)
   └── lib/learning-intelligence/progress-normalizer.ts
   │
   v
[EVALUATION & AGGREGATION LAYER]
   ├── lib/drill-evaluation-engine.ts -> evaluateDrillSubmission() [Pure Math Engine]
   ├── lib/learning-intelligence/quiz-topic-metrics.ts -> computeQuizTopicMetrics()
   ├── lib/learning-intelligence/engagement-metrics.ts -> computeStudentContinuityMetrics()
   └── [NEW PROPOSED TASK 5.5] lib/drill-mastery-engine.ts -> computeDrillMasteryMetrics()
   │
   v
[RECOMMENDATION & ORCHESTRATION LAYER]
   ├── lib/learning-intelligence/recommendation-engine.ts
   │     └── Candidates: RETRY_QUIZ, REVIEW_WEAK_TOPIC, CONTINUE_LEARNING
   └── [TASK 5.5 EXTENSION]
         └── New Candidates: PRACTICE_DRILL_WEAK_CRITERION, NEXT_PRACTICAL_DRILL
   │
   v
[API CONTROLLER LAYER]
   ├── /api/drills/[id] (GET, POST submit, GET solution)
   ├── /api/learning/dashboard (GET student learning dashboard)
   ├── /api/learning/recommendations (POST dismiss)
   └── [NEW PROPOSED TASK 5.5] /api/drills/mastery (GET student drill mastery summary)
   │
   v
[PRESENTATION LAYER]
   ├── /belajar/drill/[id] (Task 5.4 Student Workspace)
   ├── /dashboard (Sprint 4 Learning Dashboard)
   └── /admin (Admin Intelligence Panel)
```

---

## 4. ARCHITECTURAL IDENTIFICATION: REUSABLE ASSETS VS ISOLATION BOUNDARIES

### 4.1 Reusable Components & Patterns `[VERIFIED IN SOURCE]`
1. **`withSubmissionLock` Mutex Pattern:**
   In `lib/drill-storage.ts`, the per-user and per-drill promise chain prevents concurrent writes. Task 5.5 can safely read submissions or record derived progress under this mutex.
2. **`evidenceSignature` Dismissal Mechanism:**
   In `lib/learning-intelligence/recommendation-engine.ts`, recommendations use `evidenceSignature` string hashing (e.g. `retry:course:lesson:attempts=X:best=Y`). When student evidence changes (e.g., student completes a drill), the signature naturally shifts, allowing dismissed recommendations to resurface organically without manual resets.
3. **`executeMutation` Single-File Atomicity:**
   In `lib/db.ts`, atomic file writes with `.tmp` swapping guarantee that derived mastery summaries can be persisted without risking file corruption.
4. **`CriterionEvaluationResult` Breakdown:**
   Each `DbDrillSubmission` stores `evaluation_breakdown: CriterionEvaluationResult[]` containing points earned per `CRIT_BIAS`, `CRIT_ENTRY`, `CRIT_INVALID`, `CRIT_RR`, and `CRIT_CONFIRM`. This provides exact historical data for weakness detection without re-evaluating raw coordinates.

### 4.2 Isolation Boundaries (Strict Separation) `[VERIFIED IN SOURCE]`
1. **Quiz Mastery vs Drill Mastery Separation:**
   `StudentQuizIntelligenceSummary` in `lib/learning-intelligence/types.ts` aggregates multiple-choice theoretical quizzes (`DbQuizSubmission`). It MUST NOT be combined or averaged with `DbDrillSubmission`. Practical execution mastery measures order execution on real charts, whereas quiz mastery measures conceptual memorization.
2. **Telemetry vs Ground Truth Separation:**
   `DbLearningEvent` records event telemetry (`LESSON_COMPLETED`, `QUIZ_SUBMITTED`, etc.). Telemetry events can be dropped or truncated and MUST NOT be used as the source of truth for mastery calculations. `drill_submissions` is the sole immutable source of truth.
3. **Private Journal Boundary:**
   `data/journals/` and `/api/journal/*` store private financial logs and risk parameters. Task 5.5 MUST NOT access, read, or aggregate student journal data.

---

## 5. INTEGRATION RISKS & GAP ANALYSIS

| Risk Area | Existing Reality in Source | Severity | Mitigation Strategy for Task 5.5 |
| :--- | :--- | :---: | :--- |
| **Single Drill Farming** | `computeStudentDrillSummary` currently evaluates `attemptsCount` and `bestScore` per single `drillId`. A student could repeat one drill 10 times to get 100%. | **CRITICAL** | `[RECOMMENDATION]` Design Multi-Case Mastery Proof requiring distinct `drillId` counts across a competence domain. |
| **Domain Pollution** | `/api/learning/dashboard` returns `StudentLearningDashboardReport`. If drill scores are merged into `overall.averageQuizScore`, historical baseline metrics break. | **HIGH** | `[RECOMMENDATION]` Add an isolated `drillIntelligence: StudentDrillIntelligenceSummary` field to the report. Never blend quiz and drill averages. |
| **Performance Overhead** | `generateStudentLearningDashboardReport` runs synchronously on GET `/api/learning/dashboard`. Computing mastery across hundreds of submissions on every request could induce lag. | **MEDIUM** | `[RECOMMENDATION]` Use efficient in-memory filtering by indexed user ID and cache derived mastery summaries with version signatures. |
| **Rubric Version Drift** | A drill's rubric may be updated from v1 to v2 (e.g. weights change). | **MEDIUM** | `[VERIFIED IN SOURCE]` `DbDrillSubmission` already captures `rubric_snapshot` and `rubric_version`. Mastery calculations must evaluate against the locked submission score, not retroactive rubric re-scoring. |

---

## 6. VERIFICATION SUMMARY

- **Source Code Files Directly Inspected:** 8 files (`lib/drill-types.ts`, `lib/drill-storage.ts`, `lib/drill-evaluation-engine.ts`, `lib/drill-api-handlers.ts`, `lib/learning-intelligence/types.ts`, `lib/learning-intelligence/learning-orchestrator.ts`, `lib/learning-intelligence/recommendation-engine.ts`, `lib/db.ts`).
- **Database Schema Verified:** `DatabaseSchema` in `lib/db.ts` already houses `drills` and `drill_submissions`.
- **Database Hash Unchanged:** `9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8`.
- **Production Files Modified:** **0 files**.

