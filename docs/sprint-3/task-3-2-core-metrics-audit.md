# SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 3.2
# CORE METRICS ENGINE — DEEP MATHEMATICAL & SOURCE CODE AUDIT REPORT

**Auditor:** Senior Quantitative Software Auditor, Financial Systems Engineer, TypeScript Test Engineer  
**Date:** 2026-11-07  
**Scope:** Performance Analytics Engine — Task 3.2 Core Metrics Calculation Kernel  
**Status:** AUDIT COMPLETE — AWAITING PRODUCT OWNER FINAL REVIEW

---

## 1. EXECUTIVE SUMMARY & VERDICT

An exhaustive mathematical, precision, and source-code audit was conducted across the implementation of Task 3.2 (Core Metrics Engine) in accordance with the Task 3.1 Architecture Specification and the Product Owner's conditional approval directives.

### Final Verdict: **APPROVED**

Task 3.2 successfully implements all approved mathematical models for realized performance evaluation. The engine operates strictly as a pure calculation kernel with zero floating-point drift, full single-currency isolation, strict prevention of division by zero and `Infinity`, verified mathematical reconciliation between both expectancy formulations, and enforced boundary validation on planned risk.

| Category | Specification | Audit Result | Status |
| :--- | :--- | :--- | :---: |
| **Eligibility Intake** | Only valid CLOSED trades with valid `exitDate` & finite `netPnl` | Verified: `filterEligibleClosedTrades()` filters OPEN, CANCELLED, and corrupted trades | **PASS** |
| **Total Net P/L** | Exact minor unit aggregation via `BigInt` | Verified: $0.1 + 0.2 - 0.3 = 0.0$ exact; zero IEEE-754 float drift across USD, IDR, BHD | **PASS** |
| **Dual Win Rates** | $WinRate_{all}$ vs. $WinRate_{decisive}$; breakeven handling | Verified: $WinRate_{decisive}$ returns `null` with `ALL_BREAKEVEN` when $N_W + N_L = 0$ | **PASS** |
| **Average Win / Loss** | Positive loss magnitude $\|AvgLoss\|$ in major units | Verified: Magnitude is strictly positive nominal value; `winLossRatio` protected | **PASS** |
| **Profit Factor** | Ratio of Gross Profit to Gross Loss; no `Infinity` | Verified: Zero losses returns `null` with `ZERO_LOSSES`; zero profit returns `0.0` | **PASS** |
| **Expectancy** | Method 1 == Method 2 mathematical reconciliation | Verified: Reconciled within 1 minor unit tolerance; Breakeven preserved in $N$ | **PASS** |
| **R-Multiple** | Cohort $N_R$ restricted to `plannedRiskAmount > 0` | Verified: `plannedRiskAmount < 0` rejected at service; $\le 0$ excluded from $N_R$ | **PASS** |
| **Sample Quality** | PO Educational Policy thresholds ($N=0, <15, 15\text{--}29, \ge 30$) | Verified: Status tags and explicit educational disclaimers populated accurately | **PASS** |
| **Architecture Scope** | No UI, API, charts, consent, or mentor access | Verified: Pure calculation kernel only (`core-metrics.ts`, `analytics-types.ts`) | **PASS** |

---

## 2. FILES AND FUNCTIONS INSPECTED

| File | Scope & Responsibility | Inspected Functions |
| :--- | :--- | :--- |
| [`lib/analytics/analytics-types.ts`](file:///d:/Developer/Web%20Casper%20Signal/lib/analytics/analytics-types.ts) | Domain types, metric envelopes, calculation status contracts | Entire file (contracts for `WinRateResult`, `AvgWinLossResult`, `ProfitFactorResult`, `ExpectancyResult`, `RMultipleResult`, `CoreMetricsSummary`, `AnalyticsSampleStatus`, `CalculationStatus`) |
| [`lib/analytics/core-metrics.ts`](file:///d:/Developer/Web%20Casper%20Signal/lib/analytics/core-metrics.ts) | Pure calculation kernel functions | `filterEligibleClosedTrades()`<br>`evaluateSampleStatus()`<br>`calculateTotalNetPnl()`<br>`calculateWinRates()`<br>`calculateAverageWinLoss()`<br>`calculateProfitFactor()`<br>`calculateExpectancy()`<br>`calculateRMultipleMetrics()`<br>`buildCoreMetricsSummary()` |
| [`lib/journal-service.ts`](file:///d:/Developer/Web%20Casper%20Signal/lib/journal-service.ts) | Underlying financial precision engine & trade validation | `toMinorUnits()`, `toMajorUnits()`, `roundToDecimals()`, `calculateExactNetPnl()`, `createTrade()`, `updateTrade()` |
| [`tests/analytics-core-metrics.test.mjs`](file:///d:/Developer/Web%20Casper%20Signal/tests/analytics-core-metrics.test.mjs) | Unit test suite for Core Metrics Engine | 13 test cases covering all edge cases, zero denominators, multi-decimal precision, and dual formula reconciliation |
| [`tests/journal-service.test.mjs`](file:///d:/Developer/Web%20Casper%20Signal/tests/journal-service.test.mjs) | Core service test suite | 55 test cases covering boundary values, negative planned risk rejection, and financial precision |

---

## 3. FORMULA-BY-FORMULA AUDIT

### 3.1 Eligibility & Intake Filter (`filterEligibleClosedTrades`)
- **Formula / Rule**:
  $$\text{Eligible} = \{ t \in \text{Trades} \mid t.\text{status} = \text{CLOSED} \land t.\text{exitDate} \in \text{ISO8601} \land t.\text{netPnl} \in \mathbb{R} \land \text{isFinite}(t.\text{netPnl}) \}$$
- **Inspection**:
  - `status === "CLOSED"`: Strictly enforced. All `OPEN` and `CANCELLED` trades are stripped before any metric derivation.
  - `exitDate`: Validated via `typeof t.exitDate === "string"` and `!isNaN(new Date(t.exitDate).getTime())`.
  - `netPnl`: Validated via `typeof t.netPnl === "number"`, `Number.isFinite(t.netPnl)`, and `!isNaN(t.netPnl)`.
- **Verdict**: **PASS**.

---

### 3.2 Total Net Realized P/L (`calculateTotalNetPnl`)
- **Formula**:
  $$\text{TotalNetPnl} = \text{toMajorUnits}\left( \sum_{i=1}^{N} \text{toMinorUnits}(\text{NetPnl}_i, \text{decimals}), \text{decimals} \right)$$
- **Inspection**:
  - Summation is performed in minor units as `BigInt`. No intermediate floating-point addition occurs.
  - Converted back to major units at the conclusion of the summation via `toMajorUnits(totalMinor, decimals)`.
  - Verified against floating-point drift: `0.1 + 0.2 - 0.3` produces exactly `0.0`, whereas IEEE-754 floating-point arithmetic produces `5.551115123125783e-17`.
- **Verdict**: **PASS**.

---

### 3.3 Win Rates (`calculateWinRates`)
- **Formulas**:
  $$\text{WinRate}_{\text{all}} = \frac{N_W}{N_{\text{total}}} \times 100\%$$
  $$\text{WinRate}_{\text{decisive}} = \frac{N_W}{N_W + N_L} \times 100\%$$
  $$\text{BreakevenRate} = \frac{N_{BE}}{N_{\text{total}}} \times 100\%$$
- **Inspection**:
  - If $N_{\text{total}} = 0$: Returns `winRateAll: null`, `winRateDecisive: null`, `calculationStatus: "NO_DATA"`.
  - If $N_W + N_L = 0$ ($N_{\text{total}} = N_{BE} > 0$):
    - Denominator for decisive rate is 0.
    - Code correctly intercepts: `if (decisiveTotal === 0) { winRateDecisive = null; calculationStatus = "ALL_BREAKEVEN"; }`.
    - No division by zero or `NaN` escapes.
  - All rates are rounded to 2 decimal places using symmetric half-up rounding.
- **Verdict**: **PASS**.

---

### 3.4 Average Win & Average Loss Magnitude (`calculateAverageWinLoss`)
- **Formulas**:
  $$\text{AvgWin} = \text{toMajorUnits}\left( \left\lfloor \frac{\sum_{w \in W} \text{toMinorUnits}(\text{NetPnl}_w)}{N_W} \right\rfloor \right)$$
  $$\text{AvgLossMagnitude} = \text{toMajorUnits}\left( \left\lfloor \frac{\sum_{l \in L} \text{toMinorUnits}(|\text{NetPnl}_l|)}{N_L} \right\rfloor \right)$$
  $$\text{WinLossRatio} = \frac{\text{AvgWin}}{\text{AvgLossMagnitude}}$$
- **Inspection**:
  - `avgLossMag` is strictly positive in nominal value.
  - `signedAvgLoss` is explicitly negative (`-avgLossMag`), maintaining semantic clarity.
  - `winLossRatio` is guarded against division by zero: calculated only if `avgLossMag !== null && avgLossMag > 0`.
  - Empty cohorts ($N_W = 0$ or $N_L = 0$) set the respective metric to `null` with explicit statuses (`ZERO_LOSSES`, `ZERO_PROFIT`, or `ALL_BREAKEVEN`).
- **Verdict**: **PASS**.

---

### 3.5 Profit Factor (`calculateProfitFactor`)
- **Formula**:
  $$\text{Gross Profit} = \sum_{t \in W} \text{NetPnl}_t, \quad \text{Gross Loss} = \sum_{t \in L} |\text{NetPnl}_t|$$
  $$\text{PF} = \frac{\text{Gross Profit}}{\text{Gross Loss}}$$
- **Inspection**:
  - Zero Gross Loss with Gross Profit > 0: Returns `profitFactor: null`, `calculationStatus: "ZERO_LOSSES"`. **Never returns `Infinity`**.
  - Zero Gross Profit with Gross Loss > 0: Returns `profitFactor: 0.0`, `calculationStatus: "ZERO_PROFIT"`.
  - Zero Gross Profit and Zero Gross Loss: Returns `profitFactor: null`, `calculationStatus: "ALL_BREAKEVEN"`.
  - Standard calculation: `Number(grossProfitMinor) / Number(grossLossMinor)` rounded to 2 decimals.
- **Verdict**: **PASS**.

---

### 3.6 Expectancy & Dual-Method Reconciliation (`calculateExpectancy`)
- **Formulas**:
  $$\text{Method 1 (Aggregate Mean)}: \quad E_1 = \frac{\text{TotalNetPnl}}{N}$$
  $$\text{Method 2 (Component Model)}: \quad E_2 = (P_w \times \text{AvgWin}) - (P_l \times \text{AvgLossMagnitude})$$
- **Mathematical Equivalence & Breakeven Handling**:
  - Total closed trades $N = N_W + N_L + N_{BE}$.
  - $P_w = \frac{N_W}{N}$, $P_l = \frac{N_L}{N}$.
  - By substituting the component definitions:
    $$E_2 = \left(\frac{N_W}{N} \times \frac{\sum W}{N_W}\right) - \left(\frac{N_L}{N} \times \frac{\sum L_{\text{abs}}}{N_L}\right) = \frac{\sum W - \sum L_{\text{abs}}}{N} = \frac{\text{TotalNetPnl}}{N} = E_1$$
  - Breakeven trades ($N_{BE}$) contribute $0$ to the numerator but correctly dilute both $P_w$ and $P_l$, preserving exact mathematical equivalence with Method 1.
  - Verification tolerance: `diff <= Math.pow(10, -decimals) || diff < 1e-4`.
  - Result reports `isFormulasReconciled: true`.
- **Verdict**: **PASS**.

---

### 3.7 R-Multiple Analytics (`calculateRMultipleMetrics`)
- **Rules**:
  - $N_R$ comprises only trades where `plannedRiskAmount > 0`.
  - Missing, null, 0, or negative planned risk trades are counted in `excludedTradesCount` and excluded from all R denominators.
  - If $N_R = 0$: Returns `totalR: null`, `averageR: null`, `calculationStatus: "NO_RISK_DATA"`.
  - Median derivation: Sorts $R$ values ascending; if $N_R$ is even, computes the arithmetic mean of the two middle elements.
  - Expectancy R: $(P_{wR} \times \text{AvgWinR}) - (P_{lR} \times \text{AvgLossMagnitudeR})$.
- **Inspection**:
  - Evaluated on test trade set: $[+2.0, -1.0, -2.0, +2.4]$.
  - $\sum R = 1.4$, Average $R = 0.35$, Median $R = 0.50$, Excluded = 3. Exactly matches specification.
- **Verdict**: **PASS**.

---

## 4. CURRENCY & PRECISION AUDIT

### 4.1 Single-Currency Cohort Isolation
- The `CoreMetricsSummary` contract requires explicit `currency` (ISO 4217 string) and `currencyDecimals` (integer) passed from the validated parent `TradingAccount`.
- No cross-currency aggregation occurs. Trades are partitioned by `accountId` in storage, and parent accounts strictly forbid currency modification once trades or cash transactions exist.

### 4.2 Numerical Range & BigInt Safety Limits
- `toMinorUnits` validates:
  $$|amount| \le \frac{2^{53} - 1}{10^{\text{decimals}}}$$
  - For USD/EUR (2 decimals): Safe up to \$90,071,992,547,409.91.
  - For IDR/JPY (0 decimals): Safe up to Rp 9,007,199,254,740,991.
  - For BHD/KWD (3 decimals): Safe up to 9,007,199,254,740.991 BHD.
- Values exceeding safe limits or non-finite inputs (`NaN`, `Infinity`) throw `JournalValidationError` (HTTP 422).
- `toMajorUnits` checks `absMinor <= MAX_SAFE_INTEGER_BIGINT` before converting back to Number.
- String-based decomposition in `toMajorUnits` (`intPart.toString() + "." + fracPart`) guarantees zero floating-point division error.

---

## 5. SERVICE INTEGRATION & DEFECT RESOLUTION

During the audit, a potential issue flagged in the PO review regarding `plannedRiskAmount` sanitization was audited in `lib/journal-service.ts`:

### Issue Found & Corrected:
- **Prior Code**: Used `Math.abs(input.plannedRiskAmount)` during `createTrade` and `updateTrade`.
- **Finding**: Silently converted negative risk values into positive values.
- **Resolution Applied**:
  - `Math.abs` was completely removed.
  - Input validation now enforces:
    ```typescript
    if (input.plannedRiskAmount !== undefined && input.plannedRiskAmount !== null) {
      if (
        typeof input.plannedRiskAmount !== "number" ||
        !Number.isFinite(input.plannedRiskAmount) ||
        input.plannedRiskAmount < 0
      ) {
        throw new JournalValidationError("plannedRiskAmount cannot be negative.");
      }
    }
    ```
  - `plannedRiskAmount < 0`: Throws `JournalValidationError` (HTTP 422).
  - `plannedRiskAmount === 0`: Allowed in service, but excluded from R-Multiple cohort ($N_R$).
  - `plannedRiskAmount` missing/null: Allowed in service, excluded from R-Multiple cohort.

---

## 6. REGRESSION AND BUILD VERIFICATION

All tests were executed natively using Node.js test runner (`node --test`), TypeScript compiler, ESLint, and Next.js production build:

| Test Target / Command | File Inspected | Test Cases | Result |
| :--- | :--- | :---: | :---: |
| `node --test tests/analytics-core-metrics.test.mjs` | `tests/analytics-core-metrics.test.mjs` | 13 | **13 Passed**, 0 Failed |
| `node --test tests/journal-service.test.mjs` | `tests/journal-service.test.mjs` | 55 | **55 Passed**, 0 Failed |
| `node --test tests/journal-storage.test.mjs` | `tests/journal-storage.test.mjs` | 24 | **24 Passed**, 0 Failed |
| `node --test tests/academy.test.mjs` | `tests/academy.test.mjs` | 26 | **26 Passed**, 0 Failed |
| `node --test tests/rate-limit.test.mjs` | `tests/rate-limit.test.mjs` | 12 | **12 Passed**, 0 Failed |
| `node --test tests/db.test.mjs` | `tests/db.test.mjs` | 8 | **8 Passed**, 0 Failed |
| `npx tsc --noEmit` | Entire project codebase | N/A | **0 Errors** |
| `npm run lint` | ESLint suite | N/A | **0 Errors**, 15 warnings (unused UI variables) |
| `npm run build` | Next.js 15.5.28 standalone build | 34 routes | **Compiled Successfully** |

**Total Unit Test Cases: 138/138 Passed (100% Pass Rate).**

---

## 7. GIT AND DEPLOYMENT STATE

- **Current Commit**: `d275bd4` (*fix(journal): reject negative plannedRiskAmount and eliminate Math.abs sanitization per PO audit condition*)
- **Branch**: `main` (synchronized with `origin/main`)
- **Working Tree**: Completely clean (`nothing to commit, working tree clean`)
- **Hostinger VPS**: Production server is untouched by this audit; all tests were executed strictly in the local environment.

---

## 8. RECOMMENDATION FOR PRODUCT OWNER

Task 3.2 (Core Metrics Engine) is verified and adheres strictly to the quantitative, architectural, and financial specifications. All boundary conditions, zero-denominator protections, and BigInt precision rules are mathematically verified.

We recommend **FINAL APPROVAL** of Task 3.2, clearing the roadmap for **Task 3.3 — Drawdown & Time-Series Engine** (Trade Performance Drawdown, Peak-to-Trough tracking, High-Water Mark time-series).

*In accordance with protocol, execution is halted here awaiting Product Owner formal instruction.*

