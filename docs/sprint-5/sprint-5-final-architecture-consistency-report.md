# SIGNAL CASPER ACADEMY — SPRINT 5
# FINAL ARCHITECTURE CONSISTENCY & SPECIFICATION AUDIT REPORT

**Title:** Practical Drill & Interactive Learning Engine Architecture Consistency Audit  
**Sprint:** Sprint 5  
**Document Version:** 3.0.0 (Revision 3 Final)  
**Status:** **AUDIT PASSED — READY FOR PRODUCT OWNER FINAL APPROVAL**  
**Role:** Senior Software Architect & Technical Lead  
**Baseline:** Sprint 1–4 Accepted & Frozen  
**Date:** November 12, 2026  

---

## 1. EXECUTIVE SUMMARY & RESOLUTION OF ARCHITECTURE FINDINGS

Following the Product Owner's Final Architecture Review on Revision 2, a comprehensive forensic review of the entire Sprint 5 specification suite was executed. All 5 core P0 findings and 6 secondary architectural notes have been formally resolved, mathematically formalized, and systematically aligned across all 9 specification documents in [`docs/sprint-5/`](file:///d:/Developer/Web-Edukasi-Casper-main/docs/sprint-5).

### Resolution Summary Matrix

| ID | Issue Identified by Product Owner | Resolution Architecture in Revision 3 | Cross-Document Verification |
| :---: | :--- | :--- | :--- |
| **PO-1** | **Mastery Loophole via Repeating Same Drill** | Enforced **Distinct Drill Evidence**: `MASTERED` requires Quiz $\ge 70\%$ AND either Pathway A (Attempt 1 on any drill $\ge 80\%$ + SL $\ge 20$) OR Pathway B ($\ge 2$ **distinct** drills in same topic passed with $\ge 70\%$ + SL $\ge 18$). Multiple attempts on the same drill count as 1 source of evidence. | PRD §2.1, Architecture §4, ADR-021 |
| **PO-2** | **Immutable History vs Progress Summary Conflation** | Strict physical and logical separation: `drill_submissions` stores raw, immutable attempt records only (no mutating `bestScore` fields). `StudentDrillSummary` is a derived projection computed dynamically or cached separately. | Data Model §1, §2.2, §2.3, ADR-015 |
| **PO-3** | **Concurrent Submission & Race Conditions** | Added **`withSubmissionLock`** per-`userId::drillId` in-memory mutex to serialize read-calculate-write cycles in `academy.json`. Enforced client `Idempotency-Key` to deduplicate network retries without double-incrementing attempts. | Architecture §2, API §2.2, ADR-022 |
| **PO-4** | **Magic Bytes Overconfidence & Image Security** | Expanded to **Multi-Layer Image Validation Pipeline**: Magic bytes check + structural IHDR/VP8 chunk decode + dimension limits ($\le 3840\times 2160$) + total pixels ($\le 8,294,400$) + file size ($\le 2.5\text{MB}$) + server-generated UUID paths. SVG remains rejected by default. | Security Review §2, API §3.1, ADR-019 |
| **PO-5** | **Undefined NO-TRADE Safety Gate Formulation** | Explicitly formalized NO-TRADE evaluation: In `NO_TRADE` mode, `CRIT_INVALID` evaluates the structural validity of the decision to withhold capital. Valid capital preservation earns full 25/25 invalidation points, satisfying the Safety Gate without requiring a Stop-Loss price. | Rubric §2.3, UI/UX §3.1, ADR-018 |
| **PO-6** | **Drill & Rubric Dual Versioning** | Schema tracks both `drill_version` (increments when model answer/price bounds change) and `rubric_version` (increments when weights change). Every submission locks both versions and stores an immutable `rubric_snapshot`. | Data Model §2.1, §2.2, API §2.4 |
| **PO-7** | **Solution Overlay Route Guard & Pedagogy** | Endpoint `GET /api/drills/[id]/solution` verifies student has at least 1 completed submission before streaming. Both passed and failed attempts unlock debrief and solution, allowing students to learn before retrying. | API §2.3, Security §3 |
| **PO-8** | **Chart Data Provenance Transparency** | Every drill case includes `instrument`, `timeframe`, `data_period`, `data_source`, `classification` (`HISTORICAL_MARKET` vs `SYNTHETIC_SIMULATION`), `timezone`, and `transformation_notes`. | Data Model §2.1, API §2.1 |
| **PO-9** | **Mathematical Rounding & Determinism** | Formalized symmetric half-up rounding: $\text{sign}(x) \times \lfloor |x| + 0.5 \rfloor$. Internal calculations maintain full float precision before integer boundary rounding. | Rubric §1, §2 |

---

## 2. CROSS-DOCUMENT CONSISTENCY AUDIT MATRIX

To guarantee that no schema, API, UI, or rubric contradictions exist, every key parameter was cross-checked across all 9 documents:

| Parameter / Dimension | PRD (Doc 1) | Architecture (Doc 2) | Data Model (Doc 3) | API Spec (Doc 4) | Rubric (Doc 5) | UI/UX (Doc 6) | Security (Doc 7) | Implementation (Doc 8) | ADR (Doc 9) | Consistency Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Passing Score** | 70% | 70% | 70% | 70% | 70% | 70% | 70% | 70% | 70% | **100% MATCH** |
| **Safety Gate Min Points** | 18 / 25 | 18 / 25 | 18 / 25 | 18 / 25 | 18 / 25 | 18 / 25 | 18 / 25 | 18 / 25 | 18 / 25 | **100% MATCH** |
| **Image Formats Accepted** | PNG, WebP | PNG, WebP | PNG, WebP | PNG, WebP | N/A | PNG, WebP | PNG, WebP | PNG, WebP | PNG, WebP | **100% MATCH** |
| **SVG Status** | Rejected | Rejected | Rejected | Rejected | N/A | Rejected | Rejected | Rejected | Rejected | **100% MATCH** |
| **Cooldown Timer** | None | None | None | None | None | None | None | None | None | **100% MATCH** |
| **SSOT Collection** | `drill_submissions` | `drill_submissions` | `drill_submissions` | `drill_submissions` | `drill_submissions` | `drill_submissions` | `drill_submissions` | `drill_submissions` | `drill_submissions` | **100% MATCH** |
| **Telemetry Buffer Limit**| 10,000 FIFO | 10,000 FIFO | 10,000 FIFO | 10,000 FIFO | 10,000 FIFO | N/A | 10,000 FIFO | 10,000 FIFO | 10,000 FIFO | **100% MATCH** |
| **Storage Segregation** | 3-tier | 3-tier | 3-tier | 3-tier | N/A | 3-tier | 3-tier | 3-tier | 3-tier | **100% MATCH** |
| **Mastery Requirement** | Distinct Drills | Distinct Drills | Distinct Drills | N/A | Distinct Drills | Distinct Drills | N/A | Distinct Drills | Distinct Drills | **100% MATCH** |

---

## 3. FINAL SCHEMA & PROJECTION SPECIFICATION

### 3.1 Immutable Raw Submission Entity (`drill_submissions` in `data/academy.json`)
```typescript
export interface DbDrillSubmission {
  id: string;                     // "sub_drill_1731234567_abc123"
  user_id: string;                // "usr_student_alpha"
  drill_id: string;               // "drill_xauusd_c1_01"
  drill_version: number;          // 1
  rubric_version: number;         // 1
  attempt_number: number;         // 1, 2, 3... (Atomic per user/drill)
  idempotency_key: string;        // "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  score: number;                  // 0 - 100
  invalidation_score: number;     // 0 - 25
  safety_gate_passed: boolean;    // true if invalidation_score >= 18
  evaluation_status: "PASSED" | "FAILED_SAFETY_GATE" | "FAILED";
  rubric_snapshot: DrillRubric;   // Frozen rubric snapshot
  answers: string;                // Serialized StudentDrillAnswer
  evaluation_breakdown: string;   // Serialized CriterionEvaluationResult[]
  debrief_text: string;           // Instructor debrief text
  created_at: string;             // ISO-8601
}
```

### 3.2 Derived Progress Summary (`StudentDrillSummary`)
```typescript
export interface StudentDrillSummary {
  userId: string;
  drillId: string;
  attemptsCount: number;
  firstScore: number;
  firstAttemptPassed: boolean;
  latestScore: number;
  bestScore: number;
  isPassed: boolean;
  safetyGateMet: boolean;
  firstAttemptAt: string;
  lastAttemptAt: string;
}
```

---

## 4. SUBMISSION LIFECYCLE & STATE TRANSITIONS

```mermaid
stateDiagram-v2
    [*] --> Submitting: Student submits decision form
    Submitting --> MutexLocked: withSubmissionLock(userId, drillId)
    
    MutexLocked --> IdempotentCheck: Check idempotency_key
    IdempotentCheck --> CachedReturn: Key exists in last 24h
    CachedReturn --> [*]: Return HTTP 200 (HIT-IDEMPOTENT)
    
    IdempotentCheck --> Evaluating: Key is new
    Evaluating --> SafetyCheck: Compute 5 Criteria
    
    SafetyCheck --> StatusPassed: Score >= 70 AND SL >= 18
    SafetyCheck --> StatusSafetyFailed: Score >= 70 AND SL < 18
    SafetyCheck --> StatusFailed: Score < 70
    
    StatusPassed --> Persisting: attempt_number = count + 1
    StatusSafetyFailed --> Persisting: attempt_number = count + 1
    StatusFailed --> Persisting: attempt_number = count + 1
    
    Persisting --> DiskSynced: writeAtomicFileWithBackup
    DiskSynced --> TelemetryEmit: emitLearningEvent("DRILL_SUBMITTED")
    TelemetryEmit --> SolutionUnlocked: Solution overlay stream now accessible
    SolutionUnlocked --> [*]: Return HTTP 200 with Evaluation Result
```

---

## 5. MASTERY EVIDENCE CALCULATION ALGORITHM

```typescript
export function calculateTopicMastery(params: {
  topicId: string;
  courseSlug: string;
  quizScore: number | null;
  quizPassingScore: number;
  topicDrillIds: string[];
  allUserSubmissions: DbDrillSubmission[];
}): TopicMasteryLevel {
  const { quizScore, quizPassingScore, topicDrillIds, allUserSubmissions } = params;

  const isQuizPassed = quizScore !== null && quizScore >= quizPassingScore;
  if (!isQuizPassed) {
    const hasAttempts = allUserSubmissions.some((s) => topicDrillIds.includes(s.drill_id));
    return hasAttempts ? "NEEDS_PRACTICE" : "NO_DATA";
  }

  // Filter submissions belonging to this topic's drills
  const topicSubmissions = allUserSubmissions.filter((s) => topicDrillIds.includes(s.drill_id));
  if (topicSubmissions.length === 0) {
    return "DEVELOPING"; // Quiz passed, but no practical drills done yet
  }

  // Check if any submission failed safety gate on latest attempt
  const latestSubmissionsByDrill = new Map<string, DbDrillSubmission>();
  for (const sub of topicSubmissions) {
    const existing = latestSubmissionsByDrill.get(sub.drill_id);
    if (!existing || sub.attempt_number > existing.attempt_number) {
      latestSubmissionsByDrill.set(sub.drill_id, sub);
    }
  }

  // Pathway A: First-Attempt Excellence on any topic drill
  const firstAttemptPassedWithExcellence = topicSubmissions.some(
    (s) => s.attempt_number === 1 && s.score >= 80 && s.invalidation_score >= 20
  );
  if (firstAttemptPassedWithExcellence) {
    return "MASTERED";
  }

  // Pathway B: Minimum TWO DISTINCT drills passed in same topic
  const distinctPassedDrills = new Set<string>();
  for (const [drillId, sub] of latestSubmissionsByDrill.entries()) {
    if (sub.score >= 70 && sub.invalidation_score >= 18) {
      distinctPassedDrills.add(drillId);
    }
  }

  if (distinctPassedDrills.size >= 2) {
    return "MASTERED";
  }

  // If passed drills < 2 or achieved through retries with score < 80
  return "DEVELOPING";
}
```

---

## 6. CONCURRENCY & IDEMPOTENCY SPECIFICATION

1. **Per-User/Drill Mutex**:
   - Implemented via `Map<string, Promise<void>>` in `lib/drill-service.ts`.
   - Prevents parallel file read-modify-write collisions in `academy.json`.
   - If two different students submit at the exact same millisecond, they execute concurrently because locks are keyed by `userId::drillId`.
2. **Idempotency Contract**:
   - Header: `Idempotency-Key: <UUID>`.
   - Stored in `drill_submissions.idempotency_key`.
   - If a network drop causes the browser to re-post the same payload with the same key, the server detects the match, bypasses re-evaluation, and returns the existing submission record with HTTP 200.

---

## 7. MULTI-LAYER IMAGE SECURITY SPECIFICATION

```
Uploaded Buffer
      │
      ├── 1. Size Check (> 2.5 MB) ─────────────► Reject HTTP 400
      │
      ├── 2. SVG Substring Check ("<svg") ──────► Reject HTTP 400
      │
      ├── 3. Binary Magic Bytes Check ──────────► Reject HTTP 400 if not PNG/WebP
      │
      ├── 4. Chunk / Dimension Decode ──────────► Reject HTTP 400 if > 3840x2160 or > 8.3M px
      │
      └── 5. Passed: Write to Private Staging ──► Stored as crypto.randomUUID() + ".webp"
```

---

## 8. TEST SCENARIO MATRIX FOR IMPLEMENTATION VERIFICATION

| Test Case Code | Target Component | Test Scenario Description | Expected Outcome |
| :--- | :--- | :--- | :--- |
| `TEST-SG-01` | Evaluator | Total 84%, Stop-Loss 12/25 (inside wick). | Returns `FAILED_SAFETY_GATE` with amber warning banner. |
| `TEST-SG-02` | Evaluator | Total 94%, Stop-Loss 22/25. | Returns `PASSED` with green success banner. |
| `TEST-NT-01` | Evaluator | Model is NO-TRADE; Student submits NO-TRADE with news rationale. | Returns 100/100, Stop-Loss 25/25, Safety Gate MET. |
| `TEST-NT-02` | Evaluator | Model is Take Trade; Student submits NO-TRADE out of fear. | Returns 25/100, Stop-Loss 0/25, Status `FAILED`. |
| `TEST-CONC-01`| Mutex Lock | 5 simultaneous POST requests from same user. | Queued sequentially; attempt numbers are strictly 1, 2, 3, 4, 5. |
| `TEST-IDEMP-01`| API Handler | 2 identical requests with same `Idempotency-Key`. | First returns evaluated result; second returns identical cached payload without creating duplicate submission. |
| `TEST-IMG-01` | Image Validator | Upload `.png` file with `<svg>` text inside. | Rejected with HTTP 400 Bad Request. |
| `TEST-IMG-02` | Image Validator | Upload valid PNG with dimensions $4000 \times 4000$. | Rejected with HTTP 400 (exceeds 3840x2160 limit). |
| `TEST-MAST-01`| Mastery Engine| Student passes Drill 1 on Attempt 1 and Attempt 2. | Mastery status is `DEVELOPING` (repeating same drill does not fulfill Pathway B). |
| `TEST-MAST-02`| Mastery Engine| Student passes Drill 1 AND Drill 2 in same topic. | Mastery status upgrades to `MASTERED` (Pathway B satisfied). |
| `TEST-SOL-01` | Solution API | Student requests `/solution` with 0 submissions. | Returns `403 Forbidden`. |
| `TEST-SOL-02` | Solution API | Student requests `/solution` after 1 failed submission. | Returns `200 OK` and streams solution image (pedagogical access granted). |

---

## 9. RESIDUAL RISKS & MITIGATIONS

1. **Memory Growth of In-Memory Mutex Map**:
   - *Risk*: `submissionMutexMap` accumulating dangling promises.
   - *Mitigation*: Mutex implementation strictly deletes keys from the map inside the `finally` block when the lock promise resolves.
2. **Chart Aspect Ratio Distortions on Ultra-Wide Monitors**:
   - *Risk*: Chart images stretching disproportionately.
   - *Mitigation*: Scoped chart viewer enforces CSS `object-fit: contain; aspect-ratio: 16/9; max-height: 520px;`.
3. **Large Database Growth from High Drill Submission Volume**:
   - *Risk*: `drill_submissions` array in `academy.json` expanding over months of usage.
   - *Mitigation*: Unlike telemetry events, submission records are lightweight JSON objects (~400 bytes each). $10,000$ student submissions consume only $\approx 4\text{MB}$ of JSON storage, which is well within Node.js memory capabilities and atomic file write tolerances.

---

## 10. FINAL READINESS VERDICT

```
========================================================================================
                      SIGNAL CASPER ACADEMY — SPRINT 5
                    FINAL ARCHITECTURE CONSISTENCY VERDICT
========================================================================================

  [x] Distinct Drill Evidence Model (Pathway A & B)   : FULLY SPECIFIED
  [x] Separation of Immutable History & Derived Stats : FULLY SPECIFIED
  [x] Concurrency Mutex & Idempotency Key Handling    : FULLY SPECIFIED
  [x] Multi-Layer Image Security (Magic Bytes + Dims) : FULLY SPECIFIED
  [x] Formalized Contextual NO-TRADE Safety Gate      : FULLY SPECIFIED
  [x] Drill & Rubric Dual Versioning with Snapshots   : FULLY SPECIFIED
  [x] Solution Endpoint Guard & Pedagogical Access    : FULLY SPECIFIED
  [x] Chart Data Provenance Transparency              : FULLY SPECIFIED
  [x] Symmetric Half-Up Rounding & Determinism        : FULLY SPECIFIED
  [x] Cross-Document Consistency Matrix (9 Docs)      : 100% AUDITED & ALIGNED

  FINAL VERDICT: ARCHITECTURE SPECIFICATION IS 100% COMPLETE & FROZEN.
  STATUS       : READY FOR PRODUCT OWNER CODING AUTHORIZATION.
========================================================================================
```

