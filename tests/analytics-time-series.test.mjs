/**
 * SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 3.3
 * Time-Series Metrics Calculation Kernel Test Suite
 *
 * Verifies Scenarios TS-01 through TS-16:
 * - Deterministic calendar bucketing: DAILY, WEEKLY (ISO-8601), MONTHLY
 * - Strict IANA timezone validation & explicit UTC default
 * - Timezone boundary projection across day-turns (UTC vs Asia/Jakarta)
 * - Sparse vs. Dense range-filling (hasActivity: false)
 * - Period trade counts, win rate, expectancy, and profit factor
 * - Year-turn ISO week edge cases
 * - Best & worst period identification
 * - Multi-currency rejection & cash flow isolation
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

// Register TypeScript extensionless resolver for native node --test execution
if (typeof registerHooks === "function" && typeof stripTypeScriptTypes === "function") {
  registerHooks({
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
  isValidIanaTimeZone,
  getZonedCalendarDate,
  calculateTimeSeriesMetrics,
} = await import("../lib/analytics/time-series-metrics.ts");

function createTrade(overrides = {}) {
  return {
    id: "trade-" + Math.random().toString(36).substring(2, 9),
    accountId: "acc-1",
    symbol: "EURUSD",
    instrumentType: "FOREX",
    action: "BUY",
    status: "CLOSED",
    entryDate: "2026-11-01T08:00:00Z",
    exitDate: "2026-11-01T12:00:00Z",
    entryPrice: 1.08,
    exitPrice: 1.085,
    positionSize: 1.0,
    netPnl: 100.0,
    currency: "USD",
    ...overrides,
  };
}

test("TS-01: Empty trades array returns NO_DATA with empty periods", () => {
  const result = calculateTimeSeriesMetrics([], 2);
  assert.equal(result.totalPeriods, 0);
  assert.equal(result.activePeriods, 0);
  assert.equal(result.emptyPeriods, 0);
  assert.deepEqual(result.periods, []);
  assert.equal(result.bestPeriod, null);
  assert.equal(result.worstPeriod, null);
  assert.equal(result.calculationStatus, "NO_DATA");
});

test("TS-02: Daily bucketing groups trades strictly by YYYY-MM-DD", () => {
  const trades = [
    createTrade({ exitDate: "2026-11-01T10:00:00Z", netPnl: 100.0 }),
    createTrade({ exitDate: "2026-11-01T15:00:00Z", netPnl: 50.0 }),
    createTrade({ exitDate: "2026-11-02T09:00:00Z", netPnl: -80.0 }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, { granularity: "DAILY", timeZone: "UTC" });
  assert.equal(result.totalPeriods, 2);
  assert.equal(result.periods[0].periodKey, "2026-11-01");
  assert.equal(result.periods[0].tradeCount, 2);
  assert.equal(result.periods[0].netPnl, 150.0);

  assert.equal(result.periods[1].periodKey, "2026-11-02");
  assert.equal(result.periods[1].tradeCount, 1);
  assert.equal(result.periods[1].netPnl, -80.0);
});

test("TS-03: Weekly bucketing groups trades by ISO-8601 week (YYYY-Www)", () => {
  // 2026-11-02 is Monday (Week 45 of 2026)
  // 2026-11-08 is Sunday (Week 45 of 2026)
  // 2026-11-09 is Monday (Week 46 of 2026)
  const trades = [
    createTrade({ exitDate: "2026-11-02T10:00:00Z", netPnl: 200.0 }),
    createTrade({ exitDate: "2026-11-08T22:00:00Z", netPnl: 300.0 }),
    createTrade({ exitDate: "2026-11-09T08:00:00Z", netPnl: -100.0 }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, { granularity: "WEEKLY", timeZone: "UTC" });
  assert.equal(result.totalPeriods, 2);
  assert.equal(result.periods[0].periodKey, "2026-W45");
  assert.equal(result.periods[0].tradeCount, 2);
  assert.equal(result.periods[0].netPnl, 500.0);

  assert.equal(result.periods[1].periodKey, "2026-W46");
  assert.equal(result.periods[1].tradeCount, 1);
  assert.equal(result.periods[1].netPnl, -100.0);
});

test("TS-04: Monthly bucketing groups trades by YYYY-MM", () => {
  const trades = [
    createTrade({ exitDate: "2026-10-31T20:00:00Z", netPnl: 150.0 }),
    createTrade({ exitDate: "2026-11-01T10:00:00Z", netPnl: 250.0 }),
    createTrade({ exitDate: "2026-11-20T12:00:00Z", netPnl: 50.0 }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, { granularity: "MONTHLY", timeZone: "UTC" });
  assert.equal(result.totalPeriods, 2);
  assert.equal(result.periods[0].periodKey, "2026-10");
  assert.equal(result.periods[0].tradeCount, 1);
  assert.equal(result.periods[1].periodKey, "2026-11");
  assert.equal(result.periods[1].tradeCount, 2);
  assert.equal(result.periods[1].netPnl, 300.0);
});

test("TS-05: Timezone boundary projection projects UTC 23:30 into next calendar day in Asia/Jakarta", () => {
  // Trade closed at 2026-11-01T23:30:00Z
  // In UTC: 2026-11-01
  // In Asia/Jakarta (UTC+7): 2026-11-02 at 06:30
  const trades = [
    createTrade({ exitDate: "2026-11-01T23:30:00Z", netPnl: 500.0 }),
  ];

  const resUtc = calculateTimeSeriesMetrics(trades, 2, { granularity: "DAILY", timeZone: "UTC" });
  assert.equal(resUtc.periods[0].periodKey, "2026-11-01");

  const resJkt = calculateTimeSeriesMetrics(trades, 2, { granularity: "DAILY", timeZone: "Asia/Jakarta" });
  assert.equal(resJkt.periods[0].periodKey, "2026-11-02");
});

test("TS-06: Explicit UTC default when timezone is omitted", () => {
  const trades = [createTrade({ exitDate: "2026-11-01T12:00:00Z", netPnl: 100.0 })];
  const result = calculateTimeSeriesMetrics(trades, 2);
  assert.equal(result.timeZone, "UTC");
  assert.equal(result.periods[0].periodKey, "2026-11-01");
});

test("TS-07: Invalid IANA timezone returns INVALID_TIMEZONE status and empty periods", () => {
  assert.equal(isValidIanaTimeZone("Invalid/Fake_Zone"), false);
  assert.equal(isValidIanaTimeZone("UTC"), true);
  assert.equal(isValidIanaTimeZone("Asia/Jakarta"), true);

  const trades = [createTrade({ exitDate: "2026-11-01T12:00:00Z", netPnl: 100.0 })];
  const result = calculateTimeSeriesMetrics(trades, 2, { timeZone: "Invalid/Fake_Zone" });
  assert.equal(result.calculationStatus, "INVALID_TIMEZONE");
  assert.equal(result.totalPeriods, 0);
  assert.deepEqual(result.periods, []);
});

test("TS-08: Period metric accuracy matches BigInt minor sums for profit and loss", () => {
  const trades = [
    createTrade({ exitDate: "2026-11-01T10:00:00Z", netPnl: 150.25 }),
    createTrade({ exitDate: "2026-11-01T12:00:00Z", netPnl: -50.15 }),
    createTrade({ exitDate: "2026-11-01T14:00:00Z", netPnl: 200.0 }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, { granularity: "DAILY" });
  const p = result.periods[0];
  assert.equal(p.grossProfit, 350.25);
  assert.equal(p.grossLoss, 50.15);
  assert.equal(p.netPnl, 300.10);
});

test("TS-09: Period trade counts verified exactly (winning, losing, breakeven)", () => {
  const trades = [
    createTrade({ exitDate: "2026-11-01T10:00:00Z", netPnl: 100.0 }),
    createTrade({ exitDate: "2026-11-01T11:00:00Z", netPnl: -50.0 }),
    createTrade({ exitDate: "2026-11-01T12:00:00Z", netPnl: 0.0 }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, { granularity: "DAILY" });
  const p = result.periods[0];
  assert.equal(p.tradeCount, 3);
  assert.equal(p.winningTrades, 1);
  assert.equal(p.losingTrades, 1);
  assert.equal(p.breakEvenTrades, 1);
  assert.equal(p.winRate, 33.33); // 1 / 3 * 100 = 33.33%
});

test("TS-10: Period Expectancy reconciled via netPnl / tradeCount", () => {
  const trades = [
    createTrade({ exitDate: "2026-11-01T10:00:00Z", netPnl: 300.0 }),
    createTrade({ exitDate: "2026-11-01T11:00:00Z", netPnl: -100.0 }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, { granularity: "DAILY" });
  const p = result.periods[0];
  assert.equal(p.netPnl, 200.0);
  assert.equal(p.expectancy, 100.0); // 200 / 2 = 100
});

test("TS-11: Period Profit Factor safe against zero losses", () => {
  const trades = [
    createTrade({ exitDate: "2026-11-01T10:00:00Z", netPnl: 300.0 }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, { granularity: "DAILY" });
  const p = result.periods[0];
  assert.equal(p.grossLoss, 0.0);
  assert.equal(p.profitFactor, null); // Zero losses = null ratio
});

test("TS-12: Sparse series generation excludes empty days by default", () => {
  const trades = [
    createTrade({ exitDate: "2026-11-01T10:00:00Z", netPnl: 100.0 }),
    createTrade({ exitDate: "2026-11-05T10:00:00Z", netPnl: 200.0 }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, {
    granularity: "DAILY",
    includeEmptyPeriods: false,
  });

  assert.equal(result.totalPeriods, 2);
  assert.equal(result.activePeriods, 2);
  assert.equal(result.emptyPeriods, 0);
  assert.equal(result.periods[0].periodKey, "2026-11-01");
  assert.equal(result.periods[1].periodKey, "2026-11-05");
});

test("TS-13: Dense series range-filling generates inactive periods with hasActivity: false", () => {
  const trades = [
    createTrade({ exitDate: "2026-11-01T10:00:00Z", netPnl: 100.0 }),
    createTrade({ exitDate: "2026-11-03T10:00:00Z", netPnl: 200.0 }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, {
    granularity: "DAILY",
    includeEmptyPeriods: true,
  });

  assert.equal(result.totalPeriods, 3);
  assert.equal(result.activePeriods, 2);
  assert.equal(result.emptyPeriods, 1);

  assert.equal(result.periods[0].periodKey, "2026-11-01");
  assert.equal(result.periods[0].hasActivity, true);

  assert.equal(result.periods[1].periodKey, "2026-11-02");
  assert.equal(result.periods[1].hasActivity, false);
  assert.equal(result.periods[1].tradeCount, 0);
  assert.equal(result.periods[1].netPnl, 0.0);
  assert.equal(result.periods[1].winRate, null);
  assert.equal(result.periods[1].profitFactor, null);
  assert.equal(result.periods[1].expectancy, null);

  assert.equal(result.periods[2].periodKey, "2026-11-03");
  assert.equal(result.periods[2].hasActivity, true);
});

test("TS-14: Best and worst period identification selects peak profit and lowest P/L", () => {
  const trades = [
    createTrade({ exitDate: "2026-11-01T10:00:00Z", netPnl: 500.0 }),
    createTrade({ exitDate: "2026-11-02T10:00:00Z", netPnl: -800.0 }),
    createTrade({ exitDate: "2026-11-03T10:00:00Z", netPnl: 200.0 }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, { granularity: "DAILY" });
  assert.equal(result.bestPeriod?.periodKey, "2026-11-01");
  assert.equal(result.bestPeriod?.netPnl, 500.0);
  assert.equal(result.worstPeriod?.periodKey, "2026-11-02");
  assert.equal(result.worstPeriod?.netPnl, -800.0);
});

test("TS-15: Year-turn ISO week boundary correctly handles week 52 vs week 1", () => {
  // Dec 31, 2023 is Sunday -> ISO week 2023-W52
  // Jan 1, 2024 is Monday -> ISO week 2024-W01
  const trades = [
    createTrade({ exitDate: "2023-12-31T15:00:00Z", netPnl: 100.0 }),
    createTrade({ exitDate: "2024-01-01T10:00:00Z", netPnl: 200.0 }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, { granularity: "WEEKLY", timeZone: "UTC" });
  assert.equal(result.totalPeriods, 2);
  assert.equal(result.periods[0].periodKey, "2023-W52");
  assert.equal(result.periods[1].periodKey, "2024-W01");
});

test("TS-16: Multi-currency rejection isolates non-cohort trades in time series", () => {
  const trades = [
    createTrade({ exitDate: "2026-11-01T10:00:00Z", netPnl: 100.0, currency: "USD" }),
    createTrade({ exitDate: "2026-11-01T12:00:00Z", netPnl: 500000.0, currency: "IDR" }),
  ];

  const result = calculateTimeSeriesMetrics(trades, 2, {
    granularity: "DAILY",
    expectedCurrency: "USD",
  });

  assert.equal(result.totalPeriods, 1);
  assert.equal(result.periods[0].netPnl, 100.0);
  assert.equal(result.intakeDiagnostics.excludedTradesCount, 1);
  assert.equal(result.intakeDiagnostics.excludedReasons[0].reason, "UNSUPPORTED_CURRENCY");
});

