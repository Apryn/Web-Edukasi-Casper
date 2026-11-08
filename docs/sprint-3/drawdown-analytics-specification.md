# SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 3.3
## DRAWDOWN ANALYTICS SPECIFICATION & MATHEMATICAL FORMULATION
### Final Pre-Implementation Gate Specification (Revision 2.0.0)

**Document Version:** 2.0.0  
**Status:** ARCHITECTURAL SPECIFICATION — FINALIZED FOR PO APPROVAL  
**Author:** Senior Software Architect & Quantitative Analytics Engineer  
**Scope:** Trade Performance Drawdown, High-Water Mark Tracking, Peak-to-Trough Identification, Epoch Analytics, and Capital Denominator Governance  

---

## 1. Domain Scope & Foundational Principles

This specification establishes the quantitative model and algorithmic contracts for **Trade Performance Drawdown** in the Signal Casper Academy Performance Analytics Engine (PAE).

### 1.1 Strict Isolation: Trade Performance Curve vs. Account Balance Curve
A fundamental principle of quantitative portfolio analysis is the rigorous decoupling of trading strategy performance from cash flow management:

1. **Performance Curve (Trade Performance Drawdown — IN SCOPE):**
   - Operates **exclusively** on the realized Net P/L of settled, eligible `CLOSED` trades.
   - Tracks the strategy's cumulative edge and execution risk over discrete trade outcomes.
   - **Cash transactions (`DEPOSIT`, `WITHDRAWAL`) are strictly isolated:**
     - A deposit is **never** counted as a trading win or profit.
     - A withdrawal is **never** counted as a trading loss or drawdown.
     - Cash flows **never** alter cumulative realized trading P/L ($C_t$), win counts, loss counts, or breakeven counts.
2. **Account Balance Curve (Account Equity Drawdown — FORMALLY DEFERRED):**
   - Reflects total account liquidity:
     $$\text{AccountBalance}_t = \text{initialBalance} + \sum \text{Deposits} - \sum \text{Withdrawals} + \sum \text{RealizedNetPnl}$$
   - As established in Task 3.1 and Task 3.2, measuring true account equity drawdown without continuous floating mark-to-market snapshots requires a continuous Unitized Net Asset Value (NAV) engine.
   - Because tick-by-tick open equity is not recorded in discrete journal storage, **Account Equity Drawdown is formally excluded from Task 3.3**.
   - The engine **never silently substitutes Account Equity Drawdown for Trade Performance Drawdown**. Every metric payload explicitly defines its scope as `TRADE_PERFORMANCE_REALIZED`.

---

## 2. Starting Capital Contract & MDD Percentage Governance

### 2.1 Starting Capital Source of Truth
Based on the actual SSOT schema in `lib/journal-types.ts` (`TradingAccount`), baseline starting capital is explicitly defined as:
```typescript
export interface TradingAccount {
  initialBalance: number; // Baseline starting capital established at account creation
  realizedBalance: number; // Derived running balance (SSOT ledger)
  accountCurrency: string; // ISO 4217 code
  currencyDecimals: number; // Decimal precision (USD=2, IDR=0, etc.)
  // ...
}
```

#### Strict Contractual Rules for Base Capital:
1. **No Conflation with First Deposit:**
   The first cash transaction of type `DEPOSIT` must **never** be assumed to be starting capital. An account's baseline capital is defined solely by `TradingAccount.initialBalance`.
2. **No Conflation with Current Balance:**
   `realizedBalance` (current running balance) must **never** be used as a historical denominator. Doing so creates path-dependency distortions where past drawdowns artificially shrink or inflate based on recent performance.
3. **Optional Parameter in Pure Function:**
   The pure calculation function accepts starting capital as an explicit optional argument:
   ```typescript
   calculateDrawdownMetrics(
     trades: TradeRecord[],
     decimals: number,
     startingCapital?: number | null
   ): DrawdownSummaryResult
   ```
4. **Behavior when Starting Capital is Missing, Zero, or Negative:**
   - If `startingCapital` is not provided, is `null`, is $\le 0$, or is non-finite:
     - **Nominal Maximum Drawdown (`maxDrawdownNominal`) is calculated completely and accurately** in major currency units.
     - **Percentage Maximum Drawdown (`maxDrawdownPercentage`) is strictly set to `null`**.
     - `calculationStatus` is set to `"UNAVAILABLE_BASE_CAPITAL"`.
     - Individual curve points set `drawdownPercentage: null`.
   - The engine **never fabricates an arbitrary starting capital base** (such as $\$10,000$).

### 2.2 Mathematical Formula for Drawdown Percentage & Capital Equity

When evaluating drawdown percentage and capital status, the engine tracks equity states at both the peak and the trough:

1. **Equity at Peak ($\text{EquityPeak}_t$):**
   $$\text{EquityPeak}_t = \text{initialBalance} + \text{peakCumulativePnl}_t$$
2. **Equity at Trough ($\text{EquityTrough}_t$):**
   $$\text{EquityTrough}_t = \text{initialBalance} + \text{troughCumulativePnl}_t$$
3. **Drawdown Nominal Amount ($\text{DrawdownAmount}_t$):**
   $$\text{DrawdownAmount}_t = \text{peakCumulativePnl}_t - \text{troughCumulativePnl}_t \quad (\text{strictly } \ge 0)$$
4. **Drawdown Percentage ($\text{DrawdownPercentage}_t$):**
   If $\text{EquityPeak}_t > 0$:
   $$\text{DrawdownPercentage}_t = \text{roundToDecimals}\left(\frac{\text{DrawdownAmount}_t}{\text{EquityPeak}_t} \times 100, 2\right)$$
   If $\text{EquityPeak}_t \le 0$:
   $$\text{DrawdownPercentage}_t = \text{null} \quad (\text{non-positive denominator})$$

> [!IMPORTANT]
> **NO CLIPPING RULE (No 100% Artificial Ceiling):**
> The engine **never clips, caps, or limits DrawdownPercentage to 100.0%**. If a trader starts with $\$10,000$, peaks at $\$10,000$, and incurs a cumulative loss down to $-\$2,000$, the nominal drawdown is $\$12,000$, yielding a mathematical drawdown percentage of **$120.0\%$**. Capping this metric at $100\%$ would conceal the critical risk fact that losses have exceeded total initial capital.

### 2.3 Capital Status Governance & Behavior Matrix

The engine maintains a strict decoupling between the mathematical percentage value and the capital solvency state:

1. **`UNAVAILABLE_BASE_CAPITAL`:**
   - Condition: `initialBalance` is omitted, `null`, `undefined`, non-finite, or $\le 0$.
   - Nominal metrics: `maxDrawdownNominal` and `currentDrawdownNominal` are calculated completely and accurately.
   - Percentage metrics: `maxDrawdownPercentage = null`, `drawdownPercentage = null` on all curve points.
   - Status: `"UNAVAILABLE_BASE_CAPITAL"`.
2. **`CAPITAL_DEPLETED`:**
   - Condition: `initialBalance` is valid and $> 0$, but the equity at the trough reaches or falls below zero ($\text{EquityTrough}_t \le 0$).
   - Nominal metrics: calculated normally.
   - Percentage metrics: If $\text{EquityPeak}_t > 0$, **percentage is calculated normally without any clipping** (e.g., $120.0\%$). If $\text{EquityPeak}_t \le 0$, percentage is `null`.
   - Status: `"CAPITAL_DEPLETED"`. This status serves as a diagnostic indicator of capital wipeout / account deficit, not as a pretext to distort or cap the mathematical formula.
3. **`AVAILABLE`:**
   - Condition: `initialBalance` is valid and $> 0$, and equity remains strictly positive throughout ($\text{EquityTrough}_t > 0$).
   - Percentage metrics: calculated normally without clipping.
   - Status: `"AVAILABLE"` (or `"ZERO_LOSSES"` if $MDD = 0$).

---

## 3. Deterministic Sequence Ordering & Intake Filtering

### 3.1 Eligibility Gate
A trade record $T$ enters the drawdown series if and only if:
1. `status === "CLOSED"`.
2. `exitDate` is a valid ISO-8601 calendar date (`isValidIsoDate(t.exitDate) === true`).
3. `netPnl` is a finite number (`Number.isFinite(t.netPnl)`).
4. `currency` matches the evaluated cohort currency.

### 3.2 Deterministic Total Ordering (Primary & Tie-Breaker)
Drawdown is inherently path-dependent. To eliminate non-deterministic ordering between browsers, servers, and Node.js versions:
1. **Primary Sort:** `exitDate` ascending (chronological execution order).
2. **Secondary Sort (Tie-Breaker):** `id` ascending (UUID alphanumeric sort `a.id.localeCompare(b.id)`).

$$\forall (T_i, T_j), \quad T_i \prec T_j \iff (\text{exitDate}_i < \text{exitDate}_j) \lor (\text{exitDate}_i = \text{exitDate}_j \land \text{id}_i < \text{id}_j)$$

---

## 4. Mathematical Model of Trade Performance Drawdown

Let the sorted sequence of $N$ eligible trades be $T_1, T_2, \dots, T_N$.

### 4.1 Cumulative Realized Curve ($C_t$)
All monetary values accumulate in pure integer minor units (`BigInt`):
$$C_0 = 0\text{n}$$
$$C_t = C_{t-1} + \text{toMinorUnits}(T_t.\text{netPnl}, \text{decimals}) \quad \text{for } t = 1, \dots, N$$

### 4.2 High-Water Mark / Peak Series ($Peak_t$)
The initial peak is **strictly anchored at zero**:
$$Peak_0 = 0\text{n}$$
$$Peak_t = \max(Peak_{t-1}, C_t) \quad \text{for } t = 1, \dots, N$$

*Rationale:* If trade 1 is a loss of $-\$150$, $C_1 = -\$150$, $Peak_1 = \max(0, -150) = 0$. Nominal drawdown is $0 - (-150) = \$150$. The trader is in an immediate drawdown from baseline zero.

### 4.3 Drawdown at Step $t$ ($DD_t$)
$$DD_t = Peak_t - C_t \quad (\text{strictly } DD_t \ge 0\text{n})$$

### 4.4 Maximum Drawdown (MDD)
$$MDD = \max_{t \in \{0, 1, \dots, N\}} (DD_t)$$
If all trades are profitable or breakeven, $MDD = 0\text{n}$ with status `"ZERO_LOSSES"`.

---

## 5. Drawdown Epochs & Lifecycle Tracking

A drawdown lifecycle progresses through three distinct states:
$$\text{PEAK} \longrightarrow \text{TROUGH} \longrightarrow \text{RECOVERY}$$

### 5.1 Epoch Rules
1. **Epoch Peak ($t_{\text{peak}}$):** The trade step establishing the active high-water mark:
   $$t_{\text{peak}} = \max \{ i \le t \mid C_i = Peak_t \}$$
   For an initial loss from baseline zero, $t_{\text{peak}} = 0$ (`tradeId: "ORIGIN"`, `date = entryDate` of Trade 1).
2. **Epoch Trough ($t_{\text{trough}}$):** The trade step where cumulative curve reaches the minimum value within the epoch:
   $$t_{\text{trough}} = \arg\max_{i \in [t_{\text{peak}}, t]} (Peak_i - C_i)$$
   *Tie-Breaker for Equal Troughs:* The **earliest** trade step is designated as the trough.
3. **Epoch Recovery ($t_{\text{recovery}}$):** The first trade step strictly after $t_{\text{trough}}$ where the cumulative curve meets or exceeds the epoch peak:
   $$t_{\text{recovery}} = \min \{ i > t_{\text{trough}} \mid C_i \ge Peak_{t_{\text{peak}}} \}$$
4. **Unrecovered / Active Drawdown at Dataset End:**
   If at step $N$ no trade has achieved $C_t \ge Peak_{t_{\text{peak}}}$:
   - `isRecovered = false`
   - `recoveryDate = null`, `recoveryTradeId = null`, `recoveryDurationTrades = null`
   - `currentDrawdownNominal = safeMinorToMajor(Peak_N - C_N, decimals)`

---

## 6. Specific Edge Cases & Behaviors

| Edge Case Scenario | Mathematical Condition | Expected System Behavior |
| :--- | :--- | :--- |
| **First Trade Loss** | Trade 1 Net P/L $< 0$ | $C_1 < 0 \implies Peak_1 = 0 \implies DD_1 = \|C_1\|$. Active epoch begins at Origin ($Peak=0$). |
| **Consecutive Losses** | $T_1, T_2, T_3 < 0$ | Cumulative curve declines monotonically; single epoch with trough advancing to $T_3$. |
| **New Equity Peak** | $C_t > Peak_{t-1}$ | Prior epoch is marked `isRecovered = true`. $Peak_t = C_t$, $DD_t = 0$. Current drawdown resets to $0$. |
| **Breakeven Trade** | Net P/L $= 0$ in drawdown | $C_t = C_{t-1}, Peak_t = Peak_{t-1}, DD_t = DD_{t-1}$. Epoch continues; duration increments by 1 trade. |
| **Multiple Equal Peaks** | $C_{10} = \$1000$, drops, returns to $C_{20} = \$1000$ | Trade 20 recovers Epoch 1 ($C_{20} \ge Peak_{10}$). If Trade 21 drops, Epoch 2 begins with peak at Trade 20. |
| **Multiple Equal MDDs** | Epoch 1 MDD $= \$500$, Epoch 2 MDD $= \$500$ | `maxDrawdownNominal = 500.0`. Primary `maxDrawdownEpoch` points to the **earliest** occurrence. |
| **Unrecovered at End** | $C_N < Peak_N$ | Active epoch marked `isRecovered = false`. `currentDrawdownNominal = Peak_N - C_N`. |
| **Zero Losses** | All trades $\ge 0$ | `maxDrawdownNominal = 0.0`, `currentDrawdownNominal = 0.0`, `epochs = []`, status `"ZERO_LOSSES"`. |
| **Empty Trades Array** | $N = 0$ | All fields `null`, status `"NO_DATA"`. |
| **Starting Capital Missing** | `startingCapital = null` or $\le 0$ | `maxDrawdownNominal` calculated normally; `maxDrawdownPercentage = null`, status `"UNAVAILABLE_BASE_CAPITAL"`. |
| **Capital Depletion ($\text{EquityTrough} \le 0$)** | $B_0 + C_{\text{trough}} \le 0$ | Status `"CAPITAL_DEPLETED"`. Drawdown percentage is calculated normally without clipping (e.g. $120.0\%$) if $\text{EquityPeak} > 0$. |

---

## 7. TypeScript Domain Contracts (`analytics-types.ts`)

```typescript
export type DrawdownCalculationStatus =
  | "AVAILABLE"
  | "VALID"
  | "NO_DATA"
  | "ZERO_LOSSES"
  | "UNAVAILABLE_BASE_CAPITAL"
  | "CAPITAL_DEPLETED"
  | "BLOCKED_MULTI_CURRENCY";

export interface DrawdownCurvePoint {
  tradeIndex: number; // 1-based index in deterministic sequence
  tradeId: string;
  exitDate: string; // ISO-8601
  tradeNetPnl: number; // Major currency units
  cumulativeNetPnl: number; // Major currency units
  highWaterMark: number; // Major currency units
  drawdownNominal: number; // Major currency units (>= 0)
  drawdownPercentage: number | null; // % (if starting capital provided and valid)
}

export interface DrawdownEpoch {
  epochId: string;
  peakIndex: number;
  peakTradeId: string;
  peakDate: string;
  peakCumulativePnl: number;

  troughIndex: number;
  troughTradeId: string;
  troughDate: string;
  troughCumulativePnl: number;

  drawdownNominal: number; // Strictly positive magnitude
  drawdownPercentage: number | null;

  recoveryIndex: number | null;
  recoveryTradeId: string | null;
  recoveryDate: string | null;

  isRecovered: boolean;
  troughDurationTrades: number;
  recoveryDurationTrades: number | null;
  totalDurationTrades: number | null;
  calendarDurationSeconds: number | null;
}

export interface DrawdownSummaryResult {
  currency: string;
  currencyDecimals: number;
  totalClosedTrades: number;

  // Maximum Drawdown Metrics
  maxDrawdownNominal: number | null;
  maxDrawdownPercentage: number | null; // null if starting capital missing/invalid

  // Current Active Drawdown Metrics
  currentDrawdownNominal: number | null;
  currentDrawdownPercentage: number | null;

  // Epoch References
  maxDrawdownEpoch: DrawdownEpoch | null;
  activeDrawdownEpoch: DrawdownEpoch | null;

  // Trajectory Curves
  curvePoints: DrawdownCurvePoint[];
  allEpochs: DrawdownEpoch[];

  calculationStatus: DrawdownCalculationStatus;
}
```

---

## 8. Worked Numerical Example (Independent Verification Trace)

### Scenario Parameters
- **Account Currency:** USD (decimals = 2)
- **Starting Capital ($B_0$):** $\$10,000.00$ ($1,000,000\text{n}$ cents)
- **Trade Sequence ($N=8$):**

| Step ($t$) | Trade ID | Exit Date (UTC) | Net P/L ($) | Cumulative Minor ($C_t$) | Cumulative Major ($) | Peak Minor ($Peak_t$) | Peak Major ($) | Drawdown Minor ($DD_t$) | Drawdown Major ($) | Drawdown % ($\%DD_t$) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **0** | `ORIGIN` | `2026-11-01T08:00:00Z` | — | 0n | 0.00 | 0n | 0.00 | 0n | 0.00 | 0.00% |
| **1** | `T-001` | `2026-11-01T10:00:00Z` | $+200.00$ | 20000n | 200.00 | 20000n | 200.00 | 0n | 0.00 | 0.00% |
| **2** | `T-002` | `2026-11-01T14:00:00Z` | $+300.00$ | 50000n | 500.00 | 50000n | 500.00 | 0n | 0.00 | 0.00% |
| **3** | `T-003` | `2026-11-02T09:00:00Z` | $-400.00$ | 10000n | 100.00 | 50000n | 500.00 | 40000n | 400.00 | 3.81% |
| **4** | `T-004` | `2026-11-02T16:00:00Z` | $-300.00$ | -20000n | -200.00 | 50000n | 500.00 | 70000n | **700.00** | **6.67%** |
| **5** | `T-005` | `2026-11-03T11:00:00Z` | $0.00$ | -20000n | -200.00 | 50000n | 500.00 | 70000n | 700.00 | 6.67% |
| **6** | `T-006` | `2026-11-03T15:00:00Z` | $+500.00$ | 30000n | 300.00 | 50000n | 500.00 | 20000n | 200.00 | 1.90% |
| **7** | `T-007` | `2026-11-04T10:00:00Z` | $+400.00$ | 70000n | 700.00 | 70000n | 700.00 | 0n | 0.00 | 0.00% |
| **8** | `T-008` | `2026-11-04T14:00:00Z` | $-150.00$ | 55000n | 550.00 | 70000n | 700.00 | 15000n | 150.00 | 1.40% |

### Independent Mathematical Verification:
1. **Epoch 1 (Trades 2 to 7):**
   - Peak established at Trade 2: $Peak = \$500.00$.
   - Trough reached at Trade 4: $C_4 = -\$200.00 \implies DD_4 = 500.00 - (-200.00) = \$700.00$.
   - Denominator at Trade 4:
     $$\text{CapitalPeak}_4 = B_0 + Peak_4 = \$10,000.00 + \$500.00 = \$10,500.00$$
   - Percentage Drawdown at Trough:
     $$\%DD_4 = \frac{700.00}{10,500.00} \times 100 = 6.66666...\% \xrightarrow{\text{round to 2 decimals}} 6.67\%$$
   - Trade 5 (`T-005`) is breakeven ($\$0.00$). Trough remains at Trade 4 due to the earliest-trade tie-breaker rule.
   - Recovery reached at Trade 7: $C_7 = \$700.00 \ge Peak = \$500.00$. `isRecovered = true`.
   - Durations: Trough Duration = $4 - 2 = 2$ trades; Recovery Duration = $7 - 4 = 3$ trades; Total Duration = $7 - 2 = 5$ trades.
2. **Epoch 2 (Trades 7 to 8):**
   - Peak established at Trade 7: $Peak = \$700.00$.
   - Trough at Trade 8: $C_8 = \$550.00 \implies DD_8 = \$150.00$.
   - Denominator: $\$10,000.00 + \$700.00 = \$10,700.00$.
   - Percentage: $\frac{150.00}{10,700.00} \times 100 = 1.40186...\% \to 1.40\%$.
   - Status: `isRecovered = false` (Active/Unrecovered at end of history).
3. **Global Metric Summary:**
   - `maxDrawdownNominal`: `$700.00`
   - `maxDrawdownPercentage`: `6.67%` (or `null` with `"UNAVAILABLE_BASE_CAPITAL"` if $B_0$ was omitted)
   - `currentDrawdownNominal`: `$150.00`
   - `currentDrawdownPercentage`: `1.40%`
   - `calculationStatus`: `"AVAILABLE"`

---

### 8.2 Capital Depletion Worked Example (Beyond 100% Loss — No Clipping)

This example verifies the mathematical behavior when catastrophic trading losses exceed initial baseline capital:

#### Scenario Parameters:
- **Starting Capital ($B_0$):** $\$10,000.00$ ($1,000,000\text{n}$ cents)
- **Trade History:**
  - Trade 1: $\$0.00$ (Breakeven, cumulative P/L $= \$0.00$, establishes initial peak)
  - Trade 2: $-\$12,000.00$ (Severe loss, cumulative P/L $= -\$12,000.00$)

#### Step-by-Step Mathematical Evaluation:
1. **Peak Evaluation ($t=1$):**
   - $\text{peakCumulativePnl} = \$0.00$
   - $\text{EquityPeak} = B_0 + \text{peakCumulativePnl} = \$10,000.00 + \$0.00 = \$10,000.00$
   - Since $\text{EquityPeak} > 0$, the denominator is strictly positive and valid.
2. **Trough Evaluation ($t=2$):**
   - $\text{troughCumulativePnl} = -\$12,000.00$
   - $\text{EquityTrough} = B_0 + \text{troughCumulativePnl} = \$10,000.00 - \$12,000.00 = -\$2,000.00$
   - Because $\text{EquityTrough} \le 0$, the capital is wiped out / in deficit.
3. **Drawdown Nominal Amount:**
   $$\text{DrawdownAmount} = \text{peakCumulativePnl} - \text{troughCumulativePnl} = \$0.00 - (-\$12,000.00) = \$12,000.00$$
4. **Drawdown Percentage (No Clipping):**
   $$\text{DrawdownPercentage} = \frac{\text{DrawdownAmount}}{\text{EquityPeak}} \times 100 = \frac{12,000.00}{10,000.00} \times 100 = 120.0\%$$
5. **Status Attribution:**
   - `calculationStatus`: `"CAPITAL_DEPLETED"`
   - `maxDrawdownNominal`: `$12,000.00`
   - `maxDrawdownPercentage`: `120.00%`

> [!NOTE]
> Had an artificial $100\%$ cap been applied, the report would misleadingly state that the drawdown was only $\$10,000.00$ or $100.0\%$, obscuring the critical $\$2,000.00$ negative equity balance (debt/wipeout). By retaining unclipped percentage calculation, the true severity of the loss ($120\%$) is preserved while `"CAPITAL_DEPLETED"` accurately signals the insolvency state.
