# SIGNAL CASPER ACADEMY — SPRINT 5
# ARCHITECTURE DECISION RECORDS (ADR)

**Title:** Practical Drill & Interactive Learning Engine Architecture Decision Records  
**Sprint:** Sprint 5  
**Document Version:** 1.0.0  
**Status:** PLANNING ONLY — NO IMPLEMENTATION  
**Date:** November 10, 2026  

---

## RECORD 1: ADR-014 — Deterministic Server-Side Rubrics vs AI-Powered Grading

### Context
In evaluating student trade rationale and chart analysis, modern systems frequently consider Large Language Model (LLM) APIs (such as OpenAI GPT or Anthropic Claude) to evaluate open-ended text.

### Decision
We choose **Deterministic Server-Side Rubric Grading** using TypeScript logic, categorical keyword matching, and defined numerical price tolerances. We **explicitly reject** external paid AI grading services.

### Alternatives Considered
1. *External LLM Prompt-based Grading*: Send student rationale and chart coordinates to an LLM API.
   - *Rejected*: Incurs recurring operational costs, introduces non-deterministic grading (inconsistent scores for identical inputs), suffers from potential API latency ($2-5\text{s}$), and violates the explicit constraint of no paid external services.
2. *Simple Exact-Match Regex*:
   - *Rejected*: Too rigid; fails to account for reasonable price tolerances in volatile instruments like XAUUSD (e.g. entry off by 20 cents).

### Consequences
- **Positive**: 100% deterministic, instant execution ($< 10\text{ms}$), zero API bills, completely testable via automated unit tests.
- **Trade-off**: Rationale grading relies on structured tags and curated keyword sets rather than fluid semantic conversation.

---

## RECORD 2: ADR-015 — Separate `drill_submissions` Collection vs Merging into `quiz_submissions`

### Context
Sprint 2 introduced `quiz_submissions` for multiple-choice quizzes. Sprint 5 adds practical drill evaluations. We must decide whether to store drill evaluations in the existing `quiz_submissions` table or create a dedicated `drill_submissions` collection.

### Decision
Create a **dedicated, first-class `drill_submissions` collection** within `data/academy.json`.

### Alternatives Considered
1. *Merge into `quiz_submissions` with a `type: "DRILL"` discriminator*:
   - *Rejected*: Pollutes the schema of `quiz_submissions`, which assumes simple integer question indices and binary answers. Drill answers contain complex multi-field objects (Bias, Entry, SL, TP, R:R, Rationale, Criteria Breakdown). Merging would require risky migrations and could corrupt Sprint 2/Sprint 4 quiz metrics.

### Consequences
- **Positive**: Complete domain segregation; zero risk of breaking existing quiz queries, reports, or data structures.
- **Trade-off**: Requires a small, backward-compatible migration function to initialize the new array in `academy.json`.

---

## RECORD 3: ADR-016 — Zero-Dependency SVG/Canvas Chart Viewer vs Heavy Charting Libraries

### Context
Students need to inspect chart case studies, zoom into key price action, and pan across historical candles. Popular charting libraries include `lightweight-charts`, `TradingView Charting Library`, or `Chart.js`.

### Decision
Build a lightweight, **zero-dependency interactive SVG/Canvas viewer** supporting touch gestures, CSS transform matrix pan-zoom, and crosshair overlays.

### Alternatives Considered
1. *Installing `lightweight-charts`*:
   - *Rejected for Sprint 5*: Increases bundle size by ~150KB and requires full OHLC data serialization for every case study. High-resolution annotated chart images and clean SVG candles satisfy all educational drill requirements with zero new npm dependencies.

### Consequences
- **Positive**: Zero new dependencies, zero security audit flags, lightweight, full visual alignment with Casper dark editorial styling.
- **Trade-off**: Chart data is presented as curated case studies rather than dynamic tick-by-tick animated candles.

---

## RECORD 4: ADR-017 — Strict Separation between Drill Engine and Private Trading Journal

### Context
Students might expect drill completions to automatically record practice trades into their trading journal.

### Decision
Maintain a **strict architectural firewall** between the Drill Engine and the Private Trading Journal in Sprint 5. Drills are purely educational activities.

### Alternatives Considered
1. *Automatically injecting drill decisions into the student's trading journal as "SIMULATED" trades*:
   - *Rejected*: Violates Sprint 3 privacy boundaries and confuses educational practice with personal trading records. Might distort real performance statistics (Win Rate, Drawdown) in the analytics engine.

### Consequences
- **Positive**: Preserves data purity, student privacy, and system boundaries.
- **Trade-off**: Students wishing to log a drill in their journal must do so manually.

---

## 5. DECISIONS REQUIRING PRODUCT OWNER APPROVAL

Before proceeding to implementation, the following 3 architectural decisions are submitted for Product Owner review:

1. **Drill Passing Score Threshold**:
   - *Recommendation*: Set standard passing threshold to **70%** (consistent with theoretical quizzes), with a minimum requirement of obtaining at least 15/25 on Invalidation/Stop-Loss to prevent "passing with unsafe risk management".
   - *Alternative*: Require 80% passing score for practical drills to enforce higher rigor.

2. **Allowing Unlimited Re-Attempts vs Cooldown Timer**:
   - *Recommendation*: Allow unlimited re-attempts with latest score and best score tracked, but enforce a 3-minute cooldown between attempts to encourage students to read the debrief rather than rapidly guessing price levels.
   - *Alternative*: No cooldown (immediate retry allowed).

3. **Chart Asset Storage Location**:
   - *Recommendation*: Store curated drill chart assets in `public/drills/charts/[drill-id]/` using hashed filenames and server-side SVG sanitization.
   - *Alternative*: Store base64 data URLs directly in `academy.json` (rejected by engineering due to potential file bloat, but available if single-file portability is strictly demanded).

