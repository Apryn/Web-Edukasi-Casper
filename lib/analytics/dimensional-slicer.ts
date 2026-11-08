/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * PERFORMANCE ANALYTICS ENGINE — TASK 3.4
 * Dimensional Slicer Analytics Kernel (Pure Functions)
 *
 * Architectural & Mathematical Standards:
 * - Evaluates performance across 10 dimensions: SESSION, DAY_OF_WEEK, SYMBOL, DIRECTION,
 *   SETUP, STRATEGY, TIMEFRAME, MARKET_CONDITION, EMOTION, MISTAKE.
 * - Delegates all bucket calculations directly to Task 3.2 Core Metrics Engine (buildCoreMetricsSummary)
 *   to guarantee zero formula divergence and exact BigInt financial precision.
 * - Enforces strict CLOSED trade eligibility, single-currency cohort isolation, and IANA timezone validation.
 * - Never guesses or fabricates missing historical attributes (e.g., marketCondition -> "UNAVAILABLE").
 * - Applies educational sample size policy per bucket (NO_DATA=0, INSUFFICIENT=1-14, LIMITED=15-29, SUFFICIENT=30+).
 */

import type { TradeRecord } from "../journal-types";
import {
  filterEligibleClosedTradesWithDiagnostics,
  buildCoreMetricsSummary,
  isValidIsoDate,
} from "./core-metrics";
import {
  isValidIanaTimeZone,
  getZonedCalendarDate,
} from "./time-series-metrics";
import type {
  SlicerDimension,
  DayOfWeekKey,
  DimensionalCalculationStatus,
  DimensionalBucketMetrics,
  DimensionalSlicerOptions,
  DimensionalSliceResult,
  DimensionalSlicerSummaryResult,
} from "./analytics-types";

// ── Canonical Dimension Orderings & Display Labels ─────────────────

export const CANONICAL_SESSIONS = [
  "ASIA",
  "LONDON",
  "NEW_YORK",
  "LONDON_NY_OVERLAP",
  "UNSPECIFIED",
] as const;

export const SESSION_LABELS: Record<string, string> = {
  ASIA: "Asia Session",
  LONDON: "London Session",
  NEW_YORK: "New York Session",
  LONDON_NY_OVERLAP: "London / NY Overlap",
  UNSPECIFIED: "Sesi Tidak Tercatat",
};

export const CANONICAL_DAYS_OF_WEEK: DayOfWeekKey[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const DAY_OF_WEEK_LABELS: Record<DayOfWeekKey, string> = {
  MONDAY: "Senin (Monday)",
  TUESDAY: "Selasa (Tuesday)",
  WEDNESDAY: "Rabu (Wednesday)",
  THURSDAY: "Kamis (Thursday)",
  FRIDAY: "Jumat (Friday)",
  SATURDAY: "Sabtu (Saturday)",
  SUNDAY: "Minggu (Sunday)",
};

export const CANONICAL_DIRECTIONS = ["LONG", "SHORT"] as const;

export const DIRECTION_LABELS: Record<string, string> = {
  LONG: "LONG (BUY)",
  SHORT: "SHORT (SELL)",
  UNSPECIFIED: "Arah Tidak Tercatat",
};

export const CANONICAL_TIMEFRAMES = [
  "M1",
  "M5",
  "M15",
  "H1",
  "H4",
  "D1",
  "W1",
  "UNSPECIFIED",
] as const;

export const TIMEFRAME_LABELS: Record<string, string> = {
  M1: "M1 (1 Menit)",
  M5: "M5 (5 Menit)",
  M15: "M15 (15 Menit)",
  H1: "H1 (1 Jam)",
  H4: "H4 (4 Jam)",
  D1: "D1 (Harian)",
  W1: "W1 (Mingguan)",
  UNSPECIFIED: "Timeframe Tidak Tercatat",
};

export const CANONICAL_MARKET_CONDITIONS = [
  "TRENDING_BULL",
  "TRENDING_BEAR",
  "RANGING",
  "HIGH_VOLATILITY",
  "LOW_LIQUIDITY",
  "NEWS_DRIVEN",
  "UNAVAILABLE",
] as const;

export const MARKET_CONDITION_LABELS: Record<string, string> = {
  TRENDING_BULL: "Trending Bullish",
  TRENDING_BEAR: "Trending Bearish",
  RANGING: "Sideways / Ranging",
  HIGH_VOLATILITY: "Volatilitas Tinggi",
  LOW_LIQUIDITY: "Likuiditas Rendah",
  NEWS_DRIVEN: "News / High-Impact Event",
  UNAVAILABLE: "Tidak Tersedia (Belum Dicatat)",
};

export const CANONICAL_EMOTIONS = [
  "DISCIPLINED",
  "CONFIDENT",
  "NEUTRAL",
  "ANXIOUS",
  "FOMO",
  "REVENGE",
  "TIRED",
  "UNSPECIFIED",
] as const;

export const EMOTION_LABELS: Record<string, string> = {
  DISCIPLINED: "Disiplin (Disciplined)",
  CONFIDENT: "Percaya Diri (Confident)",
  NEUTRAL: "Netral (Neutral)",
  ANXIOUS: "Cemas / Ragu (Anxious)",
  FOMO: "Takut Ketinggalan (FOMO)",
  REVENGE: "Balas Dendam (Revenge)",
  TIRED: "Lelah / Kurang Fokus (Tired)",
  UNSPECIFIED: "Emosi Tidak Tercatat",
};

export const CANONICAL_MISTAKES = [
  "NONE",
  "FOMO_ENTRY",
  "CHASING",
  "EARLY_EXIT",
  "WIDENING_SL",
  "OVERLEVERAGING",
  "REVENGE_TRADING",
  "NO_PLAN",
  "UNSPECIFIED",
] as const;

export const MISTAKE_LABELS: Record<string, string> = {
  NONE: "Eksekusi Sesuai Rencana (Tanpa Kesalahan)",
  FOMO_ENTRY: "Entry karena FOMO",
  CHASING: "Mengejar Harga (Chasing Price)",
  EARLY_EXIT: "Menutup Posisi Terlalu Cepat (Early Exit)",
  WIDENING_SL: "Menggeser / Melebarkan Stop Loss",
  OVERLEVERAGING: "Ukuran Lot Berlebihan (Overleveraging)",
  REVENGE_TRADING: "Revenge Trading Pasca Loss",
  NO_PLAN: "Trading Tanpa Rencana (No Plan)",
  UNSPECIFIED: "Evaluasi Kesalahan Tidak Tercatat",
};

// ── Dimension Key Extraction Helpers ───────────────────────────────

/**
 * Computes the ISO Day of Week key ("MONDAY" .. "SUNDAY") for an ISO-8601 timestamp
 * in the specified IANA timezone.
 */
export function getZonedDayOfWeek(isoDateString: string, timeZone: string): DayOfWeekKey {
  const parts = getZonedCalendarDate(isoDateString, timeZone);
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const dayIndex = utcDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const map: Record<number, DayOfWeekKey> = {
    1: "MONDAY",
    2: "TUESDAY",
    3: "WEDNESDAY",
    4: "THURSDAY",
    5: "FRIDAY",
    6: "SATURDAY",
    0: "SUNDAY",
  };
  return map[dayIndex] || "MONDAY";
}

/**
 * Normalizes trade direction string ("LONG", "SHORT", "BUY", "SELL") to canonical bucket key.
 */
export function normalizeDirectionBucketKey(direction: unknown): string {
  if (typeof direction !== "string") return "UNSPECIFIED";
  const upper = direction.trim().toUpperCase();
  if (upper === "LONG" || upper === "BUY") return "LONG";
  if (upper === "SHORT" || upper === "SELL") return "SHORT";
  return "UNSPECIFIED";
}

/**
 * Extracts one or more bucket keys for a trade given the target dimension.
 */
export function extractDimensionKeysForTrade(
  trade: TradeRecord,
  dimension: SlicerDimension,
  timeZone: string,
  dateBasis: "EXIT_DATE" | "ENTRY_DATE" = "EXIT_DATE"
): string[] {
  switch (dimension) {
    case "SESSION": {
      const s = typeof trade.session === "string" ? trade.session.trim().toUpperCase() : "";
      if (
        s === "ASIA" ||
        s === "LONDON" ||
        s === "NEW_YORK" ||
        s === "LONDON_NY_OVERLAP"
      ) {
        return [s];
      }
      return ["UNSPECIFIED"];
    }

    case "DAY_OF_WEEK": {
      const targetDate =
        dateBasis === "ENTRY_DATE" && isValidIsoDate(trade.entryDate)
          ? trade.entryDate
          : (trade.exitDate as string);
      return [getZonedDayOfWeek(targetDate, timeZone)];
    }

    case "SYMBOL": {
      const p = typeof trade.pair === "string" ? trade.pair.trim().toUpperCase() : "";
      return [p.length > 0 ? p : "UNSPECIFIED"];
    }

    case "DIRECTION": {
      return [normalizeDirectionBucketKey(trade.direction)];
    }

    case "SETUP": {
      if (Array.isArray(trade.setupTags) && trade.setupTags.length > 0) {
        const cleaned = Array.from(
          new Set(
            trade.setupTags
              .filter((tag) => typeof tag === "string" && tag.trim().length > 0)
              .map((tag) => tag.trim().toUpperCase())
          )
        );
        if (cleaned.length > 0) return cleaned;
      }
      if (typeof trade.strategyId === "string" && trade.strategyId.trim().length > 0) {
        return [trade.strategyId.trim().toUpperCase()];
      }
      return ["UNSPECIFIED_SETUP"];
    }

    case "STRATEGY": {
      if (typeof trade.strategyId === "string" && trade.strategyId.trim().length > 0) {
        return [trade.strategyId.trim()];
      }
      return ["UNSPECIFIED_STRATEGY"];
    }

    case "TIMEFRAME": {
      const tf = typeof trade.timeframe === "string" ? trade.timeframe.trim().toUpperCase() : "";
      if (
        tf === "M1" ||
        tf === "M5" ||
        tf === "M15" ||
        tf === "H1" ||
        tf === "H4" ||
        tf === "D1" ||
        tf === "W1"
      ) {
        return [tf];
      }
      return ["UNSPECIFIED"];
    }

    case "MARKET_CONDITION": {
      const mc =
        typeof trade.marketCondition === "string"
          ? trade.marketCondition.trim().toUpperCase()
          : "";
      if (
        mc === "TRENDING_BULL" ||
        mc === "TRENDING_BEAR" ||
        mc === "RANGING" ||
        mc === "HIGH_VOLATILITY" ||
        mc === "LOW_LIQUIDITY" ||
        mc === "NEWS_DRIVEN"
      ) {
        return [mc];
      }
      return ["UNAVAILABLE"];
    }

    case "EMOTION": {
      const em = typeof trade.emotion === "string" ? trade.emotion.trim().toUpperCase() : "";
      if (
        em === "CONFIDENT" ||
        em === "NEUTRAL" ||
        em === "ANXIOUS" ||
        em === "FOMO" ||
        em === "REVENGE" ||
        em === "DISCIPLINED" ||
        em === "TIRED"
      ) {
        return [em];
      }
      return ["UNSPECIFIED"];
    }

    case "MISTAKE": {
      const ms = typeof trade.mistake === "string" ? trade.mistake.trim().toUpperCase() : "";
      if (
        ms === "CHASING" ||
        ms === "OVERLEVERAGING" ||
        ms === "EARLY_EXIT" ||
        ms === "WIDENING_SL" ||
        ms === "NO_PLAN" ||
        ms === "REVENGE_TRADING" ||
        ms === "FOMO_ENTRY" ||
        ms === "NONE"
      ) {
        return [ms];
      }
      return ["UNSPECIFIED"];
    }
  }
}

/**
 * Resolves human-readable display label for a dimension bucket key.
 */
export function getDimensionBucketLabel(dimension: SlicerDimension, key: string): string {
  switch (dimension) {
    case "SESSION":
      return SESSION_LABELS[key] || key;
    case "DAY_OF_WEEK":
      return DAY_OF_WEEK_LABELS[key as DayOfWeekKey] || key;
    case "DIRECTION":
      return DIRECTION_LABELS[key] || key;
    case "TIMEFRAME":
      return TIMEFRAME_LABELS[key] || key;
    case "MARKET_CONDITION":
      return MARKET_CONDITION_LABELS[key] || key;
    case "EMOTION":
      return EMOTION_LABELS[key] || key;
    case "MISTAKE":
      return MISTAKE_LABELS[key] || key;
    case "SETUP":
      return key === "UNSPECIFIED_SETUP" ? "Tanpa Label Setup" : key;
    case "STRATEGY":
      return key === "UNSPECIFIED_STRATEGY" ? "Tanpa Strategi Terdaftar" : key;
    case "SYMBOL":
      return key === "UNSPECIFIED" ? "Instrumen Tidak Tercatat" : key;
  }
}

/**
 * Computes metrics for a single dimensional bucket by delegating directly to Task 3.2 Core Metrics.
 */
function buildBucketMetrics(
  dimension: SlicerDimension,
  bucketKey: string,
  bucketTrades: TradeRecord[],
  currency: string,
  decimals: number
): DimensionalBucketMetrics {
  const core = buildCoreMetricsSummary(bucketTrades, currency, decimals);

  let calcStatus = core.expectancy.calculationStatus;
  if (core.totalClosedTrades > 0) {
    if (core.profitFactor.calculationStatus === "ZERO_LOSSES") {
      calcStatus = "ZERO_LOSSES";
    } else if (core.profitFactor.calculationStatus === "ZERO_PROFIT") {
      calcStatus = "ZERO_PROFIT";
    } else if (core.winRates.calculationStatus === "ALL_BREAKEVEN") {
      calcStatus = "ALL_BREAKEVEN";
    } else {
      calcStatus = "VALID";
    }
  } else {
    calcStatus = "NO_DATA";
  }

  return {
    dimension,
    bucketKey,
    bucketLabel: getDimensionBucketLabel(dimension, bucketKey),
    totalTrades: core.totalClosedTrades,
    winningTrades: core.winRates.winningTrades,
    losingTrades: core.winRates.losingTrades,
    breakevenTrades: core.winRates.breakevenTrades,
    winRate: core.winRates.winRateAll,
    winRateDecisive: core.winRates.winRateDecisive,
    breakevenRate: core.winRates.breakevenRate,
    totalNetPnl: core.totalNetPnl,
    grossProfit: core.grossProfit,
    grossLoss: core.grossLoss,
    averageWin: core.avgWinLoss.averageWin,
    averageLoss: core.avgWinLoss.averageLossMagnitude,
    signedAverageLoss: core.avgWinLoss.signedAverageLoss,
    winLossRatio: core.avgWinLoss.winLossRatio,
    profitFactor: core.profitFactor.profitFactor,
    expectancy: core.expectancy.expectancy,
    averageR: core.rMultiple.averageR,
    totalR: core.rMultiple.totalR,
    rEligibleTradesCount: core.rMultiple.rEligibleTradesCount,
    rMultiple: core.rMultiple,
    sampleStatus: core.sampleStatus,
    sampleDisclaimer: core.sampleDisclaimer,
    calculationStatus: calcStatus,
  };
}

/**
 * Deterministically orders bucket keys according to dimension semantics:
 * - Fixed enum dimensions follow their canonical sequence (e.g. Monday..Sunday, M1..W1).
 * - Dynamic dimensions (SYMBOL, SETUP, STRATEGY) sort by totalTrades descending, then bucketKey ascending,
 *   with UNSPECIFIED buckets placed at the end.
 */
function sortDimensionBuckets(
  dimension: SlicerDimension,
  buckets: DimensionalBucketMetrics[]
): DimensionalBucketMetrics[] {
  const canonicalOrderMap: Partial<Record<SlicerDimension, readonly string[]>> = {
    SESSION: CANONICAL_SESSIONS,
    DAY_OF_WEEK: CANONICAL_DAYS_OF_WEEK,
    DIRECTION: [...CANONICAL_DIRECTIONS, "UNSPECIFIED"],
    TIMEFRAME: CANONICAL_TIMEFRAMES,
    MARKET_CONDITION: CANONICAL_MARKET_CONDITIONS,
    EMOTION: CANONICAL_EMOTIONS,
    MISTAKE: CANONICAL_MISTAKES,
  };

  const canonicalList = canonicalOrderMap[dimension];
  if (canonicalList) {
    return [...buckets].sort((a, b) => {
      const idxA = canonicalList.indexOf(a.bucketKey);
      const idxB = canonicalList.indexOf(b.bucketKey);
      const rankA = idxA === -1 ? 999 : idxA;
      const rankB = idxB === -1 ? 999 : idxB;
      if (rankA !== rankB) return rankA - rankB;
      return a.bucketKey.localeCompare(b.bucketKey);
    });
  }

  // Dynamic dimensions: SYMBOL, SETUP, STRATEGY
  return [...buckets].sort((a, b) => {
    const isUnspecA = a.bucketKey.startsWith("UNSPECIFIED");
    const isUnspecB = b.bucketKey.startsWith("UNSPECIFIED");
    if (isUnspecA && !isUnspecB) return 1;
    if (!isUnspecA && isUnspecB) return -1;
    if (b.totalTrades !== a.totalTrades) {
      return b.totalTrades - a.totalTrades;
    }
    return a.bucketKey.localeCompare(b.bucketKey);
  });
}

// ── Public Dimensional Slicer Functions ────────────────────────────

/**
 * Slices a trade population along a single target dimension.
 */
export function calculateDimensionalSlicer(
  trades: TradeRecord[],
  dimension: SlicerDimension,
  decimals: number = 2,
  options: DimensionalSlicerOptions = {}
): DimensionalSliceResult {
  const timeZone = options.timeZone || "UTC";
  const dateBasis = options.dateBasis || "EXIT_DATE";

  // 1. Validate IANA Timezone
  if (!isValidIanaTimeZone(timeZone)) {
    return {
      dimension,
      timeZone,
      currency: options.expectedCurrency || "USD",
      currencyDecimals: decimals,
      totalEligibleTrades: 0,
      buckets: [],
      calculationStatus: "INVALID_TIMEZONE",
      intakeDiagnostics: {
        totalInputTrades: trades?.length || 0,
        eligibleTradesCount: 0,
        excludedTradesCount: trades?.length || 0,
        excludedReasons: [],
      },
    };
  }

  // 2. Filter eligible CLOSED trades with diagnostics
  const { eligibleTrades, diagnostics } = filterEligibleClosedTradesWithDiagnostics(
    trades,
    options.expectedCurrency
  );

  const resolvedCurrency =
    options.expectedCurrency ||
    (eligibleTrades.length > 0
      ? (eligibleTrades[0] as unknown as { currency?: string }).currency || "USD"
      : "USD");

  const hasCurrencyMismatch = diagnostics.excludedReasons.some(
    (r) => r.reason === "UNSUPPORTED_CURRENCY"
  );

  if (eligibleTrades.length === 0) {
    const status: DimensionalCalculationStatus = hasCurrencyMismatch
      ? "BLOCKED_MULTI_CURRENCY"
      : "NO_DATA";

    return {
      dimension,
      timeZone,
      currency: resolvedCurrency,
      currencyDecimals: decimals,
      totalEligibleTrades: 0,
      buckets: [],
      calculationStatus: status,
      intakeDiagnostics: diagnostics,
    };
  }

  // 3. Group trades into dimensional buckets
  const bucketTradesMap = new Map<string, TradeRecord[]>();

  // Pre-seed canonical keys if includeEmptyCanonicalBuckets is enabled
  if (options.includeEmptyCanonicalBuckets) {
    const seedMap: Partial<Record<SlicerDimension, readonly string[]>> = {
      SESSION: ["ASIA", "LONDON", "NEW_YORK", "LONDON_NY_OVERLAP"],
      DAY_OF_WEEK: CANONICAL_DAYS_OF_WEEK,
      DIRECTION: CANONICAL_DIRECTIONS,
      TIMEFRAME: ["M1", "M5", "M15", "H1", "H4", "D1", "W1"],
      MARKET_CONDITION: CANONICAL_MARKET_CONDITIONS,
    };
    const seeds = seedMap[dimension];
    if (seeds) {
      for (const k of seeds) {
        bucketTradesMap.set(k, []);
      }
    }
  }

  for (const trade of eligibleTrades) {
    const keys = extractDimensionKeysForTrade(trade, dimension, timeZone, dateBasis);
    for (const key of keys) {
      const existing = bucketTradesMap.get(key);
      if (existing) {
        existing.push(trade);
      } else {
        bucketTradesMap.set(key, [trade]);
      }
    }
  }

  // 4. Compute metrics per bucket using Task 3.2 engine
  const rawBuckets: DimensionalBucketMetrics[] = [];
  for (const [bucketKey, cohort] of bucketTradesMap.entries()) {
    rawBuckets.push(
      buildBucketMetrics(dimension, bucketKey, cohort, resolvedCurrency, decimals)
    );
  }

  const sortedBuckets = sortDimensionBuckets(dimension, rawBuckets);

  return {
    dimension,
    timeZone,
    currency: resolvedCurrency,
    currencyDecimals: decimals,
    totalEligibleTrades: eligibleTrades.length,
    buckets: sortedBuckets,
    calculationStatus: "VALID",
    intakeDiagnostics: diagnostics,
  };
}

/**
 * Computes all 10 dimensional breakdowns simultaneously for a trade cohort.
 */
export function calculateAllDimensionalSlices(
  trades: TradeRecord[],
  decimals: number = 2,
  options: DimensionalSlicerOptions = {}
): DimensionalSlicerSummaryResult {
  const timeZone = options.timeZone || "UTC";

  const bySession = calculateDimensionalSlicer(trades, "SESSION", decimals, options);
  const byDayOfWeek = calculateDimensionalSlicer(trades, "DAY_OF_WEEK", decimals, options);
  const bySymbol = calculateDimensionalSlicer(trades, "SYMBOL", decimals, options);
  const byDirection = calculateDimensionalSlicer(trades, "DIRECTION", decimals, options);
  const bySetup = calculateDimensionalSlicer(trades, "SETUP", decimals, options);
  const byStrategy = calculateDimensionalSlicer(trades, "STRATEGY", decimals, options);
  const byTimeframe = calculateDimensionalSlicer(trades, "TIMEFRAME", decimals, options);
  const byMarketCondition = calculateDimensionalSlicer(
    trades,
    "MARKET_CONDITION",
    decimals,
    options
  );
  const byEmotion = calculateDimensionalSlicer(trades, "EMOTION", decimals, options);
  const byMistake = calculateDimensionalSlicer(trades, "MISTAKE", decimals, options);

  return {
    timeZone,
    currency: bySession.currency,
    currencyDecimals: decimals,
    totalEligibleTrades: bySession.totalEligibleTrades,
    bySession,
    byDayOfWeek,
    bySymbol,
    byDirection,
    bySetup,
    byStrategy,
    byTimeframe,
    byMarketCondition,
    byEmotion,
    byMistake,
    calculationStatus: bySession.calculationStatus,
    intakeDiagnostics: bySession.intakeDiagnostics,
  };
}

