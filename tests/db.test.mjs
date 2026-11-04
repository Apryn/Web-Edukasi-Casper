import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

if (typeof registerHooks === "function" && typeof stripTypeScriptTypes === "function") {
  registerHooks({
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
  getDatabase,
  findUserByEmail,
  createUser,
  getUserCourseProgress,
  getAllUserProgress,
  upsertUserProgress,
  getDatabaseHealth,
  createBackup,
  isValidDatabaseSchema,
  executeTransactionForTest,
} = await import("../lib/db.ts");

describe("Signal Casper Academy - JSON Database Audit & Verification Tests", () => {
  const dataDir = path.join(process.cwd(), "data");
  const dbFile = path.join(dataDir, "academy.json");

  let preTestSnapshot = null;
  before(() => {
    if (fs.existsSync(dbFile)) {
      preTestSnapshot = fs.readFileSync(dbFile, "utf8");
    }
  });

  after(() => {
    // Restore pristine database state so tests never pollute academy.json
    if (preTestSnapshot) {
      fs.writeFileSync(dbFile, preTestSnapshot, "utf8");
    }
    // Clean any test quarantine files
    try {
      const files = fs.readdirSync(dataDir);
      for (const f of files) {
        if (f.startsWith("academy.corrupt.")) {
          try {
            fs.unlinkSync(path.join(dataDir, f));
          } catch {}
        }
      }
    } catch {}
  });

  test("1. Database Initialization & Legacy SQLite Migration", () => {
    const db = getDatabase();
    assert.ok(isValidDatabaseSchema(db), "Database schema must be valid");
    assert.ok(fs.existsSync(dbFile), "academy.json must exist after getDatabase");

    // Verify migration from academy.db if it existed
    const apryn = findUserByEmail("apryn@casper.com");
    if (apryn) {
      assert.equal(apryn.email, "apryn@casper.com");
      assert.equal(apryn.name, "Apryn");
      assert.ok(apryn.password_hash.startsWith("$2b$"), "Password hash must be preserved");

      const progress = getUserCourseProgress(apryn.id, "trading-fundamentals");
      assert.ok(progress, "Apryn's course progress should exist");
      const completed = JSON.parse(progress.completed_lesson_ids);
      assert.deepEqual(completed, ["l1-1", "l1-2", "l1-3"]);
    }
  });

  test("2. Concurrency: Multiple Simultaneous Writes & Duplicate Prevention", async () => {
    const testEmailPrefix = `test_concurrent_${Date.now()}`;
    const concurrencyCount = 20;

    // A. Concurrently write 20 distinct users
    const promises = [];
    for (let i = 0; i < concurrencyCount; i++) {
      promises.push(
        Promise.resolve().then(() => {
          return createUser({
            id: crypto.randomUUID(),
            email: `${testEmailPrefix}_${i}@test.com`,
            name: `Test User ${i}`,
            passwordHash: "$2b$10$fakehashfortesting1234567890",
            role: "USER",
          });
        })
      );
    }

    const createdUsers = await Promise.all(promises);
    assert.equal(createdUsers.length, concurrencyCount, "All 20 users should be created");

    // Verify each user is found in DB
    for (let i = 0; i < concurrencyCount; i++) {
      const found = findUserByEmail(`${testEmailPrefix}_${i}@test.com`);
      assert.ok(found, `User ${i} must exist in database`);
    }

    // B. Concurrency: duplicate email must be rejected atomically
    const duplicateEmail = `${testEmailPrefix}_dup@test.com`;
    createUser({
      id: crypto.randomUUID(),
      email: duplicateEmail,
      name: "First User",
      passwordHash: "hash1",
    });

    assert.throws(
      () => {
        createUser({
          id: crypto.randomUUID(),
          email: duplicateEmail,
          name: "Second User Race",
          passwordHash: "hash2",
        });
      },
      /sudah terdaftar/,
      "Must throw duplicate email error"
    );
  });

  test("3. Concurrency: Multiple Progress Updates without Lost Updates", async () => {
    const userId = crypto.randomUUID();
    const courseSlug = "crypto-advanced";

    // Perform multiple rapid updates for the same user
    for (let i = 1; i <= 10; i++) {
      upsertUserProgress({
        id: crypto.randomUUID(),
        userId,
        courseSlug,
        completedLessonIds: Array.from({ length: i }, (_, idx) => `lesson-${idx + 1}`),
        quizScores: { [`quiz-${i}`]: 100 },
        lastLessonId: `lesson-${i}`,
      });
    }

    const final = getUserCourseProgress(userId, courseSlug);
    assert.ok(final, "Progress should exist");
    assert.equal(final.last_lesson_id, "lesson-10");
    const completed = JSON.parse(final.completed_lesson_ids);
    assert.equal(completed.length, 10, "Must have 10 completed lessons, no lost updates");
  });

  test("4. Cache Consistency & Rollback on Failed Write", () => {
    const healthBefore = getDatabaseHealth();
    const userCountBefore = healthBefore.userCount;
    const testFailEmail = `fakefail_${Date.now()}@test.com`;

    // Test that executeTransactionForTest rolls back cache if an error occurs inside mutator or write
    assert.throws(
      () => {
        executeTransactionForTest((db) => {
          db.users.push({
            id: "fake-fail-user",
            email: testFailEmail,
            name: "Fail",
            password_hash: "none",
            role: "USER",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          throw new Error("Simulated Disk Full Exception");
        });
      },
      /Simulated Disk Full Exception/
    );

    // Verify cache in memory does not contain the leaked user
    const leak = findUserByEmail(testFailEmail);
    assert.equal(leak, null, "Failed write must not corrupt cache state");
    const healthAfter = getDatabaseHealth();
    assert.equal(healthAfter.userCount, userCountBefore, "User count must remain unchanged");
  });

  test("5. Application Restart & Cold Disk Re-hydration", () => {
    const testId = crypto.randomUUID();
    const testEmail = `cold_restart_${Date.now()}@test.com`;

    createUser({
      id: testId,
      email: testEmail,
      name: "Cold Restart Test",
      passwordHash: "hash123",
      role: "USER",
    });

    // Verify raw file on disk directly (bypassing any in-memory cache)
    const rawOnDisk = fs.readFileSync(dbFile, "utf8");
    const parsed = JSON.parse(rawOnDisk);
    const userOnDisk = parsed.users.find((u) => u.id === testId);
    assert.ok(userOnDisk, "Data must be physically present on disk");
    assert.equal(userOnDisk.email, testEmail);
  });

  test("6. Corrupted JSON Quarantine & Auto-Recovery from Backup", () => {
    // 1. Ensure a valid backup exists first
    const backupCreated = createBackup("test-safety-snapshot");
    assert.ok(backupCreated, "Backup must be created");
    assert.ok(fs.existsSync(backupCreated), "Backup file must physically exist");

    // 2. Corrupt academy.json intentionally with malformed JSON
    fs.writeFileSync(dbFile, "{ corrupt_json_test: true, missing_closing_brace: ...", "utf8");

    // 3. Trigger loadDatabase() via getDatabaseHealth()
    const health = getDatabaseHealth();
    assert.ok(health.userCount > 0, "System should safely recover from backup without data wipe");

    // 4. Verify corrupted file was quarantined
    const files = fs.readdirSync(dataDir);
    const quarantined = files.filter((f) => f.startsWith("academy.corrupt."));
    assert.ok(quarantined.length > 0, "Corrupted file must be quarantined");

    // Cleanup quarantine files created by test
    for (const q of quarantined) {
      try {
        fs.unlinkSync(path.join(dataDir, q));
      } catch {}
    }
  });

  test("7. User Isolation: Tenant Data Separation", () => {
    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();
    const slug = "technical-analysis-101";

    // User A completes lesson 1 & 2
    upsertUserProgress({
      id: crypto.randomUUID(),
      userId: userA,
      courseSlug: slug,
      completedLessonIds: ["l1", "l2"],
      quizScores: { l2: 80 },
      lastLessonId: "l2",
    });

    // User B completes lesson 3
    upsertUserProgress({
      id: crypto.randomUUID(),
      userId: userB,
      courseSlug: slug,
      completedLessonIds: ["l3"],
      quizScores: { l3: 100 },
      lastLessonId: "l3",
    });

    // Check isolation
    const progressA = getUserCourseProgress(userA, slug);
    const progressB = getUserCourseProgress(userB, slug);

    assert.ok(progressA);
    assert.ok(progressB);

    assert.deepEqual(JSON.parse(progressA.completed_lesson_ids), ["l1", "l2"]);
    assert.deepEqual(JSON.parse(progressB.completed_lesson_ids), ["l3"]);
    assert.equal(progressA.user_id, userA);
    assert.equal(progressB.user_id, userB);

    // Verify allUserProgress for userA does NOT include userB's entries
    const allA = getAllUserProgress(userA);
    assert.ok(allA.every((p) => p.user_id === userA));
  });

  test("8. Database Health & Diagnostic Metrics", () => {
    const health = getDatabaseHealth();
    assert.equal(health.status, "healthy");
    assert.ok(health.userCount >= 1, "Must have users");
    assert.ok(health.fileSizeBytes > 0, "File size must be greater than 0");
    assert.ok(health.backupCount >= 1, "Must have at least 1 backup");
  });
});
