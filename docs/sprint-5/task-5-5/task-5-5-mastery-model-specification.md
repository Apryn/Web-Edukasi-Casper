# SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
## MULTI-CASE MASTERY MODEL SPECIFICATION

**Document Identifier:** `docs/sprint-5/task-5-5/task-5-5-mastery-model-specification.md`  
**Author:** Senior Learning Analytics Engineer & Software Architect  
**Status:** SPECIFICATION PROPOSAL & ARCHITECTURAL AUDIT  
**Baseline Hash (`data/academy.json`):** `9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8`  
**Timestamp:** 2026-11-12T21:36:45+07:00  

---

## 1. PROBLEM STATEMENT: ELIMINATING RETRY FARMING

In practical technical analysis, true market competence is demonstrated when a trader recognizes market structures across **unseen, diverse chart contexts**, not by memorizing the price levels of a single historical snapshot through repeated retries.

Under the initial Task 5.1/5.4 implementation `[VERIFIED IN SOURCE]`:
- `computeStudentDrillSummary` aggregates submissions grouped exclusively by single `(userId, drillId)`.
- If a student fails a drill 5 times and achieves 100% on the 6th attempt, `bestScore` becomes 100%.
- If mastery were defined as simply having `bestScore >= 70`, a student could achieve `MASTERED` status by memorizing and "farming" a single case study.

**Core Invariant of Task 5.5:**  
**Mastery requires independent proof across multiple distinct drill cases.** A student can NEVER achieve `MASTERED` status from a single drill ID, regardless of how many times it is repeated or what score is attained on later retries.

---

## 2. DEFINITION OF A VALID COMPETENCY EVIDENCE UNIT & ATTEMPT TAXONOMY

A single unit of **Verified Competency Evidence** $\mathcal{E}$ is defined as a tuple:
$$\mathcal{E} = \langle \text{userId}, \text{drillId}, \text{competencyKey}, \text{attemptClassification}, \text{attemptNumber}, \text{score}, \text{invalidationScore}, \text{safetyGatePassed}, \text{createdAt} \rangle$$

### 2.1 Formal Attempt Definitions
1. **`firstSubmittedAttempt(userId, drillId)`:**
   - The persistent record where `attempt_number === 1`.
   - Represents the chronological initial contact with the chart.
   - **Path A Invariant:** Path A strictly requires `firstSubmittedAttempt` to be a valid attempt ($A_{\text{valid}}$). If attempt #1 is corrupt, malformed, or invalid, that drill **CANNOT qualify for Path A** under any circumstance.
2. **`firstValidAttempt(userId, drillId)`:**
   - The earliest attempt passing all $A_{\text{valid}}$ integrity checks. Used as baseline for Initial Performance and Learning Trajectory.
3. **`latestValidAttempt(userId, drillId)`:**
   - The most recent attempt passing all $A_{\text{valid}}$ integrity checks. Used for Current Competency and Path B Mastery.

### 2.2 Strict Validity Invariants ($A_{\text{valid}}$)
To qualify as valid evidence toward mastery, an attempt must strictly satisfy:
1. **Persistence & Record Authenticity `[VERIFIED IN SOURCE]`:** The attempt must exist in `drill_submissions` with non-null `idempotency_key`, valid ISO-8601 `created_at`, integer `attempt_number >= 1`, score in $[0, 100]$, invalidation score in $[0, 25]$, non-empty `evaluation_breakdown`, and non-null `rubric_snapshot`.
2. **Safety Gate Compliance `[VERIFIED IN SOURCE]`:** `safety_gate_passed` must be `true` (`invalidation_score >= 18`). Any attempt that fails the safety gate is automatically disqualified as positive competence evidence, regardless of total score.
3. **Published Status `[VERIFIED IN SOURCE]`:** The drill must be currently `PUBLISHED` (or was published at the time of submission). Draft drills do not count toward student mastery.
4. **Pedagogical Failure vs Defect Separation:** A legitimate submission where a student fails the safety gate is valid pedagogical evidence of risk non-compliance. In contrast, a corrupt or malformed record is a data defect, defensively quarantined, and NEVER counted as a positive or negative attempt.

---

## 3. TWO-TIER MASTERY EVALUATION PATHWAYS

Competence in a specific topic or classification (e.g. `XAUUSD Liquidity Sweep` or `Fair Value Gap Execution`) is evaluated through two strictly defined pathways:

```
                          ┌──────────────────────────┐
                          │   Student Submissions    │
                          │   on Topic Competency    │
                          └─────────────┬────────────┘
                                        │
                         Are there >= 2 DISTINCT Drill IDs
                             with verified passing scores?
                                        │
                     ┌──────────────────┴──────────────────┐
                    YES                                    NO
                     │                                     │
           ┌─────────┴─────────┐                  ┌────────┴────────┐
           │ Check Path A & B  │                  │ Ineligible for  │
           └─────────┬─────────┘                  │    MASTERED     │
                     │                            └─────────────────┘
         ┌───────────┴───────────┐
         │                       │
      [PATH A]                [PATH B]
Strong First Attempt    Consistent Multi-Case
Score >= 80 on First     Score >= 70 on Latest
Attempted Submission     Valid Attempt across
 across >= 2 Drills      >= 2 Distinct Drills
```

### 3.1 Path A — Strong First-Attempt Mastery `[MANDATORY CONTRACT]`
Designed for students who demonstrate high diagnostic accuracy on initial contact with fresh charts:
- **Condition 1:** The student must have attempted at least **two distinct drill cases** ($D_1 \neq D_2$) mapped to the same competency domain.
- **Condition 2:** On **both** distinct drill cases, the **First Submitted Attempt** (`firstSubmittedAttempt`, matching `attempt_number === 1`) must:
  - Be a strictly valid attempt ($A_{\text{valid}}$). If attempt #1 is corrupt or missing, Path A is forfeit for that drill.
  - Achieve Total Score $\ge 80/100$.
  - Achieve Invalidation Score $\ge 20/25$ (exceeding baseline safety gate).
  - Achieve `safety_gate_passed === true`.
- **First Attempt Identification Logic:**
  - Strictly matches `s.attempt_number === 1`.
  - Defensive fallback (if numbering broken): Earliest submission sorted by `Date.parse(s.created_at)` ascending.
- **Rationale:** Achieving $\ge 80\%$ on the very first contact on two different charts proves spontaneous structural comprehension without trial-and-error bias.

### 3.2 Path B — Consistent Multi-Case Performance `[MANDATORY CONTRACT]`
Designed for students who master execution through deliberate practice and iterative refinement across distinct charts:
- **Condition 1:** The student must have attempted at least **two distinct drill cases** ($D_1 \neq D_2$) mapped to the same competency domain.
- **Condition 2:** On **each** of the two distinct drill cases, the student's **Latest Valid Attempt** (`latestValidAttempt`, $A_{\text{latestValid}}(D_i)$) must achieve:
  - Total Score $\ge 70/100$
  - Invalidation Score $\ge 18/25$ (Safety Gate met)
  - `safety_gate_passed === true`
- **Attempt Selection Rationale:** Using `latestValidAttempt` ensures that the student currently possesses the required execution competence on both distinct cases at the time of evaluation. Unlike Path A (which tests instinctive initial precision), Path B honors developed competency achieved through practice.
- **Retry Policy:** Retry is unlimited. Retrying a drill does NOT increment the distinct drill count ($|\{D_1\}| = 1$). All attempts remain permanently persisted in history with their immutable rubric snapshots to power Learning Trajectory tracking.
- **Anti-Farming Guarantee:** Achieving $\ge 70\%$ on 10 retries of Drill 1 alone can NEVER unlock mastery under Path B. The student MUST independently prove passing proficiency on the latest valid attempt of a second distinct drill ($D_2$).

---

## 4. FORMAL COMPETENCY MASTERY STATE MACHINE

A student's mastery status for any given topic or competency domain $\mathcal{C}$ transitions through four formal states:

| Mastery State | Criteria Required | Practical Meaning |
| :--- | :--- | :--- |
| `NO_DATA` | 0 submissions across all drills in competency $\mathcal{C}$. | Student has not attempted any practical chart drill in this domain. |
| `NEEDS_PRACTICE` | $\ge 1$ submission, but: <br>• Only 1 distinct drill attempted, OR <br>• Failed safety gate on recent attempts, OR <br>• Average best score $< 70\%$. | Student is actively attempting drills but lacks consistency or multi-case proof. |
| `DEVELOPING` | At least 1 distinct drill passed ($\ge 70\%$ + Safety Gate), but multi-case requirement ($\ge 2$ distinct drills) has not yet been satisfied. | Student proves competence on one specific case, but cannot be certified until validated on a second distinct chart. |
| `MASTERED` | Criteria for **Path A** OR **Path B** are fully satisfied across $\ge 2$ distinct drill cases. | Student has proven robust, repeatable execution across multiple independent market contexts. |

---

## 5. EDGE CASES & INTEGRITY POLICIES

### 5.1 Handling Multiple Attempts on the Same Drill ID `[VERIFIED IN SOURCE]`
- All attempts are stored immutably in `drill_submissions` with incrementing `attempt_number` (1, 2, 3...).
- For multi-case counting: **$\text{Distinct Drills Count} = |\text{Set of Unique Drill IDs}|$.**
- Repeating Drill $D_1$ ten times still yields $\text{Distinct Drills Count} = 1$. It can never satisfy the multi-case condition alone.

### 5.2 Archived Drills Policy `[RECOMMENDATION]`
- If an admin archives a drill (`status: "ARCHIVED"`):
  - Prior submissions remain immutable and valid in student history.
  - However, archived drills can no longer be used as active evidence toward newly earned mastery states.
  - If a student had already earned `MASTERED` prior to archiving, their status is preserved via an immutable snapshot timestamp (`mastered_at`).

### 5.3 Drill Version & Rubric Version Drift `[VERIFIED IN SOURCE]`
- Each `DbDrillSubmission` captures `drill_version`, `rubric_version`, and `rubric_snapshot`.
- When calculating competency metrics, the engine uses the frozen score recorded at submission time. It NEVER recalculates historical submission scores retroactively against modified rubrics.

### 5.4 NO-TRADE Case Handling & Rubric Grounding `[PO FINALIZED]`
- When a drill designates a NO-TRADE setup (`model_answer.isNoTradeValid === true`), choosing NO-TRADE does **not** grant automatic blanket 100/100 points across all criteria.
- Points for directional bias (`CRIT_BIAS`) and confirmation rationale (`CRIT_CONFIRM`) are evaluated strictly based on the student's submitted evidence, analysis checkboxes, and written thesis against the specific drill's rubric criteria.
- Full credit is awarded only when explicitly supported by the rubric definition for that specific drill case.
- A verified passing NO-TRADE submission with $\ge 70\%$ and valid Safety Gate compliance counts as 1 valid case proof toward multi-case mastery, rewarding capital preservation discipline.

---

## 6. AUDIT CONCLUSION & READINESS

- **Clarity of Rules:** The rules for Path A, Path B, and state transitions are mathematically deterministic and eliminate all potential retry farming.
- **Implementation Impact:** Requires zero modifications to existing `DbDrillSubmission` records. Can be evaluated entirely as a pure deterministic query over `getDrillSubmissions(userId)`.
- **Verdict:** Fully ready for architectural approval.

