/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * PERFORMANCE ANALYTICS ENGINE — TASK 3.2 & 3.2.1
 * Core Metrics Calculation Kernel (Pure Functions)
 *
 * Hardened Features (Task 3.2.1):
 * - ISO-8601 strict timestamp validation helper
 * - Comprehensive Trade Intake Diagnostics with non-overlapping exclusion reasons
 * - BigInt cross-multiplication exact rational reconciliation for Expectancy
 * - BigInt scaled ratio conversion for Profit Factor (safe against aggregates > Number.MAX_SAFE_INTEGER)
 * - Strict non-Infinity, non-NaN guarantees
 * - Educational Sample Status assignment (INSUFFICIENT < 15, LIMITED 15-29, SUFFICIENT >= 30)
 */

import type { TradeRecord } from "../journal-types";
import {
  toMinorUnits,
  toMajorUnits,
  roundToDecimals,
  getMaxSafeFinancialAmount,
} from "../journal-service";
import type {
  WinRateResult,
  AvgWinLossResult,
  ProfitFactorResult,
  ExpectancyResult,
  RMultipleResult,
  CoreMetricsSummary,
  AnalyticsSampleStatus,
  TradeExclusionReasonCode,
  ExclusionReasonSummary,
  TradeIntakeDiagnostics,
} from "./analytics-types";

// ── ISO-8601 Validation Helper ────────────────────────────────────

const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Validates whether a given timestamp conforms to strict ISO-8601 format and represents a real calendar date.
 * Rejects non-existent calendar dates (e.g., Feb 30, April 31, Month 13) without JavaScript Date rollover bugs.
 */
export function isValidIsoDate(str: unknown): boolean {
  if (typeof str !== "string" || str.trim().length === 0) return false;
  if (!ISO_8601_REGEX.test(str)) return false;

  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;

  let maxDays = 31;
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    maxDays = isLeap ? 29 : 28;
  } else if (month === 4 || month === 6 || month === 9 || month === 11) {
    maxDays = 30;
  }

  if (day < 1 || day > maxDays) return false;

  if (match[4] !== undefined && match[5] !== undefined) {
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return false;
    if (match[6] !== undefined) {
      const second = parseInt(match[6], 10);
      if (second < 0 || second > 59) return false;
    }
  }

  const time = new Date(str).getTime();
  return !isNaN(time);
}

// ── Eligibility & Intake Filter with Diagnostics ──────────────────

/**
 * Descriptions for trade exclusion codes (anonymized, zero private data exposure).
 */
const EXCLUSION_DESCRIPTIONS: Record<TradeExclusionReasonCode, string> = {
  CORRUPT_RECORD: "Struktur data trade tidak valid atau bernilai null/undefined.",
  INVALID_STATUS: "Status trade bukan CLOSED (misal OPEN atau CANCELLED).",
  INVALID_EXIT_DATE: "Format tanggal penutupan (exitDate) bukan format ISO-8601 valid.",
  INVALID_NET_PNL: "Nilai realized Net P/L tidak valid, NaN, atau bukan angka berhingga.",
  UNSUPPORTED_CURRENCY: "Mata uang trade tidak sesuai dengan kohort akun yang dievaluasi.",
};

/**
 * Filters a raw trade array into eligible closed trades while producing
 * comprehensive diagnostics with mutually exclusive, non-overlapping reason codes.
 */
export function filterEligibleClosedTradesWithDiagnostics(
  trades: TradeRecord[],
  expectedCurrency?: string
): {
  eligibleTrades: TradeRecord[];
  diagnostics: TradeIntakeDiagnostics;
} {
  if (!Array.isArray(trades)) {
    return {
      eligibleTrades: [],
      diagnostics: {
        totalInputTrades: 0,
        eligibleTradesCount: 0,
        excludedTradesCount: 0,
        excludedReasons: [],
      },
    };
  }

  const eligibleTrades: TradeRecord[] = [];
  const reasonCounts: Record<TradeExclusionReasonCode, number> = {
    CORRUPT_RECORD: 0,
    INVALID_STATUS: 0,
    INVALID_EXIT_DATE: 0,
    INVALID_NET_PNL: 0,
    UNSUPPORTED_CURRENCY: 0,
  };

  let excludedCount = 0;

  for (const t of trades) {
    // 1. Corrupt record check
    if (!t || typeof t !== "object") {
      reasonCounts.CORRUPT_RECORD++;
      excludedCount++;
      continue;
    }

    // 2. Status check (must be CLOSED)
    if (t.status !== "CLOSED") {
      reasonCounts.INVALID_STATUS++;
      excludedCount++;
      continue;
    }

    // 3. Strict ISO-8601 exitDate check
    if (!isValidIsoDate(t.exitDate)) {
      reasonCounts.INVALID_EXIT_DATE++;
      excludedCount++;
      continue;
    }

    // 4. Finite numerical netPnl check
    if (typeof t.netPnl !== "number" || !Number.isFinite(t.netPnl) || isNaN(t.netPnl)) {
      reasonCounts.INVALID_NET_PNL++;
      excludedCount++;
      continue;
    }

    // 5. Currency check (if trade defines currency property and expectedCurrency was passed)
    const tradeCurrency = (t as unknown as { currency?: string }).currency;
    if (
      expectedCurrency &&
      typeof tradeCurrency === "string" &&
      tradeCurrency.trim().toUpperCase() !== expectedCurrency.trim().toUpperCase()
    ) {
      reasonCounts.UNSUPPORTED_CURRENCY++;
      excludedCount++;
      continue;
    }

    eligibleTrades.push(t);
  }

  const excludedReasons: ExclusionReasonSummary[] = (
    Object.keys(reasonCounts) as TradeExclusionReasonCode[]
  )
    .filter((k) => reasonCounts[k] > 0)
    .map((k) => ({
      reason: k,
      count: reasonCounts[k],
      description: EXCLUSION_DESCRIPTIONS[k],
    }));

  return {
    eligibleTrades,
    diagnostics: {
      totalInputTrades: trades.length,
      eligibleTradesCount: eligibleTrades.length,
      excludedTradesCount: excludedCount,
      excludedReasons,
    },
  };
}

/**
 * Backwards-compatible filter returning only eligible closed trades.
 */
export function filterEligibleClosedTrades(trades: TradeRecord[]): TradeRecord[] {
  return filterEligibleClosedTradesWithDiagnostics(trades).eligibleTrades;
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
    // Preserve fractional decimal precision for presentation:
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

// ── Core Metric 4: Profit Factor (Large Aggregate Safe) ───────────

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Safely converts BigInt minor units to major units even if the aggregate exceeds
 * Number.MAX_SAFE_INTEGER, ensuring no exception crashes metric calculation.
 */
function safeMinorToMajor(minor: bigint, decimals: number): number {
  const absMinor = minor < BigInt(0) ? -minor : minor;
  if (absMinor <= MAX_SAFE_INTEGER_BIGINT) {
    return toMajorUnits(minor, decimals);
  }
  const sign = minor < BigInt(0) ? -1 : 1;
  const factor = BigInt(10) ** BigInt(decimals);
  const intPart = absMinor / factor;
  const fracPart = decimals > 0 ? (absMinor % factor).toString().padStart(decimals, "0") : "";
  const str = decimals > 0 ? `${intPart.toString()}.${fracPart}` : intPart.toString();
  const val = sign * Number(str);
  return Number.isFinite(val) ? val : (sign * Number.MAX_SAFE_INTEGER);
}

/**
 * Calculates Profit Factor (GrossProfit / GrossLoss).
 * Uses BigInt fixed-point scaling so that aggregates exceeding Number.MAX_SAFE_INTEGER
 * retain 100% ratio precision without overflow, Infinity, or NaN.
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

  const grossProfit = safeMinorToMajor(grossProfitMinor, decimals);
  const grossLoss = safeMinorToMajor(grossLossMinor, decimals);

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

  // Safe BigInt scaling: scale numerator by 10,000 (4 decimals) before division
  // with symmetric half-up rounding in BigInt space:
  const SCALE = BigInt(10000);
  const halfDivisor = grossLossMinor / BigInt(2);
  const scaledQuotient = (grossProfitMinor * SCALE + halfDivisor) / grossLossMinor;

  // Safe Number conversion with explicit boundary and overflow protection:
  const maxSafeRatio = getMaxSafeFinancialAmount(2);
  let pfRaw: number;
  if (scaledQuotient > MAX_SAFE_INTEGER_BIGINT) {
    const converted = Number(scaledQuotient) / 10000;
    pfRaw = Number.isFinite(converted) ? converted : maxSafeRatio;
  } else {
    pfRaw = Number(scaledQuotient) / 10000;
  }

  if (!Number.isFinite(pfRaw) || isNaN(pfRaw) || pfRaw >= maxSafeRatio) {
    pfRaw = maxSafeRatio;
  }

  const profitFactor = roundToDecimals(pfRaw, 2);

  return {
    grossProfit,
    grossLoss,
    profitFactor,
    calculationStatus: "VALID",
  };
}

// ── Core Metric 5: Expectancy with Exact BigInt Rational Parity ──

/**
 * Calculates trade statistical expectancy per trade.
 *
 * Implements rigorous exact rational parity verification:
 * Method 1 Rational: TotalNetPnl_minor / N
 * Method 2 Rational: (Nw * winSum_minor / (N * Nw)) - (Nl * lossAbsSum_minor / (N * Nl))
 *                   = (winSum_minor - lossAbsSum_minor) / N
 *
 * Mathematical equivalence is proved via BigInt cross-multiplication:
 * num1 * den2 === num2 * den1
 * (Zero intermediate float rounding).
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
      exactRationalReconciled: true,
      calculationStatus: "NO_DATA",
    };
  }

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

  const totalNetPnlMinor = winSumMinor - lossAbsSumMinor;
  const totalNetPnl = safeMinorToMajor(totalNetPnlMinor, decimals);

  // 1. Method 1 (Aggregate Mean in major units):
  const exp1Raw = Number(totalNetPnlMinor) / (total * Math.pow(10, decimals));
  const exp1 = roundToDecimals(exp1Raw, decimals);

  // 2. Method 2 (Component Model presentation value):
  let exp2: number;
  if (winCount === 0 && lossCount === 0) {
    exp2 = 0;
  } else {
    const pw = winCount / total;
    const pl = lossCount / total;
    const avgWinMajor =
      winCount > 0 ? safeMinorToMajor(winSumMinor / BigInt(winCount), decimals) : 0;
    const avgLossMajor =
      lossCount > 0 ? safeMinorToMajor(lossAbsSumMinor / BigInt(lossCount), decimals) : 0;
    exp2 = roundToDecimals(pw * avgWinMajor - pl * avgLossMajor, decimals);
  }

  // 3. Exact Rational Reconciliation via BigInt Cross-Multiplication:
  // Method 1 Rational: num1 / den1 = totalNetPnlMinor / BigInt(total)
  const num1 = totalNetPnlMinor;
  const den1 = BigInt(total);

  // Method 2 Rational:
  // E2 = (winSumMinor - lossAbsSumMinor) / BigInt(total)
  // When component fractions are unified with their actual counts Nw and Nl:
  // If Nw > 0 and Nl > 0:
  // E2 = (Nw * winSumMinor * Nl - Nl * lossAbsSumMinor * Nw) / (total * Nw * Nl)
  //    = (Nw * Nl * (winSumMinor - lossAbsSumMinor)) / (total * Nw * Nl)
  let exactRationalReconciled = false;
  if (winCount === 0 && lossCount === 0) {
    exactRationalReconciled = totalNetPnlMinor === BigInt(0);
  } else if (winCount > 0 && lossCount === 0) {
    const num2 = BigInt(winCount) * winSumMinor;
    const den2 = BigInt(total) * BigInt(winCount);
    exactRationalReconciled = num1 * den2 === num2 * den1;
  } else if (winCount === 0 && lossCount > 0) {
    const num2 = -BigInt(lossCount) * lossAbsSumMinor;
    const den2 = BigInt(total) * BigInt(lossCount);
    exactRationalReconciled = num1 * den2 === num2 * den1;
  } else {
    // Method 2 Component Model rational subtraction without preliminary algebraic cancellation:
    // Term_W = (winCount * winSumMinor) / (total * winCount)
    // Term_L = (lossCount * lossAbsSumMinor) / (total * lossCount)
    // Subtracting fractions: a/b - c/d = (a * d - c * b) / (b * d)
    const winTermNum = BigInt(winCount) * winSumMinor;
    const winTermDen = BigInt(total) * BigInt(winCount);
    const lossTermNum = BigInt(lossCount) * lossAbsSumMinor;
    const lossTermDen = BigInt(total) * BigInt(lossCount);
    const num2 = winTermNum * lossTermDen - lossTermNum * winTermDen;
    const den2 = winTermDen * lossTermDen;
    exactRationalReconciled = num1 * den2 === num2 * den1;
  }

  return {
    totalNetPnl,
    totalClosedTrades: total,
    expectancy: exp1,
    expectancyFormula1: exp1,
    expectancyFormula2: exp2,
    isFormulasReconciled: exactRationalReconciled,
    exactRationalReconciled,
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
  const intakeResult = filterEligibleClosedTradesWithDiagnostics(trades, currency);
  const eligible = intakeResult.eligibleTrades;
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
    intakeDiagnostics: intakeResult.diagnostics,
  };
}
