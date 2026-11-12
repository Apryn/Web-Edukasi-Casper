# SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
## SECURITY, PRIVACY, PERFORMANCE & ATOMICITY REVIEW

**Document Identifier:** `docs/sprint-5/task-5-5/task-5-5-security-performance-review.md`  
**Author:** Senior Security Reviewer & Systems Architect  
**Status:** ARCHITECTURAL AUDIT & THREAT MODEL  
**Baseline Hash (`data/academy.json`):** `9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8`  
**Timestamp:** 2026-11-12T21:44:50+07:00  

---

## 1. THREAT MODEL & PRIVACY ENFORCEMENT

The architectural review evaluated potential attack vectors against Task 5.5:

### 1.1 Insecure Direct Object References (IDOR)
- **Threat:** An attacker manipulates a query parameter (e.g. `GET /api/drills/mastery?userId=victim_123`) to view another student's submission history, weakness diagnostic, or mastery level.
- **Enforcement `[VERIFIED IN SOURCE]`:** The proposed controller rejects all user-supplied ID parameters. The caller identity is derived strictly from `getSessionUser(req)` which unpacks and cryptographically verifies the server's signed JWT token from the `auth_token` cookie or Authorization header. Submissions are queried strictly by `s.user_id === user.id`.

### 1.2 Answer Key & Secret Leakage
- **Threat:** The mastery and recommendation endpoints expose `model_answer`, exact ideal price zones, or tolerance formulas while explaining student weaknesses.
- **Enforcement `[VERIFIED IN SOURCE]`:** The `StudentDrillIntelligenceSummary` and `DrillRecommendationResult` schemas contain only high-level feedback strings and aggregate percentages. The underlying `model_answer` and `rubric_snapshot` remain strictly internal to the server evaluation service.

### 1.3 Journal Boundary & Financial Privacy
- **Threat:** An administrator attempting to review drill mastery accidentally gains access to the student's personal trading journal.
- **Enforcement `[VERIFIED IN SOURCE]`:** The drill engine and student journals are completely decoupled. `data/journals/` is inaccessible to drill handlers. Admin Education Intelligence endpoints aggregate cohort metrics (e.g. "80% of students failed Invalidation on Drill X") without exposing student trade records.

---

## 2. PERFORMANCE & ATOMICITY ANALYSIS IN SINGLE PM2 FORK

### 2.1 The Single PM2 Fork Architectural Invariant `[VERIFIED IN SOURCE]`
Signal Casper Academy operates on a **single Node.js PM2 fork process** with a single JSON database file (`data/academy.json`).
- **No Distributed Locks:** Systems relying on Redis or multi-instance Postgres locks are not present.
- **In-Memory Concurrency Control:** Concurrency is governed by `withSubmissionLock` in `lib/drill-storage.ts` using in-memory promises, and `executeMutation` in `lib/db.ts` which serializes disk writes.

### 2.2 Calculation Architecture Evaluation: Pure On-Demand vs Stored Snapshot vs Cache

The audit evaluated three architectural strategies for calculating student drill mastery:

| Strategy | Description | Pros | Cons | Recommendation |
| :--- | :--- | :--- | :--- | :---: |
| **Strategy A: Pure On-Demand** | Recompute mastery metrics and weakness diagnoses dynamically on every `GET` request from raw `drill_submissions`. | Zero risk of stale or drifted summaries; absolute source-of-truth integrity; zero cache desynchronization on PM2 restart, backup restoration, or record deletion; 0 schema mutations in `academy.json`. | Memory/CPU cost for scanning submissions (*Note: $< 1.2\text{ms}$ for 10k records is an unverified theoretical estimate pending formal benchmark*). | **SELECTED & ADOPTED** |
| **Strategy B: Stored DB Snapshot** | Save pre-computed `mastery` and `weakness` objects directly into a new table in `academy.json` on each submit. | Fast reads. | High risk of write amplification; risks corruption if async update fails; mutates DB schema. | **REJECTED** |
| **Strategy C: In-Memory Cache** | Cache projection in an in-memory map keyed by `${userId}::${submissionsCount}::${latestSubmissionId}`. | Avoids redundant calculation loops on repeated reads. | Risk of cache desync upon database restore from backup, record deletion, or process restarts. Complexity does not justify caching. | **REJECTED** |

**Architectural Decision (Product Owner Approved):**  
Task 5.5 formally adopts **Strategy A (Pure On-Demand Calculation)**.
1. When a student or teacher requests mastery / weakness data, the engine computes it dynamically in memory directly from `drill_submissions`.
2. **Performance Claim Status:** Any prior mention of $< 1.2\text{ms}$ aggregation latency for 10,000 submissions is formally classified as an **UNVERIFIED THEORETICAL ESTIMATE**. A formal performance verification benchmark will be executed during the authorized implementation phase (Task 5.5.4) measuring:
   - Representative dataset (10,000 synthetic submission records).
   - Documented hardware and Node.js runtime environment.
   - Warm vs. cold execution times.
   - Median and p95 latency percentiles.
   - Separate isolation of in-memory aggregation time from file I/O latency.
3. Pure on-demand calculation completely eliminates any risk of stale cache, cache invalidation race conditions, or desync after database restoration from backups.
4. Reads are 100% idempotent and induce ZERO disk writes.

### 2.3 Performance Optimization Strategy: Mathematically Equivalent Single-Pass Streaming `[PO MANDATE]`
- **Rejection of History Windowing:** Any proposal to truncate historical analysis to "the last 200 submissions" is **EXPLICITLY REJECTED**. Truncating history destroys `firstSubmittedAttempt` and `firstValidAttempt` evidence, causes previously earned multi-case masteries to vanish retroactively, and breaks Learning Trajectory calculations.
- **Single-Pass $O(N)$ Aggregation Architecture:**
  Instead of multiple nested `.filter()` and `.sort()` calls over `drill_submissions`, the engine processes a student's history in a **single linear pass ($O(N)$)**:
  ```ts
  interface DrillEvidenceBucket {
    drillId: string;
    firstSubmittedAttempt: DbDrillSubmission | null;
    firstValidAttempt: DbDrillSubmission | null;
    latestValidAttempt: DbDrillSubmission | null;
    validAttemptsCount: number;
    totalAttemptsCount: number;
  }
  ```
  1. The engine scans the student's submissions in chronological order once.
  2. For each submission $s$:
     - Updates `firstSubmittedAttempt` if `s.attempt_number === 1`.
     - Validates $A_{\text{valid}}$ integrity. If valid:
       - Sets `firstValidAttempt` if not already set.
       - Always updates `latestValidAttempt` to $s$.
       - Increments `validAttemptsCount`.
  3. All subsequent calculations (Path A, Path B, Current Competency, Initial Performance, Trajectory Deltas) operate directly over the resulting `Map<string, DrillEvidenceBucket>`.
- **Formal Algorithmic Complexity:**
  - **Time Complexity:** $\mathcal{O}(N)$ strictly linear, where $N$ is the student's total historical submission count in `drill_submissions`.
  - **Auxiliary Space Complexity:** $\mathcal{O}(D)$ where $D$ is the count of distinct drills attempted ($D \le N$), storing only pointers in memory.
- **Mathematical Equivalence Guarantee:** This single-pass streaming architecture processes 100% of the student's historical records and produces results **100% mathematically identical** to a naive full-history scan, without dropping a single byte of historical evidence.
- **Performance Claim Status:** Any projected claim of $> 85\%$ CPU reduction compared to multiple `.filter().sort()` passes is classified as an **UNVERIFIED THEORETICAL HYPOTHESIS**. Actual CPU time and memory allocation will be empirically measured and documented during the authorized Task 5.5.4 benchmark. Zero historical windowing or 200-submission caps are permitted.

---

## 3. ATOMIC WRITE & RECOVERY INTEGRITY

- `executeMutation` in `lib/db.ts` uses atomic `.tmp` file writing followed by atomic file renaming (`fs.renameSync`).
- Because Task 5.5 does NOT require persisting derived summaries to disk, **Task 5.5 induces ZERO additional disk write operations during reads**.
- The existing database baseline hash (`9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8`) is completely insulated from read operations.

---

## 4. AUDIT CONCLUSION & READINESS

- **Zero DB Schema Footprint:** No new tables or schema migrations required in `data/academy.json`.
- **Concurrency Safe:** Operates within single PM2 fork memory boundaries without race conditions.
- **Verdict:** Fully ready for architectural approval.

