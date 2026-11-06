/**
 * SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 3.2
 * Core Metrics Engine Mathematical & Algorithmic Unit Tests
 */

import { test, describe } from "node:test";
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
  filterEligibleClosedTrades,
  evaluateSampleStatus,
  calculateTotalNetPnl,
  calculateWinRates,
  calculateAverageWinLoss,
  calculateProfitFactor,
  calculateExpectancy,
  calculateRMultipleMetrics,
  buildCoreMetricsSummary,
} = await import("../lib/analytics/core-metrics.ts");

// ── Mock Factory Helper ──────────────────────────────────────────

function createMockTrade(overrides = {}) {
  return {
    id: `trd-${Math.random().toString(36).slice(2, 10)}`,
    userId: "usr-test",
    accountId: "acc-test",
    pair: "EURUSD",
    direction: "LONG",
    status: "CLOSED",
    entryDate: "2026-11-01T10:00:00.000Z",
    exitDate: "2026-11-01T12:00:00.000Z",
    timeframe: "H1",
    session: "LONDON",
    entryPrice: 1.0800,
    exitPrice: 1.0850,
    stopLoss: 1.0750,
    positionSize: 1.0,
    plannedRiskAmount: 50.0,
    grossPnl: 50.0,
    commission: 5.0,
    swap: 0,
    otherFees: 0,
    netPnl: 45.0,
    outcome: "WIN",
    setupTags: [],
    entryChecklist: {},
    emotion: "NEUTRAL",
    mistake: "NONE",
    attachments: [],
    dataQuality: "SELF_REPORTED_MANUAL",
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("PAE Task 3.2 — Core Metrics Engine Suite", () => {
  // ── Intake & Eligibility ─────────────────────────────────────────

  test("1. Eligibility: Isolates CLOSED trades from OPEN, CANCELLED, and corrupt records", () => {
    const mixed = [
      createMockTrade({ status: "CLOSED", netPnl: 100 }),
      createMockTrade({ status: "OPEN", exitDate: undefined, netPnl: undefined }),
      createMockTrade({ status: "CANCELLED", netPnl: 0 }),
      createMockTrade({ status: "CLOSED", exitDate: undefined }), // Missing exit date
      createMockTrade({ status: "CLOSED", netPnl: NaN }), // Non-finite pnl
      createMockTrade({ status: "CLOSED", netPnl: -50 }),
    ];

    const eligible = filterEligibleClosedTrades(mixed);
    assert.equal(eligible.length, 2, "Only 2 closed trades with valid exitDate and netPnl should pass");
    assert.equal(eligible[0].netPnl, 100);
    assert.equal(eligible[1].netPnl, -50);
  });

  test("2. Educational Sample Status: Correct categorization & policies", () => {
    assert.equal(evaluateSampleStatus(0).status, "NO_DATA");
    assert.equal(evaluateSampleStatus(1).status, "INSUFFICIENT");
    assert.equal(evaluateSampleStatus(14).status, "INSUFFICIENT");
    assert.equal(evaluateSampleStatus(15).status, "LIMITED");
    assert.equal(evaluateSampleStatus(29).status, "LIMITED");
    assert.equal(evaluateSampleStatus(30).status, "SUFFICIENT");
    assert.equal(evaluateSampleStatus(100).status, "SUFFICIENT");
  });

  // ── Metric 1: Total Net P/L ──────────────────────────────────────

  test("3. Total Net P/L: Sums via BigInt minor units without float drift across USD, IDR, BHD", () => {
    // USD (2 decimals)
    const usdTrades = [
      createMockTrade({ netPnl: 0.1 }),
      createMockTrade({ netPnl: 0.2 }),
      createMockTrade({ netPnl: -0.3 }),
    ];
    assert.equal(calculateTotalNetPnl(usdTrades, 2), 0.0, "0.1 + 0.2 - 0.3 must be exactly 0.0");

    // IDR (0 decimals)
    const idrTrades = [
      createMockTrade({ netPnl: 150000 }),
      createMockTrade({ netPnl: -50000 }),
    ];
    assert.equal(calculateTotalNetPnl(idrTrades, 0), 100000);

    // BHD (3 decimals)
    const bhdTrades = [
      createMockTrade({ netPnl: 12.345 }),
      createMockTrade({ netPnl: 5.655 }),
    ];
    assert.equal(calculateTotalNetPnl(bhdTrades, 3), 18.0);
  });

  // ── Metric 2: Win Rates ──────────────────────────────────────────

  test("4. Win Rates: Comprehensive (All) vs. Decisive Win Rate handling breakeven", () => {
    // 2 Win, 2 Loss, 1 Breakeven
    const cohort = [
      createMockTrade({ netPnl: 100 }),
      createMockTrade({ netPnl: 50 }),
      createMockTrade({ netPnl: -80 }),
      createMockTrade({ netPnl: -40 }),
      createMockTrade({ netPnl: 0 }), // Breakeven
    ];

    const wr = calculateWinRates(cohort);
    assert.equal(wr.totalClosedTrades, 5);
    assert.equal(wr.winningTrades, 2);
    assert.equal(wr.losingTrades, 2);
    assert.equal(wr.breakevenTrades, 1);
    assert.equal(wr.winRateAll, 40.0, "2 / 5 = 40%");
    assert.equal(wr.winRateDecisive, 50.0, "2 / (2 + 2) = 50%");
    assert.equal(wr.breakevenRate, 20.0, "1 / 5 = 20%");
    assert.equal(wr.calculationStatus, "VALID");
  });

  test("5. Win Rates: All breakeven cohort returns null for decisive rate", () => {
    const allBe = [
      createMockTrade({ netPnl: 0 }),
      createMockTrade({ netPnl: 0 }),
    ];

    const wr = calculateWinRates(allBe);
    assert.equal(wr.winRateAll, 0.0);
    assert.equal(wr.winRateDecisive, null, "Decisive denominator is 0 -> null");
    assert.equal(wr.breakevenRate, 100.0);
    assert.equal(wr.calculationStatus, "ALL_BREAKEVEN");
  });

  // ── Metric 3: Average Win & Loss ─────────────────────────────────

  test("6. Average Win/Loss: Magnitude is strictly positive nominal value", () => {
    const trades = [
      createMockTrade({ netPnl: 200 }),
      createMockTrade({ netPnl: 400 }),
      createMockTrade({ netPnl: -150 }),
      createMockTrade({ netPnl: -250 }),
      createMockTrade({ netPnl: 0 }),
    ];

    const res = calculateAverageWinLoss(trades, 2);
    assert.equal(res.averageWin, 300.0, "(200 + 400) / 2 = 300");
    assert.equal(res.averageLossMagnitude, 200.0, "|-150 + -250| / 2 = 200");
    assert.equal(res.signedAverageLoss, -200.0);
    assert.equal(res.winLossRatio, 1.5, "300 / 200 = 1.5");
  });

  // ── Metric 4: Profit Factor ──────────────────────────────────────

  test("7. Profit Factor: Zero loss outputs null with ZERO_LOSSES (never Infinity)", () => {
    const winOnly = [
      createMockTrade({ netPnl: 100 }),
      createMockTrade({ netPnl: 200 }),
    ];

    const pf = calculateProfitFactor(winOnly, 2);
    assert.equal(pf.grossProfit, 300.0);
    assert.equal(pf.grossLoss, 0.0);
    assert.equal(pf.profitFactor, null, "Zero losses must output null, never Infinity");
    assert.equal(pf.calculationStatus, "ZERO_LOSSES");
  });

  test("8. Profit Factor: Zero profit outputs 0.0 with ZERO_PROFIT", () => {
    const lossOnly = [
      createMockTrade({ netPnl: -100 }),
      createMockTrade({ netPnl: -50 }),
    ];

    const pf = calculateProfitFactor(lossOnly, 2);
    assert.equal(pf.grossProfit, 0.0);
    assert.equal(pf.grossLoss, 150.0);
    assert.equal(pf.profitFactor, 0.0);
    assert.equal(pf.calculationStatus, "ZERO_PROFIT");
  });

  test("9. Profit Factor: Standard multi-trade calculation", () => {
    const trades = [
      createMockTrade({ netPnl: 600 }),
      createMockTrade({ netPnl: -200 }),
    ];

    const pf = calculateProfitFactor(trades, 2);
    assert.equal(pf.grossProfit, 600.0);
    assert.equal(pf.grossLoss, 200.0);
    assert.equal(pf.profitFactor, 3.0);
    assert.equal(pf.calculationStatus, "VALID");
  });

  // ── Metric 5: Expectancy Reconciliation ──────────────────────────

  test("10. Expectancy: Dual formulation reconciliation (Method 1 == Method 2)", () => {
    // 5 trades from verified walkthrough: +400, -200, 0, -300, +600
    const trades = [
      createMockTrade({ netPnl: 400 }),
      createMockTrade({ netPnl: -200 }),
      createMockTrade({ netPnl: 0 }),
      createMockTrade({ netPnl: -300 }),
      createMockTrade({ netPnl: 600 }),
    ];

    const exp = calculateExpectancy(trades, 2);
    assert.equal(exp.totalClosedTrades, 5);
    assert.equal(exp.totalNetPnl, 500.0);
    assert.equal(exp.expectancyFormula1, 100.0, "500 / 5 = 100.0");
    assert.equal(exp.expectancyFormula2, 100.0, "(0.4 * 500) - (0.4 * 250) = 100.0");
    assert.equal(exp.isFormulasReconciled, true);
    assert.equal(exp.expectancy, 100.0);
  });

  // ── Metric 6: R-Multiple & Initial Risk Rules ───────────────────

  test("11. R-Multiple: plannedRiskAmount > 0 included; <= 0 or missing excluded from N_R", () => {
    const trades = [
      createMockTrade({ netPnl: 400, plannedRiskAmount: 200 }), // +2.0 R
      createMockTrade({ netPnl: -200, plannedRiskAmount: 200 }), // -1.0 R
      createMockTrade({ netPnl: 0, plannedRiskAmount: 0 }), // Excluded (risk = 0)
      createMockTrade({ netPnl: -300, plannedRiskAmount: 150 }), // -2.0 R
      createMockTrade({ netPnl: 600, plannedRiskAmount: 250 }), // +2.4 R
      createMockTrade({ netPnl: 100, plannedRiskAmount: undefined }), // Excluded (missing)
      createMockTrade({ netPnl: 50, plannedRiskAmount: -50 }), // Excluded (negative invalid)
    ];

    const rRes = calculateRMultipleMetrics(trades);
    assert.equal(rRes.totalTradesRecorded, 7);
    assert.equal(rRes.rEligibleTradesCount, 4, "Only 4 trades have plannedRiskAmount > 0");
    assert.equal(rRes.excludedTradesCount, 3);
    assert.equal(rRes.totalR, 1.4, "2 - 1 - 2 + 2.4 = 1.4 R");
    assert.equal(rRes.averageR, 0.35, "1.4 / 4 = 0.35 R");
    assert.equal(rRes.medianR, 0.5, "Median of [-2, -1, 2, 2.4] = (-1 + 2)/2 = 0.5");
  });

  test("12. R-Multiple: All trades lack risk data outputs null with NO_RISK_DATA", () => {
    const noRiskTrades = [
      createMockTrade({ netPnl: 100, plannedRiskAmount: undefined }),
      createMockTrade({ netPnl: -50, plannedRiskAmount: 0 }),
    ];

    const rRes = calculateRMultipleMetrics(noRiskTrades);
    assert.equal(rRes.rEligibleTradesCount, 0);
    assert.equal(rRes.excludedTradesCount, 2);
    assert.equal(rRes.totalR, null);
    assert.equal(rRes.averageR, null);
    assert.equal(rRes.calculationStatus, "NO_RISK_DATA");
  });

  // ── Composite Summary Orchestrator ───────────────────────────────

  test("13. Composite Summary: Orchestrates all metrics cleanly in unified payload", () => {
    const trades = [
      createMockTrade({ netPnl: 400, plannedRiskAmount: 200, dataQuality: "CALCULATED_STANDARD" }),
      createMockTrade({ netPnl: -200, plannedRiskAmount: 200, dataQuality: "SELF_REPORTED_MANUAL" }),
      createMockTrade({ netPnl: 0, plannedRiskAmount: 0, dataQuality: "ESTIMATED_INCOMPLETE_FEES" }),
    ];

    const summary = buildCoreMetricsSummary(trades, "USD", 2);
    assert.equal(summary.currency, "USD");
    assert.equal(summary.currencyDecimals, 2);
    assert.equal(summary.totalClosedTrades, 3);
    assert.equal(summary.totalNetPnl, 200.0);
    assert.equal(summary.sampleStatus, "INSUFFICIENT");
    assert.equal(summary.dataQualityDistribution.calculatedStandard, 1);
    assert.equal(summary.dataQualityDistribution.selfReportedManual, 1);
    assert.equal(summary.dataQualityDistribution.estimatedIncompleteFees, 1);
  });
});
