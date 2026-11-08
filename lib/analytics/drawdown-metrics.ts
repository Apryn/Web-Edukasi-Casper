/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * PERFORMANCE ANALYTICS ENGINE — TASK 3.3
 * Drawdown Metrics Calculation Kernel (Pure Functions)
 *
 * Mathematical & Architectural Standards:
 * - Deterministic sequence ordering: exitDate ascending, id ascending tie-breaker.
 * - Cumulative realized trading Net P/L only (eligible CLOSED trades).
 * - Cash transactions (DEPOSIT/WITHDRAWAL) strictly isolated from trading performance.
 * - Initial peak anchored at zero (Peak_0 = 0).
 * - Exact integer arithmetic via BigInt minor units.
 * - Tri-state capital governance: AVAILABLE, UNAVAILABLE_BASE_CAPITAL, CAPITAL_DEPLETED.
 * - Strict No-Clipping Rule: DrawdownPercentage is NOT capped at 100.0%.
 * - Complete epoch lifecycle tracking: Peak -> Trough -> Recovery.
 */

import type { TradeRecord } from "../journal-types";
import {
  toMinorUnits,
  toMajorUnits,
  roundToDecimals,
} from "../journal-service";
import {
  filterEligibleClosedTradesWithDiagnostics,
} from "./core-metrics";
import type {
  DrawdownCalculationStatus,
  DrawdownCurvePoint,
  DrawdownEpoch,
  DrawdownSummaryResult,
} from "./analytics-types";

/**
 * Deterministically sorts trades in chronological execution sequence.
 * Primary key: exitDate ascending (ISO-8601 string sort).
 * Secondary key: id ascending (locale-independent UUID tie-breaker).
 * Pure function: does not mutate the input array.
 */
export function sortTradesDeterministically(trades: TradeRecord[]): TradeRecord[] {
  return [...trades].sort((a, b) => {
    const aDate = a.exitDate || "";
    const bDate = b.exitDate || "";
    const dateComp = aDate.localeCompare(bDate);
    if (dateComp !== 0) return dateComp;
    const aId = a.id || "";
    const bId = b.id || "";
    return aId.localeCompare(bId);
  });
}

/**
 * Calculates comprehensive Trade Performance Drawdown metrics.
 *
 * @param trades Array of raw or pre-filtered trade records.
 * @param decimals Currency decimals (default 2 for USD).
 * @param startingCapital Optional baseline starting capital (TradingAccount.initialBalance).
 * @param expectedCurrency Optional ISO 4217 currency code to enforce currency cohort.
 */
export function calculateDrawdownMetrics(
  trades: TradeRecord[],
  decimals: number = 2,
  startingCapital?: number | null,
  expectedCurrency?: string
): DrawdownSummaryResult {
  // 1. Intake filtering with diagnostics
  const { eligibleTrades, diagnostics } =
    filterEligibleClosedTradesWithDiagnostics(trades, expectedCurrency);

  // Determine fallback currency
  const resolvedCurrency =
    expectedCurrency ||
    (eligibleTrades.length > 0
      ? (eligibleTrades[0] as unknown as { currency?: string }).currency || "USD"
      : "USD");

  // Check for multi-currency blockage in diagnostics
  const hasCurrencyMismatch = diagnostics.excludedReasons.some(
    (r) => r.reason === "UNSUPPORTED_CURRENCY"
  );

  // If no eligible trades exist, return early with appropriate status
  if (eligibleTrades.length === 0) {
    const status: DrawdownCalculationStatus = hasCurrencyMismatch
      ? "BLOCKED_MULTI_CURRENCY"
      : "NO_DATA";

    return {
      currency: resolvedCurrency,
      currencyDecimals: decimals,
      totalClosedTrades: 0,
      maxDrawdownNominal: null,
      maxDrawdownPercentage: null,
      currentDrawdownNominal: null,
      currentDrawdownPercentage: null,
      maxDrawdownEpoch: null,
      activeDrawdownEpoch: null,
      curvePoints: [],
      allEpochs: [],
      calculationStatus: status,
      intakeDiagnostics: diagnostics,
    };
  }

  // 2. Deterministic total ordering
  const sortedTrades = sortTradesDeterministically(eligibleTrades);
  const N = sortedTrades.length;

  // 3. Base capital validation
  const hasValidStartingCapital =
    typeof startingCapital === "number" &&
    Number.isFinite(startingCapital) &&
    startingCapital > 0;

  const baseCapitalMinor = hasValidStartingCapital
    ? toMinorUnits(startingCapital, decimals)
    : BigInt(0);

  // 4. State tracking variables for cumulative trajectory & epochs
  let cumulativeMinor = BigInt(0);
  let peakMinor = BigInt(0); // Peak_0 = 0n
  let maxDrawdownMinor = BigInt(0);

  let isCapitalDepleted = false;

  const curvePoints: DrawdownCurvePoint[] = [];
  const allEpochs: DrawdownEpoch[] = [];

  // Active epoch tracking
  let activeEpoch: {
    epochId: string;
    peakIndex: number;
    peakTradeId: string;
    peakDate: string;
    peakCumulativeMinor: bigint;
    peakCapitalMinor: bigint; // baseCapitalMinor + peakCumulativeMinor

    troughIndex: number;
    troughTradeId: string;
    troughDate: string;
    troughCumulativeMinor: bigint;
    drawdownMinor: bigint;
    drawdownPct: number | null;
  } | null = null;

  let epochCounter = 0;

  // 5. Main Trajectory Calculation Loop
  for (let i = 0; i < N; i++) {
    const trade = sortedTrades[i];
    const tradeIndex = i + 1; // 1-based index
    const tradeId = trade.id || `TRADE-${tradeIndex}`;
    const exitDate = trade.exitDate || "";
    const pnlMinor = toMinorUnits(trade.netPnl as number, decimals);

    cumulativeMinor += pnlMinor;

    const previousPeakMinor = peakMinor;
    if (cumulativeMinor > peakMinor) {
      peakMinor = cumulativeMinor;
    }

    const currentDrawdownMinor = peakMinor - cumulativeMinor; // strictly >= 0n

    if (currentDrawdownMinor > maxDrawdownMinor) {
      maxDrawdownMinor = currentDrawdownMinor;
    }

    // Capital equity evaluations for percentage calculation
    let stepDrawdownPct: number | null = null;

    if (hasValidStartingCapital) {
      const equityPeakMinor = baseCapitalMinor + peakMinor;
      const equityTroughMinor = baseCapitalMinor + cumulativeMinor;

      // Check capital depletion condition (trough equity <= 0)
      if (equityTroughMinor <= BigInt(0)) {
        isCapitalDepleted = true;
      }

      if (equityPeakMinor > BigInt(0)) {
        // DrawdownPercentage = (DrawdownAmount / EquityPeak) * 100 (Unclipped)
        const ddAmountNum = Number(currentDrawdownMinor);
        const eqPeakNum = Number(equityPeakMinor);
        const rawPct = (ddAmountNum / eqPeakNum) * 100;
        stepDrawdownPct = roundToDecimals(rawPct, 2);
      } else {
        stepDrawdownPct = null; // non-positive denominator
      }
    }

    // Record curve point
    curvePoints.push({
      tradeIndex,
      tradeId,
      exitDate,
      tradeNetPnl: toMajorUnits(pnlMinor, decimals),
      cumulativeNetPnl: toMajorUnits(cumulativeMinor, decimals),
      highWaterMark: toMajorUnits(peakMinor, decimals),
      drawdownNominal: toMajorUnits(currentDrawdownMinor, decimals),
      drawdownPercentage: stepDrawdownPct,
    });

    // ── Epoch Management ──────────────────────────────────────────
    if (currentDrawdownMinor > BigInt(0)) {
      if (!activeEpoch) {
        // A new drawdown epoch begins
        epochCounter++;

        // Determine peak anchor:
        // If previous peak was 0n, peak was established at ORIGIN (before Trade 1)
        const isFromOrigin = previousPeakMinor === BigInt(0);
        let peakTradeId = "ORIGIN";
        let peakDate = sortedTrades[0].entryDate || sortedTrades[0].exitDate || "";
        let peakIndex = 0;

        if (!isFromOrigin) {
          // Find the trade that established previousPeakMinor
          for (let p = i - 1; p >= 0; p--) {
            const pCum = curvePoints[p].cumulativeNetPnl;
            const pCumMinor = toMinorUnits(pCum, decimals);
            if (pCumMinor === previousPeakMinor) {
              peakTradeId = sortedTrades[p].id || `TRADE-${p + 1}`;
              peakDate = sortedTrades[p].exitDate || "";
              peakIndex = p + 1;
              break;
            }
          }
        }

        activeEpoch = {
          epochId: `EPOCH-${epochCounter}`,
          peakIndex,
          peakTradeId,
          peakDate,
          peakCumulativeMinor: previousPeakMinor,
          peakCapitalMinor: baseCapitalMinor + previousPeakMinor,
          troughIndex: tradeIndex,
          troughTradeId: tradeId,
          troughDate: exitDate,
          troughCumulativeMinor: cumulativeMinor,
          drawdownMinor: currentDrawdownMinor,
          drawdownPct: stepDrawdownPct,
        };
      } else {
        // Inside an ongoing drawdown epoch: check if trough deepens
        if (currentDrawdownMinor > activeEpoch.drawdownMinor) {
          // Trough deepens
          activeEpoch.troughIndex = tradeIndex;
          activeEpoch.troughTradeId = tradeId;
          activeEpoch.troughDate = exitDate;
          activeEpoch.troughCumulativeMinor = cumulativeMinor;
          activeEpoch.drawdownMinor = currentDrawdownMinor;
          activeEpoch.drawdownPct = stepDrawdownPct;
        }
        // If currentDrawdownMinor <= activeEpoch.drawdownMinor:
        // Trough remains at the earliest occurrence per tie-breaker rule.
      }
    } else {
      // currentDrawdownMinor === 0n: Cumulative curve has matched or exceeded high-water mark
      if (activeEpoch) {
        // Complete recovery of the active epoch
        const peakDateMs = new Date(activeEpoch.peakDate).getTime();
        const recoveryDateMs = new Date(exitDate).getTime();
        const calendarDurationSeconds =
          !isNaN(peakDateMs) && !isNaN(recoveryDateMs)
            ? Math.max(0, Math.round((recoveryDateMs - peakDateMs) / 1000))
            : null;

        const troughDurationTrades =
          activeEpoch.troughIndex - activeEpoch.peakIndex;
        const recoveryDurationTrades =
          tradeIndex - activeEpoch.troughIndex;
        const totalDurationTrades =
          tradeIndex - activeEpoch.peakIndex;

        allEpochs.push({
          epochId: activeEpoch.epochId,
          peakIndex: activeEpoch.peakIndex,
          peakTradeId: activeEpoch.peakTradeId,
          peakDate: activeEpoch.peakDate,
          peakCumulativePnl: toMajorUnits(
            activeEpoch.peakCumulativeMinor,
            decimals
          ),
          troughIndex: activeEpoch.troughIndex,
          troughTradeId: activeEpoch.troughTradeId,
          troughDate: activeEpoch.troughDate,
          troughCumulativePnl: toMajorUnits(
            activeEpoch.troughCumulativeMinor,
            decimals
          ),
          drawdownNominal: toMajorUnits(activeEpoch.drawdownMinor, decimals),
          drawdownPercentage: activeEpoch.drawdownPct,
          recoveryIndex: tradeIndex,
          recoveryTradeId: tradeId,
          recoveryDate: exitDate,
          isRecovered: true,
          troughDurationTrades,
          recoveryDurationTrades,
          totalDurationTrades,
          calendarDurationSeconds,
        });

        activeEpoch = null;
      }
    }
  }

  // Handle active epoch that did not recover by the end of dataset
  let activeEpochResult: DrawdownEpoch | null = null;
  if (activeEpoch) {
    const troughDurationTrades =
      activeEpoch.troughIndex - activeEpoch.peakIndex;

    activeEpochResult = {
      epochId: activeEpoch.epochId,
      peakIndex: activeEpoch.peakIndex,
      peakTradeId: activeEpoch.peakTradeId,
      peakDate: activeEpoch.peakDate,
      peakCumulativePnl: toMajorUnits(
        activeEpoch.peakCumulativeMinor,
        decimals
      ),
      troughIndex: activeEpoch.troughIndex,
      troughTradeId: activeEpoch.troughTradeId,
      troughDate: activeEpoch.troughDate,
      troughCumulativePnl: toMajorUnits(
        activeEpoch.troughCumulativeMinor,
        decimals
      ),
      drawdownNominal: toMajorUnits(activeEpoch.drawdownMinor, decimals),
      drawdownPercentage: activeEpoch.drawdownPct,
      recoveryIndex: null,
      recoveryTradeId: null,
      recoveryDate: null,
      isRecovered: false,
      troughDurationTrades,
      recoveryDurationTrades: null,
      totalDurationTrades: null,
      calendarDurationSeconds: null,
    };

    allEpochs.push(activeEpochResult);
  }

  // 6. Zero Losses / Breakeven Evaluation
  const isZeroLosses = maxDrawdownMinor === BigInt(0);

  // 7. Max Drawdown Epoch Identification
  let maxDrawdownEpoch: DrawdownEpoch | null = null;
  if (!isZeroLosses && allEpochs.length > 0) {
    // Find epoch with maximum nominal drawdown; earliest epoch wins ties
    let maxEpochDDMinor = BigInt(-1);
    for (const ep of allEpochs) {
      const epDDMinor = toMinorUnits(ep.drawdownNominal, decimals);
      if (epDDMinor > maxEpochDDMinor) {
        maxEpochDDMinor = epDDMinor;
        maxDrawdownEpoch = ep;
      }
    }
  }

  // 8. Max Drawdown Percentage Calculation
  let maxDrawdownPercentage: number | null = null;
  if (hasValidStartingCapital) {
    if (isZeroLosses) {
      maxDrawdownPercentage = 0.0;
    } else {
      // Find maximum drawdown percentage across all curve points to guarantee exact unclipped peak
      let maxPct = 0.0;
      let hasValidPct = false;
      for (const pt of curvePoints) {
        if (pt.drawdownPercentage !== null) {
          hasValidPct = true;
          if (pt.drawdownPercentage > maxPct) {
            maxPct = pt.drawdownPercentage;
          }
        }
      }
      maxDrawdownPercentage = hasValidPct ? maxPct : null;
    }
  }

  // 9. Current Active Drawdown Metrics
  const lastCurvePoint = curvePoints[curvePoints.length - 1];
  const currentDrawdownNominal = isZeroLosses
    ? 0.0
    : lastCurvePoint.drawdownNominal;
  const currentDrawdownPercentage = isZeroLosses
    ? (hasValidStartingCapital ? 0.0 : null)
    : lastCurvePoint.drawdownPercentage;

  // 10. Status Determination
  let calculationStatus: DrawdownCalculationStatus;
  if (isZeroLosses) {
    calculationStatus = "ZERO_LOSSES";
  } else if (!hasValidStartingCapital) {
    calculationStatus = "UNAVAILABLE_BASE_CAPITAL";
  } else if (isCapitalDepleted) {
    calculationStatus = "CAPITAL_DEPLETED";
  } else {
    calculationStatus = "AVAILABLE";
  }

  return {
    currency: resolvedCurrency,
    currencyDecimals: decimals,
    totalClosedTrades: N,
    maxDrawdownNominal: isZeroLosses
      ? 0.0
      : toMajorUnits(maxDrawdownMinor, decimals),
    maxDrawdownPercentage,
    currentDrawdownNominal,
    currentDrawdownPercentage,
    maxDrawdownEpoch,
    activeDrawdownEpoch: activeEpochResult,
    curvePoints,
    allEpochs,
    calculationStatus,
    intakeDiagnostics: diagnostics,
  };
}
