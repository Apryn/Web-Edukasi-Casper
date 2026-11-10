# SIGNAL CASPER ACADEMY — SPRINT 5
# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Title:** Practical Learning & Interactive Drill Engine  
**Sprint:** Sprint 5  
**Priority Focus:** Option B — Practical Learning & Interactive Drill  
**Status:** PLANNING ONLY — NO IMPLEMENTATION  
**Document Version:** 1.0.0  
**Target Audience:** Students, Instructors/Curriculum Authors, Administrators  
**Date:** November 10, 2026  

---

## 1. PROBLEM STATEMENT & BACKGROUND

Across Sprints 1 to 4, Signal Casper Academy successfully established:
1. System infrastructure, authentication, and database persistence (Sprint 1).
2. Structured course curriculum, module/lesson navigation, and admin course editing (Sprint 2).
3. Student trade journaling with BigInt minor-unit precision and statistical analytics (Sprint 3).
4. Adaptive learning intelligence, mastery matrix, and retention tracking (Sprint 4).

### The Pedagogical Gap
While students can read lessons and answer multiple-choice quizzes (evaluating theoretical recall), there is currently no mechanism to evaluate whether a student can **apply** theoretical concepts to actual market price action before executing live trades. 

Multiple-choice questions (MCQs) are prone to guessing and fail to capture multi-variable decision-making such as:
- Identifying whether market conditions warrant taking a position or staying on the sidelines (**"No-Trade" discipline**).
- Pinpointing exact structural invalidation levels (Stop-Loss) versus dynamic targets (Take-Profit).
- Articulating coherent trade rationale rooted in concepts like Liquidity Sweeps, Order Blocks, and Fair Value Gaps (FVG).

### The Solution: Practical Drill Engine
Sprint 5 introduces the **Practical Drill Engine**, a dedicated simulation environment where students interact with curated, verified static/historical chart case studies. Students submit structured trade decisions (Bias, Entry, Invalidation/SL, Target/TP, Confirmation, and Reasoning) or select a disciplined "No-Trade" stance. The system deterministically evaluates submissions against transparent, multi-dimensional rubrics, returning granular educational feedback without ever risking real capital or fabricating outcomes.

---

## 2. GOALS & NON-GOALS

### 2.1 Primary Goals
1. **Bridge Theory to Execution**: Provide hands-on practice directly linked to curriculum modules (e.g. Market Structure, Liquidity, Risk Management).
2. **Transparent Multi-Dimensional Assessment**: Grade submissions across distinct criteria (Bias Identification, Entry Timing, Risk/Reward Ratio, Invalidation Placement, and Conceptual Rationale) rather than a crude pass/fail.
3. **Reward Invalidation & "No-Trade" Decisions**: Emphasize capital preservation by teaching students that recognizing unconfirmed or unfavorable conditions and choosing not to enter is a high-skill trading decision.
4. **Seamless Integration with Learning Intelligence**: Feed drill evaluations into existing telemetry and recommendation engines as distinct `DRILL_SUBMITTED` events without corrupting existing MCQ quiz metrics.
5. **Pre-Session Psychological Preparedness**: Introduce an educational Trade Preparation Checklist to instill rigorous pre-flight routines before trading.

### 2.2 Non-Goals & Out-of-Scope (Strict Boundaries)
1. **NO Live Trading or Execution Engine**: Drills do NOT connect to brokers, MetaTrader, cTrader, or webhooks.
2. **NO Real-Time Market Streaming / Signals**: Does NOT ingest live WebSocket feeds; cases are strictly curated historical/static case studies with immutable provenance.
3. **NO Integration with Private Trading Journal in Sprint 5**: Drill records and private trading journals remain strictly separated to preserve student privacy and prevent premature causal assumptions between study scores and journal P/L.
4. **NO Automated Journal Trade Population**: Completing a checklist or drill will NEVER automatically inject a trade entry into the user's journal.
5. **NO Predictive Performance Claims**: Signal Casper Academy will never claim or imply that achieving high drill scores guarantees trading profitability.
6. **NO External / Paid AI Dependencies**: Rubrics, evaluations, and explanations are deterministically processed server-side using TypeScript logic and predefined instructor rubrics without recurring API costs.

---

## 3. USER PERSONAS & TARGET USERS

### Persona 1: Arya (Novice Student)
- **Background**: Completed "XAUUSD Basic" lessons and passed MCQ quizzes, but feels paralyzed when looking at open charts without guidelines.
- **Need**: Guided case studies where he can test his understanding of Order Blocks without risking money, receiving instant, clear explanations on why his Stop-Loss was placed too tightly or his target was unrealistic.

### Persona 2: Maya (Intermediate Trader)
- **Background**: Understands technical patterns but suffers from overtrading and FOMO (Fear Of Missing Out).
- **Need**: Scenario drills that challenge her patience, specifically drills where the correct answer is `NO_TRADE` due to lack of confirmation or high-impact news proximity.

### Persona 3: Casper Academy Content Team (Admin / Instructor)
- **Background**: Professional analyst creating institutional trading curriculum.
- **Need**: An administrative Drill Builder to author chart case studies, annotate key levels, configure scoring rubrics with reasonable price tolerances, and preview student evaluation flows before publishing.

---

## 4. USER STORIES & ACCEPTANCE CRITERIA

### Epic 1: Interactive Chart Case (P0)

#### US-1.1: Chart Case Inspection
*As a student, I want to inspect a curated historical chart case study with clear timeframe, instrument, and context so that I can analyze the market structure accurately.*
- **AC 1.1.1**: The case display shows Instrument (`XAUUSD`), Timeframe (`H4`, `H1`, `M15`, etc.), Context Date/Session, and a brief educational background prompt.
- **AC 1.1.2**: The student can inspect the chart via responsive zoom and pan controls (keyboard/mouse controls, reset zoom).
- **AC 1.1.3**: Chart provenance is explicitly displayed: Source, Historical Timestamp range, and Curator verification badge.
- **AC 1.1.4**: Answer keys, instructor annotations, and explanation text are **strictly omitted** from the initial API response payload.

---

### Epic 2: Structured Decision Drill (P0)

#### US-2.1: Multi-Type Drill Interaction
*As a student, I want to submit my technical evaluation using a structured form suited to the specific drill type so that my decision-making process is captured accurately.*
- **AC 2.1.1**: The platform supports 4 distinct drill types:
  1. `DIRECTION_BIAS`: Determine dominant order flow (Bullish / Bearish / Sideways/Neutral) and timeframe reasoning.
  2. `LEVEL_IDENTIFICATION`: Identify key structural levels (Supply/Demand, Liquidity Pool, FVG boundary).
  3. `SETUP_EXECUTION`: Complete trade setup: Decision (Buy / Sell / No-Trade), Entry zone, Stop-Loss, Take-Profit, and Entry Trigger confirmation.
  4. `INVALIDATION_RISK`: Determine the exact price where the thesis fails and calculate achievable Risk-to-Reward (R:R).
- **AC 2.1.2**: For `SETUP_EXECUTION`, selecting `NO_TRADE` disables Entry/SL/TP inputs and requires the student to select the invalidation reason (e.g. "Low R:R", "Major Liquidity Not Taken", "Choppy Range", "Impending High-Impact News").
- **AC 2.1.3**: When numerical prices are entered, the system dynamically calculates and displays the implied Risk/Reward ratio in real time before submission.

---

### Epic 3: Transparent Evaluation & Explanation Engine (P0)

#### US-3.1: Rubric-Based Scoring
*As a student, I want my drill submission evaluated against a transparent rubric with price tolerances so that I understand exactly where my technical analysis was accurate and where it fell short.*
- **AC 3.1.1**: Submissions are evaluated server-side across weighted rubric criteria:
  - Market Bias & Context (e.g. 20%)
  - Structural Level / Zone Placement (e.g. 25% with configurable $\pm \text{tolerance}$)
  - Invalidation / Stop-Loss Logic (e.g. 25%)
  - Target / Risk-Reward Viability (e.g. 15% with minimum threshold, e.g. 1:2)
  - Setup Confirmation & Reasoning (e.g. 15%)
- **AC 3.1.2**: If the instructor designated `NO_TRADE` as the model answer and the student correctly chose `NO_TRADE` with valid reasoning, the student receives 100% on the execution criteria.
- **AC 3.1.3**: The result payload returns:
  - Total percentage score ($0 - 100\%$) and Pass/Fail status (based on drill passing score, default 70%).
  - Detailed breakdown per criterion with points earned, points possible, and specific feedback explaining deviations.
  - Comprehensive instructor debrief revealing the ideal outcome chart annotation and educational key takeaway.

---

### Epic 4: Learning Progress & Recommendation Integration (P1)

#### US-4.1: Unified Progress & Mastery Enrichment
*As a student, I want my drill achievements recorded in my learning profile so that my topic mastery and recommended next steps reflect my practical skills.*
- **AC 4.1.1**: Drill submissions emit a distinct telemetry event `DRILL_SUBMITTED` into the FIFO event buffer.
- **AC 4.1.2**: Drill results are stored in a dedicated collection `drill_submissions` in `data/academy.json`, completely segregated from `quiz_submissions` to prevent semantic dilution.
- **AC 4.1.3**: Topic Mastery levels take into account drill performance: a topic with both quiz passed and drill passed qualifies for `MASTERED` status.
- **AC 4.1.4**: If a student scores below passing on a drill, the Adaptive Recommendation Engine generates a `RETRY_DRILL` or `REVIEW_WEAK_TOPIC` action card pointing back to the foundational lesson.

---

### Epic 5: Trade Preparation Checklist (P1)

#### US-5.1: Pre-Session Routine Checklist
*As a student, I want an educational pre-session checklist to audit my psychological state, technical setup, and risk parameters before interacting with live charts.*
- **AC 5.1.1**: Pre-session checklist covers 5 essential pillars:
  1. *Mental State & Environment*: Calm, focused, well-rested, no revenge-trading mindset.
  2. *Market Context & Calendar*: High-impact economic calendar checked (FOMC, CPI, NFP).
  3. *Technical Setup Confirmation*: Higher timeframe bias aligned, valid liquidity sweep confirmed.
  4. *Risk Parameters*: Maximum account risk defined ($\le 1-2\%$), lot size calculated.
  5. *Execution & Invalidation Plan*: Hard Stop-Loss predetermined, accepted risk before entry.
- **AC 5.1.2**: If the student answers negatively to critical psychological or risk questions, the checklist provides an explicit advisory: *"Kondisi Anda tidak optimal untuk mengambil risiko hari ini. Pertimbangkan untuk observasi atau latihan drill."*
- **AC 5.1.3**: Completed checklists are saved to student learning history for personal review. Checklists NEVER create journal trade records.

---

### Epic 6: Admin Drill Builder (P2)

#### US-6.1: Drill Authoring & Rubric Configuration
*As an administrator, I want to create, preview, test, and publish practical drill case studies so that I can continually expand the Academy's practical curriculum.*
- **AC 6.1.1**: Admin workspace provides a Drill Builder form: Case title, slug, linked course/lesson, instrument, timeframe, historical date range, context prompt.
- **AC 6.1.2**: Admin uploads or links clean chart image assets and optional solution overlay assets.
- **AC 6.1.3**: Admin configures the scoring rubric, model answers (Bias, Entry Zone, SL, TP, Valid Rationale tags), and numerical tolerance (e.g. $\pm 1.50$ for Gold price).
- **AC 6.1.4**: Admin can run a "Test Rubric Simulation" with sample inputs to verify that point distribution calculates as expected before publishing.
- **AC 6.1.5**: Draft drills are invisible to students; only `PUBLISHED` drills are accessible. Changes are tracked in `admin_audit_logs`.

---

## 5. NON-FUNCTIONAL REQUIREMENTS (NFR)

1. **Security & Data Confidentiality**:
   - Answer keys, instructor solution coordinates, and debrief notes must NEVER be exposed in student GET endpoints before successful submission.
   - All grading must occur strictly on the server (`/api/drills/[id]/submit`).
2. **Determinism & Performance**:
   - Rubric calculation must be 100% deterministic (same input $\rightarrow$ identical output).
   - Evaluation execution latency must not exceed $100\text{ms}$ on server.
3. **Data Integrity & Storage Safety**:
   - All mutations must utilize the existing atomic write mechanism (`writeAtomicFileWithBackup`) with zero corruption risk.
   - Drills and submissions must support backward-compatible schema expansion.
4. **Responsive UI & Accessibility**:
   - Drill workspace and interactive chart view must be fully usable across Desktop ($1440\text{px}$), Tablet ($768\text{px}$), and Mobile ($390\text{px}$ / $360\text{px}$) with zero horizontal window scroll.
5. **No External Service Dependencies**:
   - Zero reliance on external paid APIs (no OpenAI, no TradingView paid licenses, no external DB).

