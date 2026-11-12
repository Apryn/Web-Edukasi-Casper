# SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
## ADAPTIVE DRILL RECOMMENDATION SPECIFICATION

**Document Identifier:** `docs/sprint-5/task-5-5/task-5-5-adaptive-recommendation-specification.md`  
**Author:** Senior Learning Analytics Engineer & UI Architect  
**Status:** SPECIFICATION PROPOSAL & AUDIT  
**Baseline Hash (`data/academy.json`):** `9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8`  
**Timestamp:** 2026-11-12T21:37:55+07:00  

---

## 1. OBJECTIVE & ARCHITECTURAL BOUNDARIES

Task 5.5 specifies the **Adaptive Practical Drill Recommendation Engine**, which dynamically suggests the most pedagogically valuable chart case study for a student based on:
1. **Perspective 1: Current Competency** derived from latest valid attempts across distinct drills.
2. Verified multi-case progression toward Path A / Path B Mastery.
3. Safety Gate compliance state.

### Core Architectural Separation Invariants:
**1. Sprint 4 Quiz Recommendations and Sprint 5 Practical Drill Recommendations MUST operate as separate, distinct recommendation queues.**
- A Quiz Recommendation targets theoretical lesson reading and multiple-choice quizzes (`RETRY_QUIZ`, `REVIEW_WEAK_TOPIC`, `NEXT_LESSON`) `[VERIFIED IN SOURCE]`.
- A Drill Recommendation targets chart interaction, price level calibration, and execution discipline (`PRACTICE_DRILL_WEAK_CRITERION`, `NEXT_PRACTICAL_DRILL`, `RESOLVE_CRITICAL_SAFETY_GATE`).
- The two streams are combined inside the Student Learning Dashboard as clearly labeled, distinct card groups. They are NEVER averaged into a blended score.

**2. Grounded in Current Competency without Erasing History:**
Recommendations are powered by the student's **Current Competency** (latest valid attempt per distinct drill). However, the initial unassisted performance baseline and learning trajectory remain permanently recorded in the student's mastery profile.

---

## 2. INTEGRATION STRATEGY: SEPARATE SERVICE MODULE VS EXTENSION

An audit of Sprint 4's `lib/learning-intelligence/recommendation-engine.ts` `[VERIFIED IN SOURCE]` reveals:
1. `generateAdaptiveRecommendations` expects `NormalizedCurriculumCatalog`, `courseProgress`, `quizIntelligence`, and `continuity`.
2. It operates purely on course lessons and quizzes.
3. Modifying `recommendation-engine.ts` directly by adding drill logic inside its core loop risks breaking Sprint 4's 100% test baseline (281 tests).

### Approved Strategy: Dedicated `drill-recommendation-engine.ts` `[RECOMMENDATION]`
Rather than bloating Sprint 4's file, Task 5.5 will create `lib/drill-recommendation-engine.ts` implementing a parallel, modular generator:
```ts
export function generateAdaptiveDrillRecommendations(params: {
  userId: string;
  publishedDrills: DbDrillCase[];
  drillSubmissions: DbDrillSubmission[];
  criterionWeaknesses: StudentCriterionWeaknessProfile;
  topicMastery: StudentDrillMasterySummary;
  dismissals?: DbRecommendationDismissal[];
}): DrillRecommendationResult;
```
The Learning Orchestrator (`learning-orchestrator.ts`) will then call both engines and include them in dedicated top-level fields of `StudentLearningDashboardReport`:
- `report.recommendations` (Course & Quiz Actions — Sprint 4)
- `report.drillRecommendations` (Practical Chart Drill Actions — Sprint 5)

---

## 3. DRILL RECOMMENDATION PRIORITY TAXONOMY

Recommendations are deterministically ordered by an integer priority score ($1 - 100$):

| Priority | Category ID | Trigger Condition | Pedagogical Objective | Action CTA |
| :---: | :--- | :--- | :--- | :--- |
| **98** | `RESOLVE_CRITICAL_SAFETY_GATE` | Student failed the Invalidation Safety Gate on their `latestValidAttempt` on any drill. | Address dangerous Stop-Loss habits before capital execution. | *"Latih Proteksi Stop-Loss"* |
| **88** | `PRACTICE_WEAK_CRITERION` | Diagnosed with `NEEDS_REFINEMENT` on a specific criterion (`CRIT_ENTRY`, `CRIT_RR`, etc.) over $\ge 2$ drills. | Provide targeted drills whose primary learning objective aligns with the weak criterion. | *"Perbaiki Presisi Entry / R:R"* |
| **80** | `UNLOCK_MULTI_CASE_MASTERY` | Student has passed 1 drill in a topic ($\ge 70\%$), but has not yet passed a second distinct drill. | Guide the student to complete a second distinct case to earn full `MASTERED` status. | *"Tuntaskan Bukti Kasus Kedua"* |
| **70** | `NEXT_PRACTICAL_DRILL` | Student has mastered or completed current topic drills, and higher-level or new-classification drills are available. | Advance student along the practical trading curriculum. | *"Mulai Studi Kasus Berikutnya"* |
| **60** | `FOUNDATION_FIRST_DRILL` | Student has 0 valid drill submissions (`NO_DATA`, `validAttemptsCount === 0`). | Onboard student to their very first interactive chart workspace. | *"Mulai Praktik Chart Pertama"* |

---

## 4. DETAILED RECOMMENDATION RULES & SELECTION LOGIC

### 4.1 Strict Candidate Drill Selection & Tie-Breaking Pipeline
When searching for a recommended drill for any trigger rule, the candidate pool is filtered and ranked deterministically:
1. **Status Filter:** Only drills with `status === "PUBLISHED"` are eligible. Draft, review, or archived drills are strictly excluded.
2. **Tier 1 Preference (Unattempted Cases):** Published drills within the target competency domain where the student has zero valid pedagogical attempts (`validAttemptsCount === 0`). Corrupt or malformed records do NOT count as attempts and NEVER disqualify a student from Tier 1 recommendations.
3. **Tier 2 Preference (Incomplete / Unpassed Cases):** If all published drills in the domain have been attempted, select published drills where the student's `latestValidAttempt` has not yet achieved passing competence (`latestValidAttempt.score < 70` OR `latestValidAttempt.safety_gate_passed === false`). Corrupt records are excluded from evaluation.
4. **Curriculum Advancement:** If all published drills in the current topic are already passed with safety compliance, the engine advances to the next unmastered topic in curriculum sequence.
5. **No Hallucination Fallback:** If zero eligible published drills exist across the curriculum, the engine returns `null` (zero active recommendations). The system **NEVER fabricates** placeholder recommendations.
6. **Deterministic Tie-Breaking:** If multiple candidate drills qualify at the same tier, sort by:
   - Primary: Ascending `order_index` (curriculum syllabus order).
   - Secondary: Ascending alphanumeric `id` (e.g. `drill-01` before `drill-02`).

---

### 4.2 Priority Rules & Stable Evidence Signatures

#### Rule 1: Safety Gate Override (`RESOLVE_CRITICAL_SAFETY_GATE`, Priority 98)
- **Trigger:** `latestValidAttempt` on any drill has `safety_gate_passed === false` (`invalidation_score < 18`).
- **Drill Selection:** Select an active published drill with `drill_type === "INVALIDATION_RISK"` following Section 4.1.
- **Evidence Summary:** *"Percobaan terakhir Anda gagal pada kriteria Stop-Loss (Skor SL: ${invalidation_score}/25). Praktikkan penempatan invalidasi struktural yang aman."*
- **Stable Evidence Signature:**  
  `drill:safety_gate:drill=${triggerDrillId}:latestValidSubId=${latestValidAttempt.id}:sl=${invalidationScore}`

#### Rule 2: Targeted Weakness Practice (`PRACTICE_WEAK_CRITERION`, Priority 88)
- **Trigger:** Diagnosed `NEEDS_REFINEMENT` on `CRIT_ENTRY`, `CRIT_RR`, or `CRIT_CONFIRM` with $N_{\text{distinct}} \ge 2$.
- **Drill Selection:** Match the weak criterion to the drill's primary classification:
  - `CRIT_ENTRY` $\to$ Drills tagged `LEVEL_IDENTIFICATION` or `SETUP_EXECUTION` with Fair Value Gap emphasis.
  - `CRIT_RR` $\to$ Drills tagged `SETUP_EXECUTION` requiring minimum 1:2.5 asymmetric targets.
  - `CRIT_CONFIRM` $\to$ Drills tagged `DIRECTION_BIAS` with multi-timeframe confirmation checklist.
- **Evidence Summary:** *"Berdasarkan performa terkini, presisi ${criterionName} Anda memerlukan latihan terfokus (${proficiency.toFixed(1)}%)."*
- **Stable Evidence Signature:**  
  `drill:weak:crit=${criterionId}:latestValidSubId=${latestValidAttempt.id}:prof=${proficiency.toFixed(2)}:cases=${distinctCount}`
  *(Note: Sourcing `latestValidSubId` strictly from `latestValidAttempt.id` guarantees that ANY new valid retry instantly changes the signature, preventing premature suppression across retries even if rounded scores are close).*

#### Rule 3: Multi-Case Completion (`UNLOCK_MULTI_CASE_MASTERY`, Priority 80)
- **Trigger:** Student has passed drill $D_1$ on topic $T$, but topic status remains `DEVELOPING` because a second distinct drill has not been completed.
- **Drill Selection:** Select the next eligible unattempted (or unpassed) published drill $D_2$ in topic $T$ per Section 4.1.
- **Evidence Summary:** *"Anda telah menguasai studi kasus #${D1.title}. Selesaikan studi kasus #${D2.title} untuk membuktikan konsistensi multi-kasus dan meraih status Mastered."*
- **Stable Evidence Signature:**  
  `drill:multicase:topic=${topicId}:passedValidSubId=${passedValidSubmission.id}:candidate=${candidateDrill.id}`

#### Rule 4: Zero-Data Onboarding (`FOUNDATION_FIRST_DRILL`, Priority 60)
- **Trigger:** $N_{\text{validSubmissions}} = 0$ (`NO_DATA`).
- **Drill Selection:** First published drill in Course 1 sorted by `order_index`.
- **Evidence Summary:** *"Mulailah menguji pemahaman analisa grafik Anda melalui studi kasus interaktif pertama."*
- **Stable Evidence Signature:**  
  `drill:onboard:first_case:target=${candidateDrill.id}`

---

## 5. RESURFACING, SUPPRESSION & DISMISSAL DYNAMICS

1. **Suppression Scope:**
   - When a student dismisses a recommendation, the event is saved in `recommendation_dismissals` with its exact `evidence_signature`.
   - The recommendation remains suppressed **only as long as that exact evidence signature matches**.
   - As soon as the student makes a new attempt, the signature changes (due to new `latestSubId` or score update), allowing the recommendation to naturally resurface if the condition persists.
2. **Archived / Deleted Drill Immunity:**
   - Candidate drills are checked dynamically against active published drills on every generation. If an admin archives a drill, it is instantly filtered out of recommendation outputs.
3. **Anti-Repetition Cap:**
   - Exactly **at most 2 active drill recommendations** are returned to the Student Dashboard to prevent cognitive overload.

---

## 6. AUDIT CONCLUSION & READINESS

- **Separation Verified:** By isolating practical recommendations in `lib/drill-recommendation-engine.ts`, Sprint 4 contracts remain 100% backward compatible.
- **Zero Hallucination:** Recommendations are completely derived from concrete, verified evidence in `drill_submissions`.
- **Verdict:** Fully ready for architectural approval.

