# SIGNAL CASPER ACADEMY — SPRINT 5
# DETERMINISTIC EVALUATION RUBRIC & SCORING SPECIFICATION — REVISION 3

**Title:** Practical Decision Drill Rubric & Scoring Logic  
**Sprint:** Sprint 5  
**Document Version:** 3.0.0  
**Status:** PLANNING ONLY — REVISED POST PRODUCT OWNER CONSISTENCY REVIEW (REV 3)  
**Baseline:** Sprint 1–4 Accepted & Frozen  
**Date:** November 12, 2026  

---

## 1. RUBRIC ARCHITECTURE & SAFETY GATE PHILOSOPHY

Institutional trading education demands that **capital preservation is non-negotiable**. A trader who identifies an accurate entry but places a reckless or unprotected stop-loss is exposed to catastrophic risk of ruin.

### Core Scoring Principles:
1. **Multi-Dimensional Weighting (100 Points Total)**:
   - `CRIT_BIAS`: 20 Points
   - `CRIT_ENTRY`: 25 Points
   - `CRIT_INVALID`: 25 Points (**Mandatory Safety Gate: $\ge 18$ Points**)
   - `CRIT_RR`: 15 Points
   - `CRIT_CONFIRM`: 15 Points
2. **Dual-Condition Passing Gate**:
   A submission is awarded `evaluationStatus = "PASSED"` **if and only if**:
   $$\text{Total Score} \ge 70 \quad \text{AND} \quad \text{Score}_{\text{invalid}} \ge 18$$
   If $\text{Total Score} \ge 70$ but $\text{Score}_{\text{invalid}} < 18$, the status is **`FAILED_SAFETY_GATE`** ("Belum Lulus: Manajemen Risiko Tidak Memenuhi Standar Keselamatan").
3. **Rigorous Contextual "NO-TRADE" Safety Gate Formulation**:
   Choosing not to enter when market conditions are unconfirmed or risky is a disciplined execution decision. The Safety Gate is evaluated based on **capital preservation reasoning** rather than requiring a phantom Stop-Loss price.
4. **Symmetric Half-Up Rounding Formula**:
   All fractional sub-points are rounded using standard symmetric half-up rounding:
   $$\text{roundHalfUp}(x) = \begin{cases} \lfloor x + 0.5 \rfloor, & \text{if } x \ge 0 \\ -\lfloor |x| + 0.5 \rfloor, & \text{if } x < 0 \end{cases}$$
   Subcriteria calculations maintain full floating-point precision internally and round to nearest integer at criterion boundaries, guaranteeing that $\sum \text{CriteriaPoints} \equiv \text{TotalScore}$.

---

## 2. MATHEMATICAL EVALUATION RULES PER CRITERION

```
                  ┌─────────────────────────────────────┐
                  │      STUDENT DECISION STANCE        │
                  └──────────────────┬──────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
                 ▼                                       ▼
       [ TAKE POSITION STANCE ]                 [ NO-TRADE STANCE ]
                 │                                       │
        ├── CRIT_BIAS (20 Pts)                  ├── CRIT_BIAS (20 Pts)
        ├── CRIT_ENTRY (25 Pts)                 ├── CRIT_ENTRY (25 Pts - Disciplined)
        ├── CRIT_INVALID (25 Pts - GATE ≥18)    ├── CRIT_INVALID (25 Pts - Protected)
        ├── CRIT_RR (15 Pts)                    ├── CRIT_RR (15 Pts - Preserved EV)
        └── CRIT_CONFIRM (15 Pts)               └── CRIT_CONFIRM (15 Pts - Reason)
```

### 2.1 Criterion 1: Market Bias (`CRIT_BIAS` — 20 Points)
$$\text{Score}_{\text{bias}} = \begin{cases} 20, & \text{if } \text{submittedBias} = \text{expectedBias} \\ 0, & \text{otherwise} \end{cases}$$
* *Explanation*: Evaluates macro order flow perception. If the student selects Bullish while higher timeframe order flow is Bearish, 0 points are awarded, accompanied by feedback detailing the broken swing structure.

---

### 2.2 Criterion 2: Entry Zone Accuracy (`CRIT_ENTRY` — 25 Points)
Let $P_e$ be the submitted entry price, $[E_{\min}, E_{\max}]$ be the ideal zone, and $T_e$ be tolerance.
$$\text{Score}_{\text{entry}} = \begin{cases}
25, & \text{if } E_{\min} \le P_e \le E_{\max} \quad (\text{Inside institutional zone}) \\
18, & \text{if } (E_{\min} - T_e) \le P_e < E_{\min} \text{ or } E_{\max} < P_e \le (E_{\max} + T_e) \quad (\text{Within tolerance}) \\
10, & \text{if } (E_{\min} - 2T_e) \le P_e < (E_{\min} - T_e) \text{ or } (E_{\max} + T_e) < P_e \le (E_{\max} + 2T_e) \\
0, & \text{otherwise (Chasing or Front-running far outside zone)}
\end{cases}$$

---

### 2.3 Criterion 3: Invalidation / Stop-Loss (`CRIT_INVALID` — 25 Points — **Safety Gate $\ge 18$**)
Let $P_{sl}$ be submitted SL, $S_{\text{ideal}}$ be the structural invalidation price, and $T_{sl}$ be tolerance.

#### Rule 3.1: Position Stance (`isNoTrade = false`):
* **Inverted / Illegal Stop-Loss**:
  - If Bearish/Short and $P_{sl} \le P_e$: **0 Points** (*Immediate Safety Failure*).
  - If Bullish/Long and $P_{sl} \ge P_e$: **0 Points** (*Immediate Safety Failure*).
* **Structural Distance Scoring**:
  $$\text{Score}_{\text{invalid}} = \begin{cases}
  25, & \text{if } |P_{sl} - S_{\text{ideal}}| \le T_{sl} \quad (\text{Ideal structural placement}) \\
  20, & \text{if } T_{sl} < |P_{sl} - S_{\text{ideal}}| \le 1.5 \times T_{sl} \quad (\text{Safe with slight excess buffer}) \\
  18, & \text{if } 1.5 \times T_{sl} < |P_{sl} - S_{\text{ideal}}| \le 2.0 \times T_{sl} \quad (\text{Meets minimum safety gate}) \\
  12, & \text{if } P_{sl} \text{ inside swing wick} \quad (\text{Too tight; high noise vulnerability — FAILS GATE}) \\
  8, & \text{if } |P_{sl} - S_{\text{ideal}}| > 3.0 \times T_{sl} \quad (\text{Excessively wide stop-loss — FAILS GATE})
  \end{cases}$$

#### Rule 3.2: NO-TRADE Stance (`isNoTrade = true`):
* If `modelAnswer.isNoTradeValid === true`:
  - Student is **not required** to submit a Stop-Loss price.
  - Invalidation is evaluated based on whether the selected reason correctly addresses risk invalidation:
    $$\text{Score}_{\text{invalid}} = \begin{cases}
    25, & \text{if student selected valid risk reason (e.g. news, poor R:R)} \quad (\text{Safety Gate Passed}) \\
    18, & \text{if student selected generic consolidation without structural tag} \\
    0, & \text{if student provided contradictory or empty rationale}
    \end{cases}$$
* If `modelAnswer.isNoTradeValid === false` (Unjustified sideline sitting on clear setup):
  - $\text{Score}_{\text{invalid}} = 0$ (*Safety gate failed due to unjustified fear/inaction*).

---

### 2.4 Criterion 4: Risk/Reward Viability (`CRIT_RR` — 15 Points)
#### Position Mode:
$$\text{Calculated R:R} = \frac{|P_{\text{target}} - P_{\text{entry}}|}{|P_{\text{entry}} - P_{sl}|}$$
$$\text{Score}_{\text{RR}} = \begin{cases}
15, & \text{if } \text{R:R} \ge \text{MinRR} \text{ (e.g. 2.0)} \\
10, & \text{if } 1.5 \le \text{R:R} < \text{MinRR} \\
5, & \text{if } 1.0 \le \text{R:R} < 1.5 \\
0, & \text{if } \text{R:R} < 1.0 \text{ (Negative expectancy)}
\end{cases}$$

#### NO-TRADE Mode:
$$\text{Score}_{\text{RR}} = \begin{cases}
15, & \text{if } \text{modelAnswer.isNoTradeValid === true} \quad (\text{Saved capital from negative EV}) \\
0, & \text{otherwise}
\end{cases}$$

---

### 2.5 Criterion 5: Setup Confirmation & Reasoning (`CRIT_CONFIRM` — 15 Points)
Evaluated via intersection of selected confirmations ($C_{\text{student}} \cap C_{\text{required}}$) and keyword matching in rationale:
$$\text{Score}_{\text{confirm}} = \text{roundHalfUp}\left(10 \times \frac{|C_{\text{student}} \cap C_{\text{required}}|}{|C_{\text{required}}|}\right) + \text{KeywordPoints (max 5)}$$

---

## 3. HANDLING INCOMPLETE OR CONTRADICTORY SUBMISSIONS

1. **Incomplete Submissions**:
   - If `isNoTrade = false` and `invalidationPrice` is omitted: `Score_invalid = 0` $\rightarrow$ **Automatic Safety Gate Failure**.
   - If `entryPrice` is missing in position mode: `Score_entry = 0`.
   - If `rationaleText` is missing or $< 10$ characters: `Score_confirm` penalized by 5 points.
2. **Contradictory Rubric Prevention in Admin Builder**:
   - Admin cannot publish a drill if $\sum \text{Weights} \ne 100$.
   - Admin cannot set `invalidationSafetyGatePoints > weight(CRIT_INVALID)`.
   - Model answer must pass mathematical consistency checks:
     - If Bias = `BULLISH`: Invalidation SL must be $< \text{Entry}$.
     - If Bias = `BEARISH`: Invalidation SL must be $> \text{Entry}$.
     - Target must produce $\text{R:R} \ge \text{MinRR}$.

---

## 4. SYNTHETIC BENCHMARK TEST CASES (TEST DATA ONLY)

> [!NOTE]
> Seluruh skenario berikut adalah data pengujian sintetis (*synthetic benchmark test cases*) untuk memverifikasi logika mesin evaluasi sebelum deployment.

### Benchmark SYNTH-01: Passing with High Safety Margin
* **Model Answer**: Bias: `BEARISH`, Entry: $2666.00 - 2667.50$, SL: $2670.00$, TP: $2655.00$, Min R:R: $2.0$.
* **Submission**: Bias: `BEARISH`, Entry: $2666.80$, SL: $2670.20$, TP: $2655.00$, Confirmations: `["LIQUIDITY_SWEEP", "FVG_TAP"]`.
* **Points**: Bias: 20/20, Entry: 25/25, SL: 22/25 (Safe), R:R: 15/15 (3.47), Confirm: 12/15.
* **Total: 94 / 100 | SL: 22 / 25 | STATUS: PASSED (LULUS)**

### Benchmark SYNTH-02: Safety Gate Failure Despite Overall $\ge 70\%$
* **Submission**: Bias: `BEARISH` (20), Entry: $2666.80$ (25), SL: $2667.20$ (Too tight inside wick, SL Score = 12/25 $\rightarrow$ **FAILS GATE**), TP: $2655.00$ (15), Confirm: 12/15.
* **Total: 84 / 100 | SL: 12 / 25 (< 18) | STATUS: FAILED_SAFETY_GATE**
* **Feedback Banner**: *"Belum Lulus — Nilai total 84% memenuhi ambang batas, namun penempatan Stop-Loss (12/25) gagal memenuhi standar keselamatan minimum (18/25). Posisi dengan stop-loss terlalu ketat di dalam wick likuiditas rentan terhadap noise market."*

### Benchmark SYNTH-03: Valid Contextual NO-TRADE
* **Model Answer**: `isNoTradeValid: true`, Reason: `HIGH_IMPACT_NEWS_PENDING`.
* **Submission**: `isNoTrade: true`, Reason: `HIGH_IMPACT_NEWS_PENDING`, Rationale: *"Menjelang rilis FOMC dalam 20 menit, spread berpotensi melebar dan volatilitas tidak menentu. Disiplin menunggu rilis."*
* **Points**: Bias: 20/20, Entry: 25/25, SL: 25/25 (Protected), R:R: 15/15, Confirm: 15/15.
* **Total: 100 / 100 | SL: 25 / 25 | STATUS: PASSED (DISCIPLINED CAPITAL PRESERVATION)**

### Benchmark SYNTH-04: Invalid / Unjustified NO-TRADE
* **Model Answer**: `isNoTradeValid: false` (Textbook A+ Liquidity sweep setup).
* **Submission**: `isNoTrade: true`.
* **Points**: Bias: 20/20, Entry: 0/25, SL: 0/25 (Unjustified inaction), R:R: 0/15, Confirm: 5/15.
* **Total: 25 / 100 | SL: 0 / 25 | STATUS: FAILED**
