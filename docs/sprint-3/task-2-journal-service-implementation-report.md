# SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 2
## TRADING ACCOUNT & JOURNAL CORE SERVICE IMPLEMENTATION REPORT

**Role:** Principal Software Architect, Financial Calculation Engineer, Database Architect, and Application Security Engineer  
**Date:** 2026-11-05  
**Project:** Signal Casper Academy (`d:\Developer\Web-Edukasi-Casper-main`)  
**Status:** **READY FOR PRODUCT OWNER EVALUATION**

---

### EXECUTIVE SUMMARY

Sprint 3 Task 2 establishes the core domain business logic layer (`lib/journal-service.ts`) for the Student Trading Journal & Performance Tracking system. Operating strictly above the hardened partitioned storage layer (`lib/journal-storage.ts`, completed and approved in Task 1 / 1.1 / 1.2), this service layer enforces business validation, tenancy isolation, optimistic concurrency, and financial accounting rules.

#### Key Verification Metrics
- **Zero API or UI Scope Creep**: No HTTP route handlers (`app/api/*`) or frontend components were introduced.
- **Zero Core Database Modifications**: `data/academy.json` remains pristine and untouched.
- **Strict Financial Accounting**: Distinct balance segregation (`initialBalance`, `cashBalance`, `realizedPnl`, `realizedBalance`, `equity`) with currency-specific decimal rounding.
- **Single Non-Overlapping Fee Deduction**: $\text{Net P/L} = \text{Gross P/L} - \text{commission} + \text{swap} - \text{otherFees}$.
- **Complete Test Coverage**: 27 dedicated service test cases in `tests/journal-service.test.mjs` (**100% pass**), accompanied by 79 passing tests across existing storage and LMS regression test files (**106/106 test cases passed** across 6 test files).
- **TypeScript & Build**: `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm run build` (34/34 routes compiled cleanly).

---

### 1. ARCHITECTURAL POSITIONING & PATTERN

```
┌─────────────────────────────────────────────────────────────┐
│       Presentation Layer (Future Tasks 4-9)                 │
│   Next.js API Routes (app/api/journal/*) & Client UI        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│         Domain Service Layer (lib/journal-service.ts)       │
│  - Account Management & Lifecycle (Active / Archived)       │
│  - Trade Journal CRUD, State Machine & Recalibration        │
│  - Cash Transactions (Deposits / Withdrawals)               │
│  - Precision Rounding & Distinct Balance Derivation         │
│  - Data Quality Tagging & Sanity Validations                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│        Storage & Concurrency Layer (lib/journal-storage.ts) │
│  - Per-User In-Memory Mutex (`UserPartitionLock`)           │
│  - Atomic Disk Persistence (.tmp -> fsync -> rename)        │
│  - Automated Quarantine & Rollback Recovery                 │
│  - Permanent Wipe & Atomic Tombstones                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Partitioned File System                     │
│               data/journals/u_{userId}.json                 │
└─────────────────────────────────────────────────────────────┘
```

The domain service interacts with persistent storage exclusively through `mutateUserPartition` and `readUserPartitionLocked`. It never directly interacts with raw file streams, file descriptors, or directory entries.

---

### 2. CORE SERVICE FUNCTIONS & API CONTRACT

`lib/journal-service.ts` provides domain methods categorized into three domains and one calculation helper set:

#### A. Trading Account Domain
1. `createTradingAccount(userId, input, options)`: Creates a new trading account (`DEMO` or `LIVE`), initializes baseline metrics, assigns UUIDv4, sets `isArchived = false`, and records UTC timestamps.
2. `getTradingAccounts(userId, includeArchived)`: Retrieves all accounts belonging to `userId`. Archived accounts are excluded by default unless `includeArchived = true`.
3. `getTradingAccountById(userId, accountId)`: Retrieves a specific account. Throws `JournalNotFoundError` (HTTP 404) if the account does not exist or belongs to another user.
4. `updateTradingAccount(userId, accountId, updates, options)`: Updates account metadata (`accountName`, `brokerLabel`, `initialBalance`, `notes`).
   - **Currency Immutability**: Prohibits changing `accountCurrency` if any trades or cash transactions exist on the account (throws `JournalValidationError` HTTP 422).
5. `archiveTradingAccount(userId, accountId, options)`: Soft-deletes the account (`isArchived: true`). Preserves historical trade and balance data.
6. `restoreTradingAccount(userId, accountId, options)`: Restores an archived account (`isArchived: false`).

#### B. Trade Journal Domain
1. `createTrade(userId, input, options)`: Creates a new trade journal entry.
   - Validates that the associated account exists, belongs to `userId`, and is **not archived**.
   - Normalizes direction: `BUY`/`LONG` $\to$ `LONG`, `SELL`/`SHORT` $\to$ `SHORT`.
   - Upper-cases symbol/pair (e.g., `XAUUSD`, `EURUSD`).
   - Validates non-negative numerical fields (lot size, entry price, stop loss, take profit).
   - Validates timestamps (`entryDate` format; if `exitDate` is provided, enforces $\text{exitDate} \ge \text{entryDate}$).
   - If created in `CLOSED` status, executes financial calculation, sets outcome (`WIN`, `LOSS`, `BREAKEVEN`), and recalibrates account balances.
2. `getTrades(userId, filter)`: Queries trades with multi-criteria filtering:
   - By `accountId`
   - By `status` (`OPEN`, `CLOSED`, `CANCELLED`)
   - By `direction` (`LONG`, `SHORT`)
   - By `pair` / symbol
   - Date range filtering (`startDate`, `endDate`)
3. `getTradeById(userId, tradeId)`: Retrieves a trade by ID. Throws `JournalNotFoundError` (HTTP 404) if not found or cross-tenant.
4. `updateTrade(userId, tradeId, updates, options)`: Updates trade parameters while open. Re-validates timestamps and numerical bounds.
5. `closeTrade(userId, tradeId, closeData, options)`: Closes an active or open trade:
   - Validates $\text{exitDate} \ge \text{entryDate}$.
   - Calculates Net P/L using strict non-overlapping formula.
   - Resolves outcome (`WIN` if $\text{Net P/L} > 0$, `LOSS` if $\text{Net P/L} < 0$, `BREAKEVEN` if $\text{Net P/L} = 0$).
   - Sets status to `CLOSED`.
   - Atomically recalibrates the parent account's balances.
6. `cancelTrade(userId, tradeId, cancelReason, options)`: Cancels an unexecuted or voided trade:
   - Sets status to `CANCELLED`.
   - Clears `pnlGross`, `pnlNet`, and sets `outcome` to `null`.
   - Atomically recalibrates account balances.
7. `deleteTrade(userId, tradeId, options)`: Permanently removes a trade record and immediately recalibrates the account's balances.

#### C. Cash Transaction Domain
1. `createCashTransaction(userId, input, options)`: Records a cash deposit or withdrawal:
   - Validates account exists, belongs to `userId`, and is not archived.
   - Enforces positive amount $> 0$.
   - Atomically recalibrates account balances.
2. `getCashTransactions(userId, accountId)`: Lists cash transactions for an account.
3. `updateCashTransaction(userId, transactionId, updates, options)`: Modifies a cash transaction and recalibrates balance.
4. `deleteCashTransaction(userId, transactionId, options)`: Removes a cash transaction and recalibrates balance.

#### D. Balance Derivation & Precision Arithmetic
1. `roundToDecimals(val, decimals)`: Floating-point precision normalizer using `Number(Math.round(Number(val + "e" + decimals)) + "e-" + decimals)` to eliminate binary representation jitter.
2. `roundCurrencyAmount(val, currency)`: Rounds financial values according to the ISO currency specification (`USD` = 2, `EUR` = 2, `IDR` = 0, `JPY` = 0, `BHD` = 3).
3. `calculateAccountBalances(account, trades, cashTransactions)`: Deterministic single-pass calculation of all distinct balance metrics.

---

### 3. FINANCIAL ACCOUNTING & BALANCE SEGREGATION

The service enforces strict distinction across all account balances:

$$\begin{aligned}
\text{Initial Balance} &= B_{\text{baseline}} \quad \text{(immutable starting capital)} \\
\text{Cash Balance} &= B_{\text{baseline}} + \sum \text{Deposits} - \sum \text{Withdrawals} \\
\text{Realized P/L} &= \sum_{\text{closed trades}} \text{Net P/L} \\
\text{Realized Balance} &= \text{Cash Balance} + \text{Realized P/L} \\
\text{Equity} &= \text{Realized Balance} + \text{Unrealized P/L} \quad \text{($\text{Unrealized P/L} = 0$ without broker streaming)}
\end{aligned}$$

#### Single Non-Overlapping Fee Deduction
Net Profit and Loss is calculated without double deductions:
$$\text{Net P/L} = \text{Gross P/L} - \text{commission} + \text{swap} - \text{otherFees}$$
- $\text{Gross P/L}$: Positive for gains, negative for losses.
- $\text{commission}$: Non-negative expense ($\ge 0$). Subtracted.
- $\text{swap}$: Signed carry adjustment (can be positive credit or negative overnight fee). Added.
- $\text{otherFees}$: Non-negative expense ($\ge 0$). Subtracted.

#### Data Quality Tagging
Manual entries are explicitly tagged `SELF_REPORTED_MANUAL`. Entries with missing or zero fee records are tagged `ESTIMATED_INCOMPLETE_FEES`. The tag `VERIFIED_BROKER` is strictly barred until broker API bridge integration is implemented in future sprints.

---

### 4. ERROR TAXONOMY & HTTP STATUS MAPPING

All domain errors emitted by `lib/journal-service.ts` extend `JournalServiceError` or are re-exported from storage:

| Error Class | HTTP Status | Trigger Condition |
| :--- | :---: | :--- |
| `JournalValidationError` | **422** | Negative prices/lots, `exitDate < entryDate`, currency mutation on active account, operation on archived account |
| `JournalNotFoundError` | **404** | Target account, trade, or transaction ID not found, or cross-tenant access violation |
| `ConcurrencyConflictError` | **409** | Optimistic concurrency mismatch (`expectedVersion !== partition.version`) |
| `AccountTombstonedError` | **410** | Attempting any service operation on a permanently wiped partition |
| `PartitionCorruptedError` | **503** | Storage partition corrupted with no valid recovery backup snapshot |
| `JournalServiceError` | **400** | Generic client input error or unrecognized domain operation |

---

### 5. NON-REENTRANT MUTEX INTEGRATION (ARCHITECTURAL INSIGHT)

During development and verification of the service layer, a critical locking nuance was observed:
- The storage layer's `UserPartitionLock` serializes tasks by appending promise tails per `userId`.
- Because JavaScript Promises are asynchronous and non-reentrant, invoking `mutateUserPartition` or `wipeUserJournal` from within an outer manual `globalUserPartitionLock.acquire()` wrapper will cause a **recursive self-deadlock**.
- **Rule Enforced**: Service methods delegate lock management directly to `mutateUserPartition` and `readUserPartitionLocked`. Callers and test cases must not wrap service calls inside external mutex acquisitions for the same `userId`.

---

### 6. COMPREHENSIVE TEST SUITE RESULTS

#### A. Service Test Suite (`tests/journal-service.test.mjs`) — 27 Test Cases
Executed with `node --test tests/journal-service.test.mjs`:

```text
TAP version 13
# Subtest: Signal Casper Academy - Trading Account & Journal Core Service Suite
    ok 1 - 1. Create Trading Account: Valid DEMO & LIVE accounts with Currency Decimals
    ok 2 - 2. Get Trading Accounts: Filter Active vs Archived
    ok 3 - 3. Update Account Metadata: Name, BrokerLabel, and InitialBalance
    ok 4 - 4. Archive Account: Soft-delete sets isArchived to true
    ok 5 - 5. Restore Account: Restores archived account to active
    ok 6 - 6. Create Trade (OPEN): Valid parameters & normalization
    ok 7 - 7. Get Trades: Filter by account, status, direction, and pair
    ok 8 - 8. Update OPEN Trade: Adjust StopLoss and Notes
    ok 9 - 9. Close Trade: Computes Net P/L, outcome, and re-derives account balance
    ok 10 - 10. Cancel Trade: Clear P/L and set status CANCELLED
    ok 11 - 11. Delete Trade: Permanently removes trade and recalibrates account balance
    ok 12 - 12. Reject Trade on Archived Account: Throws JournalValidationError (422)
    ok 13 - 13. Reject Foreign/Non-Existent Account ID: Throws JournalNotFoundError (404)
    ok 14 - 14. Reject Foreign Trade ID: Cross-user isolation (Alice cannot view Bob's trade)
    ok 15 - 15. Reject Invalid Timestamps: exitDate < entryDate and malformed dates
    ok 16 - 16. Reject Invalid Financial Values: Negative prices, lots, and balances
    ok 17 - 17. Preserve Manual P&L Quality Tag: SELF_REPORTED_MANUAL & ESTIMATED_INCOMPLETE_FEES
    ok 18 - 18. Single Non-Overlapping Fee Deduction: Net P/L = Gross P/L - commission + swap - otherFees
    ok 19 - 19. Cash Transactions: Create Deposit & Withdrawal
    ok 20 - 20. Cash Transaction Ownership & Archived Account Block
    ok 21 - 21. Optimistic Concurrency Control: expectedVersion Mismatch Rejection (HTTP 409)
    ok 22 - 22. Concurrent Trade Creation: 10 parallel trades executed with 0 lost updates
    ok 23 - 23. Concurrent Account Updates: Serialized cleanly via UserPartitionLock
    ok 24 - 24. Tombstoned Partition Rejection: Service calls reject with HTTP 410
    ok 25 - 25. Corrupted Partition Error Handling: Throws PartitionCorruptedError (HTTP 503)
    ok 26 - 26. Currency Change Prohibition: Rejects currency change when trades or cash exist (HTTP 422)
    ok 27 - 27. Distinct Balance Derivations: Mathematical consistency of all balance fields
    1..27
ok 1 - Signal Casper Academy - Trading Account & Journal Core Service Suite
# tests 27 | suites 1 | pass 27 | fail 0 | duration_ms 368
```

#### B. Full Regression Verification Summary (106 Total Test Cases)
All test files executed individually to prevent parallel file-lock contention on `academy.json`:

| Test File | Test Focus | Cases | Passed | Failed |
| :--- | :--- | :---: | :---: | :---: |
| `tests/journal-service.test.mjs` | Sprint 3 Task 2 Core Domain Service | **27** | **27** | 0 |
| `tests/journal-storage.test.mjs` | Sprint 3 Task 1 Storage & Concurrency | **24** | **24** | 0 |
| `tests/academy.test.mjs` | Core LMS, Quiz, Progress & Course Editor | **26** | **26** | 0 |
| `tests/rate-limit.test.mjs` | Auth Rate Limiting & Brute-Force Guard | **12** | **12** | 0 |
| `tests/db.test.mjs` | Database Initialization, Migration & Rollback | **8** | **8** | 0 |
| `tests/qa-sprint2-task3-3.test.mjs` | Deep Functional & Security QA | **9** | **9** | 0 |
| **TOTAL** | **Entire Test Suite Across All Sprints** | **106** | **106** | **0** |

*Note on untracked file*: `tests/qa-sprint2-task3-3.test.mjs` remains untracked in Git deliberately in accordance with Sprint 2 Task 3.3 instructions prohibiting Git commits or pushes.

---

### 7. BUILD & COMPILATION HEALTH

1. **TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit
   # Exit code: 0 (No type errors)
   ```
2. **ESLint**:
   ```bash
   npm run lint
   # Exit code: 0 (0 errors, 15 pre-existing unused variable warnings in UI pages)
   # All journal files (lib/journal-*.ts) have ZERO errors and ZERO warnings.
   ```
3. **Next.js Production Build**:
   ```bash
   npm run build
   # ✓ Compiled successfully in 2.6s
   # ✓ Generating static pages (34/34)
   # Exit code: 0
   ```

---

### 8. GIT REPOSITORY & DATABASE INTEGRITY STATUS

```bash
git status
# On branch main
# Your branch is up to date with 'origin/main'.
# Changes not staged for commit:
#   modified:   app/belajar/[slug]/page.tsx
#   modified:   app/kelas/[slug]/page.tsx
#   modified:   lib/db.ts
#   modified:   lib/server-progress.ts
# Untracked files:
#   docs/
#   lib/journal-service.ts
#   lib/journal-storage.ts
#   lib/journal-types.ts
#   tests/journal-service.test.mjs
#   tests/journal-storage.test.mjs
#   tests/qa-sprint2-task3-3.test.mjs
```
- `data/academy.json` is clean, untouched, and uncommitted.
- No Git commits or pushes were performed.
- No remote VPS access was attempted.
- No new third-party packages were installed.

---

### 9. RESIDUAL RISKS & RECOMMENDATIONS FOR TASK 3

1. **Analytical Metrics Boundary**:
   - `lib/journal-service.ts` intentionally limits its calculations to single-trade metrics (Net P/L, outcome) and distinct account balance derivations.
   - Comprehensive performance analytics (Win Rate, Profit Factor, Expectancy, Max Drawdown, Sharpe/Sortino ratios, and streak tracking) are reserved for Sprint 3 Task 3 (`lib/journal-analytics.ts`).
2. **Single-Process Mutex Assumption**:
   - As documented in Task 1, `UserPartitionLock` guarantees concurrency safety within a single Node.js runtime process (standard for Next.js standalone and PM2 fork mode). If cluster or multi-server scaling is adopted in the future, a Redis or distributed lock will be required.

---

### CONCLUSION & NEXT STEPS

Sprint 3 Task 2 (Trading Account & Journal Core Service Implementation) is **100% complete, fully verified, and ready for Product Owner review**.

We now pause and await the Product Owner's assessment before proceeding to Sprint 3 Task 3 (Analytics Engine & Performance Calculation).

