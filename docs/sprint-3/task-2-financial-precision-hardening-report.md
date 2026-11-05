# SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 2.2
## FINANCIAL PRECISION HARDENING REPORT

**Role:** Senior Financial Systems Engineer, Backend Engineer  
**Date:** 2026-11-05  
**Project:** Signal Casper Academy (`d:\Developer\Web-Edukasi-Casper-main`)  
**Scope:** Hardening Financial Precision Arithmetic on `lib/journal-service.ts`  
**Status:** **READY FOR PRODUCT OWNER REVIEW**

---

### EXECUTIVE SUMMARY

Sprint 3 Task 2.2 menyelesaikan perbaikan mendasar pada presisi aritmetika finansial dalam [`lib/journal-service.ts`](file:///d:/Developer/Web-Edukasi-Casper-main/lib/journal-service.ts). Masalah keterbatasan representasi biner IEEE-754 pada JavaScript `Number` (seperti `0.1 + 0.2 = 0.30000000000000004` dan akumulasi compounding drift pada penjumlahan multi-transaksi) diatasi secara tuntas menggunakan **Fixed-Point Scaled Integer Minor-Unit Engine (`BigInt`)**.

Seluruh agregasi saldo (`totalDeposits`, `totalWithdrawals`, `realizedPnl`, `cashBalance`, `realizedBalance`) dan kalkulasi Net P/L trade kini dieksekusi menggunakan **aritmetika integer murni berskala eksak ($10^D$)**, tanpa pembulatan berulang di tengah agregasi, dan dikonversi kembali ke unit utama secara presisi pada batas akhir perhitungan.

#### Metrik Kualitas & Hasil Pengujian
- **Peningkatan Test Suite**: Dari 35 test cases menjadi **50 test cases** di [`tests/journal-service.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/journal-service.test.mjs) (**100% pass**), mencakup seluruh 15 skenario pengujian presisi finansial yang diwajibkan Product Owner.
- **Regresi Repositori Penuh**: **129 test cases lulus tanpa kegagalan (100% pass)** di seluruh 6 test files.
- **Kompilasi TypeScript**: Lolos tanpa error (`npx tsc --noEmit` Exit code 0, kompatibel penuh dengan target ES2017).
- **ESLint & Next.js Build**: 0 error linting, 34/34 rute Next.js berhasil dikompilasi pada production build.
- **Integritas Database**: `data/academy.json` bersih dan tidak tersentuh.

---

### 1. PENDEKATAN ARITMETIKA FINANSIAL: FIXED-POINT MINOR UNITS

#### A. Mengapa Pendekatan Integer Minor Units Dipilih?
1. **Eliminasi Binary Representation Drift**:
   Dalam standar IEEE-754, pecahan desimal seperti $0.1$ dan $0.2$ tidak memiliki representasi biner yang presisi. Menjumlahkannya berulang kali menghasilkan akumulasi kesalahan representasi.
   Dengan mengonversi nilai ke integer minor units (misal: 10 sen dan 20 sen untuk USD, atau unit integer langsung untuk IDR/JPY), seluruh operasi penjumlahan dan pengurangan berjalan dalam domain integer:
   $$10n + 20n = 30n \quad (\text{Eksak } 0.30 \text{ USD})$$
2. **Tanpa Compounding Rounding Error**:
   Sebelumnya, setiap trade yang diiterasi memanggil `roundToDecimals` pada setiap langkah loop. Pada ratusan trade, pembulatan di setiap langkah dapat mengakumulasi penyimpangan saldo.
   Pada implementasi baru:
   $$\text{realizedPnl}_{\text{minor}} = \sum_{t \in \text{CLOSED}} \text{netPnl}_{\text{minor}, t}$$
   Seluruh nilai minor dijumlahkan sebagai integer `BigInt`, dan konversi desimal hanya dilakukan **satu kali pada akhir kalkulasi**.
3. **Kompatibilitas Penuh dengan Skema & Zero Dependencies**:
   Sistem tidak memerlukan library pihak ketiga (seperti `bignumber.js` atau `decimal.js`). Seluruh field pada disk dan interface tetap bertipe `number` unit utama (misal `$10.50`), sehingga tidak ada perubahan skema database yang memecah kompatibilitas (*non-breaking*).
4. **Dukungan Penuh Skala Desimal Sesuai ISO Currency**:
   Sistem membaca skala desimal $D$ secara dinamis dari `CURRENCY_DECIMALS_MAP` (`USD` = 2, `IDR` = 0, `JPY` = 0, `BHD` = 3, dll.).

---

### 2. ARSITEKTUR MESIN ARITMETIKA BARU

Implementasi pada [`lib/journal-service.ts`](file:///d:/Developer/Web-Edukasi-Casper-main/lib/journal-service.ts):

```typescript
// Konversi nominal mata uang utama ke minor units (BigInt) dengan sanitasi eksak
export function toMinorUnits(amount: number, decimals: number): bigint {
  if (typeof amount !== "number" || !Number.isFinite(amount) || isNaN(amount)) {
    throw new JournalValidationError(`Invalid financial numerical value: ${amount}`);
  }
  const sign = amount < 0 ? BigInt(-1) : BigInt(1);
  const abs = Math.abs(amount);
  const roundedInt = Math.round(Number(abs + "e" + decimals));
  return sign * BigInt(roundedInt);
}

// Konversi integer minor units kembali ke nominal mata uang utama (number)
export function toMajorUnits(minor: bigint, decimals: number): number {
  const sign = minor < BigInt(0) ? -1 : 1;
  const absMinor = minor < BigInt(0) ? -minor : minor;
  if (decimals === 0) return sign * Number(absMinor);
  const factor = BigInt(10) ** BigInt(decimals);
  const intPart = absMinor / factor;
  const fracPart = (absMinor % factor).toString().padStart(decimals, "0");
  return sign * Number(intPart.toString() + "." + fracPart);
}

// Formula eksak Net P/L: g - c + s - o dalam integer minor units
export function calculateExactNetPnl(
  grossPnl: number,
  commission: number,
  swap: number,
  otherFees: number,
  decimals: number
): number {
  const g = toMinorUnits(grossPnl, decimals);
  const c = toMinorUnits(Math.abs(commission), decimals);
  const s = toMinorUnits(swap, decimals);
  const o = toMinorUnits(Math.abs(otherFees), decimals);
  const netMinor = g - c + s - o;
  return toMajorUnits(netMinor, decimals);
}
```

---

### 3. FIELD & FUNGSI YANG TERPENGARUH

| Komponen / Fungsi | Field yang Terpengaruh | Mekanisme Presisi Baru |
| :--- | :--- | :--- |
| `calculateExactNetPnl` | `netPnl` | $\text{Gross} - \text{commission} + \text{swap} - \text{otherFees}$ dihitung dalam integer minor units `BigInt`. |
| `calculateAccountBalances` | `totalDeposits`, `totalWithdrawals`, `cashBalance`, `realizedPnl`, `realizedBalance` | Akumulasi kas dan trade dijumlahkan sebagai minor units `BigInt(0)` sebelum dikonversi ke unit utama. Tidak ada drift pembulatan multi-transaksi. |
| `createTrade` & `closeTrade` | `grossPnl`, `commission`, `swap`, `otherFees`, `netPnl` | Sanitasi input non-finite, konversi ke minor units, perhitungan Net P/L melalui `calculateExactNetPnl`. |
| `updateTrade` | `grossPnl`, `commission`, `swap`, `otherFees`, `netPnl` | Rekalkulasi Net P/L eksak pada trade CLOSED dan peremajaan saldo akun. |
| `createCashTransaction` & `updateCashTransaction` | `amount` | Dibulatkan ke minor units sesuai skala desimal mata uang akun (`roundToDecimals`). |
| `createTradingAccount` & `updateTradingAccount` | `initialBalance` | Divalidasi non-negatif dan dinormalisasi presisi minor units. |

---

### 4. CONTOH KOMPARASI PERHITUNGAN: SEBELUM VS SESUDAH

| Skenario Pengujian | Perhitungan Mentah Floating-Point | Implementasi Baru (Minor Units) | Status Akurasi |
| :--- | :---: | :---: | :---: |
| `0.1 + 0.2` (USD) | `0.30000000000000004` | **`0.30`** | **Eksak** |
| Akumulasi 30 trade masing-masing \$0.10 | `2.999999999999999` atau `3.0000000000000004` | **`3.00`** | **Eksak (0 drift)** |
| 10 deposit @ \$100.10 dikurangi 5 penarikan @ \$50.05 | Rentan selisih biner pada akumulasi float | **Deposit: \$1001.00, Penarikan: \$250.25, Net: \$750.75** | **Eksak** |
| Pembulatan simetris $+1.005$ dan $-1.005$ | $+1.01$ dan $-1.00$ *(Asymmetric bug)* | **$+1.01$ dan $-1.01$** | **Simetris 100%** |
| Biaya komisi & swap: `100.55 - 3.20 + (-1.15) - 0.50` | `95.70000000000002` | **`95.70`** | **Eksak** |
| Nilai Finansial Besar: \$999,999,999,999.99 + \$999,999,999,999.99 | Potensi kehilangan presisi mantissa float | **`1999999999999.98`** | **Eksak** |
| Mata Uang Nol Desimal: 123456.78 IDR / JPY | Pembulatan float biner | **`123457`** | **Sesuai ISO IDR/JPY** |
| Mata Uang Tiga Desimal: 12.3456 BHD | Potensi pemotongan pecahan | **`12.346`** | **Sesuai ISO BHD** |

---

### 5. HASIL PENGUJIAN LENGKAP (129 TEST CASES)

#### A. 15 Test Cases Khusus Task 2.2 (`tests/journal-service.test.mjs` Tests 36–50)
1. **Test 36**: `0.1 + 0.2` menghasilkan nilai uang tepat `0.3` tanpa float drift.
2. **Test 37**: Pembulatan desimal positif *half-up* (`1.005 -> 1.01`, `1.0049 -> 1.00`).
3. **Test 38**: Pembulatan desimal negatif *half-up* (`-1.005 -> -1.01`, `-1.0049 -> -1.00`).
4. **Test 39**: Pembulatan simetris terhadap nol pada sekumpulan nilai representasi biner.
5. **Test 40**: Penanganan mata uang IDR (0 desimal) pada nilai positif dan negatif.
6. **Test 41**: Penanganan mata uang USD (2 desimal).
7. **Test 42**: Penanganan mata uang JPY (0 desimal).
8. **Test 43**: Penanganan mata uang BHD (3 desimal).
9. **Test 44**: Penanganan nilai finansial besar (\$999 Miliar) tanpa overflow atau presisi hilang.
10. **Test 45**: Penanganan nilai desimal sangat kecil di bawah unit minor (`0.0001 -> 0.00`, `0.005 -> 0.01`).
11. **Test 46**: Agregasi P/L banyak trade (30 trade tertutup) menghasilkan realized P/L presisi dengan 0 drift.
12. **Test 47**: Agregasi transaksi kas (10 deposit, 5 penarikan) tanpa mengotori realized P/L trading.
13. **Test 48**: Perhitungan eksak komisi dan biaya dengan swap bernilai negatif (biaya) atau positif (kredit).
14. **Test 49**: Rekalkulasi koreksi trade CLOSED memperbarui saldo akun secara konsisten via minor units.
15. **Test 50**: Penolakan input numerik tidak valid (`NaN`, `Infinity`, `-Infinity`).

#### B. Rekapitulasi Regresi Seluruh File Pengujian
Dieksekusi satu per satu untuk memastikan tidak terjadi perebutan file lock pada `data/academy.json`:

| File Pengujian | Modul yang Diuji | Test Cases | Lulus | Gagal |
| :--- | :--- | :---: | :---: | :---: |
| [`tests/journal-service.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/journal-service.test.mjs) | Trading Account, Journal Service & Precision Engine | **50** | **50** | 0 |
| [`tests/journal-storage.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/journal-storage.test.mjs) | Partitioned Storage, Concurrency Mutex & Quarantine | **24** | **24** | 0 |
| [`tests/academy.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/academy.test.mjs) | Academy Core LMS, Progress Sync, Quiz & Course Editor | **26** | **26** | 0 |
| [`tests/rate-limit.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/rate-limit.test.mjs) | Authentication Rate Limiter & Brute-Force Defense | **12** | **12** | 0 |
| [`tests/db.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/db.test.mjs) | Database Engine, Migration, Rollback & Cold Rehydration | **8** | **8** | 0 |
| [`tests/qa-sprint2-task3-3.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/qa-sprint2-task3-3.test.mjs) | Functional, Security & Data Integrity QA Regression | **9** | **9** | 0 |
| **TOTAL** | **Seluruh Rangkaian Uji Repositori** | **129** | **129** | **0** |

---

### 6. PEMERIKSAAN KUALITAS STATIS & REPOSITORI

1. **TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit
   # Exit code: 0 (Bebas error, kompatibel penuh dengan ES2017 target)
   ```
2. **ESLint**:
   ```bash
   npm run lint
   # Exit code: 0 (0 error, 0 warning pada seluruh modul jurnal)
   ```
3. **Next.js Production Build**:
   ```bash
   npm run build
   # ✓ Compiled successfully in 2.7s
   # ✓ Generating static pages (34/34)
   # Exit code: 0
   ```
4. **Status Git & Integritas File**:
   - `data/academy.json`: Bersih, valid, dan sama sekali tidak diubah.
   - Tidak ada paket npm baru yang dipasang.
   - Tidak ada `git commit` atau `git push`.
   - VPS remote tidak diakses.

---

### 7. RISIKO TERSISA & BATASAN OPERASIONAL

1. **Batas Aman Konversi `Number.MAX_SAFE_INTEGER`**:
   Input awal ke `toMinorUnits` bertipe `number`. JavaScript merepresentasikan integer presisi hingga $2^{53}-1 \approx 9 \times 10^{15}$. Dalam mata uang 2 desimal (USD), ini setara dengan \$90 triliun. Angka ini jauh melampaui batas saldo trading siswa mana pun.
2. **Histori Revisi Trade CLOSED**:
   Sebagaimana disepakati pada Product Owner Review Task 2.1, koreksi nilai pada trade CLOSED dieksekusi secara in-place tanpa riwayat versi tabel audit append-only. Saldo akun dijamin tersinkronisasi 100% konsisten, namun audit trail revisi formal dicatat sebagai peningkatan untuk sprint audit mendatang.

---

### KESIMPULAN & LANGKAH SELANJUTNYA

Sprint 3 Task 2.2 (Financial Precision Hardening) **selesai 100% dan terverifikasi secara matematis**.

Fondasi data transaksi dan akuntansi pada `lib/journal-service.ts` kini sepenuhnya presisi, decimal-safe, dan siap menjadi fondasi untuk:
**Sprint 3 — Task 3: Student Performance Analytics Engine (`lib/journal-analytics.ts`)**.

Sesuai instruksi, implementasi Task 3 **belum dimulai**. Kami menunggu evaluasi dan persetujuan Product Owner terhadap Task 2.2 sebelum melanjutkan.

