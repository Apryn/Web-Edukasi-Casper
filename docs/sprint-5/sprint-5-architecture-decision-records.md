# SIGNAL CASPER ACADEMY — SPRINT 5
# ARCHITECTURE DECISION RECORDS (ADR) — REVISION 3

**Title:** Practical Drill & Interactive Learning Engine Architecture Decision Records  
**Sprint:** Sprint 5  
**Document Version:** 3.0.0  
**Status:** PLANNING ONLY — REVISED POST PRODUCT OWNER CONSISTENCY REVIEW (REV 3)  
**Baseline:** Sprint 1–4 Accepted & Frozen  
**Date:** November 12, 2026  

---

## RECORD 1: ADR-014 — Deterministic Server-Side Rubrics vs AI-Powered Grading

### Context
In evaluating student trade rationale and chart analysis, external AI services (e.g. OpenAI GPT, Anthropic Claude) could be considered for grading free-form text.

### Decision
We use **Deterministic Server-Side Rubric Grading** using TypeScript logic, categorical keyword matching, and defined numerical price tolerances. We **explicitly reject** external paid AI grading services.

### Consequences
- **Positive**: 100% deterministic, instant execution ($< 50\text{ms}$), zero API bills, completely testable via automated unit tests.
- **Trade-off**: Rationale grading relies on structured tags and curated keyword sets rather than fluid semantic conversation.

---

## RECORD 2: ADR-015 — Dedicated `drill_submissions` Collection as Permanent SSOT

### Context
Sprint 2 introduced `quiz_submissions` and Sprint 4 introduced `learning_events` (with a 10,000 FIFO event ring buffer). We must establish where drill history lives.

### Decision
Store all practical drill submissions in a **dedicated, first-class `drill_submissions` collection** within `data/academy.json`. `drill_submissions` is the **permanent Single Source of Truth (SSOT)**. `learning_events` emits `DRILL_SUBMITTED` for reporting, but ring buffer eviction will never erase student drill completion history.

### Consequences
- **Positive**: Complete domain segregation; zero risk of breaking existing quiz metrics; 100% durability across high telemetry volume.

---

## RECORD 3: ADR-016 — Scoped Zero-Dependency Chart Viewer vs Full Charting Library

### Context
Students need to inspect chart cases, zoom into candles, and select price levels. Heavy libraries like `lightweight-charts` or `TradingView` add dependency weight and require full OHLC tick streams.

### Decision
Build a lightweight, **scoped interactive chart viewer** supporting touch gestures, CSS transform matrix pan-zoom ($1.0\times - 3.0\times$), crosshair readout, and normalized coordinate level placement ($0.0 - 1.0$). **Explicitly avoid** building a full-blown TradingView clone.

### Consequences
- **Positive**: Zero new dependencies, zero security vulnerabilities, ultra-fast load time, tight alignment with Casper dark aesthetic.

---

## RECORD 4: ADR-017 — Strict Separation between Drill Engine and Private Trading Journal

### Context
Drill completions could theoretically be pushed to student trading journals as practice trades.

### Decision
Maintain a **strict architectural firewall** between the Drill Engine and the Private Trading Journal in Sprint 5. Drills are purely educational simulations. No automated journal trade generation is permitted.

### Consequences
- **Positive**: Preserves student privacy, prevents causal confusion between course drills and live trading performance, and avoids corrupting Sprint 3 journal analytics.

---

## RECORD 5: ADR-018 — Mandatory Invalidation / Stop-Loss Safety Gate

### Context
A student could theoretically achieve 70% overall by correctly guessing Bias, Entry, and Take-Profit while placing an irresponsible or absent Stop-Loss. In institutional trading, trading without proper risk invalidation is an unacceptable risk of ruin.

### Decision
Enforce a **Mandatory Safety Gate**: To achieve `evaluationStatus = "PASSED"`, a student must score **$\ge 70\%$ overall AND $\ge 18 / 25$ points on `CRIT_INVALID`**.
If $\text{Total Score} \ge 70$ but $\text{Score}_{\text{invalid}} < 18$, the status is **`FAILED_SAFETY_GATE`**.
In `NO_TRADE` mode, `CRIT_INVALID` evaluates capital preservation rationale, awarding full credit (25/25) for valid risk identification without requiring a numerical stop-loss price.

### Consequences
- **Positive**: Instills institutional risk discipline; prevents students from advancing with dangerous risk management habits.

---

## RECORD 6: ADR-019 — SVG Rejection by Default & Multi-Layer Binary Image Validation

### Context
SVG images are XML documents that can embed executable JavaScript (`<script>` or event handlers), posing Stored XSS risks if uploaded by administrators or compromised accounts. Regex-based sanitization is prone to filter bypasses.

### Decision
1. **Reject SVG by default**.
2. **Accept only PNG and WebP formats**.
3. Validate files using **server-side binary magic bytes inspection** and **dimension parsing** ($\le 3840\times 2160$, total pixels $\le 8,294,400$, size $\le 2.5\text{MB}$).
4. **Segregate Asset Storage**:
   - Draft charts: `data/drills/drafts/[id]/` (private non-public).
   - Published charts: `public/drills/published/[id]/v[version]/` (clean static chart without answers).
   - Solution overlays: `data/drills/solutions/[id]/` (private; served only via authenticated route post-submission).

### Consequences
- **Positive**: Eliminates SVG XSS attack vectors at the root; prevents answer leaks through public URL guessing.

---

## RECORD 7: ADR-020 — Unlimited Retries with Version-Locked Attempt History

### Context
A 3-minute cooldown was originally considered to prevent rapid guessing. However, forced waiting frustrates motivated students who want to immediately correct their mistakes.

### Decision
1. **Remove artificial cooldown timers**. Students can retry immediately.
2. Store every attempt as an **immutable historical record** in `drill_submissions`.
3. Track `attemptsCount`, `firstScore`, `latestScore`, and `bestScore` as derived summary fields.
4. Lock `drill_version` and `rubric_version` with each submission so future rubric adjustments never retroactively alter past scores.

---

## RECORD 8: ADR-021 — Distinct Drill Evidence Requirement for Practical Mastery

### Context
Allowing mastery through two consecutive passes on the exact same drill enables students to memorize answers through rapid trial and error without demonstrating broad structural understanding.

### Decision
To earn `MASTERED` status on a topic, a student must pass the module quiz ($\ge 70\%$) **AND** satisfy one of two rigorous pathways:
- **Pathway A (First-Attempt Excellence)**: Pass on the very first attempt with score $\ge 80\%$ and invalidation score $\ge 20/25$.
- **Pathway B (Demonstrated Consistency across Distinct Drills)**: Pass at least **two distinct drills** (`drill_id_A` $\ne$ `drill_id_B`) within the same topic with score $\ge 70\%$ and invalidation score $\ge 18/25$.
Repeating the same drill multiple times counts as only **one** source of evidence.

### Consequences
- **Positive**: Guaranteed conceptual mastery across varied market conditions; eliminates rote answer memorization.

---

## RECORD 9: ADR-022 — Per-User Mutex & Idempotency Key Concurrency Control

### Context
Rapid duplicate clicks or concurrent API submissions from the same user could cause race conditions in the single-file JSON database (`academy.json`), leading to duplicate attempt increments or corrupted writes.

### Decision
1. Serialize submissions per `(userId, drillId)` using an in-memory queue (`withSubmissionLock`).
2. Require an `Idempotency-Key` header on all submission requests.
3. If a duplicate idempotency key is received within 24 hours, return the cached result with `200 OK` and `X-Cache-Lookup: HIT-IDEMPOTENT`, without incrementing attempt numbers.

### Consequences
- **Positive**: Zero race conditions; network retry resilience; 100% deterministic attempt numbering.
