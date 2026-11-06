# SIGNAL CASPER ACADEMY — SPRINT 3: TASK 3.1
# PERFORMANCE ANALYTICS ENGINE — REVISED IMPLEMENTATION & ROLLOUT PLAN
**Author:** Senior Software Architect, Quantitative Analytics Engineer  
**Document ID:** DOC-S3-T3-PLAN-003-REV2  
**Revision Date:** 2026-11-06  
**Status:** Architecture Revision Only — Awaiting Product Owner Approval  
**Context:** Sprint 3 — Student Trading Journal & Self-Evaluation Platform  
**Target Release:** v2.2.0  

---

## 1. PHASED ROLLOUT ROADMAP

Following Product Owner review, the analytical development is structured into **six discrete, independently testable tasks** (Tasks 3.2 through 3.7).

```
┌─────────────────────────────────────────────────────────────┐
│ Task 3.2: Core Metrics Engine (Pure Functions)              │
│ (Net P/L, Win Rates, Avg Win/Loss, PF, Expectancy, R)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Task 3.3: Trade Drawdown & Time-Series Engine               │
│ (Deterministic sort, Cumulative P/L, Peak/Trough, Recovery) │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Task 3.4: Dimensional Analytics Slicer                      │
│ (Account, Instrument, Strategy, Session, TF, Emotion, Error)│
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Task 3.5: Analytics Orchestration & Service Layer           │
│ (Snapshot input, MetricEnvelope, ISO Currency Bucketing)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Task 3.6: Authorization & API Route Integration             │
│ (Ownership check, StudentConsent verification, Audit Log)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Task 3.7: Final End-to-End Analytics QA Suite               │
│ (Cross-user isolation, mathematical parity, edge cases)     │
└─────────────────────────────────────────────────────────────┘
```

*Note on Account Equity Drawdown: Account Equity Drawdown with Unitized NAV is formally deferred and NOT included in the executable scope of Sprint 3 because the current database lacks intraday mark-to-market valuation snapshots.*

---

## 2. SUB-TASK BREAKDOWN & ACCEPTANCE CRITERIA

### Task 3.2 — Core Metrics Engine
**File Target:** `lib/analytics/core-metrics.ts`  
**Description:** Implement stateless, pure calculation functions for baseline statistical metrics.

#### Scope:
1. `calculateTotalNetPnl(trades: TradeRecord[], decimals: number): number`
2. `calculateWinRates(trades: TradeRecord[]): WinRateResult`
   - Returns `winRateAll`, `winRateDecisive`, `breakevenRate`.
3. `calculateAverageWinLoss(trades: TradeRecord[], decimals: number): AvgWinLossResult`
   - Returns positive magnitude for `avgLossMagnitude`.
4. `calculateProfitFactor(trades: TradeRecord[], decimals: number): ProfitFactorResult`
   - Returns `null` on zero gross losses with status `ZERO_LOSSES` (never `Infinity`).
5. `calculateExpectancy(trades: TradeRecord[], decimals: number): ExpectancyResult`
   - Reconciles Method 1 and Method 2 to mathematical parity.
6. `calculateRMultipleMetrics(trades: TradeRecord[]): RMultipleResult`
   - Uses verified `plannedRiskAmount > 0` field; isolates non-R trades from denominator.

#### Acceptance Criteria (Task 3.2):
- [ ] Operates in BigInt integer minor units via `toMinorUnits()` and `toMajorUnits()`.
- [ ] Zero floating-point accumulation drift across $\ge 1,000$ trades.
- [ ] Returns structured nulls on zero denominators (`NO_DATA`, `ZERO_LOSSES`, `ALL_BREAKEVEN`).
- [ ] Dual expectancy formulas verified to yield identical results within minor-unit rounding.
- [ ] 100% unit test coverage in `tests/analytics-core-metrics.test.mjs`.

---

### Task 3.3 — Trade Drawdown & Time-Series Engine
**File Target:** `lib/analytics/drawdown-engine.ts`  
**Description:** Implement chronological trade performance drawdown and cumulative curve generators.

#### Scope:
1. Deterministic sorting by `exitDate` ascending, using trade `id` as stable tie-breaker.
2. Cumulative P/L curve series calculation: $C_t = \sum NetPnl_i$.
3. Peak series tracking: $Peak_t = \max(0, C_1, \dots, C_t)$ (initial peak anchored at 0).
4. Drawdown series: $DD_t = Peak_t - C_t$.
5. Maximum Drawdown (MDD) calculation, identifying Peak date, Trough date, and Recovery date.

#### Acceptance Criteria (Task 3.3):
- [ ] Excludes trades without valid `exitDate`.
- [ ] MDD correctly derived across the 5 canonical test cases (all profit, profit-then-loss, consecutive losses, recovery, zero trades).
- [ ] Nominal drawdown reported in currency major units. Percentage drawdown reported only if valid non-zero capital basis is supplied.
- [ ] 100% unit test coverage in `tests/analytics-drawdown.test.mjs`.

---

### Task 3.4 — Dimensional Analytics Slicer
**File Target:** `lib/analytics/dimensional-slicer.ts`  
**Description:** Implement multi-dimensional categorization and cohort segmentation.

#### Scope:
1. Slicing by Account (`accountId`).
2. Slicing by Instrument (`pair`).
3. Slicing by Strategy (`strategyId`).
4. Slicing by Direction (`LONG` vs `SHORT`).
5. Slicing by Market Session (`ASIA`, `LONDON`, `NEW_YORK`, `LONDON_NY_OVERLAP`).
6. Slicing by Timeframe (`M1` through `W1`).
7. Slicing by Behavioral tags (`emotion`, `mistake`).
8. Slicing by Period (Day of week, Month, Custom date range).

#### Acceptance Criteria (Task 3.4):
- [ ] Unspecified or unassigned attributes grouped into an `"UNSPECIFIED"` bucket.
- [ ] Each dimension segment outputs its own complete `MetricEnvelope`.
- [ ] Segments with $N < 15$ automatically tagged with `sampleStatus: "INSUFFICIENT_SAMPLE"`.
- [ ] Multi-currency boundary enforced: trades of different currencies are never summed into a single nominal metric.
- [ ] 100% unit test coverage in `tests/analytics-dimensional.test.mjs`.

---

### Task 3.5 — Analytics Orchestration & Service Layer
**File Target:** `lib/journal-analytics.ts`  
**Description:** Service orchestrator that loads partition snapshots, coordinates sub-engines, and enriches responses.

#### Scope:
1. Coordinates `readUserPartitionLocked(userId)` to obtain point-in-time snapshot.
2. Releases partition lock immediately before invoking calculation sub-engines.
3. Groups accounts and trades by ISO Currency Code (`USD`, `IDR`, `EUR`, `JPY`, etc.).
4. Packages results into unified `MetricEnvelope<T>` structures.
5. Ingests query filters (date ranges, account IDs, strategy IDs).

#### Acceptance Criteria (Task 3.5):
- [ ] Operates completely outside the partition lock during calculation phase.
- [ ] No private analytics stored in global shared cache.
- [ ] Returns explicit currency buckets: `Record<CurrencyCode, AnalyticsPayload>`.
- [ ] Attach data quality distribution (`CALCULATED_STANDARD`, `SELF_REPORTED_MANUAL`, `ESTIMATED_INCOMPLETE_FEES`).
- [ ] Integration tests verify zero side-effects on disk partition during analytics read.

---

### Task 3.6 — Authorization & API Integration
**File Target:** `app/api/journal/analytics/route.ts` & `lib/analytics/authorization-guard.ts`  
**Description:** Secure REST API endpoint exposing analytics with multi-tenant access control.

#### Scope:
1. Authentication verification using session cookie (`COOKIE_SECURE` aware).
2. Ownership verification: requesting user must match target user partition.
3. Mentor consent verification: if requesting user is a Mentor, verify active, unexpired, unrevoked `StudentConsent` with scope `FULL_JOURNAL` or `ANALYTICS_ONLY`.
4. Role restriction: `ADMIN` / `MASTER_ADMIN` blocked from ad-hoc private analytics reads.
5. Audit logging: writes immutable `JournalAuditRecord` when a mentor inspects analytics.

#### Acceptance Criteria (Task 3.6):
- [ ] Unauthorized calls return HTTP 401 or HTTP 403.
- [ ] Expired or revoked mentor consent returns HTTP 403.
- [ ] Valid mentor inspection generates a verifiable audit log entry.
- [ ] End-to-end route tests in `tests/analytics-api.test.mjs`.

---

### Task 3.7 — Final Analytics QA & Mathematical Verification
**File Target:** `tests/qa-sprint3-task3.test.mjs`  
**Description:** Comprehensive test harness executing the full 19-scenario test matrix.

#### Scope:
- Executes edge cases: Division by zero, all breakeven, missing risk, simultaneous exit timestamps, high BigInt values, IDR/JPY/USD/BHD decimal precision, timezone epoch conversions.
- Verifies zero memory leakage and fast execution time on 1,000 synthetic trades.

#### Acceptance Criteria (Task 3.7):
- [ ] All 19 canonical test scenarios pass with zero failures.
- [ ] Production build (`npm run build`) and ESLint (`npm run lint`) pass with 0 errors.

---

## 3. OPEN PRODUCT OWNER DECISIONS & SIGN-OFF CHECKLIST

| Decision Item | Proposed Architectural Resolution | Status |
|---|---|---|
| **Account Equity Drawdown Scope** | Defer from Sprint 3 executable code due to missing intraday mark-to-market valuation data; retain Trade Performance Drawdown. | **AWAITING APPROVAL** |
| **R-Multiple Risk Field** | Standardize on existing `plannedRiskAmount` field; exclude unassigned trades from R denominator without synthetic guessing. | **AWAITING APPROVAL** |
| **Statistical Caution Thresholds** | Formalize $N < 15$ as `INSUFFICIENT_SAMPLE` and $15 \le N < 30$ as `LIMITED_SAMPLE` as internal Academy Educational Policy. | **AWAITING APPROVAL** |
| **Multi-Currency Policy** | Segment all nominal outputs by ISO 4217 currency code; ban unverified synthetic exchange rate conversions. | **AWAITING APPROVAL** |

---

## 4. STRICT EXECUTION BOUNDARIES
- **Implementation Status:** No source code (`.ts`, `.tsx`, `.js`) will be created or modified until the Product Owner explicitly signs off on this revised plan.
- **Next Step:** Upon approval, development begins strictly with **Task 3.2 (Core Metrics Engine)**.
