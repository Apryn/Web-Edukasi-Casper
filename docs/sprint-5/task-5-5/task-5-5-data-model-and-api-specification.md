# SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
## DATA MODEL & API INTEGRATION SPECIFICATION

**Document Identifier:** `docs/sprint-5/task-5-5/task-5-5-data-model-and-api-specification.md`  
**Author:** Senior Software Architect & Database Engineer  
**Status:** SPECIFICATION PROPOSAL & AUDIT  
**Baseline Hash (`data/academy.json`):** `9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8`  
**Timestamp:** 2026-11-12T21:38:20+07:00  

---

## 1. DATA MODEL ARCHITECTURE: SOURCE OF TRUTH VS DERIVED PROJECTIONS

The architecture strictly maintains that **`drill_submissions` is the sole immutable source of truth** for student execution performance `[VERIFIED IN SOURCE]`.

Progress summaries, criterion proficiencies, and topic mastery levels are **Derived Projections** that can always be completely and deterministically recomputed from raw submission records:

```
[IMMUTABLE SOURCE OF TRUTH]
       DbDrillSubmission
       ├── id: string (PK)
       ├── user_id: string
       ├── drill_id: string
       ├── drill_version: number
       ├── rubric_version: number
       ├── attempt_number: number
       ├── score: number (0-100)
       ├── invalidation_score: number (0-25)
       ├── safety_gate_passed: boolean
       ├── rubric_snapshot: DrillRubric
       ├── evaluation_breakdown: CriterionEvaluationResult[]
       └── created_at: string
               │
               ▼
   [DETERMINISTIC DERIVED PROJECTION ENGINE]
   computeStudentDrillIntelligenceSummary(userId, allDrills, userSubmissions)
               │
               ├─────────────────────────────────────────┐
               ▼                                         ▼
   StudentTopicMasteryMetric[]             CriterionProficiencyMetric[]
   ├── topicId                             ├── criterionId
   ├── distinctDrillsAttempted             ├── sampleSize
   ├── distinctDrillsPassed                ├── averageProficiency (0-100%)
   ├── pathAEvidenceCount                  ├── safetyGateFailuresCount
   ├── pathBEvidenceCount                  └── diagnosticStatus:
   └── masteryLevel:                           (INSUFFICIENT_DATA |
       (NO_DATA | NEEDS_PRACTICE |              STABLE_PROFICIENT |
        DEVELOPING | MASTERED)                  NEEDS_REFINEMENT |
                                                CRITICAL_RISK)
```

---

## 2. FORMAL TYPE DEFINITIONS FOR TASK 5.5 `[RECOMMENDATION]`

These TypeScript interfaces will be added to `lib/drill-types.ts` without modifying existing schema fields:

```ts
// ── Task 5.5: Mastery & Progress Contracts ──────────────────────────

export type DrillTopicMasteryLevel =
  | "NO_DATA"          // Zero submissions
  | "NEEDS_PRACTICE"   // < 2 distinct drills passed, or struggling
  | "DEVELOPING"       // 1 distinct drill passed with Safety Gate
  | "MASTERED";        // Multi-case proof satisfied (Path A or Path B)

export interface StudentDrillTopicMastery {
  topicId: string; // e.g. "xauusd-liquidity-sweeps"
  topicTitle: string; // "Gold Asian High/Low Liquidity Sweeps"
  courseSlug: string;
  totalAvailableDrills: number;
  distinctDrillsAttempted: number;
  distinctDrillsPassed: number;
  pathAQualifiedCount: number;
  pathBQualifiedCount: number;
  averageScore: number | null;
  bestScore: number | null;
  masteryLevel: DrillTopicMasteryLevel;
  lastAttemptAt: string | null;
  masteredAt: string | null;
  nextRecommendedDrillId: string | null;
}

export interface StudentCriterionPerformancePerspective {
  criterionId: CriterionId; // CRIT_BIAS | CRIT_ENTRY | CRIT_INVALID | CRIT_RR | CRIT_CONFIRM
  criterionName: string;
  weight: number;
  // Perspective 1: Current Competency (Latest valid attempt per distinct drill)
  currentProficiency: number | null; // 0.0 - 100.0%, null if NO_DATA
  currentStatus: "NO_DATA" | "INSUFFICIENT_DATA" | "STABLE_PROFICIENT" | "NEEDS_REFINEMENT" | "CRITICAL_RISK";
  // Perspective 2: Initial Performance (First valid attempt per distinct drill, attempt_number === 1)
  initialProficiency: number | null; // 0.0 - 100.0%, null if no attempts
  initialSafetyGatePassed: boolean | null;
  // Perspective 3: Learning Trajectory (Progression vector between first and latest attempts)
  criterionTrajectoryDelta: number | null; // latest - first (in score points: -100.0 to +100.0, 1 decimal place)
  trajectoryDirection: "IMPROVED" | "REGRESSED" | "NO_MATERIAL_CHANGE" | "NOT_APPLICABLE";
  // Diagnostic Metadata & Safety
  distinctCasesEvaluated: number;
  totalAttemptsEvaluated: number;
  safetyGateFailuresCount: number; // Specifically for CRIT_INVALID
  warningFlags: string[]; // e.g. ["WARN_BORDERLINE_SAFETY", "WARN_HIGH_VARIANCE"]
  pedagogicalFlags: string[]; // e.g. ["FLAG_PREMATURE_ENTRY", "FLAG_SUBOPTIMAL_RR"]
  pedagogicalFeedback: string;
}

export interface StudentDrillIntelligenceSummary {
  dataStatus: "NO_DATA" | "INSUFFICIENT_DATA" | "AVAILABLE";
  totalSubmissions: number;
  uniqueDrillsAttempted: number;
  totalAvailablePublishedDrills: number;
  overallPassRate: number | null; // % (0.0 - 100.0)
  averageScore: number | null; // (0.0 - 100.0)
  safetyGateComplianceRate: number | null; // % of latest valid attempts where SL >= 18
  overallTrajectoryDelta: number | null; // Average total score change across multi-attempt drills (-100.0 to +100.0)
  overallTrajectoryDirection: "IMPROVED" | "REGRESSED" | "NO_MATERIAL_CHANGE" | "NOT_APPLICABLE";
  topics: StudentDrillTopicMastery[];
  criterionWeaknesses: StudentCriterionPerformancePerspective[]; // Three distinct perspectives preserved
  criticalSafetyAlert: boolean;
  generatedAt: string;
}
```

---

## 3. PROPOSED API ENDPOINTS FOR TASK 5.5

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/drills/mastery` | `GET` | Authenticated Student | Returns the calling student's complete `StudentDrillIntelligenceSummary`. Scoped strictly to `user.id` from JWT session. |
| `/api/learning/dashboard` | `GET` | Authenticated Student | Existing endpoint enhanced with `drillIntelligence` and `drillRecommendations` fields without modifying Sprint 4 quiz metrics. |
| `/api/admin/learning-intelligence/drills` | `GET` | Admin Only | Returns aggregate practical drill analytics (most failed criteria, drop-off drills, average attempts before mastery) across selected periods (`7d`, `30d`, `90d`, `all`). Zero private journals or individual identities exposed. |

---

## 4. DETAILED ENDPOINT PAYLOAD SPECIFICATIONS

### 4.1 `GET /api/drills/mastery` (Student Mastery Endpoint)
- **Request Headers:** `Cookie` (JWT session token) or `Authorization: Bearer <token>`
- **Response Structure (200 OK):**
  ```json
  {
    "success": true,
    "drillIntelligence": {
      "dataStatus": "AVAILABLE",
      "totalSubmissions": 5,
      "uniqueDrillsAttempted": 3,
      "totalAvailablePublishedDrills": 12,
      "overallPassRate": 80.0,
      "averageScore": 78.5,
      "safetyGateComplianceRate": 100.0,
      "overallTrajectoryDelta": 16.5,
      "overallTrajectoryDirection": "IMPROVED",
      "criticalSafetyAlert": false,
      "topics": [
        {
          "topicId": "xauusd-liquidity-sweeps",
          "topicTitle": "Gold Asian High/Low Sweeps",
          "distinctDrillsAttempted": 2,
          "distinctDrillsPassed": 2,
          "masteryLevel": "MASTERED",
          "masteredAt": "2026-11-12T14:00:00Z"
        }
      ],
      "criterionWeaknesses": [
        {
          "criterionId": "CRIT_ENTRY",
          "criterionName": "Zona Entry Presisi",
          "weight": 25,
          "currentProficiency": 68.0,
          "currentStatus": "NEEDS_REFINEMENT",
          "initialProficiency": 50.0,
          "initialSafetyGatePassed": true,
          "criterionTrajectoryDelta": 18.0,
          "trajectoryDirection": "IMPROVED",
          "distinctCasesEvaluated": 2,
          "totalAttemptsEvaluated": 4,
          "safetyGateFailuresCount": 0,
          "warningFlags": [],
          "pedagogicalFlags": ["FLAG_PREMATURE_ENTRY"],
          "pedagogicalFeedback": "Cenderung masuk terlalu awal sebelum re-test Fair Value Gap sempurna."
        }
      ]
    }
  }
  ```

---

## 5. AUTHORIZATION MATRIX & THREAT MODEL ANALYSIS

| Actor | Resource | Action | Authorized? | Enforcement Mechanism |
| :--- | :--- | :---: | :---: | :--- |
| **Anonymous** | `/api/drills/mastery` | Read | ❌ **DENY** | `getSessionUser()` returns null $\to$ `401 Unauthorized`. |
| **Student A** | Student A's Mastery | Read | ✅ **ALLOW** | Session token maps to `user.id`. Submissions filtered strictly by `user_id === user.id`. |
| **Student A** | Student B's Mastery | Read | ❌ **DENY** | No `userId` param accepted in query/body. Scoped solely to session identity (Prevents IDOR). |
| **Student** | Draft Drills Analytics | Read | ❌ **DENY** | Mastery engine filters `status === "PUBLISHED"`. Draft drills excluded from counts. |
| **Admin** | Aggregated Drill Metrics | Read | ✅ **ALLOW** | `isAdmin(user)` guard enforced. Data anonymized into cohort statistics. |
| **Admin** | Student Private Journal | Read | ❌ **DENY** | Task 5.5 endpoints have zero access to `data/journals/` or trade entries. |

---

## 6. AUDIT CONCLUSION & READINESS

- **Zero Breaking Schema Mutations:** No modifications required to `data/academy.json` schema structure.
- **Backward Compatibility:** All existing endpoints continue functioning with 100% test passing.
- **Verdict:** Fully ready for architectural approval.

