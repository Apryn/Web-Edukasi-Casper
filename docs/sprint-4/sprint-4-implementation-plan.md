# SIGNAL CASPER ACADEMY — SPRINT 4 IMPLEMENTATION PLAN
## Step-by-Step Execution Roadmap (Tasks 4.0 – 4.9)

---

## Tahap 1 — Task 4.1: Learning Data Foundation (`lib/db.ts` & `lib/server-progress.ts`)
1. Perluas `DatabaseSchema` di [`lib/db.ts`](file:///d:/Developer/Web%20Casper%20Signal/lib/db.ts) secara backward-compatible dengan:
   - `learning_events?: DbLearningEvent[]`
   - `recommendation_dismissals?: DbRecommendationDismissal[]`
   - Atribut opsional `started_at?: string` dan `completed_at?: string | null` pada `DbCourseProgress`.
2. Tambahkan helper atomik di `lib/db.ts`:
   - `recordLearningEvent(...)` dengan deduplikasi idempoten dan batas retensi 10.000 event.
   - `getLearningEventsForUser(userId)` dan `getAllLearningEventsForAdmin()`.
   - `getAllCourseProgressForAdmin()`.
   - `dismissRecommendationForUser(...)`, `restoreRecommendationForUser(...)`, dan `getRecommendationDismissalsForUser(userId)`.
   - Pastikan `deleteUserById` juga membersihkan `learning_events` dan `recommendation_dismissals` milik user tersebut.
3. Perbarui [`lib/server-progress.ts`](file:///d:/Developer/Web%20Casper%20Signal/lib/server-progress.ts) agar `validateAndPersistUserProgress` dan `evaluateAndRecordServerQuiz` otomatis mencatat event `COURSE_STARTED`, `LESSON_STARTED`, `LESSON_COMPLETED`, `QUIZ_SUBMITTED`, dan `COURSE_COMPLETED` berdasarkan perubahan nyata di server.

## Tahap 2 — Task 4.2 & 4.3: Learning Progress Intelligence & Adaptive Recommendation Engine (`lib/learning-intelligence/*`)
1. Buat `lib/learning-intelligence/types.ts`.
2. Buat `lib/learning-intelligence/progress-normalizer.ts`.
3. Buat `lib/learning-intelligence/course-metrics.ts`.
4. Buat `lib/learning-intelligence/quiz-topic-metrics.ts`.
5. Buat `lib/learning-intelligence/engagement-metrics.ts`.
6. Buat `lib/learning-intelligence/recommendation-engine.ts`.
7. Buat `lib/learning-intelligence/admin-education-intelligence.ts`.
8. Buat `lib/learning-intelligence/learning-orchestrator.ts` dan `lib/learning-intelligence/index.ts`.

## Tahap 3 — Task 4.7: API Routes & Server Authorization (`app/api/learning/*` & `app/api/admin/learning-intelligence/*`)
1. Endpoint Siswa:
   - `app/api/learning/dashboard/route.ts` (`GET`)
   - `app/api/learning/recommendations/route.ts` (`GET`, `POST`)
   - `app/api/learning/progress/route.ts` (`GET`)
   - `app/api/learning/activity/route.ts` (`GET`, `POST`)
2. Endpoint Admin Education Intelligence:
   - `app/api/admin/learning-intelligence/overview/route.ts` (`GET`)
   - `app/api/admin/learning-intelligence/courses/route.ts` (`GET`)
   - `app/api/admin/learning-intelligence/lessons/route.ts` (`GET`)
   - `app/api/admin/learning-intelligence/quizzes/route.ts` (`GET`)
   - `app/api/admin/learning-intelligence/engagement/route.ts` (`GET`)

## Tahap 4 — Task 4.4 & 4.5: Student Learning Dashboard & Admin Education Intelligence UI
1. Buat komponen [`app/dashboard/StudentLearningWorkspace.tsx`](file:///d:/Developer/Web%20Casper%20Signal/app/dashboard/StudentLearningWorkspace.tsx) dan integrasikan ke [`app/dashboard/page.tsx`](file:///d:/Developer/Web%20Casper%20Signal/app/dashboard/page.tsx) (serta catat `LESSON_STARTED` saat ruang kelas `/kelas/[slug]` dibuka oleh siswa terautentikasi).
2. Buat komponen [`app/admin/AdminEducationIntelligencePanel.tsx`](file:///d:/Developer/Web%20Casper%20Signal/app/admin/AdminEducationIntelligencePanel.tsx) dan integrasikan sebagai tab tersendiri di [`app/admin/page.tsx`](file:///d:/Developer/Web%20Casper%20Signal/app/admin/page.tsx) (terpisah dari tab *Student Intelligence & Jurnal Kohort* Sprint 3).
3. Tambahkan styling responsif di [`app/globals.css`](file:///d:/Developer/Web%20Casper%20Signal/app/globals.css) untuk desktop, tablet, dan mobile.

## Tahap 5 — Task 4.8 & 4.9: Comprehensive Tests, Real Browser E2E Verification & Final Audit Docs
1. Buat suite unit & integrasi:
   - `tests/learning-intelligence-engine.test.mjs`
   - `tests/learning-recommendations.test.mjs`
   - `tests/learning-api-authorization.test.mjs`
   - `tests/qa-sprint4-final.test.mjs`
2. Jalankan pengujian seluruh suite gabungan, `npx tsc --noEmit`, `npm run lint`, `npm run build`, dan `git diff --check`.
3. Jalankan verifikasi E2E nyata pada server lokal dan dokumentasikan di `docs/sprint-4/`:
   - `docs/sprint-4/sprint-4-implementation-report.md`
   - `docs/sprint-4/sprint-4-test-report.md`
   - `docs/sprint-4/sprint-4-security-and-privacy-audit.md`
   - `docs/sprint-4/sprint-4-known-limitations.md`

