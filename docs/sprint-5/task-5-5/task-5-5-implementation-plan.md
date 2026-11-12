# SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
## STEP-BY-STEP IMPLEMENTATION PLAN & ACCEPTANCE CRITERIA

**Document Identifier:** `docs/sprint-5/task-5-5/task-5-5-implementation-plan.md`  
**Author:** Senior Software Architect & Lead QA Engineer  
**Status:** IMPLEMENTATION PROPOSAL (Awaiting Product Owner Authorization)  
**Baseline Hash (`data/academy.json`):** `9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8`  
**Timestamp:** 2026-11-12T21:45:20+07:00  

---

## 1. IMPLEMENTATION WORK BREAKDOWN (WBS)

Implementation of Task 5.5 is partitioned into 4 granular subtasks following strict architectural boundaries:

```
[TASK 5.5 IMPLEMENTATION WORKSTREAM]
  │
  ├── 5.5.1: Pure Mastery & Weakness Calculation Engine (lib/drill-mastery-engine.ts)
  │     ├── Path A & Path B multi-case validation
  │     ├── 5-criterion weakness diagnostic profiler
  │     └── Pure on-demand execution (zero cache desync risk)
  │
  ├── 5.5.2: Adaptive Drill Recommendation Generator (lib/drill-recommendation-engine.ts)
  │     ├── 5-level deterministic priority queue
  │     ├── Evidence signature generator
  │     └── Integration with recommendation dismissals
  │
  ├── 5.5.3: API Layer Integration
  │     ├── Route GET /api/drills/mastery (lib/drill-api-handlers.ts)
  │     └── Non-breaking extension of GET /api/learning/dashboard
  │
  └── 5.5.4: Test Suite & Verification
        ├── Unit tests for Multi-case Path A/B (tests/sprint-5-task-5-5.test.mjs)
        ├── Weakness diagnostic tests & Safety Gate checks
        ├── Backward compatibility regression suite (290 baseline tests)
        └── Full Quality Gates (TypeScript, ESLint, Next.js build)
```

---

## 2. GRANULAR SUBTASK SPECIFICATIONS

### Subtask 5.5.1: Pure Mastery & Weakness Engine
- **Target File:** `lib/drill-mastery-engine.ts`
- **Responsibilities:**
  - `computeStudentDrillMastery(userId, publishedDrills, submissions)`
  - Group submissions by competency topic and calculate distinct drill counts.
  - Evaluate Path A (Score $\ge 80$, Invalidation $\ge 20/25$ on attempt 1 across $\ge 2$ distinct drills).
  - Evaluate Path B (Latest Valid Attempt Score $\ge 70$, Invalidation $\ge 18/25$ across $\ge 2$ distinct drills).
  - Compute Three Independent Performance Perspectives:
    1. *Current Competency:* Latest valid attempt per distinct drill ($A_{\text{latest}}(D_i)$) for active weakness tags and recommendations.
    2. *Initial Performance:* First valid attempt per distinct drill ($A_{\text{first}}(D_i)$ where `attempt_number === 1`) as an immutable baseline.
    3. *Learning Trajectory:* Difference vector ($\Delta = \text{Latest} - \text{First}$) tracking progression without unsubstantiated causal claims.
  - Calculate criterion proficiencies across `CRIT_BIAS`, `CRIT_ENTRY`, `CRIT_INVALID`, `CRIT_RR`, and `CRIT_CONFIRM`.
  - Assign diagnostic statuses (`INSUFFICIENT_DATA`, `STABLE_PROFICIENT`, `NEEDS_REFINEMENT`, `CRITICAL_RISK`).
  - Score NO-TRADE submissions contextually according to drill rubric without blanket 100/100 assumptions.

### Subtask 5.5.2: Adaptive Drill Recommendation Engine
- **Target File:** `lib/drill-recommendation-engine.ts`
- **Responsibilities:**
  - `generateAdaptiveDrillRecommendations({ userId, publishedDrills, submissions, weaknesses, dismissals })`
  - Evaluate priorities: Priority 98 (`RESOLVE_CRITICAL_SAFETY_GATE`), 88 (`PRACTICE_WEAK_CRITERION`), 80 (`UNLOCK_MULTI_CASE_MASTERY`), 70 (`NEXT_PRACTICAL_DRILL`), 60 (`FOUNDATION_FIRST_DRILL`).
  - Ground active recommendations in Perspective 1 (Current Competency).
  - Generate deterministic `evidenceSignature`.
  - Filter out already dismissed recommendations whose signature has not changed.

### Subtask 5.5.3: API & Orchestration Integration
- **Target Files:** `lib/drill-api-handlers.ts`, `app/api/drills/mastery/route.ts`, `lib/learning-intelligence/learning-orchestrator.ts`
- **Responsibilities:**
  - Implement `handleDrillMasteryGetRequest(req)` in `lib/drill-api-handlers.ts`.
  - Mount route `app/api/drills/mastery/route.ts`.
  - In `learning-orchestrator.ts`, call `generateAdaptiveDrillRecommendations` and append `drillIntelligence` and `drillRecommendations` to `StudentLearningDashboardReport`.

### Subtask 5.5.4: Automated Testing, Benchmarking & Quality Gates
- **Target File:** `tests/sprint-5-task-5-5.test.mjs`
- **Responsibilities:**
  - Comprehensive integration test suite covering 12 distinct scenarios:
    1. Zero-submission state (`NO_DATA`, foundation recommendation).
    2. Single drill repeated 10 times $\to$ strictly remains `DEVELOPING` or `NEEDS_PRACTICE`, **NEVER `MASTERED`** (Anti-farming test).
    3. Path A qualification (2 distinct drills with first-attempt score $\ge 80$ and SL $\ge 20$) $\to$ `MASTERED`.
    4. Path B qualification (2 distinct drills with latest valid attempt score $\ge 70$ and SL $\ge 18$) $\to$ `MASTERED`.
    5. Invalidation Safety Gate failure $\to$ immediate `CRITICAL_RISK` diagnosis and Priority 98 recommendation.
    6. Entry Zone weakness diagnosis $\to$ `FLAG_PREMATURE_ENTRY` and Entry drill recommendation.
    7. Insufficient data guard ($N_{\text{distinct}} < 2 \to$ `INSUFFICIENT_DATA`).
    8. Context- and rubric-grounded NO-TRADE evaluation (no blanket 100/100).
    9. Dismissal and resurfacing via `evidenceSignature`.
    10. Complete separation: Quiz mastery remains untouched.
    11. IDOR security: Authenticated student cannot inspect another user's mastery.
    12. Pure on-demand calculation benchmark: Measure 10,000 synthetic submission records logging dataset, hardware/runtime, warm/cold execution, median and p95 latency, isolated from disk I/O.

---

## 3. FORMAL ACCEPTANCE CRITERIA

Task 5.5 will be considered complete and eligible for acceptance only when:
1. **Anti-Farming Verified:** Automated test proves that repeating a single drill ID multiple times CANNOT grant `MASTERED` status.
2. **Path A & Path B Determinism:** Both pathways are evaluated accurately according to mathematical rules without statistical hallucination.
3. **Safety Gate Dominance:** Failing the Invalidation Safety Gate immediately flags `CRITICAL_RISK` and prioritizes protective drill recommendations.
4. **Clean Domain Separation:** `StudentQuizIntelligenceSummary` and `StudentDrillIntelligenceSummary` are completely isolated; quiz scores and drill scores are never combined into a single blended metric.
5. **Data Immutability:** `data/academy.json` schema remains 100% backward-compatible with zero disk write amplification during read requests.
6. **Quality Gate Perfection:**
   - All 290 existing tests + 12 new tests = **302 passing automated tests (100% pass rate)**.
   - `npx tsc --noEmit` exits with 0 errors.
   - `npm run lint` exits with 0 errors.
   - `npm run build` succeeds cleanly.
   - `data/academy.json` SHA-256 hash remains byte-for-byte identical.

---

## 4. ESTIMATED EFFORT & DEPENDENCIES

- **Dependencies:** Task 5.1 (ACCEPTED), Task 5.2 (ACCEPTED), Task 5.4 (ACCEPTED).
- **Prerequisites for Subsequent Tasks:** Task 5.6 (Drill Catalog Page) will consume the mastery indicators and recommendation badges defined in Task 5.5.
- **Estimated Effort:** 4–6 engineering hours once authorized by Product Owner.

