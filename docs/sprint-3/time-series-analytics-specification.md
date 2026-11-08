# SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 3.3
## TIME-SERIES ANALYTICS SPECIFICATION & PERIOD AGGREGATION ENGINE
### Final Pre-Implementation Gate Specification (Revision 2.0.0)

**Document Version:** 2.0.0  
**Status:** ARCHITECTURAL SPECIFICATION — FINALIZED FOR PO APPROVAL  
**Author:** Senior Software Architect & Quantitative Analytics Engineer  
**Scope:** Calendar Period Bucketing (Daily, Weekly, Monthly), Timezone Contracts, Sparse vs. Dense Series, and Periodic Performance Metrics  

---

## 1. Domain Scope & Fundamental Rules

The Time-Series Analytics Engine aggregates discrete trade history into structured temporal performance sequences across **Daily**, **Weekly**, and **Monthly** intervals.

### 1.1 Strict Isolation from Cash Transactions
In alignment with the Drawdown specification:
- **Cash transactions (`DEPOSIT`, `WITHDRAWAL`) are completely excluded from the time-series engine.**
- Period performance metrics reflect **strictly trading execution results** from eligible `CLOSED` trades.
- Deposits and withdrawals never alter period Net P/L, period win rates, or period expectancy.

### 1.2 Trade Volume Policy & Scope Exclusion
- **Current Schema Audit:** `TradeRecord` possesses `positionSize: number` (representing lot or contract volume of an individual trade).
- **Quantitative Rationale:** Position sizes across heterogeneous instruments (e.g. 1.0 standard lot of EUR/USD, 0.5 contracts of BTC/USD, and 5 contracts of US100) cannot be meaningfully summed into a single generic "volume" number without instrument-specific normalization.
- **Contract Decision:** In accordance with the Product Owner pre-implementation gate directive, **`totalVolume` is formally removed from Task 3.3 period metrics**. No synthetic or unvalidated fields will be added. Instrument-specific volume normalization is recorded as deferred scope for a future specialized Exposure & Lot Analytics milestone.

---

## 2. Timezone Governance & Validation

### 2.1 Strict IANA Timezone Validation
To guarantee 100% environment-independent results across developer machines, CI/CD runners, and production cloud servers:
1. **Explicit Timezone Parameter:**
   ```typescript
   export interface TimeSeriesOptions {
     granularity: TimeSeriesGranularity; // "DAILY" | "WEEKLY" | "MONTHLY"
     timeZone?: string; // Default: "UTC"
     includeEmptyPeriods?: boolean; // Default: false (sparse series)
     denseRange?: {
       startDate: string; // ISO-8601 (required if includeEmptyPeriods is true)
       endDate: string; // ISO-8601 (required if includeEmptyPeriods is true)
     };
   }
   ```
2. **IANA Validation Gate:**
   The `timeZone` parameter must be validated against the standard IANA timezone registry using `Intl.DateTimeFormat`:
   ```typescript
   export function isValidIanaTimeZone(tz: string): boolean {
     try {
       Intl.DateTimeFormat(undefined, { timeZone: tz });
       return true;
     } catch {
       return false;
     }
   }
   ```
   If an invalid timezone identifier is supplied (e.g. `"Invalid/Zone"` or `"GMT+7"` without standard IANA syntax), the engine rejects the request with status `"INVALID_TIMEZONE"`.
3. **Explicit Default to UTC:**
   If `timeZone` is omitted, `undefined`, or empty, the engine defaults strictly to `"UTC"`.
4. **Zero Reliance on Server Local Time:**
   Calls to `new Date().getDate()`, `getHours()`, `getDay()`, or `getTimezoneOffset()` are strictly prohibited. Date parts are extracted exclusively via `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()` for UTC, or `Intl.DateTimeFormat` with target `timeZone`.

---

## 3. Period Bucketing Formulas & Calendar Standards

### 3.1 Daily Bucketing (`DAILY`)
- **Period Key Format:** `YYYY-MM-DD` (e.g. `2026-11-02`).
- **Boundaries:** Starts at `00:00:00.000` and ends at `23:59:59.999` in the target timezone.

### 3.2 Weekly Bucketing (`WEEKLY` — ISO-8601 Standard)
- **Standard:** ISO-8601 Week Date.
- **Period Key Format:** `YYYY-Www` (e.g. `2026-W45`).
- **Boundaries:** Weeks begin strictly on **Monday 00:00:00.000** and conclude on **Sunday 23:59:59.999**.
- **Year-Turn & Week 1 Rules:**
  - Week 01 of any year is defined as the week containing the first Thursday of that year (equivalent to the week containing January 4).
  - Days late in December may belong to Week 01 of the following year (e.g. Monday 2026-12-28 through Sunday 2027-01-03 is `2026-W53` or `2027-W01` based on the Thursday rule).
  - Days in early January may belong to Week 52/53 of the preceding year.
- **Metadata:** Each weekly bucket retains its calendar Monday date as `periodStartDate`.

### 3.3 Monthly Bucketing (`MONTHLY`)
- **Period Key Format:** `YYYY-MM` (e.g. `2026-11`).
- **Boundaries:** Starts on the 1st of the calendar month at `00:00:00.000` and concludes on the final day of the month at `23:59:59.999`. Leap year rules are respected for February (29 days in 2024, 28 days in 2026).

---

## 4. Periodic Metric Calculations & Aggregations

For a period bucket containing $m$ eligible trades ($T_1, T_2, \dots, T_m$):

### 4.1 Monetary Metrics (Pure BigInt Minor Units)
1. **Total Net Realized P/L:**
   $$\text{NetPnlMinor}_{\text{period}} = \sum_{j=1}^{m} \text{toMinorUnits}(T_j.\text{netPnl}, \text{decimals})$$
   $$\text{netPnl} = \text{safeMinorToMajor}(\text{NetPnlMinor}_{\text{period}}, \text{decimals})$$
2. **Gross Profit & Gross Loss:**
   $$\text{GrossProfitMinor}_{\text{period}} = \sum_{j \in \text{Wins}} \text{toMinorUnits}(T_j.\text{netPnl}, \text{decimals})$$
   $$\text{GrossLossMinor}_{\text{period}} = \sum_{j \in \text{Losses}} \text{toMinorUnits}(|T_j.\text{netPnl}|, \text{decimals})$$
   $$\text{grossProfit} = \text{safeMinorToMajor}(\text{GrossProfitMinor}, \text{decimals})$$
   $$\text{grossLoss} = \text{safeMinorToMajor}(\text{GrossLossMinor}, \text{decimals})$$

### 4.2 Trade Counts & Ratios
- **Total Closed Trades:** $m$
- **Winning Trades ($m_W$):** Count where $T_j.\text{netPnl} > 0$.
- **Losing Trades ($m_L$):** Count where $T_j.\text{netPnl} < 0$.
- **Breakeven Trades ($m_{BE}$):** Count where $T_j.\text{netPnl} = 0$.
- **Win Rate:**
  $$\text{winRate} = \begin{cases} \text{roundToDecimals}\left(\frac{m_W}{m} \times 100, 2\right) & \text{if } m > 0 \\ \text{null} & \text{if } m = 0 \end{cases}$$
- **Period Profit Factor:** Uses Task 3.2.1 BigInt scaled fixed-point ratio:
  $$\text{scaledQuotient} = \frac{\text{GrossProfitMinor} \times 10000 + (\text{GrossLossMinor} / 2)}{\text{GrossLossMinor}}$$
  - If $\text{GrossLossMinor} = 0$:
    - $\text{GrossProfitMinor} > 0 \implies \text{profitFactor} = \text{null}$ (status `"ZERO_LOSSES"`).
    - $\text{GrossProfitMinor} = 0 \implies \text{profitFactor} = \text{null}$ (status `"ALL_BREAKEVEN"`).
  - If $\text{GrossProfitMinor} = 0 \land \text{GrossLossMinor} > 0 \implies \text{profitFactor} = 0.0$.
  - Strictly finite, non-NaN, and never `Infinity`.
- **Period Expectancy:**
  $$E_{\text{period}} = \begin{cases} \text{roundToDecimals}\left(\frac{\text{Number}(\text{NetPnlMinor}_{\text{period}})}{m \times 10^{\text{decimals}}}, \text{decimals}\right) & \text{if } m > 0 \\ \text{null} & \text{if } m = 0 \end{cases}$$
  Reconciled via exact BigInt rational parity proof ($num_1 \cdot den_2 === num_2 \cdot den_1$).

---

## 5. Representation of Empty Periods (Sparse vs. Dense Series)

### The Anti-Fabrication Rule
**The engine strictly forbids fabricating synthetic trades or synthetic equity lines for periods without activity.**

### Two Explicit Output Modes:
1. **Sparse Series (Default — `includeEmptyPeriods: false`):**
   - Returns strictly the calendar periods where at least one closed trade occurred ($m \ge 1$).
   - Omitted calendar days/weeks/months are not included in the array.
2. **Dense Series (`includeEmptyPeriods: true`):**
   - **Requirement:** Must supply explicit `denseRange: { startDate, endDate }`. If omitted, the engine defaults to the range between the earliest and latest trade in the dataset.
   - For any calendar period within `[startDate, endDate]` where no trades closed ($m = 0$):
     ```typescript
     {
       periodKey: "2026-11-04",
       periodStartDate: "2026-11-04T00:00:00.000Z",
       periodEndDate: "2026-11-04T23:59:59.999Z",
       hasActivity: false,
       tradeCount: 0,
       winningTrades: 0,
       losingTrades: 0,
       breakevenTrades: 0,
       netPnl: 0,
       grossProfit: 0,
       grossLoss: 0,
       winRate: null,
       profitFactor: null,
       expectancy: null,
       cumulativeNetPnlAtEnd: 250.00 // Carried forward from previous active trade
     }
     ```
   - Notice: `netPnl` is `0`, but all analytical ratios (`winRate`, `profitFactor`, `expectancy`) are strictly `null` (not zero) and flagged with `hasActivity: false`.

---

## 6. TypeScript Data Contracts (`analytics-types.ts`)

```typescript
export type TimeSeriesGranularity = "DAILY" | "WEEKLY" | "MONTHLY";

export type TimeSeriesCalculationStatus =
  | "VALID"
  | "NO_DATA"
  | "INVALID_TIMEZONE"
  | "INVALID_DENSE_RANGE"
  | "BLOCKED_MULTI_CURRENCY";

export interface TimeSeriesPeriodBucket {
  periodKey: string; // "YYYY-MM-DD" | "YYYY-Www" | "YYYY-MM"
  periodStartDate: string; // ISO-8601 start boundary in target timezone
  periodEndDate: string; // ISO-8601 end boundary in target timezone
  hasActivity: boolean; // false if empty calendar fill

  // Activity Counts
  tradeCount: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;

  // Monetary Metrics (Major Currency Units)
  netPnl: number;
  grossProfit: number;
  grossLoss: number;

  // Period Analytical Ratios (null if hasActivity is false)
  winRate: number | null; // % (winning / total)
  profitFactor: number | null; // Scaled ratio
  expectancy: number | null; // Per trade major units

  // Trajectory Tracking
  cumulativeNetPnlAtEnd: number; // Cumulative P/L of account up to end of this period
}

export interface TimeSeriesSummaryResult {
  currency: string;
  currencyDecimals: number;
  timeZone: string; // Target IANA / UTC timezone used
  granularity: TimeSeriesGranularity;
  totalTradesRecorded: number;
  totalActivePeriods: number;

  // Aggregated Series
  periods: TimeSeriesPeriodBucket[];

  // Extremes & Period Records (null if no active periods)
  bestPeriod: TimeSeriesPeriodBucket | null; // Highest netPnl
  worstPeriod: TimeSeriesPeriodBucket | null; // Lowest netPnl
  mostActivePeriod: TimeSeriesPeriodBucket | null; // Highest tradeCount

  calculationStatus: TimeSeriesCalculationStatus;
}
```

---

## 7. Worked Numerical Example (Independent Verification Trace)

### Scenario Setup
- **Account Currency:** USD (decimals = 2)
- **Timezone:** `"UTC"`
- **Input Trades ($N=6$ across 2 calendar weeks):**

| ID | Exit Date (UTC) | Net P/L ($) | Cumulative P/L ($) | Day Key | Week Key (ISO) | Month Key |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `T1` | `2026-11-02T10:00:00Z` (Mon) | $+150.00$ | $+150.00$ | `2026-11-02` | `2026-W45` | `2026-11` |
| `T2` | `2026-11-02T14:30:00Z` (Mon) | $+200.00$ | $+350.00$ | `2026-11-02` | `2026-W45` | `2026-11` |
| `T3` | `2026-11-03T09:15:00Z` (Tue) | $-100.00$ | $+250.00$ | `2026-11-03` | `2026-W45` | `2026-11` |
| `T4` | `2026-11-03T16:00:00Z` (Tue) | $0.00$ | $+250.00$ | `2026-11-03` | `2026-W45` | `2026-11` |
| `T5` | `2026-11-09T11:00:00Z` (Mon) | $-300.00$ | $-50.00$ | `2026-11-09` | `2026-W46` | `2026-11` |
| `T6` | `2026-11-10T15:45:00Z` (Tue) | $+600.00$ | $+550.00$ | `2026-11-10` | `2026-W46` | `2026-11` |

---

### 7.1 Daily Aggregation Output (`DAILY`)

```json
[
  {
    "periodKey": "2026-11-02",
    "hasActivity": true,
    "tradeCount": 2,
    "winningTrades": 2,
    "losingTrades": 0,
    "breakevenTrades": 0,
    "netPnl": 350.00,
    "grossProfit": 350.00,
    "grossLoss": 0.00,
    "winRate": 100.0,
    "profitFactor": null,
    "expectancy": 175.00,
    "cumulativeNetPnlAtEnd": 350.00
  },
  {
    "periodKey": "2026-11-03",
    "hasActivity": true,
    "tradeCount": 2,
    "winningTrades": 0,
    "losingTrades": 1,
    "breakevenTrades": 1,
    "netPnl": -100.00,
    "grossProfit": 0.00,
    "grossLoss": 100.00,
    "winRate": 0.0,
    "profitFactor": 0.0,
    "expectancy": -50.00,
    "cumulativeNetPnlAtEnd": 250.00
  },
  {
    "periodKey": "2026-11-09",
    "hasActivity": true,
    "tradeCount": 1,
    "winningTrades": 0,
    "losingTrades": 1,
    "breakevenTrades": 0,
    "netPnl": -300.00,
    "grossProfit": 0.00,
    "grossLoss": 300.00,
    "winRate": 0.0,
    "profitFactor": 0.0,
    "expectancy": -300.00,
    "cumulativeNetPnlAtEnd": -50.00
  },
  {
    "periodKey": "2026-11-10",
    "hasActivity": true,
    "tradeCount": 1,
    "winningTrades": 1,
    "losingTrades": 0,
    "breakevenTrades": 0,
    "netPnl": 600.00,
    "grossProfit": 600.00,
    "grossLoss": 0.00,
    "winRate": 100.0,
    "profitFactor": null,
    "expectancy": 600.00,
    "cumulativeNetPnlAtEnd": 550.00
  }
]
```

### 7.2 Weekly Aggregation Output (`WEEKLY`)

1. **Week `2026-W45` (Trades T1–T4):**
   - Trades: 4 ($2\text{ wins}, 1\text{ loss}, 1\text{ breakeven}$)
   - Net Realized P/L: $150 + 200 - 100 + 0 = +\$250.00$
   - Gross Profit: $\$350.00$, Gross Loss: $\$100.00$
   - Win Rate: $2 / 4 \times 100 = 50.0\%$
   - Profit Factor: $350.00 / 100.00 = 3.50$
   - Expectancy: $250.00 / 4 = +\$62.50$ per trade
   - Cumulative P/L at end of week: $+\$250.00$
2. **Week `2026-W46` (Trades T5–T6):**
   - Trades: 2 ($1\text{ win}, 1\text{ loss}, 0\text{ breakeven}$)
   - Net Realized P/L: $-300 + 600 = +\$300.00$
   - Gross Profit: $\$600.00$, Gross Loss: $\$300.00$
   - Win Rate: $1 / 2 \times 100 = 50.0\%$
   - Profit Factor: $600.00 / 300.00 = 2.00$
   - Expectancy: $300.00 / 2 = +\$150.00$ per trade
   - Cumulative P/L at end of week: $\$250.00 + \$300.00 = +\$550.00$

### 7.3 Monthly Aggregation Output (`MONTHLY`)

1. **Month `2026-11` (All 6 Trades):**
   - Trades: 6 ($3\text{ wins}, 2\text{ losses}, 1\text{ breakeven}$)
   - Net Realized P/L: $+\$550.00$
   - Gross Profit: $\$950.00$, Gross Loss: $\$400.00$
   - Win Rate: $3 / 6 \times 100 = 50.0\%$
   - Profit Factor: $950.00 / 400.00 = 2.375 \xrightarrow{\text{round to 2 decimals}} 2.38$
   - Expectancy: $550.00 / 6 = 91.6666... \xrightarrow{\text{round to 2 decimals}} +\$91.67$ per trade
   - Best Period: `2026-W46` (Week), `2026-11-10` (Day)
