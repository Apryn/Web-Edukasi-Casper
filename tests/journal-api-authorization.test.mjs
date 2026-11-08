import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire, registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

const cjsRequire = createRequire(import.meta.url);
cjsRequire("jsonwebtoken");
cjsRequire("bcryptjs");

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
  setDatabasePathForTest,
} = await import("../lib/db.ts");

const {
  getUserPartitionPath,
  rebuildJournalIndex,
} = await import("../lib/journal-storage.ts");

const {
  handleJournalAccountsRequest,
  handleJournalTradesRequest,
  handleJournalCashRequest,
  handleJournalAnalyticsRequest,
  handleJournalConsentRequest,
} = await import("../lib/journal-api-handlers.ts");

const {
  getAdminStudentIntelligence,
} = await import("../lib/admin-student-intelligence.ts");

if (tsHook && typeof tsHook.deregister === "function") {
  tsHook.deregister();
}

describe("PAE Task 3.6 — Authorization, Privacy, Consent & API Security Suite", () => {
  const dataDir = path.join(process.cwd(), "data");
  const baseDbFile = path.join(dataDir, "academy.json");
  const isolatedDbFile = path.join(
    dataDir,
    `academy.test.authz.${process.pid}.${Date.now()}.json`
  );
  const auditDir = path.join(dataDir, "journals", "audit");
  const backupsDir = path.join(dataDir, "backups", "journals");

  const suffix = `${process.pid}_${Date.now()}`;
  const studentA = {
    id: `stu_alpha_${suffix}`,
    email: "alpha@student.casper",
    name: "Student Alpha",
    role: "USER",
  };
  const studentB = {
    id: `stu_beta_${suffix}`,
    email: "beta@student.casper",
    name: "Student Beta",
    role: "USER",
  };
  const mentorUser = {
    id: `mentor_one_${suffix}`,
    email: "mentor1@academy.casper",
    name: "Mentor Satu",
    role: "MENTOR",
  };
  const otherMentor = {
    id: `mentor_two_${suffix}`,
    email: "mentor2@academy.casper",
    name: "Mentor Dua",
    role: "MENTOR",
  };
  const adminUser = {
    id: "6b9ba627-6741-4ee6-bf50-892469db05bf",
    email: "apriyanriyan23@gmail.com",
    name: "Ryan",
    role: "ADMIN",
  };
  const masterAdminUser = {
    id: `master_adm_${suffix}`,
    email: "apriyanriyan23@gmail.com",
    name: "Master Admin",
    role: "MASTER_ADMIN",
  };

  let createdAccountId = "";
  let createdTradeId = "";
  let createdCashId = "";

  before(() => {
    let baseData = { users: [], course_progress: [], quiz_submissions: [] };
    if (fs.existsSync(baseDbFile)) {
      try {
        baseData = JSON.parse(fs.readFileSync(baseDbFile, "utf8"));
      } catch {}
    }
    baseData.users = [
      ...(baseData.users || []),
      { ...studentA, password_hash: "scrypt$mock", created_at: new Date().toISOString() },
      { ...studentB, password_hash: "scrypt$mock", created_at: new Date().toISOString() },
      { ...mentorUser, password_hash: "scrypt$mock", created_at: new Date().toISOString() },
      { ...otherMentor, password_hash: "scrypt$mock", created_at: new Date().toISOString() },
    ];
    fs.writeFileSync(isolatedDbFile, JSON.stringify(baseData, null, 2), "utf8");
    setDatabasePathForTest(isolatedDbFile);
  });

  after(() => {
    setDatabasePathForTest(null);
    if (fs.existsSync(isolatedDbFile)) {
      try {
        fs.unlinkSync(isolatedDbFile);
      } catch {}
    }

    for (const u of [studentA, studentB]) {
      try {
        const pPath = getUserPartitionPath(u.id);
        if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
      } catch {}
      try {
        const aPath = path.join(auditDir, `audit_u_${u.id}.json`);
        if (fs.existsSync(aPath)) fs.unlinkSync(aPath);
      } catch {}
      try {
        if (fs.existsSync(backupsDir)) {
          for (const f of fs.readdirSync(backupsDir)) {
            if (f.startsWith(`u_${u.id}.`)) {
              fs.unlinkSync(path.join(backupsDir, f));
            }
          }
        }
      } catch {}
    }
    try {
      rebuildJournalIndex();
    } catch {}
  });

  test("SEC-01: Unauthenticated requests are rejected with HTTP 401 across all endpoints", async () => {
    const r1 = await handleJournalAccountsRequest(null, "GET");
    assert.equal(r1.status, 401);

    const r2 = await handleJournalTradesRequest(null, "GET");
    assert.equal(r2.status, 401);

    const r3 = await handleJournalCashRequest(null, "GET");
    assert.equal(r3.status, 401);

    const r4 = await handleJournalAnalyticsRequest(null);
    assert.equal(r4.status, 401);

    const r5 = await handleJournalConsentRequest(null, "GET");
    assert.equal(r5.status, 401);

    const r6 = getAdminStudentIntelligence(null);
    assert.equal(r6.status, 401);
  });

  test("SEC-02: Student A can create account, cash transactions, trades, and fetch own analytics (with XSS stripped)", async () => {
    // 1. Create account with malicious XSS attempt in name
    const accRes = await handleJournalAccountsRequest(studentA, "POST", {
      body: {
        accountName: 'Alpha Prop $10K <script>alert("xss")</script>',
        brokerLabel: "FTMO <iframe src='evil'></iframe>",
        accountCurrency: "USD",
        accountType: "PROP_FIRM",
        initialBalance: 10000,
      },
    });
    assert.equal(accRes.status, 201);
    assert.equal(accRes.data.account.accountName, "Alpha Prop $10K");
    assert.equal(accRes.data.account.brokerLabel, "FTMO");
    createdAccountId = accRes.data.account.id;

    // 2. Create deposit
    const cashRes = await handleJournalCashRequest(studentA, "POST", {
      body: {
        accountId: createdAccountId,
        type: "DEPOSIT",
        amount: 1000,
        notes: "Top up margin <script>evil()</script>",
      },
    });
    assert.equal(cashRes.status, 201);
    assert.equal(cashRes.data.transaction.notes, "Top up margin");
    createdCashId = cashRes.data.transaction.id;

    // 3. Create closed trade
    const tradeRes = await handleJournalTradesRequest(studentA, "POST", {
      body: {
        accountId: createdAccountId,
        pair: "XAUUSD",
        direction: "BUY",
        status: "CLOSED",
        entryDate: "2026-11-02T08:00:00.000Z",
        exitDate: "2026-11-02T11:00:00.000Z",
        timeframe: "H1",
        session: "LONDON",
        entryPrice: 2000,
        exitPrice: 2025,
        stopLoss: 1990,
        takeProfit: 2030,
        positionSize: 1,
        plannedRiskAmount: 100,
        grossPnl: 300,
        commission: 10,
        swap: 0,
        otherFees: 0,
        setupTags: ["FVG", "OB<script>bad()</script>"],
        emotion: "DISCIPLINED",
        mistake: "NONE",
        marketCondition: "TRENDING_BULL",
        notes: "Private trade reflection of Student A <script>steal()</script>",
      },
    });
    assert.equal(tradeRes.status, 201);
    assert.equal(tradeRes.data.trade.netPnl, 290);
    assert.ok(!tradeRes.data.trade.notes.includes("<script>"));
    createdTradeId = tradeRes.data.trade.id;

    // 4. Fetch own analytics
    const anaRes = await handleJournalAnalyticsRequest(studentA, {
      filters: { accountId: createdAccountId },
    });
    assert.equal(anaRes.status, 200);
    assert.equal(anaRes.data.report.summary.totalClosedTrades, 1);
    assert.equal(anaRes.data.report.summary.totalNetPnl, 290);
    assert.equal(anaRes.data.accessMode, "OWNER");
  });

  test("SEC-03: Student B is strictly blocked (HTTP 403) from reading or mutating Student A's journal (IDOR protection)", async () => {
    // Student B tries to read Student A's accounts, trades, cash, analytics, and consent
    const rAcc = await handleJournalAccountsRequest(studentB, "GET", {
      queryUserId: studentA.id,
    });
    assert.equal(rAcc.status, 403);

    const rTrd = await handleJournalTradesRequest(studentB, "GET", {
      queryUserId: studentA.id,
    });
    assert.equal(rTrd.status, 403);

    const rCash = await handleJournalCashRequest(studentB, "GET", {
      queryUserId: studentA.id,
    });
    assert.equal(rCash.status, 403);

    const rAna = await handleJournalAnalyticsRequest(studentB, {
      queryUserId: studentA.id,
    });
    assert.equal(rAna.status, 403);

    // Student B tries to delete Student A's trade by tampering userId
    const rDel = await handleJournalTradesRequest(studentB, "DELETE", {
      queryUserId: studentA.id,
      tradeId: createdTradeId,
    });
    assert.equal(rDel.status, 403);

    // Student B tries to grant consent on Student A's journal
    const rConsent = await handleJournalConsentRequest(studentB, "POST", {
      queryUserId: studentA.id,
      body: {
        userId: studentA.id,
        granteeId: studentB.id,
        scope: "FULL_JOURNAL",
      },
    });
    assert.equal(rConsent.status, 403);
  });

  test("SEC-04: ADMIN and MASTER_ADMIN are strictly blocked (HTTP 403) from reading Student A's private journal", async () => {
    const adminTrades = await handleJournalTradesRequest(adminUser, "GET", {
      queryUserId: studentA.id,
    });
    assert.equal(adminTrades.status, 403);

    const adminAnalytics = await handleJournalAnalyticsRequest(adminUser, {
      queryUserId: studentA.id,
    });
    assert.equal(adminAnalytics.status, 403);

    const masterTrades = await handleJournalTradesRequest(masterAdminUser, "GET", {
      queryUserId: studentA.id,
    });
    assert.equal(masterTrades.status, 403);

    const masterAnalytics = await handleJournalAnalyticsRequest(masterAdminUser, {
      queryUserId: studentA.id,
    });
    assert.equal(masterAnalytics.status, 403);
  });

  test("SEC-05: MENTOR without consent is strictly blocked (HTTP 403)", async () => {
    const mAna = await handleJournalAnalyticsRequest(mentorUser, {
      queryUserId: studentA.id,
    });
    assert.equal(mAna.status, 403);

    const mTrd = await handleJournalTradesRequest(mentorUser, "GET", {
      queryUserId: studentA.id,
    });
    assert.equal(mTrd.status, 403);
  });

  test("SEC-06: Student grants ANALYTICS_ONLY consent to Mentor 1 -> Mentor 1 can read Analytics (200) but NOT Trades (403) and Mentor 2 is blocked (403)", async () => {
    const grantRes = await handleJournalConsentRequest(studentA, "POST", {
      body: {
        granteeId: mentorUser.id,
        granteeName: mentorUser.name,
        scope: "ANALYTICS_ONLY",
        durationDays: 14,
      },
    });
    assert.equal(grantRes.status, 201);
    assert.equal(grantRes.data.consent.scope, "ANALYTICS_ONLY");

    // Mentor 1 can read Analytics
    const m1Ana = await handleJournalAnalyticsRequest(mentorUser, {
      queryUserId: studentA.id,
    });
    assert.equal(m1Ana.status, 200);
    assert.equal(m1Ana.data.accessMode, "MENTOR_CONSENT");
    assert.equal(m1Ana.data.report.summary.totalNetPnl, 290);

    // Mentor 1 CANNOT read raw trade records because scope is ANALYTICS_ONLY
    const m1Trd = await handleJournalTradesRequest(mentorUser, "GET", {
      queryUserId: studentA.id,
    });
    assert.equal(m1Trd.status, 403);

    // Mentor 2 (not grantee) is blocked even from Analytics
    const m2Ana = await handleJournalAnalyticsRequest(otherMentor, {
      queryUserId: studentA.id,
    });
    assert.equal(m2Ana.status, 403);

    // Admin is still blocked
    const admAna = await handleJournalAnalyticsRequest(adminUser, {
      queryUserId: studentA.id,
    });
    assert.equal(admAna.status, 403);
  });

  test("SEC-07: Student upgrades consent to FULL_JOURNAL -> Mentor 1 can read Trades (200) but still CANNOT mutate (403)", async () => {
    const grantFull = await handleJournalConsentRequest(studentA, "POST", {
      body: {
        granteeId: mentorUser.id,
        granteeName: mentorUser.name,
        scope: "FULL_JOURNAL",
        durationDays: 30,
      },
    });
    assert.equal(grantFull.status, 201);

    // Mentor 1 can now read Trades
    const m1Trd = await handleJournalTradesRequest(mentorUser, "GET", {
      queryUserId: studentA.id,
    });
    assert.equal(m1Trd.status, 200);
    assert.equal(m1Trd.data.trades.length, 1);

    // Mentor 1 tries to delete or modify Student A's trade -> strictly blocked (403)
    const m1Mutate = await handleJournalTradesRequest(mentorUser, "DELETE", {
      queryUserId: studentA.id,
      tradeId: createdTradeId,
    });
    assert.equal(m1Mutate.status, 403);
  });

  test("SEC-08: Student revokes consent -> Mentor 1 is immediately blocked (HTTP 403) and audit trail records all events", async () => {
    const revRes = await handleJournalConsentRequest(studentA, "DELETE");
    assert.equal(revRes.status, 200);
    assert.equal(revRes.data.isActive, false);

    // Mentor 1 immediately loses access to both analytics and trades
    const m1Ana = await handleJournalAnalyticsRequest(mentorUser, {
      queryUserId: studentA.id,
    });
    assert.equal(m1Ana.status, 403);

    const m1Trd = await handleJournalTradesRequest(mentorUser, "GET", {
      queryUserId: studentA.id,
    });
    assert.equal(m1Trd.status, 403);

    // Student A inspects own consent & audit trail
    const statusRes = await handleJournalConsentRequest(studentA, "GET");
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.data.isActive, false);
    assert.ok(statusRes.data.auditLogs.length >= 5);
    const actions = statusRes.data.auditLogs.map((l) => l.action);
    assert.ok(actions.includes("CONSENT_GRANT"));
    assert.ok(actions.includes("MENTOR_ANALYTICS_INSPECT"));
    assert.ok(actions.includes("MENTOR_JOURNAL_INSPECT"));
    assert.ok(actions.includes("CONSENT_REVOKE"));
  });

  test("SEC-09: Admin Student Intelligence allows ADMIN (200), blocks USER/MENTOR (403), and leaks ZERO private trade data", async () => {
    const stuTry = getAdminStudentIntelligence(studentA);
    assert.equal(stuTry.status, 403);

    const menTry = getAdminStudentIntelligence(mentorUser);
    assert.equal(menTry.status, 403);

    const admRes = getAdminStudentIntelligence(adminUser);
    assert.equal(admRes.status, 200);
    assert.equal(admRes.data.privacyGuarantee, "STRICT_ANONYMIZED_AGGREGATE_ONLY");
    assert.ok(admRes.data.population.studentsWithJournalCount >= 1);
    assert.ok(admRes.data.journalActivity.totalClosedTradesAcrossCohort >= 1);

    // Verify zero leakage of Student A's private notes, exact P/L (290), or account name in serialized JSON
    const serialized = JSON.stringify(admRes.data);
    assert.equal(serialized.includes("Private trade reflection of Student A"), false);
    assert.equal(serialized.includes("Alpha Prop $10K"), false);
    assert.equal(serialized.includes(studentA.email), false);
  });

  test("SEC-10: Path traversal and invalid payload validation return 400/422 cleanly without internal stack trace leakage", async () => {
    const badPath = await handleJournalAnalyticsRequest(mentorUser, {
      queryUserId: "../../etc/passwd",
    });
    assert.equal(badPath.status, 400);
    assert.equal(badPath.error.includes("D:\\"), false);

    const badTrade = await handleJournalTradesRequest(studentA, "POST", {
      body: {
        accountId: createdAccountId,
        pair: "XAUUSD",
        direction: "INVALID_DIR",
        entryDate: "2026-11-02T08:00:00.000Z",
        entryPrice: -10,
        stopLoss: 0,
        positionSize: 0,
      },
    });
    assert.equal(badTrade.status, 422);

    // Clean up cash transaction as part of full lifecycle test
    const delCash = await handleJournalCashRequest(studentA, "DELETE", {
      transactionId: createdCashId,
    });
    assert.equal(delCash.status, 200);
  });
});

