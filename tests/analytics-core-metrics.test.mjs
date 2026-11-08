/**
 * SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 3.2 & 3.2.1
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
  isValidIsoDate,
  filterEligibleClosedTrades,
  filterEligibleClosedTradesWithDiagnostics,
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

describe("PAE Task 3.2 & 3.2.1 — Core Metrics Engine Suite", () => {
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
    assert.equal(exp.exactRationalReconciled, true);
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
    assert.equal(summary.intakeDiagnostics.totalInputTrades, 3);
    assert.equal(summary.intakeDiagnostics.eligibleTradesCount, 3);
    assert.equal(summary.intakeDiagnostics.excludedTradesCount, 0);
  });

  // ── Hardening Tests (Task 3.2.1) ─────────────────────────────────

  test("14. Expectancy: Exact BigInt rational cross-multiplication with non-divisible averages", () => {
    // 3 wins of 100, 3 losses of -50 -> non-divisible when total trades is 7 (+ 1 breakeven)
    // Wins: 100, 100, 100 (Total Win = 300, N_w = 3, AvgWin = 100)
    // Losses: -33, -33, -33 (Total Loss = -99, N_l = 3, AvgLoss = 33)
    // Breakeven: 0 (N_be = 1)
    // Total = 7 trades. Net PnL = 300 - 99 = 201.
    // Method 1: 201 / 7 = 28.7142857... -> 28.71
    // Method 2 with component averages:
    // Pw = 3/7, Pl = 3/7
    // Method 2 exact rational is: (3/7 * 100) - (3/7 * 33) = (300 - 99)/7 = 201/7
    const trades = [
      createMockTrade({ netPnl: 100 }),
      createMockTrade({ netPnl: 100 }),
      createMockTrade({ netPnl: 100 }),
      createMockTrade({ netPnl: -33 }),
      createMockTrade({ netPnl: -33 }),
      createMockTrade({ netPnl: -33 }),
      createMockTrade({ netPnl: 0 }),
    ];

    const exp = calculateExpectancy(trades, 2);
    assert.equal(exp.totalClosedTrades, 7);
    assert.equal(exp.exactRationalReconciled, true, "Exact BigInt cross-multiplication must prove rational parity");
    assert.equal(exp.isFormulasReconciled, true);
    assert.equal(exp.expectancyFormula1, 28.71);
  });

  test("15. Expectancy: Multi-currency precision support (IDR, JPY 0-dec, BHD 3-dec, USD 2-dec)", () => {
    // IDR (0 decimals)
    const idrTrades = [
      createMockTrade({ netPnl: 150000 }),
      createMockTrade({ netPnl: -50000 }),
      createMockTrade({ netPnl: 0 }),
    ];
    const idrExp = calculateExpectancy(idrTrades, 0);
    assert.equal(idrExp.exactRationalReconciled, true);
    assert.equal(idrExp.expectancy, 33333); // 100,000 / 3

    // BHD (3 decimals)
    const bhdTrades = [
      createMockTrade({ netPnl: 10.125 }),
      createMockTrade({ netPnl: -3.125 }),
    ];
    const bhdExp = calculateExpectancy(bhdTrades, 3);
    assert.equal(bhdExp.exactRationalReconciled, true);
    assert.equal(bhdExp.expectancy, 3.5); // 7.000 / 2
  });

  test("16. Profit Factor: BigInt scaled ratio calculation safe against aggregates > Number.MAX_SAFE_INTEGER", () => {
    // Construct trades where individual trades are valid but aggregate is immense
    // Even if gross profit is large, BigInt scaled division calculates ratio without precision loss
    const hugeProfit = createMockTrade({ netPnl: 50000000000000 }); // $50 Trillion
    const hugeLoss = createMockTrade({ netPnl: -25000000000000 }); // $25 Trillion

    const pf = calculateProfitFactor([hugeProfit, hugeLoss], 2);
    assert.equal(pf.profitFactor, 2.0, "Scaled BigInt division must yield exact 2.0 ratio");
    assert.equal(Number.isFinite(pf.profitFactor), true);
    assert.notEqual(pf.profitFactor, Infinity);
    assert.equal(pf.calculationStatus, "VALID");
  });

  test("17. Strict ISO-8601 validation helper: Rejects informal date strings and non-existent calendar dates", () => {
    // Valid ISO-8601 timestamps and calendar dates
    assert.equal(isValidIsoDate("2026-11-01T12:00:00.000Z"), true);
    assert.equal(isValidIsoDate("2026-11-01T12:00:00Z"), true);
    assert.equal(isValidIsoDate("2026-11-01"), true);
    assert.equal(isValidIsoDate("2026-11-01T12:00:00+07:00"), true);
    assert.equal(isValidIsoDate("2024-02-29"), true, "2024 is a valid leap year");
    assert.equal(isValidIsoDate("2000-02-29"), true, "2000 is a valid 400-year leap year");

    // Rejection of invalid calendar dates (non-existent days/months)
    assert.equal(isValidIsoDate("2026-02-30"), false, "February 30 does not exist");
    assert.equal(isValidIsoDate("2026-02-31"), false, "February 31 does not exist");
    assert.equal(isValidIsoDate("2026-13-01"), false, "Month 13 does not exist");
    assert.equal(isValidIsoDate("2026-04-31"), false, "April 31 does not exist (April has 30 days)");
    assert.equal(isValidIsoDate("2026-02-29"), false, "2026 is not a leap year");
    assert.equal(isValidIsoDate("1900-02-29"), false, "1900 is not a leap year (divisible by 100 but not 400)");
    assert.equal(isValidIsoDate("2026-00-15"), false, "Month 0 does not exist");
    assert.equal(isValidIsoDate("2026-05-00"), false, "Day 0 does not exist");
    assert.equal(isValidIsoDate("2026-05-32"), false, "Day 32 does not exist");
    assert.equal(isValidIsoDate("2026-11-08T24:00:00Z"), false, "Hour 24 is out of range");

    // Rejection of informal and malformed strings
    assert.equal(isValidIsoDate("11/01/2026"), false);
    assert.equal(isValidIsoDate("November 1, 2026"), false);
    assert.equal(isValidIsoDate("invalid-date-string"), false);
    assert.equal(isValidIsoDate(""), false);
    assert.equal(isValidIsoDate(null), false);
    assert.equal(isValidIsoDate(undefined), false);
    assert.equal(isValidIsoDate(12345678), false);
  });

  test("18. Data Exclusion Diagnostics: Counts reconcile and non-overlapping reason codes", () => {
    const rawTrades = [
      createMockTrade({ status: "CLOSED", netPnl: 100 }), // Eligible
      createMockTrade({ status: "OPEN" }), // INVALID_STATUS
      createMockTrade({ status: "CANCELLED" }), // INVALID_STATUS
      createMockTrade({ status: "CLOSED", exitDate: "2026-02-30" }), // INVALID_EXIT_DATE (invalid calendar date)
      createMockTrade({ status: "CLOSED", netPnl: NaN }), // INVALID_NET_PNL
      createMockTrade({ status: "CLOSED", netPnl: 50, currency: "EUR" }), // UNSUPPORTED_CURRENCY
      null, // CORRUPT_RECORD
      undefined, // CORRUPT_RECORD
    ];

    const result = filterEligibleClosedTradesWithDiagnostics(rawTrades, "USD");
    const diag = result.diagnostics;

    assert.equal(diag.totalInputTrades, 8);
    assert.equal(diag.eligibleTradesCount, 1);
    assert.equal(diag.excludedTradesCount, 7);
    assert.equal(
      diag.eligibleTradesCount + diag.excludedTradesCount,
      diag.totalInputTrades,
      "Input trades count must reconcile with eligible + excluded"
    );

    const reasonsMap = Object.fromEntries(diag.excludedReasons.map((r) => [r.reason, r.count]));
    assert.equal(reasonsMap.INVALID_STATUS, 2, "OPEN and CANCELLED");
    assert.equal(reasonsMap.INVALID_EXIT_DATE, 1, "Calendar-invalid date 2026-02-30 rejected");
    assert.equal(reasonsMap.INVALID_NET_PNL, 1);
    assert.equal(reasonsMap.UNSUPPORTED_CURRENCY, 1);
    assert.equal(reasonsMap.CORRUPT_RECORD, 2);

    // Ensure no private details leaked in diagnostics
    for (const r of diag.excludedReasons) {
      assert.ok(typeof r.reason === "string");
      assert.ok(typeof r.count === "number");
      assert.ok(typeof r.description === "string");
      assert.equal("id" in r, false);
      assert.equal("pair" in r, false);
      assert.equal("netPnl" in r, false);
    }
  });

  test("19. Expectancy: Boundary cohorts (only wins, only losses, only breakeven, and presentation rounding divergence)", () => {
    // A. Only winning trades (N_l = 0, AvgLoss is undefined)
    const onlyWins = [
      createMockTrade({ netPnl: 150 }),
      createMockTrade({ netPnl: 250 }),
    ];
    const expWins = calculateExpectancy(onlyWins, 2);
    assert.equal(expWins.exactRationalReconciled, true);
    assert.equal(expWins.expectancyFormula1, 200.0);
    assert.equal(expWins.expectancyFormula2, 200.0);

    // B. Only losing trades (N_w = 0, AvgWin is undefined)
    const onlyLosses = [
      createMockTrade({ netPnl: -100 }),
      createMockTrade({ netPnl: -200 }),
    ];
    const expLosses = calculateExpectancy(onlyLosses, 2);
    assert.equal(expLosses.exactRationalReconciled, true);
    assert.equal(expLosses.expectancyFormula1, -150.0);
    assert.equal(expLosses.expectancyFormula2, -150.0);

    // C. Only breakeven trades (N_w = 0, N_l = 0, N_be = 3)
    const onlyBe = [
      createMockTrade({ netPnl: 0 }),
      createMockTrade({ netPnl: 0 }),
      createMockTrade({ netPnl: 0 }),
    ];
    const expBe = calculateExpectancy(onlyBe, 2);
    assert.equal(expBe.exactRationalReconciled, true);
    assert.equal(expBe.expectancyFormula1, 0.0);
    assert.equal(expBe.expectancyFormula2, 0.0);

    // D. Breakeven trades diluting the denominator
    // 1 win ($100), 1 loss ($-50), 8 breakevens ($0) -> Total = 10 trades
    // Net PnL = 50. Method 1: 50 / 10 = 5.00
    // Method 2: Pw = 1/10 = 0.1, Pl = 1/10 = 0.1. AvgWin = 100, AvgLoss = 50 -> 0.1 * 100 - 0.1 * 50 = 5.00
    const beDilution = [
      createMockTrade({ netPnl: 100 }),
      createMockTrade({ netPnl: -50 }),
      ...Array.from({ length: 8 }, () => createMockTrade({ netPnl: 0 })),
    ];
    const expDilution = calculateExpectancy(beDilution, 2);
    assert.equal(expDilution.totalClosedTrades, 10);
    assert.equal(expDilution.exactRationalReconciled, true);
    assert.equal(expDilution.expectancyFormula1, 5.0);
    assert.equal(expDilution.expectancyFormula2, 5.0);

    // E. Presentation rounding divergence with exact rational parity
    // 3 wins of $10, 3 losses of -$3.33, 1 breakeven -> Total = 7 trades
    // Total Net P/L = 30 - 9.99 = 20.01
    // Method 1 raw: 20.01 / 7 = 2.85857... -> rounded to 2 decimals = 2.86
    // Method 2 raw components:
    // AvgWin = 10.0, Pw = 3/7 = 0.428571...
    // AvgLoss = 3.33, Pl = 3/7 = 0.428571...
    // Pw * AvgWin - Pl * AvgLoss = 0.428571 * 10 - 0.428571 * 3.33 = 4.28571 - 1.42714 = 2.85857...
    const nonDivisible = [
      createMockTrade({ netPnl: 10 }),
      createMockTrade({ netPnl: 10 }),
      createMockTrade({ netPnl: 10 }),
      createMockTrade({ netPnl: -3.33 }),
      createMockTrade({ netPnl: -3.33 }),
      createMockTrade({ netPnl: -3.33 }),
      createMockTrade({ netPnl: 0 }),
    ];
    const expNonDiv = calculateExpectancy(nonDivisible, 2);
    assert.equal(expNonDiv.exactRationalReconciled, true, "BigInt cross-multiplication parity holds regardless of float presentation");
  });

  test("20. Profit Factor: Extreme ratio safety, overflow protection, and strict non-Infinity/non-NaN guarantees", () => {
    // A. Extreme ratio where scaledQuotient > Number.MAX_SAFE_INTEGER
    // Profit = 2 trades of $50 Trillion (aggregate = $100 Trillion = 10^16 minor units > Number.MAX_SAFE_INTEGER)
    // Loss = $0.01 (1 minor unit)
    // scaledQuotient = (10^16 * 10,000) / 1 = 10^20 > Number.MAX_SAFE_INTEGER (9 * 10^15)
    const profit1 = createMockTrade({ netPnl: 50000000000000 });
    const profit2 = createMockTrade({ netPnl: 50000000000000 });
    const microLoss = createMockTrade({ netPnl: -0.01 });

    const pfExtreme = calculateProfitFactor([profit1, profit2, microLoss], 2);
    assert.equal(Number.isFinite(pfExtreme.profitFactor), true, "Profit factor must be finite");
    assert.equal(isNaN(pfExtreme.profitFactor), false, "Profit factor must not be NaN");
    assert.notEqual(pfExtreme.profitFactor, Infinity, "Profit factor must never be Infinity");
    assert.equal(pfExtreme.calculationStatus, "VALID");

    // B. Zero-Loss status & non-Infinity guarantee
    const zeroLossCohort = [createMockTrade({ netPnl: 500 }), createMockTrade({ netPnl: 200 })];
    const pfZeroLoss = calculateProfitFactor(zeroLossCohort, 2);
    assert.equal(pfZeroLoss.profitFactor, null, "Zero losses must output null");
    assert.equal(pfZeroLoss.calculationStatus, "ZERO_LOSSES");

    // C. Zero-Profit status
    const zeroProfitCohort = [createMockTrade({ netPnl: -100 }), createMockTrade({ netPnl: -200 })];
    const pfZeroProfit = calculateProfitFactor(zeroProfitCohort, 2);
    assert.equal(pfZeroProfit.profitFactor, 0.0);
    assert.equal(pfZeroProfit.calculationStatus, "ZERO_PROFIT");

    // D. All-Breakeven status
    const allBeCohort = [createMockTrade({ netPnl: 0 }), createMockTrade({ netPnl: 0 })];
    const pfAllBe = calculateProfitFactor(allBeCohort, 2);
    assert.equal(pfAllBe.profitFactor, null);
    assert.equal(pfAllBe.calculationStatus, "ALL_BREAKEVEN");
  });
});
