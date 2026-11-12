# SIGNAL CASPER ACADEMY — SPRINT 5
# PRODUCT REQUIREMENTS DOCUMENT (PRD) — REVISION 3

**Title:** Practical Learning & Interactive Drill Engine  
**Sprint:** Sprint 5  
**Priority Focus:** Option B — Practical Learning & Interactive Drill  
**Status:** PLANNING ONLY — REVISED POST PRODUCT OWNER CONSISTENCY REVIEW (REV 3)  
**Document Version:** 3.0.0  
**Baseline:** Sprint 1–4 Accepted & Frozen  
**Date:** November 12, 2026  

---

## 1. PROBLEM STATEMENT & BACKGROUND

Across Sprints 1 to 4, Signal Casper Academy established:
1. Core system authentication and single-file JSON persistence with atomic backups (Sprint 1).
2. Structured course curriculum, module/lesson navigation, and admin course editing (Sprint 2).
3. Student trade journaling with BigInt minor-unit precision and statistical analytics (Sprint 3).
4. Adaptive learning intelligence, topic mastery matrix, and retention tracking (Sprint 4).

### The Pedagogical Gap
Multiple-choice questions (MCQs) are prone to guessing and fail to capture multi-variable market decision-making:
- Identifying whether market conditions warrant taking a position or staying on the sidelines (**"No-Trade" discipline**).
- Pinpointing exact structural invalidation levels (Stop-Loss) versus realistic expansion targets (Take-Profit).
- Articulating coherent trade rationale rooted in concepts like Liquidity Sweeps, Order Blocks, and Fair Value Gaps (FVG).

### The Practical Drill Engine Solution
Sprint 5 introduces the **Practical Drill Engine**, a dedicated simulation environment where students interact with curated, verified static/historical chart case studies. Students submit structured trade decisions (Bias, Entry, Invalidation/SL, Target/TP, Confirmation, and Reasoning) or select a disciplined `NO_TRADE` stance. The system deterministically evaluates submissions against transparent, multi-dimensional rubrics, returning granular educational feedback without ever risking real capital or fabricating outcomes.

---

## 2. GOALS & NON-GOALS (PRODUCT OWNER BOUNDARIES)

### 2.1 Primary Goals
1. **Bridge Theory to Execution**: Provide hands-on practice directly linked to curriculum modules (e.g. Market Structure, Liquidity, Risk Management).
2. **Transparent Multi-Dimensional Assessment with Safety Gate**:
   - Overall Passing Score: **$\ge 70\%$**.
   - Mandatory Invalidation/Stop-Loss Safety Gate: **$\ge 18 / 25$ points**. Both conditions must be met to pass. A submission with 75% overall that scored 14/25 on Stop-Loss is flagged as **FAILED_SAFETY_GATE** ("Belum Lulus — Manajemen Risiko Tidak Memenuhi Standar Keselamatan").
3. **Rigorous Contextual "NO-TRADE" Evaluation**:
   - When a case study has unconfirmed market structure or high event risk, choosing `NO_TRADE` with valid structural rationale earns full credit across all execution criteria.
   - In `NO_TRADE` mode, the student is NOT required to submit an Entry or Stop-Loss price; the Safety Gate is evaluated based on the validity of the risk preservation rationale.
4. **Immutable Attempt History & Derived Progress Summary**:
   - Every attempt is stored immutably in `drill_submissions`.
   - Aggregated metrics (`firstScore`, `latestScore`, `bestScore`, `attemptCount`, `lastAttemptAt`) are stored separately and are 100% rebuildable from the raw submission history.
5. **Strict Mastery Evidence — Distinct Drill Requirement**:
   - Achieving `MASTERED` status requires passing the module quiz ($\ge 70\%$) **AND** either:
     - **Pathway A (First-Attempt Excellence)**: Passing on the first attempt with $\text{Score} \ge 80\%$ and $\text{Score}_{\text{invalid}} \ge 20/25$.
     - **Pathway B (Demonstrated Consistency across Distinct Drills)**: Passing at least **two distinct drills** (`drill_id_A` $\ne$ `drill_id_B`) within the same topic with $\text{Score} \ge 70\%$ and $\text{Score}_{\text{invalid}} \ge 18/25$.
     - *(Repeating the same drill multiple times does NOT count as two separate proofs of mastery)*.
6. **Concurrent Submission Protection & Idempotency**:
   - Serialized read-calculate-write using mutex locks.
   - Client-provided `Idempotency-Key` prevents duplicate records during network retries.
7. **Multi-Layer Image Security**:
   - PNG and WebP only (SVG rejected by default).
   - Validates file headers (magic bytes), image dimensions ($\le 3840 \times 2160$), total pixels ($\le 8.3\text{M}$), and structural chunk integrity.
8. **Segregated Asset Storage**:
   - Drafts stored in private server storage (`data/drills/drafts/[id]/`).
   - Clean public charts stored without solutions in `public/drills/published/[id]/v[version]/`.
   - Solution overlays stored in private storage (`data/drills/solutions/[id]/`), accessible only via authenticated endpoint after at least one submission has been permanently recorded.

### 2.2 Strict Non-Goals & Out-of-Scope
1. **NO Live Trading or Broker Execution**: Drills do NOT connect to brokers, MetaTrader, cTrader, or webhooks.
2. **NO Real-Time Streaming Data / Live Signals**: Drills use static historical case studies with immutable provenance.
3. **NO Integration with Private Trading Journal in Sprint 5**: Drill records and private trading journals remain strictly segregated to preserve student privacy and prevent premature causal assumptions between study scores and journal P/L.
4. **NO Automated Journal Trade Population**: Completing a checklist or drill will NEVER automatically inject a trade entry into the user's journal.
5. **NO External / Paid AI Dependencies**: Rubrics, evaluations, and explanations are deterministically processed server-side using TypeScript logic and predefined instructor rubrics without recurring API costs.
6. **NO Complex TradingView Charting Engine Cloning**: The chart viewer is strictly scoped to zoom, pan, crosshair, and structural level/coordinate selection.

---

## 3. USER PERSONAS & TARGET USERS

### Persona 1: Arya (Novice Student)
- **Background**: Completed "XAUUSD Basic" lessons and passed MCQ quizzes, but feels hesitant analyzing unannotated charts.
- **Need**: Guided case studies where he can test his understanding of Order Blocks without risking money, receiving instant, clear explanations on why his Stop-Loss was placed too tightly or his target was unrealistic.

### Persona 2: Maya (Intermediate Trader)
- **Background**: Understands technical patterns but suffers from overtrading and FOMO (Fear Of Missing Out).
- **Need**: Scenario drills that challenge her patience, specifically drills where the correct answer is `NO_TRADE` due to lack of confirmation or high-impact news proximity.

### Persona 3: Casper Academy Content Team (Admin / Instructor)
- **Background**: Professional analyst creating institutional trading curriculum.
- **Need**: An administrative Drill Builder to author chart case studies, upload PNG/WebP chart assets, annotate key levels, configure scoring rubrics with reasonable price tolerances, and preview student evaluation flows before publishing.

---

## 4. USER STORIES & ACCEPTANCE CRITERIA (REVISION 3)

### Epic 1: Interactive Chart Case & Provenance (P0)

#### US-1.1: Chart Case Inspection
*As a student, I want to inspect a curated historical chart case study with clear timeframe, instrument, and provenance so that I can analyze the market structure accurately.*
- **AC 1.1.1**: Displays Instrument (`XAUUSD`), Timeframe (`H4`, `H1`, `M15`), Context Period, Data Provider, Historical/Simulated classification, and UTC Timezone.
- **AC 1.1.2**: Scoped chart controls: responsive pan, zoom ($1.0\times - 3.0\times$), crosshair coordinate readout, and level placement indicators.
- **AC 1.1.3**: Supported chart formats: **PNG and WebP only**. SVG is rejected by default to eliminate client-side XSS vectors.
- **AC 1.1.4**: Answer keys, instructor annotations, and solution overlay images are **strictly omitted** from the initial student API response payload.

---

### Epic 2: Structured Decision Drill (P0)

#### US-2.1: Multi-Type Drill Interaction
*As a student, I want to submit my technical evaluation using a structured form suited to the specific drill type so that my decision-making process is captured accurately.*
- **AC 2.1.1**: The platform supports 4 distinct drill types:
  1. `DIRECTION_BIAS`: High timeframe order flow & bias analysis.
  2. `LEVEL_IDENTIFICATION`: Key zone & liquidity pool identification.
  3. `SETUP_EXECUTION`: Complete trade setup: Decision (Take Position / NO_TRADE), Entry zone, Stop-Loss, Take-Profit, and Entry Trigger confirmation.
  4. `INVALIDATION_RISK`: Invalidation placement & R:R feasibility analysis.
- **AC 2.1.2**: For `SETUP_EXECUTION`, selecting `NO_TRADE` disables Entry/SL/TP inputs and requires the student to select the contextual invalidation reason (e.g. "Low R:R", "Major Liquidity Not Taken", "Choppy Range", "Impending High-Impact News").
- **AC 2.1.3**: When numerical prices are entered, the system dynamically calculates and displays the implied Risk/Reward ratio in real time before submission.
- **AC 2.1.4**: Students can interactively click the chart to populate Entry, Invalidation (SL), and Target (TP) coordinates or input them manually.

---

### Epic 3: Transparent Evaluation & Explanation Engine (P0)

#### US-3.1: Rubric-Based Scoring with Safety Gate
*As a student, I want my drill submission evaluated against a transparent rubric with safety gate enforcement so that I understand exactly where my technical analysis was accurate and whether my risk management was safe.*
- **AC 3.1.1**: Submissions are evaluated server-side across 5 weighted rubric criteria:
  - `CRIT_BIAS`: Market Bias & Context (20 Points)
  - `CRIT_ENTRY`: Entry Zone Accuracy (25 Points)
  - `CRIT_INVALID`: Invalidation / Stop-Loss Placement (25 Points) — **Safety Gate: Minimum 18 Points**
  - `CRIT_RR`: Risk/Reward Viability (15 Points)
  - `CRIT_CONFIRM`: Setup Confirmation & Reasoning (15 Points)
- **AC 3.1.2**: Dual Passing Condition:
  $$\text{Pass Status} = (\text{TotalScore} \ge 70) \land (\text{Score}_{\text{invalid}} \ge 18)$$
  If $\text{TotalScore} \ge 70$ but $\text{Score}_{\text{invalid}} < 18$, status is `FAILED_SAFETY_GATE` with message: *"Skor Anda mencapai 70%, namun kriteria Stop-Loss/Invalidasi belum memenuhi batas keselamatan minimum (18/25). Posisi dengan perlindungan risiko tidak memadai dianggap tidak lulus."*
- **AC 3.1.3**: In `NO_TRADE` mode, `CRIT_INVALID` is evaluated against the validity of the reasons for NOT trading. Full 25 points are awarded for disciplined capital preservation, satisfying the Safety Gate without requiring a Stop-Loss price.
- **AC 3.1.4**: Evaluation breakdown displays points earned, points possible, and specific feedback explaining deviations per criterion.
- **AC 3.1.5**: Upon completed submission, the student receives the instructor debrief and can access the solution overlay via a secured route.

---

### Epic 4: Unlimited Retries & Immutable Attempt History (P1)

#### US-4.1: Attempt History & Versioning
*As a student, I want to re-attempt drills without cooldown timers and see my past progression so that I can learn from my mistakes.*
- **AC 4.1.1**: No artificial cooldown timer. Students can re-attempt immediately after reviewing feedback.
- **AC 4.1.2**: Every attempt is stored as an immutable record in `drill_submissions`.
- **AC 4.1.3**: Progress summary is derived: `firstScore`, `latestScore`, `bestScore`, `attemptsCount`, `firstAttemptAt`, and `lastAttemptAt`.
- **AC 4.1.4**: Each submission stores a snapshot of `drill_version`, `rubric_version`, and the exact rubric weights applied, ensuring future drill edits by admin never retroactively alter past scores.

---

### Epic 5: Learning Intelligence Integration & Mastery (P1)

#### US-5.1: SSOT Durability & Distinct Drill Mastery
*As a student, I want my drill progress integrated into my learning dashboard while keeping my historical records permanent.*
- **AC 5.1.1**: `drill_submissions` in `data/academy.json` is the sole Single Source of Truth for drill completion. Telemetry `learning_events` emits `DRILL_SUBMITTED` for engagement reporting, but eviction in the 10,000 FIFO buffer does not affect drill records.
- **AC 5.1.2**: Topic Mastery formula enforces distinct drill evidence:
  - `NEEDS_PRACTICE`: Quiz failed OR drill failed safety gate.
  - `DEVELOPING`: Quiz passed ($\ge 70\%$) but drill not completed, OR drill passed with retries on only a single drill.
  - `MASTERED`: Quiz passed ($\ge 70\%$) **AND** either:
    1. First-attempt pass on a drill with score $\ge 80\%$ and invalidation score $\ge 20/25$.
    2. Passing at least **two distinct drills** within the topic with score $\ge 70\%$ and invalidation score $\ge 18/25$.
- **AC 5.1.3**: Recommendation Engine generates `PRACTICE_DRILL` (Priority 88) when theory is complete, or `RETRY_DRILL` (Priority 94) when safety gate fails.

---

### Epic 6: Trade Preparation Checklist (P1)

#### US-6.1: Pre-Session Routine Checklist
*As a student, I want an educational pre-session checklist to audit my psychological state, technical setup, and risk parameters before trading.*
- **AC 6.1.1**: Covers 5 pillars: Mental state, economic calendar, technical setup confirmation, risk limit ($\le 1-2\%$), and execution/invalidation plan.
- **AC 6.1.2**: Provides immediate advisory verdict (`OPTIMAL`, `CAUTION_PROCEED_WITH_CARE`, or `DO_NOT_TRADE_TODAY`).
- **AC 6.1.3**: Stored in `trade_preparation_checklists` in `data/academy.json`. Strictly DOES NOT create journal trades.

---

### Epic 7: Admin Drill Builder & Asset Security (P2)

#### US-7.1: Authoring & Storage Segregation
*As an administrator, I want to create, test, and publish drills with secure asset storage.*
- **AC 7.1.1**: Authoring form for drill metadata, instructions, rubric criteria, model answers, and price tolerances.
- **AC 7.1.2**: Image Upload accepts **PNG and WebP only** (SVG rejected). Enforces magic bytes verification, image dimension validation ($\le 3840 \times 2160$), max $2.5\text{MB}$, and structural decoding check.
- **AC 7.1.3**: Storage Segregation:
  - Draft charts saved to `data/drills/drafts/[drill-id]/` (private, admin-only).
  - Published charts saved to `public/drills/published/[drill-id]/v[version]/` (clean chart without answers).
  - Solution overlays saved to `data/drills/solutions/[drill-id]/` (private, served only to students post-submission).
- **AC 7.1.4**: Test simulation tool to verify rubric point calculations with mock inputs prior to publishing.
- **AC 7.1.5**: Administrative audit log records all authoring and publishing actions.

---

## 5. NON-FUNCTIONAL REQUIREMENTS (NFR)

1. **Security & Integrity**:
   - Zero answer-key leakage in client network payloads.
   - SVG uploads rejected by default; image magic bytes and dimensions validated server-side.
   - Private storage for drafts and solution overlays.
   - Concurrency serialization and idempotency keys on submissions.
2. **Deterministic Grading**:
   - 100% deterministic score calculation ($< 50\text{ms}$ execution time).
   - Strict symmetric half-up rounding: $\text{sign}(x) \times \lfloor |x| + 0.5 \rfloor$.
3. **Data Durability & Isolation**:
   - `drill_submissions` SSOT independent of telemetry eviction.
   - Complete architectural firewall between drills and student trading journals.
4. **Responsive UI**:
   - Scoped chart viewer and drill workspace responsive across Desktop ($1440\text{px}$), Tablet ($768\text{px}$), and Mobile ($390\text{px}$ / $360\text{px}$) with zero horizontal window scroll.
