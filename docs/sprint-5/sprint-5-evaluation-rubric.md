# SIGNAL CASPER ACADEMY — SPRINT 5
# DETERMINISTIC EVALUATION RUBRIC & SCORING SPECIFICATION

**Title:** Practical Decision Drill Rubric & Scoring Logic  
**Sprint:** Sprint 5  
**Document Version:** 1.0.0  
**Status:** PLANNING ONLY — NO IMPLEMENTATION  
**Date:** November 10, 2026  

---

## 1. RUBRIC ARCHITECTURE & PRINCIPLES

Traditional trading education systems rely either on rigid single-number matching or ambiguous subjective grading. The Casper Practical Drill Engine utilizes **deterministic, multi-criteria rubric scoring** with defined mathematical tolerances.

### Core Scoring Principles
1. **Multi-Dimensional Weighting**: Total score is calculated out of 100 points, distributed across 5 core technical dimensions.
2. **Defensive Invalidation Priority**: Placing a logical, structural stop-loss carries equal or higher weight than identifying the exact entry tick.
3. **Equitable "No-Trade" Credit**: Choosing not to trade when market criteria are unmet is a professional trading decision. Correct `NO_TRADE` submissions receive full credit on execution criteria.
4. **Transparent Point Deductions**: Every deduction is accompanied by an explicit, actionable explanation referencing market structure principles.

---

## 2. STANDARD CRITERIA & WEIGHT DISTRIBUTION

| Criterion Code | Criterion Name | Standard Weight | Evaluation Engine Method |
| :--- | :--- | :--- | :--- |
| `CRIT_BIAS` | Market Bias & Order Flow Context | **20 Points** | Categorical exact match against model directional bias |
| `CRIT_ENTRY` | Entry Zone Identification | **25 Points** | Continuous boundary tolerance check ($[\text{Min}, \text{Max}] \pm \text{Tolerance}$) |
| `CRIT_INVALID` | Invalidation (Stop-Loss) Placement | **25 Points** | Structural boundary & buffer verification ($[\text{Ideal}] \pm \text{Tolerance}$) |
| `CRIT_RR` | Risk-to-Reward (R:R) Viability | **15 Points** | Computed ratio verification ($\text{R:R} \ge \text{MinRequired}$) |
| `CRIT_CONFIRM` | Setup Confirmation & Rationale | **15 Points** | Set intersection of structural tags + keyword match |
| **TOTAL** | | **100 Points** | **Passing Threshold: $\ge 70$ Points** |

---

## 3. MATHEMATICAL EVALUATION RULES

### 3.1 Criterion 1: Market Bias (`CRIT_BIAS` — 20 Pts)
$$\text{Score}_{\text{bias}} = \begin{cases} 20, & \text{if } \text{submittedBias} = \text{expectedBias} \\ 0, & \text{otherwise} \end{cases}$$
* *Explanation*: If student submits Bullish when institutional order flow is Bearish, full 20 points are deducted with explanation on broken higher-low structure.

### 3.2 Criterion 2: Entry Zone Accuracy (`CRIT_ENTRY` — 25 Pts)
Let $P_e$ be the submitted entry price, $[E_{\min}, E_{\max}]$ be the valid zone, and $T_e$ be the configured tolerance.
$$\text{Score}_{\text{entry}} = \begin{cases} 
25, & \text{if } E_{\min} \le P_e \le E_{\max} \\
18, & \text{if } (E_{\min} - T_e) \le P_e < E_{\min} \text{ or } E_{\max} < P_e \le (E_{\max} + T_e) \\
0, & \text{otherwise (Chasing or Front-running too far)}
\end{cases}$$

### 3.3 Criterion 3: Invalidation / Stop-Loss (`CRIT_INVALID` — 25 Pts)
Let $P_{sl}$ be submitted SL, $S_{\text{ideal}}$ be ideal structural invalidation, and $T_{sl}$ be tolerance.
* **For Short/Bearish trades**: $P_{sl}$ must be strictly $> P_e$ and within $[S_{\text{ideal}} - T_{sl}, S_{\text{ideal}} + 2 \times T_{sl}]$.
* **Deductions**:
  - If $P_{sl} \le P_e$ (inverted stop-loss): **0 Points** (Critical safety violation).
  - If $P_{sl}$ is too tight (inside the swing high/low wick): **10 Points deducted** ("Stop-loss terlalu sempit di dalam liquidity wick; rentan terpicu noise").
  - If $P_{sl}$ is excessively wide ($> 3 \times T_{sl}$): **12 Points deducted** ("Stop-loss terlalu jauh, merusak efisiensi risiko").

### 3.4 Criterion 4: Risk/Reward Viability (`CRIT_RR` — 15 Pts)
$$\text{R:R} = \frac{|P_{\text{target}} - P_{\text{entry}}|}{|P_{\text{entry}} - P_{sl}|}$$
$$\text{Score}_{\text{RR}} = \begin{cases}
15, & \text{if } \text{R:R} \ge \text{MinRR} \text{ (e.g. 2.0)} \\
10, & \text{if } 1.5 \le \text{R:R} < \text{MinRR} \\
0, & \text{if } \text{R:R} < 1.5 \text{ (Unfavorable risk-to-reward ratio)}
\end{cases}$$

### 3.5 Special Rule: "NO-TRADE" Evaluation
When a drill's model answer designates that market conditions are NOT suitable for trading (`isNoTradeValid = true`):
* If student submits `isNoTrade = true` and selects a valid institutional reason (e.g. "Low R:R", "Major News in 15 mins", "Choppy Consolidation"):
  - `CRIT_ENTRY` $\rightarrow$ **25 / 25 Pts** (Full credit for discipline)
  - `CRIT_INVALID` $\rightarrow$ **25 / 25 Pts** (Full credit for capital preservation)
  - `CRIT_RR` $\rightarrow$ **15 / 15 Pts** (Full credit for avoiding negative EV)
  - `CRIT_BIAS` & `CRIT_CONFIRM` graded based on market context reasoning.
* If student forces a trade when model answer is `NO_TRADE`:
  - Execution criteria receive severe deduction (e.g. max 5 points), with feedback: *"Kondisi market memiliki probabilitas rendah atau mendekati rilis berita high-impact. Keputusan profesional adalah No-Trade."*

---

## 4. SYNTHETIC BENCHMARK TEST CASES (TEST DATA ONLY)

> [!NOTE]
> Nilai dan skenario di bawah ini adalah data pengujian sintetis (*synthetic test data*) yang digunakan untuk memverifikasi logika mesin evaluasi sebelum deployment.

### Test Case SYNTH-DRILL-01: Valid Short Execution
* **Instrument**: `XAUUSD` (Synthetic Gold)
* **Model Answer**:
  - Bias: `BEARISH`
  - Entry Zone: $2666.00 - 2667.50$ (Tolerance: $\pm 1.00$)
  - Invalidation: $2670.00$ (Tolerance: $\pm 0.80$)
  - Target: $2655.00$ (Tolerance: $\pm 2.00$)
  - Min R:R: $2.0$
* **Student Submission**:
  - Bias: `BEARISH`
  - Entry: $2666.50$
  - Invalidation: $2669.80$
  - Target: $2655.00$
  - Confirmations: `["LIQUIDITY_SWEEP", "FVG_TAP"]`
* **Evaluation Output**:
  - `CRIT_BIAS`: 20 / 20 (Full)
  - `CRIT_ENTRY`: 25 / 25 (Full, exactly in zone)
  - `CRIT_INVALID`: 25 / 25 (Full, proper buffer above high)
  - `CRIT_RR`: 15 / 15 (Calculated R:R = 3.48 $\ge$ 2.0)
  - `CRIT_CONFIRM`: 15 / 15 (Full matches)
  - **Total: 100 / 100 (PASS — MASTERED)**

### Test Case SYNTH-DRILL-02: Disciplined No-Trade
* **Instrument**: `XAUUSD`
* **Model Answer**: `isNoTradeValid: true`, Reason: `MAJOR_HIGH_IMPACT_NEWS_PENDING`
* **Student Submission**: `isNoTrade: true`, Reason: `MAJOR_HIGH_IMPACT_NEWS_PENDING`
* **Evaluation Output**:
  - `CRIT_BIAS`: 20 / 20
  - `CRIT_ENTRY`: 25 / 25 (Disciplined sidestep)
  - `CRIT_INVALID`: 25 / 25
  - `CRIT_RR`: 15 / 15
  - `CRIT_CONFIRM`: 15 / 15
  - **Total: 100 / 100 (PASS — DISCIPLINED CAPITAL PRESERVATION)**

