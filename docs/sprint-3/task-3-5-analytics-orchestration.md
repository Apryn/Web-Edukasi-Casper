# SIGNAL CASPER ACADEMY — SPRINT 3
# TASK 3.5 — ANALYTICS ORCHESTRATION ARCHITECTURE & IMPLEMENTATION

**Document Version:** 1.0.0  
**Date:** 2026-11-08  
**Role:** Principal Software Architect & Quantitative Analytics Engineer  
**Status:** IMPLEMENTED & 100% VERIFIED  

---

## 1. Tujuan & Arsitektur

**Analytics Orchestration Service** (`lib/analytics/analytics-orchestrator.ts`) adalah satu-satunya pintu utama (*single unified gateway*) untuk mengambil analitik performa trading siswa yang mengintegrasikan keempat engine murni:
1. **Core Metrics Engine (`Task 3.2 & 3.2.1`)**
2. **Drawdown Metrics Engine (`Task 3.3`)**
3. **Time-Series Metrics Engine (`Task 3.3`)**
4. **Dimensional Slicer Engine (`Task 3.4`)**

---

## 2. Pipeline Snapshot Tanpa Penahanan Lock (*Detached Snapshot Pipeline*)

```
getStudentAnalyticsReport(userId, filterInput)
   │
   ├─► 1. readUserPartitionLocked(userId)      [Acquire per-user mutex lock]
   ├─► 2. clonePartitionForAnalytics(partition)[Deep-clone accounts, trades, cashTransactions]
   ├─► 3. Lock Released Immediately!           [Storage lock bebas untuk operasi tulis lain]
   │
   └─► 4. orchestratePartitionAnalytics(detachedSnapshot, filterInput) [Pure & Stateless]
          ├─► Gate A: Validasi IANA Timezone (default "UTC")
          ├─► Gate B: Resolusi Akun & Pencegahan Multi-Currency Mixing
          ├─► Gate C: Kalkulasi Konteks Saldo Akun (initialBalance, cashBalance, realizedBalance)
          ├─► Gate D: Intake Filter (Hanya CLOSED trades valid + Diagnostics)
          ├─► Gate E: Penerapan Filter Konsisten (Date Range, Symbol, Direction, Session, DayOfWeek, Setup, Timeframe, MarketCondition)
          └─► Gate F: Eksekusi Paralel Keempat Engine pada Populasi Trade yang Identik
```

---

## 3. Jaminan Konsistensi & Keamanan

1. **Zero Duplicate Formula:** Orchestrator tidak menghitung ulang win rate, expectancy, drawdown, atau time-series; ia hanya menyaring kohort trade satu kali dan mendistribusikan array `filteredTrades` yang persis sama ke keempat engine.
2. **Isolasi Multi-Currency:** Jika pengguna memiliki lebih dari satu akun dengan mata uang berbeda (misal `USD` dan `IDR`) dan tidak menentukan filter `accountId` atau `currency`, orchestrator mengembalikan status `"BLOCKED_MULTI_CURRENCY"` beserta daftar `accountsAvailable`.
3. **Zero Cross-User Cache & Zero PII Leakage:** Tidak ada global cache lintas pengguna. Output `AnalyticsOrchestrationReport` hanya memuat ID akun, nama akun trading, dan metrik kuantitatif tanpa menyertakan email, password hash, atau IP address.

---

## 4. Hasil Pengujian (`tests/analytics-orchestrator.test.mjs`)

| ID Uji | Skenario | Status |
| :---: | :--- | :---: |
| **AO-01** | Jurnal kosong menghasilkan `NO_DATA` secara konsisten di keempat engine | **PASS** |
| **AO-02** | Integrasi keempat engine menghasilkan populasi trade dan total Net P/L yang identik | **PASS** |
| **AO-03** | Filter gabungan (`symbol`, `direction`, `session`, `dateRange`, `setup`, `timeframe`) diterapkan secara konsisten | **PASS** |
| **AO-04** | Pencegahan penggabungan akun multi-currency (`BLOCKED_MULTI_CURRENCY`) dan kesuksesan saat difilter per mata uang | **PASS** |
| **AO-05** | Transaksi kas (`DEPOSIT`/`WITHDRAWAL`) dan trade `OPEN` memperbarui `accountContext` tanpa mencemari metrik performa | **PASS** |
| **AO-06** | Jurnal berkapasitas besar (300 trade) menghasilkan output deterministik yang invarian terhadap urutan input | **PASS** |

