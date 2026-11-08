# SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 3.3
## DRAWDOWN & TIME-SERIES ANALYTICS IMPLEMENTATION & HARDENING REPORT

**Document Version:** 1.1.0  
**Date:** 2026-11-08  
**Author:** Senior Software Architect & Quantitative Analytics Engineer  
**Status:** FULLY HARDENED, SINGLE-INVOCATION VERIFIED & READY FOR FINAL APPROVAL  
**Associated Issues / Tasks:** Sprint 3 — Task 3.3 (Drawdown & Time-Series Analytics Engine)

---

## 1. Executive Summary

Task 3.3 telah berhasil diimplementasikan, diperkuat (*hardened*), dan diverifikasi secara komprehensif:

1. **Drawdown Metrics Engine (`lib/analytics/drawdown-metrics.ts`):** Mengimplementasikan pengurutan urutan deterministik (`exitDate` asc, `id` asc tie-breaker), pelacakan high-water mark berbasis integer minor units (`BigInt`), kurva nominal & persentase drawdown, pendeteksian epoch lengkap (peak-trough-recovery), aturan tanpa pemotongan persentase (*no clipping rule*, contoh $120\%$), serta tata kelola status modal tri-state (`AVAILABLE`, `UNAVAILABLE_BASE_CAPITAL`, `CAPITAL_DEPLETED`).
2. **Time-Series Metrics Engine (`lib/analytics/time-series-metrics.ts`):** Mengimplementasikan agregasi kalender deterministik untuk interval `DAILY` (`YYYY-MM-DD`), `WEEKLY` (ISO-8601 `YYYY-Www`, Senin–Minggu), dan `MONTHLY` (`YYYY-MM`). Menggunakan penanganan timezone eksplisit berbasis IANA dengan default mutlak `"UTC"` tanpa kebocoran waktu server lokal. Mendukung mode *sparse* maupun *dense* (`hasActivity: false`), dengan isolasi total arus kas (`DEPOSIT`/`WITHDRAWAL`) serta penghapusan metrik volume untuk mencegah distorsi *heterogeneous unit mixing*.
3. **Core Metrics Audit (Task 3.2.1 Integrity):** Memastikan seluruh implementasi rekonsiliasi dual expectancy exact BigInt rational cross-multiplication dan zero-loss / zero-profit handling tetap 100% utuh tanpa regresi.
4. **Test Concurrency & Isolation Hardening:** Mengidentifikasi dan memperbaiki akar masalah kegagalan uji gabungan (*concurrent test collision*) di filesystem Windows NTFS tanpa menggunakan *flag* `--test-concurrency=1`.
5. **Verifikasi Kualitas Kode & Regresi:**
   - **Single Canonical Invocation:** Seluruh 9 suite pengujian repository dijalankan bersamaan dalam 1 perintah CLI standar (`node --test tests/*.mjs`).
   - **Hasil Test:** **186/186 test lulus (100% PASS RATE, 0 fail, 0 flake)** dalam 2,9 detik.
   - **TypeScript Strict Check (`tsc --noEmit`):** 0 error.
   - **ESLint (`npm run lint`):** 0 error.
   - **Production Build Next.js (`npm run build`):** 34 routes compiled & prerendered successfully.
   - **Integritas Data Produksi:** `data/academy.json` tetap utuh, tidak tersentuh, dan hanya berisi 1 master admin (`apriyanriyan23@gmail.com`).

---

## 2. Test Concurrency & Isolation Hardening (Root Cause Analysis)

Pada evaluasi pengujian gabungan awal (*all test suites executed concurrently*), terdeteksi dua isu transient:
1. `journal-service.test.mjs` test 46 mengalami `ENOENT: no such file or directory, rename ... u_usr_aggr_...tmp... -> ...json`.
2. `rate-limit.test.mjs` mengalami status HTTP 401 (user terhapus) dan `EPERM` file contention pada `academy.json`.

### 2.1 Root Cause Analysis

- **Isu A (Temp File Collision & Premature Cleanup):**
  Dalam `journal-storage.test.mjs` (skenario 13, 23, dan 24), fungsi `cleanupStaleTempFiles(0)` dipanggil dengan usia `maxAgeMs = 0` yang menyapu seluruh file berekstensi `.tmp` di folder shared `data/journals/`. Ketika `journal-service.test.mjs` sedang mengeksekusi operasi penulisan atomik secara paralel, file `.tmp` milik `journal-service` yang baru ditulis terhapus oleh `cleanupStaleTempFiles(0)` sesaat sebelum pemanggilan `fs.renameSync()`, menyebabkan error `ENOENT`.
- **Isu B (Database File Mutation Race in Academy Tests):**
  Suite pengujian `academy.test.mjs`, `qa-sprint2-task3-3.test.mjs`, `db.test.mjs`, dan `rate-limit.test.mjs` secara bersamaan membaca dan menimpa file fisik `data/academy.json`. Secara khusus:
  - `db.test.mjs` Skenario 6 sengaja merusak file `data/academy.json` untuk menguji mekanisme karantina dan auto-recovery dari snapshot backup.
  - Saat `db.test.mjs` merusak database, `rate-limit.test.mjs` sedang melakukan autentikasi siswa uji, menyebabkan kegagalan 401 Unauthorized.
  - Pada OS Windows NTFS, proses penulisan bersamaan memicu `EPERM` / `EBUSY` karena file lock sementara selama indexing.

### 2.2 Arsitektur Solusi & Perbaikan

1. **Scoped Stale File Purging (`lib/journal-storage.ts` & `tests/journal-storage.test.mjs`):**
   - Menambahkan parameter `prefixFilter` opsional pada `cleanupStaleTempFiles(maxAgeMs, targetDirs, prefixFilter)`.
   - Menempatkan uji coba pembersihan file sementara pada folder terisolasi (`.test_stale_cleanup`) dan membatasi pembersihan crash-test hanya pada prefix crash masing-masing (`u_${userCrashTomb}.tombstone.tmp.` dan `.u_${userCrashBackup}.backup.tmp.`). File atomik in-flight milik suite lain tidak akan pernah tersapu.
2. **Windows NTFS Retry Logic (`atomicRenameWithRetry`):**
   - Mengimplementasikan `atomicRenameWithRetry` pada `lib/journal-storage.ts` dan `lib/db.ts` dengan toleransi 10 percobaan per 15ms untuk menangani file lock transien sistem operasi Windows NTFS.
3. **Isolated Test Scratch Databases (`setDatabasePathForTest`):**
   - Menambahkan hook isolasi pengujian `setDatabasePathForTest(customPath)` pada `lib/db.ts` yang menyinkronkan path file dan environment variable `process.env.ACADEMY_DB_PATH`.
   - Mengarahkan `lib/courses-data.ts` untuk menghormati `process.env.ACADEMY_DB_PATH`.
   - Mengisolasi `tests/academy.test.mjs`, `tests/qa-sprint2-task3-3.test.mjs`, `tests/db.test.mjs`, dan `tests/rate-limit.test.mjs` ke salinan database scratch sementara berbasis PID (`academy.test.<suite>.<pid>.<time>.json`). Setiap suite berjalan pada sandbox data miliknya sendiri dan membersihkannya pada blok `after()`.
   - File master produksi `data/academy.json` terlindungi 100% dan tidak pernah disentuh atau dirusak selama pengujian berjalan.

---

## 3. Audit Integritas Core Metrics (Task 3.2.1)

Audit verifikasi git diff memastikan seluruh kontrak dan implementasi matematis Task 3.2.1 tidak mengalami modifikasi destruktif:
- `lib/analytics/core-metrics.ts`: Tetap menggunakan rekonsiliasi dual expectancy BigInt exact cross multiplication tanpa pembulatan awal:
  $$\text{diff} = |P \times N_L \times N - L \times N_W \times N|$$
- `tests/analytics-core-metrics.test.mjs`: Seluruh 20 skenario uji Task 3.2 & Task 3.2.1 lulus 100% (termasuk cohort winning only, losing only, breakeven mixtures, large nominal values, dan zero loss/profit states).

---

## 4. Single-Invocation Test Results (Full Repository Suite)

Pengujian repository dijalankan dalam **satu pemanggilan CLI tunggal** secara paralel tanpa batasan konkurensi:

```bash
node --test tests/academy.test.mjs tests/analytics-core-metrics.test.mjs tests/analytics-drawdown.test.mjs tests/analytics-time-series.test.mjs tests/db.test.mjs tests/journal-service.test.mjs tests/journal-storage.test.mjs tests/qa-sprint2-task3-3.test.mjs tests/rate-limit.test.mjs
```

### Rekapitulasi Hasil Pengujian (186 Tests):

| No | Test Suite | File | Jumlah Uji | Status |
| :-: | :--- | :--- | :-: | :-: |
| 1 | Academy E2E System | `tests/academy.test.mjs` | 26 / 26 | **PASS** |
| 2 | PAE Core Metrics Engine | `tests/analytics-core-metrics.test.mjs` | 20 / 20 | **PASS** |
| 3 | PAE Drawdown Metrics Engine | `tests/analytics-drawdown.test.mjs` | 16 / 16 | **PASS** |
| 4 | PAE Time-Series Engine | `tests/analytics-time-series.test.mjs` | 16 / 16 | **PASS** |
| 5 | JSON Database Verification | `tests/db.test.mjs` | 8 / 8 | **PASS** |
| 6 | Journal Service Engine | `tests/journal-service.test.mjs` | 55 / 55 | **PASS** |
| 7 | Journal Storage & Concurrency | `tests/journal-storage.test.mjs` | 24 / 24 | **PASS** |
| 8 | Sprint 2 Task 3.3 Deep QA | `tests/qa-sprint2-task3-3.test.mjs` | 9 / 9 | **PASS** |
| 9 | Authentication Rate Limiting | `tests/rate-limit.test.mjs` | 12 / 12 | **PASS** |
| **TOTAL** | **9 Suites Berjalan Paralel** | — | **186 / 186** | **100% PASS** |

- **Durasi Eksekusi Total:** ~2,95 detik
- **Gagal / Flake / Cancelled:** 0

---

## 5. Pemeriksaan Kualitas & Build Produksi

1. **TypeScript Strict Typecheck (`npx tsc --noEmit`):**
   - Exit Code: `0`
   - Error: `0`
2. **ESLint (`npm run lint`):**
   - Exit Code: `0`
   - Error: `0`
   - Pre-existing UI Warnings: `15` (unrelated unused UI imports di frontend)
3. **Next.js Production Build (`npm run build`):**
   - Exit Code: `0`
   - Status: Kompilasi sukses, 34 rute teroptimasi (*Static*, *SSG*, dan *Dynamic*).
4. **Git Diff & Whitespace Verification (`git diff --check`):**
   - Exit Code: `0` (Tidak ada konflik, syntax error, atau whitespace violation).
5. **Database Integrity Audit (`data/academy.json`):**
   - Akun: Tepat 1 user master admin (`apriyanriyan23@gmail.com`).
   - Status: Bersih, tidak terpolusi oleh data pengujian atau transient files.

---

## 6. Status Git Repository

```
$ git status --short
 M lib/analytics/analytics-types.ts
 M lib/analytics/core-metrics.ts
 M lib/courses-data.ts
 M lib/db.ts
 M lib/journal-storage.ts
 M tests/academy.test.mjs
 M tests/analytics-core-metrics.test.mjs
 M tests/db.test.mjs
 M tests/journal-storage.test.mjs
 M tests/qa-sprint2-task3-3.test.mjs
 M tests/rate-limit.test.mjs
?? docs/sprint-3/drawdown-analytics-specification.md
?? docs/sprint-3/task-3-2-1-data-integrity-audit.md
?? docs/sprint-3/task-3-2-1-final-verification.md
?? docs/sprint-3/task-3-3-architecture-final-review.md
?? docs/sprint-3/task-3-3-implementation-plan.md
?? docs/sprint-3/task-3-3-implementation-report.md
?? docs/sprint-3/time-series-analytics-specification.md
?? lib/analytics/drawdown-metrics.ts
?? lib/analytics/index.ts
?? lib/analytics/time-series-metrics.ts
?? tests/analytics-drawdown.test.mjs
?? tests/analytics-time-series.test.mjs
```

> [!NOTE]
> Sesuai protokol tata kelola kode, tidak ada operasi `git commit` maupun `git push` yang dilakukan sebelum mendapatkan persetujuan tertulis (*sign-off*) dari Product Owner.

---

## 7. Rekomendasi & Langkah Selanjutnya

1. **Rekomendasi:** Berdasarkan hasil pengujian kanonikal tunggal (186/186 test pass), audit Task 3.2.1 tanpa regresi, build produksi sukses, dan isolasi test yang telah diperkuat, Sprint 3 Task 3.3 direkomendasikan untuk **FINAL APPROVAL**.
2. **Next Gate:** Setelah Product Owner memberikan approval tertulis, pekerjaan akan dilanjutkan ke **Sprint 3 — Task 3.4 (Distribution & Outlier Analytics Engine)**.
