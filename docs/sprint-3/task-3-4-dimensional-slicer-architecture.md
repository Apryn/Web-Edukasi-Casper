# SIGNAL CASPER ACADEMY — SPRINT 3
# TASK 3.4 — DIMENSIONAL SLICER ANALYTICS ARCHITECTURE

**Document Version:** 1.0.0  
**Date:** 2026-11-08  
**Role:** Principal Software Architect & Quantitative Analytics Engineer  
**Status:** IMPLEMENTED & VERIFIED  

---

## 1. Tujuan & Ruang Lingkup

**Dimensional Slicer Analytics Engine** (`lib/analytics/dimensional-slicer.ts`) mempartisi populasi trade tertutup (`CLOSED`) milik siswa ke dalam berbagai dimensi eksekusi, waktu, instrumen, teknikal, dan psikologis untuk evaluasi kebiasaan trading secara objektif.

Sesuai prinsip edukasi Signal Casper Academy:
- Seluruh perhitungan metrik per dimensi **wajib mendelegasikan perhitungan ke Task 3.2 Core Metrics Engine (`buildCoreMetricsSummary`)**, sehingga mustahil terjadi perbedaan rumus antara ringkasan akun dan rincian dimensi.
- Data historis yang belum tercatat (seperti `marketCondition` pada trade lama) dikategorikan secara eksplisit sebagai `"UNAVAILABLE"`, bukan ditebak atau dikarang.
- Setiap bucket memiliki status sampel mandiri (`NO_DATA`, `INSUFFICIENT`, `LIMITED`, `SUFFICIENT`) agar siswa tidak menarik kesimpulan prematur dari sampel kecil.

---

## 2. Audit Skema & Dimensi yang Didukung

Berdasarkan audit atas `lib/journal-types.ts` dan `lib/journal-service.ts`, berikut adalah 10 dimensi yang didukung:

| Dimensi (`SlicerDimension`) | Sumber Field `TradeRecord` | Normalisasi & Aturan Fallback | Urutan Bucket (*Sorting*) |
| :--- | :--- | :--- | :--- |
| **`SESSION`** | `session` | `ASIA`, `LONDON`, `NEW_YORK`, `LONDON_NY_OVERLAP`. Fallback: `UNSPECIFIED`. | Urutan kanonikal sesi pasar global |
| **`DAY_OF_WEEK`** | `exitDate` (default) atau `entryDate` | Diproyeksikan ke IANA `timeZone` eksplisit (default `"UTC"`): `MONDAY` s/d `SUNDAY`. | Senin (`MONDAY`) s/d Minggu (`SUNDAY`) |
| **`SYMBOL`** | `pair` | `trim().toUpperCase()`. Fallback: `UNSPECIFIED`. | Jumlah trade terbanyak (*desc*), lalu alfabetis (`localeCompare`) |
| **`DIRECTION`** | `direction` | `"LONG"` / `"BUY"` $\to$ `"LONG"`; `"SHORT"` / `"SELL"` $\to$ `"SHORT"`. | `LONG`, `SHORT` |
| **`SETUP`** | `setupTags[]` (fallback `strategyId`) | Multi-tag attribution (trade dengan 2 tag masuk ke kedua bucket tag). Jika kosong $\to$ `UNSPECIFIED_SETUP`. | Jumlah trade terbanyak (*desc*), lalu alfabetis (`UNSPECIFIED_SETUP` di akhir) |
| **`STRATEGY`** | `strategyId` | `trim()`. Jika kosong $\to$ `UNSPECIFIED_STRATEGY`. | Jumlah trade terbanyak (*desc*), lalu alfabetis |
| **`TIMEFRAME`** | `timeframe` | `M1`, `M5`, `M15`, `H1`, `H4`, `D1`, `W1`. Fallback: `UNSPECIFIED`. | Kronologis durasi candle (`M1` $\to$ `W1`) |
| **`MARKET_CONDITION`** | `marketCondition` *(Optional)* | `TRENDING_BULL`, `TRENDING_BEAR`, `RANGING`, `HIGH_VOLATILITY`, `LOW_LIQUIDITY`, `NEWS_DRIVEN`. Jika belum diisi $\to$ `UNAVAILABLE`. | Kanonikal kondisi pasar (`UNAVAILABLE` di akhir) |
| **`EMOTION`** | `emotion` | `DISCIPLINED`, `CONFIDENT`, `NEUTRAL`, `ANXIOUS`, `FOMO`, `REVENGE`, `TIRED`. | Kanonikal psikologi trading |
| **`MISTAKE`** | `mistake` | `NONE`, `FOMO_ENTRY`, `CHASING`, `EARLY_EXIT`, `WIDENING_SL`, `OVERLEVERAGING`, `REVENGE_TRADING`, `NO_PLAN`. | Kanonikal evaluasi disiplin |

---

## 3. Metrik per Bucket Dimensi (`DimensionalBucketMetrics`)

Setiap bucket dihitung melalui pemanggilan `buildCoreMetricsSummary(bucketTrades, currency, decimals)` dari `lib/analytics/core-metrics.ts`:

- `totalTrades`, `winningTrades`, `losingTrades`, `breakevenTrades`
- `winRate` (Comprehensive Win Rate: $\frac{N_{\text{win}}}{N_{\text{total}}} \times 100$) dan `winRateDecisive` ($\frac{N_{\text{win}}}{N_{\text{win}} + N_{\text{loss}}} \times 100$)
- `totalNetPnl`, `grossProfit`, `grossLoss` (berbasis integer minor units `BigInt`)
- `averageWin`, `averageLoss` (positif), `signedAverageLoss`, `winLossRatio`
- `profitFactor` (`null` jika `ZERO_LOSSES`)
- `expectancy` (terverifikasi dengan exact rational reconciliation)
- `averageR`, `totalR`, `rEligibleTradesCount`, dan objek `rMultiple` lengkap
- `sampleStatus` (`NO_DATA` = 0, `INSUFFICIENT` = 1–14, `LIMITED` = 15–29, `SUFFICIENT` $\ge 30$) dan `sampleDisclaimer`

---

## 4. Aturan Validasi & Isolasi

1. **Hanya Trade `CLOSED` Valid:** Disaring menggunakan `filterEligibleClosedTradesWithDiagnostics`. Trade `OPEN`, `CANCELLED`, tanggal tidak valid, atau nilai `netPnl` korup otomatis masuk ke `intakeDiagnostics`.
2. **Isolasi Mata Uang:** Mencampur mata uang tanpa filter ditolak (`BLOCKED_MULTI_CURRENCY` / `UNSUPPORTED_CURRENCY`).
3. **Isolasi Arus Kas:** Transaksi `DEPOSIT` dan `WITHDRAWAL` tidak pernah masuk ke populasi trade.
4. **Validasi Timezone IANA:** Divalidasi via `isValidIanaTimeZone(timeZone)` dengan default `"UTC"`. Input timezone tidak valid mengembalikan status `"INVALID_TIMEZONE"`.

