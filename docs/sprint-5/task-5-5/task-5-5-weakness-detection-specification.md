# SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
## CRITERION WEAKNESS DETECTION SPECIFICATION

**Document Identifier:** `docs/sprint-5/task-5-5/task-5-5-weakness-detection-specification.md`  
**Author:** Senior Learning Analytics Engineer & QA Specialist  
**Status:** SPECIFICATION PROPOSAL & AUDIT  
**Baseline Hash (`data/academy.json`):** `9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8`  
**Timestamp:** 2026-11-12T21:37:10+07:00  

---

## 1. OBJECTIVE & ARCHITECTURAL PRINCIPLES

Weakness detection in Task 5.5 aims to diagnose exact pedagogical gaps in a student's trading execution by inspecting the criterion-by-criterion performance recorded in `DbDrillSubmission.evaluation_breakdown` `[VERIFIED IN SOURCE]`.

The 5 canonical evaluation criteria established in Task 5.2 are:
1. `CRIT_BIAS` (Weight: 20%) — Directional order flow & market regime assessment.
2. `CRIT_ENTRY` (Weight: 25%) — Precision of execution zone entry placement.
3. `CRIT_INVALID` (Weight: 25%) — Invalidation level placement & **Mandatory Safety Gate** ($\ge 18/25$).
4. `CRIT_RR` (Weight: 15%) — Realized Risk-to-Reward ratio relative to target ($\ge 1:2.0$).
5. `CRIT_CONFIRM` (Weight: 15%) — Structural confirmation tags checklist & thesis rationale.

**Core Diagnostic Principles:**
- **No False Certainty:** A student must never be labeled as "chronically weak" based on a single mistake or insufficient evidence.
- **Severity Stratification:** A failure in the Invalidation Safety Gate carries critical risk, whereas a slight miss in Entry tolerance is classified as a precision calibration issue.
- **Evidence-Based Recovery:** Once a student demonstrates consistent performance across subsequent distinct drills, a diagnosed weakness is automatically marked as `RESOLVED`.

---

## 2. FORMAL ATTEMPT TAXONOMY: SUBMITTED VS VALID VS LATEST

To guarantee mathematical consistency across all diagnostic engines and prevent data anomalies from corrupting calculations, the system defines three distinct attempt classifications:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FORMAL ATTEMPT CLASSIFICATIONS                        │
├─────────────────────────┬─────────────────────────┬─────────────────────────┤
│ 1. firstSubmittedAttempt│ 2. firstValidAttempt    │ 3. latestValidAttempt   │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • Attempt with          │ • Chronologically       │ • Chronologically       │
│   attempt_number === 1  │   earliest attempt that │   most recent attempt   │
│ • Captures actual initial│  passes ALL integrity  │   that passes ALL       │
│   submission event      │   validations (A_valid) │   integrity validations │
│ • If corrupt/invalid,   │ • May be attempt #1, #2,│ • Governs Current       │
│   disqualifies Path A   │   etc.                  │   Competency & Queue    │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

### 2.1 Rigorous Attempt Definitions
1. **`firstSubmittedAttempt(userId, drillId)`:**
   - The exact persistent record where `attempt_number === 1`.
   - Represents the true chronological first contact with the chart.
   - **Path A Strict Invariant:** Path A evaluates `firstSubmittedAttempt`. If attempt #1 is corrupt, malformed, or fails schema validation, the drill **CANNOT qualify for Path A**. The student cannot use a later attempt (e.g. attempt #2) as a "re-do" for first-contact mastery.
2. **`firstValidAttempt(userId, drillId)`:**
   - The chronologically earliest attempt that strictly satisfies all $A_{\text{valid}}$ integrity checks (see Section 3).
   - Used as the immutable baseline for **Initial Performance** analytics and **Learning Trajectory** delta calculations.
3. **`latestValidAttempt(userId, drillId)`:**
   - The chronologically most recent attempt that strictly satisfies all $A_{\text{valid}}$ integrity checks.
   - Used for **Current Competency**, **Mastery Path B**, and active **Weakness Classification**.

### 2.2 Pedagogical Failure vs Record Invalidation Distinction
- **Legitimate Pedagogical Failure:** A submission is 100% valid structurally ($A_{\text{valid}}$) but the student failed the trade thesis or Stop-Loss safety gate (`score: 45`, `invalidation_score: 12`, `safety_gate_passed: false`). This is valid pedagogical evidence and is fully ingested by analytics.
- **Corrupt / Invalid Record:** A submission has missing fields, broken JSON, score outside $[0, 100]$, or unresolvable rubric version. This is a system/data defect, quarantined defensively, and NEVER ingested into mastery or weakness calculations.

---

## 3. SEPARATION OF THREE DISTINCT PERFORMANCE PERSPECTIVES

The engine strictly computes three independent, non-blended performance perspectives:

### 3.1 Perspective 1: Current Competency (Operational State) `[MANDATORY]`
- **Data Source:** `latestValidAttempt` for each distinct drill case ($A_{\text{latestValid}}(D_i)$).
- **Formula:**
  $$\text{CurrentProficiency}(c) = \frac{\sum_{i=1}^{N_{\text{distinct}}} \text{PointsEarned}(c, A_{\text{latestValid}}(D_i))}{\sum_{i=1}^{N_{\text{distinct}}} \text{PointsPossible}(c, A_{\text{latestValid}}(D_i))} \times 100\%$$
- If $N_{\text{distinct}} = 0$, $\text{CurrentProficiency}(c) = \text{null}$.

### 3.2 Perspective 2: Initial Performance (Baseline Edge) `[MANDATORY]`
- **Data Source:** `firstValidAttempt` for each distinct drill case ($A_{\text{firstValid}}(D_i)$).
- **Formula:**
  $$\text{InitialProficiency}(c) = \frac{\sum_{i=1}^{N_{\text{distinct}}} \text{PointsEarned}(c, A_{\text{firstValid}}(D_i))}{\sum_{i=1}^{N_{\text{distinct}}} \text{PointsPossible}(c, A_{\text{firstValid}}(D_i))} \times 100\%$$
- Once recorded, permanently immutable. Never overwritten by retries.

### 3.3 Perspective 3: Learning Trajectory (Progression Vector) `[MANDATORY]`
To eliminate ambiguity, the system computes two separate, independent trajectory metrics:

1. **`overallTrajectoryDelta` (Total Drill Score Movement):**
   - Calculated across distinct drills where at least two valid attempts exist ($N_{\text{attempts}}(D_i) \ge 2$):
     $$\text{overallTrajectoryDelta} = \frac{1}{M} \sum_{k=1}^{M} \left( \text{TotalScore}(A_{\text{latestValid}}(D_k)) - \text{TotalScore}(A_{\text{firstValid}}(D_k)) \right)$$
   - Where $M$ is the count of distinct drills with $\ge 2$ valid attempts. If $M = 0$, metric is `null`.
2. **`criterionTrajectoryDelta(c)` (Criterion-Specific Movement):**
   - Calculated strictly as the difference in criterion proficiency between latest and first valid attempts:
     $$\text{criterionTrajectoryDelta}(c) = \text{CurrentProficiency}(c) - \text{InitialProficiency}(c)$$
   - Evaluated across drills with $\ge 2$ valid attempts. If $M = 0$, metric is `null`.
3. **Rigid Trajectory Classification Taxonomy (Score Points):**
   - $\Delta \ge +15.0\text{ points} \to$ `TRAJECTORY_IMPROVED`
   - $\Delta \le -15.0\text{ points} \to$ `TRAJECTORY_REGRESSED`
   - $-15.0 < \Delta < +15.0\text{ points} \to$ `TRAJECTORY_STABLE_NO_MATERIAL_CHANGE`
   - If metric is `null` ($M = 0$) $\to$ `TRAJECTORY_NOT_APPLICABLE`
4. **Rounding Policy:** Trajectory deltas are rounded to exactly 1 decimal place (e.g. `+18.4`). Zero causal claims of "pedagogical mastery" are asserted.

---

## 4. CANONICAL DIAGNOSTIC CLASSIFIER & COMPLETE BOUNDARY SPECIFICATION

To resolve all contradictions and eliminate floating statuses, the diagnostic engine implements **one single canonical classifier** for all criteria. Specific criteria (such as `CRIT_INVALID`) carry safety overrides, while pedagogical tags serve as secondary diagnostic annotations.

### 4.1 Formal Warning Conditions Contract
A criterion evaluates the following boolean warning flags:
- `WARN_BORDERLINE_SAFETY`: Invalidation score on any latest valid attempt is exactly $18/25$ (barely passing).
- `WARN_HIGH_VARIANCE`: Standard deviation of criterion score across distinct latest valid attempts is $\ge 20.0\text{ points}$.
- `WARN_TRAJECTORY_REGRESSION`: `criterionTrajectoryDelta(c)` is $\le -15.0\text{ points}$.
- `WARN_ASYMMETRY_DEFICIT`: Specifically for `CRIT_RR`, realized R:R is between $1:1.8$ and $1:1.99$ (below 1:2.0 target).

### 4.2 Single Canonical Classifier Logic
For any criterion $c$:
1. If $N_{\text{distinct}} = 0 \implies \mathbf{NO\_DATA}$ (`currentProficiency === null`).
2. If $N_{\text{distinct}} = 1 \implies \mathbf{INSUFFICIENT\_DATA}$ (data too sparse for persistent diagnosis).
3. For $N_{\text{distinct}} \ge 2$:
   - **Step 3A (Safety Gate Override — CRIT_INVALID Only):**
     If $c = \text{CRIT\_INVALID}$ AND ($\exists D_i : \text{SL}(A_{\text{latestValid}}(D_i)) < 18/25$ OR $\text{CurrentProficiency}(\text{CRIT\_INVALID}) < 60.00$):
     $\implies \mathbf{CRITICAL\_RISK}$.
     *(Note: Independent Classification Invariant: Safety gate failure on `CRIT_INVALID` NEVER converts non-invalidation criteria into `CRITICAL_RISK`).*
   - **Step 3B (Refinement Range — All Criteria):**
     If $\text{CurrentProficiency}(c) < 60.00$:
     $\implies \mathbf{NEEDS\_REFINEMENT}$ (Severity: High).
     If $60.00 \le \text{CurrentProficiency}(c) < 75.00$:
     $\implies \mathbf{NEEDS\_REFINEMENT}$ (Severity: Moderate; Developing competence requiring calibration to reach $75\%$ stability).
   - **Step 3C (Stable Proficient Range — All Criteria):**
     If $\text{CurrentProficiency}(c) \ge 75.00$:
     - For $c = \text{CRIT\_INVALID}$: Requires zero safety gate failures across all latest valid attempts.
     - For $c \neq \text{CRIT\_INVALID}$: Evaluated purely on its own proficiency $\ge 75.00$.
     $\implies \mathbf{STABLE\_PROFICIENT}$.

### 4.3 Complete Boundary Decision Table
Every possible input value in $[0.00, 100.00]$ maps to an unambiguous, mutually exclusive outcome:

| Criterion | Distinct Drills ($N$) | Current Proficiency | Safety Gate Status (SL) | Warning Present? | Formal Diagnostic Status | Severity / Note |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| Any | $0$ | `null` | Any | Any | `NO_DATA` | Zero attempts recorded |
| Any | $1$ | $[0.00, 100.00]$ | Any | Any | `INSUFFICIENT_DATA` | Evidence insufficient |
| `CRIT_INVALID` | $\ge 2$ | $0.00$ | Fail ($<18$) | Any | `CRITICAL_RISK` | Boundary minimum |
| `CRIT_INVALID` | $\ge 2$ | $59.99$ | Fail ($<18$) | Any | `CRITICAL_RISK` | High-risk capital hazard |
| `CRIT_INVALID` | $\ge 2$ | $60.00$ | Fail ($<18$) | Any | `CRITICAL_RISK` | Safety failure override |
| `CRIT_INVALID` | $\ge 2$ | $60.00$ | Pass ($\ge 18$) | No | `NEEDS_REFINEMENT` | Severity: Moderate |
| `CRIT_INVALID` | $\ge 2$ | $74.99$ | Pass ($\ge 18$) | Yes / No | `NEEDS_REFINEMENT` | Severity: Moderate |
| `CRIT_INVALID` | $\ge 2$ | $75.00$ | Pass ($\ge 18$) | No | `STABLE_PROFICIENT` | Stability achieved |
| `CRIT_INVALID` | $\ge 2$ | $100.00$ | Pass ($\ge 18$) | No | `STABLE_PROFICIENT` | Perfect score |
| Non-Invalidation | $\ge 2$ | $0.00$ | Any | Any | `NEEDS_REFINEMENT` | Severity: High |
| Non-Invalidation | $\ge 2$ | $59.99$ | Any | Any | `NEEDS_REFINEMENT` | Severity: High |
| Non-Invalidation | $\ge 2$ | $60.00$ | Any | No | `NEEDS_REFINEMENT` | Severity: Moderate |
| Non-Invalidation | $\ge 2$ | $65.00$ | Any | No | `NEEDS_REFINEMENT` | Severity: Moderate |
| Non-Invalidation | $\ge 2$ | $74.99$ | Any | Yes / No | `NEEDS_REFINEMENT` | Severity: Moderate |
| Non-Invalidation | $\ge 2$ | $75.00$ | Any | No | `STABLE_PROFICIENT` | Stability achieved |
| Non-Invalidation | $\ge 2$ | $100.00$ | Any | No | `STABLE_PROFICIENT` | Boundary maximum |

---

## 5. SECONDARY PEDAGOGICAL DIAGNOSTIC FLAGS

Pedagogical flags are informative annotations attached to a criterion to provide targeted feedback. They **NEVER override or alter the canonical diagnostic status**:

- **`FLAG_INVALIDATION_VULNERABLE`:** Attached to `CRIT_INVALID` when status is `CRITICAL_RISK`.
- **`FLAG_PREMATURE_ENTRY`:** Attached to `CRIT_ENTRY` when `CurrentProficiency(CRIT_ENTRY) < 65.0` while `CurrentProficiency(CRIT_BIAS) >= 80.0` (chasing market).
- **`FLAG_SUBOPTIMAL_RR`:** Attached to `CRIT_RR` when `CurrentProficiency(CRIT_RR) < 65.0` (accepting < 1:2.0 setups).
- **`FLAG_CONFIRMATION_DEFICIT`:** Attached to `CRIT_CONFIRM` when `CurrentProficiency(CRIT_CONFIRM) < 60.0` (skipping structural checklist).
- **`FLAG_EXECUTION_HESITATION`:** Attached when student erroneously selects NO-TRADE on a verified high-probability setup.

---

## 6. HANDLING SPECIAL SCENARIOS

### 6.1 Context- & Rubric-Driven NO-TRADE Evaluation `[PO MANDATE]`
- **No Blanket 100/100 Assumption:** Correctly selecting "NO-TRADE" on an unviable market setup does **NOT** automatically grant full marks (100%) across all 5 criteria.
- **Rubric-Based Evaluation Rule:**
  - Evaluators and evaluation engines must score each criterion based on the specific rubric rules and drill context.
  - If a student selects NO-TRADE, criteria that require trading levels (`CRIT_ENTRY`, `CRIT_INVALID`, `CRIT_RR`) are evaluated strictly in accordance with how the drill's rubric defines NO-TRADE handling (e.g. validating capital protection).
  - Subjective/textual criteria such as `CRIT_BIAS` (order flow assessment) and `CRIT_CONFIRM` (thesis rationale and checkboxes) must be evaluated based on the **reasons and evidence submitted by the student**. For example, if a student selects NO-TRADE but provides invalid bias reasoning or leaves the thesis blank, full points on `CRIT_BIAS` or `CRIT_CONFIRM` cannot be awarded.
  - Full credit is awarded only when explicitly supported by the rubric definition for that specific drill case.
- **Erroneous NO-TRADE on Valid Setup:**
  - If a student submits NO-TRADE on a high-probability valid setup, `CRIT_ENTRY` receives 0, and the case is evaluated for `FLAG_EXECUTION_HESITATION` (failure to execute valid edge).
- **Safety Gate Preservation:** The mandatory Invalidation Safety Gate requirement established in Task 5.2 remains uncompromised.

### 6.2 Distinguishing Wrong Decisions from Insufficient Data
- If a student has only submitted 1 drill with score 40%:
  - The UI displays: *"Percobaan 1/2 untuk diagnosis awal. Selesaikan minimal 1 studi kasus lagi untuk membuka pemetaan kelemahan objektif."*
  - The engine REFUSES to assign `CRITICAL_RISK` or `NEEDS_REFINEMENT` flags until the minimum $N_{\text{distinct}} \ge 2$ threshold is satisfied.

---

## 7. AUDIT CONCLUSION & READINESS

- **Mathematical Determinism:** The weakness classification formulas rely solely on existing fields in `DbDrillSubmission` (`evaluation_breakdown`).
- **Safety:** Zero LLM dependency. Diagnosis is completely explainable, transparent, and auditable.
- **Verdict:** Fully ready for architectural approval.

