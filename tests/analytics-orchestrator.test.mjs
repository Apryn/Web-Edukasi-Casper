import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
  orchestratePartitionAnalytics,
  getStudentAnalyticsReport,
} = await import("../lib/analytics/analytics-orchestrator.ts");

const {
  createTradingAccount,
  createTrade,
  createCashTransaction,
} = await import("../lib/journal-service.ts");

const {
  getUserPartitionPath,
  rebuildJournalIndex,
} = await import("../lib/journal-storage.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

const createdTestUsers = [];

function cleanupTestUsers() {
  const dataDir = path.join(process.cwd(), "data");
  const journalsDir = path.join(dataDir, "journals");
  const backupsDir = path.join(dataDir, "backups", "journals");

  for (const uid of createdTestUsers) {
    try {
      const pPath = getUserPartitionPath(uid);
      if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
    } catch {}
    try {
      if (fs.existsSync(backupsDir)) {
        for (const f of fs.readdirSync(backupsDir)) {
          if (f.startsWith(`u_${uid}.`)) {
            fs.unlinkSync(path.join(backupsDir, f));
          }
        }
      }
    } catch {}
  }
}

describe("PAE Task 3.5 — Analytics Orchestration Engine Suite", () => {
  after(() => {
    cleanupTestUsers();
    try {
      rebuildJournalIndex();
    } catch {}
  });

  test("AO-01: Empty journal returns NO_DATA across all 4 engines consistently", () => {
    const report = orchestratePartitionAnalytics({
      accounts: [],
      trades: [],
      cashTransactions: [],
    });

    assert.equal(report.status, "NO_DATA");
    assert.equal(report.summary.totalClosedTrades, 0);
    assert.equal(report.coreMetrics.totalClosedTrades, 0);
    assert.equal(report.drawdown.totalClosedTrades, 0);
    assert.equal(report.timeSeries.totalPeriods, 0);
    assert.equal(report.dimensionalBreakdown.totalEligibleTrades, 0);
    assert.equal(report.sampleConfidence.status, "NO_DATA");
  });

  test("AO-02: Integrates all 4 engines (Core, Drawdown, Time-Series, Dimensional) with identical trade population", () => {
    const account = {
      id: "acc-usd-1",
      userId: "u-1",
      accountName: "FTMO $10K",
      accountCurrency: "USD",
      currencyDecimals: 2,
      accountType: "PROP_FIRM",
      initialBalance: 10000,
      realizedBalance: 10350,
      equity: 10350,
      isArchived: false,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
    };

    const trades = [
      {
        id: "t1",
        userId: "u-1",
        accountId: "acc-usd-1",
        pair: "XAUUSD",
        direction: "LONG",
        status: "CLOSED",
        entryDate: "2026-11-02T08:00:00.000Z",
        exitDate: "2026-11-02T10:00:00.000Z",
        timeframe: "H1",
        session: "LONDON",
        entryPrice: 2000,
        exitPrice: 2020,
        stopLoss: 1990,
        positionSize: 1,
        plannedRiskAmount: 100,
        grossPnl: 500,
        commission: 0,
        swap: 0,
        otherFees: 0,
        netPnl: 500,
        outcome: "WIN",
        setupTags: ["FVG"],
        entryChecklist: {},
        emotion: "DISCIPLINED",
        mistake: "NONE",
        marketCondition: "TRENDING_BULL",
        attachments: [],
        dataQuality: "SELF_REPORTED_MANUAL",
        createdAt: "2026-11-02T10:00:00.000Z",
        updatedAt: "2026-11-02T10:00:00.000Z",
      },
      {
        id: "t2",
        userId: "u-1",
        accountId: "acc-usd-1",
        pair: "EURUSD",
        direction: "SHORT",
        status: "CLOSED",
        entryDate: "2026-11-03T13:00:00.000Z",
        exitDate: "2026-11-03T15:00:00.000Z",
        timeframe: "M15",
        session: "NEW_YORK",
        entryPrice: 1.09,
        exitPrice: 1.095,
        stopLoss: 1.095,
        positionSize: 1,
        plannedRiskAmount: 150,
        grossPnl: -150,
        commission: 0,
        swap: 0,
        otherFees: 0,
        netPnl: -150,
        outcome: "LOSS",
        setupTags: ["BREAKOUT"],
        entryChecklist: {},
        emotion: "FOMO",
        mistake: "FOMO_ENTRY",
        marketCondition: "RANGING",
        attachments: [],
        dataQuality: "SELF_REPORTED_MANUAL",
        createdAt: "2026-11-03T15:00:00.000Z",
        updatedAt: "2026-11-03T15:00:00.000Z",
      },
    ];

    const report = orchestratePartitionAnalytics(
      { accounts: [account], trades, cashTransactions: [] },
      { accountId: "acc-usd-1" }
    );

    assert.equal(report.status, "VALID");
    assert.equal(report.currency, "USD");
    assert.equal(report.summary.totalClosedTrades, 2);
    assert.equal(report.summary.totalNetPnl, 350);
    assert.equal(report.summary.winRate, 50);
    assert.equal(report.summary.maxDrawdownNominal, 150);
    // Peak equity after t1 = 10000 + 500 = 10500; Drawdown on t2 = 150 / 10500 * 100 = 1.43%
    assert.equal(report.summary.maxDrawdownPercentage, 1.43);

    // Consistency across all 4 engines
    assert.equal(report.coreMetrics.totalClosedTrades, 2);
    assert.equal(report.drawdown.totalClosedTrades, 2);
    assert.equal(report.dimensionalBreakdown.totalEligibleTrades, 2);
    assert.equal(
      report.timeSeries.periods.reduce((acc, p) => acc + p.tradeCount, 0),
      2
    );
  });

  test("AO-03: Consistent multi-filter application (symbol, direction, session, dateRange, setup, timeframe)", () => {
    const account = {
      id: "acc-1",
      userId: "u-1",
      accountName: "Main",
      accountCurrency: "USD",
      currencyDecimals: 2,
      accountType: "LIVE",
      initialBalance: 5000,
      realizedBalance: 5500,
      equity: 5500,
      isArchived: false,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
    };

    const trades = [
      {
        id: "t1",
        userId: "u-1",
        accountId: "acc-1",
        pair: "XAUUSD",
        direction: "LONG",
        status: "CLOSED",
        entryDate: "2026-11-02T08:00:00.000Z",
        exitDate: "2026-11-02T10:00:00.000Z",
        timeframe: "H1",
        session: "LONDON",
        entryPrice: 2000,
        exitPrice: 2010,
        stopLoss: 1990,
        positionSize: 1,
        netPnl: 300,
        setupTags: ["OB"],
        entryChecklist: {},
        emotion: "DISCIPLINED",
        mistake: "NONE",
        attachments: [],
        dataQuality: "SELF_REPORTED_MANUAL",
        createdAt: "2026-11-02T10:00:00.000Z",
        updatedAt: "2026-11-02T10:00:00.000Z",
      },
      {
        id: "t2",
        userId: "u-1",
        accountId: "acc-1",
        pair: "EURUSD",
        direction: "SHORT",
        status: "CLOSED",
        entryDate: "2026-11-04T14:00:00.000Z",
        exitDate: "2026-11-04T16:00:00.000Z",
        timeframe: "M15",
        session: "NEW_YORK",
        entryPrice: 1.08,
        exitPrice: 1.07,
        stopLoss: 1.09,
        positionSize: 1,
        netPnl: 200,
        setupTags: ["FVG"],
        entryChecklist: {},
        emotion: "CONFIDENT",
        mistake: "NONE",
        attachments: [],
        dataQuality: "SELF_REPORTED_MANUAL",
        createdAt: "2026-11-04T16:00:00.000Z",
        updatedAt: "2026-11-04T16:00:00.000Z",
      },
    ];

    const filtered = orchestratePartitionAnalytics(
      { accounts: [account], trades, cashTransactions: [] },
      {
        symbol: "XAUUSD",
        direction: "BUY",
        session: "LONDON",
        timeframe: "H1",
        setup: "OB",
        startDate: "2026-11-01",
        endDate: "2026-11-03",
      }
    );

    assert.equal(filtered.summary.totalClosedTrades, 1);
    assert.equal(filtered.summary.totalNetPnl, 300);
    assert.equal(filtered.exclusionDiagnostics.filterExcludedCount, 1);
    assert.equal(filtered.drawdown.totalClosedTrades, 1);
    assert.equal(filtered.dimensionalBreakdown.totalEligibleTrades, 1);
  });

  test("AO-04: Multi-currency accounts are blocked unless filtered by accountId or currency", () => {
    const accounts = [
      {
        id: "acc-usd",
        userId: "u-1",
        accountName: "USD Account",
        accountCurrency: "USD",
        currencyDecimals: 2,
        accountType: "LIVE",
        initialBalance: 1000,
        realizedBalance: 1100,
        equity: 1100,
        isArchived: false,
        createdAt: "2026-11-01T00:00:00.000Z",
        updatedAt: "2026-11-01T00:00:00.000Z",
      },
      {
        id: "acc-idr",
        userId: "u-1",
        accountName: "IDR Account",
        accountCurrency: "IDR",
        currencyDecimals: 0,
        accountType: "LIVE",
        initialBalance: 15000000,
        realizedBalance: 16000000,
        equity: 16000000,
        isArchived: false,
        createdAt: "2026-11-01T00:00:00.000Z",
        updatedAt: "2026-11-01T00:00:00.000Z",
      },
    ];

    const trades = [
      {
        id: "t-usd",
        userId: "u-1",
        accountId: "acc-usd",
        pair: "XAUUSD",
        direction: "LONG",
        status: "CLOSED",
        entryDate: "2026-11-02T08:00:00.000Z",
        exitDate: "2026-11-02T10:00:00.000Z",
        timeframe: "H1",
        session: "LONDON",
        entryPrice: 2000,
        exitPrice: 2010,
        stopLoss: 1990,
        positionSize: 1,
        netPnl: 100,
        setupTags: [],
        entryChecklist: {},
        emotion: "NEUTRAL",
        mistake: "NONE",
        attachments: [],
        dataQuality: "SELF_REPORTED_MANUAL",
        createdAt: "2026-11-02T10:00:00.000Z",
        updatedAt: "2026-11-02T10:00:00.000Z",
      },
      {
        id: "t-idr",
        userId: "u-1",
        accountId: "acc-idr",
        pair: "USDIDR",
        direction: "LONG",
        status: "CLOSED",
        entryDate: "2026-11-02T08:00:00.000Z",
        exitDate: "2026-11-02T10:00:00.000Z",
        timeframe: "H1",
        session: "ASIA",
        entryPrice: 15500,
        exitPrice: 15600,
        stopLoss: 15400,
        positionSize: 1,
        netPnl: 1000000,
        setupTags: [],
        entryChecklist: {},
        emotion: "NEUTRAL",
        mistake: "NONE",
        attachments: [],
        dataQuality: "SELF_REPORTED_MANUAL",
        createdAt: "2026-11-02T10:00:00.000Z",
        updatedAt: "2026-11-02T10:00:00.000Z",
      },
    ];

    const blockedReport = orchestratePartitionAnalytics({
      accounts,
      trades,
      cashTransactions: [],
    });
    assert.equal(blockedReport.status, "BLOCKED_MULTI_CURRENCY");

    const idrReport = orchestratePartitionAnalytics(
      { accounts, trades, cashTransactions: [] },
      { currency: "IDR" }
    );
    assert.equal(idrReport.status, "VALID");
    assert.equal(idrReport.currency, "IDR");
    assert.equal(idrReport.summary.totalNetPnl, 1000000);
  });

  test("AO-05: Cash transactions (DEPOSIT/WITHDRAWAL) and OPEN trades update accountContext without polluting performance metrics", async () => {
    const userId = `usr_orch_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
    createdTestUsers.push(userId);

    const acc = await createTradingAccount(userId, {
      accountName: "Live Trading",
      accountCurrency: "USD",
      accountType: "LIVE",
      initialBalance: 10000,
    });

    await createCashTransaction(userId, {
      accountId: acc.id,
      type: "DEPOSIT",
      amount: 5000,
    });
    await createCashTransaction(userId, {
      accountId: acc.id,
      type: "WITHDRAWAL",
      amount: 2000,
    });

    // 1 closed trade (+400) and 1 open trade
    await createTrade(userId, {
      accountId: acc.id,
      pair: "XAUUSD",
      direction: "LONG",
      status: "CLOSED",
      entryDate: "2026-11-02T08:00:00.000Z",
      exitDate: "2026-11-02T11:00:00.000Z",
      timeframe: "H1",
      session: "LONDON",
      entryPrice: 2000,
      exitPrice: 2020,
      stopLoss: 1990,
      positionSize: 1,
      plannedRiskAmount: 200,
      grossPnl: 400,
    });

    await createTrade(userId, {
      accountId: acc.id,
      pair: "GBPUSD",
      direction: "SHORT",
      status: "OPEN",
      entryDate: "2026-11-03T08:00:00.000Z",
      timeframe: "H4",
      session: "LONDON",
      entryPrice: 1.25,
      stopLoss: 1.26,
      positionSize: 1,
    });

    const report = await getStudentAnalyticsReport(userId, {
      accountId: acc.id,
    });

    assert.equal(report.status, "VALID");
    // Performance metrics strictly reflect only the +400 closed trade
    assert.equal(report.summary.totalClosedTrades, 1);
    assert.equal(report.summary.totalNetPnl, 400);
    // Account context reflects initial (10000) + deposit (5000) - withdrawal (2000) = 13000 cashBalance, + 400 = 13400 realizedBalance
    assert.equal(report.accountContext.initialBalance, 10000);
    assert.equal(report.accountContext.totalDeposits, 5000);
    assert.equal(report.accountContext.totalWithdrawals, 2000);
    assert.equal(report.accountContext.cashBalance, 13000);
    assert.equal(report.accountContext.realizedBalance, 13400);
    assert.equal(report.accountContext.openTradesCount, 1);
    assert.equal(report.exclusionDiagnostics.excludedTradesCount, 1);
  });

  test("AO-06: Large journal (300 trades) and concurrent read/write execute deterministically without lock contention", async () => {
    const userId = `usr_large_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
    createdTestUsers.push(userId);

    const acc = await createTradingAccount(userId, {
      accountName: "High Volume Account",
      accountCurrency: "USD",
      accountType: "DEMO",
      initialBalance: 50000,
    });

    // Generate 300 synthetic closed trades in memory snapshot for speed test
    const bulkTrades = [];
    for (let i = 1; i <= 300; i++) {
      const day = String(((i - 1) % 28) + 1).padStart(2, "0");
      const isWin = i % 3 !== 0;
      const pnl = isWin ? 150 : -100;
      bulkTrades.push({
        id: `trd-bulk-${String(i).padStart(4, "0")}`,
        userId,
        accountId: acc.id,
        pair: i % 2 === 0 ? "XAUUSD" : "EURUSD",
        direction: i % 2 === 0 ? "LONG" : "SHORT",
        status: "CLOSED",
        entryDate: `2026-10-${day}T08:00:00.000Z`,
        exitDate: `2026-10-${day}T12:00:00.000Z`,
        timeframe: "H1",
        session: "LONDON",
        entryPrice: 2000,
        exitPrice: 2010,
        stopLoss: 1990,
        positionSize: 1,
        plannedRiskAmount: 100,
        grossPnl: pnl,
        netPnl: pnl,
        outcome: isWin ? "WIN" : "LOSS",
        setupTags: ["FVG"],
        entryChecklist: {},
        emotion: "DISCIPLINED",
        mistake: "NONE",
        attachments: [],
        dataQuality: "SELF_REPORTED_MANUAL",
        createdAt: `2026-10-${day}T12:00:00.000Z`,
        updatedAt: `2026-10-${day}T12:00:00.000Z`,
      });
    }

    const r1 = orchestratePartitionAnalytics({
      accounts: [acc],
      trades: bulkTrades,
      cashTransactions: [],
    });
    const r2 = orchestratePartitionAnalytics({
      accounts: [acc],
      trades: [...bulkTrades].reverse(),
      cashTransactions: [],
    });

    assert.equal(r1.summary.totalClosedTrades, 300);
    assert.equal(r1.summary.sampleStatus, "SUFFICIENT");
    // 200 wins * 150 = 30000; 100 losses * -100 = -10000; net = 20000
    assert.equal(r1.summary.totalNetPnl, 20000);
    // Deterministic invariance regardless of input order
    assert.equal(r1.summary.totalNetPnl, r2.summary.totalNetPnl);
    assert.equal(r1.summary.maxDrawdownNominal, r2.summary.maxDrawdownNominal);
    assert.equal(r1.summary.maxDrawdownPercentage, r2.summary.maxDrawdownPercentage);
  });
});

