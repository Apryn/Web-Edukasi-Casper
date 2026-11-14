# SIGNAL CASPER ACADEMY — SPRINT 5 — TASK 5.5
## TARGETED DEFECT & INTEGRITY VERIFICATION REPORT

**Document Identifier:** `docs/sprint-5/task-5-5-targeted-defect-resolution-audit.md`  
**Authority:** Product Owner Directive — Targeted Defect & Integrity Verification  
**Date:** 2026-11-14  
**Mode:** Read-Only Investigation (0 source code changes, 0 test modifications, 0 database mutations, 0 Git commits/pushes)  
**Database SHA-256 (`data/academy.json`):** `FA4C13AC7615AE94D6526E71F8F63C602E5D2B87FB0BC62179D4964D0C7F20A0`

---

## 1. DEF-55-01: ROOT CAUSE & SPECIFICATION COMPLIANCE

### 1.1 Temuan Implementasi Aktual
Pada [`lib/drill-recommendation-engine.ts`](file:///d:/Developer/Web-Edukasi-Casper-main/lib/drill-recommendation-engine.ts#L161-L168), Rule 2 (`PRACTICE_WEAK_CRITERION`, Priority 88) mengambil `latestValidSubId` untuk evidence signature dengan kode berikut:

```ts
// Get latest valid attempt across active buckets for this criterion
let latestValidSubId = "none";
for (const b of buckets.values()) {
  if (b.latestValidAttempt) {
    latestValidSubId = b.latestValidAttempt.id;
    break;
  }
}
```

### 1.2 Bukti Pengujian Empiris (Read-Only Simulation)
Simulasi read-only dijalankan terhadap `computeStudentDrillIntelligence` dan `generateAdaptiveDrillRecommendations` dengan skenario:
1. Siswa `u1` mengerjakan `d1` pada `2026-11-10T10:00:00Z` (`sub_d1_1`, `CRIT_ENTRY = 10/25`).
2. Siswa `u1` mengerjakan `d2` pada `2026-11-10T11:00:00Z` (`sub_d2_1`, `CRIT_ENTRY = 10/25`).
3. Siswa men-dismiss rekomendasi `PRACTICE_WEAK_CRITERION` (`d3` tersedia sebagai kandidat Tier 1).
4. Siswa me-retry `d2` pada `2026-11-10T12:00:00Z` (`sub_d2_2`, `CRIT_ENTRY = 10/25`, sehingga `prof` tetap `40.00%` dan `cases` tetap `2`).

**Output Aktual:**
```text
=== PHASE 1 (DEF-55-01) ===
Before retry D2 signature: drill:weak:crit=CRIT_ENTRY:latestValidSubId=sub_d1_1:prof=40.00:cases=2
After retry D2 (sub_d2_2 at 12:00Z) signature: drill:weak:crit=CRIT_ENTRY:latestValidSubId=sub_d1_1:prof=40.00:cases=2
Resurfaced after dismissal?: false count: 0
```

### 1.3 Analisis Kesesuaian Spesifikasi Rev 5
- **Status:** **CONFIRMED FUNCTIONAL DEFECT** (Melanggar kontrak Rev 5).
- **Root Cause:** Loop berhenti (`break`) pada bucket pertama di `Map` (`d1`), padahal `Map` menyimpan urutan insersi drill pertama (`d1` lalu `d2`), bukan submission paling baru secara kronologis. Ketika siswa melakukan attempt baru yang valid pada drill selain bucket pertama (`sub_d2_2` pada `d2`) dengan `prof` yang kebetulan sama, `latestValidSubId` tidak berubah (`sub_d1_1`), sehingga rekomendasi gagal resurface.
- **Spesifikasi yang Dilanggar:**
  - `task-5-5-adaptive-recommendation-specification.md` Section 4.2 Rule 2 & Section 5 item 1: *"Sourcing `latestValidSubId` strictly from `latestValidAttempt.id` guarantees that ANY new valid retry instantly changes the signature, preventing premature suppression across retries even if rounded scores are close."*
  - `task-5-5-rev5-final-acceptance-audit.md` Section 4 item 1.

---

## 2. DEF-55-02: ROOT CAUSE & SPECIFICATION COMPLIANCE

### 2.1 Temuan Implementasi Aktual
Pada [`lib/drill-recommendation-engine.ts`](file:///d:/Developer/Web-Edukasi-Casper-main/lib/drill-recommendation-engine.ts#L224-L256):
- **Rule 4 (`NEXT_PRACTICAL_DRILL`, Priority 70):** Dijalankan jika `unattemptedGeneral && candidates.length === 0`, tanpa memeriksa apakah `intelligenceSummary.uniqueDrillsAttempted > 0`.
- **Rule 5 (`FOUNDATION_FIRST_DRILL`, Priority 60):** Dijalankan jika `intelligenceSummary.uniqueDrillsAttempted === 0`.

### 2.2 Bukti Pengujian Empiris (Read-Only Simulation)
Simulasi read-only dijalankan untuk siswa baru `u_new` dengan `0` submission (`NO_DATA`):

**Output Aktual:**
```json
=== PHASE 2 (DEF-55-02) ===
NO_DATA recommendations count: 2
[
  {
    "rank": 1,
    "category": "NEXT_PRACTICAL_DRILL",
    "priority": 70,
    "drillId": "d1",
    "signature": "drill:next:candidate=d1"
  },
  {
    "rank": 2,
    "category": "FOUNDATION_FIRST_DRILL",
    "priority": 60,
    "drillId": "d1",
    "signature": "drill:onboard:first_case:target=d1"
  }
]
```

### 2.3 Analisis Kesesuaian Spesifikasi Rev 5
- **Status:** **CONFIRMED FUNCTIONAL / UX DEFECT** (Menghasilkan duplikasi target drill untuk siswa `NO_DATA`).
- **Root Cause:** Sebelum Rule 4 dievaluasi pada kondisi `NO_DATA`, `candidates.length === 0` bernilai `true`. Akibatnya Rule 4 (`Priority 70`) dan Rule 5 (`Priority 60`) keduanya terpicu dan menunjuk `activePublishedDrills[0]` (`d1`), sehingga siswa `NO_DATA` menerima 2 kartu rekomendasi berbeda untuk drill yang sama persis.
- **Spesifikasi yang Dilanggar:**
  - `task-5-5-adaptive-recommendation-specification.md` Section 3:
    - `NEXT_PRACTICAL_DRILL` (Priority 70) didefinisikan untuk kondisi *"Student has mastered or completed current topic drills, and higher-level or new-classification drills are available."*
    - `FOUNDATION_FIRST_DRILL` (Priority 60) didefinisikan eksklusif untuk kondisi *"Student has 0 valid drill submissions (`NO_DATA`, `validAttemptsCount === 0`)."*

---

## 3. DATABASE HASH RECONCILIATION

### 3.1 Perbandingan Hash
- **Hash pada Implementation Report (`2026-11-13`):** `9F8945795CFE605180C338943411B2EA63A8981530545A6EE6F2678B3C1953D8`
- **Hash Aktual pada `data/academy.json`:** `FA4C13AC7615AE94D6526E71F8F63C602E5D2B87FB0BC62179D4964D0C7F20A0`

### 3.2 Bukti Forensik (Read-Only)
1. **Status Git Tracking:** `git ls-files data/` hanya melacak `data/.gitkeep`; `data/academy.json` adalah file lokal yang tidak dilacak Git.
2. **Metadata Filesystem `data/academy.json`:**
   - `Length`: `5558` bytes
   - `LastWriteTime`: `2026-11-13 02:37:28 +07:00`
3. **Inspeksi Konten `data/academy.json`:**
   - Koleksi `users` (1 user ADMIN, `updated_at: 2026-10-27T04:37:44.000Z`), `course_progress` (1 record, `updated_at: 2026-10-25T06:30:00.000Z`), `quiz_submissions` (`[]`), `custom_courses` (`[]`), `drill_submissions` (`[]`), dan `trade_preparation_checklists` (`[]`) seluruhnya bersih tanpa polusi data uji.
   - Koleksi `drills` berisi tepat **1 official drill case**: `drill_xauusd_m1_london_sweep` (*Gold London Open Liquidity Sweep Drill*), dengan timestamp:
     - `"created_at": "2026-11-12T19:37:28.092Z"` (= `2026-11-13 02:37:28.092 +07:00`, cocok hingga detik dengan `LastWriteTime` file!).
4. **Korelasi dengan Git History:**
   - Commit `e6e4f48` (`2026-11-13 02:18:40 +07:00`): Implementasi awal Task 5.1–5.5 (saat laporan implementasi mencatat hash `9F894579...` ketika `"drills": []` masih kosong).
   - Pada `2026-11-13 02:37:28 +07:00`: Seeding resmi `drill_xauusd_m1_london_sweep` ke `data/academy.json` (sebelum commit `fbe0187` pada `02:38:08 +07:00`: `feat(drills): add official Gold London Open Liquidity Sweep drill chart assets and sync mechanism`).

### 3.3 Kesimpulan Rekonsiliasi Hash
Perubahan hash dari `9F894579...` menjadi `FA4C13AC...` **bukan** disebabkan oleh kebocoran test suite, korupsi data, maupun mutasi selama fase audit, melainkan berasal dari **seeding resmi 1 drill produksi (`drill_xauusd_m1_london_sweep`) pada `2026-11-13 02:37:28 +07:00`**. Integritas `data/academy.json` dinyatakan **VALID & TERREKONSILIASI**.

---

## 4. DAMPAK TERHADAP ACCEPTANCE CRITERIA

| Acceptance Criterion | Status Sebelumnya | Status Setelah Verifikasi Terarah | Keterangan |
| :--- | :---: | :---: | :--- |
| **AC-1** (Zero-Data Onboarding) | PASS | **FAIL (UX Duplication)** | Rule 4 & Rule 5 keduanya aktif untuk siswa `NO_DATA`, menghasilkan 2 rekomendasi dengan target `drillId` yang sama (`DEF-55-02`). |
| **AC-9** (Evidence Signature & Resurfacing) | PASS | **FAIL (Multi-Drill Edge Case)** | Pada Rule 2, `latestValidSubId` berhenti di bucket pertama dan gagal berubah saat retry terjadi pada drill lain dengan skor `prof` sama (`DEF-55-01`). |
| **AC-2 s/d AC-8, AC-10 s/d AC-12** | PASS | **PASS** | Tidak terdampak; seluruh logika mastery, anti-farming, classifier, keamanan IDOR, dan performa $\mathcal{O}(N)$ tetap valid. |

---

## 5. REQUIRED FIXES (MENUNGGU PERSETUJUAN PO)

Belum ada perubahan kode yang dilakukan selama investigasi ini. Jika Product Owner menyetujui perbaikan terarah pada [`lib/drill-recommendation-engine.ts`](file:///d:/Developer/Web-Edukasi-Casper-main/lib/drill-recommendation-engine.ts), perubahan yang diperlukan bersifat minimal dan terisolasi:

1. **Fix DEF-55-01 (`lib/drill-recommendation-engine.ts`, lines 161–168):**
   Alih-alih `break` pada bucket pertama, pilih `latestValidAttempt` yang memiliki timestamp `created_at` paling mutakhir (dengan tie-breaker `attempt_number` / `id`) di seluruh bucket aktif milik user:
   ```ts
   let latestValidSub: DbDrillSubmission | null = null;
   for (const b of buckets.values()) {
     const candidateSub = b.latestValidAttempt;
     if (!candidateSub) continue;
     if (
       !latestValidSub ||
       Date.parse(candidateSub.created_at) > Date.parse(latestValidSub.created_at) ||
       (Date.parse(candidateSub.created_at) === Date.parse(latestValidSub.created_at) &&
         candidateSub.id.localeCompare(latestValidSub.id) > 0)
     ) {
       latestValidSub = candidateSub;
     }
   }
   const latestValidSubId = latestValidSub ? latestValidSub.id : "none";
   ```

2. **Fix DEF-55-02 (`lib/drill-recommendation-engine.ts`, line 226):**
   Kecualikan kondisi `NO_DATA` pada Rule 4 (`NEXT_PRACTICAL_DRILL`) sehingga pada `uniqueDrillsAttempted === 0` hanya Rule 5 (`FOUNDATION_FIRST_DRILL`, Priority 60) yang aktif:
   ```ts
   if (unattemptedGeneral && candidates.length === 0 && intelligenceSummary.uniqueDrillsAttempted > 0) {
   ```

3. **Penambahan Regression Tests (`tests/sprint-5-task-5-5.test.mjs`):**
   Tambahkan test case eksplisit untuk kedua skenario di atas (multi-drill retry resurfacing pada `d2` dengan `prof` sama, serta verifikasi `NO_DATA` hanya menghasilkan 1 rekomendasi `FOUNDATION_FIRST_DRILL`).

---

## 6. FINAL RECOMMENDATION

### KEPUTUSAN AUDITOR: **REJECT (TEMPORARY — FIX REQUIRED BEFORE ACCEPTANCE)**

Karena **DEF-55-01** dan **DEF-55-02** terbukti secara empiris melanggar kontrak rekomendasi adaptif Rev 5 (AC-9 edge case & AC-1 duplication), implementasi belum layak menerima `TASK 5.5 — ACCEPTED` sebelum kedua perbaikan terarah pada Section 5 diterapkan dan diverifikasi ulang. Sementara itu, perbedaan SHA-256 database telah terekonsiliasi penuh dan terbukti valid.

> **STOP CONDITION AKTIF:** Tidak ada source code, test, atau database yang diubah. Menunggu persetujuan Product Owner untuk menerapkan 2 perbaikan terarah di atas. Task 5.6+ tetap **LOCKED**.

