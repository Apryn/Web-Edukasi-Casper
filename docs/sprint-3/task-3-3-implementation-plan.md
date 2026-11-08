# SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 3.3
## DRAWDOWN & TIME-SERIES ENGINE IMPLEMENTATION PLAN

**Document Version:** 2.0.0  
**Status:** REVISED ARCHITECTURAL BLUEPRINT (PRE-IMPLEMENTATION GATE — AWAITING PO APPROVAL)  
**Author:** Senior Software Architect & Quantitative Analytics Engineer  
**Scope:** Architectural blueprint, domain contracts, phased execution roadmap, test scenarios matrix, and pre-implementation gates  

---

## 1. Architectural Strategy & File Boundaries

To maintain clean separation of concerns, high maintainability, and zero performance degradation, Task 3.3 decomposes trajectory analytics into two specialized pure calculation modules while extending existing domain contract types:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        lib/analytics/ (Kernel)                         │
├────────────────────────────────┬───────────────────────────────────────┤
│ core-metrics.ts (Task 3.2)     │ Single-point summary metrics:         │
│                                │ Win Rate, Profit Factor, Expectancy   │
├────────────────────────────────┼───────────────────────────────────────┤
│ drawdown-metrics.ts (Task 3.3) │ Sequence / Trajectory metrics:        │
│                                │ High-Water Mark, Max Drawdown, Epochs │
├────────────────────────────────┼───────────────────────────────────────┤
│ time-series-metrics.ts (Task 3.3)│ Calendar-period aggregations:       │
│                                │ Daily, Weekly, Monthly Buckets        │
├────────────────────────────────┼───────────────────────────────────────┤
│ analytics-types.ts             │ SSOT Domain Interfaces & Contracts    │
└────────────────────────────────┴───────────────────────────────────────┘
```

### Module Responsibilities & Verification
1. **`lib/analytics/analytics-types.ts` (Domain Contracts Extension):**
   - Add `DrawdownCurvePoint`, `DrawdownEpoch`, `DrawdownSummaryResult`, `DrawdownCalculationStatus`.
   - Explicit status codes: `"AVAILABLE"`, `"OK"`, `"NO_DATA"`, `"ZERO_LOSSES"`, `"UNAVAILABLE_BASE_CAPITAL"`, `"CAPITAL_DEPLETED"`.
   - Add `TimeSeriesGranularity`, `TimeSeriesPeriodBucket`, `TimeSeriesSummaryResult`, `TimeSeriesOptions`.
   - Note: Raw volume fields (`totalVolume`) are explicitly excluded to prevent heterogeneous unit mixing across asset classes.
2. **`lib/analytics/drawdown-metrics.ts` (New Pure Module):**
   - Implements `calculateDrawdownMetrics(trades, decimals, startingCapital?)`.
   - Implements deterministic sorting (`exitDate` asc, `id` asc tie-breaker).
   - Cumulative realized trading P/L only (closed trades).
   - High-water mark anchored at $Peak_0 = 0$.
   - Independent tracking of peak trade, trough trade, recovery trade, and duration metrics.
   - If `startingCapital` is null/undefined or $\le 0$, nominal MDD is computed, but percentage MDD returns `null` with status `"UNAVAILABLE_BASE_CAPITAL"`.
3. **`lib/analytics/time-series-metrics.ts` (New Pure Module):**
   - Implements `calculateTimeSeriesMetrics(trades, decimals, options)`.
   - Validates input timezone against IANA registry via `Intl.DateTimeFormat`. Rejects invalid timezones with `"INVALID_TIMEZONE"`.
   - Explicit default timezone: `"UTC"`. Never leaks Node.js server local time.
   - ISO-8601 calendar bucketing (`DAILY`, `WEEKLY`, `MONTHLY`).
   - Sparse mode (default) vs Dense mode (`includeEmptyPeriods: true`, requiring explicit `startDate` and `endDate`).
4. **`tests/analytics-drawdown.test.mjs` (New Test Suite):**
   - Dedicated unit test suite with 15+ comprehensive test cases covering nominal MDD, percentage MDD, peak anchoring at zero, consecutive losses, breakeven dilution, multiple equal peaks, unrecovered epochs, and edge cases.
5. **`tests/analytics-time-series.test.mjs` (New Test Suite):**
   - Dedicated unit test suite with 15+ comprehensive test cases covering IANA timezone validation, UTC default, daily/weekly/monthly grouping, ISO week numbering, sparse vs dense fills, and period expectancy proofs.

---

## 2. Phased Execution Roadmap

### Phase 1: Domain Type System Extension (`analytics-types.ts`)
- Define all new TypeScript interfaces without altering existing Task 3.2 types.
- Ensure strict optionality and explicit status codes:
  - `DrawdownCalculationStatus = "AVAILABLE" | "OK" | "NO_DATA" | "ZERO_LOSSES" | "UNAVAILABLE_BASE_CAPITAL" | "CAPITAL_DEPLETED"`
- Omit volume aggregation from `TimeSeriesPeriodBucket` to preserve dimensional integrity.
- Verification: `npx tsc --noEmit` must pass with 0 errors.

### Phase 2: Drawdown Engine Implementation (`drawdown-metrics.ts`)
- Implement `sortTradesDeterministically(trades: TradeRecord[]): TradeRecord[]`.
  - Primary key: `t.exitDate` ascending (ISO-8601 string sort).
  - Secondary key: `t.id` ascending (`a.id.localeCompare(b.id)`).
- Implement pure calculation loop:
  - Anchor $Peak_0 = 0\text{n}$ in `BigInt` minor units.
  - Compute running $C_t = C_{t-1} + \text{netPnlMinor}_t$.
  - Update $Peak_t = \max(Peak_{t-1}, C_t)$.
  - Track active epoch: peak trade, trough trade, recovery trade, and duration metrics.
  - Compute $\%DD_t$ only if valid `startingCapital > 0` is supplied:
    * $\text{EquityPeak}_t = \text{startingCapital} + Peak_t$
    * $\text{EquityTrough}_t = \text{startingCapital} + C_t$
    * $\text{DrawdownAmount}_t = Peak_t - C_t$
    * If $\text{EquityPeak}_t > 0$, compute $\%DD_t = \frac{\text{DrawdownAmount}_t}{\text{EquityPeak}_t} \times 100$ without artificial clipping (can exceed $100.0\%$, e.g. $120.0\%$).
    * If $\text{EquityPeak}_t \le 0$, set $\%DD_t = \text{null}$ (non-positive denominator).
  - Handle capital depletion: If $\text{EquityTrough}_t \le 0$, flag status as `"CAPITAL_DEPLETED"`. This status signals account wipeout/deficit without clipping the percentage.
- Implement `calculateDrawdownMetrics()`.
- Author `tests/analytics-drawdown.test.mjs` and verify all tests pass.

### Phase 3: Time-Series Engine Implementation (`time-series-metrics.ts`)
- Implement IANA timezone validator:
  - Validates `options.timeZone` via `Intl.DateTimeFormat(undefined, { timeZone })`.
  - Throws descriptive error / returns error status `"INVALID_TIMEZONE"` on failure.
  - Defaults explicitly to `"UTC"`.
- Implement deterministic timezone calendar projection:
  - `getZonedCalendarKey(exitDate, granularity, timeZone)`
  - ISO week algorithm for `WEEKLY` (`YYYY-Www`, Monday–Sunday).
  - Month extraction for `MONTHLY` (`YYYY-MM`).
  - Day extraction for `DAILY` (`YYYY-MM-DD`).
- Implement period aggregation loop:
  - Group trades by period key.
  - Sum minor units for Net P/L, Gross Profit, Gross Loss.
  - Compute period trade counts ($m, m_W, m_L, m_{BE}$), win rate, profit factor, and expectancy.
- Implement dense range-filling (`includeEmptyPeriods: true`):
  - Validate presence of valid ISO `startDate` and `endDate`.
  - Generate missing period buckets with `hasActivity: false`, `tradeCount: 0`, and analytical ratios `null`.
- Author `tests/analytics-time-series.test.mjs` and verify all tests pass.

### Phase 4: Full System Integration & Regression Audit
- Run full unit and regression test suite (154 + ~30 new tests = 184+ tests).
- Verify TypeScript (`tsc --noEmit`) 0 errors.
- Verify ESLint (`npm run lint`) 0 errors.
- Verify Next.js production build (`npm run build`) 34 routes success.
- Deliver comprehensive audit and verification report for Task 3.3.

---

## 3. Test Scenarios Matrix

### 3.1 Drawdown Engine Test Matrix (`tests/analytics-drawdown.test.mjs`)

| Test Case | Scenario / Condition | Expected Result |
| :---: | :--- | :--- |
| **DD-01** | Empty trades array ($N=0$) | `maxDrawdownNominal: null`, status `"NO_DATA"`, `curvePoints: []` |
| **DD-02** | All winning trades (zero losses) | `maxDrawdownNominal: 0.0`, `currentDrawdown: 0.0`, status `"ZERO_LOSSES"` |
| **DD-03** | Immediate first trade loss ($C_1 < 0$) | Initial peak anchored at zero ($Peak_0 = 0$). Drawdown starts immediately. |
| **DD-04** | Monotonic consecutive losses | Drawdown deepens continuously. Trough updates to the lowest cumulative step. |
| **DD-05** | Single drawdown with complete recovery | Epoch records `isRecovered: true`, `recoveryDate`, and exact duration counts. |
| **DD-06** | Unrecovered drawdown at dataset end | Epoch records `isRecovered: false`, `recoveryDate: null`, `currentDrawdown > 0`. |
| **DD-07** | Breakeven trade inside drawdown | $DD$ value remains identical; epoch duration increments by 1 trade. |
| **DD-08** | Multiple equal peaks | Earlier peak recovers; second identical peak starts a distinct second epoch. |
| **DD-09** | Multiple equal maximum drawdowns | Primary MDD points to earliest occurrence; all epochs preserved in `allEpochs`. |
| **DD-10** | Deterministic tie-breaker ordering | Two trades with identical `exitDate` ordered strictly by `id.localeCompare`. |
| **DD-11** | Percentage MDD with baseline capital | $\%DD$ calculated accurately using $\frac{DD}{B_0 + Peak} \times 100$. |
| **DD-12** | Percentage MDD without baseline capital | `maxDrawdownPercentage: null`, status `"UNAVAILABLE_BASE_CAPITAL"`. |
| **DD-13** | Capital depletion ($\text{EquityTrough} \le 0$) | Status `"CAPITAL_DEPLETED"`. Drawdown percentage calculated normally without clipping (e.g. $120.0\%$ when nominal DD exceeds initial capital). Null if $\text{EquityPeak} \le 0$. |
| **DD-14** | Large aggregate values ($> 2^{53}-1$) | Handled via BigInt minor units; zero precision loss or numeric overflow. |
| **DD-15** | Cash flow isolation | Cash deposits/withdrawals strictly excluded from drawdown trajectory. |

---

### 3.2 Time-Series Engine Test Matrix (`tests/analytics-time-series.test.mjs`)

| Test Case | Scenario / Condition | Expected Result |
| :---: | :--- | :--- |
| **TS-01** | Empty trades array | Returns empty periods array with status `"NO_DATA"`. |
| **TS-02** | Daily bucketing (`DAILY`) | Trades grouped strictly by `YYYY-MM-DD` in target timezone. |
| **TS-03** | Weekly bucketing (`WEEKLY`) | Trades grouped by ISO-8601 week `YYYY-Www` (Monday to Sunday). |
| **TS-04** | Monthly bucketing (`MONTHLY`) | Trades grouped by `YYYY-MM`. |
| **TS-05** | Timezone boundary projection | Trade at `23:30 UTC` correctly projected to next calendar day under `"Asia/Jakarta"` (UTC+7). |
| **TS-06** | Explicit UTC default | Default timezone is strictly `"UTC"`; zero reliance on server local time. |
| **TS-07** | Invalid IANA timezone | Passing invalid timezone (e.g., `"Invalid/Zone"`) throws or returns `"INVALID_TIMEZONE"`. |
| **TS-08** | Period metric accuracy | Period Net P/L, Gross Profit, Gross Loss match BigInt minor-unit sum. |
| **TS-09** | Period trade counts | Counts $m, m_W, m_L, m_{BE}$ verified exactly. Volume excluded. |
| **TS-10** | Period Expectancy reconciliation | Reconciled via BigInt cross-multiplication parity proof for each active period. |
| **TS-11** | Period Profit Factor | Scaled ratio calculation safe against zero losses (`"ZERO_LOSSES"` status). |
| **TS-12** | Sparse series generation | Empty days/weeks excluded from results (`includeEmptyPeriods: false`). |
| **TS-13** | Dense series range-filling | Empty intervals generated with `hasActivity: false`, `tradeCount: 0`, analytical ratios `null`. |
| **TS-14** | Best & worst period identification | Correctly identifies peak profit period and peak loss period. |
| **TS-15** | Year-turn ISO week boundary | Correctly handles week 52/53 vs. week 1 around New Year's Day. |

---

## 4. Security, Privacy & Architectural Constraints

1. **Pure Stateless Execution:** Functions in `drawdown-metrics.ts` and `time-series-metrics.ts` accept plain arrays and return plain result objects. They perform zero I/O, zero global caching, and zero mutation of input arguments.
2. **Snapshot Isolation:** The calling service copies trade data under the existing `withPartitionLock` and immediately releases the lock before passing the snapshot to the analytics functions.
3. **Multi-Tenant Privacy:** No user ID, trade ID, notes, or execution details are leaked into shared memory. Diagnostics and errors contain zero PII.
4. **No Financial Guarantees or Signals:** The output is strictly historical analytics. No future profit forecasts, trading signals, or broker verification endorsements are provided.

---

## 5. Definition of Done for Task 3.3

Task 3.3 implementation will commence only after the following gate criteria are satisfied:
- [x] Mathematical and architectural specifications approved by Product Owner.
- [ ] `lib/analytics/analytics-types.ts` extended with verified domain interfaces.
- [ ] `lib/analytics/drawdown-metrics.ts` implemented and passing all 15+ tests.
- [ ] `lib/analytics/time-series-metrics.ts` implemented and passing all 15+ tests.
- [ ] All 184+ repository tests passing (100% pass rate).
- [ ] TypeScript check (`tsc --noEmit`) passes with 0 errors.
- [ ] ESLint check (`npm run lint`) passes with 0 errors.
- [ ] Production build (`npm run build`) compiles successfully.
- [ ] Final verification audit report delivered and approved by Product Owner.
