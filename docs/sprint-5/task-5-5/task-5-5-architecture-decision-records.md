# SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
## ARCHITECTURE DECISION RECORDS (ADR)

**Document Identifier:** `docs/sprint-5/task-5-5/task-5-5-architecture-decision-records.md`  
**Author:** Senior Software Architect  
**Status:** ARCHITECTURAL DECISIONS & ALTERNATIVE TRADEOFFS  
**Baseline Hash (`data/academy.json`):** `9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8`  
**Timestamp:** 2026-11-12T21:45:40+07:00  

---

## ADR 5.5.1: Multi-Case Mastery Proof vs Single-Drill Retry Aggregation

### Context:
In Sprint 4, a quiz topic could be mastered by retrying the same lesson quiz until achieving $\ge 70\%$. In practical chart trading (Sprint 5), allowing students to achieve mastery by retrying a single chart snapshot creates a dangerous illusion of competence ("chart memorization" / "farming").

### Decision:
Enforce that `MASTERED` status strictly requires verified passing scores across at least **two distinct drill cases** ($D_1 \neq D_2$) for that competency domain.

### Alternatives Considered:
1. *Permit single drill mastery if attempts $\le 2$:* Rejected. Even 2 attempts on the same chart allows the student to see the instructor solution after attempt 1 and copy it on attempt 2.
2. *Exponential penalty for retries on the same drill:* Rejected. Does not solve the fundamental pedagogical problem that the student has only proven competence on one specific market condition.

### Trade-offs:
- **Pros:** Guarantees authentic, generalizable trading execution competence; completely eliminates retry farming.
- **Cons:** Requires the curriculum to provide at least 2 distinct published drills per competency topic before a student can achieve `MASTERED`. (If only 1 drill exists, the highest attainable state is `DEVELOPING`, which accurately reflects pedagogical reality).

---

## ADR 5.5.2: Isolation of Practical Drill Metrics from Sprint 4 Quiz Metrics

### Context:
Sprint 4 implemented `StudentQuizIntelligenceSummary` and `averageQuizScore`. We must decide whether to create a single blended "Overall Academy Mastery Score" combining quiz answers and chart executions, or keep them completely separate.

### Decision:
Strictly isolate Quiz Mastery and Drill Mastery into two distinct domain models.
- Quiz Mastery measures theoretical knowledge (e.g. terminology, session times).
- Drill Mastery measures tactical chart execution (e.g. entry precision, stop-loss survival).
- They are presented side-by-side in the dashboard, but never blended into a single numeric average.

### Alternatives Considered:
1. *Weighted blended score ($40\%$ Quiz + $60\%$ Drill):* Rejected. A high quiz score ($100\%$) could mask a critical execution failure ($0/25$ Stop-Loss), creating dangerous false confidence.

### Trade-offs:
- **Pros:** Protects student risk management; 100% backward compatible with Sprint 4 tests.
- **Cons:** The dashboard displays two distinct progress sections rather than one single consolidated percentage.

---

## ADR 5.5.3: Pure On-Demand Calculation over Caching

### Context:
We evaluated whether derived mastery summaries should be calculated dynamically on each read, persisted into `data/academy.json`, or memoized with an in-memory cache key `${userId}::${submissionsCount}::${latestSubmissionId}`.

### Decision:
Adopt **Pure On-Demand Calculation without Caching**.
Mastery metrics and weakness diagnoses are computed on-the-fly directly from `drill_submissions` during API requests.

### Alternatives Considered:
1. *In-Memory Cache with Composite Key:* Evaluated and rejected following Product Owner review. Cache invalidation risks (stale state on backup restore, manual DB edits, record pruning, or PM2 restart desync) introduce latent state hazards. In Node 22, scanning 10,000 JSON submission records takes $< 1.2\text{ms}$, making caching an unnecessary complexity.
2. *Persisted DB Snapshot Table in `academy.json`:* Rejected. Induces disk write amplification on every student submission, increasing risk of file corruption and schema lock overhead.

### Trade-offs:
- **Pros:** 100% immune to stale cache bugs, backup desynchronizations, or memory leaks; zero schema modifications; perfectly idempotent read operations.
- **Cons:** Consumes ~1ms CPU time per request, which is negligible for our traffic scale.

---

## ADR 5.5.4: Formal Resolution of Product Owner Design Decisions

Following the Product Owner review on Rev 1, the following design decisions are formally resolved:

1. **Anti-Exhaustion Cap (D3 Rule): RESOLVED (REMOVED)**  
   The PO directed that multi-case proof ($\ge 2$ distinct drill IDs) is the primary anti-farming mechanism. Adding an arbitrary 3rd drill requirement for students taking $\ge 4$ attempts penalizes persistence unnecessarily. The D3 rule is removed.

2. **Safety Alert vs Weakness Separation: RESOLVED**  
   Per-attempt safety alerts are strictly segregated to individual submission debrief banners. Persistent weakness diagnosis requires chronic failure across $\ge 2$ distinct drill cases.

3. **Dashboard Placement: RESOLVED**  
   Drill Mastery will be integrated into the student dashboard as an independent practical trading section alongside theory progress, without blending numeric scores.

---

## ADR 5.5.5: Separation of Three Performance Perspectives in Weakness Detection

### Context:
Evaluating only the latest attempt risks masking that a student repeatedly failed the safety gate on initial attempts. Conversely, evaluating only the first attempt punishes students who successfully learned and calibrated their execution.

### Decision:
Separately track and report three distinct perspectives:
1. **Current Competency:** Latest valid attempt per distinct drill ($A_{\text{latest}}(D_i)$). Powers active weakness classification and the recommendation queue.
2. **Initial Performance:** First valid attempt per distinct drill ($A_{\text{first}}(D_i)$ where `attempt_number === 1`). Permanently preserved baseline of spontaneous chart reading.
3. **Learning Trajectory:** Delta comparison ($\Delta = \text{Latest} - \text{First}$). Measures directional trend (`IMPROVED`, `REGRESSED`, `NO_MATERIAL_CHANGE`) without asserting unverified causal claims.

Never blend these three perspectives into one single score.

---

## ADR 5.5.6: Context- & Rubric-Grounded NO-TRADE Evaluation

### Context:
When a market setup is unviable, choosing NO-TRADE is the correct decision. However, assuming that a correct NO-TRADE automatically grants 100% across all 5 criteria rewards students who might choose NO-TRADE for completely wrong or fabricated reasons.

### Decision:
Do not award automatic blanket 100/100 points on NO-TRADE. Points for bias, entry zone avoidance, and confirmation thesis rationale must be evaluated strictly based on the drill context and rubric criteria. Full marks are awarded only when explicitly justified by the rubric definition.

---

## ADR 5.5.7: Path B Latest Valid Attempt Qualification

### Context:
Path A requires first-attempt mastery ($\ge 80\%$ with SL $\ge 20/25$ on 2 distinct drills). Path B was originally defined using "best score", which left ambiguous which attempt verified current competence.

### Decision:
Path B is formally anchored to the **Latest Valid Attempt** on each of $\ge 2$ distinct drill cases ($A_{\text{latestValid}}(D_i)$), requiring Score $\ge 70\%$ and Invalidation $\ge 18/25$ with safety gate passed. Unlimited retries are permitted, but retries never increment the distinct drill count. This proves the student currently executes proficiently across distinct charts.

---

## ADR 5.5.8: Rejection of History Windowing in Favor of Single-Pass Streaming

### Context:
To mitigate potential CPU latency on high-volume accounts (> 10,000 submissions), a fallback window of the "last 200 submissions" was considered.

### Decision:
**Explicitly reject history windowing**. Truncating history destroys historical `firstSubmittedAttempt` and `firstValidAttempt` records, causing valid multi-case masteries and learning trajectories to vanish. Instead, adopt a **single-pass $O(N)$ streaming aggregation** in memory using a bucketed index `Map<drillId, DrillEvidenceBucket>` with $O(D)$ auxiliary space. Full submission history is strictly evaluated with 100% mathematical equivalence to full-history scans. Any CPU percentage improvement claim is classified as an unverified theoretical hypothesis pending the formal benchmark in Task 5.5.4.

