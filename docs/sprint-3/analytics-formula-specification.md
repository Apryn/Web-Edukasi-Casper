# SIGNAL CASPER ACADEMY — SPRINT 3: TASK 3.1
# PERFORMANCE ANALYTICS ENGINE — FORMULA SPECIFICATION & NUMERICAL VERIFICATION (REVISED)
**Author:** Quantitative Analytics Engineer, Financial Systems Auditor  
**Document ID:** DOC-S3-T3-FORM-002-REV2  
**Revision Date:** 2026-11-06  
**Status:** Architecture Revision Only — Awaiting Product Owner Approval  
**Context:** Sprint 3 — Student Trading Journal & Self-Evaluation Platform  
**Target Release:** v2.2.0  

---

## 1. MATHEMATICAL CONVENTIONS & ARITHMETIC KERNEL

1. **Integer Minor-Unit Domain ($\mathbb{Z}_{\text{minor}}$):**
   All internal monetary summations and multiplications are executed in integer minor units using JavaScript `BigInt`:
   $$\text{MinorValue} = \text{toMinorUnits}(\text{MajorValue}, \text{decimals})$$
   $$\text{MajorValue} = \text{toMajorUnits}(\text{MinorValue}, \text{decimals})$$
2. **Boundary Safeguards:**
   Any aggregate minor unit sum exceeding $\text{MAX\_SAFE\_INTEGER\_BIGINT}$ ($9,007,199,254,740,991$) throws `JournalValidationError` rather than silently degrading mantissa precision.
3. **Rounding Policy:**
   Percentages are rounded to two decimal places using symmetric half-up rounding:
   $$\text{RoundPct}(x) = \frac{\text{round}(x \times 100)}{100}$$

---

## 2. METRIC FORMULAS & SPECIFICATIONS

### 2.1 Total Net P/L
$$\text{TotalNetPnl}_{\text{minor}} = \sum_{i=1}^{N} \text{NetPnl}_{\text{minor}, i}$$
$$\text{TotalNetPnl} = \text{toMajorUnits}(\text{TotalNetPnl}_{\text{minor}}, \text{decimals})$$

- **Eligible Cohort:** Only trades with `status === "CLOSED"` and valid `exitDate`.
- **Exclusions:** `OPEN` trades, `CANCELLED` trades, and cash transactions (`DEPOSIT`, `WITHDRAWAL`) are completely excluded.
- **Empty Cohort ($N = 0$):** Returns `0` with status `NO_DATA`.

---

### 2.2 Win Rates (Comprehensive vs. Decisive)
Trade classification is determined by signed `netPnl`:
- Winning Trade ($W$): $\text{NetPnl} > 0$
- Losing Trade ($L$): $\text{NetPnl} < 0$
- Breakeven Trade ($BE$): $\text{NetPnl} = 0$

#### Comprehensive Win Rate ($\text{WinRate}_{\text{all}}$):
$$\text{WinRate}_{\text{all}} = \begin{cases} 
\text{null}, & \text{if } N = 0 \\
\left(\frac{N_w}{N}\right) \times 100, & \text{if } N > 0 
\end{cases}$$

#### Decisive Win Rate ($\text{WinRate}_{\text{decisive}}$):
$$\text{WinRate}_{\text{decisive}} = \begin{cases} 
\text{null}, & \text{if } (N_w + N_l) = 0 \\
\left(\frac{N_w}{N_w + N_l}\right) \times 100, & \text{if } (N_w + N_l) > 0 
\end{cases}$$

#### Breakeven Ratio ($\text{BreakevenRate}$):
$$\text{BreakevenRate} = \begin{cases} 
\text{null}, & \text{if } N = 0 \\
\left(\frac{N_{be}}{N}\right) \times 100, & \text{if } N > 0 
\end{cases}$$

---

### 2.3 Average Win & Average Loss Magnitude

#### Average Win ($\text{AvgWin}$):
$$\text{AvgWin} = \begin{cases} 
\text{null}, & \text{if } N_w = 0 \\
\text{toMajorUnits}\left(\left\lfloor\frac{\sum_{i \in W} \text{NetPnl}_{\text{minor}, i}}{N_w}\right\rceil, \text{decimals}\right), & \text{if } N_w > 0 
\end{cases}$$

#### Average Loss Magnitude ($\text{AvgLossMagnitude}$):
Always reported as a **positive nominal magnitude**:
$$\text{AvgLossMagnitude} = \begin{cases} 
\text{null}, & \text{if } N_l = 0 \\
\text{toMajorUnits}\left(\left\lfloor\frac{\sum_{j \in L} |\text{NetPnl}_{\text{minor}, j}|}{N_l}\right\rceil, \text{decimals}\right), & \text{if } N_l > 0 
\end{cases}$$

---

### 2.4 Profit Factor ($\text{PF}$)
$$\text{GrossProfit}_{\text{minor}} = \sum_{i \in W} \text{NetPnl}_{\text{minor}, i}$$
$$\text{GrossLoss}_{\text{minor}} = \sum_{j \in L} |\text{NetPnl}_{\text{minor}, j}|$$

$$\text{ProfitFactor} = \begin{cases} 
\text{null}, & \text{if } N = 0 \quad (\text{Status: } \texttt{NO\_DATA}) \\
\text{null}, & \text{if } \text{GrossLoss}_{\text{minor}} = 0 \text{ and } \text{GrossProfit}_{\text{minor}} > 0 \quad (\text{Status: } \texttt{ZERO\_LOSSES}) \\
0.00, & \text{if } \text{GrossProfit}_{\text{minor}} = 0 \text{ and } \text{GrossLoss}_{\text{minor}} > 0 \quad (\text{Status: } \texttt{ZERO\_PROFIT}) \\
\text{null}, & \text{if } \text{GrossProfit}_{\text{minor}} = 0 \text{ and } \text{GrossLoss}_{\text{minor}} = 0 \quad (\text{Status: } \texttt{ALL\_BREAKEVEN}) \\
\text{round}\left(\frac{\text{Number}(\text{GrossProfit}_{\text{minor}})}{\text{Number}(\text{GrossLoss}_{\text{minor}})}, 2\right), & \text{if } \text{GrossLoss}_{\text{minor}} > 0 
\end{cases}$$

*Universal Rule: The engine never outputs `Infinity` or `NaN`.*

---

### 2.5 Trade Expectancy (Dual Formulation Reconciled)

#### Formulation 1 (Direct Aggregate Mean):
$$\text{Expectancy}_1 = \frac{\text{TotalNetPnl}}{N}$$

#### Formulation 2 (Component Weighting):
$$\text{Expectancy}_2 = \left(\frac{N_w}{N} \times \text{AvgWin}\right) - \left(\frac{N_l}{N} \times \text{AvgLossMagnitude}\right)$$

#### Proof of Equivalence:
$$\begin{aligned}
\text{Expectancy}_2 &= \frac{N_w \cdot \text{AvgWin}}{N} - \frac{N_l \cdot \text{AvgLossMagnitude}}{N} \\
&= \frac{\sum_{i \in W} \text{NetPnl}_i}{N} - \frac{\sum_{j \in L} |\text{NetPnl}_j|}{N} \\
&= \frac{\sum_{i \in W} \text{NetPnl}_i + \sum_{j \in L} \text{NetPnl}_j}{N} \\
&= \frac{\sum_{m=1}^{N} \text{NetPnl}_m}{N} \quad (\text{Since } \sum \text{NetPnl}_{be} = 0) \\
&= \text{Expectancy}_1 \quad \blacksquare
\end{aligned}$$

---

### 2.6 R-Multiple Metrics
Individual trade R-Multiple:
$$R_i = \begin{cases} 
\text{null}, & \text{if } \text{plannedRiskAmount}_i \text{ is undefined or } \le 0 \\
\frac{\text{NetPnl}_i}{\text{plannedRiskAmount}_i}, & \text{if } \text{plannedRiskAmount}_i > 0 
\end{cases}$$

Let $K = \{i \mid R_i \ne \text{null}\}$ and $N_R = |K|$.
- **Total R:** $\text{TotalR} = \sum_{k \in K} R_k$
- **Average R:** $\text{AvgR} = \frac{\text{TotalR}}{N_R}$ (or `null` if $N_R = 0$)
- **Median R:** 50th percentile of sorted $R_k$ array.
- **Expectancy R:**
  $$\text{ExpectancyR} = \left(\frac{N_{w,R}}{N_R} \times \text{AvgWinR}\right) - \left(\frac{N_{l,R}}{N_R} \times \text{AvgLossMagnitudeR}\right)$$

---

## 3. TRADE PERFORMANCE DRAWDOWN: 5 CANONICAL CASES

### Case 1: All Winning Trades
Trades: $T_1 = +\$100, T_2 = +\$200, T_3 = +\$150$.
- $C = [0, 100, 300, 450]$
- $Peak = [0, 100, 300, 450]$
- $DD = [0, 0, 0, 0]$
- **MDD:** **\$0.00** (Peak: \$450, Trough: \$450, Drawdown: 0.00%).

### Case 2: Profit Followed by Loss
Trades: $T_1 = +\$500, T_2 = -\$200, T_3 = -\$150$.
- $C = [0, 500, 300, 150]$
- $Peak = [0, 500, 500, 500]$
- $DD = [0, 0, 200, 350]$
- **MDD:** **\$350.00** (Peak: \$500 at $T_1$, Trough: \$150 at $T_3$, Recovery: `UNRECOVERED`).

### Case 3: Consecutive Losses from Start
Trades: $T_1 = -\$100, T_2 = -\$150, T_3 = -\$250$.
- $C = [0, -100, -250, -500]$
- $Peak = [0, 0, 0, 0]$ *(Starting peak anchored at 0)*
- $DD = [0, 100, 250, 500]$
- **MDD:** **\$500.00** (Peak: \$0 at $t_0$, Trough: -\$500 at $T_3$, Recovery: `UNRECOVERED`).

### Case 4: Full Recovery Cycle
Trades: $T_1 = +\$300, T_2 = -\$400, T_3 = +\$200, T_4 = +\$300$.
- $C = [0, 300, -100, 100, 400]$
- $Peak = [0, 300, 300, 300, 400]$
- $DD = [0, 0, 400, 200, 0]$
- **MDD:** **\$400.00**
  - Peak: \$300 at $T_1$
  - Trough: -\$100 at $T_2$
  - Recovery Step: $T_4$ ($C_4 = 400 \ge Peak_2$). Status: `RECOVERED`.

### Case 5: Zero Eligible Trades ($N = 0$)
Trades: Empty array or only OPEN/CANCELLED trades.
- $C = [0], Peak = [0], DD = [0]$
- **MDD:** `null` (Status: `NO_DATA`).

---

## 4. ACCOUNT EQUITY DRAWDOWN: UNITIZED NAV MATHEMATICAL WALKTHROUGH

This section provides the rigorous quantitative proof of why Unitized NAV isolates trading performance from capital cash flows.

### 4.1 Chronological Scenario
- Initial Capital: \$10,000.00
- Initial NAV: \$100.00 per unit $\implies$ Initial Units $U_0 = 100.0000$ units.

#### Step 1: Initial State
- Equity = \$10,000.00
- Units = 100.0000
- $\text{NAV}_0 = \$100.00$
- Cumulative Peak NAV = \$100.00

#### Step 2: Trading Profit of +\$1,000.00
- New Equity = $\$10,000 + \$1,000 = \$11,000.00$
- Units outstanding remain constant: $U_1 = 100.0000$
- $\text{NAV}_1 = \frac{\$11,000.00}{100.0000} = \mathbf{\$110.00}$ (Return: $+10.00\%$)
- Cumulative Peak NAV = \$110.00
- Drawdown = 0.00%

#### Step 3: Deposit of +\$2,000.00
- Prevailing NAV before deposit = \$110.00
- New Units Issued = $\frac{\$2,000.00}{\$110.00} = \mathbf{18.1818 \text{ units}}$
- Total Units $U_2 = 100.0000 + 18.1818 = 118.1818$ units
- New Equity = $\$11,000.00 + \$2,000.00 = \$13,000.00$
- $\text{NAV}_2 = \frac{\$13,000.00}{118.1818} = \mathbf{\$110.00}$
- **Mathematical Proof:** NAV remains exactly \$110.00. The deposit created **0.00% return** and did **NOT** artificially inflate performance.

#### Step 4: Trading Loss of -\$1,500.00
- New Equity = $\$13,000.00 - \$1,500.00 = \$11,500.00$
- Units outstanding remain constant: $U_3 = 118.1818$
- $\text{NAV}_3 = \frac{\$11,500.00}{118.1818} = \mathbf{\$97.3077}$
- Peak NAV = \$110.00
- $\text{Drawdown}_3 = \frac{110.00 - 97.3077}{110.00} \times 100 = \mathbf{11.54\%}$

#### Step 5: Withdrawal of -\$1,000.00
- Prevailing NAV before withdrawal = \$97.3077
- Units Redeemed = $\frac{\$1,000.00}{\$97.3077} = \mathbf{10.2767 \text{ units}}$
- Total Units $U_4 = 118.1818 - 10.2767 = 107.9051$ units
- New Equity = $\$11,500.00 - \$1,000.00 = \$10,500.00$
- $\text{NAV}_4 = \frac{\$10,500.00}{107.9051} = \mathbf{\$97.3077}$
- Peak NAV = \$110.00
- $\text{Drawdown}_4 = \frac{110.00 - 97.3077}{110.00} \times 100 = \mathbf{11.54\%}$
- **Mathematical Proof:** NAV remains exactly \$97.3077. The withdrawal created **0.00% trading loss** and did **NOT** distort drawdown depth.

---

### 4.2 Why This Cannot Be Implemented with Current Data
1. Current data model records only final settled `CashTransaction` and `TradeRecord` timestamps. It does not record the exact open equity or mark-to-market valuations at the instant a deposit or withdrawal occurs.
2. If a student holds 2 open trades with floating P/L while depositing funds, the true prevailing NAV at that instant is unknowable without live broker feeds.
3. **Conclusion:** Account Equity Drawdown is classified as **`NOT_IMPLEMENTABLE_WITH_CURRENT_DATA`** and omitted from the active calculation engine.
