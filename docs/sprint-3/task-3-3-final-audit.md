# SIGNAL CASPER ACADEMY — SPRINT 3
# TASK 3.3 — FINAL ARCHITECTURE, SECURITY & CODE AUDIT

**Document Version:** 1.0.0  
**Date:** 2026-11-08  
**Role:** Principal Software Architect, Security Engineer & Quantitative Analytics Auditor  
**Status:** VERIFIED & APPROVED FOR FULL SPRINT INTEGRATION  

---

## 1. Executive Summary

Dokumen ini menyajikan audit teknis menyeluruh terhadap seluruh changeset **Task 3.3 (Drawdown & Time-Series Analytics Engine)** beserta pengerasan isolasi pengujian (*test isolation hardening*) pada:
- `lib/server-auth.ts`
- `lib/db.ts`
- `lib/courses-data.ts`
- `lib/journal-storage.ts`
- `lib/analytics/analytics-types.ts`
- `lib/analytics/core-metrics.ts`
- `lib/analytics/drawdown-metrics.ts`
- `lib/analytics/time-series-metrics.ts`
- `lib/analytics/index.ts`

Seluruh 8 kriteria keamanan, keandalan filesystem, dan kebenaran matematis telah diverifikasi secara langsung pada kode sumber aktual dan dinyatakan **LULUS (VERIFIED)**.

---

## 2. Audit 8 Titik Kritis (Security & Infrastructure Hardening)

### 2.1 Proteksi Path Database Test (`lib/db.ts` & `lib/courses-data.ts`)
- **Kriteria:** Test-only database path tidak boleh bisa diaktifkan dari request pengguna atau environment production.
- **Temuan & Perbaikan:**
  - Fungsi `setDatabasePathForTest(customPath)` hanya diekspor untuk keperluan test runner lokal dan **tidak pernah** dipanggil di route API, middleware, atau service aplikasi mana pun.
  - Ditambahkan *production runtime guard* eksplisit: apabila `process.env.NODE_ENV === "production"`, pemanggilan `setDatabasePathForTest` langsung melempar exception `[SECURITY] setDatabasePathForTest is strictly forbidden in production runtime`.
  - Ditambahkan *directory boundary containment*: `customPath` wajib berada di dalam direktori `data/` (`resolved.startsWith(resolvedDataDir + path.sep)`), mencegah path traversal.
  - Pada `lib/courses-data.ts`, variabel global `__SC_TEST_DB_PATH__` diabaikan sepenuhnya ketika `NODE_ENV === "production"`.
- **Status:** **VERIFIED**

### 2.2 Konsistensi Production Database Path
- **Kriteria:** Production database path tetap sama (`data/academy.json`).
- **Temuan:** Konstanta `defaultDbFilePath` di `lib/db.ts` dan `dbPath` di `lib/courses-data.ts` tetap mengarah secara deterministik ke `path.join(process.cwd(), "data", "academy.json")`.
- **Status:** **VERIFIED**

### 2.3 Selektivitas Retry pada `atomicRenameWithRetry` (`lib/db.ts` & `lib/journal-storage.ts`)
- **Kriteria:** Atomic rename retry hanya mengulang error filesystem sementara.
- **Temuan:** Fungsi `atomicRenameWithRetry` memeriksa kode error secara ketat:
  ```ts
  if ((code === "EPERM" || code === "EBUSY" || code === "EACCES") && attempt < maxRetries - 1)
  ```
  Hanya error lock sementara khas Windows NTFS (`EPERM`, `EBUSY`, `EACCES`) yang diulang maksimal 10 kali dengan jeda 15ms.
- **Status:** **VERIFIED**

### 2.4 Propagasi Error Filesystem Permanen
- **Kriteria:** Permanent filesystem errors (`ENOENT`, `ENOSPC`, `EROFS`, `EXDEV`, dsb.) tetap diteruskan tanpa ditelan.
- **Temuan:** Jika kode error bukan transient lock atau batas percobaan habis, blok `catch` langsung mengeksekusi `throw err` sehingga mekanisme rollback atomik dan pembersihan file `.tmp` tetap berjalan sebagaimana mestinya.
- **Status:** **VERIFIED**

### 2.5 Keamanan Pembersihan File Sementara (`cleanupStaleTempFiles`)
- **Kriteria:** Temporary cleanup tidak menghapus file milik proses atau transaksi aktif lain.
- **Temuan:**
  - Di produksi, `STALE_TEMP_FILE_MAX_AGE_MS` adalah 5 menit (`300.000 ms`), sehingga file `.tmp` in-flight (yang selesai dalam $< 10\text{ ms}$) tidak pernah tersentuh.
  - Di suite pengujian, parameter `targetDirs` dan `prefixFilter` memastikan setiap skenario uji crash hanya membersihkan file `.tmp` dengan prefix unik milik skenario tersebut.
- **Status:** **VERIFIED**

### 2.6 Kekuatan Assertion Pengujian
- **Kriteria:** Test isolation tidak melemahkan assertion bisnis maupun keamanan.
- **Temuan:** Seluruh 186 test yang ada mempertahankan *strict equality assertions* (`assert.equal`, `assert.deepEqual`, `assert.throws`, `assert.rejects`) terhadap nilai numerik, status HTTP, dan struktur data.
- **Status:** **VERIFIED**

### 2.7 Ketiadaan Regresi Autentikasi & Sesi (`lib/server-auth.ts` & `lib/auth.ts`)
- **Kriteria:** Tidak ada regresi pada login, registrasi, rate limit, JWT token, atau session cookie.
- **Temuan:** `lib/server-auth.ts` dan `lib/auth.ts` tidak mengalami perubahan logika bisnis; proteksi anti-timing enumeration (`DUMMY_BCRYPT_HASH`), rate limit 5 percobaan per 15 menit, dan validasi `JWT_SECRET` production berjalan 100% utuh.
- **Status:** **VERIFIED**

### 2.8 Integritas Akun Administrator Utama (`data/academy.json`)
- **Kriteria:** Akun `apriyanriyan23@gmail.com` tidak berubah (user ID, password hash, role `ADMIN`, dan riwayat progres tetap utuh).
- **Temuan:** `git status --short data/academy.json` bersih (0 perubahan). Database hanya memiliki 1 user master admin (`apriyanriyan23@gmail.com`, ID `6b9ba627-6741-4ee6-bf50-892469db05bf`, role `ADMIN`).
- **Status:** **VERIFIED**

---

## 3. Verifikasi Formula Matematis Drawdown & Time-Series

### 3.1 Drawdown Engine (`lib/analytics/drawdown-metrics.ts`)
1. **Peak Cumulative P/L Anchored at Zero:** `peakMinor = BigInt(0)` diinisialisasi sebelum trade pertama ($Peak_0 = 0$). Jika trade pertama rugi, drawdown langsung terhitung dari origin $0$.
2. **Drawdown Nominal:** $\text{DrawdownAmount}_t = Peak_t - C_t \ge 0$ menggunakan unit minor `BigInt` eksak.
3. **MDD Percentage & Valid EquityPeak:** Menggunakan $\text{EquityPeak}_t = \text{initialBalanceMinor} + Peak_t$. Hanya dihitung apabila `startingCapital > 0` dan $\text{EquityPeak}_t > 0$.
4. **No-Clipping Rule:** Persentase drawdown **tidak** dipaksa maksimal $100\%$. Jika kerugian melebihi modal awal (misal modal $\$10.000$, rugi $\$12.000$), persentase tercatat akurat sebesar $120\%$.
5. **Capital Depletion Status:** Ketika $\text{EquityTrough}_t \le 0$, status ditetapkan menjadi `"CAPITAL_DEPLETED"` sementara nilai nominal dan persentase tetap dipertahankan.
6. **Invalid Initial Balance Handling:** Jika `startingCapital` bernilai `null`, `undefined`, atau $\le 0$, nominal drawdown tetap dihitung penuh sedangkan persentase bernilai `null` dengan status `"UNAVAILABLE_BASE_CAPITAL"`.
7. **Cash Transaction Isolation:** Hanya membaca `TradeRecord[]` berstatus `CLOSED`; transaksi `DEPOSIT` dan `WITHDRAWAL` tidak pernah masuk ke perhitungan performa trading.

### 3.2 Time-Series Engine (`lib/analytics/time-series-metrics.ts`)
1. **Granularitas:** Mendukung `DAILY` (`YYYY-MM-DD`), `WEEKLY` ISO-8601 (`YYYY-Www`, Senin–Minggu), dan `MONTHLY` (`YYYY-MM`).
2. **Validasi IANA Timezone & Default UTC:** Divalidasi menggunakan `Intl.DateTimeFormat(undefined, { timeZone })`. Default adalah `"UTC"`. Timezone tidak valid dikembalikan dengan status `"INVALID_TIMEZONE"`.
3. **Zero Implicit Server-Local Time:** Seluruh ekstraksi tanggal menggunakan `Intl.DateTimeFormat` pada target timezone dan operasi `Date.UTC(...)`.
4. **Dense vs. Sparse Mode:** Mode *dense* (`includeEmptyPeriods: true`) menghasilkan periode kosong kontigu dengan `hasActivity: false`, `tradeCount: 0`, `netPnl: 0`, dan rasio `null`.

---

## 4. Kesimpulan Audit Task 3.3

Seluruh komponen Task 3.3 telah memenuhi standar arsitektur, presisi finansial, dan keamanan. Engine Drawdown dan Time-Series siap diintegrasikan ke dalam **Task 3.4 (Dimensional Slicer)** dan **Task 3.5 (Analytics Orchestration)**.

