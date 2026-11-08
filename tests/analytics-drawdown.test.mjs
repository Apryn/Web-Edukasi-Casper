/**
 * SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 3.3
 * Drawdown Metrics Calculation Kernel Test Suite
 *
 * Verifies Scenarios DD-01 through DD-15:
 * - Deterministic ordering (exitDate asc, id asc)
 * - Initial peak anchored at zero (Peak_0 = 0)
 * - Exact integer arithmetic via BigInt
 * - Tri-state capital governance: AVAILABLE, UNAVAILABLE_BASE_CAPITAL, CAPITAL_DEPLETED
 * - Strict No-Clipping Rule (Drawdown percentage can exceed 100%, e.g. 120%)
 * - Complete epoch lifecycle and tie-breaker rules
 * - Multi-currency rejection and intake diagnostics
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
  sortTradesDeterministically,
  calculateDrawdownMetrics,
} = await import("../lib/analytics/drawdown-metrics.ts");

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

test("DD-01: Empty trades array (N=0) returns NO_DATA with null metrics", () => {
  const result = calculateDrawdownMetrics([], 2, 10000);
  assert.equal(result.totalClosedTrades, 0);
  assert.equal(result.maxDrawdownNominal, null);
  assert.equal(result.maxDrawdownPercentage, null);
  assert.equal(result.currentDrawdownNominal, null);
  assert.equal(result.currentDrawdownPercentage, null);
  assert.equal(result.maxDrawdownEpoch, null);
  assert.equal(result.activeDrawdownEpoch, null);
  assert.deepEqual(result.curvePoints, []);
  assert.deepEqual(result.allEpochs, []);
  assert.equal(result.calculationStatus, "NO_DATA");
});

test("DD-02: All winning trades (zero losses) returns ZERO_LOSSES with 0.0 drawdown", () => {
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: 150.0 }),
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: 250.0 }),
    createTrade({ id: "t3", exitDate: "2026-11-03T10:00:00Z", netPnl: 50.0 }),
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000);
  assert.equal(result.totalClosedTrades, 3);
  assert.equal(result.maxDrawdownNominal, 0.0);
  assert.equal(result.maxDrawdownPercentage, 0.0);
  assert.equal(result.currentDrawdownNominal, 0.0);
  assert.equal(result.currentDrawdownPercentage, 0.0);
  assert.equal(result.allEpochs.length, 0);
  assert.equal(result.calculationStatus, "ZERO_LOSSES");
});

test("DD-03: Immediate first trade loss anchors peak at zero (ORIGIN)", () => {
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: -200.0 }),
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000);
  assert.equal(result.totalClosedTrades, 1);
  assert.equal(result.maxDrawdownNominal, 200.0);
  assert.equal(result.maxDrawdownPercentage, 2.0); // 200 / 10000 * 100 = 2%
  assert.equal(result.currentDrawdownNominal, 200.0);
  assert.equal(result.allEpochs.length, 1);

  const epoch = result.allEpochs[0];
  assert.equal(epoch.peakTradeId, "ORIGIN");
  assert.equal(epoch.peakIndex, 0);
  assert.equal(epoch.peakCumulativePnl, 0.0);
  assert.equal(epoch.troughTradeId, "t1");
  assert.equal(epoch.troughIndex, 1);
  assert.equal(epoch.troughCumulativePnl, -200.0);
  assert.equal(epoch.isRecovered, false);
});

test("DD-04: Monotonic consecutive losses deepens drawdown in single epoch", () => {
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: -100.0 }),
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: -150.0 }),
    createTrade({ id: "t3", exitDate: "2026-11-03T10:00:00Z", netPnl: -250.0 }),
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000);
  assert.equal(result.totalClosedTrades, 3);
  assert.equal(result.maxDrawdownNominal, 500.0);
  assert.equal(result.maxDrawdownPercentage, 5.0); // 500 / 10000 * 100 = 5%
  assert.equal(result.allEpochs.length, 1);

  const epoch = result.allEpochs[0];
  assert.equal(epoch.troughTradeId, "t3");
  assert.equal(epoch.troughCumulativePnl, -500.0);
  assert.equal(epoch.isRecovered, false);
});

test("DD-05: Single drawdown with complete recovery records recovery metrics", () => {
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: 300.0 }),
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: -500.0 }), // cum = -200, peak = 300, DD = 500
    createTrade({ id: "t3", exitDate: "2026-11-03T10:00:00Z", netPnl: 600.0 }),  // cum = 400 >= 300 -> recovered!
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000);
  assert.equal(result.totalClosedTrades, 3);
  assert.equal(result.maxDrawdownNominal, 500.0);
  assert.equal(result.currentDrawdownNominal, 0.0);
  assert.equal(result.allEpochs.length, 1);

  const epoch = result.allEpochs[0];
  assert.equal(epoch.isRecovered, true);
  assert.equal(epoch.peakTradeId, "t1");
  assert.equal(epoch.troughTradeId, "t2");
  assert.equal(epoch.recoveryTradeId, "t3");
  assert.equal(epoch.troughDurationTrades, 1); // 2 - 1 = 1
  assert.equal(epoch.recoveryDurationTrades, 1); // 3 - 2 = 1
  assert.equal(epoch.totalDurationTrades, 2); // 3 - 1 = 2
});

test("DD-06: Unrecovered drawdown at dataset end preserves active state", () => {
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: 500.0 }),
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: -300.0 }), // cum = 200, DD = 300
    createTrade({ id: "t3", exitDate: "2026-11-03T10:00:00Z", netPnl: 100.0 }),  // cum = 300 < 500, DD = 200
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000);
  assert.equal(result.maxDrawdownNominal, 300.0);
  assert.equal(result.currentDrawdownNominal, 200.0);
  assert.ok(result.activeDrawdownEpoch);
  assert.equal(result.activeDrawdownEpoch.isRecovered, false);
  assert.equal(result.activeDrawdownEpoch.recoveryTradeId, null);
});

test("DD-07: Breakeven trade inside drawdown preserves trough tie-breaker", () => {
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: 500.0 }),
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: -400.0 }), // trough DD = 400
    createTrade({ id: "t3", exitDate: "2026-11-03T10:00:00Z", netPnl: 0.0 }),    // BE: DD stays 400
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000);
  assert.equal(result.maxDrawdownNominal, 400.0);
  assert.equal(result.allEpochs.length, 1);
  const epoch = result.allEpochs[0];
  // Earliest tie-breaker rule: trough trade remains t2, not t3
  assert.equal(epoch.troughTradeId, "t2");
  assert.equal(epoch.troughIndex, 2);
});

test("DD-08: Multiple equal peaks starts distinct subsequent epoch", () => {
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: 1000.0 }), // Peak = 1000
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: -300.0 }),  // DD = 300
    createTrade({ id: "t3", exitDate: "2026-11-03T10:00:00Z", netPnl: 300.0 }),   // Cum = 1000 -> Recovers Epoch 1!
    createTrade({ id: "t4", exitDate: "2026-11-04T10:00:00Z", netPnl: -400.0 }),  // DD = 400 -> Starts Epoch 2 from t3!
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000);
  assert.equal(result.allEpochs.length, 2);
  assert.equal(result.allEpochs[0].isRecovered, true);
  assert.equal(result.allEpochs[0].recoveryTradeId, "t3");
  assert.equal(result.allEpochs[1].peakTradeId, "t3");
  assert.equal(result.allEpochs[1].drawdownNominal, 400.0);
  assert.equal(result.maxDrawdownNominal, 400.0);
});

test("DD-09: Multiple equal maximum drawdowns selects earliest occurrence as primary MDD", () => {
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: 500.0 }),
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: -400.0 }), // DD = 400 (Epoch 1)
    createTrade({ id: "t3", exitDate: "2026-11-03T10:00:00Z", netPnl: 500.0 }),  // Cum = 600 (Recovers Epoch 1, new peak = 600)
    createTrade({ id: "t4", exitDate: "2026-11-04T10:00:00Z", netPnl: -400.0 }), // DD = 400 (Epoch 2)
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000);
  assert.equal(result.maxDrawdownNominal, 400.0);
  assert.equal(result.allEpochs.length, 2);
  // Primary MDD points to earliest epoch (EPOCH-1)
  assert.equal(result.maxDrawdownEpoch?.epochId, "EPOCH-1");
});

test("DD-10: Deterministic tie-breaker ordering by id when exitDate identical", () => {
  const tradeB = createTrade({ id: "b-trade", exitDate: "2026-11-01T12:00:00Z", netPnl: -200.0 });
  const tradeA = createTrade({ id: "a-trade", exitDate: "2026-11-01T12:00:00Z", netPnl: 500.0 });

  const sorted = sortTradesDeterministically([tradeB, tradeA]);
  assert.equal(sorted[0].id, "a-trade");
  assert.equal(sorted[1].id, "b-trade");

  // In execution: a-trade profits 500 first (Peak=500), then b-trade loses 200 (DD=200)
  const result = calculateDrawdownMetrics([tradeB, tradeA], 2, 10000);
  assert.equal(result.curvePoints[0].tradeId, "a-trade");
  assert.equal(result.curvePoints[1].tradeId, "b-trade");
  assert.equal(result.maxDrawdownNominal, 200.0);
});

test("DD-11: Percentage MDD calculated accurately with baseline capital", () => {
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: 500.0 }),  // Peak = 500, EquityPeak = 10500
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: -1200.0 }), // DD = 1200, EquityTrough = 9300
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000);
  assert.equal(result.maxDrawdownNominal, 1200.0);
  // 1200 / 10500 * 100 = 11.42857... -> 11.43%
  assert.equal(result.maxDrawdownPercentage, 11.43);
  assert.equal(result.calculationStatus, "AVAILABLE");
});

test("DD-12: Percentage MDD without baseline capital yields null with UNAVAILABLE_BASE_CAPITAL", () => {
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: 500.0 }),
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: -1200.0 }),
  ];

  // Pass undefined / null / 0 as startingCapital
  const resNull = calculateDrawdownMetrics(trades, 2, null);
  assert.equal(resNull.maxDrawdownNominal, 1200.0);
  assert.equal(resNull.maxDrawdownPercentage, null);
  assert.equal(resNull.currentDrawdownPercentage, null);
  assert.equal(resNull.calculationStatus, "UNAVAILABLE_BASE_CAPITAL");

  const resZero = calculateDrawdownMetrics(trades, 2, 0);
  assert.equal(resZero.maxDrawdownPercentage, null);
  assert.equal(resZero.calculationStatus, "UNAVAILABLE_BASE_CAPITAL");
});

test("DD-13: Capital depletion (EquityTrough <= 0) produces unclipped percentage (120%) and CAPITAL_DEPLETED status", () => {
  // Required worked example:
  // Initial capital: 10,000
  // Peak equity: 10,000 (Trade 1: 0)
  // Trough equity: -2,000 (Trade 2: -12,000)
  // Drawdown amount: 12,000
  // Drawdown percentage: 120% (strictly unclipped)
  // Status: CAPITAL_DEPLETED
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: 0.0 }),
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: -12000.0 }),
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000);
  assert.equal(result.maxDrawdownNominal, 12000.0);
  assert.equal(result.maxDrawdownPercentage, 120.0); // Exactly 120%, not 100%!
  assert.equal(result.calculationStatus, "CAPITAL_DEPLETED");
});

test("DD-14: Large aggregate values handled without overflow via BigInt", () => {
  const largePnl = 100_000_000_000.0; // 100 Billion
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: largePnl }),
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: -largePnl }),
  ];

  const result = calculateDrawdownMetrics(trades, 2, 500_000_000_000.0);
  assert.equal(result.maxDrawdownNominal, largePnl);
  assert.ok(result.maxDrawdownPercentage !== null && result.maxDrawdownPercentage > 0);
  assert.equal(result.calculationStatus, "AVAILABLE");
});

test("DD-15: Multi-currency rejection prevents cross-currency aggregation", () => {
  const trades = [
    createTrade({ id: "t1", exitDate: "2026-11-01T10:00:00Z", netPnl: 100.0, currency: "USD" }),
    createTrade({ id: "t2", exitDate: "2026-11-02T10:00:00Z", netPnl: -200.0, currency: "EUR" }),
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000, "USD");
  assert.equal(result.totalClosedTrades, 1); // Only USD trade is eligible
  assert.equal(result.intakeDiagnostics.excludedTradesCount, 1);
  assert.equal(result.intakeDiagnostics.excludedReasons[0].reason, "UNSUPPORTED_CURRENCY");
  assert.equal(result.maxDrawdownNominal, 0.0); // Single winning USD trade
});

test("DD-16: Full Worked Example from Specification (N=8 trades)", () => {
  const trades = [
    createTrade({ id: "T-001", exitDate: "2026-11-01T10:00:00Z", netPnl: 200.0 }),
    createTrade({ id: "T-002", exitDate: "2026-11-01T14:00:00Z", netPnl: 300.0 }),
    createTrade({ id: "T-003", exitDate: "2026-11-02T09:00:00Z", netPnl: -400.0 }),
    createTrade({ id: "T-004", exitDate: "2026-11-02T16:00:00Z", netPnl: -300.0 }),
    createTrade({ id: "T-005", exitDate: "2026-11-03T11:00:00Z", netPnl: 0.0 }),
    createTrade({ id: "T-006", exitDate: "2026-11-03T15:00:00Z", netPnl: 500.0 }),
    createTrade({ id: "T-007", exitDate: "2026-11-04T10:00:00Z", netPnl: 400.0 }),
    createTrade({ id: "T-008", exitDate: "2026-11-04T14:00:00Z", netPnl: -150.0 }),
  ];

  const result = calculateDrawdownMetrics(trades, 2, 10000);
  assert.equal(result.totalClosedTrades, 8);
  assert.equal(result.maxDrawdownNominal, 700.0);
  assert.equal(result.maxDrawdownPercentage, 6.67);
  assert.equal(result.currentDrawdownNominal, 150.0);
  assert.equal(result.currentDrawdownPercentage, 1.4);
  assert.equal(result.calculationStatus, "AVAILABLE");

  assert.equal(result.allEpochs.length, 2);

  // Epoch 1: recovered
  const ep1 = result.allEpochs[0];
  assert.equal(ep1.peakTradeId, "T-002");
  assert.equal(ep1.troughTradeId, "T-004");
  assert.equal(ep1.recoveryTradeId, "T-007");
  assert.equal(ep1.isRecovered, true);
  assert.equal(ep1.drawdownNominal, 700.0);
  assert.equal(ep1.drawdownPercentage, 6.67);
  assert.equal(ep1.troughDurationTrades, 2);
  assert.equal(ep1.recoveryDurationTrades, 3);
  assert.equal(ep1.totalDurationTrades, 5);

  // Epoch 2: unrecovered at end
  const ep2 = result.allEpochs[1];
  assert.equal(ep2.peakTradeId, "T-007");
  assert.equal(ep2.troughTradeId, "T-008");
  assert.equal(ep2.isRecovered, false);
  assert.equal(ep2.drawdownNominal, 150.0);
  assert.equal(ep2.drawdownPercentage, 1.4);
});
