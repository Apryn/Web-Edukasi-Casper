# SIGNAL CASPER ACADEMY — SPRINT 5
## PRE-IMPLEMENTATION AUDIT REPORT: TASK 5.4

- **Date:** 12 November 2026
- **Feature Scope:** Task 5.4 (Student Drill Workspace Page & Decision Console)
- **Role:** Senior Software Architect, Senior Full-Stack Engineer, QA Engineer
- **Status:** **PRE-IMPLEMENTATION AUDIT COMPLETE — BASELINE VERIFIED FOR CODING**
- **Invariants:** 0 Git Commits, 0 Git Pushes, 0 VPS/Production Modifications, `data/academy.json` SHA-256 Identical (`9F8945...53D8`).

---

## 1. EXISTING ARCHITECTURE & FOUNDATIONS

Sistem Signal Casper Academy telah menyelesaikan dan menerima fondasi backend dan komponen visual:

1. **Task 5.1 (Data Model & Storage - ACCEPTED):**
   - Skema database di `lib/db.ts` memuat `drills`, `drill_submissions`, dan `trade_preparation_checklists`.
   - Modul `lib/drill-storage.ts` menyediakan:
     - Mutex in-memory `withSubmissionLock(userId, drillId)` untuk penomoran percobaan atomik.
     - Proteksi `idempotency_key` per-tuple `(userId, drillId)` untuk mencegah duplikasi submission.
     - Versioning ganda: `drill_version` dan `rubric_version`.
     - Proyeksi ringkasan siswa: `computeStudentDrillSummary` dan `getStudentDrillSummary`.
2. **Task 5.2 (Deterministic Evaluation Engine - ACCEPTED):**
   - Modul `lib/drill-evaluation-engine.ts` menyediakan:
     - Evaluator murni: `evaluateDrillSubmission`.
     - Gerbang keselamatan modal (*Invalidation Safety Gate*): skor Stop-Loss $\ge 18/25$ poin wajib terpenuhi agar status dapat mencapai `PASSED`.
     - Penilaian kontekstual `NO-TRADE`: siswa yang memilih menahan modal pada kondisi berisiko tinggi memperoleh skor Stop-Loss 25/25 dan lolos safety gate.
     - Pembulatan matematis simetris: `roundHalfUp(x)`.
     - Sanitasi anti-kebocoran: `sanitizeDrillForStudent(drill, summary)` menghasilkan `PublicDrillCase` tanpa membocorkan kunci jawaban atau formula internal.
3. **Task 5.3 (Interactive Scoped Chart Viewer - ACCEPTED WITH LIMITATIONS):**
   - Komponen visual `components/drills/ScopedChartViewer.tsx` dan utilitas `lib/chart-coordinates.ts`.
   - Menjamin koordinat lilin tidak bergeser (*zero drift*) di bawah zoom $1.0\times-3.0\times$ dan pan offset.
   - Crosshair realtime dengan Floating Price Pill.
   - Penempatan interaktif 3 level: Entry (Cyan), Stop-Loss (Rose), Target (Emerald).
   - Penguncian 6 lapis pada mode `readOnly`.
   - Penolakan keras terhadap SVG (pencegahan XSS).

---

## 2. REUSABLE COMPONENTS & DESIGN SYSTEM TOKENS

1. **Komponen Visual Inti:**
   - `components/drills/ScopedChartViewer.tsx`: Langsung diintegrasikan ke dalam workspace dengan wadah terkunci rasio 16:9 (`aspect-[16/9]`).
2. **Design Tokens & Aesthetic (Casper Dark Editorial):**
   - Background kanvas: `--bg: #090c10`, panel utama: `--panel: #10151b`, border garis: `--line: #28323c`.
   - Aksen teks & garis: Cyan `#41d9ef` (Entry), Rose `#f43f5e` (Stop-Loss / Invalidation), Emerald `#53d9bf` (Target), Amber `#f59e0b` (Safety Gate Warning).
   - Font: `'Manrope'` untuk judul, `'DM Sans'` untuk teks utama, `'DM Mono'` untuk metrik finansial dan harga.
3. **Komponen Global Navigasi:**
   - `components/Navbar.tsx` dan `components/Footer.tsx`.
   - Ikonografi: `lucide-react` (`Crosshair`, `ShieldAlert`, `CheckCircle2`, `AlertTriangle`, `RotateCcw`, `ZoomIn`, `ZoomOut`, `Lock`, `ArrowRight`, `ChevronLeft`).

---

## 3. IDENTIFIKASI API & DATA CONTRACTS

### A. Kontrak Data Masukan Siswa (`StudentDrillAnswer`)
Didefinisikan di `lib/drill-types.ts`:
```ts
export interface StudentDrillAnswer {
  bias: "BULLISH" | "BEARISH" | "SIDEWAYS_NEUTRAL";
  isNoTrade: boolean;
  noTradeReason?: string;
  entryPrice?: number;
  invalidationPrice?: number;
  targetPrice?: number;
  calculatedRiskReward?: number;
  clickedCoordinates?: {
    entry?: { x: number; y: number };
    invalidation?: { x: number; y: number };
    target?: { x: number; y: number };
  };
  selectedConfirmations: string[];
  rationaleText: string;
}
```

### B. Kontrak Output Sanitasi Siswa (`PublicDrillCase`)
Dihasilkan oleh `sanitizeDrillForStudent(drill, summary)`:
- Memuat: `id`, `title`, `slug`, `drillType`, `instrument`, `timeframe`, `dataPeriod`, `dataSource`, `classification`, `priceBounds`, `chartAssetUrl`, `contextPrompt`, `instructions`, `rubricCriteriaSummary`, `passingScore`, `safetyGateMin`, dan `userSummary`.
- **Tidak Memuat:** `model_answer`, `expectedBias`, `entryZone`, `invalidationPrice`, `targetPrice`, `validNoTradeReasons`, maupun formula bobot rahasia.

### C. Kontrak Hasil Evaluasi (`RecordSubmissionResult` & `DrillEvaluationResult`)
```ts
export interface DrillEvaluationResult {
  score: number;                     // 0 - 100
  invalidationScore: number;         // 0 - 25
  safetyGatePassed: boolean;         // invalidationScore >= 18
  evaluationStatus: DrillEvaluationStatus; // "PASSED" | "FAILED_SAFETY_GATE" | "FAILED"
  isPassed: boolean;
  passingScore: number;
  safetyGateRequirement: number;
  calculatedRiskReward: number | null;
  criteriaBreakdown: CriterionEvaluationResult[];
  instructorDebrief: string;
}
```

---

## 4. GAP YANG DITEMUKAN & INTEGRASI MINIMAL

1. **Rute API Submission & Drill Fetching Belum Ada:**
   - Modul storage dan evaluator Task 5.1 & 5.2 telah siap, namun rute HTTP Next.js (`/api/drills/[id]` dan `/api/drills/[id]/submit`) belum dibuat.
   - **Solusi Sesuai Scope PO:** Membangun rute minimal:
     - `GET /api/drills/[id]/route.ts`: Menyajikan data `PublicDrillCase` tersanitasi, serta riwayat submission jika user terotentikasi. Memblokir drill berstatus `DRAFT` bagi siswa biasa.
     - `POST /api/drills/[id]/submit/route.ts`: Memvalidasi session user, mengeksekusi `evaluateDrillSubmission`, menyimpan rekaman mutasi secara atomik via `recordDrillSubmission` dengan mutex dan idempotency key.
     - `GET /api/drills/[id]/solution/route.ts`: Melayani layer solusi instruktur secara aman hanya setelah siswa menyelesaikan submission minimal 1 kali atau berstatus admin.
2. **Ketiadaan Rute Halaman Siswa:**
   - Direktori `app/belajar/drill/[id]/page.tsx` belum tersedia. Akan diimplementasikan lengkap dengan Server Component untuk otentikasi awal dan Client Component `StudentDrillWorkspace.tsx` untuk interaksi UI.
3. **Penyelarasan Rasio Aspek Kontainer Chart:**
   - Sesuai Catatan Audit Task 5.3, kontainer chart pada workspace dikunci ke kelas Tailwind `aspect-[16/9]` (atau `min-h-[420px]` pada mobile) untuk meniadakan letterbox kosong.

---

## 5. RENCANA IMPLEMENTASI TASK 5.4

1. **Step 1: Rute API Minimal Pendukung Workspace:**
   - Buat `app/api/drills/[id]/route.ts`.
   - Buat `app/api/drills/[id]/submit/route.ts`.
   - Buat `app/api/drills/[id]/solution/route.ts`.
2. **Step 2: Komponen Interaktif `StudentDrillWorkspace.tsx`:**
   - Tata letak 2 kolom desktop (Chart 60%, Decision Console 40%) dan tumpukan vertikal mobile.
   - Two-Stance toggle: `[ AMBIL POSISI / TAKE TRADE ]` vs `[ DISIPLIN NO-TRADE ]`.
   - Sinkronisasi dua arah: input harga di console memperbarui garis di chart, dan drag garis di chart memperbarui input angka console.
   - Perhitungan rasio Risk/Reward realtime di sisi visual: $R:R = |\text{TP} - \text{Entry}| / |\text{Entry} - \text{SL}|$.
   - Validasi formulir sebelum kirim (mencegah SL terbalik, nilai kosong, atau payload cacat).
   - Penanganan state pengiriman: `isSubmitting`, double-click lock, network error retry dengan idempotency key UUID stabil.
   - Tampilan Debrief pasca-submission: Banner status (`PASSED`, `FAILED_SAFETY_GATE`, `FAILED`), rincian 5 kriteria, penjelasan instruktur, dan drawer riwayat percobaan terdahulu.
3. **Step 3: Halaman Rute `app/belajar/drill/[id]/page.tsx`:**
   - Verifikasi sesi pengguna via `getSessionUser(req)` / cookies.
   - Pengecekan status publikasi drill (menolak drill draft untuk siswa).
   - Penyajian metadata breadcrumb dan containment responsif.
4. **Step 4: Automated Testing (`tests/sprint-5-task-5-4.test.mjs`):**
   - Pengujian otentikasi dan isolasi role (unauth, draft rejection, 404).
   - Pengujian validasi console (Trade valid, NO-TRADE valid, SL terbalik, incomplete).
   - Pengujian alur submission dan deduplikasi idempotency key.
   - Pengujian debrief persistence (data tetap terbaca setelah reload).
   - Pengujian responsivitas dan peniadaan horizontal overflow.

---

## 6. ANALISIS RISIKO & MITIGASI

| Risiko Arsitektur | Dampak | Mitigasi |
|---|---|---|
| **Kebocoran Model Answer** | Siswa dapat melihat koordinat ideal di DevTools | Server HANYA mengirimkan `PublicDrillCase` (model answer tidak pernah dikirim ke browser sebelum submit). |
| **Double-Click Submission** | Pembuatan rekaman duplikat dan nomor attempt meloncat | Generate `idempotencyKey` unik pada awal sesi drill. Mutex `withSubmissionLock` di backend membalas replay secara instan tanpa menambah `attempt_number`. |
| **Hilangnya State Saat Navigasi** | Siswa kehilangan analisis saat reload | State formulir disimpan di local component memory dan tersinkronisasi dengan histori server saat refresh. |
| **Ketidaksesuaian SL di NO-TRADE** | Siswa bingung mencari field Stop-Loss pada NO-TRADE | Stance NO-TRADE secara visual menyembunyikan input Entry/SL/TP dan menampilkan checkbox alasan struktural serta area narasi proteksi modal. |
| **Letterbox Drift pada Chart** | Garis level tidak sejajar dengan lilin jika rasio gambar tidak standar | Kontainer chart dikunci ke rasio aspek 16:9 (`aspect-[16/9]`) di mana lilin membentang penuh di seluruh kontainer. |

---

## KESIMPULAN AUDIT

Seluruh dependensi dan kontrak data telah teridentifikasi dan konsisten. **Tidak ditemukan blocker atau kontradiksi spesifikasi.** Implementasi Task 5.4 dapat langsung dimulai sesuai panduan arsitektur di atas.

