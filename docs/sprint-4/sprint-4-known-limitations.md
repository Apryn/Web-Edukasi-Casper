# SIGNAL CASPER ACADEMY — SPRINT 4 KNOWN LIMITATIONS & OPERATIONAL NOTES

## 1. Historical Activity Granularity Before Sprint 4
- Prior to Sprint 4, `course_progress` stored `updated_at` and `quiz_submissions` stored `created_at` per attempt, but individual lesson start/completion timestamps were not stored as separate event rows.
- **Mitigation Implemented:** `computeStudentContinuityMetrics` and `buildAdminEducationIntelligence` automatically synthesize historical activity dates from `quiz_submissions.created_at` and `course_progress.started_at` / `updated_at` when `learning_events` is empty, and explicitly display a continuity note explaining the data source. Going forward, all new classroom lesson starts, lesson completions, quiz submissions, and course completions record timestamped `DbLearningEvent` entries.

## 2. Proxy "Belum Melanjutkan" vs Permanent Abandonment
- Without intrusive client-side session-recording telemetry, a student who has reached Lesson $k$ in a course without completing it may either be taking a normal study break or experiencing curriculum friction.
- **Mitigation Implemented:** The Admin Education Intelligence UI and API explicitly label this metric **"Belum Melanjutkan" (`notYetProceededCount` / `notYetProceededRate`)** rather than permanent churn, and pair it with inactivity window distributions (`<= 7d`, `8-30d`, `> 30d`).

## 3. Single-Node JSON Storage Concurrency Boundary
- As established in Sprints 1–3, `data/academy.json` uses atomic temp-file-and-rename persistence (`persistDirect`) designed for a single Node.js process (`PM2 fork` mode). Multi-worker cluster mode requires a shared database or cross-process lock manager.

