# SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 2.1
## JOURNAL SERVICE DEEP FUNCTIONAL & FINANCIAL INTEGRITY AUDIT REPORT

**Role:** Senior Backend Engineer, Financial Systems Auditor, Domain Logic Reviewer  
**Date:** 2026-11-05  
**Project:** Signal Casper Academy (`d:\Developer\Web-Edukasi-Casper-main`)  
**Audit Target:** Sprint 3 Task 2 (`lib/journal-service.ts`, `lib/journal-types.ts`, `tests/journal-service.test.mjs`)  
**Decision:** **APPROVED WITH CONDITIONS** (Ready for Sprint 3 Task 3 Analytics Engine)

---

### EXECUTIVE SUMMARY

In response to the Product Owner's directive for Sprint 3 Task 2.1, a rigorous deep functional and financial integrity audit was performed on the source code of `lib/journal-service.ts`, `lib/journal-types.ts`, and their test suites. Rather than relying on previous summary claims, every domain path was audited against financial correctness, floating-point precision edge cases, state machine transitions, tenancy boundaries, concurrency guarantees, and archival rules.

The audit identified **4 significant technical deficiencies** in the initial implementation:
1. **Asymmetric Epsilon Rounding Bias on Negative Values** in `roundToDecimals`.
2. **Open Trade Equity Fabrication Risk** where floating quotes were simulated or conflated with realized balance.
3. **Missing Archival Checks** in `cancelTrade`, `deleteTrade`, and `deleteCashTransaction`.
4. **Data Quality Tag Inconsistency** in trade updates and silent coercion of unauthorized `VERIFIED_BROKER` tags.

All 4 deficiencies were systematically remediated directly in source code. The service test suite was expanded from **27 test cases to 35 test cases** (**100% pass rate**). Across the entire repository, all **114 test cases across 6 test files passed** without a single failure or regression.

---

### 1. AUDITED SOURCE ARTIFACTS & DIRECTORY SCOPE

The following actual files and line ranges were inspected line-by-line:

| Source File | Lines Audited | Focus Area |
| :--- | :---: | :--- |
| `lib/journal-types.ts` | 1–294 | Data models, currency decimals, account types, cash transaction schema |
| `lib/journal-storage.ts` | 1–620 | Per-user mutex (`UserPartitionLock`), atomic writes, quarantine, rollbacks |
| `lib/journal-service.ts` | 1–1500 | Domain methods, validation rules, rounding arithmetic, balance calculations |
| `tests/journal-service.test.mjs` | 1–1189 | 35 comprehensive test cases covering financial and edge scenarios |
| `tests/journal-storage.test.mjs` | 1–850 | 24 test cases for storage concurrency, wipe, and auto-recovery |
| `docs/sprint-3/student_trading_journal_architecture.md` | v2.1.1 | Architecture baseline and financial calculation specifications |
| `docs/sprint-3/task-2-journal-service-implementation-report.md` | v1.0.0 | Previous implementation report verified against source reality |

---

### 2. AUDIT FINDINGS, SEVERITY CLASSIFICATION & REMEDIATION

#### Finding 1: Floating-Point Epsilon Rounding Asymmetry on Negative P/L
- **Severity**: **HIGH**
- **Impacted Function**: `roundToDecimals(value, decimals)` in `lib/journal-service.ts` (lines 87–91).
- **Vulnerability / Flaw**:
  The previous implementation used `Math.round((value + Number.EPSILON) * factor) / factor`.
  Because `Number.EPSILON` is positive ($+2.22 \times 10^{-16}$), adding it to a negative number reduces its absolute magnitude (moving it closer to zero).
  Consequently, half-way negative values suffered asymmetric rounding:
  - `roundToDecimals(1.005, 2)` produced `1.01` (Correct half-up).
  - `roundToDecimals(-1.005, 2)` produced `-1.00` (**Defective**: truncated instead of rounding to `-1.01`).
  - `roundToDecimals(-35.855, 2)` produced `-35.85` instead of `-35.86`.
- **Financial Risk**: Realized losses were systematically under-reported by 1 cent on half-way fractional loss boundaries.
- **Remediation**:
  Replaced with symmetric exponential-notation rounding:
  ```ts
  export function roundToDecimals(value: number, decimals: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    return sign * Number(Math.round(Number(abs + "e" + decimals)) + "e-" + decimals);
  }
  ```
  Verified with tests: `-1.005` $\to$ `-1.01`, `-35.855` $\to$ `-35.86`, `0.1 + 0.2` $\to$ `0.3`.
- **Status**: **RESOLVED & VERIFIED**.

---

#### Finding 2: Open Position Equity Policy & Unrealized P/L Conflation
- **Severity**: **HIGH**
- **Impacted Functions**: `calculateAccountBalances`, `updateAccountBalancesInPartition`, `createTrade`, `updateTrade` in `lib/journal-service.ts`.
- **Vulnerability / Flaw**:
  The system previously allowed `OPEN` trades to store an arbitrary `grossPnl` and added it to `unrealizedPnl`. Furthermore, when open trades existed with no P/L, `equity` was reported as equal to `realizedBalance`.
  In an offline trading journal without live broker price feeds, mark-to-market floating quotes cannot be determined. Conflating settled balance with equity misleads students into believing their open positions carry zero floating risk.
- **Remediation**:
  1. **Strict Open Trade Purity**: In `createTrade` and `updateTrade`, `OPEN` trades are strictly barred from recording `grossPnl`, `netPnl`, `outcome`, `exitPrice`, or `exitDate`. All P/L fields are forced to `undefined`.
  2. **Truthful Equity Derivation**: In `calculateAccountBalances`, when active open trades exist (`openTradesCount > 0`):
     - `unrealizedPnl` returns `null` (not 0).
     - `equity` returns `null` in `AccountBalanceSummary`.
     - `equityDefinition` explicitly returns:
       `"Unrealized P/L is unavailable because offline journal does not connect to live market feeds. Equity cannot be computed for N open position(s). Settled realized balance is X USD."`
  3. **Settled Baseline on Schema**: On the persistent `TradingAccount` record on disk (where `equity: number` is typed), `account.equity` stores `realizedBalance` as the settled capital baseline, and code comments declare that live floating variance is excluded.
- **Status**: **RESOLVED & VERIFIED**.

---

#### Finding 3: Missing Archival Mutation Checks on Trade & Cash Operations
- **Severity**: **MEDIUM**
- **Impacted Functions**: `cancelTrade`, `deleteTrade`, `deleteCashTransaction` in `lib/journal-service.ts`.
- **Vulnerability / Flaw**:
  While `createTrade`, `updateTrade`, `closeTrade`, `createCashTransaction`, and `updateCashTransaction` enforced `if (account.isArchived) throw new JournalValidationError(...)`, the deletion and cancellation methods neglected this guard. A client could cancel or delete trades and cash transactions on an archived account, modifying historical balances of a frozen ledger.
- **Remediation**:
  Added explicit account lookup and archival guards to `cancelTrade`, `deleteTrade`, and `deleteCashTransaction`:
  ```ts
  const account = partition.accounts.find((a) => a.id === existing.accountId);
  if (account && account.isArchived) {
    throw new JournalValidationError("Cannot delete/cancel trade or cash transaction belonging to an archived account.");
  }
  ```
  Verified via Test Case 30: All three operations reject with HTTP 422 `JournalValidationError`.
- **Status**: **RESOLVED & VERIFIED**.

---

#### Finding 4: Data Quality Tag Spoofing & Mutation Gap
- **Severity**: **MEDIUM**
- **Impacted Functions**: `createTrade`, `updateTrade`, `closeTrade` in `lib/journal-service.ts`.
- **Vulnerability / Flaw**:
  1. `createTrade` silently downgraded `VERIFIED_BROKER` to `SELF_REPORTED_MANUAL` instead of actively rejecting unauthorized claims.
  2. `UpdateTradeInput` did not allow updating `dataQuality`, preventing students from upgrading a trade from `ESTIMATED_INCOMPLETE_FEES` to `SELF_REPORTED_MANUAL` once broker statements arrived.
- **Remediation**:
  1. Replaced silent fallback with strict rejection: Any attempt to submit `dataQuality: "VERIFIED_BROKER"` in `createTrade`, `closeTrade`, or `updateTrade` immediately throws HTTP 422 `JournalValidationError`.
  2. Added `dataQuality?: DataQualityTag` to `UpdateTradeInput`, allowing legitimate transitions between `ESTIMATED_INCOMPLETE_FEES` and `SELF_REPORTED_MANUAL`.
- **Status**: **RESOLVED & VERIFIED**.

---

#### Finding 5: Closed Trade Modification & Historic Audit Trail Limitation
- **Severity**: **MEDIUM (Architectural Boundary)**
- **Impacted Function**: `updateTrade` in `lib/journal-service.ts`.
- **Audit Analysis**:
  The prompt required auditing whether CLOSED trades can be edited without leaving an inconsistent history.
  In `updateTrade`, when a CLOSED trade's financial parameters (`grossPnl`, `commission`, `swap`, `otherFees`) are modified:
  - `netPnl` and `outcome` are recomputed server-side.
  - `updateAccountBalancesInPartition` immediately recalculates the parent account's `realizedBalance` and `cashBalance`.
  - The trade's `updatedAt` is updated to current UTC time.
  However, `TradeRecord` in schema v1 does NOT maintain an append-only revision ledger (e.g. `priorValues`, `reasonForCorrection`, `revisionAuthor`).
- **Policy Established**: We **do not claim immutable financial accounting** for manual journal entries. Historical mutations are supported to allow students to correct typos, but are in-place updates. A formal correction audit trail with change diffs is documented as an enhancement for future sprints.
- **Status**: **DOCUMENTED AS OPERATIONAL BOUNDARY**.

---

#### Finding 6: Cash Transaction Types (Deposit, Withdrawal vs Adjustment)
- **Severity**: **LOW**
- **Impacted Function**: `createCashTransaction` in `lib/journal-service.ts`.
- **Audit Analysis**:
  In `journal-types.ts`, `CashTransaction.type` is restricted to `"DEPOSIT" | "WITHDRAWAL"`.
  Any attempt to submit an `ADJUSTMENT` type or negative amount is rejected with HTTP 422 `JournalValidationError`.
  Arbitrary balance adjustments must be executed as distinct deposits or withdrawals with descriptive notes.
- **Status**: **CONFIRMED COMPLIANT WITH SCHEMA V1**.

---

### 3. FINANCIAL CALCULATION ENGINE VERIFICATION

#### A. Symmetric Rounding Behavior
Evaluated across floating-point representations:

| Test Value | Target Decimals | Previous Implementation | Corrected Exponential Rounding | Status |
| :---: | :---: | :---: | :---: | :---: |
| `+1.005` | 2 | `1.01` | **`1.01`** | PASSED |
| `-1.005` | 2 | `-1.00` (Defective) | **`-1.01`** | **CORRECTED** |
| `+35.855` | 2 | `35.86` | **`35.86`** | PASSED |
| `-35.855` | 2 | `-35.85` (Defective) | **`-35.86`** | **CORRECTED** |
| `0.1 + 0.2` | 2 | `0.30` | **`0.30`** | PASSED |
| `123456.78 IDR` | 0 | `123457` | **`123457`** | PASSED |
| `12.3456 BHD` | 3 | `12.346` | **`12.346`** | PASSED |

#### B. Single Non-Overlapping Fee Deduction Formula
Net Profit/Loss is strictly derived server-side on create, update, and close:
$$\text{Net P/L} = \text{Gross P/L} - \text{commission} + \text{swap} - \text{otherFees}$$
- Client cannot submit a fabricated `netPnl`.
- `commission` and `otherFees` are non-negative deductions ($\text{fee} \ge 0$).
- `swap` is signed ($\text{positive} = \text{financing credit}, \text{negative} = \text{overnight debit}$).
- Fees are deducted exactly once.

#### C. Distinct Balance Hierarchy
$$\begin{aligned}
\text{Initial Balance} &= B_0 \quad (\text{static capital baseline}) \\
\text{Cash Balance} &= B_0 + \sum \text{Deposits} - \sum \text{Withdrawals} \\
\text{Realized P/L} &= \sum_{t \in \text{CLOSED}} \text{Net P/L}_t \quad (\text{OPEN and CANCELLED excluded}) \\
\text{Realized Balance} &= \text{Cash Balance} + \text{Realized P/L} \\
\text{Equity} &= \begin{cases} 
\text{Realized Balance}, & \text{if } N_{\text{open}} = 0 \quad (\text{all positions closed}) \\
\mathbf{null}, & \text{if } N_{\text{open}} > 0 \quad (\text{unrealized P/L unavailable})
\end{cases}
\end{aligned}$$

---

### 4. STORAGE, MUTEX & CONCURRENCY VERIFICATION

1. **Storage Isolation**: The service never imports `fs` or accesses files directly. All persistence executes through `mutateUserPartition` and `readUserPartitionLocked`.
2. **Atomic Concurrency**: Every mutation function accepts `options?: WritePartitionOptions` with `expectedVersion`. Concurrent writes with mismatched versions are rejected with HTTP 409 `ConcurrencyConflictError`.
3. **Tenancy Guard**: Every service function verifies partition ownership. Alice cannot query or modify Bob's account, trade, or cash transaction (returns HTTP 404 `JournalNotFoundError`).
4. **Tombstone Enforcement**: Service calls on wiped partitions reject with HTTP 410 `AccountTombstonedError`.

---

### 5. COMPLETE TEST EXECUTION RESULTS (114 TEST CASES)

All test files executed individually to avoid multi-process file locks on `data/academy.json`:

| Test File | S Area Covered | Test Cases | Pass | Fail |
| :--- | :--- | :---: | :---: | :---: |
| [`tests/journal-service.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/journal-service.test.mjs) | Core Journal Service & Financial Integrity | **35** | **35** | 0 |
| [`tests/journal-storage.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/journal-storage.test.mjs) | Partitioned Storage, Mutex & Recovery | **24** | **24** | 0 |
| [`tests/academy.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/academy.test.mjs) | Academy LMS, Progress & Course Editor | **26** | **26** | 0 |
| [`tests/rate-limit.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/rate-limit.test.mjs) | Auth Rate Limiting & Brute-Force Defense | **12** | **12** | 0 |
| [`tests/db.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/db.test.mjs) | Database Core & Migration Engine | **8** | **8** | 0 |
| [`tests/qa-sprint2-task3-3.test.mjs`](file:///d:/Developer/Web-Edukasi-Casper-main/tests/qa-sprint2-task3-3.test.mjs) | Deep Functional & Security QA Regression | **9** | **9** | 0 |
| **TOTAL** | **Full System Suite Across Sprints 2 & 3** | **114** | **114** | **0** |

#### New Test Cases Added in Task 2.1:
- **Test 28**: Symmetric Decimal Rounding & Currency Precision (eliminates IEEE 754 epsilon bias).
- **Test 29**: Equity & Unrealized P/L Policy on OPEN Positions (`null` when live quotes unavailable).
- **Test 30**: Archived Account Operations: Blocks `cancelTrade`, `deleteTrade`, `deleteCashTransaction` (HTTP 422).
- **Test 31**: Data Quality Tag Enforcement: Rejects `VERIFIED_BROKER` on create, update, and close (HTTP 422).
- **Test 32**: Data Quality Tag Transition on Update (allows clean upgrade from estimated to manual).
- **Test 33**: Cash Transactions Recalibration: Re-derives balance without mutating realized P/L.
- **Test 34**: Partial Update Preservation: Retains unmentioned fields on trade record.
- **Test 35**: Cash Transaction Validation: Rejects invalid types (`ADJUSTMENT`) and negative amounts.

---

### 6. STATIC ANALYSIS, COMPILATION & REPOSITORY HEALTH

1. **TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit
   # Exit code: 0 (Zero errors)
   ```
2. **ESLint**:
   ```bash
   npm run lint
   # Exit code: 0 (Zero errors on all files; zero warnings on all journal files)
   ```
3. **Next.js Production Build**:
   ```bash
   npm run build
   # ✓ Compiled successfully in 2.8s
   # ✓ Generating static pages (34/34)
   # Exit code: 0
   ```
4. **Git Repository Status**:
   - `data/academy.json`: Pristine, valid, and unmodified.
   - Zero Git commits or pushes made.
   - Remote VPS untouched.
   - Zero new npm dependencies installed.

---

### 7. RESIDUAL RISKS & RECOMMENDATIONS FOR SPRINT 3 TASK 3

1. **Floating P/L Absence**: Because `unrealizedPnl` returns `null` for open trades, the upcoming Analytics Engine (`lib/journal-analytics.ts` in Task 3) must calculate all performance metrics (Win Rate, Profit Factor, Expectancy, Drawdown) **strictly over closed trades** ($N_{\text{closed}}$). Open trades must be excluded from analytical metrics.
2. **In-Memory Lock Boundary**: `UserPartitionLock` guarantees safety within a single Node.js runtime process (standard for Next.js standalone and PM2 fork mode). Multi-process clustering requires distributed locking (e.g. Redis).

---

### AUDITOR CONCLUSION & DECISION

**Decision:** **APPROVED WITH CONDITIONS**

Sprint 3 Task 2 (Journal Core Service) has undergone exhaustive functional and financial auditing. All identified calculation biases, equity ambiguities, and archival gaps have been remediated, verified with 35 dedicated test cases, and confirmed against all 114 test cases repository-wide.

The Core Service Layer is now solid, mathematically sound, and ready to serve as the foundation for **Sprint 3 Task 3: Performance Analytics Engine (`lib/journal-analytics.ts`)**.

