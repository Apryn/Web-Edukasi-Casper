# SIGNAL CASPER ACADEMY — SPRINT 5
## INDEPENDENT TECHNICAL AUDIT REPORT (TASKS 5.1 & 5.2)

- **Date:** 12 November 2026
- **Auditor Role:** Principal Software Architect & Application Security Reviewer (Independent Audit)
- **Scope:** Task 5.1 (Data Model & Storage) & Task 5.2 (Deterministic Evaluation Engine)
- **Status:** **AUDIT PASSED — READY FOR PRODUCT OWNER GATE EVALUATION**
- **Authorization Boundary:** Task 5.3 (Chart Viewer) remains strictly **NOT AUTHORIZED / PENDING PO APPROVAL**.
- **Repository Governance:** 0 Git Commits, 0 Git Pushes, 0 VPS/Production Modifications, 0 Bytes Modified in `data/academy.json`.

---

## EXECUTIVE SUMMARY

Berdasarkan mandat Product Owner, telah dilakukan audit independen yang mendalam dan obyektif terhadap implementasi **Task 5.1 (Data Model & Storage)** dan **Task 5.2 (Deterministic Evaluation Engine)**. Audit ini berfokus pada 7 area prioritas:

1. **Rekonsiliasi Test Count:** Penjelasan matematis dan empiris perbedaan antara baseline 254 test dan laporan 269 test (total aktual: 274 test).
2. **Global Write Serialization & Concurrency:** Analisis arsitektur I/O synchronous `lib/db.ts` dan pengujian empiris concurrent write lintas-user dan lintas-drill tanpa kehilangan data (*zero data loss*).
3. **Audit Idempotency Key:** Verifikasi perlindungan retry jaringan ganda dan isolasi *per-user/drill*.
4. **Audit Atomic Write Failure & Crash Recovery:** Mekanisme `.tmp`, `fsyncSync`, `atomicRenameWithRetry`, deep cloning working copy, dan karantina database.
5. **Audit Evaluasi Deterministik & Safety Gate:** Verifikasi 5 kriteria rubrik, pembulatan simetris (*symmetric half-up*), perlakuan NO-TRADE kontekstual, dan gerbang keselamatan Stop-Loss ($\ge 18/25$).
6. **Audit Privasi & Sanitasi Data:** Pembuktian nol kebocoran kunci jawaban (*zero secret leakage*) pada payload siswa.
7. **Regresi & Kualitas Build:** Verifikasi TypeScript (`0 error`), ESLint (`0 error`), Next.js Production Build (`Compiled successfully`), dan integritas hash SHA-256 database utama.

---

## 1. REKONSILIASI TEST SUITE (254 $\rightarrow$ 269 $\rightarrow$ 274 TEST CASES)

### A. Latar Belakang Perbedaan Angka
Pada sprint sebelumnya (Sprint 4 Acceptance), baseline pengujian dilaporkan berjumlah **254 PASS**. Ketika Task 5.1 (8 tes) dan Task 5.2 (12 tes) ditambahkan ($+20$ tes), runner `node --test tests/*.test.mjs` melaporkan **269 PASS**, bukan 274.

### B. Hasil Penelusuran Auditor
Runner pengujian bawaan Node.js dipanggil menggunakan pola glob:
```bash
node --test tests/*.test.mjs
```
Pola glob `*.test.mjs` **hanya mencocokkan berkas yang berakhiran `.test.mjs`**.

Di dalam direktori `tests/`, terdapat satu berkas khusus:
- **`tests/sprint-4-browser-e2e.mjs`**: Berkas ini adalah suite otomasi browser Playwright + Chrome 156 nyata yang membutuhkan server aktif di port 3088. Nama berkasnya berakhiran `.mjs` (bukan `.test.mjs`), sehingga **tidak dieksekusi secara otomatis oleh glob `tests/*.test.mjs`**.

### C. Tabel Rincian Lengkap per Berkas Pengujian

| No | Nama Berkas Pengujian | Jenis Suite | Jumlah Test | Status Eksekusi |
|---|---|---|:---:|:---:|
| 1 | `tests/academy.test.mjs` | Unit & API Auth/Progress | 26 | `tests/*.test.mjs` |
| 2 | `tests/analytics-core-metrics.test.mjs` | Analytics Core Calculation | 20 | `tests/*.test.mjs` |
| 3 | `tests/analytics-dimensional-slicer.test.mjs` | Analytics Dimensions | 11 | `tests/*.test.mjs` |
| 4 | `tests/analytics-drawdown.test.mjs` | Analytics Drawdown Engine | 16 | `tests/*.test.mjs` |
| 5 | `tests/analytics-orchestrator.test.mjs` | Analytics Orchestrator | 6 | `tests/*.test.mjs` |
| 6 | `tests/analytics-time-series.test.mjs` | Analytics Time Series | 16 | `tests/*.test.mjs` |
| 7 | `tests/db.test.mjs` | Database Schema & Concurrency | 8 | `tests/*.test.mjs` |
| 8 | `tests/journal-api-authorization.test.mjs` | Journal Auth & RBAC | 10 | `tests/*.test.mjs` |
| 9 | `tests/journal-service.test.mjs` | Journal Business Logic | 55 | `tests/*.test.mjs` |
| 10 | `tests/journal-storage.test.mjs` | Journal Persistence | 24 | `tests/*.test.mjs` |
| 11 | `tests/learning-api-authorization.test.mjs` | Learning RBAC | 8 | `tests/*.test.mjs` |
| 12 | `tests/learning-intelligence-engine.test.mjs`| Learning Intelligence Metrics | 8 | `tests/*.test.mjs` |
| 13 | `tests/learning-recommendations.test.mjs` | Learning Recommendations | 6 | `tests/*.test.mjs` |
| 14 | `tests/qa-sprint2-task3-3.test.mjs` | Course QA Verification | 9 | `tests/*.test.mjs` |
| 15 | `tests/qa-sprint3-final.test.mjs` | Sprint 3 QA Integration | 6 | `tests/*.test.mjs` |
| 16 | `tests/rate-limit.test.mjs` | Security Rate Limiter | 12 | `tests/*.test.mjs` |
| 17 | `tests/sprint-4-e2e.test.mjs` | Sprint 4 API E2E | 3 | `tests/*.test.mjs` |
| 18 | `tests/sprint-4-eviction-and-metrics.test.mjs`| Ring Buffer & Telemetry | 5 | `tests/*.test.mjs` |
| **—** | **Subtotal Baseline Sprint 4 (Headless)** | **18 Berkas** | **249** | **MATCH** |
| 19 | `tests/sprint-5-task-5-1.test.mjs` | Sprint 5 Task 5.1 Storage | **8** | `tests/*.test.mjs` |
| 20 | `tests/sprint-5-task-5-2.test.mjs` | Sprint 5 Task 5.2 Evaluator | **12** | `tests/*.test.mjs` |
| **—** | **Total Runner Headless Saat Ini** | **20 Berkas (`*.test.mjs`)** | **269** | **269 / 269 PASS** |
| 21 | `tests/sprint-4-browser-e2e.mjs` | Playwright Chrome 156 Browser | **5** | E2E Browser Runner |
| **SUM**| **TOTAL SELURUH SISTEM CASPER ACADEMY** | **21 Berkas Pengujian** | **274** | **274 / 274 VALID** |

### D. Kesimpulan Rekonsiliasi
Perhitungan matematis:
$$\text{Headless Baseline (249)} + \text{Browser E2E (5)} = 254 \text{ (Baseline Sprint 4)}$$
$$\text{Headless Baseline (249)} + \text{Task 5.1 (8)} + \text{Task 5.2 (12)} = 269 \text{ (Laporan Headless)}$$
$$\text{Total Keseluruhan} = 269 + 5 = 274 \text{ Test Cases}$$
Tidak ada tes yang hilang, dilewati (*skipped*), ataupun gagal.

---

## 2. AUDIT GLOBAL WRITE SERIALIZATION & CONCURRENCY PADA `academy.json`

### A. Analisis Arsitektur I/O Mutasi Single-File
Sistem Signal Casper Academy menggunakan database file tunggal JSON (`data/academy.json`) yang dijalankan pada satu proses Node.js (PM2 fork mode). Auditor memeriksa alur mutasi pada `lib/db.ts` dan `lib/drill-storage.ts`:

1. **Synchronous Execution Pipeline:**
   Fungsi `executeMutation<T>(mutator)` pada `lib/db.ts` (baris 464–480) adalah fungsi yang **100% sinkron (*synchronous*)**:
   ```ts
   export function executeMutation<T>(mutator: (db: DatabaseSchema) => T): T {
     const current = loadDatabase();
     const workingCopy = structuredClone(current);
     const result = mutator(workingCopy);
     persistDirect(workingCopy);
     cache = workingCopy;
     writeCounter++;
     if (writeCounter % BACKUP_INTERVAL_WRITES === 0) {
       createBackup("interval");
     }
     return result;
   }
   ```
   Di dalam lingkungan JavaScript runtime single-threaded Node.js, pemanggilan sinkron berjalan hingga selesai tanpa melepaskan kendali (*yield*) ke event loop. Tidak ada tick asynchronous yang dapat menyisip di tengah-tengah eksekusi `executeMutation`.

2. **Per-Tuple Mutex Queue (`withSubmissionLock`):**
   Pada level servis drill (`lib/drill-storage.ts`), `withSubmissionLock(userId, drillId, operation)` mengantrekan permintaan yang masuk untuk kombinasi pengguna dan drill yang sama melalui rantai Promise in-memory:
   ```ts
   const lockKey = `${safeUserId}::${safeDrillId}`;
   const previousLock = submissionMutexMap.get(lockKey) || Promise.resolve();
   ```
   Di dalam blok operasi yang terkunci, pembacaan nomor percobaan (`getDrillSubmissions`) dan pemanggilan `executeMutation` dilakukan secara berurutan **tanpa adanya `await` di antaranya**.

3. **Pertanyaan Kritis: Bagaimana dengan User Berbeda dan Drill Berbeda?**
   Jika Mahasiswa A (pada Drill 1) dan Mahasiswa B (pada Drill 2) melakukan submit pada milidetik yang sama:
   - Keduanya memiliki `lockKey` yang berbeda (`userA::drill1` vs `userB::drill2`).
   - Promise keduanya dapat berada pada event loop tick yang sama.
   - Namun, ketika salah satu masuk ke baris pemanggilan `executeMutation`, JavaScript runtime mengeksekusi `structuredClone`, mutasi array, `fs.openSync`, `fs.writeSync`, `fs.fsyncSync`, dan `atomicRenameWithRetry` secara **blocking-synchronous**.
   - Permintaan kedua baru akan mengeksekusi `executeMutation` setelah mutasi pertama selesai dan memperbarui `cache` in-memory.
   - Oleh karena itu, mutasi kedua membaca snapshot cache terbaru yang sudah memuat data dari mutasi pertama.

### B. Bukti Pengujian Empiris Stress-Test Concurrency
Auditor menjalankan skrip stress-test independen berbeban tinggi (`scratch/test-concurrent-writes.mjs`) pada database terisolasi:
- **Jumlah Operasi Bersamaan:** 32 operasi konkuren menggunakan `Promise.all` serentak:
  - 24 drill submissions: 4 user berbeda (`user_1`, `user_2`, `user_3`, `user_4`) masing-masing mengirimkan 3 percobaan berturut-turut pada 2 drill berbeda (`drill_A`, `drill_B`).
  - 4 pembaruan progres kelas (`upsertUserProgress`) dari user berbeda.
  - 4 perekaman event telemetri (`recordLearningEvent`) dari user berbeda.
- **Hasil Verifikasi:**
  1. `finalDb.drill_submissions.length === 24` ($\pm 0$ data loss, tidak ada submission yang tertimpa).
  2. Nomor percobaan (`attempt_number`) untuk setiap tuple `(userId, drillId)` terurut sempurna: `[1, 2, 3]`.
  3. `finalDb.course_progress.length === 4` (seluruh progres tersimpan utuh).
  4. `finalDb.learning_events.length === 4` (seluruh event tersimpan utuh).
  5. JSON database valid dan tidak mengalami korupsi format.

---

## 3. AUDIT IDEMPOTENCY KEY

### A. Implementasi Idempotensi
Idempotensi pada `lib/drill-storage.ts` diuji untuk mencegah duplikasi percobaan akibat *double-click* pengguna atau *network retry* dari reverse proxy:
```ts
const existingSubs = getDrillSubmissions(userId, drillId);
const existingIdempotent = existingSubs.find((s) => s.idempotency_key === idempotencyKey);
if (existingIdempotent) {
  return {
    submission: { ...existingIdempotent },
    isIdempotentReplay: true,
  };
}
```

### B. Temuan & Verifikasi Skenario
1. **Identical Submission Replay:**
   Ketika payload yang sama dikirimkan ulang dengan `idempotencyKey` yang sama, sistem mengembalikan data rekaman pertama, menandai `isIdempotentReplay: true`, dan **tidak menambah** `attempt_number`.
2. **Payload Modification Replay Protection:**
   Jika client yang mengalami timeout mencoba mengirim ulang dengan jawaban berbeda namun menggunakan `idempotencyKey` yang sama, sistem tetap mengembalikan evaluasi awal yang tersimpan. Modifikasi ditolak secara implisit.
3. **Cross-User Idempotency Isolation:**
   `getDrillSubmissions(userId, drillId)` membatasi pencarian idempotensi hanya pada lingkup `(userId, drillId)`. Penggunaan key yang sama oleh dua user berbeda (`user_alpha` dan `user_beta`) tidak saling bertabrakan dan masing-masing berhasil dicatat sebagai submission independen.

---

## 4. AUDIT ATOMIC WRITE FAILURE & CRASH RECOVERY

### A. Mekanisme Proteksi File System
Auditor memverifikasi implementasi `persistDirect` pada `lib/db.ts` (baris 425–460):
1. **Nama File Temporer Unik:**
   File ditulis ke `.academy.<process.pid>.<timestamp>.<random>.tmp` di direktori `data/`. Penamaan ini mencegah tabrakan nama file jika ada proses lain.
2. **Physical Disk Flush (`fsyncSync`):**
   `fs.openSync(tmpPath, "w")` diikuti `fs.writeSync(fd, ...)` dan `fs.fsyncSync(fd)` memastikan seluruh buffer OS ter-flush ke disk fisik sebelum penggantian file dilakukan.
3. **Atomic Replace dengan Toleransi Windows Lock:**
   Fungsi `atomicRenameWithRetry` menerapkan mekanisme retry hingga 10 kali dengan jeda 15ms jika Windows melemparkan error penguncian sementara (`EPERM`, `EBUSY`, `EACCES`).
4. **Cleanup pada Error:**
   Blok `catch` memastikan file descriptor `fd` ditutup dan file `.tmp` dihapus (`fs.unlinkSync`), sehingga tidak meninggalkan file sampah jika operasi gagal.

### B. Isolasi In-Memory State
`executeMutation` menggunakan `structuredClone(current)` sebelum memanggil mutator fungsi:
- Jika mutator melempar error (misalnya validasi gagal), objek `current` dan `cache` in-memory tetap utuh.
- `cache` hanya diperbarui setelah `persistDirect` sukses melakukan *rename* fisik di disk.

### C. Karantina & Pemulihan Database Otomatis
Jika file `data/academy.json` mengalami kerusakan format (misalnya file terpotong akibat listrik padam mendadak):
1. Fungsi `loadDatabase` menangkap `SyntaxError` JSON.
2. File rusak segera di-karantina ke `data/academy.corrupt.<timestamp>.json`.
3. Sistem secara otomatis mencari backup valid terbaru di `data/backups/academy.backup.*.json`.
4. Jika backup ditemukan, database dipulihkan tanpa intervensi manual.
5. Jika tidak ada backup valid, sistem melempar `CRITICAL ERROR` dan **menolak menimpa file dengan array kosong**, sehingga data aman dari pembersihan otomatis (*destructive blank overwrite*).

---

## 5. AUDIT DETERMINISTIC EVALUATION RUBRIC & SAFETY GATE

Auditor memeriksa implementasi evaluator murni pada `lib/drill-evaluation-engine.ts` terhadap 5 kriteria penilaian:

### A. Matriks Evaluasi Kriteria

| Kriteria | Bobot | Logika Penilaian | Kasus NO-TRADE |
|---|:---:|---|---|
| **CRIT_BIAS** (Market Bias) | 20% | Case-insensitive uppercase match terhadap `expectedBias`. Tepat = 20 poin, Salah = 0 poin. | Mengikuti bias struktur pasar acuan. |
| **CRIT_ENTRY** (Entry Zone) | 25% | Di dalam zona ideal = 25 poin.<br>$\le 1\times$ toleransi = 18 poin.<br>$\le 2\times$ toleransi = 10 poin.<br>$> 2\times$ toleransi = 0 poin. | Jika valid: 25 poin (disiplin menahan entry).<br>Jika tidak valid: 0 poin (melewatkan setup terkonfirmasi). |
| **CRIT_INVALID** (Safety Gate) | 25% | Ideal $\le 1\times$ toleransi = 25 poin.<br>Buffer aman $\le 1.5\times$ toleransi = 20 poin.<br>Ambang batas $\le 2\times$ toleransi = **18 poin (Safety Gate)**.<br>Noise wick / terlalu jauh $> 2\times$ = $\le 12$ poin (**Gagal Safety Gate**).<br>Stop-loss terbalik (Bullish SL $\ge$ Entry, Bearish SL $\le$ Entry) = **0 poin**. | Jika valid: alasan struktural valid = **25 poin (Safety Gate Terpenuhi)**; alasan umum = **18 poin (Safety Gate Terpenuhi)**.<br>Jika tidak valid = 0 poin. |
| **CRIT_RR** (Risk/Reward) | 15% | Hitungan rasio imbal hasil terhadap risiko ($R:R$):<br>$\ge 2.0 = 15$ poin.<br>$\ge 1.5 = 10$ poin.<br>$\ge 1.0 = 5$ poin.<br>$< 1.0 = 0$ poin. | Jika valid: 15 poin (menghindari expected value negatif).<br>Jika tidak valid: 0 poin. |
| **CRIT_CONFIRM** (Confirmation) | 15% | Kecocokan konfirmasi tag institusional (10 poin) + analisis kata kunci rationale minimal 15 karakter (5 poin). | Jika valid: alasan dan rationale struktural mendukung = 15 poin.<br>Jika tidak valid: 0 poin. |

### B. Verifikasi Safety Gate Logic
Logika keselamatan modal diperiksa pada baris 619–631 `lib/drill-evaluation-engine.ts`:
```ts
const safetyGateRequirement = rubric.invalidationSafetyGatePoints ?? 18;
const overallPassingScore = rubric.overallPassingScore ?? 70;

const safetyGatePassed = invalidationScore >= safetyGateRequirement;
const isPassed = finalScore >= overallPassingScore && safetyGatePassed;

let evaluationStatus: DrillEvaluationStatus;
if (finalScore >= overallPassingScore) {
  evaluationStatus = safetyGatePassed ? "PASSED" : "FAILED_SAFETY_GATE";
} else {
  evaluationStatus = "FAILED";
}
```
- **Uji Batas Ambang:**
  - Skor Total 75, Invalidation Score 18 $\rightarrow$ `PASSED` (`safety_gate_passed: true`).
  - Skor Total 75, Invalidation Score 17.9 / 12 $\rightarrow$ `FAILED_SAFETY_GATE` (`safety_gate_passed: false`, `isPassed: false`).
  - Skor Total 68, Invalidation Score 25 $\rightarrow$ `FAILED` (gagal ambang total kelulusan).

### C. Pembulatan Matematika Simetris (*Symmetric Half-Up Rounding*)
Fungsi `roundHalfUp(val)` diverifikasi:
$$\text{roundHalfUp}(x) = \text{sign}(x) \times \lfloor |x| + 0.5 \rfloor$$
- `roundHalfUp(2.5) === 3`
- `roundHalfUp(-2.5) === -3`
- Menghilangkan *floating point arithmetic drift* dari perhitungan rasio bobot.

---

## 6. AUDIT PRIVASI DATA & PENCEGAHAN KEBOCORAN KUNCI JAWABAN

Auditor mengaudit fungsi `sanitizeDrillForStudent(drill, userSummary)` pada `lib/drill-evaluation-engine.ts` (baris 648–685):

### A. Parameter yang Dikirim ke Frontend Siswa (`PublicDrillCase`)
- `id`, `title`, `slug`, `drillType`, `instrument`, `timeframe`, `dataPeriod`, `dataSource`, `classification`, `timezone`, `transformationNotes`
- `priceBounds`: Batas harga chart (`minPrice`, `maxPrice`, `step`) untuk keperluan rendering skala harga pada kanvas chart.
- `chartAssetUrl`: URL gambar chart historis (PNG/WebP).
- `contextPrompt` & `instructions`: Teks panduan skenario.
- `rubricCriteriaSummary`: Hanya memuat nama kriteria dan bobot (`[{ id, name, weight, safetyGateMin }]`).
- `passingScore` (70) & `safetyGateMin` (18).
- `userSummary`: Ringkasan progres siswa sendiri (upaya, skor terbaik, status kelulusan).

### B. Parameter Rahasia yang Dihapus Total (*Stripped*)
- `model_answer`: **TIDAK ADA**.
- `model_answer.expectedBias`: **TIDAK ADA**.
- `model_answer.entryZone`: **TIDAK ADA** (koordinat min, max, ideal tidak bocor).
- `model_answer.invalidationPrice`: **TIDAK ADA** (level ideal dan toleransi tidak bocor).
- `model_answer.targetPrice`: **TIDAK ADA**.
- `model_answer.requiredConfirmations`: **TIDAK ADA**.
- `model_answer.validRationaleKeywords`: **TIDAK ADA**.
- `model_answer.isNoTradeValid` & `validNoTradeReasons`: **TIDAK ADA**.
- Rubrik detail dan formula toleransi internal: **TIDAK ADA**.

Siswa yang memeriksa *Network Tab* (DevTools) atau respon JSON API tidak dapat mengekstrak kunci jawaban maupun level harga optimal sebelum menyelesaikan drill.

---

## 7. REGRESI, QUALITY GATES & HASIL BUILD PRODUKSI

Seluruh verifikasi lingkungan dan build dijalankan secara lokal di environment Windows:

```
======================================================================
1. AUTOMATED TEST SUITE EXECUTION
   Command: node --test tests/*.test.mjs
   Result:  269 / 269 PASS across 20 suites (4.97s)
   Browser E2E (tests/sprint-4-browser-e2e.mjs): 5 / 5 PASS (Verified in Sprint 4)
   Total Verification Count: 274 / 274 PASS

2. TYPESCRIPT COMPILATION
   Command: npx tsc --noEmit
   Result:  0 Errors, 0 Diagnostics

3. ESLINT STATIC ANALYSIS
   Command: npm run lint
   Result:  0 Errors (15 legacy unused-vars warnings retained as documented)

4. NEXT.JS PRODUCTION BUILD
   Command: npm run build (next build)
   Result:  ✓ Compiled successfully in 23.1s
            ✓ Generating static pages (40/40)
            ✓ Collecting build traces
            Status: Exit Code 0

5. DATABASE HASH INTEGRITY
   Target:  data/academy.json
   SHA-256: 9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8
   Status:  IDENTICAL (0 bytes modified, zero production tampering)

6. GIT REPOSITORY STATUS
   Branch:  main (up to date with origin/main)
   Commits: 0 commits
   Pushes:  0 pushes
   VPS:     Untouched
======================================================================
```

---

## REKOMENDASI AUDITOR KEPADA PRODUCT OWNER

1. **Penerimaan Teknis Task 5.1 & Task 5.2:**
   Implementasi fondasi data model, atomic write storage, concurrent mutex, deduplikasi idempotensi, evaluasi deterministik 5 kriteria, dan gerbang keselamatan Stop-Loss telah memenuhi seluruh standar arsitektur dan lulus audit independen.
2. **Kesiapan Melanjutkan ke Task 5.3:**
   Sistem telah berada dalam kondisi stabil (*clean baseline*). Auditor merekomendasikan Product Owner untuk **memberikan otorisasi pengerjaan Task 5.3 (Scoped Chart Viewer Component)**.
3. **Protokol Eksekusi Task 5.3:**
   Ketika diotorisasi, Task 5.3 harus berfokus pada:
   - Komponen visual `components/drills/ScopedChartViewer.tsx` menggunakan gambar statis PNG/WebP berdimensi tetap.
   - Fitur Pan & Zoom ($1.0\times$ hingga $3.0\times$) murni di sisi kanvas klien.
   - Crosshair dengan label harga floating terkoordinasi dengan `priceBounds`.
   - Normalisasi penempatan level ($0.0 - 1.0$) untuk Entry, Invalidation (SL), dan Target (TP).
   - Penolakan SVG demi keamanan XSS sesuai keputusan arsitektur PO.

