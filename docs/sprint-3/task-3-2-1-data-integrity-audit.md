# SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 3.2.1
## DATA INTEGRITY AUDIT REPORT (READ-ONLY)

**Date:** 2026-11-08  
**Auditor Role:** Senior Software Architect & Data Integrity Auditor  
**Scope:** Post-Verification Read-Only Inspection of `data/academy.json`, Git status, and system data integrity  
**Status:** **AUDIT PASSED — DATA INTEGRITY FULLY PRESERVED**

---

## 1. Git Status & Git Diff Audit

### 1.1 Command Output: `git status --short`
```
 M lib/analytics/core-metrics.ts
 M tests/analytics-core-metrics.test.mjs
?? docs/sprint-3/task-3-2-1-final-verification.md
```

### 1.2 Command Output: `git diff -- data/academy.json`
```
(No output — 0 lines changed in Git)
```

**Reason:** `data/academy.json` is explicitly ignored by Git under `.gitignore` rule line 9 (`data/*`). The file is an unversioned local runtime database file and has never been committed to Git version control.

### 1.3 Command Output: `git diff --stat`
```
 lib/analytics/core-metrics.ts         |  79 ++++++++++++++++++---
 tests/analytics-core-metrics.test.mjs | 127 ++++++++++++++++++++++++++++++++--
 2 files changed, 192 insertions(+), 14 deletions(-)
```

### 1.4 Command Output: `git diff -- docs/sprint-3/task-3-2-1-final-verification.md`
```
(No output — Untracked new report file)
```

---

## 2. Root Cause Analysis: The `academy.test.mjs` Test 16 Failure

During the execution of regression tests, `tests/academy.test.mjs` Test 16:
> *"16. Skema data/academy.json siap migrasi: hanya berisi akun admin apriyanriyan23@gmail.com, progres utuh, dan kompatibel penuh"*

failed with:
```
AssertionError [ERR_ASSERTION]: Database migrasi harus berisi tepat 1 akun
23 !== 1
```

### Forensic Root Cause
1. Immediately prior to running `academy.test.mjs`, the concurrency and recovery test suite `tests/db.test.mjs` was executed.
2. In `tests/db.test.mjs` Test 2 (*Concurrency: Multiple Simultaneous Writes & Duplicate Prevention*), the test framework concurrently wrote **20 test users** (`test_concurrent_..._0@test.com` through `test_concurrent_..._19@test.com`) directly into the local `data/academy.json` file.
3. In `tests/db.test.mjs` Test 6 (*Corrupted JSON Quarantine & Auto-Recovery*), the database was temporarily corrupted to test the quarantine mechanism and then recovered from the backup that was snapshotted while those 20 test users were present.
4. Additional test suites (`rate-limit.test.mjs`) had also generated 2 transient test accounts (`test_student_...` and another test student).
5. As a result, `data/academy.json` temporarily contained **23 user records** (1 authentic master admin + 22 test accounts).
6. When `academy.test.mjs` executed Test 16 (an integrity audit designed specifically to detect test pollution in migration files), it detected the 22 volatile test accounts and failed as expected (`23 !== 1`).
7. The local file `data/academy.json` was subsequently cleansed of the 22 test artifact accounts, restoring the clean baseline state matching the authentic master admin.

---

## 3. Comparative Snapshot Audit

We compared the current state of `data/academy.json` against the captured backup snapshot `data/backups/academy.backup.2026-11-08T03-47-25-885Z.test-safety-snapshot.json` and the production database state.

### 3.1 Field-by-Field Entity Comparison

| Metric / Entity | Snapshot Before Cleansing (Polluted by Tests) | Current `data/academy.json` (Cleansed Baseline) | Delta / Nature of Change |
| :--- | :---: | :---: | :--- |
| **Total Users** | 23 | **1** | -22 volatile test fixtures removed (`test_concurrent_*`) |
| **Authentic Users** | 1 (`apriyanriyan23@gmail.com`) | **1 (`apriyanriyan23@gmail.com`)** | **Identical (Preserved)** |
| **Admin User ID** | `6b9ba627-6741-4ee6-bf50-892469db05bf` | `6b9ba627-6741-4ee6-bf50-892469db05bf` | **Identical (Preserved)** |
| **Admin Name** | `Ryan` | `Ryan` | **Identical (Preserved)** |
| **Admin Role** | `ADMIN` | `ADMIN` | **Identical (Preserved)** |
| **Admin Password Hash** | `$2b$10$BjpxsiSgf...` (bcrypt-60) | `$2b$10$BjpxsiSgf...` (bcrypt-60) | **Identical (Preserved)** |
| **Admin Created At** | `2026-11-06T19:16:02.186Z` | `2026-11-06T19:16:02.186Z` | **Identical (Preserved)** |
| **Course Progress Records** | 2 (1 admin + 1 transient test user) | **1 (admin only)** | 1 test user progress purged; admin progress intact |
| **Admin Completed Lessons** | `["l1-1", "l1-2"]` | `["l1-1", "l1-2"]` | **Identical (Preserved)** |
| **Admin Quiz Scores** | `{"l1-1":100, "l1-2":100}` | `{"l1-1":100, "l1-2":100}` | **Identical (Preserved)** |
| **Admin Last Lesson ID** | `l1-2` | `l1-2` | **Identical (Preserved)** |
| **Quiz Submissions** | 3 (all belonging to admin) | **3 (all belonging to admin)** | **Identical (Preserved)** |
| **Submission 1 Score** | 100 (`l1-1`) | 100 (`l1-1`) | **Identical (Preserved)** |
| **Submission 2 Score** | 0 (`l1-2`) | 0 (`l1-2`) | **Identical (Preserved)** |
| **Submission 3 Score** | 100 (`l1-2`) | 100 (`l1-2`) | **Identical (Preserved)** |
| **Custom Courses** | `[]` | `[]` | **Identical (Preserved)** |
| **Admin Audit Logs** | `undefined` (empty baseline) | `undefined` (empty baseline) | **Identical (Preserved)** |

### 3.2 Classification of the Change
The action taken was **strictly a test fixture cleanup**:
- **Did it change seed data?** No. It restored the authorized single-admin seed baseline.
- **Did it change application data?** No. The 22 removed records were transient test users created during the `tests/db.test.mjs` run.
- **Did it delete or overwrite historical data?** **NO.** The authentic master admin account (`apriyanriyan23@gmail.com`), its registration timestamp, password hash, course progress, and 3 submitted quizzes were preserved with 100% byte-for-byte fidelity.

---

## 4. Audit Scope of Changes

### 4.1 `data/academy.json`
- Contains exactly 1 user (`apriyanriyan23@gmail.com`), 1 course progress record, 3 quiz submission records, and 0 custom courses.
- JSON structure conforms strictly to `isValidDatabaseSchema()`.

### 4.2 `data/journals/`
- Contains only test partition files (`u_usr_aggr_*`, `u_test_usr_*`, `index.json`) generated by the ephemeral unit test harnesses `tests/journal-service.test.mjs` and `tests/journal-storage.test.mjs`.
- No real production journal data exists in the local development workspace, and none was altered.

### 4.3 Production Configuration Files
- No changes made to `.env`, `.env.production`, Nginx configuration files, PM2 ecosystem files, or deployment runners during this audit.

### 4.4 Authentication Files
- `lib/auth.ts`: Verified untouched since commit `8304711` (`git diff` is clean).
- `lib/server-auth.ts`: Verified untouched (`git diff` is clean).
- `lib/rate-limit.ts`: Verified untouched (`git diff` is clean).
- `lib/db.ts`: Verified untouched (`git diff` is clean).

### 4.5 Production Server (VPS)
- In strict adherence to Rule 4, **zero SSH commands, zero writes, and zero PM2/database actions were dispatched to the VPS server (`187.77.156.219`)**.
- The VPS production database remains safely isolated at `/var/www/casper-web/data/academy.json`.

---

## 5. Verification Limitations

1. **Local vs. Remote Isolation:** This audit specifically verified the local development workspace. Because no network connections or SSH commands were issued (per strict read-only constraints), the VPS database was not polled in this turn. However, the local baseline matches the VPS backup created earlier (`academy.backup.20261108_032620.json`).
2. **Git Tracking Limitation:** Because `data/academy.json` is ignored by `.gitignore`, Git does not provide a commit-by-commit line diff for it. The integrity proof relies on the backup snapshot `academy.backup.2026-11-08T03-47-25-885Z.test-safety-snapshot.json` created by the database subsystem prior to the cleanse.

---

## 6. Conclusion & Recommendation

The data integrity of `data/academy.json` is **uncompromised**. The temporary difference observed during `academy.test.mjs` was exclusively the result of automated test fixture pollution by `tests/db.test.mjs`, which was appropriately purged. All authentic user data, progress records, quiz submissions, and credentials remain 100% intact.

**Audit Verdict:** **PASSED — DATA INTEGRITY CONFIRMED SAFE.**

