/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * PERFORMANCE ANALYTICS ENGINE — TASK 3.5
 * Analytics Orchestration Service (Stateless Snapshot Pipeline)
 *
 * Architectural Guarantees:
 * - Single unified entry point integrating Core Metrics (3.2), Drawdown (3.3),
 *   Time-Series (3.3), and Dimensional Slicer (3.4).
 * - Acquires per-user partition read lock ONLY to clone an in-memory snapshot,
 *   releasing the lock immediately before executing calculations.
 * - Zero global cross-user cache; strict tenant & currency isolation.
 * - Identical filter criteria applied once to produce a single canonical trade population
 *   fed to all four analytics engines, guaranteeing 100% metric consistency.
 */

import type {
  TradingAccount,
  TradeRecord,
  CashTransaction,
  UserJournalPartition,
  MarketSession,
  TimeFrame,
  MarketCondition,
} from "../journal-types";
import { getCurrencyDecimals } from "../journal-types";
import { readUserPartitionLocked } from "../journal-storage";
import {
  calculateAccountBalances,
  toMinorUnits,
  toMajorUnits,
} from "../journal-service";
import {
  isValidIsoDate,
  filterEligibleClosedTradesWithDiagnostics,
  buildCoreMetricsSummary,
  evaluateSampleStatus,
} from "./core-metrics";
import { calculateDrawdownMetrics } from "./drawdown-metrics";
import {
  isValidIanaTimeZone,
  getZonedCalendarDate,
  formatPeriodKey,
  calculateTimeSeriesMetrics,
} from "./time-series-metrics";
import {
  getZonedDayOfWeek,
  normalizeDirectionBucketKey,
  calculateAllDimensionalSlices,
} from "./dimensional-slicer";
import type {
  AnalyticsFilterInput,
  AnalyticsAccountContext,
  AnalyticsOrchestrationStatus,
  AnalyticsOrchestrationReport,
  DayOfWeekKey,
  TimeSeriesGranularity,
} from "./analytics-types";

export interface PartitionAnalyticsSnapshot {
  accounts: TradingAccount[];
  trades: TradeRecord[];
  cashTransactions: CashTransaction[];
}

/**
 * Clones only the necessary analytical fields from a UserJournalPartition,
 * stripping out any personal notes/attachments if not needed and ensuring
 * complete detachment from the storage cache reference.
 */
export function clonePartitionForAnalytics(
  partition: UserJournalPartition
): PartitionAnalyticsSnapshot {
  return {
    accounts: Array.isArray(partition.accounts)
      ? partition.accounts.map((a) => ({ ...a }))
      : [],
    trades: Array.isArray(partition.trades)
      ? partition.trades.map((t) => ({
          ...t,
          setupTags: Array.isArray(t.setupTags) ? [...t.setupTags] : [],
        }))
      : [],
    cashTransactions: Array.isArray(partition.cashTransactions)
      ? partition.cashTransactions.map((c) => ({ ...c }))
      : [],
  };
}

/**
 * Checks whether a trade's exitDate falls within the optional startDate and endDate filter bounds.
 * Supports both date-only strings (YYYY-MM-DD evaluated in target IANA timezone)
 * and full ISO-8601 timestamps.
 */
function matchesDateRangeFilter(
  exitDate: string,
  startDate: string | null,
  endDate: string | null,
  timeZone: string
): boolean {
  if (!startDate && !endDate) return true;

  const zonedParts = getZonedCalendarDate(exitDate, timeZone);
  const zonedDateKey = formatPeriodKey(zonedParts, "DAILY"); // "YYYY-MM-DD"
  const exitMs = new Date(exitDate).getTime();

  if (startDate) {
    const trimmedStart = startDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedStart)) {
      if (zonedDateKey < trimmedStart) return false;
    } else {
      const startMs = new Date(trimmedStart).getTime();
      if (!isNaN(startMs) && exitMs < startMs) return false;
    }
  }

  if (endDate) {
    const trimmedEnd = endDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedEnd)) {
      if (zonedDateKey > trimmedEnd) return false;
    } else {
      const endMs = new Date(trimmedEnd).getTime();
      if (!isNaN(endMs) && exitMs > endMs) return false;
    }
  }

  return true;
}

/**
 * Pure, stateless orchestration function operating on a detached snapshot.
 * Never touches filesystem or locks.
 */
export function orchestratePartitionAnalytics(
  snapshot: PartitionAnalyticsSnapshot,
  filterInput: AnalyticsFilterInput = {}
): AnalyticsOrchestrationReport {
  const generatedAt = new Date().toISOString();
  const timeZone = filterInput.timeZone?.trim() || "UTC";
  const granularity: TimeSeriesGranularity =
    filterInput.granularity === "WEEKLY" || filterInput.granularity === "MONTHLY"
      ? filterInput.granularity
      : "DAILY";
  const includeEmptyPeriods = Boolean(filterInput.includeEmptyPeriods);
  const includeArchived = Boolean(filterInput.includeArchivedAccounts);

  const normalizedDirection = filterInput.direction
    ? (normalizeDirectionBucketKey(filterInput.direction) as "LONG" | "SHORT" | "UNSPECIFIED")
    : null;

  const appliedFilters: AnalyticsOrchestrationReport["appliedFilters"] = {
    accountId: filterInput.accountId?.trim() || null,
    currency: filterInput.currency?.trim().toUpperCase() || null,
    startDate: filterInput.startDate?.trim() || null,
    endDate: filterInput.endDate?.trim() || null,
    symbol: filterInput.symbol?.trim().toUpperCase() || null,
    direction:
      normalizedDirection === "LONG" || normalizedDirection === "SHORT"
        ? normalizedDirection
        : null,
    session: (filterInput.session?.trim().toUpperCase() as MarketSession) || null,
    dayOfWeek: (filterInput.dayOfWeek?.trim().toUpperCase() as DayOfWeekKey) || null,
    setup: filterInput.setup?.trim().toUpperCase() || null,
    strategyId: filterInput.strategyId?.trim() || null,
    timeframe: (filterInput.timeframe?.trim().toUpperCase() as TimeFrame) || null,
    marketCondition:
      (filterInput.marketCondition?.trim().toUpperCase() as MarketCondition) || null,
    timeZone,
    granularity,
    includeEmptyPeriods,
  };

  const accountsAvailable = (snapshot.accounts || []).map((a) => {
    const bal = calculateAccountBalances(
      a,
      snapshot.cashTransactions || [],
      snapshot.trades || []
    );
    return {
      id: a.id,
      accountName: a.accountName,
      accountCurrency: a.accountCurrency,
      accountType: a.accountType,
      isArchived: a.isArchived,
      initialBalance: bal.initialBalance,
      realizedBalance: bal.realizedBalance,
    };
  });

  // 1. Validate Timezone Gate
  if (!isValidIanaTimeZone(timeZone)) {
    const fallbackCurrency = appliedFilters.currency || "USD";
    const fallbackDecimals = getCurrencyDecimals(fallbackCurrency);
    const emptyCore = buildCoreMetricsSummary([], fallbackCurrency, fallbackDecimals);
    const emptyDD = calculateDrawdownMetrics([], fallbackDecimals, null, fallbackCurrency);
    const emptyTS = calculateTimeSeriesMetrics([], fallbackDecimals, {
      granularity,
      timeZone,
      expectedCurrency: fallbackCurrency,
    });
    const emptyDim = calculateAllDimensionalSlices([], fallbackDecimals, {
      timeZone,
      expectedCurrency: fallbackCurrency,
    });

    return {
      status: "INVALID_TIMEZONE",
      accountContext: {
        accountId: appliedFilters.accountId,
        accountName: null,
        accountType: null,
        currency: fallbackCurrency,
        currencyDecimals: fallbackDecimals,
        initialBalance: null,
        cashBalance: null,
        realizedBalance: null,
        totalDeposits: 0,
        totalWithdrawals: 0,
        openTradesCount: 0,
        isMultiAccountCohort: false,
        accountsAvailable,
      },
      currency: fallbackCurrency,
      currencyDecimals: fallbackDecimals,
      appliedFilters,
      period: {
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
        timeZone,
        granularity,
      },
      summary: {
        totalClosedTrades: 0,
        totalNetPnl: 0,
        winRate: null,
        winRateDecisive: null,
        profitFactor: null,
        expectancy: null,
        averageWin: null,
        averageLoss: null,
        averageR: null,
        maxDrawdownNominal: null,
        maxDrawdownPercentage: null,
        drawdownStatus: "NO_DATA",
        sampleStatus: "NO_DATA",
      },
      coreMetrics: emptyCore,
      drawdown: emptyDD,
      timeSeries: emptyTS,
      dimensionalBreakdown: emptyDim,
      sampleConfidence: {
        status: "NO_DATA",
        disclaimer: "Timezone IANA tidak valid.",
        eligibleTradesCount: 0,
      },
      exclusionDiagnostics: {
        totalInputTrades: 0,
        eligibleTradesCount: 0,
        excludedTradesCount: 0,
        excludedReasons: [],
        filterExcludedCount: 0,
      },
      generatedAt,
    };
  }

  // 2. Resolve Account Cohort & Currency Isolation
  let scopedAccounts: TradingAccount[] = [];
  const allAccounts = snapshot.accounts || [];

  if (appliedFilters.accountId) {
    const found = allAccounts.find((a) => a.id === appliedFilters.accountId);
    if (!found) {
      const fallbackCurrency = appliedFilters.currency || "USD";
      const fallbackDecimals = getCurrencyDecimals(fallbackCurrency);
      const emptyCore = buildCoreMetricsSummary([], fallbackCurrency, fallbackDecimals);
      const emptyDD = calculateDrawdownMetrics([], fallbackDecimals, null, fallbackCurrency);
      const emptyTS = calculateTimeSeriesMetrics([], fallbackDecimals, {
        granularity,
        timeZone,
        expectedCurrency: fallbackCurrency,
      });
      const emptyDim = calculateAllDimensionalSlices([], fallbackDecimals, {
        timeZone,
        expectedCurrency: fallbackCurrency,
      });

      return {
        status: "ACCOUNT_NOT_FOUND",
        accountContext: {
          accountId: appliedFilters.accountId,
          accountName: null,
          accountType: null,
          currency: fallbackCurrency,
          currencyDecimals: fallbackDecimals,
          initialBalance: null,
          cashBalance: null,
          realizedBalance: null,
          totalDeposits: 0,
          totalWithdrawals: 0,
          openTradesCount: 0,
          isMultiAccountCohort: false,
          accountsAvailable,
        },
        currency: fallbackCurrency,
        currencyDecimals: fallbackDecimals,
        appliedFilters,
        period: {
          startDate: appliedFilters.startDate,
          endDate: appliedFilters.endDate,
          timeZone,
          granularity,
        },
        summary: {
          totalClosedTrades: 0,
          totalNetPnl: 0,
          winRate: null,
          winRateDecisive: null,
          profitFactor: null,
          expectancy: null,
          averageWin: null,
          averageLoss: null,
          averageR: null,
          maxDrawdownNominal: null,
          maxDrawdownPercentage: null,
          drawdownStatus: "NO_DATA",
          sampleStatus: "NO_DATA",
        },
        coreMetrics: emptyCore,
        drawdown: emptyDD,
        timeSeries: emptyTS,
        dimensionalBreakdown: emptyDim,
        sampleConfidence: {
          status: "NO_DATA",
          disclaimer: "Akun trading yang diminta tidak ditemukan.",
          eligibleTradesCount: 0,
        },
        exclusionDiagnostics: {
          totalInputTrades: 0,
          eligibleTradesCount: 0,
          excludedTradesCount: 0,
          excludedReasons: [],
          filterExcludedCount: 0,
        },
        generatedAt,
      };
    }
    scopedAccounts = [found];
  } else {
    scopedAccounts = allAccounts.filter((a) => includeArchived || !a.isArchived);
    if (appliedFilters.currency) {
      scopedAccounts = scopedAccounts.filter(
        (a) => a.accountCurrency.toUpperCase() === appliedFilters.currency
      );
    }
  }

  // Check currency homogeneity across scoped accounts
  const distinctAccountCurrencies = Array.from(
    new Set(scopedAccounts.map((a) => a.accountCurrency.toUpperCase()))
  );

  // Also check if trades exist without accounts (e.g. raw synthetic test snapshots)
  const accountCurrencyById = new Map<string, string>();
  for (const acc of allAccounts) {
    accountCurrencyById.set(acc.id, acc.accountCurrency.toUpperCase());
  }

  if (distinctAccountCurrencies.length > 1) {
    // Mixed currency accounts without explicit currency or accountId filter!
    const primaryCurrency = distinctAccountCurrencies[0];
    const primaryDecimals = getCurrencyDecimals(primaryCurrency);
    const emptyCore = buildCoreMetricsSummary([], primaryCurrency, primaryDecimals);
    const emptyDD = calculateDrawdownMetrics([], primaryDecimals, null, primaryCurrency);
    const emptyTS = calculateTimeSeriesMetrics([], primaryDecimals, {
      granularity,
      timeZone,
      expectedCurrency: primaryCurrency,
    });
    const emptyDim = calculateAllDimensionalSlices([], primaryDecimals, {
      timeZone,
      expectedCurrency: primaryCurrency,
    });

    return {
      status: "BLOCKED_MULTI_CURRENCY",
      accountContext: {
        accountId: null,
        accountName: null,
        accountType: null,
        currency: "MULTI",
        currencyDecimals: 2,
        initialBalance: null,
        cashBalance: null,
        realizedBalance: null,
        totalDeposits: 0,
        totalWithdrawals: 0,
        openTradesCount: 0,
        isMultiAccountCohort: true,
        accountsAvailable,
      },
      currency: "MULTI",
      currencyDecimals: 2,
      appliedFilters,
      period: {
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
        timeZone,
        granularity,
      },
      summary: {
        totalClosedTrades: 0,
        totalNetPnl: 0,
        winRate: null,
        winRateDecisive: null,
        profitFactor: null,
        expectancy: null,
        averageWin: null,
        averageLoss: null,
        averageR: null,
        maxDrawdownNominal: null,
        maxDrawdownPercentage: null,
        drawdownStatus: "BLOCKED_MULTI_CURRENCY",
        sampleStatus: "NO_DATA",
      },
      coreMetrics: emptyCore,
      drawdown: emptyDD,
      timeSeries: emptyTS,
      dimensionalBreakdown: emptyDim,
      sampleConfidence: {
        status: "NO_DATA",
        disclaimer:
          "Akun dengan mata uang berbeda (misal USD dan IDR) tidak dapat digabungkan tanpa memilih filter akun atau mata uang spesifik.",
        eligibleTradesCount: 0,
      },
      exclusionDiagnostics: {
        totalInputTrades: snapshot.trades.length,
        eligibleTradesCount: 0,
        excludedTradesCount: snapshot.trades.length,
        excludedReasons: [
          {
            reason: "UNSUPPORTED_CURRENCY",
            count: snapshot.trades.length,
            description:
              "Terdapat beberapa akun dengan mata uang berbeda. Pilih satu akun atau satu mata uang untuk melihat analitik.",
          },
        ],
        filterExcludedCount: 0,
      },
      generatedAt,
    };
  }

  const resolvedCurrency =
    distinctAccountCurrencies[0] ||
    appliedFilters.currency ||
    (snapshot.trades.length > 0
      ? ((snapshot.trades[0] as unknown as { currency?: string }).currency || "USD").toUpperCase()
      : "USD");
  const decimals =
    scopedAccounts[0]?.currencyDecimals ?? getCurrencyDecimals(resolvedCurrency);

  // 3. Build Account Context & Starting Capital
  let initialBalanceMinor = BigInt(0);
  let cashBalanceMinor = BigInt(0);
  let realizedBalanceMinor = BigInt(0);
  let totalDepositsMinor = BigInt(0);
  let totalWithdrawalsMinor = BigInt(0);
  let openTradesCount = 0;

  for (const acc of scopedAccounts) {
    const bal = calculateAccountBalances(
      acc,
      snapshot.cashTransactions || [],
      snapshot.trades || []
    );
    initialBalanceMinor += toMinorUnits(bal.initialBalance, decimals);
    cashBalanceMinor += toMinorUnits(bal.cashBalance, decimals);
    realizedBalanceMinor += toMinorUnits(bal.realizedBalance, decimals);
    totalDepositsMinor += toMinorUnits(bal.totalDeposits, decimals);
    totalWithdrawalsMinor += toMinorUnits(bal.totalWithdrawals, decimals);
    openTradesCount += bal.openTradesCount;
  }

  const hasAccounts = scopedAccounts.length > 0;
  const startingCapital = hasAccounts
    ? toMajorUnits(initialBalanceMinor, decimals)
    : null;

  const accountContext: AnalyticsAccountContext = {
    accountId: scopedAccounts.length === 1 ? scopedAccounts[0].id : appliedFilters.accountId,
    accountName: scopedAccounts.length === 1 ? scopedAccounts[0].accountName : null,
    accountType: scopedAccounts.length === 1 ? scopedAccounts[0].accountType : null,
    currency: resolvedCurrency,
    currencyDecimals: decimals,
    initialBalance: hasAccounts ? toMajorUnits(initialBalanceMinor, decimals) : null,
    cashBalance: hasAccounts ? toMajorUnits(cashBalanceMinor, decimals) : null,
    realizedBalance: hasAccounts ? toMajorUnits(realizedBalanceMinor, decimals) : null,
    totalDeposits: hasAccounts ? toMajorUnits(totalDepositsMinor, decimals) : 0,
    totalWithdrawals: hasAccounts ? toMajorUnits(totalWithdrawalsMinor, decimals) : 0,
    openTradesCount,
    isMultiAccountCohort: scopedAccounts.length > 1,
    accountsAvailable,
  };

  // 4. Scope Trades to Selected Account(s) & Attach Currency Tag
  const scopedAccountIds = new Set(scopedAccounts.map((a) => a.id));
  const rawScopedTrades: TradeRecord[] = [];

  for (const tr of snapshot.trades || []) {
    if (!tr || typeof tr !== "object") {
      rawScopedTrades.push(tr);
      continue;
    }
    if (appliedFilters.accountId && tr.accountId !== appliedFilters.accountId) {
      continue;
    }
    if (!appliedFilters.accountId && allAccounts.length > 0) {
      if (!scopedAccountIds.has(tr.accountId)) {
        continue;
      }
    }
    const trCurr =
      (tr as unknown as { currency?: string }).currency ||
      accountCurrencyById.get(tr.accountId) ||
      resolvedCurrency;
    rawScopedTrades.push({
      ...tr,
      currency: trCurr,
    } as TradeRecord);
  }

  // 5. Run Intake Filter & Diagnostics
  const { eligibleTrades, diagnostics: baseDiagnostics } =
    filterEligibleClosedTradesWithDiagnostics(rawScopedTrades, resolvedCurrency);

  // Check if all trades were blocked due to currency mismatch
  const hasCurrencyMismatch = baseDiagnostics.excludedReasons.some(
    (r) => r.reason === "UNSUPPORTED_CURRENCY"
  );

  // 6. Apply User Dimensional & Date Range Filters Consistently
  const filteredTrades = eligibleTrades.filter((trade) => {
    if (
      !matchesDateRangeFilter(
        trade.exitDate as string,
        appliedFilters.startDate,
        appliedFilters.endDate,
        timeZone
      )
    ) {
      return false;
    }

    if (
      appliedFilters.symbol &&
      (trade.pair || "").trim().toUpperCase() !== appliedFilters.symbol
    ) {
      return false;
    }

    if (
      appliedFilters.direction &&
      normalizeDirectionBucketKey(trade.direction) !== appliedFilters.direction
    ) {
      return false;
    }

    if (
      appliedFilters.session &&
      (trade.session || "").trim().toUpperCase() !== appliedFilters.session
    ) {
      return false;
    }

    if (
      appliedFilters.dayOfWeek &&
      getZonedDayOfWeek(trade.exitDate as string, timeZone) !== appliedFilters.dayOfWeek
    ) {
      return false;
    }

    if (appliedFilters.setup) {
      const targetSetup = appliedFilters.setup;
      const inTags =
        Array.isArray(trade.setupTags) &&
        trade.setupTags.some((t) => (t || "").trim().toUpperCase() === targetSetup);
      const inStrat =
        (trade.strategyId || "").trim().toUpperCase() === targetSetup;
      if (!inTags && !inStrat) return false;
    }

    if (
      appliedFilters.strategyId &&
      (trade.strategyId || "").trim().toLowerCase() !==
        appliedFilters.strategyId.toLowerCase()
    ) {
      return false;
    }

    if (
      appliedFilters.timeframe &&
      (trade.timeframe || "").trim().toUpperCase() !== appliedFilters.timeframe
    ) {
      return false;
    }

    if (appliedFilters.marketCondition) {
      const mc = (trade.marketCondition || "UNAVAILABLE").trim().toUpperCase();
      if (mc !== appliedFilters.marketCondition) return false;
    }

    return true;
  });

  const filterExcludedCount = eligibleTrades.length - filteredTrades.length;

  // 7. Execute All Four Pure Engines on the Exact Same Filtered Cohort
  const coreMetrics = buildCoreMetricsSummary(filteredTrades, resolvedCurrency, decimals);
  // Preserve full account intake diagnostics in coreMetrics and report
  coreMetrics.intakeDiagnostics = baseDiagnostics;

  const drawdown = calculateDrawdownMetrics(
    filteredTrades,
    decimals,
    startingCapital,
    resolvedCurrency
  );
  drawdown.intakeDiagnostics = baseDiagnostics;

  const timeSeries = calculateTimeSeriesMetrics(filteredTrades, decimals, {
    granularity,
    timeZone,
    includeEmptyPeriods,
    startDate:
      appliedFilters.startDate && isValidIsoDate(appliedFilters.startDate)
        ? appliedFilters.startDate
        : undefined,
    endDate:
      appliedFilters.endDate && isValidIsoDate(appliedFilters.endDate)
        ? appliedFilters.endDate
        : undefined,
    expectedCurrency: resolvedCurrency,
  });
  timeSeries.intakeDiagnostics = baseDiagnostics;

  const dimensionalBreakdown = calculateAllDimensionalSlices(filteredTrades, decimals, {
    timeZone,
    expectedCurrency: resolvedCurrency,
  });
  dimensionalBreakdown.intakeDiagnostics = baseDiagnostics;

  const sampleInfo = evaluateSampleStatus(filteredTrades.length);

  let reportStatus: AnalyticsOrchestrationStatus = "VALID";
  if (filteredTrades.length === 0) {
    reportStatus = hasCurrencyMismatch ? "BLOCKED_MULTI_CURRENCY" : "NO_DATA";
  }

  return {
    status: reportStatus,
    accountContext,
    currency: resolvedCurrency,
    currencyDecimals: decimals,
    appliedFilters,
    period: {
      startDate: appliedFilters.startDate,
      endDate: appliedFilters.endDate,
      timeZone,
      granularity,
    },
    summary: {
      totalClosedTrades: coreMetrics.totalClosedTrades,
      totalNetPnl: coreMetrics.totalNetPnl,
      winRate: coreMetrics.winRates.winRateAll,
      winRateDecisive: coreMetrics.winRates.winRateDecisive,
      profitFactor: coreMetrics.profitFactor.profitFactor,
      expectancy: coreMetrics.expectancy.expectancy,
      averageWin: coreMetrics.avgWinLoss.averageWin,
      averageLoss: coreMetrics.avgWinLoss.averageLossMagnitude,
      averageR: coreMetrics.rMultiple.averageR,
      maxDrawdownNominal: drawdown.maxDrawdownNominal,
      maxDrawdownPercentage: drawdown.maxDrawdownPercentage,
      drawdownStatus: drawdown.calculationStatus,
      sampleStatus: sampleInfo.status,
    },
    coreMetrics,
    drawdown,
    timeSeries,
    dimensionalBreakdown,
    sampleConfidence: {
      status: sampleInfo.status,
      disclaimer: sampleInfo.disclaimer,
      eligibleTradesCount: filteredTrades.length,
    },
    exclusionDiagnostics: {
      ...baseDiagnostics,
      filterExcludedCount,
    },
    generatedAt,
  };
}

/**
 * Primary asynchronous service entry point for retrieving a student's analytics report.
 * Acquires the per-user partition read lock ONLY long enough to clone the snapshot,
 * then releases the lock immediately and computes all analytics outside the lock.
 */
export async function getStudentAnalyticsReport(
  userId: string,
  filterInput: AnalyticsFilterInput = {}
): Promise<AnalyticsOrchestrationReport> {
  // Stage 1: Acquire per-user read lock & clone snapshot
  const partition = await readUserPartitionLocked(userId);
  const detachedSnapshot = clonePartitionForAnalytics(partition);
  // Lock is already released when readUserPartitionLocked resolves!

  // Stage 2: Stateless computation outside lock
  return orchestratePartitionAnalytics(detachedSnapshot, filterInput);
}

