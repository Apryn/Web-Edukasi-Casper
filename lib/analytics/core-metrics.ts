/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * PERFORMANCE ANALYTICS ENGINE — TASK 3.2
 * Core Metrics Calculation Kernel (Pure Functions)
 *
 * Implements:
 * - Trade intake filtering & eligibility (CLOSED only, valid exitDate & netPnl)
 * - Exact Net P/L summation via BigInt integer minor units
 * - Dual Win Rates: Comprehensive (WinRate_all) vs. Decisive (WinRate_decisive)
 * - Average Win and Positive Average Loss Magnitude
 * - Profit Factor with strict no-Infinity guarantee (null with ZERO_LOSSES status)
 * - Expectancy with dual mathematical reconciliation (Method 1 == Method 2)
 * - R-Multiple cohort analytics with strict plannedRiskAmount > 0 filtering
 * - Educational Sample Status assignment (INSUFFICIENT < 15, LIMITED 15-29, SUFFICIENT >= 30)
 */

import type { TradeRecord } from "../journal-types";
import { toMinorUnits, toMajorUnits, roundToDecimals } from "../journal-service";
import type {
  WinRateResult,
  AvgWinLossResult,
  ProfitFactorResult,
  ExpectancyResult,
  RMultipleResult,
  CoreMetricsSummary,
  AnalyticsSampleStatus,
} from "./analytics-types";

// ── Eligibility & Intake Filter ───────────────────────────────────

/**
 * Filters a raw trade array to only eligible closed trades.
 * Excludes OPEN, CANCELLED, trades missing exitDate, or with non-finite netPnl.
 */
export function filterEligibleClosedTrades(trades: TradeRecord[]): TradeRecord[] {
  if (!Array.isArray(trades)) return [];
  return trades.filter((t) => {
    if (!t || typeof t !== "object") return false;
    if (t.status !== "CLOSED") return false;
    if (!t.exitDate || typeof t.exitDate !== "string" || isNaN(new Date(t.exitDate).getTime())) {
      return false;
    }
    if (typeof t.netPnl !== "number" || !Number.isFinite(t.netPnl) || isNaN(t.netPnl)) {
      return false;
    }
    return true;
  });
}

/**
 * Assigns Product Owner approved educational sample size status.
 * Policies:
 * - N = 0: NO_DATA
 * - 1 <= N < 15: INSUFFICIENT
 * - 15 <= N < 30: LIMITED
 * - N >= 30: SUFFICIENT
 */
export function evaluateSampleStatus(count: number): {
  status: AnalyticsSampleStatus;
  disclaimer: string;
} {
  if (count === 0) {
    return {
      status: "NO_DATA",
      disclaimer: "Belum ada data trade tertutup untuk evaluasi performa.",
    };
  }
  if (count < 15) {
    return {
      status: "INSUFFICIENT",
      disclaimer:
        "Kebijakan Edukasi: Sampel data di bawah 15 trade masih memiliki variansi statistik tinggi. Hasil analisis bersifat indikatif awal dan belum mencerminkan konsistensi strategi.",
    };
  }
  if (count < 30) {
    return {
      status: "LIMITED",
      disclaimer:
        "Kebijakan Edukasi: Sampel data 15–29 trade mulai membentuk pola dasar, namun rentang keyakinan masih moderat. Disarankan mengumpulkan minimal 30 trade untuk evaluasi mandiri yang lebih stabil.",
    };
  }
  return {
    status: "SUFFICIENT",
    disclaimer:
      "Kebijakan Edukasi: Sampel data 30 trade atau lebih telah memenuhi ambang batas dasar untuk evaluasi mandiri kedisiplinan dan risk management.",
  };
}

// ── Core Metric 1: Total Net P/L ─────────────────────────────────

/**
 * Calculates total net realized P/L across eligible closed trades using BigInt minor units.
 */
export function calculateTotalNetPnl(trades: TradeRecord[], decimals: number): number {
  const eligible = filterEligibleClosedTrades(trades);
  if (eligible.length === 0) return 0;

  let totalMinor = BigInt(0);
  for (const t of eligible) {
    totalMinor += toMinorUnits(t.netPnl as number, decimals);
  }
  return toMajorUnits(totalMinor, decimals);
}

// ── Core Metric 2: Win Rates ─────────────────────────────────────

/**
 * Calculates Comprehensive Win Rate, Decisive Win Rate, and Breakeven Rate.
 */
export function calculateWinRates(trades: TradeRecord[]): WinRateResult {
  const eligible = filterEligibleClosedTrades(trades);
  const total = eligible.length;

  if (total === 0) {
    return {
      totalClosedTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakevenTrades: 0,
      winRateAll: null,
      winRateDecisive: null,
      breakevenRate: null,
      calculationStatus: "NO_DATA",
    };
  }

  let winning = 0;
  let losing = 0;
  let breakeven = 0;

  for (const t of eligible) {
    const pnl = t.netPnl as number;
    if (pnl > 0) winning++;
    else if (pnl < 0) losing++;
    else breakeven++;
  }

  const winRateAll = roundToDecimals((winning / total) * 100, 2);
  const breakevenRate = roundToDecimals((breakeven / total) * 100, 2);

  const decisiveTotal = winning + losing;
  let winRateDecisive: number | null = null;
  let calculationStatus: WinRateResult["calculationStatus"] = "VALID";

  if (decisiveTotal === 0) {
    winRateDecisive = null;
    calculationStatus = "ALL_BREAKEVEN";
  } else {
    winRateDecisive = roundToDecimals((winning / decisiveTotal) * 100, 2);
  }

  return {
    totalClosedTrades: total,
    winningTrades: winning,
    losingTrades: losing,
    breakevenTrades: breakeven,
    winRateAll,
    winRateDecisive,
    breakevenRate,
    calculationStatus,
  };
}

// ── Core Metric 3: Average Win & Average Loss Magnitude ───────────

/**
 * Calculates Average Win and Average Loss Magnitude (reported as strictly positive).
 */
export function calculateAverageWinLoss(
  trades: TradeRecord[],
  decimals: number
): AvgWinLossResult {
  const eligible = filterEligibleClosedTrades(trades);
  if (eligible.length === 0) {
    return {
      winningTrades: 0,
      losingTrades: 0,
      averageWin: null,
      averageLossMagnitude: null,
      signedAverageLoss: null,
      winLossRatio: null,
      calculationStatus: "NO_DATA",
    };
  }

  let sumWinMinor = BigInt(0);
  let countWin = 0;
  let sumLossAbsMinor = BigInt(0);
  let countLoss = 0;

  for (const t of eligible) {
    const pnl = t.netPnl as number;
    if (pnl > 0) {
      sumWinMinor += toMinorUnits(pnl, decimals);
      countWin++;
    } else if (pnl < 0) {
      sumLossAbsMinor += toMinorUnits(Math.abs(pnl), decimals);
      countLoss++;
    }
  }

  let avgWin: number | null = null;
  let avgLossMag: number | null = null;
  let signedAvgLoss: number | null = null;
  let winLossRatio: number | null = null;

  if (countWin > 0) {
    const avgWinMinor = sumWinMinor / BigInt(countWin);
    avgWin = toMajorUnits(avgWinMinor, decimals);
  }

  if (countLoss > 0) {
    const avgLossMinor = sumLossAbsMinor / BigInt(countLoss);
    avgLossMag = toMajorUnits(avgLossMinor, decimals);
    signedAvgLoss = -avgLossMag;
  }

  if (avgWin !== null && avgLossMag !== null && avgLossMag > 0) {
    winLossRatio = roundToDecimals(avgWin / avgLossMag, 2);
  }

  let status: AvgWinLossResult["calculationStatus"] = "VALID";
  if (countWin === 0 && countLoss === 0) status = "ALL_BREAKEVEN";
  else if (countLoss === 0) status = "ZERO_LOSSES";
  else if (countWin === 0) status = "ZERO_PROFIT";

  return {
    winningTrades: countWin,
    losingTrades: countLoss,
    averageWin: avgWin,
    averageLossMagnitude: avgLossMag,
    signedAverageLoss: signedAvgLoss,
    winLossRatio,
    calculationStatus: status,
  };
}

// ── Core Metric 4: Profit Factor ─────────────────────────────────

/**
 * Calculates Profit Factor (GrossProfit / GrossLoss).
 * Zero losses returns null with ZERO_LOSSES (never Infinity or NaN).
 */
export function calculateProfitFactor(
  trades: TradeRecord[],
  decimals: number
): ProfitFactorResult {
  const eligible = filterEligibleClosedTrades(trades);
  if (eligible.length === 0) {
    return {
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: null,
      calculationStatus: "NO_DATA",
    };
  }

  let grossProfitMinor = BigInt(0);
  let grossLossMinor = BigInt(0);

  for (const t of eligible) {
    const pnl = t.netPnl as number;
    if (pnl > 0) {
      grossProfitMinor += toMinorUnits(pnl, decimals);
    } else if (pnl < 0) {
      grossLossMinor += toMinorUnits(Math.abs(pnl), decimals);
    }
  }

  const grossProfit = toMajorUnits(grossProfitMinor, decimals);
  const grossLoss = toMajorUnits(grossLossMinor, decimals);

  if (grossLossMinor === BigInt(0)) {
    if (grossProfitMinor > BigInt(0)) {
      return {
        grossProfit,
        grossLoss,
        profitFactor: null,
        calculationStatus: "ZERO_LOSSES",
      };
    }
    return {
      grossProfit,
      grossLoss,
      profitFactor: null,
      calculationStatus: "ALL_BREAKEVEN",
    };
  }

  if (grossProfitMinor === BigInt(0)) {
    return {
      grossProfit,
      grossLoss,
      profitFactor: 0,
      calculationStatus: "ZERO_PROFIT",
    };
  }

  const pfRaw = Number(grossProfitMinor) / Number(grossLossMinor);
  const profitFactor = roundToDecimals(pfRaw, 2);

  return {
    grossProfit,
    grossLoss,
    profitFactor,
    calculationStatus: "VALID",
  };
}

// ── Core Metric 5: Expectancy ────────────────────────────────────

/**
 * Calculates trade statistical expectancy per trade.
 * Verifies mathematical parity between:
 * - Method 1: TotalNetPnl / N
 * - Method 2: (Pw * AvgWin) - (Pl * AvgLossMagnitude)
 */
export function calculateExpectancy(
  trades: TradeRecord[],
  decimals: number
): ExpectancyResult {
  const eligible = filterEligibleClosedTrades(trades);
  const total = eligible.length;

  if (total === 0) {
    return {
      totalNetPnl: 0,
      totalClosedTrades: 0,
      expectancy: null,
      expectancyFormula1: null,
      expectancyFormula2: null,
      isFormulasReconciled: true,
      calculationStatus: "NO_DATA",
    };
  }

  const totalNetPnl = calculateTotalNetPnl(eligible, decimals);
  const exp1 = roundToDecimals(totalNetPnl / total, decimals);

  // Method 2 component derivation
  let winCount = 0;
  let lossCount = 0;
  let winSumMinor = BigInt(0);
  let lossAbsSumMinor = BigInt(0);

  for (const t of eligible) {
    const pnl = t.netPnl as number;
    if (pnl > 0) {
      winCount++;
      winSumMinor += toMinorUnits(pnl, decimals);
    } else if (pnl < 0) {
      lossCount++;
      lossAbsSumMinor += toMinorUnits(Math.abs(pnl), decimals);
    }
  }

  let exp2: number;
  if (winCount === 0 && lossCount === 0) {
    exp2 = 0;
  } else {
    const pw = winCount / total;
    const pl = lossCount / total;
    const avgWin = winCount > 0 ? toMajorUnits(winSumMinor / BigInt(winCount), decimals) : 0;
    const avgLoss = lossCount > 0 ? toMajorUnits(lossAbsSumMinor / BigInt(lossCount), decimals) : 0;
    exp2 = roundToDecimals(pw * avgWin - pl * avgLoss, decimals);
  }

  // Verification tolerance within 1 minor unit or rounding precision
  const diff = Math.abs(exp1 - exp2);
  const minorUnitFactor = Math.pow(10, -decimals);
  const isFormulasReconciled = diff <= minorUnitFactor || diff < 1e-4;

  return {
    totalNetPnl,
    totalClosedTrades: total,
    expectancy: exp1,
    expectancyFormula1: exp1,
    expectancyFormula2: exp2,
    isFormulasReconciled,
    calculationStatus: "VALID",
  };
}

// ── Core Metric 6: R-Multiple Metrics ────────────────────────────

/**
 * Calculates R-Multiple analytics across trades with positive plannedRiskAmount.
 *
 * Strict Rule:
 * - plannedRiskAmount > 0: included in R cohort
 * - plannedRiskAmount missing, null, or <= 0: EXCLUDED from R cohort (denominator N_R)
 */
export function calculateRMultipleMetrics(trades: TradeRecord[]): RMultipleResult {
  const eligible = filterEligibleClosedTrades(trades);
  const total = eligible.length;

  if (total === 0) {
    return {
      totalTradesRecorded: 0,
      rEligibleTradesCount: 0,
      excludedTradesCount: 0,
      totalR: null,
      averageR: null,
      medianR: null,
      expectancyR: null,
      winRateR: null,
      avgWinR: null,
      avgLossMagnitudeR: null,
      calculationStatus: "NO_DATA",
    };
  }

  const rCohort: Array<{ r: number; netPnl: number }> = [];
  let excludedCount = 0;

  for (const t of eligible) {
    const risk = t.plannedRiskAmount;
    if (typeof risk === "number" && Number.isFinite(risk) && risk > 0) {
      const rValue = roundToDecimals((t.netPnl as number) / risk, 4);
      rCohort.push({ r: rValue, netPnl: t.netPnl as number });
    } else {
      excludedCount++;
    }
  }

  const nR = rCohort.length;
  if (nR === 0) {
    return {
      totalTradesRecorded: total,
      rEligibleTradesCount: 0,
      excludedTradesCount: excludedCount,
      totalR: null,
      averageR: null,
      medianR: null,
      expectancyR: null,
      winRateR: null,
      avgWinR: null,
      avgLossMagnitudeR: null,
      calculationStatus: "NO_RISK_DATA",
    };
  }

  // Total R and Average R
  let sumR = 0;
  let winRCount = 0;
  let winRSum = 0;
  let lossRCount = 0;
  let lossRAbsSum = 0;

  const rValues: number[] = [];

  for (const item of rCohort) {
    sumR += item.r;
    rValues.push(item.r);
    if (item.r > 0) {
      winRCount++;
      winRSum += item.r;
    } else if (item.r < 0) {
      lossRCount++;
      lossRAbsSum += Math.abs(item.r);
    }
  }

  const totalR = roundToDecimals(sumR, 2);
  const averageR = roundToDecimals(sumR / nR, 2);

  // Median R
  rValues.sort((a, b) => a - b);
  const mid = Math.floor(nR / 2);
  const medianR =
    nR % 2 === 0
      ? roundToDecimals((rValues[mid - 1] + rValues[mid]) / 2, 2)
      : roundToDecimals(rValues[mid], 2);

  // R Expectancy: (Pw * AvgWinR) - (Pl * AvgLossR)
  const pwR = winRCount / nR;
  const plR = lossRCount / nR;
  const avgWinR = winRCount > 0 ? roundToDecimals(winRSum / winRCount, 2) : null;
  const avgLossMagnitudeR =
    lossRCount > 0 ? roundToDecimals(lossRAbsSum / lossRCount, 2) : null;

  let expectancyR: number | null = null;
  if (winRCount > 0 || lossRCount > 0) {
    const termWin = pwR * (avgWinR || 0);
    const termLoss = plR * (avgLossMagnitudeR || 0);
    expectancyR = roundToDecimals(termWin - termLoss, 2);
  } else {
    expectancyR = 0;
  }

  const winRateR = roundToDecimals((winRCount / nR) * 100, 2);

  return {
    totalTradesRecorded: total,
    rEligibleTradesCount: nR,
    excludedTradesCount: excludedCount,
    totalR,
    averageR,
    medianR,
    expectancyR,
    winRateR,
    avgWinR,
    avgLossMagnitudeR,
    calculationStatus: "VALID",
  };
}

// ── Composite Summary Orchestrator (Single Currency Cohort) ──────

/**
 * Builds a unified CoreMetricsSummary for a cohort of trades sharing the same currency.
 */
export function buildCoreMetricsSummary(
  trades: TradeRecord[],
  currency: string,
  currencyDecimals: number
): CoreMetricsSummary {
  const eligible = filterEligibleClosedTrades(trades);
  const sampleInfo = evaluateSampleStatus(eligible.length);

  const totalNetPnl = calculateTotalNetPnl(eligible, currencyDecimals);
  const winRates = calculateWinRates(eligible);
  const avgWinLoss = calculateAverageWinLoss(eligible, currencyDecimals);
  const profitFactor = calculateProfitFactor(eligible, currencyDecimals);
  const expectancy = calculateExpectancy(eligible, currencyDecimals);
  const rMultiple = calculateRMultipleMetrics(eligible);

  // Data quality distribution
  let calcStd = 0;
  let selfMan = 0;
  let estInc = 0;
  for (const t of eligible) {
    if (t.dataQuality === "CALCULATED_STANDARD") calcStd++;
    else if (t.dataQuality === "ESTIMATED_INCOMPLETE_FEES") estInc++;
    else selfMan++;
  }

  return {
    currency,
    currencyDecimals,
    totalClosedTrades: eligible.length,
    totalNetPnl,
    grossProfit: profitFactor.grossProfit,
    grossLoss: profitFactor.grossLoss,
    winRates,
    avgWinLoss,
    profitFactor,
    expectancy,
    rMultiple,
    sampleStatus: sampleInfo.status,
    dataQualityDistribution: {
      calculatedStandard: calcStd,
      selfReportedManual: selfMan,
      estimatedIncompleteFees: estInc,
    },
    sampleDisclaimer: sampleInfo.disclaimer,
  };
}
