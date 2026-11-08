/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * PERFORMANCE ANALYTICS ENGINE — TASK 3.3
 * Time-Series Metrics Calculation Kernel (Pure Functions)
 *
 * Mathematical & Architectural Standards:
 * - Deterministic calendar bucketing: DAILY (YYYY-MM-DD), WEEKLY (ISO-8601 YYYY-Www), MONTHLY (YYYY-MM).
 * - Explicit IANA timezone handling via Intl.DateTimeFormat with "UTC" as absolute default.
 * - Zero reliance on or leakage of Node.js server local time.
 * - Cumulative realized trading Net P/L only (eligible CLOSED trades).
 * - Cash transactions (DEPOSIT/WITHDRAWAL) strictly isolated from trading performance.
 * - Volume aggregation excluded to eliminate heterogeneous unit mixing across asset classes.
 * - Sparse mode (default) and Dense mode (range-filling with hasActivity: false).
 * - Per-period Expectancy and Profit Factor calculated via exact BigInt arithmetic.
 */

import type { TradeRecord } from "../journal-types";
import {
  toMinorUnits,
  toMajorUnits,
  roundToDecimals,
} from "../journal-service";
import {
  isValidIsoDate,
  filterEligibleClosedTradesWithDiagnostics,
} from "./core-metrics";
import type {
  TimeSeriesGranularity,
  TimeSeriesCalculationStatus,
  TimeSeriesPeriodBucket,
  TimeSeriesOptions,
  TimeSeriesSummaryResult,
} from "./analytics-types";

// ── Timezone & Calendar Helpers ────────────────────────────────────

/**
 * Validates whether a given timezone string conforms to a valid IANA timezone identifier.
 */
export function isValidIanaTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== "string" || timeZone.trim().length === 0) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

interface ZonedCalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  isoYear: number;
  isoWeek: number; // 1-53
}

/**
 * Extracts calendar date parts projected into the target IANA timezone.
 * Uses pure Intl.DateTimeFormat without any dependency on server local time.
 */
export function getZonedCalendarDate(isoDateString: string, timeZone: string): ZonedCalendarDate {
  const date = new Date(isoDateString);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  let year = 1970;
  let month = 1;
  let day = 1;

  for (const p of parts) {
    if (p.type === "year") year = parseInt(p.value, 10);
    else if (p.type === "month") month = parseInt(p.value, 10);
    else if (p.type === "day") day = parseInt(p.value, 10);
  }

  // Calculate ISO-8601 Week (Monday=1, Sunday=7)
  // Create a UTC date representing midnight of the zoned Y-M-D to perform pure calendar math
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utcDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // 1=Mon ... 7=Sun

  // ISO week is determined by the Thursday of the current week
  const thursday = new Date(Date.UTC(year, month - 1, day + (4 - isoDayOfWeek)));
  const isoYear = thursday.getUTCFullYear();

  // First day of ISO year is the Monday of the week containing the first Thursday of the year
  const firstThursdayOfYear = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursdayDayOfWeek = firstThursdayOfYear.getUTCDay() || 7;
  const firstMondayOfYear = new Date(
    Date.UTC(isoYear, 0, 4 - (firstThursdayDayOfWeek - 1))
  );

  const diffMs = thursday.getTime() - firstMondayOfYear.getTime();
  const isoWeek = 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

  return { year, month, day, isoYear, isoWeek };
}

/**
 * Formats a period key based on granularity and zoned date parts.
 */
export function formatPeriodKey(
  parts: ZonedCalendarDate,
  granularity: TimeSeriesGranularity
): string {
  const pad2 = (n: number) => n.toString().padStart(2, "0");
  switch (granularity) {
    case "DAILY":
      return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
    case "WEEKLY":
      return `${parts.isoYear}-W${pad2(parts.isoWeek)}`;
    case "MONTHLY":
      return `${parts.year}-${pad2(parts.month)}`;
  }
}

/**
 * Returns ISO-8601 start and end string representations for a period key.
 */
function getPeriodBoundaries(
  periodKey: string,
  granularity: TimeSeriesGranularity
): { periodStart: string; periodEnd: string } {
  switch (granularity) {
    case "DAILY": {
      return {
        periodStart: `${periodKey}T00:00:00.000Z`,
        periodEnd: `${periodKey}T23:59:59.999Z`,
      };
    }
    case "WEEKLY": {
      // periodKey: "YYYY-Www"
      const [yearStr, weekStr] = periodKey.split("-W");
      const year = parseInt(yearStr, 10);
      const week = parseInt(weekStr, 10);

      // Find the Monday of ISO week
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7;
      const week1Monday = new Date(Date.UTC(year, 0, 4 - (jan4Day - 1)));
      const targetMonday = new Date(
        week1Monday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000
      );
      const targetSunday = new Date(
        targetMonday.getTime() + (7 * 24 * 60 * 60 * 1000 - 1)
      );

      return {
        periodStart: targetMonday.toISOString(),
        periodEnd: targetSunday.toISOString(),
      };
    }
    case "MONTHLY": {
      // periodKey: "YYYY-MM"
      const [yearStr, monthStr] = periodKey.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      // End of month: day 0 of next month
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

      return {
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      };
    }
  }
}

/**
 * Generates contiguous period keys between two dates for dense range-filling.
 */
function generateContiguousPeriodKeys(
  startDateStr: string,
  endDateStr: string,
  granularity: TimeSeriesGranularity,
  timeZone: string
): string[] {
  const startParts = getZonedCalendarDate(startDateStr, timeZone);
  const endParts = getZonedCalendarDate(endDateStr, timeZone);

  const startKey = formatPeriodKey(startParts, granularity);
  const endKey = formatPeriodKey(endParts, granularity);

  const keys: string[] = [];
  const pad2 = (n: number) => n.toString().padStart(2, "0");

  if (granularity === "DAILY") {
    const cur = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
    const end = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day));
    while (cur <= end) {
      const y = cur.getUTCFullYear();
      const m = pad2(cur.getUTCMonth() + 1);
      const d = pad2(cur.getUTCDate());
      keys.push(`${y}-${m}-${d}`);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  } else if (granularity === "MONTHLY") {
    let y = startParts.year;
    let m = startParts.month;
    const endY = endParts.year;
    const endM = endParts.month;
    while (y < endY || (y === endY && m <= endM)) {
      keys.push(`${y}-${pad2(m)}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  } else if (granularity === "WEEKLY") {
    // Increment week by week from start Monday
    const [startYearStr, startWeekStr] = startKey.split("-W");
    const [endYearStr, endWeekStr] = endKey.split("-W");

    let currentYear = parseInt(startYearStr, 10);
    let currentWeek = parseInt(startWeekStr, 10);
    const targetYear = parseInt(endYearStr, 10);
    const targetWeek = parseInt(endWeekStr, 10);

    while (
      currentYear < targetYear ||
      (currentYear === targetYear && currentWeek <= targetWeek)
    ) {
      keys.push(`${currentYear}-W${pad2(currentWeek)}`);

      // Determine max weeks in currentYear
      // A year has 53 weeks if Dec 28 falls in week 53
      const dec28 = new Date(Date.UTC(currentYear, 11, 28));
      const dec28Parts = getZonedCalendarDate(dec28.toISOString(), "UTC");
      const maxWeeks = dec28Parts.isoWeek;

      currentWeek++;
      if (currentWeek > maxWeeks) {
        currentWeek = 1;
        currentYear++;
      }
    }
  }

  return keys;
}

// ── Time-Series Metrics Engine ─────────────────────────────────────

/**
 * Calculates calendar-aggregated Time-Series Metrics across closed trades.
 *
 * @param trades Array of raw or pre-filtered trade records.
 * @param decimals Currency decimals (default 2 for USD).
 * @param options TimeSeriesOptions configuring granularity, timezone, dense mode, etc.
 */
export function calculateTimeSeriesMetrics(
  trades: TradeRecord[],
  decimals: number = 2,
  options: TimeSeriesOptions = {}
): TimeSeriesSummaryResult {
  const granularity: TimeSeriesGranularity = options.granularity || "DAILY";
  const timeZone: string = options.timeZone || "UTC";

  // 1. Timezone validation gate
  if (!isValidIanaTimeZone(timeZone)) {
    return {
      granularity,
      timeZone,
      currency: options.expectedCurrency || "USD",
      currencyDecimals: decimals,
      totalPeriods: 0,
      activePeriods: 0,
      emptyPeriods: 0,
      periods: [],
      bestPeriod: null,
      worstPeriod: null,
      calculationStatus: "INVALID_TIMEZONE",
      intakeDiagnostics: {
        totalInputTrades: trades?.length || 0,
        eligibleTradesCount: 0,
        excludedTradesCount: trades?.length || 0,
        excludedReasons: [],
      },
    };
  }

  // 2. Intake filtering with diagnostics
  const { eligibleTrades, diagnostics } =
    filterEligibleClosedTradesWithDiagnostics(trades, options.expectedCurrency);

  const resolvedCurrency =
    options.expectedCurrency ||
    (eligibleTrades.length > 0
      ? (eligibleTrades[0] as unknown as { currency?: string }).currency || "USD"
      : "USD");

  const hasCurrencyMismatch = diagnostics.excludedReasons.some(
    (r) => r.reason === "UNSUPPORTED_CURRENCY"
  );

  if (eligibleTrades.length === 0) {
    const status: TimeSeriesCalculationStatus = hasCurrencyMismatch
      ? "BLOCKED_MULTI_CURRENCY"
      : "NO_DATA";

    return {
      granularity,
      timeZone,
      currency: resolvedCurrency,
      currencyDecimals: decimals,
      totalPeriods: 0,
      activePeriods: 0,
      emptyPeriods: 0,
      periods: [],
      bestPeriod: null,
      worstPeriod: null,
      calculationStatus: status,
      intakeDiagnostics: diagnostics,
    };
  }

  // 3. Group eligible trades by target period key
  interface PeriodBucketAcc {
    periodKey: string;
    tradeCount: number;
    winningTrades: number;
    losingTrades: number;
    breakEvenTrades: number;
    netPnlMinor: bigint;
    grossProfitMinor: bigint;
    grossLossMinor: bigint;
  }

  const bucketsMap = new Map<string, PeriodBucketAcc>();

  for (const trade of eligibleTrades) {
    const exitDate = trade.exitDate as string;
    const zonedParts = getZonedCalendarDate(exitDate, timeZone);
    const key = formatPeriodKey(zonedParts, granularity);

    let bucket = bucketsMap.get(key);
    if (!bucket) {
      bucket = {
        periodKey: key,
        tradeCount: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakEvenTrades: 0,
        netPnlMinor: BigInt(0),
        grossProfitMinor: BigInt(0),
        grossLossMinor: BigInt(0),
      };
      bucketsMap.set(key, bucket);
    }

    bucket.tradeCount++;
    const pnl = trade.netPnl as number;
    const pnlMinor = toMinorUnits(pnl, decimals);
    bucket.netPnlMinor += pnlMinor;

    if (pnl > 0) {
      bucket.winningTrades++;
      bucket.grossProfitMinor += pnlMinor;
    } else if (pnl < 0) {
      bucket.losingTrades++;
      bucket.grossLossMinor += -pnlMinor;
    } else {
      bucket.breakEvenTrades++;
    }
  }

  // 4. Determine period keys to render (Sparse vs. Dense)
  let orderedKeys: string[] = [];

  if (options.includeEmptyPeriods) {
    // Dense mode requires boundaries
    const sortedTradesDates = eligibleTrades
      .map((t) => t.exitDate as string)
      .sort((a, b) => a.localeCompare(b));

    const effectiveStart =
      options.startDate && isValidIsoDate(options.startDate)
        ? options.startDate
        : sortedTradesDates[0];

    const effectiveEnd =
      options.endDate && isValidIsoDate(options.endDate)
        ? options.endDate
        : sortedTradesDates[sortedTradesDates.length - 1];

    orderedKeys = generateContiguousPeriodKeys(
      effectiveStart,
      effectiveEnd,
      granularity,
      timeZone
    );
  } else {
    // Sparse mode: only periods with trade activity
    orderedKeys = Array.from(bucketsMap.keys()).sort((a, b) => a.localeCompare(b));
  }

  // 5. Build final TimeSeriesPeriodBucket objects
  const periodBuckets: TimeSeriesPeriodBucket[] = [];
  let bestPeriod: TimeSeriesPeriodBucket | null = null;
  let worstPeriod: TimeSeriesPeriodBucket | null = null;

  let activePeriodsCount = 0;
  let emptyPeriodsCount = 0;

  for (const key of orderedKeys) {
    const boundaries = getPeriodBoundaries(key, granularity);
    const data = bucketsMap.get(key);

    if (data && data.tradeCount > 0) {
      activePeriodsCount++;

      const netPnl = toMajorUnits(data.netPnlMinor, decimals);
      const grossProfit = toMajorUnits(data.grossProfitMinor, decimals);
      const grossLoss = toMajorUnits(data.grossLossMinor, decimals);

      // Win Rate: (winning / total) * 100
      const winRate = roundToDecimals((data.winningTrades / data.tradeCount) * 100, 2);

      // Profit Factor: scaled BigInt quotient (safe against overflow)
      let profitFactor: number | null = null;
      if (data.grossLossMinor === BigInt(0)) {
        profitFactor = null; // ZERO_LOSSES / undefined ratio
      } else {
        const scaledQuotient =
          (data.grossProfitMinor * BigInt(10000) + data.grossLossMinor / BigInt(2)) /
          data.grossLossMinor;
        profitFactor = Number(scaledQuotient) / 10000;
      }

      // Expectancy: netPnl / tradeCount
      const expectancy = roundToDecimals(netPnl / data.tradeCount, decimals);

      const bucketObj: TimeSeriesPeriodBucket = {
        periodKey: key,
        periodStart: boundaries.periodStart,
        periodEnd: boundaries.periodEnd,
        hasActivity: true,
        tradeCount: data.tradeCount,
        winningTrades: data.winningTrades,
        losingTrades: data.losingTrades,
        breakEvenTrades: data.breakEvenTrades,
        netPnl,
        grossProfit,
        grossLoss,
        winRate,
        profitFactor,
        expectancy,
      };

      periodBuckets.push(bucketObj);

      // Update best / worst
      if (!bestPeriod || bucketObj.netPnl > bestPeriod.netPnl) {
        bestPeriod = bucketObj;
      }
      if (!worstPeriod || bucketObj.netPnl < worstPeriod.netPnl) {
        worstPeriod = bucketObj;
      }
    } else {
      // Empty dense bucket
      emptyPeriodsCount++;
      const emptyBucket: TimeSeriesPeriodBucket = {
        periodKey: key,
        periodStart: boundaries.periodStart,
        periodEnd: boundaries.periodEnd,
        hasActivity: false,
        tradeCount: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakEvenTrades: 0,
        netPnl: 0.0,
        grossProfit: 0.0,
        grossLoss: 0.0,
        winRate: null,
        profitFactor: null,
        expectancy: null,
      };
      periodBuckets.push(emptyBucket);
    }
  }

  // 6. Global Calculation Status
  let calculationStatus: TimeSeriesCalculationStatus = "VALID";
  if (activePeriodsCount === 0) {
    calculationStatus = "NO_DATA";
  }

  return {
    granularity,
    timeZone,
    currency: resolvedCurrency,
    currencyDecimals: decimals,
    totalPeriods: periodBuckets.length,
    activePeriods: activePeriodsCount,
    emptyPeriods: emptyPeriodsCount,
    periods: periodBuckets,
    bestPeriod,
    worstPeriod,
    calculationStatus,
    intakeDiagnostics: diagnostics,
  };
}

