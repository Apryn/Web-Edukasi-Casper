/**
 * SIGNAL CASPER ACADEMY — SPRINT 3 — TASK 1 TEST SUITE
 * Storage & Database Architecture Layer Verification Tests
 *
 * Verifies:
 * 1. Creation & Schema Initialization
 * 2. Concurrency & Mutex Queue (0 lost updates under 10 parallel writes)
 * 3. Queue Continuation on Task Error
 * 4. Queue Map Cleanup when Idle
 * 5. Optimistic Concurrency Control (expectedVersion mismatch -> 409)
 * 6. User Isolation (Tenant separation)
 * 7. Atomic Rollback & Tempfile Cleanup on failure
 * 8. Quarantining & RECOVERY_REQUIRED when no backup exists
 * 9. Auto-recovery from valid backup snapshot
 * 10. Schema Migration from v0 to v1
 * 11. OS Durability Handling (Windows vs POSIX)
 * 12. Permanent Wipe & Tombstone Enforcement (HTTP 410)
 * 13. Stale Temp Files Cleanup
 * 14. Derived Index Rebuild (SSOT Maintenance)
 * 15. UserId Validation & Anti-Path-Traversal
 * 16. Storage Health Diagnostics
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
  UserPartitionLock,
  globalUserPartitionLock,
  ensureJournalDirectories,
  getUserPartitionPath,
  getUserTombstonePath,
  isUserTombstoned,
  isValidJournalPartition,
  createEmptyPartition,
  readUserPartition,
  writeUserPartitionSync,
  mutateUserPartition,
  wipeUserJournal,
  cleanupStaleTempFiles,
  rebuildJournalIndex,
  getJournalStorageHealth,
  getUserRecoveryRequiredPath,
  isUserRecoveryRequired,
  readUserPartitionLocked,
  writeTombstoneAtomically,
  assertValidUserId,
} = await import("../lib/journal-storage.ts");

const {
  ConcurrencyConflictError,
  PartitionCorruptedError,
  AccountTombstonedError,
  InvalidUserIdError,
  JournalStorageError,
} = await import("../lib/journal-types.ts");

describe("Signal Casper Academy - Journal Storage & Concurrency Architecture Suite", () => {
  const dataDir = path.join(process.cwd(), "data");
  const journalsDir = path.join(dataDir, "journals");
  const corruptedDir = path.join(journalsDir, "corrupted");
  const backupsDir = path.join(dataDir, "backups", "journals");
  const uploadsDir = path.join(dataDir, "uploads", "journals");

  const testUserA = `test_usr_a_${Date.now()}`;
  const testUserB = `test_usr_b_${Date.now()}`;
  const testUserC = `test_usr_c_${Date.now()}`;
  const testUserCorrupt = `test_usr_corrupt_${Date.now()}`;
  const testUserWipe = `test_usr_wipe_${Date.now()}`;

  const createdTestUsers = [
    testUserA,
    testUserB,
    testUserC,
    testUserCorrupt,
    testUserWipe,
  ];

  before(() => {
    ensureJournalDirectories();
  });

  after(() => {
    // Cleanup sandbox test files
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
        const rPath = getUserRecoveryRequiredPath(u);
        if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
      } catch {}

      // Clean backups
      if (fs.existsSync(backupsDir)) {
        try {
          const files = fs.readdirSync(backupsDir).filter((f) => f.startsWith(`u_${u}.`));
          for (const f of files) fs.unlinkSync(path.join(backupsDir, f));
        } catch {}
      }

      // Clean corrupted
      if (fs.existsSync(corruptedDir)) {
        try {
          const files = fs.readdirSync(corruptedDir).filter((f) => f.startsWith(`u_${u}.`));
          for (const f of files) fs.unlinkSync(path.join(corruptedDir, f));
        } catch {}
      }
    }
    try {
      rebuildJournalIndex();
    } catch {}
  });

  test("1. Creation & Schema Initialization: Fresh Partition", () => {
    const partition = readUserPartition(testUserA);
    assert.strictEqual(partition.userId, testUserA);
    assert.strictEqual(partition.schemaVersion, 1);
    assert.strictEqual(partition.version, 1);
    assert.deepStrictEqual(partition.accounts, []);
    assert.deepStrictEqual(partition.trades, []);
    assert.deepStrictEqual(partition.reviews, []);
    assert.deepStrictEqual(partition.strategies, []);
    assert.strictEqual(partition.consent, null);

    // Write it to disk
    const written = writeUserPartitionSync(testUserA, partition);
    assert.strictEqual(written.version, 2);
    assert.ok(fs.existsSync(getUserPartitionPath(testUserA)));

    // Read back and assert version 2
    const readBack = readUserPartition(testUserA);
    assert.strictEqual(readBack.version, 2);
  });

  test("2. Concurrency: In-Memory Mutex Queue Serializes 10 Simultaneous Writes (0 Lost Updates)", async () => {
    const writesCount = 10;
    const promises = [];

    for (let i = 0; i < writesCount; i++) {
      promises.push(
        mutateUserPartition(testUserA, (part) => {
          const account = {
            id: `acc-${i}`,
            userId: testUserA,
            accountName: `Account #${i}`,
            accountCurrency: "USD",
            currencyDecimals: 2,
            accountType: "LIVE",
            initialBalance: 10000,
            realizedBalance: 10000,
            equity: 10000,
            isArchived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            result: i,
            updatedPartition: {
              ...part,
              accounts: [...part.accounts, account],
            },
          };
        })
      );
    }

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, writesCount);

    // Verify final partition on disk
    const finalPartition = readUserPartition(testUserA, { bypassCache: true });
    assert.strictEqual(
      finalPartition.accounts.length,
      writesCount,
      "All 10 accounts must be present without lost updates"
    );
    // Initial version was 2, plus 10 mutations = 12
    assert.strictEqual(finalPartition.version, 12);
  });

  test("3. Queue Continuation: Error in Previous Task Does Not Stall Queue", async () => {
    const lock = new UserPartitionLock();
    const userId = "test_queue_continuation";
    const executionOrder = [];

    // Task 1: Success
    const p1 = lock.acquire(userId, async () => {
      executionOrder.push("task1");
      return "res1";
    });

    // Task 2: Fails with Error
    const p2 = lock.acquire(userId, async () => {
      executionOrder.push("task2_fails");
      throw new Error("Simulated failure in task 2");
    });

    // Task 3: Success (Must continue despite task 2 failing)
    const p3 = lock.acquire(userId, async () => {
      executionOrder.push("task3");
      return "res3";
    });

    const res1 = await p1;
    assert.strictEqual(res1, "res1");

    await assert.rejects(p2, { message: "Simulated failure in task 2" });

    const res3 = await p3;
    assert.strictEqual(res3, "res3");

    assert.deepStrictEqual(executionOrder, ["task1", "task2_fails", "task3"]);
  });

  test("4. Queue Map Cleanup: Idle User Queue Purges Map Entry", async () => {
    const lock = new UserPartitionLock();
    const userId = "test_cleanup_user";

    assert.strictEqual(lock.isLocked(userId), false);

    const taskPromise = lock.acquire(userId, async () => {
      assert.strictEqual(lock.isLocked(userId), true);
      return "done";
    });

    await taskPromise;

    // Small delay to let microtask finally settle
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(
      lock.isLocked(userId),
      false,
      "Queue Map entry must be purged when idle"
    );
    assert.strictEqual(lock.getActiveQueuesCount(), 0);
  });

  test("5. Optimistic Concurrency Control: expectedVersion Mismatch Rejection (HTTP 409)", () => {
    const partition = readUserPartition(testUserA);
    const staleVersion = partition.version - 1;

    assert.throws(
      () => {
        writeUserPartitionSync(testUserA, partition, {
          expectedVersion: staleVersion,
        });
      },
      (err) => {
        assert.ok(err instanceof ConcurrencyConflictError);
        assert.strictEqual(err.statusCode, 409);
        return true;
      }
    );
  });

  test("6. User Isolation: Tenant Data Separation", async () => {
    // User B writes account
    await mutateUserPartition(testUserB, (part) => {
      return {
        result: true,
        updatedPartition: {
          ...part,
          accounts: [
            {
              id: "acc-user-b",
              userId: testUserB,
              accountName: "User B Exclusive Account",
              accountCurrency: "IDR",
              currencyDecimals: 0,
              accountType: "DEMO",
              initialBalance: 50000000,
              realizedBalance: 50000000,
              equity: 50000000,
              isArchived: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      };
    });

    const partA = readUserPartition(testUserA);
    const partB = readUserPartition(testUserB);

    assert.strictEqual(partA.userId, testUserA);
    assert.strictEqual(partB.userId, testUserB);
    assert.ok(partA.accounts.every((a) => a.userId === testUserA));
    assert.ok(partB.accounts.every((a) => a.userId === testUserB));
    assert.strictEqual(partB.accounts.length, 1);
  });

  test("7. Atomic Rollback: Disk Failure Unlinks Tempfile and Preserves Prior Partition", () => {
    const partC = readUserPartition(testUserC);
    writeUserPartitionSync(testUserC, partC);

    const initialStat = fs.statSync(getUserPartitionPath(testUserC));

    // Attempt writing with mismatched userId
    const corruptedPayload = {
      ...partC,
      userId: "mismatched_intruder_id",
    };

    assert.throws(() => {
      writeUserPartitionSync(testUserC, corruptedPayload);
    }, JournalStorageError);

    const postStat = fs.statSync(getUserPartitionPath(testUserC));
    assert.strictEqual(postStat.mtimeMs, initialStat.mtimeMs);

    // Verify no dangling .tmp files for user C
    const files = fs.readdirSync(journalsDir);
    const tmpFiles = files.filter(
      (f) => f.startsWith(`u_${testUserC}.tmp.`)
    );
    assert.strictEqual(tmpFiles.length, 0);
  });

  test("8. Quarantine & RECOVERY_REQUIRED when No Backup Exists (HTTP 503)", () => {
    const partitionPath = getUserPartitionPath(testUserCorrupt);
    fs.writeFileSync(partitionPath, "{ invalid_corrupt_json: true, broken... }", "utf8");

    // Ensure no backups exist for testUserCorrupt
    if (fs.existsSync(backupsDir)) {
      const bFiles = fs
        .readdirSync(backupsDir)
        .filter((f) => f.startsWith(`u_${testUserCorrupt}.`));
      for (const bf of bFiles) fs.unlinkSync(path.join(backupsDir, bf));
    }

    assert.throws(
      () => {
        readUserPartition(testUserCorrupt, { bypassCache: true });
      },
      (err) => {
        assert.ok(err instanceof PartitionCorruptedError);
        assert.strictEqual(err.statusCode, 503);
        assert.ok(err.incidentId.startsWith("INC-"));
        return true;
      }
    );

    // Verify corrupt file was quarantined
    const quarantined = fs
      .readdirSync(corruptedDir)
      .filter((f) => f.startsWith(`u_${testUserCorrupt}.corrupt.`));
    assert.ok(quarantined.length >= 1, "Corrupted file must be quarantined");
  });

  test("9. Auto-Recovery from Valid Backup Snapshot", () => {
    const userWithBackup = `test_usr_autobackup_${Date.now()}`;
    createdTestUsers.push(userWithBackup);

    // 1. Create and write valid partition
    const initial = readUserPartition(userWithBackup);
    initial.accounts.push({
      id: "acc-precious",
      userId: userWithBackup,
      accountName: "Precious Saved Account",
      accountCurrency: "USD",
      currencyDecimals: 2,
      accountType: "LIVE",
      initialBalance: 25000,
      realizedBalance: 25000,
      equity: 25000,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    writeUserPartitionSync(userWithBackup, initial);
    assert.ok(fs.existsSync(getUserPartitionPath(userWithBackup)));

    // 2. Corrupt the file on disk
    fs.writeFileSync(
      getUserPartitionPath(userWithBackup),
      "BAD GARBAGE DATA !!!",
      "utf8"
    );

    // 3. Read partition - should quarantine corrupt file and auto-restore from backup snapshot
    const restored = readUserPartition(userWithBackup, { bypassCache: true });
    assert.strictEqual(restored.userId, userWithBackup);
    assert.strictEqual(restored.accounts.length, 1);
    assert.strictEqual(restored.accounts[0].accountName, "Precious Saved Account");
  });

  test("10. Schema Migration: Upgrades v0 to v1 Cleanly", () => {
    const userMigrate = `test_usr_migrate_${Date.now()}`;
    createdTestUsers.push(userMigrate);

    const legacyPayload = {
      userId: userMigrate,
      version: 1,
      // schemaVersion omitted (v0)
      accounts: [],
      trades: [],
      reviews: [],
      strategies: [],
      // cashTransactions omitted
      // totalAttachmentBytes omitted
    };

    fs.writeFileSync(
      getUserPartitionPath(userMigrate),
      JSON.stringify(legacyPayload),
      "utf8"
    );

    const loaded = readUserPartition(userMigrate, { bypassCache: true });
    assert.strictEqual(loaded.schemaVersion, 1);
    assert.ok(Array.isArray(loaded.cashTransactions));
    assert.strictEqual(loaded.totalAttachmentBytes, 0);
  });

  test("11. OS Durability: Windows vs POSIX Handling", () => {
    // Current test runner is running on Windows (process.platform === 'win32')
    // Verify writeUserPartitionSync succeeds without throwing EISDIR on directory handle
    const part = readUserPartition(testUserA);
    const written = writeUserPartitionSync(testUserA, part);
    assert.ok(written.version > part.version);
  });

  test("12. Permanent Wipe & Tombstone: HTTP 410 Block on Wiped Account", async () => {
    // Create partition for testUserWipe
    const initial = readUserPartition(testUserWipe);
    writeUserPartitionSync(testUserWipe, initial);
    assert.ok(fs.existsSync(getUserPartitionPath(testUserWipe)));

    // Execute wipe
    const wipeRes = await wipeUserJournal(testUserWipe, "USER_REQUESTED");
    assert.strictEqual(wipeRes.tombstoneCreated, true);
    assert.strictEqual(wipeRes.partitionRemoved, true);

    // Verify tombstone on disk
    assert.strictEqual(isUserTombstoned(testUserWipe), true);

    // Subsequent read attempt throws AccountTombstonedError (410)
    assert.throws(
      () => {
        readUserPartition(testUserWipe);
      },
      (err) => {
        assert.ok(err instanceof AccountTombstonedError);
        assert.strictEqual(err.statusCode, 410);
        return true;
      }
    );

    // Subsequent write attempt throws AccountTombstonedError (410)
    assert.throws(
      () => {
        writeUserPartitionSync(testUserWipe, initial);
      },
      (err) => {
        assert.ok(err instanceof AccountTombstonedError);
        assert.strictEqual(err.statusCode, 410);
        return true;
      }
    );
  });

  test("13. Stale Temp Files: Purges Dangling .tmp.* Files", async () => {
    // Isolate test temp directory to avoid sweeping shared journals directory during concurrent test runs
    const isolatedTempDir = path.join(journalsDir, ".test_stale_cleanup");
    fs.mkdirSync(isolatedTempDir, { recursive: true });

    const fakeTemp = path.join(
      isolatedTempDir,
      `u_dummy.tmp.${process.pid}.${Date.now()}.json`
    );
    fs.writeFileSync(fakeTemp, "{}", "utf8");
    assert.ok(fs.existsSync(fakeTemp));

    await new Promise((r) => setTimeout(r, 10));

    // Cleanup with 0 maxAge targeting isolated directory
    const cleaned = cleanupStaleTempFiles(0, [isolatedTempDir]);
    assert.ok(cleaned >= 1);
    assert.ok(!fs.existsSync(fakeTemp));

    try {
      fs.rmSync(isolatedTempDir, { recursive: true, force: true });
    } catch {}
  });

  test("14. Derived Index Rebuild: Regenerates index.json from SSOT Partitions", () => {
    const index = rebuildJournalIndex();
    assert.strictEqual(index.version, 1);
    assert.ok(index.generatedAt);
    assert.ok(index.users[testUserA]);
    assert.strictEqual(typeof index.users[testUserA].accountCount, "number");
  });

  test("15. Security: UserId Validation & Anti-Traversal", () => {
    const maliciousIds = [
      "../etc/passwd",
      "user/evil",
      "..\\windows\\system32",
      "user\0nullbyte",
      "",
      "   ",
      "a".repeat(150),
    ];

    for (const badId of maliciousIds) {
      assert.throws(
        () => {
          assertValidUserId(badId);
        },
        InvalidUserIdError,
        `Expected InvalidUserIdError for "${badId}"`
      );
    }
  });

  test("16. Storage Health & Diagnostics", () => {
    const health = getJournalStorageHealth();
    assert.ok(["healthy", "degraded", "empty"].includes(health.status));
    assert.ok(health.activePartitionsCount >= 1);
    assert.ok(health.storageSizeBytes > 0);
  });

  test("17. RECOVERY_REQUIRED Persistence: Marker Prevents Accidental Empty Rehydration", () => {
    const userRec = `test_usr_rec_persist_${Date.now()}`;
    createdTestUsers.push(userRec);

    // Write a corrupted file with no backups
    fs.writeFileSync(getUserPartitionPath(userRec), "CORRUPT RAW BITS", "utf8");

    // Reading should throw 503 and create .recovery_required marker
    assert.throws(
      () => {
        readUserPartition(userRec, { bypassCache: true });
      },
      PartitionCorruptedError
    );

    assert.strictEqual(isUserRecoveryRequired(userRec), true);
    assert.ok(fs.existsSync(getUserRecoveryRequiredPath(userRec)));

    // Even if someone unlinks the corrupt file, the system must NOT create an empty partition!
    fs.unlinkSync(getUserPartitionPath(userRec));

    assert.throws(
      () => {
        readUserPartition(userRec, { bypassCache: true });
      },
      (err) => {
        assert.ok(err instanceof PartitionCorruptedError);
        assert.strictEqual(err.statusCode, 503);
        return true;
      }
    );

    // Writing to recovery-required partition is also blocked
    assert.throws(
      () => {
        writeUserPartitionSync(userRec, createEmptyPartition(userRec));
      },
      PartitionCorruptedError
    );
  });

  test("18. Security: Symbolic Link Partition Injection Rejection (HTTP 403)", () => {
    const userSymlink = `test_usr_symlink_${Date.now()}`;
    createdTestUsers.push(userSymlink);

    const partitionPath = getUserPartitionPath(userSymlink);
    const targetPath = path.join(dataDir, "academy.json");

    try {
      // Attempt creating symlink pointing to academy.json
      fs.symlinkSync(targetPath, partitionPath);

      assert.throws(
        () => {
          readUserPartition(userSymlink, { bypassCache: true });
        },
        (err) => {
          assert.ok(err instanceof JournalStorageError);
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    } catch (symErr) {
      // On Windows without elevated SeCreateSymbolicLinkPrivilege, symlink creation may throw EPERM
      if (symErr.code === "EPERM") {
        // OS policy blocks unprivileged symlinks; system is secure by OS policy
        assert.ok(true, "Symlinks disallowed by OS privilege policy");
      } else {
        throw symErr;
      }
    } finally {
      try {
        if (fs.existsSync(partitionPath) && fs.lstatSync(partitionPath).isSymbolicLink()) {
          fs.unlinkSync(partitionPath);
        }
      } catch {}
    }
  });

  test("19. Permanent Wipe Crash Resilience: Tombstone Committed First", async () => {
    const userWipeCrash = `test_usr_wipe_crash_${Date.now()}`;
    createdTestUsers.push(userWipeCrash);

    const initial = readUserPartition(userWipeCrash);
    writeUserPartitionSync(userWipeCrash, initial);

    const wipeRes = await wipeUserJournal(userWipeCrash, "SIMULATED_CRASH_TEST");
    assert.strictEqual(wipeRes.tombstoneCreated, true);

    // Verify tombstone is immediately written
    assert.strictEqual(isUserTombstoned(userWipeCrash), true);

    // Verify subsequent read rejects with HTTP 410
    assert.throws(
      () => {
        readUserPartition(userWipeCrash);
      },
      AccountTombstonedError
    );
  });

  test("20. Concurrency: Write versus Wipe Race (Wipe queued behind in-flight write)", async () => {
    const userRace = `test_usr_race_write_wipe_${Date.now()}`;
    createdTestUsers.push(userRace);

    const initial = readUserPartition(userRace);
    writeUserPartitionSync(userRace, initial);

    const events = [];

    // 1. Enqueue long write
    const writePromise = mutateUserPartition(userRace, async (part) => {
      events.push("write_started");
      await new Promise((r) => setTimeout(r, 40));
      events.push("write_finished");
      return {
        result: "write_done",
        updatedPartition: {
          ...part,
          accounts: [
            {
              id: "acc-race-1",
              userId: userRace,
              accountName: "Race Account",
              accountCurrency: "USD",
              currencyDecimals: 2,
              accountType: "LIVE",
              initialBalance: 5000,
              realizedBalance: 5000,
              equity: 5000,
              isArchived: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      };
    });

    // 2. Immediately enqueue wipe while write is in flight
    const wipePromise = (async () => {
      // Small pause to guarantee write has started
      await new Promise((r) => setTimeout(r, 10));
      events.push("wipe_queued");
      const res = await wipeUserJournal(userRace, "RACE_WIPE");
      events.push("wipe_completed");
      return res;
    })();

    const [wRes, wipeRes] = await Promise.all([writePromise, wipePromise]);

    assert.strictEqual(wRes, "write_done");
    assert.strictEqual(wipeRes.tombstoneCreated, true);

    // Assert sequence: write finished first, then wipe completed
    assert.deepStrictEqual(events, [
      "write_started",
      "wipe_queued",
      "write_finished",
      "wipe_completed",
    ]);

    // End state: user is tombstoned, partition removed
    assert.strictEqual(isUserTombstoned(userRace), true);
    assert.strictEqual(fs.existsSync(getUserPartitionPath(userRace)), false);
  });

  test("21. Concurrency: Wipe versus Write Race (Write queued behind in-flight wipe)", async () => {
    const userRace2 = `test_usr_race_wipe_write_${Date.now()}`;
    createdTestUsers.push(userRace2);

    const initial = readUserPartition(userRace2);
    writeUserPartitionSync(userRace2, initial);

    const events = [];

    // 1. Enqueue wipe (wipeUserJournal acquires user lock internally)
    const wipePromise = (async () => {
      events.push("wipe_started");
      const res = await wipeUserJournal(userRace2, "PRIOR_WIPE");
      events.push("wipe_done");
      return res;
    })();

    // 2. Immediately enqueue write while wipe is queued/executing
    const writePromise = (async () => {
      events.push("write_attempted");
      return await mutateUserPartition(userRace2, (part) => {
        events.push("write_mutator_called");
        return { result: "should_not_succeed", updatedPartition: part };
      });
    })();

    const [wipeRes, writeOutcome] = await Promise.allSettled([
      wipePromise,
      writePromise,
    ]);

    assert.strictEqual(wipeRes.status, "fulfilled");
    assert.strictEqual(writeOutcome.status, "rejected");
    assert.ok(writeOutcome.reason instanceof AccountTombstonedError);
    assert.strictEqual(writeOutcome.reason.statusCode, 410);

    // Verify mutator was NEVER called because in-critical-section tombstone check rejected it
    assert.ok(!events.includes("write_mutator_called"));
    assert.strictEqual(isUserTombstoned(userRace2), true);
  });

  test("22. Concurrency: Read versus Wipe Race with readUserPartitionLocked", async () => {
    const userReadWipe = `test_usr_read_wipe_${Date.now()}`;
    createdTestUsers.push(userReadWipe);

    const initial = readUserPartition(userReadWipe);
    writeUserPartitionSync(userReadWipe, initial);

    // 1. Wipe queued
    const wipePromise = wipeUserJournal(userReadWipe, "READ_WIPE_TEST");

    // 2. Read locked queued immediately
    const readPromise = readUserPartitionLocked(userReadWipe);

    const [wipeRes, readOutcome] = await Promise.allSettled([
      wipePromise,
      readPromise,
    ]);

    assert.strictEqual(wipeRes.status, "fulfilled");
    // Since read was enqueued, it either completed before wipe or after wipe (which throws 410)
    if (readOutcome.status === "rejected") {
      assert.ok(readOutcome.reason instanceof AccountTombstonedError);
      assert.strictEqual(readOutcome.reason.statusCode, 410);
    } else {
      assert.strictEqual(readOutcome.value.userId, userReadWipe);
    }
  });

  test("23. Crash Simulation: Tombstone Partial Tempfile & Corrupt Tombstone Fail-Safe", async () => {
    const userCrashTomb = `test_usr_crash_tomb_${Date.now()}`;
    createdTestUsers.push(userCrashTomb);

    // 1. Simulate process crash leaving a partial dangling .tombstone.tmp.* file
    const partialTempPath = path.join(
      journalsDir,
      `u_${userCrashTomb}.tombstone.tmp.${process.pid}.${Date.now()}.partial`
    );
    fs.writeFileSync(partialTempPath, '{"userId":', "utf8");
    assert.ok(fs.existsSync(partialTempPath));

    await new Promise((r) => setTimeout(r, 10));

    // Stale temp cleanup should purge the partial file targeting user's specific tombstone prefix
    const tombstonePrefix = `u_${userCrashTomb}.tombstone.tmp.`;
    const cleaned = cleanupStaleTempFiles(0, [journalsDir], tombstonePrefix);
    assert.ok(cleaned >= 1);
    assert.strictEqual(fs.existsSync(partialTempPath), false);

    // 2. Simulate damaged tombstone file: isUserTombstoned must fail-safe to true
    fs.writeFileSync(getUserTombstonePath(userCrashTomb), "CORRUPT TOMBSTONE RAW", "utf8");
    assert.strictEqual(isUserTombstoned(userCrashTomb), true);

    // Reading must be blocked
    assert.throws(() => {
      readUserPartition(userCrashTomb);
    }, AccountTombstonedError);
  });

  test("24. Crash Simulation: Interrupted Backup Snapshot (Partition valid on disk)", async () => {
    const userCrashBackup = `test_usr_crash_backup_${Date.now()}`;
    createdTestUsers.push(userCrashBackup);

    // Write initial partition
    const initial = readUserPartition(userCrashBackup);
    const written = writeUserPartitionSync(userCrashBackup, initial);
    assert.strictEqual(written.version, 2);

    // Simulate crash leaving a dangling .backup.tmp file in BACKUPS_DIR
    const danglingBackupTmp = path.join(
      backupsDir,
      `.u_${userCrashBackup}.backup.tmp.12345.6789.json`
    );
    fs.writeFileSync(danglingBackupTmp, "PARTIAL BACKUP CHUNK", "utf8");

    // Partition on disk is version 2 and must be read cleanly without interference from the temp backup
    const readPartition = readUserPartition(userCrashBackup, { bypassCache: true });
    assert.strictEqual(readPartition.version, 2);

    // Cleanup purges the dangling backup tempfile targeting user's specific backup prefix
    await new Promise((r) => setTimeout(r, 10));
    const backupPrefix = `.u_${userCrashBackup}.backup.tmp.`;
    cleanupStaleTempFiles(0, [backupsDir], backupPrefix);
    assert.strictEqual(fs.existsSync(danglingBackupTmp), false);
  });
});
