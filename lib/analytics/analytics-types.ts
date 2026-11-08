/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * PERFORMANCE ANALYTICS ENGINE — TASK 3.2 & 3.2.1
 * Core Metrics Domain Types & Result Contracts
 */

import type {
  DataQualityTag,
  MarketSession,
  TimeFrame,
  MarketCondition,
} from "../journal-types";

export type AnalyticsSampleStatus =
  | "SUFFICIENT"
  | "LIMITED"
  | "INSUFFICIENT"
  | "NO_DATA";

export type CalculationStatus =
  | "VALID"
  | "NO_DATA"
  | "ZERO_LOSSES"
  | "ZERO_PROFIT"
  | "ALL_BREAKEVEN"
  | "NO_RISK_DATA"
  | "BLOCKED_MULTI_CURRENCY";

export type TradeExclusionReasonCode =
  | "INVALID_STATUS"
  | "INVALID_EXIT_DATE"
  | "INVALID_NET_PNL"
  | "UNSUPPORTED_CURRENCY"
  | "CORRUPT_RECORD";

export interface ExclusionReasonSummary {
  reason: TradeExclusionReasonCode;
  count: number;
  description: string;
}

export interface TradeIntakeDiagnostics {
  totalInputTrades: number;
  eligibleTradesCount: number;
  excludedTradesCount: number;
  excludedReasons: ExclusionReasonSummary[];
}

export interface MetricEnvelope<T> {
  value: T;
  dataQuality: DataQualityTag;
  sampleStatus: AnalyticsSampleStatus;
  calculationStatus: CalculationStatus;
  disclaimer: string;
}

export interface WinRateResult {
  totalClosedTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRateAll: number | null; // (winning / total) * 100
  winRateDecisive: number | null; // (winning / (winning + losing)) * 100
  breakevenRate: number | null; // (breakeven / total) * 100
  calculationStatus: CalculationStatus;
}

export interface AvgWinLossResult {
  winningTrades: number;
  losingTrades: number;
  averageWin: number | null; // Strictly positive major units
  averageLossMagnitude: number | null; // Strictly positive magnitude in major units
  signedAverageLoss: number | null; // Negative or 0 major units
  winLossRatio: number | null; // averageWin / averageLossMagnitude
  calculationStatus: CalculationStatus;
}

export interface ProfitFactorResult {
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  calculationStatus: CalculationStatus;
}

export interface ExpectancyResult {
  totalNetPnl: number;
  totalClosedTrades: number;
  expectancy: number | null; // Per trade major units
  expectancyFormula1: number | null; // Direct aggregate mean: TotalNetPnl / N
  expectancyFormula2: number | null; // Component model: (Pw * AvgWin) - (Pl * AvgLoss)
  isFormulasReconciled: boolean;
  exactRationalReconciled: boolean; // Exact BigInt cross-multiplication parity proof
  calculationStatus: CalculationStatus;
}

export interface RMultipleResult {
  totalTradesRecorded: number;
  rEligibleTradesCount: number; // Only trades where plannedRiskAmount > 0
  excludedTradesCount: number; // Trades where plannedRiskAmount is missing, null, or <= 0
  totalR: number | null;
  averageR: number | null;
  medianR: number | null;
  expectancyR: number | null;
  winRateR: number | null;
  avgWinR: number | null;
  avgLossMagnitudeR: number | null;
  calculationStatus: CalculationStatus;
}

export interface CoreMetricsSummary {
  currency: string;
  currencyDecimals: number;
  totalClosedTrades: number;
  totalNetPnl: number;
  grossProfit: number;
  grossLoss: number;
  winRates: WinRateResult;
  avgWinLoss: AvgWinLossResult;
  profitFactor: ProfitFactorResult;
  expectancy: ExpectancyResult;
  rMultiple: RMultipleResult;
  sampleStatus: AnalyticsSampleStatus;
  dataQualityDistribution: {
    calculatedStandard: number;
    selfReportedManual: number;
    estimatedIncompleteFees: number;
  };
  sampleDisclaimer: string;
  intakeDiagnostics: TradeIntakeDiagnostics;
}

// ── Task 3.3: Drawdown Analytics Domain Types ──────────────────────

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
  drawdownPercentage: number | null; // % (if starting capital provided and valid, unclipped)
}

export interface DrawdownEpoch {
  epochId: string;
  peakIndex: number;
  peakTradeId: string;
  peakDate: string;
  peakCumulativePnl: number; // Major units

  troughIndex: number;
  troughTradeId: string;
  troughDate: string;
  troughCumulativePnl: number; // Major units

  drawdownNominal: number; // Strictly positive magnitude in major units
  drawdownPercentage: number | null; // % unclipped

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
  maxDrawdownPercentage: number | null; // null if starting capital missing/invalid or non-positive denominator

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
  intakeDiagnostics: TradeIntakeDiagnostics;
}

// ── Task 3.3: Time-Series Analytics Domain Types ───────────────────

export type TimeSeriesGranularity = "DAILY" | "WEEKLY" | "MONTHLY";

export type TimeSeriesCalculationStatus =
  | "VALID"
  | "NO_DATA"
  | "INVALID_TIMEZONE"
  | "ZERO_LOSSES"
  | "ZERO_PROFIT"
  | "ALL_BREAKEVEN"
  | "BLOCKED_MULTI_CURRENCY";

export interface TimeSeriesPeriodBucket {
  periodKey: string; // e.g. "2026-11-04", "2026-W45", "2026-11"
  periodStart: string; // ISO-8601 string
  periodEnd: string; // ISO-8601 string
  hasActivity: boolean; // false if dense empty bucket
  tradeCount: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  netPnl: number; // Major currency units
  grossProfit: number; // Major currency units
  grossLoss: number; // Major currency units
  winRate: number | null; // % (or null if tradeCount === 0)
  profitFactor: number | null; // or null if no losses / no trades
  expectancy: number | null; // Per trade major units
}

export interface TimeSeriesOptions {
  granularity?: TimeSeriesGranularity;
  timeZone?: string; // IANA string (e.g. "UTC", "Asia/Jakarta")
  includeEmptyPeriods?: boolean; // Dense range-filling
  startDate?: string; // ISO-8601 start boundary for dense filling
  endDate?: string; // ISO-8601 end boundary for dense filling
  expectedCurrency?: string;
}

export interface TimeSeriesSummaryResult {
  granularity: TimeSeriesGranularity;
  timeZone: string;
  currency: string;
  currencyDecimals: number;
  totalPeriods: number;
  activePeriods: number;
  emptyPeriods: number;
  periods: TimeSeriesPeriodBucket[];
  bestPeriod: TimeSeriesPeriodBucket | null;
  worstPeriod: TimeSeriesPeriodBucket | null;
  calculationStatus: TimeSeriesCalculationStatus;
  intakeDiagnostics: TradeIntakeDiagnostics;
}

// ── Task 3.4: Dimensional Slicer Domain Types ──────────────────────

export type SlicerDimension =
  | "SESSION"
  | "DAY_OF_WEEK"
  | "SYMBOL"
  | "DIRECTION"
  | "SETUP"
  | "STRATEGY"
  | "TIMEFRAME"
  | "MARKET_CONDITION"
  | "EMOTION"
  | "MISTAKE";

export type DayOfWeekKey =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type DimensionalCalculationStatus =
  | "VALID"
  | "NO_DATA"
  | "INVALID_TIMEZONE"
  | "BLOCKED_MULTI_CURRENCY";

export interface DimensionalBucketMetrics {
  dimension: SlicerDimension;
  bucketKey: string;
  bucketLabel: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number | null; // Comprehensive Win Rate (winning / total) * 100
  winRateDecisive: number | null; // Decisive Win Rate (winning / (winning + losing)) * 100
  breakevenRate: number | null;
  totalNetPnl: number;
  grossProfit: number;
  grossLoss: number;
  averageWin: number | null;
  averageLoss: number | null; // Strictly positive magnitude
  signedAverageLoss: number | null;
  winLossRatio: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  averageR: number | null;
  totalR: number | null;
  rEligibleTradesCount: number;
  rMultiple: RMultipleResult;
  sampleStatus: AnalyticsSampleStatus;
  sampleDisclaimer: string;
  calculationStatus: CalculationStatus;
}

export interface DimensionalSlicerOptions {
  timeZone?: string; // IANA string (default "UTC")
  expectedCurrency?: string;
  includeEmptyCanonicalBuckets?: boolean; // If true, includes 0-trade canonical buckets for fixed enums
  dateBasis?: "EXIT_DATE" | "ENTRY_DATE"; // Default "EXIT_DATE"
}

export interface DimensionalSliceResult {
  dimension: SlicerDimension;
  timeZone: string;
  currency: string;
  currencyDecimals: number;
  totalEligibleTrades: number;
  buckets: DimensionalBucketMetrics[];
  calculationStatus: DimensionalCalculationStatus;
  intakeDiagnostics: TradeIntakeDiagnostics;
}

export interface DimensionalSlicerSummaryResult {
  timeZone: string;
  currency: string;
  currencyDecimals: number;
  totalEligibleTrades: number;
  bySession: DimensionalSliceResult;
  byDayOfWeek: DimensionalSliceResult;
  bySymbol: DimensionalSliceResult;
  byDirection: DimensionalSliceResult;
  bySetup: DimensionalSliceResult;
  byStrategy: DimensionalSliceResult;
  byTimeframe: DimensionalSliceResult;
  byMarketCondition: DimensionalSliceResult;
  byEmotion: DimensionalSliceResult;
  byMistake: DimensionalSliceResult;
  calculationStatus: DimensionalCalculationStatus;
  intakeDiagnostics: TradeIntakeDiagnostics;
}

// ── Task 3.5: Analytics Orchestration Domain Types ─────────────────

export interface AnalyticsFilterInput {
  accountId?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  symbol?: string;
  direction?: "LONG" | "SHORT" | "BUY" | "SELL";
  session?: MarketSession;
  dayOfWeek?: DayOfWeekKey;
  setup?: string;
  strategyId?: string;
  timeframe?: TimeFrame;
  marketCondition?: MarketCondition;
  timeZone?: string;
  granularity?: TimeSeriesGranularity;
  includeEmptyPeriods?: boolean;
  includeArchivedAccounts?: boolean;
}

export interface AnalyticsAccountContext {
  accountId: string | null;
  accountName: string | null;
  accountType: string | null;
  currency: string;
  currencyDecimals: number;
  initialBalance: number | null;
  cashBalance: number | null;
  realizedBalance: number | null;
  totalDeposits: number;
  totalWithdrawals: number;
  openTradesCount: number;
  isMultiAccountCohort: boolean;
  accountsAvailable: Array<{
    id: string;
    accountName: string;
    accountCurrency: string;
    accountType: string;
    isArchived: boolean;
    initialBalance: number;
    realizedBalance: number;
  }>;
}

export type AnalyticsOrchestrationStatus =
  | "VALID"
  | "NO_DATA"
  | "INVALID_TIMEZONE"
  | "BLOCKED_MULTI_CURRENCY"
  | "ACCOUNT_NOT_FOUND";

export interface AnalyticsOrchestrationReport {
  status: AnalyticsOrchestrationStatus;
  accountContext: AnalyticsAccountContext;
  currency: string;
  currencyDecimals: number;
  appliedFilters: {
    accountId: string | null;
    currency: string | null;
    startDate: string | null;
    endDate: string | null;
    symbol: string | null;
    direction: "LONG" | "SHORT" | null;
    session: MarketSession | null;
    dayOfWeek: DayOfWeekKey | null;
    setup: string | null;
    strategyId: string | null;
    timeframe: TimeFrame | null;
    marketCondition: MarketCondition | null;
    timeZone: string;
    granularity: TimeSeriesGranularity;
    includeEmptyPeriods: boolean;
  };
  period: {
    startDate: string | null;
    endDate: string | null;
    timeZone: string;
    granularity: TimeSeriesGranularity;
  };
  summary: {
    totalClosedTrades: number;
    totalNetPnl: number;
    winRate: number | null;
    winRateDecisive: number | null;
    profitFactor: number | null;
    expectancy: number | null;
    averageWin: number | null;
    averageLoss: number | null;
    averageR: number | null;
    maxDrawdownNominal: number | null;
    maxDrawdownPercentage: number | null;
    drawdownStatus: DrawdownCalculationStatus;
    sampleStatus: AnalyticsSampleStatus;
  };
  coreMetrics: CoreMetricsSummary;
  drawdown: DrawdownSummaryResult;
  timeSeries: TimeSeriesSummaryResult;
  dimensionalBreakdown: DimensionalSlicerSummaryResult;
  sampleConfidence: {
    status: AnalyticsSampleStatus;
    disclaimer: string;
    eligibleTradesCount: number;
  };
  exclusionDiagnostics: TradeIntakeDiagnostics & {
    filterExcludedCount: number;
  };
  generatedAt: string;
}
