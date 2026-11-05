/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * STUDENT TRADING JOURNAL & PERFORMANCE TRACKING
 * Storage & Database Architecture Layer (v2.1.1)
 *
 * Implements:
 * - Per-user asynchronous Promise mutex queue (UserPartitionLock)
 * - Atomic writes via temporary files and fsyncSync
 * - OS-specific directory durability (POSIX dir fsync vs Windows NTFS)
 * - Crash recovery (pre-rename vs post-rename)
 * - Quarantine of corrupted partitions and automated backup restoration
 * - Strict RECOVERY_REQUIRED state (HTTP 503 + Incident ID) when no valid backup exists
 * - Optimistic concurrency control (expectedVersion -> HTTP 409)
 * - Persistent GDPR tombstone enforcement preventing stale backup rehydration
 * - Pure Node.js zero-dependency implementation
 */

import fs from "node:fs";
import path from "node:path";
import type {
  UserJournalPartition,
  JournalIndexSchema,
  JournalIndexEntry,
} from "./journal-types";
import {
  ConcurrencyConflictError,
  PartitionCorruptedError,
  AccountTombstonedError,
  InvalidUserIdError,
  JournalStorageError,
} from "./journal-types";

// ── Configuration Constants ──────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
const JOURNALS_DIR = path.join(DATA_DIR, "journals");
const CORRUPTED_DIR = path.join(JOURNALS_DIR, "corrupted");
const AUDIT_DIR = path.join(JOURNALS_DIR, "audit");
const BACKUPS_DIR = path.join(DATA_DIR, "backups", "journals");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads", "journals");
const INDEX_FILE = path.join(JOURNALS_DIR, "index.json");

const MAX_USER_BACKUP_SNAPSHOTS = 5;
const STALE_TEMP_FILE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// ── In-Memory Per-User Mutex Queue ───────────────────────────────

export class UserPartitionLock {
  private tails = new Map<string, Promise<unknown>>();

  /**
   * Enqueues a task sequentially behind any pending operations for the given userId.
   * Guarantees that previous task rejections do NOT block subsequent queued tasks.
   * Cleans up the Map entry when the queue becomes idle.
   */
  async acquire<T>(userId: string, task: () => Promise<T>): Promise<T> {
    assertValidUserId(userId);

    const prevTail = this.tails.get(userId) || Promise.resolve();

    // Create the next tail promise that executes after prevTail settles
    const nextTail = (async () => {
      // Absorb preceding failure to ensure queue continuation
      await prevTail.catch(() => {});
      return await task();
    })();

    // Register nextTail in the map as the current tail
    this.tails.set(userId, nextTail);

    // Cleanup: When nextTail completes, remove entry ONLY IF no newer task has updated the tail
    nextTail
      .finally(() => {
        if (this.tails.get(userId) === nextTail) {
          this.tails.delete(userId);
        }
      })
      .catch(() => {}); // Absorb rejection on the cleanup watcher to prevent dangling unhandledRejection

    return await nextTail;
  }

  /**
   * Diagnostic inspection: check if an active queue exists for this user
   */
  isLocked(userId: string): boolean {
    return this.tails.has(userId);
  }

  /**
   * Diagnostic inspection: total active user queues currently executing or queued
   */
  getActiveQueuesCount(): number {
    return this.tails.size;
  }
}

// Global singleton lock for the single-process Node.js runtime
export const globalUserPartitionLock = new UserPartitionLock();

// ── In-Memory Cache ──────────────────────────────────────────────

interface PartitionCacheEntry {
  partition: UserJournalPartition;
  mtimeMs: number;
  sizeBytes: number;
}

const partitionCache = new Map<string, PartitionCacheEntry>();

// ── Directory Initialization ─────────────────────────────────────

export function ensureJournalDirectories(): void {
  const dirs = [JOURNALS_DIR, CORRUPTED_DIR, AUDIT_DIR, BACKUPS_DIR, UPLOADS_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Ensure base directories on module load
ensureJournalDirectories();

// ── Security & Path Validation ───────────────────────────────────

export function assertValidUserId(userId: string): void {
  if (
    !userId ||
    typeof userId !== "string" ||
    userId.trim().length === 0 ||
    userId.length > 128 ||
    !/^[a-zA-Z0-9_-]+$/.test(userId)
  ) {
    throw new InvalidUserIdError(
      `Invalid userId specified: "${userId}". User IDs must be alphanumeric with dashes or underscores (1-128 chars).`
    );
  }
}

export function getUserPartitionPath(userId: string): string {
  assertValidUserId(userId);
  const target = path.resolve(JOURNALS_DIR, `u_${userId}.json`);
  if (!target.startsWith(path.resolve(JOURNALS_DIR) + path.sep)) {
    throw new InvalidUserIdError(`Path traversal detected for userId: "${userId}".`);
  }
  return target;
}

export function getUserTombstonePath(userId: string): string {
  assertValidUserId(userId);
  const target = path.resolve(JOURNALS_DIR, `u_${userId}.tombstone`);
  if (!target.startsWith(path.resolve(JOURNALS_DIR) + path.sep)) {
    throw new InvalidUserIdError(`Path traversal detected for userId: "${userId}".`);
  }
  return target;
}

export function isUserTombstoned(userId: string): boolean {
  assertValidUserId(userId);
  const tPath = getUserTombstonePath(userId);
  if (!fs.existsSync(tPath)) return false;
  try {
    const raw = fs.readFileSync(tPath, "utf8");
    const parsed = JSON.parse(raw);
    return !!(parsed && parsed.userId === userId && parsed.wipedAt);
  } catch {
    // Fail-safe: if tombstone file exists but unparseable, treat as tombstoned
    return true;
  }
}

export function writeTombstoneAtomically(
  userId: string,
  payload: { userId: string; wipedAt: string; reason: string }
): void {
  assertValidUserId(userId);
  ensureJournalDirectories();
  const finalPath = getUserTombstonePath(userId);
  const tmpName = `u_${userId}.tombstone.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const tmpPath = path.join(JOURNALS_DIR, tmpName);

  let fd: number | null = null;
  try {
    fd = fs.openSync(tmpPath, "w");
    fs.writeSync(fd, JSON.stringify(payload, null, 2), 0, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    fs.renameSync(tmpPath, finalPath);

    if (process.platform !== "win32") {
      try {
        const dirFd = fs.openSync(JOURNALS_DIR, "r");
        fs.fsyncSync(dirFd);
        fs.closeSync(dirFd);
      } catch {}
    }
  } catch (err) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
    throw err;
  }
}

export function getUserRecoveryRequiredPath(userId: string): string {
  assertValidUserId(userId);
  const target = path.resolve(JOURNALS_DIR, `u_${userId}.recovery_required`);
  if (!target.startsWith(path.resolve(JOURNALS_DIR) + path.sep)) {
    throw new InvalidUserIdError(`Path traversal detected for userId: "${userId}".`);
  }
  return target;
}

export function isUserRecoveryRequired(userId: string): boolean {
  assertValidUserId(userId);
  return fs.existsSync(getUserRecoveryRequiredPath(userId));
}

// ── Schema Validation & Migration Helper ─────────────────────────

export function isValidJournalPartition(data: unknown): data is UserJournalPartition {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.userId === "string" &&
    typeof d.version === "number" &&
    Array.isArray(d.accounts) &&
    Array.isArray(d.trades) &&
    Array.isArray(d.reviews) &&
    Array.isArray(d.strategies)
  );
}

function migratePartitionSchema(raw: unknown, userId: string): UserJournalPartition {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const schemaVersion = typeof d.schemaVersion === "number" ? d.schemaVersion : 0;

  // Migration from v0 to v1
  const accounts = Array.isArray(d.accounts) ? (d.accounts as UserJournalPartition["accounts"]) : [];
  const cashTransactions = Array.isArray(d.cashTransactions)
    ? (d.cashTransactions as UserJournalPartition["cashTransactions"])
    : [];
  const trades = Array.isArray(d.trades) ? (d.trades as UserJournalPartition["trades"]) : [];
  const reviews = Array.isArray(d.reviews) ? (d.reviews as UserJournalPartition["reviews"]) : [];
  const strategies = Array.isArray(d.strategies)
    ? (d.strategies as UserJournalPartition["strategies"])
    : [];
  const consent = d.consent && typeof d.consent === "object" ? (d.consent as UserJournalPartition["consent"]) : null;
  const totalAttachmentBytes =
    typeof d.totalAttachmentBytes === "number" ? d.totalAttachmentBytes : 0;
  const version = typeof d.version === "number" ? d.version : 1;
  const now = new Date().toISOString();
  const createdAt = typeof d.createdAt === "string" ? d.createdAt : now;
  const updatedAt = typeof d.updatedAt === "string" ? d.updatedAt : now;

  return {
    schemaVersion: Math.max(1, schemaVersion),
    userId,
    version,
    accounts,
    cashTransactions,
    trades,
    reviews,
    strategies,
    consent,
    totalAttachmentBytes,
    createdAt,
    updatedAt,
  };
}

export function createEmptyPartition(userId: string): UserJournalPartition {
  assertValidUserId(userId);
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    userId,
    version: 1,
    accounts: [],
    cashTransactions: [],
    trades: [],
    reviews: [],
    strategies: [],
    consent: null,
    totalAttachmentBytes: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Backup & Quarantine Operations ───────────────────────────────

function findLatestValidBackup(userId: string): UserJournalPartition | null {
  try {
    ensureJournalDirectories();
    if (isUserTombstoned(userId)) return null;
    if (!fs.existsSync(BACKUPS_DIR)) return null;

    const prefix = `u_${userId}.`;
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
      .map((f) => {
        const full = path.join(BACKUPS_DIR, f);
        return { full, time: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.time - a.time);

    for (const file of files) {
      try {
        const raw = fs.readFileSync(file.full, "utf8");
        const parsed = JSON.parse(raw);
        if (isValidJournalPartition(parsed) && parsed.userId === userId) {
          return parsed;
        }
      } catch {
        // Skip unparseable backup snapshot
      }
    }
  } catch {
    // Ignore read errors during backup discovery
  }
  return null;
}

function rotateUserBackups(userId: string): void {
  try {
    const prefix = `u_${userId}.`;
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
      .map((f) => {
        const full = path.join(BACKUPS_DIR, f);
        return { full, time: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_USER_BACKUP_SNAPSHOTS) {
      const toDelete = files.slice(MAX_USER_BACKUP_SNAPSHOTS);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.full);
        } catch {}
      }
    }
  } catch {}
}

// ── Core Read Partition Operation ────────────────────────────────

export interface ReadPartitionOptions {
  bypassCache?: boolean;
}

/**
 * Reads a user's partition file.
 * - Enforces tombstone gate (HTTP 410).
 * - Utilizes memory cache if disk file mtime & size match.
 * - Quarantines corrupt files and restores latest valid backup.
 * - If corrupt and NO valid backup exists, marks RECOVERY_REQUIRED (HTTP 503).
 */
export function readUserPartition(
  userId: string,
  options?: ReadPartitionOptions
): UserJournalPartition {
  assertValidUserId(userId);
  ensureJournalDirectories();

  if (isUserTombstoned(userId)) {
    throw new AccountTombstonedError(
      `Partition for user "${userId}" has been permanently wiped and tombstoned.`
    );
  }

  if (isUserRecoveryRequired(userId)) {
    throw new PartitionCorruptedError(
      `Partition for user "${userId}" is flagged RECOVERY_REQUIRED. Administrative intervention required.`,
      `RECOVERY-${userId}`
    );
  }

  const partitionPath = getUserPartitionPath(userId);

  // Symlink security check
  if (fs.existsSync(partitionPath)) {
    try {
      const lstat = fs.lstatSync(partitionPath);
      if (lstat.isSymbolicLink()) {
        throw new JournalStorageError(
          `Security violation: Partition path "${partitionPath}" is a symbolic link.`,
          403
        );
      }
    } catch (statErr) {
      if (statErr instanceof JournalStorageError) throw statErr;
    }
  }

  // Check memory cache
  if (!options?.bypassCache && partitionCache.has(userId)) {
    try {
      if (fs.existsSync(partitionPath)) {
        const stat = fs.statSync(partitionPath);
        const cached = partitionCache.get(userId)!;
        if (stat.mtimeMs === cached.mtimeMs && stat.size === cached.sizeBytes) {
          return cached.partition;
        }
      }
    } catch {}
  }

  // If file does not exist on disk, return a fresh empty partition
  if (!fs.existsSync(partitionPath)) {
    const fresh = createEmptyPartition(userId);
    return fresh;
  }

  // Attempt to read from physical disk
  try {
    const raw = fs.readFileSync(partitionPath, "utf8");
    const parsed = JSON.parse(raw);

    if (isValidJournalPartition(parsed) && parsed.userId === userId) {
      // Check if schema migration needed
      let finalData = parsed;
      if (parsed.schemaVersion === undefined || parsed.schemaVersion < 1) {
        finalData = migratePartitionSchema(parsed, userId);
      }

      const stat = fs.statSync(partitionPath);
      partitionCache.set(userId, {
        partition: finalData,
        mtimeMs: stat.mtimeMs,
        sizeBytes: stat.size,
      });

      return finalData;
    }

    throw new Error("Partition schema validation failed.");
  } catch {
    // ── Quarantine & Disaster Recovery ──
    const incidentId = `INC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const corruptTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const corruptFilename = `u_${userId}.corrupt.${corruptTimestamp}.json`;
    const corruptPath = path.join(CORRUPTED_DIR, corruptFilename);

    try {
      if (fs.existsSync(partitionPath)) {
        fs.copyFileSync(partitionPath, corruptPath);
      }
    } catch (copyErr) {
      console.error(`[JOURNAL STORAGE ERROR] Failed to quarantine corrupt file:`, copyErr);
    }

    // Try finding latest valid backup
    const backupData = findLatestValidBackup(userId);
    if (backupData) {
      console.warn(
        `[JOURNAL STORAGE WARN] Corrupt partition for user "${userId}" quarantined to "${corruptFilename}". Restoring from backup (version ${backupData.version}). Incident ID: ${incidentId}`
      );
      // Restore partition from backup
      writeUserPartitionSync(userId, backupData);
      return backupData;
    }

    // STRICT SAFETY GATE: No valid backup exists! NEVER overwrite with empty partition.
    // Flag persistent recovery required marker on disk
    try {
      const recPath = getUserRecoveryRequiredPath(userId);
      const recPayload = {
        userId,
        incidentId,
        flaggedAt: new Date().toISOString(),
        corruptFilename,
      };
      fs.writeFileSync(recPath, JSON.stringify(recPayload, null, 2), "utf8");
    } catch {}

    console.error(
      `[CRITICAL JOURNAL STORAGE ERROR] Corrupt partition for user "${userId}" with NO valid backup! Incident: ${incidentId}. Flagged RECOVERY_REQUIRED.`
    );
    throw new PartitionCorruptedError(
      `Corrupted partition quarantined to "${corruptFilename}". No valid backup snapshot available. Raw bits preserved for manual inspection.`,
      incidentId
    );
  }
}

// ── Core Write Partition Operation ───────────────────────────────

export interface WritePartitionOptions {
  expectedVersion?: number;
}

/**
 * Writes a user partition with atomic file replacement and cross-OS durability.
 * Must be executed inside UserPartitionLock to guarantee concurrency safety.
 */
export function writeUserPartitionSync(
  userId: string,
  partition: UserJournalPartition,
  options?: WritePartitionOptions
): UserJournalPartition {
  assertValidUserId(userId);
  ensureJournalDirectories();

  if (isUserTombstoned(userId)) {
    throw new AccountTombstonedError(
      `Cannot write to tombstoned partition for user "${userId}".`
    );
  }

  if (isUserRecoveryRequired(userId)) {
    throw new PartitionCorruptedError(
      `Cannot write to partition for user "${userId}" while in RECOVERY_REQUIRED state.`,
      `RECOVERY-${userId}`
    );
  }

  if (partition.userId !== userId) {
    throw new JournalStorageError(
      `Partition userId mismatch: payload contains "${partition.userId}", target is "${userId}".`,
      422
    );
  }

  const finalPath = getUserPartitionPath(userId);

  // Optimistic concurrency verification
  if (options?.expectedVersion !== undefined) {
    if (partition.version !== options.expectedVersion) {
      throw new ConcurrencyConflictError(
        `Optimistic concurrency conflict: Expected version ${options.expectedVersion}, but loaded partition is version ${partition.version}.`
      );
    }
  }

  // Clone partition object, increment version and timestamp
  const nextVersion = partition.version + 1;
  const now = new Date().toISOString();
  const nextPartition: UserJournalPartition = {
    ...partition,
    schemaVersion: 1,
    version: nextVersion,
    updatedAt: now,
  };

  const jsonString = JSON.stringify(nextPartition, null, 2);

  // Generate unique temporary file name in the same directory for atomic rename
  const tmpName = `u_${userId}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.json`;
  const tmpPath = path.join(JOURNALS_DIR, tmpName);

  let fd: number | null = null;
  try {
    fd = fs.openSync(tmpPath, "w");
    fs.writeSync(fd, jsonString, 0, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    // Atomic Replace
    fs.renameSync(tmpPath, finalPath);

    // Cross-OS Durability Handling
    if (process.platform !== "win32") {
      // POSIX / Linux: flush parent directory inode changes to filesystem journal
      try {
        const dirFd = fs.openSync(JOURNALS_DIR, "r");
        fs.fsyncSync(dirFd);
        fs.closeSync(dirFd);
      } catch (dirErr) {
        console.warn("[JOURNAL STORAGE] Directory fsync warning (POSIX):", dirErr);
      }
    }
    // On Windows NTFS, libuv uv_fs_rename employs MoveFileExW with MOVEFILE_REPLACE_EXISTING for atomic replacement

    // Update memory cache
    const postStat = fs.statSync(finalPath);
    partitionCache.set(userId, {
      partition: nextPartition,
      mtimeMs: postStat.mtimeMs,
      sizeBytes: postStat.size,
    });

    // Create rotating backup snapshot atomically via tempfile + rename
    try {
      const backupFilename = `u_${userId}.${Date.now()}.json`;
      const backupPath = path.join(BACKUPS_DIR, backupFilename);
      const tmpBackupPath = path.join(
        BACKUPS_DIR,
        `.u_${userId}.backup.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.json`
      );
      fs.copyFileSync(finalPath, tmpBackupPath);
      fs.renameSync(tmpBackupPath, backupPath);
      rotateUserBackups(userId);
    } catch (bErr) {
      console.warn("[JOURNAL STORAGE] Failed to create backup snapshot:", bErr);
    }

    return nextPartition;
  } catch (err) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }
    throw err;
  }
}

/**
 * Asynchronously mutates a user's partition inside the per-user mutex lock.
 * Enforces in-critical-section checks for tombstone and recovery_required states.
 */
export async function mutateUserPartition<T>(
  userId: string,
  mutator: (partition: UserJournalPartition) => Promise<{ result: T; updatedPartition?: UserJournalPartition }> | { result: T; updatedPartition?: UserJournalPartition },
  options?: WritePartitionOptions
): Promise<T> {
  return await globalUserPartitionLock.acquire(userId, async () => {
    // 1. Critical section check: tombstone enforcement
    if (isUserTombstoned(userId)) {
      throw new AccountTombstonedError(
        `Cannot mutate partition: User "${userId}" has been permanently wiped and tombstoned.`
      );
    }

    // 2. Critical section check: recovery_required enforcement
    if (isUserRecoveryRequired(userId)) {
      throw new PartitionCorruptedError(
        `Cannot mutate partition for user "${userId}": Storage is flagged RECOVERY_REQUIRED.`,
        `RECOVERY-${userId}`
      );
    }

    const partition = readUserPartition(userId);
    const outcome = await mutator(partition);

    if (outcome.updatedPartition) {
      // Re-verify tombstone before writing to disk
      if (isUserTombstoned(userId)) {
        throw new AccountTombstonedError(
          `Cannot write partition: User "${userId}" was tombstoned during execution.`
        );
      }
      writeUserPartitionSync(userId, outcome.updatedPartition, options);
    }

    return outcome.result;
  });
}

/**
 * Asynchronously reads a user's partition inside the per-user mutex lock.
 */
export async function readUserPartitionLocked(
  userId: string,
  options?: ReadPartitionOptions
): Promise<UserJournalPartition> {
  return await globalUserPartitionLock.acquire(userId, async () => {
    return readUserPartition(userId, options);
  });
}

// ── Permanent Wipe & Tombstone Lifecycle ─────────────────────────

export interface WipeResult {
  userId: string;
  wipedAt: string;
  partitionRemoved: boolean;
  backupsRemovedCount: number;
  uploadsRemoved: boolean;
  tombstoneCreated: boolean;
}

/**
 * Executes GDPR permanent wipe of student journal partition and all attachments.
 * Writes a permanent tombstone preventing stale backups from rehydrating.
 */
export async function wipeUserJournal(
  userId: string,
  reason = "STUDENT_REQUESTED_PERMANENT_WIPE"
): Promise<WipeResult> {
  return await globalUserPartitionLock.acquire(userId, async () => {
    assertValidUserId(userId);
    ensureJournalDirectories();

    // 1. Commit persistent tombstone FIRST via atomic write with fsync to guarantee crash resilience.
    // If the process crashes at any subsequent step, the tombstone prevents any resurrection.
    const tombstonePayload = {
      userId,
      wipedAt: new Date().toISOString(),
      reason,
    };
    writeTombstoneAtomically(userId, tombstonePayload);

    // 2. Remove recovery_required marker if present
    const recPath = getUserRecoveryRequiredPath(userId);
    if (fs.existsSync(recPath)) {
      try {
        fs.unlinkSync(recPath);
      } catch {}
    }

    // 3. Purge memory cache
    partitionCache.delete(userId);

    // 4. Unlink partition file
    const partitionPath = getUserPartitionPath(userId);
    let partitionRemoved = false;
    if (fs.existsSync(partitionPath)) {
      fs.unlinkSync(partitionPath);
      partitionRemoved = true;
    }

    // 5. Purge uploaded media directory
    const userUploadsDir = path.join(UPLOADS_DIR, userId);
    let uploadsRemoved = false;
    if (fs.existsSync(userUploadsDir)) {
      try {
        fs.rmSync(userUploadsDir, { recursive: true, force: true });
        uploadsRemoved = true;
      } catch (uErr) {
        console.warn(`[JOURNAL STORAGE] Failed to delete uploads dir for ${userId}:`, uErr);
      }
    }

    // 6. Purge user backups
    let backupsRemovedCount = 0;
    if (fs.existsSync(BACKUPS_DIR)) {
      const prefix = `u_${userId}.`;
      const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith(prefix));
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(BACKUPS_DIR, f));
          backupsRemovedCount++;
        } catch {}
      }
    }

    return {
      userId,
      wipedAt: tombstonePayload.wipedAt,
      partitionRemoved,
      backupsRemovedCount,
      uploadsRemoved,
      tombstoneCreated: true,
    };
  });
}

// ── Stale Temp Files Cleanup on Startup ───────────────────────────

export function cleanupStaleTempFiles(maxAgeMs = STALE_TEMP_FILE_MAX_AGE_MS): number {
  ensureJournalDirectories();
  let cleanedCount = 0;
  try {
    const now = Date.now();
    const dirsToScan = [JOURNALS_DIR, BACKUPS_DIR];
    for (const dir of dirsToScan) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.includes(".tmp")) {
          const full = path.join(dir, file);
          try {
            const stat = fs.statSync(full);
            if (now - stat.mtimeMs >= maxAgeMs) {
              fs.unlinkSync(full);
              cleanedCount++;
            }
          } catch {}
        }
      }
    }
  } catch {}
  return cleanedCount;
}

// ── Derived Index Rebuild (SSOT Maintenance) ─────────────────────

/**
 * Rebuilds the derived index.json from the single source of truth (u_*.json).
 */
export function rebuildJournalIndex(): JournalIndexSchema {
  ensureJournalDirectories();

  const index: JournalIndexSchema = {
    version: 1,
    generatedAt: new Date().toISOString(),
    users: {},
  };

  try {
    const files = fs
      .readdirSync(JOURNALS_DIR)
      .filter((f) => f.startsWith("u_") && f.endsWith(".json"));

    for (const f of files) {
      const full = path.join(JOURNALS_DIR, f);
      try {
        const raw = fs.readFileSync(full, "utf8");
        const parsed = JSON.parse(raw);
        if (isValidJournalPartition(parsed)) {
          const entry: JournalIndexEntry = {
            userId: parsed.userId,
            accountCount: parsed.accounts.length,
            tradeCount: parsed.trades.length,
            hasActiveConsent: !!(parsed.consent && !parsed.consent.isRevoked),
            totalAttachmentBytes: parsed.totalAttachmentBytes || 0,
            lastUpdated: parsed.updatedAt,
          };
          index.users[parsed.userId] = entry;
        }
      } catch {
        // Skip corrupted partitions in index
      }
    }

    // Atomic write index.json
    const tmpIndex = path.join(
      JOURNALS_DIR,
      `.index.tmp.${process.pid}.${Date.now()}.json`
    );
    fs.writeFileSync(tmpIndex, JSON.stringify(index, null, 2), "utf8");
    fs.renameSync(tmpIndex, INDEX_FILE);
  } catch (err) {
    console.error("[JOURNAL STORAGE] Failed to rebuild index.json:", err);
  }

  return index;
}

// ── Storage Health & Diagnostics ─────────────────────────────────

export interface JournalStorageHealth {
  status: "healthy" | "degraded" | "empty";
  activePartitionsCount: number;
  corruptedPartitionsCount: number;
  backupsCount: number;
  storageSizeBytes: number;
  lastGeneratedIndex: string | null;
}

export function getJournalStorageHealth(): JournalStorageHealth {
  ensureJournalDirectories();

  let activePartitionsCount = 0;
  let corruptedPartitionsCount = 0;
  let backupsCount = 0;
  let storageSizeBytes = 0;

  try {
    if (fs.existsSync(JOURNALS_DIR)) {
      const files = fs.readdirSync(JOURNALS_DIR);
      for (const f of files) {
        if (f.startsWith("u_") && f.endsWith(".json")) {
          activePartitionsCount++;
          try {
            storageSizeBytes += fs.statSync(path.join(JOURNALS_DIR, f)).size;
          } catch {}
        }
      }
    }

    if (fs.existsSync(CORRUPTED_DIR)) {
      corruptedPartitionsCount = fs.readdirSync(CORRUPTED_DIR).length;
    }

    if (fs.existsSync(BACKUPS_DIR)) {
      backupsCount = fs.readdirSync(BACKUPS_DIR).length;
    }
  } catch {}

  let lastGeneratedIndex: string | null = null;
  if (fs.existsSync(INDEX_FILE)) {
    try {
      const raw = fs.readFileSync(INDEX_FILE, "utf8");
      const parsed = JSON.parse(raw);
      lastGeneratedIndex = parsed.generatedAt || null;
    } catch {}
  }

  return {
    status: corruptedPartitionsCount > 0 ? "degraded" : activePartitionsCount > 0 ? "healthy" : "empty",
    activePartitionsCount,
    corruptedPartitionsCount,
    backupsCount,
    storageSizeBytes,
    lastGeneratedIndex,
  };
}
