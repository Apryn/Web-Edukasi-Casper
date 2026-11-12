# SIGNAL CASPER ACADEMY — SPRINT 5
## IMPLEMENTATION REPORT: TASK 5.3 — INTERACTIVE SCOPED CHART VIEWER

- **Date:** 12 November 2026
- **Feature Scope:** Sprint 5 — Task 5.3 (Interactive Scoped Chart Viewer Component)
- **Role:** Senior Frontend Engineer & UI Architect
- **Status:** **IMPLEMENTATION COMPLETE — READY FOR PRODUCT OWNER REVIEW**
- **Quality Gates:** 281 / 281 Tests PASS (100%), 0 TypeScript Errors, 0 ESLint Errors on new code, Next.js Production Build OK (Exit 0).
- **Invariants:** 0 Git Commits, 0 Git Pushes, 0 VPS/Production Modifications, `data/academy.json` SHA-256 Identical.

---

## 1. FILES CREATED & MODIFIED

| File Path | Action | Description |
|---|:---:|---|
| `lib/chart-coordinates.ts` | **CREATED** | Engine utilitas koordinat: validasi format aset (PNG/WebP), normalisasi Y $[0.0, 1.0]$, konversi harga dua arah, transformasi invers viewport-ke-stage, pembatasan pan/zoom, pemformatan harga. |
| `components/drills/ScopedChartViewer.tsx` | **CREATED** | Komponen visual interaktif React (Next.js `"use client"`): rendering gambar statis, pan/zoom $1.0\times-3.0\times$, crosshair presisi realtime, floating price pill, garis level (Entry, Stop-Loss, Target), dan mode *read-only lock*. |
| `tests/sprint-5-task-5-3.test.mjs` | **CREATED** | Test suite otomatis 12 skenario: keamanan aset, clamping $[0.0, 1.0]$, normalisasi batas atas/bawah, roundtrip dua arah harga, pembuktian non-drifting koordinat pada zoom+pan, penolakan SVG, dan kunci read-only. |
| `docs/sprint-5/task-5-3-implementation-report.md` | **CREATED** | Dokumen laporan penyelesaian Task 5.3 ini. |

---

## 2. COMPONENT API & PROPS

Komponen `ScopedChartViewer` dirancang modular, berorientasi *pure presentation*, dan tidak menyimpan evaluasi logika backend:

```tsx
export type ActivePlacementTool = "ENTRY" | "INVALIDATION" | "TARGET" | null;

export interface ScopedChartViewerProps {
  // Aset & Batas Harga
  chartAssetUrl: string;                  // URL gambar historis (PNG atau WebP saja)
  priceBounds: ChartPriceBounds;          // { minPrice, maxPrice, decimals }
  
  // Metadata & Provenance
  provenance?: {
    instrument?: string;                  // e.g. "XAUUSD"
    timeframe?: string;                   // e.g. "H1"
    dataPeriod?: string;                  // e.g. "2024-10-14 08:00 - 16:00 UTC"
    dataSource?: string;                  // e.g. "Institutional Tick History"
    classification?: string;              // "HISTORICAL_MARKET"
  };
  
  // Posisi Level Siswa
  levels?: DrillLevels;                   // { entry?: { normalizedY, price }, invalidation?, target? }
  onLevelsChange?: (levels: DrillLevels) => void;
  
  // State Interaksi & Otorisasi
  readOnly?: boolean;                     // Default: false. True mengunci seluruh interaksi modifikasi.
  activePlacementTool?: ActivePlacementTool;
  onActivePlacementToolChange?: (tool: ActivePlacementTool) => void;
  
  // Solusi Instruktur (Review Mode)
  solutionOverlayUrl?: string | null;     // URL layer solusi beranotasi
  showSolutionOverlay?: boolean;          // Toggle visibilitas solusi
  className?: string;
}
```

---

## 3. SISTEM KOORDINAT & RUMUS MATEMATIKA

Sistem koordinat menggunakan model **Y-Axis Inverted Financial Normalization** di mana:
- $y = 0.0$ (bagian paling atas kanvas gambar) = $\text{maxPrice}$
- $y = 1.0$ (bagian paling bawah kanvas gambar) = $\text{minPrice}$

### A. Rumus Konversi Normalisasi
1. **Normalized Y ke Harga:**
   $$\text{price}(y_{\text{norm}}) = \text{round}\left(\text{maxPrice} - y_{\text{norm}} \times (\text{maxPrice} - \text{minPrice}), \text{decimals}\right)$$
2. **Harga ke Normalized Y:**
   $$y_{\text{norm}}(\text{price}) = \text{clamp01}\left(\frac{\text{maxPrice} - \text{price}}{\text{maxPrice} - \text{minPrice}}\right)$$

### B. Rumus Invers Transformasi Pointer
Ketika pointer berada pada posisi layar $(clientX, clientY)$ di atas kontainer viewport $(rect.left, rect.top)$ dengan perbesaran $S$ (*zoom*) dan pergeseran $(T_x, T_y)$ (*panX, panY*):
$$\text{relX} = clientX - rect.left, \quad \text{relY} = clientY - rect.top$$
$$\text{stageX} = \frac{\text{relX} - T_x}{S}, \quad \text{stageY} = \frac{\text{relY} - T_y}{S}$$
$$y_{\text{norm}} = \text{clamp01}\left(\frac{\text{stageY}}{\text{stageHeight}}\right)$$

Karena seluruh elemen overlay garis level berada di dalam layer `chart-stage` yang sama dengan gambar dasar dan menggunakan persentase `top: ${normalizedY * 100}%`:
$$\mathbf{\Delta y_{\text{candle\_pixel}} \equiv \Delta y_{\text{overlay\_line}}}$$
**Bukti Matematis:** Posisi garis Entry, Stop-Loss, dan Target terikat secara absolut pada piksel lilin (candle) yang sama dan **tidak pernah bergeser (zero drift)** saat zoom atau pan berubah.

---

## 4. IMPLEMENTASI PAN & ZOOM

- **Rentang Zoom:** Dibatasi ketat antara $1.0\times$ (fit container) hingga $3.0\times$.
- **Kontrol Toolbar:**
  - Tombol Zoom In `(+)`: Menambah perbesaran $+0.25\times$ (disabled pada $3.0\times$).
  - Tombol Zoom Out `(-)`: Mengurangi perbesaran $-0.25\times$ (disabled pada $1.0\times$).
  - Tombol Reset `(1.0x)`: Mengembalikan skala ke $1.0\times$ dan mereset pan ke $(0, 0)$.
  - Indikator Skala: Menampilkan persentase zoom realtime (`100%`, `125%`, `200%`, `300%`).
- **Mouse Wheel Zoom:** Scroll roda mouse memperbesar/memperkecil chart dengan faktor adaptif ($0.15\times$).
- **Pan Clamping Protection:**
  Fungsi `clampPanOffset` membatasi pergeseran agar gambar tidak dapat tergeser keluar kanvas secara permanen:
  - Pada zoom $1.0\times$: Pan terkunci mutlak pada $(0, 0)$.
  - Pada zoom $> 1.0\times$: Pan dibatasi oleh selisih dimensi panggung terhadap kontainer plus toleransi buffer 25%.

---

## 5. CROSSHAIR & FLOATING PRICE PILL

- **Pelacakan Pointer Realtime:**
  - Garis putus-putus horizontal warna cyan mengikuti koordinat $Y$ panggung.
  - Garis putus-putus vertikal warna cyan mengikuti koordinat $X$ panggung.
  - Sembunyi secara otomatis saat pointer meninggalkan area chart (*onPointerLeave*).
- **Floating Price Pill pada Sumbu Kanan:**
  - Label harga terapung (*floating pill*) berada di sumbu kanan, menghitung harga aktual di bawah kursor berdasarkan invers koordinat gambar (bukan koordinat layar semata).
  - Harga yang ditampilkan selalu mencerminkan harga candle yang tepat di bawah kursor meskipun chart sedang di-zoom $2.5\times$ dan digeser ke sudut.

---

## 6. PERILAKU PENEMPATAN LEVEL (ENTRY, SL, TP)

Komponen mendukung tiga level trading standar industri:

| Level | Visualisasi Garis | Warna Token | Handle Interaktif |
|---|---|---|---|
| **Entry Level** | Cyan Dashed Line | `#41d9ef` (Shadow glow) | Draggable pill: `ENTRY: [Harga]` |
| **Invalidation (Stop-Loss)** | Rose/Red Dashed Line | `#f43f5e` (Shadow glow) | Draggable pill: `STOP-LOSS: [Harga]` |
| **Target (Take-Profit)** | Emerald Dashed Line | `#53d9bf` (Shadow glow) | Draggable pill: `TARGET: [Harga]` |

### Dua Metode Penempatan:
1. **Click-to-Place:** Siswa memilih tool yang aktif (`Entry`, `Stop-Loss`, atau `Target`) pada toolbar, lalu mengeklik langsung area chart. Level akan langsung berpindah ke harga titik klik tersebut.
2. **Drag Handle:** Siswa dapat menekan dan menggeser pill handle pada garis level ke atas atau ke bawah. Nilai harga dan koordinat diperbarui secara halus (*fluid*) realtime.
3. **Keyboard Step:** Mendukung penyesuaian halus menggunakan tombol panah `ArrowUp` / `ArrowDown` (langkah $0.5\%$, atau $2\%$ jika menahan `Shift`).

---

## 7. INTERACTIVE VS. READ-ONLY MODE

### Mode Interaktif (`readOnly: false`):
- Toolbar penempatan level aktif.
- Siswa bebas mengeklik chart dan menggeser handle garis.
- Perubahan level memicu pemanggilan callback `onLevelsChange(nextLevels)`.

### Mode Terkunci / Read-Only (`readOnly: true`):
- **Terkunci Total:** Toolbar pemilih level disembunyikan.
- **Handle Non-Interaktif:** Seluruh pill handle memiliki `pointer-events: none` dan atribut `tabIndex={-1}`.
- **Klik Dinonaktifkan:** Event klik pada chart diabaikan secara total.
- **Callback Dihentikan:** Fungsi `updateLevel` memiliki *guard clause* yang langsung menghentikan eksekusi jika `readOnly === true`, menjamin callback tidak akan pernah terpanggil secara tidak sengaja.
- **Badge Status:** Menampilkan lencana terkunci `[🔒 READ-ONLY]` berwarna amber.
- **Pan & Zoom Tetap Berfungsi:** Siswa tetap dapat memperbesar dan menggeser chart untuk mempelajari detail candle atau membandingkan dengan solusi instruktur.

---

## 8. PERTIMBANGAN KEAMANAN (SECURITY AUDIT)

1. **Penolakan Keras Format SVG (XSS Hardening):**
   Fungsi `validateChartAssetUrl` menolak mentah-mentah file berakhiran `.svg`, data URI SVG (`data:image/svg+xml`), maupun teks bermuatan `<svg`. Jika terdeteksi, komponen merender UI peringatan keamanan `ShieldAlert` dan menolak merender elemen gambar.
2. **Whitelist Ekstensi Terbatas:**
   Hanya gambar statis raster berformat `.png` dan `.webp` yang diterima.
3. **Pemberantasan XSS Injection:**
   Komponen sama sekali **tidak menggunakan `dangerouslySetInnerHTML`** dan tidak mengevaluasi string input sebagai HTML/script.
4. **Zero Secret Leakage:**
   Komponen tidak memuat kunci jawaban instruktur (*model answer*) secara internal. Seluruh data yang dirender murni berasal dari props publik (`PublicDrillCase`). Solusi instruktur hanya dimuat jika prop `solutionOverlayUrl` disediakan dan diverifikasi aman.

---

## 9. HASIL PENGUJIAN OTOMATIS (TEST RESULTS)

Suite pengujian baru `tests/sprint-5-task-5-3.test.mjs` mengeksekusi 12 test case spesifik Task 5.3:

```
TAP version 13
# Subtest: Task 5.3 — Scoped Chart Viewer Coordinate & Security Engine
    ok 1 - 1. Asset Security: Strictly accepts PNG and WebP, firmly rejects SVG and dangerous formats
    ok 2 - 2. Coordinate Clamping: clamp01 behaves strictly within [0.0, 1.0]
    ok 3 - 3. Price Normalization: Top boundary (0.0) -> maxPrice, Bottom boundary (1.0) -> minPrice
    ok 4 - 4. Reverse Price Mapping: Discrete price translates accurately to normalized Y
    ok 5 - 5. Bi-directional Roundtrip Integrity: price -> normY -> price preserves decimal accuracy
    ok 6 - 6. Error Handling: Invalid price bounds throw meaningful errors
    ok 7 - 7. Invariant Verification: Candle coordinates NEVER drift under Zoom and Pan
    ok 8 - 8. Pan Clamping: Prevents chart from disappearing off-screen
    ok 9 - 9. Zoom Clamping: Enforces strictly 1.0x to 3.0x boundary
    ok 10 - 10. Price Formatter: Formats currency and commodities with proper decimals
    ok 11 - 11. Read-Only Lockout Invariant: Mutations and callbacks are completely blocked in read-only mode
    ok 12 - 12. Multi-Asset Bounds: Accurately maps Forex (4 decimals) and Crypto (1 decimal)
1..12
ok 51 - Task 5.3 — Scoped Chart Viewer Coordinate & Security Engine (25.3ms)
```

### Rekonsiliasi Pengujian Regresi Lengkap:
- **Baseline Sprint 4 + Sprint 5 (Tasks 5.1 & 5.2):** 269 Headless Tests PASS.
- **Penambahan Task 5.3:** +12 Headless Tests PASS.
- **Total Runner Headless (`node --test tests/*.test.mjs`):** **281 / 281 PASS** (21 berkas pengujian, 19 suite, 5.32 detik).
- **Historis Browser E2E:** 5 PASS (Sprint 4 Chrome Acceptance).
- **Total Seluruh Sistem:** 286 Tests Valid.

---

## 10. QUALITY GATES & VERIFIKASI PRODUKSI

```
======================================================================
1. AUTOMATED TESTS
   Command: node --test tests/*.test.mjs
   Result:  281 / 281 PASS across 21 test files (Exit Code 0)

2. TYPESCRIPT COMPILATION
   Command: npx tsc --noEmit
   Result:  0 Errors, 0 Diagnostics (Exit Code 0)

3. ESLINT STATIC ANALYSIS
   Command: npm run lint
   Result:  0 Errors, 0 Warnings on ScopedChartViewer.tsx / lib/chart-coordinates.ts
            (15 legacy unused-var warnings on older files retained as documented)

4. NEXT.JS PRODUCTION BUILD
   Command: npm run build (next build)
   Result:  ✓ Compiled successfully in 19.8s
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

## 11. PEMENUHAN 3 KRITERIA UTAMA PRODUCT OWNER

| Kriteria Penerimaan PO | Bukti Verifikasi Arsitektural | Hasil Audit |
|---|---|:---:|
| **1. Koordinat Tidak Bergeser** | Overlay garis level dan gambar chart berada di dalam *stage container* yang sama (`transform: translate(...) scale(...)`), sehingga persentase $y_{\text{norm}}$ terkunci permanen ke lilin/piksel gambar yang sama pada zoom $1.0\times-3.0\times$ dan pan offset mana pun. | **TERBUKTI & LULUS** |
| **2. Harga Benar** | Floating Price Pill menghitung harga dari inversi transformasi panggung ($\text{stageY} = (\text{relY} - panY) / zoom$), menghasilkan pembacaan harga yang tepat sesuai posisi gambar aktual, bukan koordinat layar. | **TERBUKTI & LULUS** |
| **3. Read-Only Terkunci Mutlak** | Pada `readOnly: true`, seluruh pointer events pada handle dinonaktifkan, klik kanvas diabaikan, dan fungsi mutasi memiliki *early return guard clause* yang menghentikan callback `onLevelsChange`. | **TERBUKTI & LULUS** |

---

## 12. STATUS PROYEK SAAT INI

> **TASK 5.3 IMPLEMENTATION COMPLETE — AWAITING PRODUCT OWNER REVIEW & AUTHORIZATION FOR TASK 5.4**

Pekerjaan berikutnya (**Task 5.4 — Student Drill Workspace Page & Decision Console**) tetap berada dalam status **NOT AUTHORIZED** sampai Product Owner meninjau dan menerima hasil implementasi Task 5.3 ini.

