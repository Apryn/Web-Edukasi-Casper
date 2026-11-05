/**
 * SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 2 TEST SUITE
 * Trading Account & Journal Core Service Verification Tests
 *
 * Covers 27 comprehensive test cases:
 * 1. Create trading account
 * 2. Get trading accounts (filter active vs archived)
 * 3. Update account metadata
 * 4. Archive account
 * 5. Restore account
 * 6. Create trade (OPEN)
 * 7. Get trades (filtering by account, status, direction, pair)
 * 8. Update OPEN trade
 * 9. Close trade (verify Net P/L calculation and outcome)
 * 10. Cancel trade
 * 11. Delete trade & recalculate balances
 * 12. Reject trade creation on archived account (HTTP 422)
 * 13. Reject foreign/non-existent account ID (HTTP 404)
 * 14. Reject foreign/non-existent trade ID (HTTP 404)
 * 15. Reject invalid timestamps (exitDate < entryDate, malformed dates)
 * 16. Reject invalid financial values (negative prices, lots, balances)
 * 17. Preserve data quality tags (SELF_REPORTED_MANUAL / ESTIMATED_INCOMPLETE_FEES)
 * 18. Single non-overlapping fee deduction in Net P/L
 * 19. Cash transactions: Deposit & Withdrawal creation
 * 20. Cash transaction ownership & archived account block
 * 21. Optimistic concurrency version conflict (HTTP 409)
 * 22. Concurrent trade creation (10 parallel trades, 0 lost updates)
 * 23. Concurrent account updates (parallel mutations serialized)
 * 24. Tombstoned partition rejection (HTTP 410)
 * 25. Corrupted partition error handling (HTTP 503)
 * 26. Prohibit currency change when transactions exist (HTTP 422)
 * 27. Distinct balance derivations (initialBalance, cashBalance, realizedPnl, realizedBalance, equity)
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

// Register TypeScript stripping hook for native execution on Node v22
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
  createTradingAccount,
  getTradingAccounts,
  getTradingAccountById,
  updateTradingAccount,
  archiveTradingAccount,
  restoreTradingAccount,
  createTrade,
  getTrades,
  getTradeById,
  updateTrade,
  closeTrade,
  cancelTrade,
  deleteTrade,
  createCashTransaction,
  getCashTransactions,
  updateCashTransaction,
  deleteCashTransaction,
  calculateAccountBalances,
  toMinorUnits,
  toMajorUnits,
  calculateExactNetPnl,
  roundToDecimals,
  roundCurrencyAmount,
  getMaxSafeFinancialAmount,
  MAX_SAFE_INTEGER_BIGINT,
  JournalValidationError,
  JournalNotFoundError,
  ConcurrencyConflictError,
  PartitionCorruptedError,
  AccountTombstonedError,
} = await import("../lib/journal-service.ts");

const {
  getUserPartitionPath,
  getUserTombstonePath,
  ensureJournalDirectories,
  wipeUserJournal,
} = await import("../lib/journal-storage.ts");

describe("Signal Casper Academy - Trading Account & Journal Core Service Suite", () => {
  const dataDir = path.join(process.cwd(), "data");
  const journalsDir = path.join(dataDir, "journals");
  const backupsDir = path.join(dataDir, "backups", "journals");

  const userAlice = `srv_alice_${Date.now()}`;
  const userBob = `srv_bob_${Date.now()}`;
  const userConcur = `srv_concur_${Date.now()}`;
  const userTomb = `srv_tomb_${Date.now()}`;
  const userCorrupt = `srv_corrupt_${Date.now()}`;

  const createdTestUsers = [
    userAlice,
    userBob,
    userConcur,
    userTomb,
    userCorrupt,
  ];

  before(() => {
    ensureJournalDirectories();
  });

  after(() => {
    // Cleanup test partitions
    for (const u of createdTestUsers) {
      try {
        const pPath = getUserPartitionPath(u);
        if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
      } catch {}
      try {
        const tPath = getUserTombstonePath(u);
        if (fs.existsSync(tPath)) fs.unlinkSync(tPath);
      } catch {}
      try {
        const recPath = path.join(journalsDir, `u_${u}.recovery_required`);
        if (fs.existsSync(recPath)) fs.unlinkSync(recPath);
      } catch {}

      if (fs.existsSync(backupsDir)) {
        try {
          const files = fs.readdirSync(backupsDir).filter((f) => f.startsWith(`u_${u}.`));
          for (const f of files) fs.unlinkSync(path.join(backupsDir, f));
        } catch {}
      }
    }
  });

  let aliceAcc1Id = "";
  let aliceAcc2Id = "";
  let aliceTrade1Id = "";
  let aliceCash1Id = "";

  test("1. Create Trading Account: Valid DEMO & LIVE accounts with Currency Decimals", async () => {
    // Create USD Account (2 decimals)
    const acc1 = await createTradingAccount(userAlice, {
      accountName: "Alice FTMO Challenge",
      brokerLabel: "FTMO",
      accountCurrency: "USD",
      accountType: "PROP_FIRM",
      initialBalance: 100000,
    });

    assert.ok(acc1.id.startsWith("acc-"));
    assert.strictEqual(acc1.userId, userAlice);
    assert.strictEqual(acc1.accountName, "Alice FTMO Challenge");
    assert.strictEqual(acc1.accountCurrency, "USD");
    assert.strictEqual(acc1.currencyDecimals, 2);
    assert.strictEqual(acc1.initialBalance, 100000);
    assert.strictEqual(acc1.realizedBalance, 100000);
    assert.strictEqual(acc1.equity, 100000);
    assert.strictEqual(acc1.isArchived, false);
    aliceAcc1Id = acc1.id;

    // Create IDR Account (0 decimals)
    const acc2 = await createTradingAccount(userAlice, {
      accountName: "Alice Tabungan Saham IDR",
      accountCurrency: "IDR",
      accountType: "LIVE",
      initialBalance: 50000000.75, // should round to 0 decimals
    });

    assert.strictEqual(acc2.accountCurrency, "IDR");
    assert.strictEqual(acc2.currencyDecimals, 0);
    assert.strictEqual(acc2.initialBalance, 50000001); // 0 decimals rounding
    aliceAcc2Id = acc2.id;
  });

  test("2. Get Trading Accounts: Filter Active vs Archived", async () => {
    const activeAccounts = await getTradingAccounts(userAlice);
    assert.strictEqual(activeAccounts.length, 2);

    const specificAcc = await getTradingAccountById(userAlice, aliceAcc1Id);
    assert.strictEqual(specificAcc.id, aliceAcc1Id);
    assert.strictEqual(specificAcc.accountName, "Alice FTMO Challenge");
  });

  test("3. Update Account Metadata: Name, BrokerLabel, and InitialBalance", async () => {
    const updated = await updateTradingAccount(userAlice, aliceAcc1Id, {
      accountName: "Alice FTMO 100K Verified",
      brokerLabel: "FTMO MetaTrader 5",
      initialBalance: 100000.5,
    });

    assert.strictEqual(updated.accountName, "Alice FTMO 100K Verified");
    assert.strictEqual(updated.brokerLabel, "FTMO MetaTrader 5");
    assert.strictEqual(updated.initialBalance, 100000.5);
  });

  test("4. Archive Account: Soft-delete sets isArchived to true", async () => {
    const archived = await archiveTradingAccount(userAlice, aliceAcc2Id);
    assert.strictEqual(archived.isArchived, true);

    const activeList = await getTradingAccounts(userAlice, { includeArchived: false });
    assert.strictEqual(activeList.length, 1);
    assert.strictEqual(activeList[0].id, aliceAcc1Id);

    const fullList = await getTradingAccounts(userAlice, { includeArchived: true });
    assert.strictEqual(fullList.length, 2);
  });

  test("5. Restore Account: Restores archived account to active", async () => {
    const restored = await restoreTradingAccount(userAlice, aliceAcc2Id);
    assert.strictEqual(restored.isArchived, false);

    const activeList = await getTradingAccounts(userAlice);
    assert.strictEqual(activeList.length, 2);
  });

  test("6. Create Trade (OPEN): Valid parameters & normalization", async () => {
    const trade = await createTrade(userAlice, {
      accountId: aliceAcc1Id,
      pair: "XAUUSD",
      direction: "BUY", // Should normalize to LONG
      status: "OPEN",
      entryDate: new Date().toISOString(),
      timeframe: "H1",
      session: "LONDON",
      entryPrice: 2350.5,
      stopLoss: 2340.0,
      takeProfit: 2370.0,
      positionSize: 1.0,
      plannedRiskAmount: 1050.0,
      setupTags: ["ORDER_BLOCK", "FVG"],
      entryChecklist: { confirmedBreak: true, htfTrendAligned: true },
      emotion: "DISCIPLINED",
      notes: "Clean London session sweep of Asian low.",
    });

    assert.ok(trade.id.startsWith("trd-"));
    assert.strictEqual(trade.pair, "XAUUSD");
    assert.strictEqual(trade.direction, "LONG");
    assert.strictEqual(trade.status, "OPEN");
    assert.strictEqual(trade.outcome, undefined);
    assert.strictEqual(trade.netPnl, undefined);
    aliceTrade1Id = trade.id;
  });

  test("7. Get Trades: Filter by account, status, direction, and pair", async () => {
    const allTrades = await getTrades(userAlice);
    assert.strictEqual(allTrades.length, 1);

    const filteredOpen = await getTrades(userAlice, { status: "OPEN" });
    assert.strictEqual(filteredOpen.length, 1);

    const filteredShort = await getTrades(userAlice, { direction: "SHORT" });
    assert.strictEqual(filteredShort.length, 0);

    const singleTrade = await getTradeById(userAlice, aliceTrade1Id);
    assert.strictEqual(singleTrade.id, aliceTrade1Id);
    assert.strictEqual(singleTrade.pair, "XAUUSD");
  });

  test("8. Update OPEN Trade: Adjust StopLoss and Notes", async () => {
    const updated = await updateTrade(userAlice, aliceTrade1Id, {
      stopLoss: 2345.0, // Trailing stop
      notes: "Trailing stop moved to 2345 to lock in partial risk reduction.",
    });

    assert.strictEqual(updated.stopLoss, 2345.0);
    assert.ok(updated.notes?.includes("Trailing stop"));
  });

  test("9. Close Trade: Computes Net P/L, outcome, and re-derives account balance", async () => {
    const closed = await closeTrade(userAlice, aliceTrade1Id, {
      exitPrice: 2365.0,
      exitDate: new Date().toISOString(),
      grossPnl: 1450.0,
      commission: 7.0,
      swap: -2.5, // financing debit
      otherFees: 0.5,
      emotion: "CONFIDENT",
      mistake: "NONE",
      dataQuality: "SELF_REPORTED_MANUAL",
    });

    assert.strictEqual(closed.status, "CLOSED");
    assert.strictEqual(closed.exitPrice, 2365.0);
    // Net P/L = 1450.0 - 7.0 + (-2.5) - 0.5 = 1440.0
    assert.strictEqual(closed.netPnl, 1440.0);
    assert.strictEqual(closed.outcome, "WIN");
    assert.strictEqual(closed.dataQuality, "SELF_REPORTED_MANUAL");

    // Verify account balance was updated
    const acc = await getTradingAccountById(userAlice, aliceAcc1Id);
    // initialBalance was 100000.5, net profit 1440.0 -> realizedBalance = 101440.5
    assert.strictEqual(acc.realizedBalance, 101440.5);
    assert.strictEqual(acc.equity, 101440.5);
  });

  test("10. Cancel Trade: Clear P/L and set status CANCELLED", async () => {
    const pendingTrade = await createTrade(userAlice, {
      accountId: aliceAcc1Id,
      pair: "EURUSD",
      direction: "SHORT",
      status: "OPEN",
      entryDate: new Date().toISOString(),
      timeframe: "M15",
      session: "NEW_YORK",
      entryPrice: 1.085,
      stopLoss: 1.088,
      positionSize: 2.0,
    });

    const cancelled = await cancelTrade(userAlice, pendingTrade.id);
    assert.strictEqual(cancelled.status, "CANCELLED");
    assert.strictEqual(cancelled.netPnl, 0);
    assert.strictEqual(cancelled.outcome, undefined);
  });

  test("11. Delete Trade: Permanently removes trade and recalibrates account balance", async () => {
    const tempTrade = await createTrade(userAlice, {
      accountId: aliceAcc1Id,
      pair: "GBPUSD",
      direction: "LONG",
      status: "CLOSED",
      entryDate: new Date().toISOString(),
      exitDate: new Date().toISOString(),
      timeframe: "H1",
      session: "LONDON",
      entryPrice: 1.27,
      exitPrice: 1.28,
      stopLoss: 1.265,
      positionSize: 1.0,
      grossPnl: 1000.0,
      commission: 5.0,
    });

    const accBeforeDelete = await getTradingAccountById(userAlice, aliceAcc1Id);
    const balanceBefore = accBeforeDelete.realizedBalance;

    const delRes = await deleteTrade(userAlice, tempTrade.id);
    assert.strictEqual(delRes.deleted, true);

    const accAfterDelete = await getTradingAccountById(userAlice, aliceAcc1Id);
    // 1000 - 5 = 995 net profit should have been deducted from account balance
    assert.strictEqual(
      accAfterDelete.realizedBalance,
      balanceBefore - (1000.0 - 5.0)
    );
  });

  test("12. Reject Trade on Archived Account: Throws JournalValidationError (422)", async () => {
    // Re-archive account 2
    await archiveTradingAccount(userAlice, aliceAcc2Id);

    await assert.rejects(
      createTrade(userAlice, {
        accountId: aliceAcc2Id,
        pair: "USDIDR",
        direction: "LONG",
        entryDate: new Date().toISOString(),
        timeframe: "D1",
        session: "ASIA",
        entryPrice: 16200,
        stopLoss: 16100,
        positionSize: 1.0,
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("archived"));
        return true;
      }
    );

    // Restore back
    await restoreTradingAccount(userAlice, aliceAcc2Id);
  });

  test("13. Reject Foreign/Non-Existent Account ID: Throws JournalNotFoundError (404)", async () => {
    await assert.rejects(
      createTrade(userAlice, {
        accountId: "acc-non-existent-9999",
        pair: "EURUSD",
        direction: "LONG",
        entryDate: new Date().toISOString(),
        timeframe: "M5",
        session: "LONDON",
        entryPrice: 1.08,
        stopLoss: 1.075,
        positionSize: 1.0,
      }),
      (err) => {
        assert.ok(err instanceof JournalNotFoundError);
        assert.strictEqual(err.statusCode, 404);
        return true;
      }
    );
  });

  test("14. Reject Foreign Trade ID: Cross-user isolation (Alice cannot view Bob's trade)", async () => {
    // Create Bob's account and trade
    const bobAcc = await createTradingAccount(userBob, {
      accountName: "Bob Private Account",
      accountCurrency: "USD",
      accountType: "DEMO",
      initialBalance: 5000,
    });

    const bobTrade = await createTrade(userBob, {
      accountId: bobAcc.id,
      pair: "AUDUSD",
      direction: "LONG",
      entryDate: new Date().toISOString(),
      timeframe: "H4",
      session: "ASIA",
      entryPrice: 0.65,
      stopLoss: 0.645,
      positionSize: 0.5,
    });

    // Alice attempts to get Bob's trade
    await assert.rejects(
      getTradeById(userAlice, bobTrade.id),
      (err) => {
        assert.ok(err instanceof JournalNotFoundError);
        assert.strictEqual(err.statusCode, 404);
        return true;
      }
    );

    // Alice attempts to update Bob's trade
    await assert.rejects(
      updateTrade(userAlice, bobTrade.id, { stopLoss: 0.64 }),
      (err) => {
        assert.ok(err instanceof JournalNotFoundError);
        assert.strictEqual(err.statusCode, 404);
        return true;
      }
    );
  });

  test("15. Reject Invalid Timestamps: exitDate < entryDate and malformed dates", async () => {
    const entryDate = "2026-11-05T10:00:00.000Z";
    const invalidExit = "2026-11-05T09:00:00.000Z"; // 1 hour earlier

    await assert.rejects(
      createTrade(userAlice, {
        accountId: aliceAcc1Id,
        pair: "XAUUSD",
        direction: "SHORT",
        status: "CLOSED",
        entryDate,
        exitDate: invalidExit,
        timeframe: "H1",
        session: "LONDON",
        entryPrice: 2350,
        exitPrice: 2340,
        stopLoss: 2360,
        positionSize: 1.0,
        grossPnl: 1000,
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("exitDate cannot be earlier"));
        return true;
      }
    );

    // Malformed date
    await assert.rejects(
      createTrade(userAlice, {
        accountId: aliceAcc1Id,
        pair: "XAUUSD",
        direction: "SHORT",
        entryDate: "not-a-valid-date",
        timeframe: "H1",
        session: "LONDON",
        entryPrice: 2350,
        stopLoss: 2360,
        positionSize: 1.0,
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        return true;
      }
    );
  });

  test("16. Reject Invalid Financial Values: Negative prices, lots, and balances", async () => {
    // Negative initial balance
    await assert.rejects(
      createTradingAccount(userAlice, {
        accountName: "Bad Account",
        accountCurrency: "USD",
        accountType: "DEMO",
        initialBalance: -500,
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        return true;
      }
    );

    // Negative lot size
    await assert.rejects(
      createTrade(userAlice, {
        accountId: aliceAcc1Id,
        pair: "EURUSD",
        direction: "LONG",
        entryDate: new Date().toISOString(),
        timeframe: "H1",
        session: "LONDON",
        entryPrice: 1.08,
        stopLoss: 1.075,
        positionSize: -1.0,
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        return true;
      }
    );
  });

  test("17. Preserve Manual P&L Quality Tag: SELF_REPORTED_MANUAL & ESTIMATED_INCOMPLETE_FEES", async () => {
    const tradeManual = await createTrade(userAlice, {
      accountId: aliceAcc1Id,
      pair: "BTCUSD",
      direction: "LONG",
      status: "CLOSED",
      entryDate: new Date().toISOString(),
      exitDate: new Date().toISOString(),
      timeframe: "D1",
      session: "NEW_YORK",
      entryPrice: 65000,
      exitPrice: 67000,
      stopLoss: 63000,
      positionSize: 0.1,
      grossPnl: 200,
      commission: 10,
      dataQuality: "ESTIMATED_INCOMPLETE_FEES",
    });

    assert.strictEqual(tradeManual.dataQuality, "ESTIMATED_INCOMPLETE_FEES");
  });

  test("18. Single Non-Overlapping Fee Deduction: Net P/L = Gross P/L - commission + swap - otherFees", async () => {
    const tradeFee = await createTrade(userAlice, {
      accountId: aliceAcc1Id,
      pair: "GBPUSD",
      direction: "SHORT",
      status: "CLOSED",
      entryDate: new Date().toISOString(),
      exitDate: new Date().toISOString(),
      timeframe: "H4",
      session: "LONDON",
      entryPrice: 1.28,
      exitPrice: 1.27,
      stopLoss: 1.285,
      positionSize: 1.0,
      grossPnl: 1000.0,
      commission: 15.0,
      swap: 4.5, // positive swap credit
      otherFees: 2.0,
    });

    // Net P/L = 1000.0 - 15.0 + 4.5 - 2.0 = 987.5
    assert.strictEqual(tradeFee.netPnl, 987.5);
    assert.strictEqual(tradeFee.outcome, "WIN");
  });

  test("19. Cash Transactions: Create Deposit & Withdrawal", async () => {
    // Deposit $5,000
    const deposit = await createCashTransaction(userAlice, {
      accountId: aliceAcc1Id,
      type: "DEPOSIT",
      amount: 5000.0,
      notes: "Monthly capital injection",
    });

    assert.ok(deposit.id.startsWith("ctx-"));
    assert.strictEqual(deposit.amount, 5000.0);
    assert.strictEqual(deposit.type, "DEPOSIT");
    aliceCash1Id = deposit.id;

    // Withdrawal $1,000
    const withdrawal = await createCashTransaction(userAlice, {
      accountId: aliceAcc1Id,
      type: "WITHDRAWAL",
      amount: 1000.0,
      notes: "Profit withdrawal",
    });

    assert.strictEqual(withdrawal.amount, 1000.0);
    assert.strictEqual(withdrawal.type, "WITHDRAWAL");

    const allCash = await getCashTransactions(userAlice, { accountId: aliceAcc1Id });
    assert.strictEqual(allCash.length, 2);
  });

  test("20. Cash Transaction Ownership & Archived Account Block", async () => {
    // Cannot create cash transaction on another user's account
    await assert.rejects(
      createCashTransaction(userBob, {
        accountId: aliceAcc1Id,
        type: "DEPOSIT",
        amount: 2000,
      }),
      (err) => {
        assert.ok(err instanceof JournalNotFoundError);
        assert.strictEqual(err.statusCode, 404);
        return true;
      }
    );

    // Cannot create cash transaction on archived account
    await archiveTradingAccount(userAlice, aliceAcc2Id);
    await assert.rejects(
      createCashTransaction(userAlice, {
        accountId: aliceAcc2Id,
        type: "DEPOSIT",
        amount: 1000,
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("archived"));
        return true;
      }
    );
    await restoreTradingAccount(userAlice, aliceAcc2Id);
  });

  test("21. Optimistic Concurrency Control: expectedVersion Mismatch Rejection (HTTP 409)", async () => {
    const acc = await getTradingAccountById(userAlice, aliceAcc1Id);

    // Stale version (expectedVersion 0 when actual version is >= 5)
    await assert.rejects(
      updateTradingAccount(
        userAlice,
        aliceAcc1Id,
        { brokerLabel: "Stale Broker" },
        { expectedVersion: 0 }
      ),
      (err) => {
        assert.ok(err instanceof ConcurrencyConflictError);
        assert.strictEqual(err.statusCode, 409);
        return true;
      }
    );
  });

  test("22. Concurrent Trade Creation: 10 parallel trades executed with 0 lost updates", async () => {
    const initialAcc = await getTradingAccountById(userAlice, aliceAcc1Id);
    const balanceStart = initialAcc.realizedBalance;

    const parallelCount = 10;
    const promises = [];

    for (let i = 0; i < parallelCount; i++) {
      promises.push(
        createTrade(userAlice, {
          accountId: aliceAcc1Id,
          pair: "EURUSD",
          direction: "LONG",
          status: "CLOSED",
          entryDate: new Date().toISOString(),
          exitDate: new Date().toISOString(),
          timeframe: "M15",
          session: "NEW_YORK",
          entryPrice: 1.08,
          exitPrice: 1.09,
          stopLoss: 1.075,
          positionSize: 0.1,
          grossPnl: 100.0,
          commission: 2.0, // net = 98.0
        })
      );
    }

    const createdTrades = await Promise.all(promises);
    assert.strictEqual(createdTrades.length, parallelCount);

    // Verify account balance accumulated all 10 trades accurately
    const finalAcc = await getTradingAccountById(userAlice, aliceAcc1Id);
    const expectedBalance = balanceStart + parallelCount * (100.0 - 2.0);
    assert.strictEqual(finalAcc.realizedBalance, expectedBalance);
  });

  test("23. Concurrent Account Updates: Serialized cleanly via UserPartitionLock", async () => {
    const updates = ["Name Alpha", "Name Beta", "Name Gamma"];
    const promises = updates.map((name) =>
      updateTradingAccount(userAlice, aliceAcc1Id, { brokerLabel: name })
    );

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, updates.length);

    const latest = await getTradingAccountById(userAlice, aliceAcc1Id);
    assert.ok(updates.includes(latest.brokerLabel));
  });

  test("24. Tombstoned Partition Rejection: Service calls reject with HTTP 410", async () => {
    // Setup and wipe userTomb
    const acc = await createTradingAccount(userTomb, {
      accountName: "Tombstone Target",
      accountCurrency: "USD",
      accountType: "DEMO",
      initialBalance: 1000,
    });
    assert.ok(acc.id);

    await wipeUserJournal(userTomb, "TEST_TOMBSTONE");

    // All service operations must throw AccountTombstonedError (410)
    await assert.rejects(
      getTradingAccounts(userTomb),
      AccountTombstonedError
    );

    await assert.rejects(
      createTradingAccount(userTomb, {
        accountName: "Attempt After Wipe",
        accountCurrency: "USD",
        accountType: "DEMO",
        initialBalance: 500,
      }),
      AccountTombstonedError
    );
  });

  test("25. Corrupted Partition Error Handling: Throws PartitionCorruptedError (HTTP 503)", async () => {
    // Setup and corrupt userCorrupt
    await createTradingAccount(userCorrupt, {
      accountName: "Corrupt Target",
      accountCurrency: "USD",
      accountType: "DEMO",
      initialBalance: 1000,
    });

    // Remove backups and write corrupt data
    const bFiles = fs
      .readdirSync(backupsDir)
      .filter((f) => f.startsWith(`u_${userCorrupt}.`));
    for (const bf of bFiles) fs.unlinkSync(path.join(backupsDir, bf));

    fs.writeFileSync(getUserPartitionPath(userCorrupt), "{ corrupt_raw...", "utf8");

    await assert.rejects(
      getTradingAccounts(userCorrupt),
      (err) => {
        assert.ok(err instanceof PartitionCorruptedError);
        assert.strictEqual(err.statusCode, 503);
        return true;
      }
    );
  });

  test("26. Currency Change Prohibition: Rejects currency change when trades or cash exist (HTTP 422)", async () => {
    // aliceAcc1Id has closed trades and cash transactions
    await assert.rejects(
      updateTradingAccount(userAlice, aliceAcc1Id, {
        accountCurrency: "EUR",
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("currency cannot be modified"));
        return true;
      }
    );
  });

  test("27. Distinct Balance Derivations: Mathematical consistency of all balance fields", async () => {
    const acc = await getTradingAccountById(userAlice, aliceAcc1Id);
    const cash = await getCashTransactions(userAlice, { accountId: aliceAcc1Id });
    const trades = await getTrades(userAlice, { accountId: aliceAcc1Id });

    const summary = calculateAccountBalances(acc, cash, trades);

    // Initial balance + deposits - withdrawals
    assert.strictEqual(
      summary.cashBalance,
      summary.initialBalance + summary.totalDeposits - summary.totalWithdrawals
    );

    // Realized balance = cashBalance + realizedPnl
    assert.strictEqual(
      summary.realizedBalance,
      summary.cashBalance + summary.realizedPnl
    );

    // Equity = realizedBalance + unrealizedPnl
    assert.strictEqual(
      summary.equity,
      summary.realizedBalance + summary.unrealizedPnl
    );
  });

  test("28. Symmetric Decimal Rounding & Currency Precision: Eliminates IEEE 754 artifacts", () => {
    // Half-way values symmetric rounding (avoiding epsilon positive-bias on negative numbers)
    assert.strictEqual(roundToDecimals(1.005, 2), 1.01);
    assert.strictEqual(roundToDecimals(-1.005, 2), -1.01);
    assert.strictEqual(roundToDecimals(35.855, 2), 35.86);
    assert.strictEqual(roundToDecimals(-35.855, 2), -35.86);

    // Floating-point binary representation errors
    assert.strictEqual(roundToDecimals(0.1 + 0.2, 2), 0.3);
    assert.strictEqual(roundToDecimals(1000000.555, 2), 1000000.56);
    assert.strictEqual(roundToDecimals(-1000000.555, 2), -1000000.56);

    // Zero-decimal currencies (IDR, JPY)
    assert.strictEqual(roundCurrencyAmount(123456.78, "IDR"), 123457);
    assert.strictEqual(roundCurrencyAmount(123456.49, "JPY"), 123456);

    // Three-decimal currencies (BHD)
    assert.strictEqual(roundCurrencyAmount(12.3456, "BHD"), 12.346);
    assert.strictEqual(roundCurrencyAmount(-12.3456, "BHD"), -12.346);
  });

  test("29. Equity & Unrealized P/L Policy on OPEN Positions: null when floating quotes unavailable", async () => {
    const userEquityTest = `usr_eq_${Date.now()}`;
    const acc = await createTradingAccount(userEquityTest, {
      accountName: "Equity Test Account",
      accountCurrency: "USD",
      accountType: "DEMO",
      initialBalance: 5000,
    });

    // Create an OPEN trade (no market quote stream)
    const openTrade = await createTrade(userEquityTest, {
      accountId: acc.id,
      pair: "EURUSD",
      direction: "BUY",
      status: "OPEN",
      entryDate: new Date().toISOString(),
      timeframe: "H1",
      session: "LONDON",
      entryPrice: 1.085,
      stopLoss: 1.08,
      takeProfit: 1.095,
      positionSize: 1.0,
    });
    assert.strictEqual(openTrade.status, "OPEN");
    assert.strictEqual(openTrade.grossPnl, undefined);
    assert.strictEqual(openTrade.netPnl, undefined);

    // Calculate balances
    const summary = calculateAccountBalances(acc, [], [openTrade]);
    assert.strictEqual(summary.openTradesCount, 1);
    assert.strictEqual(summary.unrealizedPnl, null);
    assert.strictEqual(summary.equity, null);
    assert.ok(summary.equityDefinition.includes("Unrealized P/L is unavailable"));
  });

  test("30. Archived Account Operations: Prohibits cancelTrade, deleteTrade, and deleteCashTransaction", async () => {
    const userArchOps = `usr_arch_ops_${Date.now()}`;
    const acc = await createTradingAccount(userArchOps, {
      accountName: "Ops Target Account",
      accountCurrency: "USD",
      accountType: "DEMO",
      initialBalance: 2000,
    });

    const trade = await createTrade(userArchOps, {
      accountId: acc.id,
      pair: "XAUUSD",
      direction: "BUY",
      status: "OPEN",
      entryDate: new Date().toISOString(),
      timeframe: "M15",
      session: "NEW_YORK",
      entryPrice: 2050,
      stopLoss: 2040,
      positionSize: 0.5,
    });

    const ctx = await createCashTransaction(userArchOps, {
      accountId: acc.id,
      type: "DEPOSIT",
      amount: 500,
    });

    // Archive the account
    await archiveTradingAccount(userArchOps, acc.id);

    // cancelTrade must fail
    await assert.rejects(
      cancelTrade(userArchOps, trade.id),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("archived account"));
        return true;
      }
    );

    // deleteTrade must fail
    await assert.rejects(
      deleteTrade(userArchOps, trade.id),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("archived account"));
        return true;
      }
    );

    // deleteCashTransaction must fail
    await assert.rejects(
      deleteCashTransaction(userArchOps, ctx.id),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("archived account"));
        return true;
      }
    );
  });

  test("31. Data Quality Tag Enforcement: Rejects VERIFIED_BROKER on create, update, and close", async () => {
    const userQuality = `usr_qual_${Date.now()}`;
    const acc = await createTradingAccount(userQuality, {
      accountName: "Quality Test Account",
      accountCurrency: "USD",
      accountType: "LIVE",
      initialBalance: 10000,
    });

    // createTrade with VERIFIED_BROKER must throw 422
    await assert.rejects(
      createTrade(userQuality, {
        accountId: acc.id,
        pair: "GBPUSD",
        direction: "BUY",
        status: "OPEN",
        entryDate: new Date().toISOString(),
        timeframe: "H4",
        session: "LONDON",
        entryPrice: 1.25,
        stopLoss: 1.245,
        positionSize: 1,
        dataQuality: "VERIFIED_BROKER",
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("VERIFIED_BROKER"));
        return true;
      }
    );

    // Valid create
    const trade = await createTrade(userQuality, {
      accountId: acc.id,
      pair: "GBPUSD",
      direction: "BUY",
      status: "OPEN",
      entryDate: new Date().toISOString(),
      timeframe: "H4",
      session: "LONDON",
      entryPrice: 1.25,
      stopLoss: 1.245,
      positionSize: 1,
      dataQuality: "ESTIMATED_INCOMPLETE_FEES",
    });

    // updateTrade with VERIFIED_BROKER must throw 422
    await assert.rejects(
      updateTrade(userQuality, trade.id, {
        dataQuality: "VERIFIED_BROKER",
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("VERIFIED_BROKER"));
        return true;
      }
    );

    // closeTrade with VERIFIED_BROKER must throw 422
    await assert.rejects(
      closeTrade(userQuality, trade.id, {
        exitPrice: 1.26,
        exitDate: new Date().toISOString(),
        grossPnl: 100,
        dataQuality: "VERIFIED_BROKER",
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("VERIFIED_BROKER"));
        return true;
      }
    );
  });

  test("32. Data Quality Tag Transition on Update: Transitions cleanly between manual tags", async () => {
    const userTrans = `usr_trans_${Date.now()}`;
    const acc = await createTradingAccount(userTrans, {
      accountName: "Transition Account",
      accountCurrency: "USD",
      accountType: "DEMO",
      initialBalance: 3000,
    });

    const trade = await createTrade(userTrans, {
      accountId: acc.id,
      pair: "USDJPY",
      direction: "BUY",
      status: "OPEN",
      entryDate: new Date().toISOString(),
      timeframe: "D1",
      session: "TOKYO",
      entryPrice: 155.0,
      stopLoss: 154.0,
      positionSize: 0.2,
      dataQuality: "ESTIMATED_INCOMPLETE_FEES",
    });
    assert.strictEqual(trade.dataQuality, "ESTIMATED_INCOMPLETE_FEES");

    // Transition to SELF_REPORTED_MANUAL via updateTrade
    const updated = await updateTrade(userTrans, trade.id, {
      dataQuality: "SELF_REPORTED_MANUAL",
      notes: "Updated fees from broker statement",
    });
    assert.strictEqual(updated.dataQuality, "SELF_REPORTED_MANUAL");
    assert.strictEqual(updated.notes, "Updated fees from broker statement");
  });

  test("33. Cash Transactions Recalibration: Balance updates without altering realized P/L", async () => {
    const userCashRecalc = `usr_cash_recalc_${Date.now()}`;
    const acc = await createTradingAccount(userCashRecalc, {
      accountName: "Cash Recalc Account",
      accountCurrency: "USD",
      accountType: "LIVE",
      initialBalance: 10000,
    });

    // Create a closed trade with +$500 net P/L
    const trade = await createTrade(userCashRecalc, {
      accountId: acc.id,
      pair: "EURUSD",
      direction: "BUY",
      status: "CLOSED",
      entryDate: "2026-11-01T10:00:00.000Z",
      exitDate: "2026-11-01T14:00:00.000Z",
      timeframe: "H1",
      session: "LONDON",
      entryPrice: 1.08,
      exitPrice: 1.085,
      stopLoss: 1.075,
      positionSize: 1,
      grossPnl: 520,
      commission: 15,
      swap: -5,
    });
    assert.strictEqual(trade.netPnl, 500);

    let currentAcc = await getTradingAccountById(userCashRecalc, acc.id);
    assert.strictEqual(currentAcc.realizedBalance, 10500);

    // Deposit $2,000
    const dep = await createCashTransaction(userCashRecalc, {
      accountId: acc.id,
      type: "DEPOSIT",
      amount: 2000,
    });
    currentAcc = await getTradingAccountById(userCashRecalc, acc.id);
    assert.strictEqual(currentAcc.realizedBalance, 12500);

    // Update deposit to $2,500
    await updateCashTransaction(userCashRecalc, dep.id, {
      amount: 2500,
    });
    currentAcc = await getTradingAccountById(userCashRecalc, acc.id);
    assert.strictEqual(currentAcc.realizedBalance, 13000);

    // Delete deposit
    await deleteCashTransaction(userCashRecalc, dep.id);
    currentAcc = await getTradingAccountById(userCashRecalc, acc.id);
    assert.strictEqual(currentAcc.realizedBalance, 10500);

    // Realized P/L on the account remains unaffected by cash transactions
    const trades = await getTrades(userCashRecalc, { accountId: acc.id });
    const cash = await getCashTransactions(userCashRecalc, { accountId: acc.id });
    const summary = calculateAccountBalances(currentAcc, cash, trades);
    assert.strictEqual(summary.realizedPnl, 500);
    assert.strictEqual(summary.totalDeposits, 0);
  });

  test("34. Partial Update Preservation: Preserves unmentioned fields on trade", async () => {
    const userPreserve = `usr_pres_${Date.now()}`;
    const acc = await createTradingAccount(userPreserve, {
      accountName: "Preserve Account",
      accountCurrency: "USD",
      accountType: "DEMO",
      initialBalance: 5000,
    });

    const trade = await createTrade(userPreserve, {
      accountId: acc.id,
      pair: "AUDUSD",
      direction: "SELL",
      status: "OPEN",
      entryDate: "2026-11-02T08:00:00.000Z",
      timeframe: "M30",
      session: "ASIAN",
      entryPrice: 0.655,
      stopLoss: 0.66,
      takeProfit: 0.645,
      positionSize: 0.5,
      setupTags: ["Breakout", "London-Open"],
      notes: "Original detailed note",
    });

    // Update only stopLoss
    const updated = await updateTrade(userPreserve, trade.id, {
      stopLoss: 0.658,
    });

    assert.strictEqual(updated.stopLoss, 0.658);
    assert.strictEqual(updated.takeProfit, 0.645);
    assert.strictEqual(updated.pair, "AUDUSD");
    assert.strictEqual(updated.direction, "SHORT");
    assert.deepStrictEqual(updated.setupTags, ["Breakout", "London-Open"]);
    assert.strictEqual(updated.notes, "Original detailed note");
  });

  test("35. Cash Transaction Validation: Rejects invalid transaction types and negative amounts", async () => {
    const userVal = `usr_val_${Date.now()}`;
    const acc = await createTradingAccount(userVal, {
      accountName: "Validation Account",
      accountCurrency: "USD",
      accountType: "DEMO",
      initialBalance: 1000,
    });

    // Rejection of invalid type (e.g. ADJUSTMENT)
    await assert.rejects(
      createCashTransaction(userVal, {
        accountId: acc.id,
        type: "ADJUSTMENT",
        amount: 100,
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("Invalid transaction type"));
        return true;
      }
    );

    // Rejection of negative amount
    await assert.rejects(
      createCashTransaction(userVal, {
        accountId: acc.id,
        type: "DEPOSIT",
        amount: -50,
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.strictEqual(err.statusCode, 422);
        assert.ok(err.message.includes("greater than zero"));
        return true;
      }
    );
  });

  // ── Sprint 3 Task 2.2 Financial Precision Hardening Tests ────────

  test("36. Financial Precision: 0.1 + 0.2 produces exact 0.3 money value without float drift", () => {
    const minor1 = toMinorUnits(0.1, 2);
    const minor2 = toMinorUnits(0.2, 2);
    assert.strictEqual(minor1, 10n);
    assert.strictEqual(minor2, 20n);
    const sumMajor = toMajorUnits(minor1 + minor2, 2);
    assert.strictEqual(sumMajor, 0.3);
    assert.strictEqual(roundToDecimals(0.1 + 0.2, 2), 0.3);
  });

  test("37. Financial Precision: Positive decimal half-up rounding", () => {
    assert.strictEqual(roundToDecimals(1.005, 2), 1.01);
    assert.strictEqual(roundToDecimals(1.0049, 2), 1.0);
    assert.strictEqual(roundToDecimals(35.855, 2), 35.86);
    assert.strictEqual(roundToDecimals(100.005, 2), 100.01);
  });

  test("38. Financial Precision: Negative decimal half-up rounding", () => {
    assert.strictEqual(roundToDecimals(-1.005, 2), -1.01);
    assert.strictEqual(roundToDecimals(-1.0049, 2), -1.0);
    assert.strictEqual(roundToDecimals(-35.855, 2), -35.86);
    assert.strictEqual(roundToDecimals(-100.005, 2), -100.01);
  });

  test("39. Financial Precision: Symmetric rounding around zero", () => {
    const testCases = [0.005, 1.005, 12.345, 99.995, 35.855];
    for (const val of testCases) {
      const pos = roundToDecimals(val, 2);
      const neg = roundToDecimals(-val, 2);
      assert.strictEqual(pos, -neg, `Asymmetry detected on ${val}: ${pos} vs ${neg}`);
    }
  });

  test("40. Financial Precision: IDR zero-decimal handling", () => {
    assert.strictEqual(roundCurrencyAmount(123456.78, "IDR"), 123457);
    assert.strictEqual(roundCurrencyAmount(123456.49, "IDR"), 123456);
    assert.strictEqual(roundCurrencyAmount(-123456.78, "IDR"), -123457);
    assert.strictEqual(roundCurrencyAmount(-123456.49, "IDR"), -123456);
    assert.strictEqual(toMinorUnits(150000, 0), 150000n);
    assert.strictEqual(toMajorUnits(150000n, 0), 150000);
  });

  test("41. Financial Precision: USD two-decimal handling", () => {
    assert.strictEqual(roundCurrencyAmount(10.505, "USD"), 10.51);
    assert.strictEqual(roundCurrencyAmount(10.504, "USD"), 10.5);
    assert.strictEqual(roundCurrencyAmount(-10.505, "USD"), -10.51);
    assert.strictEqual(toMinorUnits(10.5, 2), 1050n);
    assert.strictEqual(toMajorUnits(1050n, 2), 10.5);
  });

  test("42. Financial Precision: JPY zero-decimal handling", () => {
    assert.strictEqual(roundCurrencyAmount(500.5, "JPY"), 501);
    assert.strictEqual(roundCurrencyAmount(500.49, "JPY"), 500);
    assert.strictEqual(roundCurrencyAmount(-500.5, "JPY"), -501);
    assert.strictEqual(toMinorUnits(1500, 0), 1500n);
    assert.strictEqual(toMajorUnits(1500n, 0), 1500);
  });

  test("43. Financial Precision: BHD three-decimal handling", () => {
    assert.strictEqual(roundCurrencyAmount(12.3456, "BHD"), 12.346);
    assert.strictEqual(roundCurrencyAmount(12.3454, "BHD"), 12.345);
    assert.strictEqual(roundCurrencyAmount(-12.3456, "BHD"), -12.346);
    assert.strictEqual(roundCurrencyAmount(-12.3454, "BHD"), -12.345);
    assert.strictEqual(toMinorUnits(12.345, 3), 12345n);
    assert.strictEqual(toMajorUnits(12345n, 3), 12.345);
  });

  test("44. Financial Precision: Large financial values without precision loss or overflow", () => {
    const largeVal = 999999999999.99;
    const minor = toMinorUnits(largeVal, 2);
    assert.strictEqual(minor, 99999999999999n);
    const major = toMajorUnits(minor, 2);
    assert.strictEqual(major, largeVal);

    // Summing two large numbers
    const doubleMinor = minor + minor;
    assert.strictEqual(toMajorUnits(doubleMinor, 2), 1999999999999.98);
  });

  test("45. Financial Precision: Very small sub-minor decimal values", () => {
    assert.strictEqual(roundToDecimals(0.0001, 2), 0.0);
    assert.strictEqual(roundToDecimals(0.0049, 2), 0.0);
    assert.strictEqual(roundToDecimals(0.005, 2), 0.01);
    assert.strictEqual(roundToDecimals(-0.0001, 2), 0.0);
    assert.strictEqual(roundToDecimals(-0.005, 2), -0.01);
  });

  test("46. Financial Precision: Multiple trade P&L aggregation with 0 float drift", async () => {
    const userAggr = `usr_aggr_${Date.now()}`;
    const acc = await createTradingAccount(userAggr, {
      accountName: "Aggregation Test Account",
      accountCurrency: "USD",
      accountType: "DEMO",
      initialBalance: 1000,
    });

    // Create 30 trades of 0.10 USD grossPnl (in standard float 30 * 0.1 = 3.0000000000000004 or 2.99999999...)
    for (let i = 0; i < 30; i++) {
      await createTrade(userAggr, {
        accountId: acc.id,
        pair: "EURUSD",
        direction: "BUY",
        status: "CLOSED",
        entryDate: "2026-11-01T10:00:00.000Z",
        exitDate: "2026-11-01T11:00:00.000Z",
        timeframe: "M15",
        session: "LONDON",
        entryPrice: 1.08,
        exitPrice: 1.081,
        stopLoss: 1.079,
        positionSize: 0.1,
        grossPnl: 0.1,
        commission: 0,
        swap: 0,
        otherFees: 0,
      });
    }

    const updatedAcc = await getTradingAccountById(userAggr, acc.id);
    const trades = await getTrades(userAggr, { accountId: acc.id });
    const summary = calculateAccountBalances(updatedAcc, [], trades);

    // Exact 3.0 realized P&L and 1003.0 realized balance
    assert.strictEqual(summary.realizedPnl, 3.0);
    assert.strictEqual(summary.realizedBalance, 1003.0);
    assert.strictEqual(summary.cashBalance, 1000.0);
  });

  test("47. Financial Precision: Deposit and withdrawal aggregation without trading profit pollution", async () => {
    const userCashAggr = `usr_cash_aggr_${Date.now()}`;
    const acc = await createTradingAccount(userCashAggr, {
      accountName: "Cash Aggr Account",
      accountCurrency: "USD",
      accountType: "LIVE",
      initialBalance: 5000,
    });

    // 10 deposits of $100.10
    for (let i = 0; i < 10; i++) {
      await createCashTransaction(userCashAggr, {
        accountId: acc.id,
        type: "DEPOSIT",
        amount: 100.1,
      });
    }

    // 5 withdrawals of $50.05
    for (let i = 0; i < 5; i++) {
      await createCashTransaction(userCashAggr, {
        accountId: acc.id,
        type: "WITHDRAWAL",
        amount: 50.05,
      });
    }

    const currentAcc = await getTradingAccountById(userCashAggr, acc.id);
    const cash = await getCashTransactions(userCashAggr, { accountId: acc.id });
    const summary = calculateAccountBalances(currentAcc, cash, []);

    // 10 * 100.10 = 1001.00; 5 * 50.05 = 250.25; net cashflow = +750.75
    assert.strictEqual(summary.totalDeposits, 1001.0);
    assert.strictEqual(summary.totalWithdrawals, 250.25);
    assert.strictEqual(summary.cashBalance, 5750.75);
    assert.strictEqual(summary.realizedPnl, 0.0); // Never pollutes P&L
    assert.strictEqual(summary.realizedBalance, 5750.75);
  });

  test("48. Financial Precision: Commission and fees exact calculation with signed swap", () => {
    // gross 100.55, commission 3.20, swap -1.15, otherFees 0.50 -> 100.55 - 3.20 + (-1.15) - 0.50 = 95.70
    const net = calculateExactNetPnl(100.55, 3.2, -1.15, 0.5, 2);
    assert.strictEqual(net, 95.7);

    // Positive swap financing credit
    const netCredit = calculateExactNetPnl(50.0, 2.0, 1.5, 0.5, 2);
    assert.strictEqual(netCredit, 49.0);

    // Negative commission input normalized to positive deduction
    const netNegComm = calculateExactNetPnl(100.0, -5.0, 0, 0, 2);
    assert.strictEqual(netNegComm, 95.0);
  });

  test("49. Financial Precision: Update CLOSED trade recalculation preserves ledger consistency", async () => {
    const userRecalc = `usr_recalc_${Date.now()}`;
    const acc = await createTradingAccount(userRecalc, {
      accountName: "Recalc Account",
      accountCurrency: "USD",
      accountType: "DEMO",
      initialBalance: 2000,
    });

    const trade = await createTrade(userRecalc, {
      accountId: acc.id,
      pair: "XAUUSD",
      direction: "BUY",
      status: "CLOSED",
      entryDate: "2026-11-03T10:00:00.000Z",
      exitDate: "2026-11-03T12:00:00.000Z",
      timeframe: "M15",
      session: "LONDON",
      entryPrice: 2050,
      exitPrice: 2060,
      stopLoss: 2045,
      positionSize: 1,
      grossPnl: 100,
      commission: 5,
      swap: 0,
      otherFees: 0,
    });
    assert.strictEqual(trade.netPnl, 95);

    let curAcc = await getTradingAccountById(userRecalc, acc.id);
    assert.strictEqual(curAcc.realizedBalance, 2095);

    // Correct trade: broker statement showed gross was actually 120, swap was -2.50, and otherFees was 1.25
    const updatedTrade = await updateTrade(userRecalc, trade.id, {
      grossPnl: 120,
      swap: -2.5,
      otherFees: 1.25,
    });
    // net = 120 - 5 + (-2.50) - 1.25 = 111.25
    assert.strictEqual(updatedTrade.netPnl, 111.25);

    curAcc = await getTradingAccountById(userRecalc, acc.id);
    assert.strictEqual(curAcc.realizedBalance, 2111.25);
  });

  test("50. Financial Precision: Rejection of invalid non-finite numbers (NaN, Infinity)", async () => {
    assert.throws(
      () => toMinorUnits(NaN, 2),
      (err) => err instanceof JournalValidationError && err.message.includes("Invalid financial")
    );
    assert.throws(
      () => toMinorUnits(Infinity, 2),
      (err) => err instanceof JournalValidationError && err.message.includes("Invalid financial")
    );
    assert.throws(
      () => toMinorUnits(-Infinity, 2),
      (err) => err instanceof JournalValidationError && err.message.includes("Invalid financial")
    );
  });

  // ── Sprint 3 Task 2.3 Edge-Case & Precision Boundary Hardening Tests ──

  test("51. Precision Boundary: Rejects amounts exceeding IEEE-754 safe integer threshold", () => {
    const maxSafeUSD = getMaxSafeFinancialAmount(2);
    assert.strictEqual(maxSafeUSD, 90071992547409); // Approx $90 Trillion

    // Valid at boundary
    const minorAtBoundary = toMinorUnits(maxSafeUSD, 2);
    assert.ok(minorAtBoundary <= MAX_SAFE_INTEGER_BIGINT);

    // Rejection beyond boundary
    assert.throws(
      () => toMinorUnits(maxSafeUSD + 1000, 2),
      (err) =>
        err instanceof JournalValidationError &&
        err.message.includes("exceeds safe precision limit")
    );
  });

  test("52. Precision Boundary: toMajorUnits rejects minor units exceeding Number.MAX_SAFE_INTEGER", () => {
    // Valid at MAX_SAFE_INTEGER
    const major = toMajorUnits(MAX_SAFE_INTEGER_BIGINT, 2);
    assert.strictEqual(typeof major, "number");

    // Rejection beyond MAX_SAFE_INTEGER
    const overflowMinor = MAX_SAFE_INTEGER_BIGINT + BigInt(1);
    assert.throws(
      () => toMajorUnits(overflowMinor, 2),
      (err) =>
        err instanceof JournalValidationError &&
        err.message.includes("exceed safe integer precision limit")
    );
  });

  test("53. Scientific Notation Parsing: Numbers < 1e-6 safely converted to 0 minor units without NaN", () => {
    assert.strictEqual(toMinorUnits(1e-7, 2), BigInt(0));
    assert.strictEqual(toMinorUnits(0.00000005, 2), BigInt(0));
    assert.strictEqual(toMinorUnits(-1e-8, 2), BigInt(0));
    assert.strictEqual(roundToDecimals(1e-7, 2), 0);
  });

  test("54. Negative Zero Normalization: Always returns positive 0, never -0", () => {
    const res1 = toMajorUnits(BigInt(0), 2);
    assert.strictEqual(Object.is(res1, 0), true);
    assert.strictEqual(Object.is(res1, -0), false);

    const res2 = roundToDecimals(-0.00001, 2);
    assert.strictEqual(Object.is(res2, 0), true);
    assert.strictEqual(Object.is(res2, -0), false);
  });

  test("55. End-to-End Account Ledger Boundary: Service operations enforce precision limits", async () => {
    const userBound = `usr_bound_${Date.now()}`;
    const acc = await createTradingAccount(userBound, {
      accountName: "Boundary Account",
      accountCurrency: "USD",
      accountType: "LIVE",
      initialBalance: 10000,
    });

    // Rejection of trade with grossPnl exceeding safe boundary
    await assert.rejects(
      createTrade(userBound, {
        accountId: acc.id,
        pair: "EURUSD",
        direction: "BUY",
        status: "CLOSED",
        entryDate: "2026-11-04T10:00:00.000Z",
        exitDate: "2026-11-04T11:00:00.000Z",
        timeframe: "H1",
        session: "LONDON",
        entryPrice: 1.08,
        exitPrice: 1.09,
        stopLoss: 1.07,
        positionSize: 1,
        grossPnl: 1e16, // Exceeds safe limit
      }),
      (err) => {
        assert.ok(err instanceof JournalValidationError);
        assert.ok(err.message.includes("exceeds safe precision limit"));
        return true;
      }
    );
  });
});
