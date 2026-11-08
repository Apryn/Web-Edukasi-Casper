/**
 * SIGNAL CASPER ACADEMY — SPRINT 3 FINAL END-TO-END QA & INTEGRATION SUITE
 * Task 3.7: Full Workflow, Analytics Consistency, Privacy/Consent, Admin Intelligence & UI Verification
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire, registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

const cjsRequire = createRequire(import.meta.url);
cjsRequire("jsonwebtoken");
cjsRequire("bcryptjs");

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

const { setDatabasePathForTest } = await import("../lib/db.ts");
const { getUserPartitionPath, rebuildJournalIndex } = await import(
  "../lib/journal-storage.ts"
);
const {
  handleJournalAccountsRequest,
  handleJournalTradesRequest,
  handleJournalCashRequest,
  handleJournalAnalyticsRequest,
  handleJournalConsentRequest,
} = await import("../lib/journal-api-handlers.ts");
const { getAdminStudentIntelligence } = await import(
  "../lib/admin-student-intelligence.ts"
);

const DATA_DIR = path.join(process.cwd(), "data");
const TEST_DB_FILE = path.join(
  DATA_DIR,
  `test_academy_sprint3_qa_${process.pid}_${Date.now()}.json`
);

const STUDENT_ID = `qa37_student_${crypto.randomUUID().slice(0, 8)}`;
const MENTOR_ID = `qa37_mentor_${crypto.randomUUID().slice(0, 8)}`;
const ADMIN_ID = "6b9ba627-6741-4ee6-bf50-892469db05bf";

const studentActor = {
  id: STUDENT_ID,
  email: "student.qa37@casper.academy",
  name: "Siswa QA Sprint 3",
  role: "USER",
  created_at: new Date().toISOString(),
};

const mentorActor = {
  id: MENTOR_ID,
  email: "mentor.qa37@casper.academy",
  name: "Mentor QA Sprint 3",
  role: "MENTOR",
  created_at: new Date().toISOString(),
};

const adminActor = {
  id: ADMIN_ID,
  email: "apriyanriyan23@gmail.com",
  name: "Master Admin",
  role: "ADMIN",
  created_at: new Date().toISOString(),
};

function cleanupAuditFile(userId) {
  const auditPath = path.join(DATA_DIR, "journals", "audit", `audit_u_${userId}.json`);
  try {
    if (fs.existsSync(auditPath)) fs.unlinkSync(auditPath);
  } catch {
    // Ignore
  }
}

describe("Sprint 3 Task 3.7 — End-to-End Integration, Security & QA Suite", () => {
  let createdAccountId = "";
  let createdCashDepositId = "";
  let openTradeId = "";
  let tempTradeToDeleteId = "";

  before(() => {
    const seedDb = {
      users: [
        { ...adminActor, password_hash: "scrypt$mock" },
        { ...mentorActor, password_hash: "scrypt$mock" },
        { ...studentActor, password_hash: "scrypt$mock" },
      ],
      course_progress: [
        {
          id: "cp-qa37-1",
          user_id: STUDENT_ID,
          course_slug: "market-structure-mastery",
          completed_lessons: ["ms-1", "ms-2"],
          quiz_scores: { "ms-quiz": 90 },
          updated_at: new Date().toISOString(),
        },
      ],
      quiz_submissions: [],
      custom_courses: [],
      admin_audit_logs: [],
    };
    fs.writeFileSync(TEST_DB_FILE, JSON.stringify(seedDb, null, 2), "utf8");
    setDatabasePathForTest(TEST_DB_FILE);
  });

  after(async () => {
    setDatabasePathForTest(null);
    try {
      const partPath = getUserPartitionPath(STUDENT_ID);
      if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
    } catch {
      // Ignore
    }
    try {
      const backupsDir = path.join(DATA_DIR, "backups", "journals");
      if (fs.existsSync(backupsDir)) {
        for (const f of fs.readdirSync(backupsDir)) {
          if (f.startsWith(`u_${STUDENT_ID}.`)) {
            fs.unlinkSync(path.join(backupsDir, f));
          }
        }
      }
    } catch {
      // Ignore
    }
    cleanupAuditFile(STUDENT_ID);
    try {
      rebuildJournalIndex();
    } catch {
      // Ignore
    }
    try {
      if (fs.existsSync(TEST_DB_FILE)) fs.unlinkSync(TEST_DB_FILE);
    } catch {
      // Ignore
    }
  });

  it("1. Student creates a Trading Account and records Deposit & Withdrawal without distorting Trading P/L", async () => {
    const accRes = await handleJournalAccountsRequest(studentActor, "POST", {
      body: {
        accountName: "FTMO $10K Evaluation",
        brokerLabel: "FTMO MT5",
        accountCurrency: "USD",
        accountType: "PROP_FIRM",
        initialBalance: 10000,
      },
    });
    assert.equal(accRes.ok, true);
    assert.equal(accRes.status, 201);
    createdAccountId = accRes.data.account.id;
    assert.ok(createdAccountId);

    const depRes = await handleJournalCashRequest(studentActor, "POST", {
      body: {
        accountId: createdAccountId,
        type: "DEPOSIT",
        amount: 2000,
        transactionDate: "2026-11-01T08:00:00.000Z",
        notes: "Top up margin",
      },
    });
    assert.equal(depRes.ok, true);
    createdCashDepositId = depRes.data.transaction.id;

    const wdRes = await handleJournalCashRequest(studentActor, "POST", {
      body: {
        accountId: createdAccountId,
        type: "WITHDRAWAL",
        amount: 500,
        transactionDate: "2026-11-01T09:00:00.000Z",
        notes: "Partial withdrawal",
      },
    });
    assert.equal(wdRes.ok, true);

    const getAccRes = await handleJournalAccountsRequest(studentActor, "GET", {});
    assert.equal(getAccRes.ok, true);
    const acc = getAccRes.data.accounts.find((a) => a.id === createdAccountId);
    assert.equal(acc.balanceSummary.initialBalance, 10000);
    assert.equal(acc.balanceSummary.cashBalance, 11500);
    assert.equal(acc.balanceSummary.realizedPnl, 0);
    assert.equal(acc.balanceSummary.realizedBalance, 11500);
  });

  it("2. Student logs OPEN and CLOSED trades, closes an OPEN trade, updates & deletes a trade", async () => {
    // 1. Create an OPEN trade
    const tOpen = await handleJournalTradesRequest(studentActor, "POST", {
      body: {
        accountId: createdAccountId,
        pair: "XAUUSD",
        direction: "LONG",
        status: "OPEN",
        entryDate: "2026-11-02T08:00:00.000Z",
        timeframe: "M15",
        session: "LONDON",
        marketCondition: "TRENDING_BULL",
        entryPrice: 2000,
        stopLoss: 1990,
        takeProfit: 2025,
        positionSize: 1.0,
        plannedRiskAmount: 100,
        setupTags: ["OB", "FVG"],
        emotion: "DISCIPLINED",
        mistake: "NONE",
        notes: "London sweep setup",
      },
    });
    assert.equal(tOpen.ok, true);
    openTradeId = tOpen.data.trade.id;

    // 2. Close the OPEN trade (+245 Net P/L: Gross 250 - Comm 5)
    const tClosed1 = await handleJournalTradesRequest(studentActor, "PATCH", {
      body: {
        action: "close",
        tradeId: openTradeId,
        exitPrice: 2025,
        exitDate: "2026-11-02T11:30:00.000Z",
        grossPnl: 250,
        commission: 5,
        swap: 0,
        otherFees: 0,
        emotion: "DISCIPLINED",
        mistake: "NONE",
        notes: "Target reached cleanly",
      },
    });
    assert.equal(tClosed1.ok, true);
    assert.equal(tClosed1.data.trade.status, "CLOSED");
    assert.equal(tClosed1.data.trade.netPnl, 245);
    assert.equal(tClosed1.data.trade.outcome, "WIN");

    // 3. Log a losing CLOSED trade (-100 Net P/L)
    const tClosed2 = await handleJournalTradesRequest(studentActor, "POST", {
      body: {
        accountId: createdAccountId,
        pair: "EURUSD",
        direction: "SHORT",
        status: "CLOSED",
        entryDate: "2026-11-03T13:00:00.000Z",
        exitDate: "2026-11-03T15:00:00.000Z",
        timeframe: "H1",
        session: "NEW_YORK",
        marketCondition: "HIGH_VOLATILITY",
        entryPrice: 1.085,
        exitPrice: 1.087,
        stopLoss: 1.087,
        takeProfit: 1.08,
        positionSize: 1.0,
        plannedRiskAmount: 100,
        grossPnl: -95,
        commission: 5,
        swap: 0,
        otherFees: 0,
        setupTags: ["Liquidity Sweep"],
        emotion: "FOMO",
        mistake: "FOMO_ENTRY",
        notes: "Entered before candle close",
      },
    });
    assert.equal(tClosed2.ok, true);
    assert.equal(tClosed2.data.trade.netPnl, -100);

    // 4. Create a temporary trade, update it, then delete it
    const tTemp = await handleJournalTradesRequest(studentActor, "POST", {
      body: {
        accountId: createdAccountId,
        pair: "GBPUSD",
        direction: "LONG",
        status: "CLOSED",
        entryDate: "2026-11-04T09:00:00.000Z",
        exitDate: "2026-11-04T10:00:00.000Z",
        timeframe: "M5",
        session: "LONDON",
        entryPrice: 1.29,
        exitPrice: 1.295,
        stopLoss: 1.288,
        positionSize: 0.5,
        grossPnl: 50,
        commission: 0,
      },
    });
    assert.equal(tTemp.ok, true);
    tempTradeToDeleteId = tTemp.data.trade.id;

    const tUpd = await handleJournalTradesRequest(studentActor, "PATCH", {
      body: {
        action: "update",
        tradeId: tempTradeToDeleteId,
        notes: "Updated note before delete",
      },
    });
    assert.equal(tUpd.ok, true);
    assert.equal(tUpd.data.trade.notes, "Updated note before delete");

    const tDel = await handleJournalTradesRequest(studentActor, "DELETE", {
      tradeId: tempTradeToDeleteId,
    });
    assert.equal(tDel.ok, true);
  });

  it("3. Analytics Orchestrator reconciles Core Metrics, Drawdown, Time-Series, and Dimensional Slicer on identical cohort", async () => {
    const anaRes = await handleJournalAnalyticsRequest(studentActor, {
      filters: {
        accountId: createdAccountId,
        timeZone: "Asia/Jakarta",
        granularity: "DAILY",
        includeEmptyPeriods: true,
      },
    });
    assert.equal(anaRes.ok, true);
    const report = anaRes.data.report;

    // 2 closed trades remain: +245 and -100 => Net P/L = +145
    assert.equal(report.summary.totalClosedTrades, 2);
    assert.equal(report.coreMetrics.totalNetPnl, 145);
    assert.equal(report.coreMetrics.expectancy.exactRationalReconciled, true);

    // Drawdown: Peak after trade 1 = +245, Trough after trade 2 = +145 => DD = 100
    // Denominator at peak = 10000 + 245 = 10245 => 100 / 10245 * 100 = 0.98%
    assert.equal(report.drawdown.maxDrawdownNominal, 100);
    assert.equal(report.drawdown.maxDrawdownPercentage, 0.98);
    assert.equal(report.drawdown.calculationStatus, "AVAILABLE");

    // Time-Series Net P/L sum matches Core Metrics
    const tsSum = report.timeSeries.periods.reduce((acc, p) => acc + p.netPnl, 0);
    assert.equal(tsSum, 145);

    // Dimensional Slicer single-valued dimensions sum to 2 trades
    const sessionTrades = report.dimensionalBreakdown.bySession.buckets.reduce(
      (acc, b) => acc + b.totalTrades,
      0
    );
    assert.equal(sessionTrades, 2);

    // Multi-tag SETUP dimension has 3 bucket assignments ("OB", "FVG", "Liquidity Sweep")
    const setupTrades = report.dimensionalBreakdown.bySetup.buckets.reduce(
      (acc, b) => acc + b.totalTrades,
      0
    );
    assert.equal(setupTrades, 3);
  });

  it("4. Enforces Privacy, Mentor Consent Scopes (ANALYTICS_ONLY vs FULL_JOURNAL), and Instant Revocation", async () => {
    // Before consent: Mentor denied
    const denied1 = await handleJournalAnalyticsRequest(mentorActor, {
      queryUserId: STUDENT_ID,
    });
    assert.equal(denied1.ok, false);
    assert.equal(denied1.status, 403);

    // Grant ANALYTICS_ONLY consent
    const grantAna = await handleJournalConsentRequest(studentActor, "POST", {
      body: {
        granteeId: MENTOR_ID,
        granteeName: mentorActor.name,
        scope: "ANALYTICS_ONLY",
        durationDays: 30,
      },
    });
    assert.equal(grantAna.ok, true);

    // Mentor can read analytics (200) but NOT raw trades (403)
    const allowedAna = await handleJournalAnalyticsRequest(mentorActor, {
      queryUserId: STUDENT_ID,
    });
    assert.equal(allowedAna.ok, true);
    assert.equal(allowedAna.status, 200);

    const deniedTrades = await handleJournalTradesRequest(mentorActor, "GET", {
      queryUserId: STUDENT_ID,
    });
    assert.equal(deniedTrades.ok, false);
    assert.equal(deniedTrades.status, 403);

    // Upgrade to FULL_JOURNAL
    await handleJournalConsentRequest(studentActor, "POST", {
      body: {
        granteeId: MENTOR_ID,
        granteeName: mentorActor.name,
        scope: "FULL_JOURNAL",
        durationDays: 30,
      },
    });

    const allowedTrades = await handleJournalTradesRequest(mentorActor, "GET", {
      queryUserId: STUDENT_ID,
    });
    assert.equal(allowedTrades.ok, true);
    assert.equal(allowedTrades.data.trades.length, 2);

    // Revoke consent -> immediately blocks Mentor
    const rev = await handleJournalConsentRequest(studentActor, "DELETE", {});
    assert.equal(rev.ok, true);

    const blockedAfterRevoke = await handleJournalAnalyticsRequest(mentorActor, {
      queryUserId: STUDENT_ID,
    });
    assert.equal(blockedAfterRevoke.ok, false);
    assert.equal(blockedAfterRevoke.status, 403);
  });

  it("5. Blocks Admin from private student journals while allowing Anonymized Admin Student Intelligence", async () => {
    // Admin blocked from reading student's private journal & analytics
    const adminBlockedTrades = await handleJournalTradesRequest(adminActor, "GET", {
      queryUserId: STUDENT_ID,
    });
    assert.equal(adminBlockedTrades.ok, false);
    assert.equal(adminBlockedTrades.status, 403);

    const adminBlockedAna = await handleJournalAnalyticsRequest(adminActor, {
      queryUserId: STUDENT_ID,
    });
    assert.equal(adminBlockedAna.ok, false);
    assert.equal(adminBlockedAna.status, 403);

    // Admin accesses anonymized cohort intelligence
    const intelRes = getAdminStudentIntelligence(adminActor);
    assert.equal(intelRes.ok, true);
    const intel = intelRes.data;
    assert.equal(intel.privacyGuarantee, "STRICT_ANONYMIZED_AGGREGATE_ONLY");
    assert.ok(intel.population.studentsWithJournalCount >= 1);
    assert.ok(intel.journalActivity.totalTradesAcrossCohort >= 2);

    const serialized = JSON.stringify(intel);
    assert.equal(serialized.includes("Target reached cleanly"), false);
    assert.equal(serialized.includes("Entered before candle close"), false);
    assert.equal(serialized.includes("FTMO $10K Evaluation"), false);
  });

  it("6. Verifies Student UI, Admin UI, Responsive CSS, and Production DB Integrity", () => {
    const workspaceCode = fs.readFileSync(
      path.join(process.cwd(), "app", "dashboard", "StudentJournalWorkspace.tsx"),
      "utf8"
    );
    assert.ok(workspaceCode.includes("Performance Analytics"));
    assert.ok(workspaceCode.includes("Dimensional Performance Breakdown"));
    assert.ok(workspaceCode.includes("Privasi Jurnal &amp; Otorisasi Mentor"));

    const adminCode = fs.readFileSync(
      path.join(process.cwd(), "app", "admin", "page.tsx"),
      "utf8"
    );
    assert.ok(adminCode.includes("Student Intelligence &amp; Jurnal Kohort"));
    assert.ok(adminCode.includes("/api/admin/journal-intelligence"));

    const cssCode = fs.readFileSync(
      path.join(process.cwd(), "app", "globals.css"),
      "utf8"
    );
    assert.ok(cssCode.includes(".journal-workspace"));
    assert.ok(cssCode.includes(".journal-kpi-grid"));
    assert.ok(cssCode.includes("@media (max-width: 640px)"));

    // Verify production data/academy.json is untouched and preserves master admin
    const prodAcademy = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "academy.json"), "utf8")
    );
    assert.equal(prodAcademy.users.length, 1);
    assert.equal(prodAcademy.users[0].email, "apriyanriyan23@gmail.com");
    assert.equal(prodAcademy.users[0].role, "ADMIN");
  });
});
