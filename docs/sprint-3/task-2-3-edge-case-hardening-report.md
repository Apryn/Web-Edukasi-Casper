# SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 2.3
## EDGE-CASE & PRECISION BOUNDARY HARDENING REPORT

**Role:** Senior Financial Systems Engineer, Backend Engineer  
**Date:** 2026-11-05  
**Project:** Signal Casper Academy (`d:\Developer\Web-Edukasi-Casper-main`)  
**Scope:** Hardening Precision Boundaries & Conversion Edge Cases in `lib/journal-service.ts`  
**Status:** **READY FOR FINAL PRODUCT OWNER SIGN-OFF**

---

### EXECUTIVE SUMMARY

Sprint 3 Task 2.3 secara khusus mengatasi catatan kritis Product Owner terkait batas representasi `Number` pada JavaScript ketika minor units dikonversi kembali ke unit utama (`toMajorUnits`) dan saat input angka dalam skala ekstrim diproses (`toMinorUnits`).

Sistem kini dilengkapi dengan:
1. **Validasi Batas Maksimum Aman IEEE-754 (`Number.MAX_SAFE_INTEGER`)**: Penolakan aktif terhadap nominal yang melampaui batas mantissa floating-point sebelum kehilangan presisi terjadi.
2. **Proteksi Overflow Akumulasi Minor Units**: `toMajorUnits` memvalidasi bahwa agregasi minor unit tidak melebihi $2^{53}-1$ minor unit ($9 \times 10^{15}$).
3. **Penanganan Notasi Ilmiah (*Scientific E-Notation*)**: Mencegah pembentukan nilai `NaN` saat angka sangat kecil ($< 10^{-6}$) dikonversi menjadi string eksponensial.
4. **Normalisasi Zero Simetris**: Menghilangkan representasi floating-point `-0`, menormalisasikannya secara deterministik ke `0`.

---

### 1. IMPLEMENTASI BATAS PRESISI EKSPLISIT

#### A. Batas Maksimum Nominal Aman per Skala Desimal
Pada [`lib/journal-service.ts`](file:///d:/Developer/Web-Edukasi-Casper-main/lib/journal-service.ts):
```typescript
export const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export function getMaxSafeFinancialAmount(decimals: number): number {
  const factor = BigInt(10) ** BigInt(decimals);
  return Number(MAX_SAFE_INTEGER_BIGINT / factor);
}
```
- Untuk mata uang 2 desimal (USD, EUR): Batas maksimum adalah **90.071.992.547.409** (~90 Triliun unit).
- Untuk mata uang 0 desimal (IDR, JPY): Batas maksimum adalah **9.007.199.254.740.991** (~9 Kuadriliun unit).
- Untuk mata uang 3 desimal (BHD, KWD): Batas maksimum adalah **9.007.199.254.740** (~9 Triliun unit).

Jika input melampaui batas ini, sistem tidak melakukan *silent truncation*, melainkan melempar `JournalValidationError` (HTTP 422).

#### B. Proteksi Overflow pada `toMajorUnits`
Sebelum mengonversi `BigInt` minor units ke `number`:
```typescript
if (absMinor > MAX_SAFE_INTEGER_BIGINT) {
  throw new JournalValidationError(
    `Financial minor units (${minor.toString()}) exceed safe integer precision limit (${Number.MAX_SAFE_INTEGER}). Aggregated balance cannot be safely represented.`
  );
}
```

#### C. Proteksi Notasi Ilmiah pada `toMinorUnits`
Angka di bawah $10^{-6}$ (seperti `1e-7`) secara otomatis diformat oleh JavaScript engine menjadi bentuk eksponensial `1e-7`. Bila digabungkan langsung dengan `"e" + decimals`, terbentuk string `"1e-7e2"` yang menghasilkan `NaN`.
Implementasi baru mendeteksi notasi ilmiah:
- Angka di bawah $10^{-6}$ diidentifikasi secara aman berada di bawah batas minor unit mata uang manapun (skala maksimal 3 desimal = $0.001$), dan dibulatkan menjadi `BigInt(0)`.
- Nilai eksponensial valid lainnya diproses menggunakan perkalian faktor `Math.pow(10, decimals)` sebelum dibulatkan.

#### D. Normalisasi `-0` ke `0`
Dalam IEEE-754, `-0` dan `0` dapat menghasilkan inkonsistensi saat diuji menggunakan `Object.is()`. Implementasi baru memastikan `result === 0 ? 0 : result` sehingga nilai `-0` selalu dinormalisasi menjadi `0`.

---

### 2. HASIL PENGUJIAN LENGKAP (134 TEST CASES)

Test suite domain service ditingkatkan dari **50 test cases** menjadi **55 test cases** di [`tests/journal-service.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/journal-service.test.mjs), mencakup:
- **Test 51**: Penolakan nominal yang melampaui ambang batas mantissa IEEE-754.
- **Test 52**: Penolakan minor units yang melebihi `Number.MAX_SAFE_INTEGER` pada `toMajorUnits`.
- **Test 53**: Penanganan angka notasi ilmiah (`1e-7`, `0.00000005`) tanpa menghasilkan `NaN`.
- **Test 54**: Normalisasi `-0` menjadi `0` positif.
- **Test 55**: Penegakan batas presisi end-to-end pada operasi service (`createTrade` menolak P/L $10^{16}$).

#### Rekapitulasi Regresi Seluruh Repositori:
| File Pengujian | Modul | Test Cases | Lulus | Gagal |
| :--- | :--- | :---: | :---: | :---: |
| [`tests/journal-service.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/journal-service.test.mjs) | Service Domain & Precision Boundary Suite | **55** | **55** | 0 |
| [`tests/journal-storage.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/journal-storage.test.mjs) | Partition Storage, Mutex & Recovery | **24** | **24** | 0 |
| [`tests/academy.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/academy.test.mjs) | Academy Core LMS, Progress & Quiz | **26** | **26** | 0 |
| [`tests/rate-limit.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/rate-limit.test.mjs) | Auth Rate Limiting & Brute-Force Guard | **12** | **12** | 0 |
| [`tests/db.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/db.test.mjs) | Database Core & Migration Engine | **8** | **8** | 0 |
| [`tests/qa-sprint2-task3-3.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/qa-sprint2-task3-3.test.mjs) | QA Functional & Security Regression | **9** | **9** | 0 |
| **TOTAL** | **Seluruh Repositori** | **134** | **134** | **0** |

---

### 3. KUALITAS STATIS & STATUS DATABASE

- `npx tsc --noEmit` $\to$ **Exit code 0** (0 error, kompatibel penuh ES2017).
- `npm run lint` $\to$ **Exit code 0** (0 error pada seluruh file).
- `data/academy.json` $\to$ **Bersih, utuh, dan tidak tersentuh**.
- Tidak ada commit, push, paket baru, atau akses ke VPS.

---

### KESIMPULAN

Task 2.3 telah berhasil menutup celah batas konversi `Number` dan batas presisi IEEE-754. Seluruh keterbatasan komputasi kini diketahui dan ditolak aktif oleh sistem, menjaga integritas angka finansial yang ditampilkan kepada siswa.

Task 2 kini siap ditutup secara final untuk melangkah ke **Sprint 3 — Task 3: Performance Analytics Engine Architecture**.

