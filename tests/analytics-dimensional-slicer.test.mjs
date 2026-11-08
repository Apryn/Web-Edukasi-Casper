import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

let tsHook = null;
if (typeof registerHooks === "function" && typeof stripTypeScriptTypes === "function") {
  tsHook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        !path.extname(specifier) &&
        context.parentURL
      ) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        const candidateTs = path.resolve(parentDir, `${specifier}.ts`);
        if (fs.existsSync(candidateTs)) {
          return nextResolve(`${specifier}.ts`, context);
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.endsWith(".ts")) {
        const source = fs.readFileSync(fileURLToPath(url), "utf8");
        return {
          format: "module",
          shortCircuit: true,
          source: stripTypeScriptTypes(source),
        };
      }
      return nextLoad(url, context);
    },
  });
}

const {
  calculateDimensionalSlicer,
  calculateAllDimensionalSlices,
  getZonedDayOfWeek,
  normalizeDirectionBucketKey,
} = await import("../lib/analytics/dimensional-slicer.ts");

const {
  buildCoreMetricsSummary,
} = await import("../lib/analytics/core-metrics.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

function makeClosedTrade(overrides = {}) {
  return {
    id: overrides.id || "trd-1",
    userId: "user-1",
    accountId: "acc-1",
    pair: overrides.pair ?? "XAUUSD",
    direction: overrides.direction ?? "LONG",
    status: overrides.status ?? "CLOSED",
    entryDate: overrides.entryDate ?? "2026-11-02T08:00:00.000Z",
    exitDate: overrides.exitDate ?? "2026-11-02T10:00:00.000Z",
    timeframe: overrides.timeframe ?? "H1",
    session: overrides.session ?? "LONDON",
    entryPrice: 2000,
    exitPrice: 2010,
    stopLoss: 1990,
    takeProfit: 2020,
    positionSize: 1,
    plannedRiskAmount: overrides.plannedRiskAmount !== undefined ? overrides.plannedRiskAmount : 100,
    grossPnl: overrides.netPnl ?? 200,
    commission: 0,
    swap: 0,
    otherFees: 0,
    netPnl: overrides.netPnl !== undefined ? overrides.netPnl : 200,
    outcome: (overrides.netPnl ?? 200) > 0 ? "WIN" : (overrides.netPnl ?? 200) < 0 ? "LOSS" : "BREAKEVEN",
    strategyId: overrides.strategyId,
    setupTags: overrides.setupTags ?? ["BREAKOUT"],
    entryChecklist: {},
    emotion: overrides.emotion ?? "DISCIPLINED",
    mistake: overrides.mistake ?? "NONE",
    marketCondition: overrides.marketCondition,
    notes: "",
    attachments: [],
    dataQuality: "SELF_REPORTED_MANUAL",
    createdAt: "2026-11-02T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
    ...(overrides.currency ? { currency: overrides.currency } : {}),
  };
}

describe("PAE Task 3.4 — Dimensional Slicer Analytics Engine Suite", () => {
  test("DS-01: Empty trade array returns NO_DATA and empty buckets across all dimensions", () => {
    const summary = calculateAllDimensionalSlices([], 2);
    assert.equal(summary.calculationStatus, "NO_DATA");
    assert.equal(summary.totalEligibleTrades, 0);
    assert.equal(summary.bySession.buckets.length, 0);
    assert.equal(summary.byDayOfWeek.buckets.length, 0);
    assert.equal(summary.bySymbol.buckets.length, 0);
    assert.equal(summary.byDirection.buckets.length, 0);
    assert.equal(summary.bySetup.buckets.length, 0);
    assert.equal(summary.byTimeframe.buckets.length, 0);
    assert.equal(summary.byMarketCondition.buckets.length, 0);
  });

  test("DS-02: Session dimension groups ASIA, LONDON, NEW_YORK, LONDON_NY_OVERLAP in canonical order", () => {
    const trades = [
      makeClosedTrade({ id: "t1", session: "NEW_YORK", netPnl: 300, plannedRiskAmount: 100 }),
      makeClosedTrade({ id: "t2", session: "ASIA", netPnl: -100, plannedRiskAmount: 100 }),
      makeClosedTrade({ id: "t3", session: "LONDON", netPnl: 200, plannedRiskAmount: 100 }),
      makeClosedTrade({ id: "t4", session: "LONDON_NY_OVERLAP", netPnl: 400, plannedRiskAmount: 100 }),
      makeClosedTrade({ id: "t5", session: "LONDON", netPnl: -50, plannedRiskAmount: 100 }),
    ];

    const res = calculateDimensionalSlicer(trades, "SESSION", 2);
    assert.equal(res.calculationStatus, "VALID");
    assert.equal(res.totalEligibleTrades, 5);
    assert.deepEqual(
      res.buckets.map((b) => b.bucketKey),
      ["ASIA", "LONDON", "NEW_YORK", "LONDON_NY_OVERLAP"]
    );

    const london = res.buckets.find((b) => b.bucketKey === "LONDON");
    assert.equal(london.totalTrades, 2);
    assert.equal(london.winningTrades, 1);
    assert.equal(london.losingTrades, 1);
    assert.equal(london.totalNetPnl, 150);
    assert.equal(london.winRate, 50);
    assert.equal(london.profitFactor, 4);
    assert.equal(london.expectancy, 75);
    assert.equal(london.averageR, 0.75);
  });

  test("DS-03: Day of Week dimension respects IANA timezone boundary and canonical Monday..Sunday order", () => {
    // 2026-11-01T23:30:00Z is Sunday in UTC, but Monday (2026-11-02 06:30) in Asia/Jakarta (UTC+7)
    const trades = [
      makeClosedTrade({
        id: "t-sun-utc",
        exitDate: "2026-11-01T23:30:00.000Z",
        netPnl: 250,
      }),
      makeClosedTrade({
        id: "t-wed-utc",
        exitDate: "2026-11-04T12:00:00.000Z",
        netPnl: -100,
      }),
    ];

    const utcRes = calculateDimensionalSlicer(trades, "DAY_OF_WEEK", 2, {
      timeZone: "UTC",
    });
    assert.deepEqual(
      utcRes.buckets.map((b) => b.bucketKey),
      ["WEDNESDAY", "SUNDAY"]
    );

    const jktRes = calculateDimensionalSlicer(trades, "DAY_OF_WEEK", 2, {
      timeZone: "Asia/Jakarta",
    });
    assert.deepEqual(
      jktRes.buckets.map((b) => b.bucketKey),
      ["MONDAY", "WEDNESDAY"]
    );
  });

  test("DS-04: Invalid IANA timezone returns INVALID_TIMEZONE status", () => {
    const trades = [makeClosedTrade()];
    const res = calculateDimensionalSlicer(trades, "DAY_OF_WEEK", 2, {
      timeZone: "Invalid/Zone_Name",
    });
    assert.equal(res.calculationStatus, "INVALID_TIMEZONE");
    assert.equal(res.buckets.length, 0);
  });

  test("DS-05: Direction dimension normalizes BUY/LONG and SELL/SHORT accurately", () => {
    const trades = [
      makeClosedTrade({ id: "t1", direction: "LONG", netPnl: 150 }),
      makeClosedTrade({ id: "t2", direction: "BUY", netPnl: 250 }),
      makeClosedTrade({ id: "t3", direction: "SHORT", netPnl: -100 }),
      makeClosedTrade({ id: "t4", direction: "SELL", netPnl: 300 }),
    ];

    assert.equal(normalizeDirectionBucketKey("BUY"), "LONG");
    assert.equal(normalizeDirectionBucketKey("SELL"), "SHORT");

    const res = calculateDimensionalSlicer(trades, "DIRECTION", 2);
    assert.deepEqual(
      res.buckets.map((b) => b.bucketKey),
      ["LONG", "SHORT"]
    );
    assert.equal(res.buckets[0].totalTrades, 2);
    assert.equal(res.buckets[0].totalNetPnl, 400);
    assert.equal(res.buckets[1].totalTrades, 2);
    assert.equal(res.buckets[1].totalNetPnl, 200);
  });

  test("DS-06: Symbol dimension normalizes case and sorts deterministically by trade count then alphabetically", () => {
    const trades = [
      makeClosedTrade({ id: "t1", pair: "eurusd", netPnl: 100 }),
      makeClosedTrade({ id: "t2", pair: "XAUUSD", netPnl: 200 }),
      makeClosedTrade({ id: "t3", pair: "xauusd ", netPnl: -50 }),
      makeClosedTrade({ id: "t4", pair: "BTCUSD", netPnl: 300 }),
    ];

    const res = calculateDimensionalSlicer(trades, "SYMBOL", 2);
    // XAUUSD has 2 trades; BTCUSD and EURUSD have 1 trade each (alphabetical tie-breaker)
    assert.deepEqual(
      res.buckets.map((b) => b.bucketKey),
      ["XAUUSD", "BTCUSD", "EURUSD"]
    );
    assert.equal(res.buckets[0].totalNetPnl, 150);
  });

  test("DS-07: Setup & Strategy dimensions handle multi-tag attribution and UNSPECIFIED fallback", () => {
    const trades = [
      makeClosedTrade({
        id: "t1",
        setupTags: ["FVG", "ORDER_BLOCK"],
        strategyId: "ICT_SILVER_BULLET",
        netPnl: 200,
      }),
      makeClosedTrade({
        id: "t2",
        setupTags: ["FVG"],
        strategyId: "ICT_SILVER_BULLET",
        netPnl: -50,
      }),
      makeClosedTrade({
        id: "t3",
        setupTags: [],
        strategyId: undefined,
        netPnl: 100,
      }),
    ];

    const setupRes = calculateDimensionalSlicer(trades, "SETUP", 2);
    // FVG (2 trades), ORDER_BLOCK (1 trade), UNSPECIFIED_SETUP (1 trade, placed last)
    assert.deepEqual(
      setupRes.buckets.map((b) => b.bucketKey),
      ["FVG", "ORDER_BLOCK", "UNSPECIFIED_SETUP"]
    );
    assert.equal(setupRes.buckets[0].totalTrades, 2);
    assert.equal(setupRes.buckets[0].totalNetPnl, 150);

    const stratRes = calculateDimensionalSlicer(trades, "STRATEGY", 2);
    assert.deepEqual(
      stratRes.buckets.map((b) => b.bucketKey),
      ["ICT_SILVER_BULLET", "UNSPECIFIED_STRATEGY"]
    );
  });

  test("DS-08: Timeframe & Market Condition dimensions preserve canonical order and never fabricate missing data", () => {
    const trades = [
      makeClosedTrade({ id: "t1", timeframe: "H4", marketCondition: "TRENDING_BULL", netPnl: 300 }),
      makeClosedTrade({ id: "t2", timeframe: "M15", marketCondition: undefined, netPnl: -100 }),
      makeClosedTrade({ id: "t3", timeframe: "M5", marketCondition: "RANGING", netPnl: 50 }),
    ];

    const tfRes = calculateDimensionalSlicer(trades, "TIMEFRAME", 2);
    assert.deepEqual(
      tfRes.buckets.map((b) => b.bucketKey),
      ["M5", "M15", "H4"]
    );

    const mcRes = calculateDimensionalSlicer(trades, "MARKET_CONDITION", 2);
    assert.deepEqual(
      mcRes.buckets.map((b) => b.bucketKey),
      ["TRENDING_BULL", "RANGING", "UNAVAILABLE"]
    );
    const unavail = mcRes.buckets.find((b) => b.bucketKey === "UNAVAILABLE");
    assert.equal(unavail.totalTrades, 1);
    assert.equal(unavail.totalNetPnl, -100);
  });

  test("DS-09: Sample Size Policy per bucket (INSUFFICIENT 1-14, LIMITED 15-29, SUFFICIENT 30+)", () => {
    const trades = [];
    // 30 trades in LONDON, 18 trades in NEW_YORK, 5 trades in ASIA
    for (let i = 0; i < 30; i++) {
      trades.push(makeClosedTrade({ id: `lon-${i}`, session: "LONDON", netPnl: 10 }));
    }
    for (let i = 0; i < 18; i++) {
      trades.push(makeClosedTrade({ id: `ny-${i}`, session: "NEW_YORK", netPnl: 10 }));
    }
    for (let i = 0; i < 5; i++) {
      trades.push(makeClosedTrade({ id: `asia-${i}`, session: "ASIA", netPnl: 10 }));
    }

    const res = calculateDimensionalSlicer(trades, "SESSION", 2);
    const asia = res.buckets.find((b) => b.bucketKey === "ASIA");
    const london = res.buckets.find((b) => b.bucketKey === "LONDON");
    const ny = res.buckets.find((b) => b.bucketKey === "NEW_YORK");

    assert.equal(asia.sampleStatus, "INSUFFICIENT");
    assert.equal(ny.sampleStatus, "LIMITED");
    assert.equal(london.sampleStatus, "SUFFICIENT");
  });

  test("DS-10: Exact formula parity between Dimensional Slicer bucket and Task 3.2 Core Metrics", () => {
    const londonTrades = [
      makeClosedTrade({ id: "l1", session: "LONDON", netPnl: 245.55, plannedRiskAmount: 100 }),
      makeClosedTrade({ id: "l2", session: "LONDON", netPnl: -80.25, plannedRiskAmount: 100 }),
      makeClosedTrade({ id: "l3", session: "LONDON", netPnl: 0, plannedRiskAmount: 50 }),
      makeClosedTrade({ id: "l4", session: "LONDON", netPnl: 110.10, plannedRiskAmount: 0 }),
    ];

    const directCore = buildCoreMetricsSummary(londonTrades, "USD", 2);
    const sliced = calculateDimensionalSlicer(londonTrades, "SESSION", 2, {
      expectedCurrency: "USD",
    });
    const bucket = sliced.buckets[0];

    assert.equal(bucket.totalTrades, directCore.totalClosedTrades);
    assert.equal(bucket.totalNetPnl, directCore.totalNetPnl);
    assert.equal(bucket.winRate, directCore.winRates.winRateAll);
    assert.equal(bucket.winRateDecisive, directCore.winRates.winRateDecisive);
    assert.equal(bucket.averageWin, directCore.avgWinLoss.averageWin);
    assert.equal(bucket.averageLoss, directCore.avgWinLoss.averageLossMagnitude);
    assert.equal(bucket.profitFactor, directCore.profitFactor.profitFactor);
    assert.equal(bucket.expectancy, directCore.expectancy.expectancy);
    assert.equal(bucket.averageR, directCore.rMultiple.averageR);
  });

  test("DS-11: Exclusion diagnostics for OPEN trades, invalid dates, and currency mismatch", () => {
    const trades = [
      makeClosedTrade({ id: "t1", status: "OPEN", netPnl: 500 }),
      makeClosedTrade({ id: "t2", status: "CANCELLED", netPnl: 0 }),
      makeClosedTrade({ id: "t3", exitDate: "invalid-date", netPnl: 100 }),
      makeClosedTrade({ id: "t4", currency: "IDR", netPnl: 100000 }),
      makeClosedTrade({ id: "t5", currency: "USD", netPnl: 250 }),
    ];

    const res = calculateDimensionalSlicer(trades, "SYMBOL", 2, {
      expectedCurrency: "USD",
    });
    assert.equal(res.totalEligibleTrades, 1);
    assert.equal(res.intakeDiagnostics.excludedTradesCount, 4);
    assert.equal(res.buckets[0].totalNetPnl, 250);
  });
});

