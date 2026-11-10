import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);

// ── Types ────────────────────────────────────────────────────────
export interface DbUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface DbCourseProgress {
  id: string;
  user_id: string;
  course_slug: string;
  completed_lesson_ids: string; // JSON string "[]"
  quiz_scores: string; // JSON string "{}"
  last_lesson_id: string | null;
  started_at?: string;
  completed_at?: string | null;
  updated_at: string;
}

export interface DbQuizSubmission {
  id: string;
  user_id: string;
  course_slug: string;
  lesson_id: string;
  score: number;
  answers: string; // JSON string
  created_at: string;
}

export interface DbAdminAuditLog {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_course_id: string;
  target_course_slug: string;
  summary: string;
  created_at: string;
}

export type LearningEventType =
  | "COURSE_STARTED"
  | "LESSON_STARTED"
  | "LESSON_COMPLETED"
  | "QUIZ_SUBMITTED"
  | "COURSE_COMPLETED";

export interface DbLearningEvent {
  id: string;
  user_id: string;
  event_type: LearningEventType;
  course_id: string;
  course_slug: string;
  module_id: string | null;
  lesson_id: string | null;
  score: number | null;
  created_at: string;
  schema_version: 1;
}

export interface DbRecommendationDismissal {
  id: string;
  user_id: string;
  recommendation_id: string;
  evidence_signature: string;
  dismissed_at: string;
}

export interface DatabaseSchema {
  users: DbUser[];
  course_progress: DbCourseProgress[];
  quiz_submissions: DbQuizSubmission[];
  custom_courses?: Record<string, unknown>[];
  admin_audit_logs?: DbAdminAuditLog[];
  learning_events?: DbLearningEvent[];
  recommendation_dismissals?: DbRecommendationDismissal[];
}

export interface DatabaseHealth {
  status: "healthy" | "degraded" | "corrupted" | "empty";
  dbFilePath: string;
  fileSizeBytes: number;
  userCount: number;
  courseProgressCount: number;
  quizSubmissionCount: number;
  backupCount: number;
  lastBackupTime: string | null;
  lastModified: string | null;
}

// ── Directories & File Paths ─────────────────────────────────────
const dataDir = path.join(process.cwd(), "data");
const backupDir = path.join(dataDir, "backups");

function resolveInitialDbPath(): string {
  if (
    (process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_DB_OVERRIDE === "true") &&
    process.env.SC_TEST_DATABASE_PATH
  ) {
    const resolved = path.resolve(process.env.SC_TEST_DATABASE_PATH);
    const resolvedDataDir = path.resolve(dataDir);
    if (
      resolved.startsWith(resolvedDataDir + path.sep) &&
      (path.basename(resolved).includes(".test.") || path.basename(resolved).includes(".e2e."))
    ) {
      return resolved;
    }
  }
  return path.join(dataDir, "academy.json");
}

const defaultDbFilePath = resolveInitialDbPath();
let dbFilePath = defaultDbFilePath;
const sqliteLegacyPath = path.join(dataDir, "academy.db");

/**
 * Test isolation hook: allows test suites to redirect DB operations to an isolated scratch DB inside data/.
 * Strictly blocked in production runtime and never reachable from user requests.
 */
export function setDatabasePathForTest(customPath: string | null): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("[SECURITY] setDatabasePathForTest is strictly forbidden in production runtime.");
  }
  const g = globalThis as unknown as { __SC_TEST_DB_PATH__?: string };
  if (customPath) {
    const resolved = path.resolve(customPath);
    const resolvedDataDir = path.resolve(dataDir);
    if (!resolved.startsWith(resolvedDataDir + path.sep)) {
      throw new Error("[SECURITY] Test database path must reside within the data/ directory.");
    }
    g.__SC_TEST_DB_PATH__ = resolved;
    dbFilePath = resolved;
  } else {
    delete g.__SC_TEST_DB_PATH__;
    dbFilePath = defaultDbFilePath;
  }
  cache = null;
  lastKnownMtimeMs = 0;
  lastKnownSizeBytes = 0;
}

// Ensure directories exist
function ensureDirectories(): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}
ensureDirectories();

// ── In-Memory Cache & State ──────────────────────────────────────
let cache: DatabaseSchema | null = null;
let lastKnownMtimeMs = 0;
let lastKnownSizeBytes = 0;
let writeCounter = 0;
const MAX_BACKUP_FILES = 7;
const BACKUP_INTERVAL_WRITES = 20;

// ── Validation ───────────────────────────────────────────────────
export function isValidDatabaseSchema(data: unknown): data is DatabaseSchema {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.users) &&
    Array.isArray(d.course_progress) &&
    Array.isArray(d.quiz_submissions)
  );
}

// ── Legacy SQLite Migration Helper ───────────────────────────────
function tryMigrateFromLegacySqlite(): DatabaseSchema | null {
  if (!fs.existsSync(sqliteLegacyPath)) return null;
  try {
    // Dynamic import / require of node:sqlite to be safe on environments without it
    const { DatabaseSync } = nodeRequire("node:sqlite");
    const db = new DatabaseSync(sqliteLegacyPath);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const tableNames = new Set(tables.map((t) => t.name));

    const users: DbUser[] = tableNames.has("users")
      ? (db.prepare("SELECT * FROM users").all() as unknown as DbUser[])
      : [];
    const course_progress: DbCourseProgress[] = tableNames.has("course_progress")
      ? (db.prepare("SELECT * FROM course_progress").all() as unknown as DbCourseProgress[])
      : [];
    const quiz_submissions: DbQuizSubmission[] = tableNames.has("quiz_submissions")
      ? (db.prepare("SELECT * FROM quiz_submissions").all() as unknown as DbQuizSubmission[])
      : [];

    const migrated: DatabaseSchema = {
      users,
      course_progress,
      quiz_submissions,
    };

    console.log(
      `[DB INIT] Berhasil membaca ${users.length} pengguna dan ${course_progress.length} progres dari legacy SQLite.`
    );
    return migrated;
  } catch (err) {
    console.warn("[DB INIT] Legacy SQLite migration skipped or unavailable:", err);
    return null;
  }
}

// ── Backup Management ────────────────────────────────────────────
export function createBackup(reason = "auto"): string | null {
  try {
    ensureDirectories();
    if (!fs.existsSync(dbFilePath)) return null;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `academy.backup.${timestamp}.${reason}.json`;
    const backupPath = path.join(backupDir, backupFileName);

    fs.copyFileSync(dbFilePath, backupPath);

    // Rotate old backups: keep latest MAX_BACKUP_FILES
    cleanOldBackups();

    return backupPath;
  } catch (err) {
    console.error("[DB BACKUP ERROR] Failed to create backup:", err);
    return null;
  }
}

function cleanOldBackups(): void {
  try {
    if (!fs.existsSync(backupDir)) return;
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("academy.backup.") && f.endsWith(".json"))
      .map((f) => {
        const full = path.join(backupDir, f);
        return { name: f, full, time: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUP_FILES) {
      const toDelete = files.slice(MAX_BACKUP_FILES);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.full);
        } catch {}
      }
    }
  } catch (err) {
    console.error("[DB BACKUP ROTATION ERROR]:", err);
  }
}

function findLatestValidBackup(): DatabaseSchema | null {
  try {
    if (!fs.existsSync(backupDir)) return null;
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("academy.backup.") && f.endsWith(".json"))
      .map((f) => {
        const full = path.join(backupDir, f);
        return { full, time: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.time - a.time);

    for (const file of files) {
      try {
        const raw = fs.readFileSync(file.full, "utf8");
        const parsed = JSON.parse(raw);
        if (isValidDatabaseSchema(parsed)) {
          return parsed;
        }
      } catch {}
    }
  } catch {}
  return null;
}

// ── Database Loading & Quarantine ────────────────────────────────
function loadDatabase(): DatabaseSchema {
  ensureDirectories();

  // Check if cache can be reused by checking file mtime and size
  if (cache) {
    try {
      if (fs.existsSync(dbFilePath)) {
        const stat = fs.statSync(dbFilePath);
        if (stat.mtimeMs === lastKnownMtimeMs && stat.size === lastKnownSizeBytes) {
          return cache;
        }
      }
    } catch {}
  }

  // Load from disk
  if (fs.existsSync(dbFilePath)) {
    try {
      const raw = fs.readFileSync(dbFilePath, "utf8");
      const parsed = JSON.parse(raw);

      if (isValidDatabaseSchema(parsed)) {
        parsed.custom_courses = Array.isArray(parsed.custom_courses) ? parsed.custom_courses : [];
        cache = parsed;
        const stat = fs.statSync(dbFilePath);
        lastKnownMtimeMs = stat.mtimeMs;
        lastKnownSizeBytes = stat.size;
        return cache;
      }
      throw new Error("Invalid database schema detected.");
    } catch {
      // CRITICAL: File is corrupt or invalid JSON!
      const quarantineName = `academy.corrupt.${Date.now()}.json`;
      const quarantinePath = path.join(dataDir, quarantineName);

      try {
        fs.copyFileSync(dbFilePath, quarantinePath);
        console.error(
          `[CRITICAL DB ERROR] File database 'academy.json' rusak! File telah di-karantina ke '${quarantineName}' untuk mencegah kehilangan data.`
        );
      } catch (copyErr) {
        console.error("[CRITICAL DB ERROR] Gagal mengkarantina file rusak:", copyErr);
      }

      // Attempt recovery from latest backup
      const backupData = findLatestValidBackup();
      if (backupData) {
        console.warn(
          "[DB RECOVERY] Berhasil memulihkan database dari backup snapshot terakhir."
        );
        cache = backupData;
        persistDirect(cache);
        return cache;
      }

      // Attempt recovery from SQLite legacy if available
      const legacyData = tryMigrateFromLegacySqlite();
      if (legacyData) {
        console.warn(
          "[DB RECOVERY] Berhasil memulihkan database dari SQLite lama."
        );
        cache = legacyData;
        persistDirect(cache);
        return cache;
      }

      // DO NOT OVERWRITE WITH EMPTY DATA! Throw fatal error so admin can inspect.
      throw new Error(
        `CRITICAL: Database file 'academy.json' corrupt dan tidak ada backup valid. File telah diamankan di '${quarantineName}'. Sistem menolak menimpa data kosong secara otomatis.`
      );
    }
  }

  // Database file does not exist yet
  // 1. Check if we can seed from legacy SQLite
  const legacyData = tryMigrateFromLegacySqlite();
  if (legacyData) {
    cache = legacyData;
    persistDirect(cache);
    createBackup("migration-from-sqlite");
    return cache;
  }

  // 2. Fresh initialize
  cache = {
    users: [],
    course_progress: [],
    quiz_submissions: [],
  };
  persistDirect(cache);
  createBackup("initial");
  return cache;
}

function atomicRenameWithRetry(src: string, dest: string, maxRetries = 10, delayMs = 15): void {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      fs.renameSync(src, dest);
      return;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (
        (code === "EPERM" || code === "EBUSY" || code === "EACCES") &&
        attempt < maxRetries - 1
      ) {
        const start = Date.now();
        while (Date.now() - start < delayMs) {}
        continue;
      }
      throw err;
    }
  }
}

// ── Robust Atomic Write with Physical Disk Sync & Rollback ───────
function persistDirect(data: DatabaseSchema): void {
  ensureDirectories();
  const tmpPath = path.join(
    dataDir,
    `.academy.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  );

  let fd: number | null = null;
  try {
    const jsonString = JSON.stringify(data, null, 2);

    // Write with fsync to guarantee flush to physical storage
    fd = fs.openSync(tmpPath, "w");
    fs.writeSync(fd, jsonString, 0, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    // Atomic replace with Windows EPERM retry tolerance
    atomicRenameWithRetry(tmpPath, dbFilePath);
    const postStat = fs.statSync(dbFilePath);
    lastKnownMtimeMs = postStat.mtimeMs;
    lastKnownSizeBytes = postStat.size;
  } catch (err) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {}
    throw new Error(`Failed to persist database atomically: ${(err as Error).message}`);
  }
}

// Execute state mutation with rollback safety
function executeMutation<T>(mutator: (db: DatabaseSchema) => T): T {
  const current = loadDatabase();
  // Deep clone to a working copy so cache is never tainted if mutator or write fails
  const workingCopy = structuredClone(current);

  const result = mutator(workingCopy);
  persistDirect(workingCopy);
  cache = workingCopy;

  // Periodic rotating backup
  writeCounter++;
  if (writeCounter % BACKUP_INTERVAL_WRITES === 0) {
    createBackup("interval");
  }

  return result;
}

// ── Public Database Operations ───────────────────────────────────

export function getDatabase(): DatabaseSchema {
  return structuredClone(loadDatabase());
}

// Helper strictly for testing rollback consistency
export function executeTransactionForTest<T>(mutator: (db: DatabaseSchema) => T): T {
  return executeMutation(mutator);
}

export function findUserByEmail(email: string): DbUser | null {
  const db = loadDatabase();
  const normalized = email.toLowerCase().trim();
  const user = db.users.find((u) => u.email.toLowerCase().trim() === normalized);
  return user ? { ...user } : null;
}

export function findUserById(id: string): DbUser | null {
  const db = loadDatabase();
  const user = db.users.find((u) => u.id === id);
  return user ? { ...user } : null;
}

export function createUser(user: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role?: string;
}): DbUser {
  return executeMutation((db) => {
    const normalizedEmail = user.email.toLowerCase().trim();

    // Prevent duplicate emails at write time (concurrency protection)
    const existing = db.users.find(
      (u) => u.email.toLowerCase().trim() === normalizedEmail
    );
    if (existing) {
      throw new Error(`Email "${user.email}" sudah terdaftar.`);
    }

    const now = new Date().toISOString();
    const newUser: DbUser = {
      id: user.id,
      email: normalizedEmail,
      name: user.name.trim(),
      password_hash: user.passwordHash,
      role: user.role || "USER",
      created_at: now,
      updated_at: now,
    };

    db.users.push(newUser);
    return { ...newUser };
  });
}

export function getUserCourseProgress(
  userId: string,
  courseSlug: string
): DbCourseProgress | null {
  const db = loadDatabase();
  const found = db.course_progress.find(
    (p) => p.user_id === userId && p.course_slug === courseSlug
  );
  return found ? { ...found } : null;
}

export function getAllUserProgress(userId: string): DbCourseProgress[] {
  const db = loadDatabase();
  return db.course_progress
    .filter((p) => p.user_id === userId)
    .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
    .map((p) => ({ ...p }));
}

export function upsertUserProgress(data: {
  id: string;
  userId: string;
  courseSlug: string;
  completedLessonIds: string[];
  quizScores: Record<string, number>;
  lastLessonId?: string;
  completedAt?: string | null;
}): void {
  executeMutation((db) => {
    const now = new Date().toISOString();
    const index = db.course_progress.findIndex(
      (p) => p.user_id === data.userId && p.course_slug === data.courseSlug
    );

    const existing = index >= 0 ? db.course_progress[index] : null;
    const entry: DbCourseProgress = {
      id: existing ? existing.id : data.id,
      user_id: data.userId,
      course_slug: data.courseSlug,
      completed_lesson_ids: JSON.stringify(data.completedLessonIds || []),
      quiz_scores: JSON.stringify(data.quizScores || {}),
      last_lesson_id: data.lastLessonId || null,
      ...(existing?.started_at ? { started_at: existing.started_at } : { started_at: now }),
      ...(data.completedAt !== undefined
        ? { completed_at: data.completedAt }
        : existing?.completed_at !== undefined
          ? { completed_at: existing.completed_at }
          : {}),
      updated_at: now,
    };

    if (index >= 0) {
      db.course_progress[index] = entry;
    } else {
      db.course_progress.push(entry);
    }
  });
}

export function recordQuizSubmission(sub: {
  id: string;
  userId: string;
  courseSlug: string;
  lessonId: string;
  score: number;
  answers: Record<string, number>;
}): void {
  executeMutation((db) => {
    const now = new Date().toISOString();
    db.quiz_submissions.push({
      id: sub.id,
      user_id: sub.userId,
      course_slug: sub.courseSlug,
      lesson_id: sub.lessonId,
      score: sub.score,
      answers: JSON.stringify(sub.answers || {}),
      created_at: now,
    });
  });
}

// ── Health & Diagnostics ─────────────────────────────────────────

export function getDatabaseHealth(): DatabaseHealth {
  let fileSizeBytes = 0;
  let lastModified: string | null = null;
  let status: DatabaseHealth["status"] = "healthy";

  if (fs.existsSync(dbFilePath)) {
    try {
      const stat = fs.statSync(dbFilePath);
      fileSizeBytes = stat.size;
      lastModified = stat.mtime.toISOString();
    } catch {
      status = "degraded";
    }
  } else {
    status = "empty";
  }

  let backupCount = 0;
  let lastBackupTime: string | null = null;
  if (fs.existsSync(backupDir)) {
    try {
      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith("academy.backup.") && f.endsWith(".json"))
        .map((f) => fs.statSync(path.join(backupDir, f)).mtime)
        .sort((a, b) => b.getTime() - a.getTime());

      backupCount = files.length;
      if (files.length > 0) {
        lastBackupTime = files[0].toISOString();
      }
    } catch {}
  }

  const db = loadDatabase();
  return {
    status,
    dbFilePath,
    fileSizeBytes,
    userCount: db.users.length,
    courseProgressCount: db.course_progress.length,
    quizSubmissionCount: db.quiz_submissions.length,
    backupCount,
    lastBackupTime,
    lastModified,
  };
}

export function restoreDatabaseFromBackup(backupFileName?: string): boolean {
  try {
    ensureDirectories();
    let targetBackup = "";
    if (backupFileName) {
      targetBackup = path.join(backupDir, backupFileName);
    } else {
      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith("academy.backup.") && f.endsWith(".json"))
        .map((f) => {
          const full = path.join(backupDir, f);
          return { full, time: fs.statSync(full).mtimeMs };
        })
        .sort((a, b) => b.time - a.time);

      if (files.length === 0) return false;
      targetBackup = files[0].full;
    }

    if (!fs.existsSync(targetBackup)) return false;

    const raw = fs.readFileSync(targetBackup, "utf8");
    const parsed = JSON.parse(raw);
    if (!isValidDatabaseSchema(parsed)) return false;

    // Backup current before replacing
    if (fs.existsSync(dbFilePath)) {
      createBackup("pre-manual-restore");
    }

    cache = parsed;
    persistDirect(cache);
    return true;
  } catch (err) {
    console.error("[DB RESTORE ERROR]:", err);
    return false;
  }
}

// ── Admin Course & User Management ───────────────────────────────

export const STATIC_ID_TO_SLUG = new Map<string, string>([
  ["c1", "trading-fundamentals"],
  ["c2", "candlestick-price-action"],
  ["c3", "market-structure"],
  ["c4", "support-and-resistance"],
  ["c5", "technical-analysis-framework"],
  ["c6", "xauusd-market-analysis"],
  ["c7", "risk-management"],
  ["c8", "trading-psychology"],
  ["c9", "trading-journal-evaluation"],
]);

export const STATIC_SLUG_TO_ID = new Map<string, string>(
  Array.from(STATIC_ID_TO_SLUG.entries()).map(([id, slug]) => [slug, id])
);

const STATIC_COURSE_SLUGS = new Set(STATIC_ID_TO_SLUG.values());

export function isStaticCourseIdOrSlug(idOrSlug: string): boolean {
  const norm = String(idOrSlug || "").toLowerCase().trim();
  return STATIC_ID_TO_SLUG.has(norm) || STATIC_COURSE_SLUGS.has(norm);
}

export function getCustomCourses(): Record<string, unknown>[] {
  const db = loadDatabase();
  return Array.isArray(db.custom_courses) ? structuredClone(db.custom_courses) : [];
}

export interface UpsertCourseOptions {
  allowStaticOverride?: boolean;
  migrateSlugFrom?: string;
  audit?: {
    adminId: string;
    adminEmail: string;
    action: string;
    summary: string;
  };
}

export function upsertCustomCourse(
  course: Record<string, unknown>,
  options?: UpsertCourseOptions
): void {
  executeMutation((db) => {
    if (!Array.isArray(db.custom_courses)) {
      db.custom_courses = [];
    }
    const courseId = String(course?.id || "").trim();
    const normalizedSlug = String(course?.slug || "")
      .toLowerCase()
      .trim();
    if (!normalizedSlug) {
      throw new Error("Slug kelas wajib diisi.");
    }

    // 1. Check if courseId belongs to a canonical static course (c1..c9)
    if (STATIC_ID_TO_SLUG.has(courseId)) {
      const requiredStaticSlug = STATIC_ID_TO_SLUG.get(courseId)!;
      if (normalizedSlug !== requiredStaticSlug) {
        throw new Error(
          `Slug kelas kurikulum inti ("${courseId}") bersifat permanen ("${requiredStaticSlug}") dan tidak dapat diubah.`
        );
      }
      if (
        !options?.allowStaticOverride &&
        !course?.isStaticBaseline &&
        !course?.isOverridden
      ) {
        throw new Error(
          `Konflik slug: "${normalizedSlug}" sudah digunakan oleh kelas statis utama.`
        );
      }
    } else if (STATIC_COURSE_SLUGS.has(normalizedSlug)) {
      // Non-static course ID trying to use a static course slug -> reject!
      throw new Error(
        `Konflik slug: "${normalizedSlug}" sudah digunakan oleh kelas statis utama.`
      );
    }

    // 2. Check conflict with other custom courses
    const conflictingCustom = db.custom_courses.find(
      (c: Record<string, unknown>) =>
        String(c?.slug || "").toLowerCase().trim() === normalizedSlug &&
        String(c?.id || "") !== courseId
    );
    if (conflictingCustom) {
      throw new Error(
        `Konflik slug: "${normalizedSlug}" sudah digunakan oleh kelas kustom lain.`
      );
    }

    // 3. Check if existing custom course is changing its slug while students have progress
    const existingIdx = db.custom_courses.findIndex(
      (c: Record<string, unknown>) => String(c?.id || "") === courseId
    );
    if (existingIdx >= 0) {
      const previousSlug = String(db.custom_courses[existingIdx]?.slug || "")
        .toLowerCase()
        .trim();
      if (previousSlug && previousSlug !== normalizedSlug) {
        const hasProgress = db.course_progress.some(
          (p) => p.course_slug.toLowerCase() === previousSlug
        );
        const hasQuiz = db.quiz_submissions.some(
          (s) => s.course_slug.toLowerCase() === previousSlug
        );
        if ((hasProgress || hasQuiz) && options?.migrateSlugFrom !== previousSlug) {
          throw new Error(
            `Slug kelas "${previousSlug}" tidak dapat diubah tanpa migrasi karena sudah memiliki data progres siswa.`
          );
        }
        if (options?.migrateSlugFrom === previousSlug) {
          for (const p of db.course_progress) {
            if (p.course_slug.toLowerCase() === previousSlug) {
              p.course_slug = normalizedSlug;
            }
          }
          for (const s of db.quiz_submissions) {
            if (s.course_slug.toLowerCase() === previousSlug) {
              s.course_slug = normalizedSlug;
            }
          }
        }
      }
    }

    const isStatic = STATIC_ID_TO_SLUG.has(courseId);
    const normalizedCourse: Record<string, unknown> = {
      ...course,
      id: courseId || String(course?.id || ""),
      slug: normalizedSlug,
      ...(isStatic ? { isStaticBaseline: true, isOverridden: true } : {}),
    };

    if (existingIdx >= 0) {
      db.custom_courses[existingIdx] = normalizedCourse;
    } else {
      db.custom_courses.push(normalizedCourse);
    }

    if (options?.audit) {
      if (!Array.isArray(db.admin_audit_logs)) {
        db.admin_audit_logs = [];
      }
      db.admin_audit_logs.push({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        admin_id: options.audit.adminId,
        admin_email: options.audit.adminEmail,
        action: options.audit.action,
        target_course_id: String(normalizedCourse.id || ""),
        target_course_slug: normalizedSlug,
        summary: options.audit.summary,
        created_at: new Date().toISOString(),
      });
      if (db.admin_audit_logs.length > 200) {
        db.admin_audit_logs = db.admin_audit_logs.slice(-200);
      }
    }
  });
}

export function resetStaticCourseOverride(
  courseIdOrSlug: string,
  audit?: { adminId: string; adminEmail: string }
): boolean {
  const norm = String(courseIdOrSlug || "").toLowerCase().trim();
  const targetId = STATIC_ID_TO_SLUG.has(norm)
    ? norm
    : STATIC_SLUG_TO_ID.get(norm);
  const targetSlug = targetId ? STATIC_ID_TO_SLUG.get(targetId) : undefined;
  if (!targetId || !targetSlug) {
    throw new Error(`"${courseIdOrSlug}" bukan kelas kurikulum inti (c1-c9).`);
  }

  return executeMutation((db) => {
    if (!Array.isArray(db.custom_courses)) return false;
    const beforeLen = db.custom_courses.length;
    db.custom_courses = db.custom_courses.filter(
      (c: Record<string, unknown>) =>
        String(c?.id || "").toLowerCase() !== targetId &&
        String(c?.slug || "").toLowerCase() !== targetSlug
    );
    const removed = db.custom_courses.length < beforeLen;
    if (removed && audit) {
      if (!Array.isArray(db.admin_audit_logs)) {
        db.admin_audit_logs = [];
      }
      db.admin_audit_logs.push({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        admin_id: audit.adminId,
        admin_email: audit.adminEmail,
        action: "COURSE_RESET_BASELINE",
        target_course_id: targetId,
        target_course_slug: targetSlug,
        summary: `Reset kelas "${targetSlug}" (${targetId}) ke kurikulum bawaan pabrik.`,
        created_at: new Date().toISOString(),
      });
      if (db.admin_audit_logs.length > 200) {
        db.admin_audit_logs = db.admin_audit_logs.slice(-200);
      }
    }
    return removed;
  });
}

export function getCourseProgressImpact(
  courseSlug: string,
  lessonIds?: string[]
): {
  enrolledUsersCount: number;
  quizSubmissionsCount: number;
  affectedLessonUsersCount: number;
  affectedLessonIds: string[];
} {
  const db = loadDatabase();
  const normSlug = String(courseSlug || "").toLowerCase().trim();
  const courseProgressRows = db.course_progress.filter(
    (p) => p.course_slug.toLowerCase().trim() === normSlug
  );
  const quizRows = db.quiz_submissions.filter(
    (s) => s.course_slug.toLowerCase().trim() === normSlug
  );

  const targetSet = new Set((lessonIds || []).map((id) => String(id).trim()));
  const affectedLessonIdsSet = new Set<string>();
  let affectedLessonUsersCount = 0;

  if (targetSet.size > 0) {
    for (const row of courseProgressRows) {
      try {
        const completed: unknown[] = JSON.parse(row.completed_lesson_ids || "[]");
        const scores: Record<string, unknown> = JSON.parse(row.quiz_scores || "{}");
        let userAffected = false;
        if (Array.isArray(completed)) {
          for (const lid of completed) {
            const sLid = String(lid);
            if (targetSet.has(sLid)) {
              affectedLessonIdsSet.add(sLid);
              userAffected = true;
            }
          }
        }
        if (scores && typeof scores === "object") {
          for (const lid of Object.keys(scores)) {
            if (targetSet.has(lid)) {
              affectedLessonIdsSet.add(lid);
              userAffected = true;
            }
          }
        }
        if (userAffected) affectedLessonUsersCount++;
      } catch {
        // ignore malformed json
      }
    }
  }

  return {
    enrolledUsersCount: courseProgressRows.length,
    quizSubmissionsCount: quizRows.length,
    affectedLessonUsersCount,
    affectedLessonIds: Array.from(affectedLessonIdsSet),
  };
}

export function deleteCustomCourse(
  courseId: string,
  options?: {
    protectActiveProgress?: boolean;
    force?: boolean;
    audit?: { adminId: string; adminEmail: string };
  }
): void {
  const norm = String(courseId || "").toLowerCase().trim();
  if (STATIC_ID_TO_SLUG.has(norm) || STATIC_COURSE_SLUGS.has(norm)) {
    throw new Error(
      "Kelas kurikulum inti (C1-C9) tidak dapat dihapus permanen. Gunakan fitur Archive, Draft, atau Reset ke Default."
    );
  }

  executeMutation((db) => {
    if (!Array.isArray(db.custom_courses)) return;
    const target = db.custom_courses.find(
      (c: Record<string, unknown>) =>
        String(c?.id || "") === courseId || String(c?.slug || "") === courseId
    );
    if (!target) return;

    const targetSlug = String(target.slug || "").toLowerCase().trim();
    if (options?.protectActiveProgress && !options?.force) {
      const hasProgress = db.course_progress.some(
        (p) => p.course_slug.toLowerCase().trim() === targetSlug
      );
      if (hasProgress) {
        throw new Error(
          `Kelas "${targetSlug}" memiliki data progres siswa aktif. Arsipkan kelas atau konfirmasi penghapusan paksa (force).`
        );
      }
    }

    db.custom_courses = db.custom_courses.filter(
      (c: Record<string, unknown>) =>
        String(c?.id || "") !== courseId && String(c?.slug || "") !== courseId
    );

    if (options?.audit) {
      if (!Array.isArray(db.admin_audit_logs)) {
        db.admin_audit_logs = [];
      }
      db.admin_audit_logs.push({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        admin_id: options.audit.adminId,
        admin_email: options.audit.adminEmail,
        action: "COURSE_DELETE",
        target_course_id: String(target.id || courseId),
        target_course_slug: targetSlug,
        summary: `Menghapus kelas kustom "${String(target.title || targetSlug)}".`,
        created_at: new Date().toISOString(),
      });
      if (db.admin_audit_logs.length > 200) {
        db.admin_audit_logs = db.admin_audit_logs.slice(-200);
      }
    }
  });
}

export function getAdminAuditLogs(limit = 50): DbAdminAuditLog[] {
  const db = loadDatabase();
  if (!Array.isArray(db.admin_audit_logs)) return [];
  return structuredClone(db.admin_audit_logs.slice(-limit).reverse());
}

export function getAllUsersForAdmin(): Array<{
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}> {
  const db = loadDatabase();
  return db.users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    created_at: u.created_at,
    updated_at: u.updated_at,
  }));
}

export function getAllQuizSubmissionsForAdmin(): DbQuizSubmission[] {
  const db = loadDatabase();
  return structuredClone(db.quiz_submissions);
}

export function getQuizSubmissionsForUser(userId: string): DbQuizSubmission[] {
  const db = loadDatabase();
  return db.quiz_submissions
    .filter((s) => s.user_id === userId)
    .map((s) => structuredClone(s));
}

export function makeUserAdmin(email: string): boolean {
  return executeMutation((db) => {
    const normalized = email.toLowerCase().trim();
    const user = db.users.find((u) => u.email.toLowerCase().trim() === normalized);
    if (user) {
      user.role = "ADMIN";
      user.updated_at = new Date().toISOString();
      return true;
    }
    return false;
  });
}

export function updateUserRole(
  userId: string,
  newRole: string,
  auditAdmin?: { adminId: string; adminEmail: string }
): boolean {
  return executeMutation((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error("Pengguna tidak ditemukan.");
    }
    const targetEmail = user.email.toLowerCase().trim();
    if (targetEmail === "apriyanriyan23@gmail.com" && newRole !== "ADMIN") {
      throw new Error("Akun Master Admin utama tidak dapat diturunkan statusnya.");
    }
    const prevRole = user.role;
    user.role = newRole;
    user.updated_at = new Date().toISOString();

    if (auditAdmin) {
      if (!Array.isArray(db.admin_audit_logs)) {
        db.admin_audit_logs = [];
      }
      db.admin_audit_logs.push({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        admin_id: auditAdmin.adminId,
        admin_email: auditAdmin.adminEmail,
        action: "USER_ROLE_CHANGE",
        target_course_id: user.id,
        target_course_slug: user.email,
        summary: `Mengubah peran ${user.name} (${user.email}) dari "${prevRole}" menjadi "${newRole}".`,
        created_at: new Date().toISOString(),
      });
      if (db.admin_audit_logs.length > 200) {
        db.admin_audit_logs = db.admin_audit_logs.slice(-200);
      }
    }
    return true;
  });
}

export function deleteUserById(
  userId: string,
  auditAdmin?: { adminId: string; adminEmail: string }
): boolean {
  return executeMutation((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error("Pengguna tidak ditemukan.");
    }
    const targetEmail = user.email.toLowerCase().trim();
    if (targetEmail === "apriyanriyan23@gmail.com") {
      throw new Error("Akun Master Admin utama dilarang keras dihapus.");
    }

    db.users = db.users.filter((u) => u.id !== userId);
    db.course_progress = db.course_progress.filter((p) => p.user_id !== userId);
    db.quiz_submissions = db.quiz_submissions.filter((s) => s.user_id !== userId);
    if (Array.isArray(db.learning_events)) {
      db.learning_events = db.learning_events.filter((e) => e.user_id !== userId);
    }
    if (Array.isArray(db.recommendation_dismissals)) {
      db.recommendation_dismissals = db.recommendation_dismissals.filter(
        (d) => d.user_id !== userId
      );
    }

    if (auditAdmin) {
      if (!Array.isArray(db.admin_audit_logs)) {
        db.admin_audit_logs = [];
      }
      db.admin_audit_logs.push({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        admin_id: auditAdmin.adminId,
        admin_email: auditAdmin.adminEmail,
        action: "USER_DELETE",
        target_course_id: userId,
        target_course_slug: targetEmail,
        summary: `Menghapus akun pengguna ${user.name} (${user.email}) beserta data progresnya.`,
        created_at: new Date().toISOString(),
      });
      if (db.admin_audit_logs.length > 200) {
        db.admin_audit_logs = db.admin_audit_logs.slice(-200);
      }
    }
    return true;
  });
}

// ── Sprint 4: Learning Events & Recommendation Dismissals ────────

const MAX_LEARNING_EVENTS = 10000;
const VALID_LEARNING_EVENT_TYPES = new Set<LearningEventType>([
  "COURSE_STARTED",
  "LESSON_STARTED",
  "LESSON_COMPLETED",
  "QUIZ_SUBMITTED",
  "COURSE_COMPLETED",
]);

export function recordLearningEvent(input: {
  userId: string;
  eventType: LearningEventType;
  courseId: string;
  courseSlug: string;
  moduleId?: string | null;
  lessonId?: string | null;
  score?: number | null;
  createdAt?: string;
}): DbLearningEvent | null {
  const userId = String(input.userId || "").trim();
  const courseId = String(input.courseId || "").trim();
  const courseSlug = String(input.courseSlug || "").toLowerCase().trim();
  const eventType = input.eventType;
  if (!userId || !courseId || !courseSlug || !VALID_LEARNING_EVENT_TYPES.has(eventType)) {
    return null;
  }

  return executeMutation((db) => {
    if (!Array.isArray(db.learning_events)) {
      db.learning_events = [];
    }

    const nowIso =
      input.createdAt && !Number.isNaN(Date.parse(input.createdAt))
        ? new Date(input.createdAt).toISOString()
        : new Date().toISOString();
    const nowMs = Date.parse(nowIso);
    const utcDay = nowIso.slice(0, 10);
    const lessonId = input.lessonId ? String(input.lessonId).trim() : null;
    const moduleId = input.moduleId ? String(input.moduleId).trim() : null;
    const score =
      typeof input.score === "number" && Number.isFinite(input.score)
        ? Math.max(0, Math.min(100, Math.round(input.score)))
        : null;

    // Idempotency & duplicate protection rules
    if (eventType === "COURSE_STARTED" || eventType === "COURSE_COMPLETED") {
      const existing = db.learning_events.find(
        (e) =>
          e.user_id === userId &&
          e.course_slug === courseSlug &&
          e.event_type === eventType
      );
      if (existing) return { ...existing };
    } else if (eventType === "LESSON_STARTED") {
      const existingSameDay = db.learning_events.find(
        (e) =>
          e.user_id === userId &&
          e.course_slug === courseSlug &&
          e.lesson_id === lessonId &&
          e.event_type === "LESSON_STARTED" &&
          typeof e.created_at === "string" &&
          e.created_at.slice(0, 10) === utcDay
      );
      if (existingSameDay) return { ...existingSameDay };
    } else if (eventType === "LESSON_COMPLETED") {
      const existingRecent = db.learning_events.find(
        (e) =>
          e.user_id === userId &&
          e.course_slug === courseSlug &&
          e.lesson_id === lessonId &&
          e.event_type === "LESSON_COMPLETED" &&
          Math.abs(nowMs - Date.parse(e.created_at)) < 60_000
      );
      if (existingRecent) return { ...existingRecent };
    } else if (eventType === "QUIZ_SUBMITTED") {
      const existingRecentQuiz = db.learning_events.find(
        (e) =>
          e.user_id === userId &&
          e.course_slug === courseSlug &&
          e.lesson_id === lessonId &&
          e.event_type === "QUIZ_SUBMITTED" &&
          e.score === score &&
          Math.abs(nowMs - Date.parse(e.created_at)) < 2_000
      );
      if (existingRecentQuiz) return { ...existingRecentQuiz };
    }

    const entry: DbLearningEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user_id: userId,
      event_type: eventType,
      course_id: courseId,
      course_slug: courseSlug,
      module_id: moduleId,
      lesson_id: lessonId,
      score,
      created_at: nowIso,
      schema_version: 1,
    };

    db.learning_events.push(entry);
    if (db.learning_events.length > MAX_LEARNING_EVENTS) {
      db.learning_events = db.learning_events.slice(-MAX_LEARNING_EVENTS);
    }

    return { ...entry };
  });
}

export function getLearningEventsForUser(userId: string): DbLearningEvent[] {
  const db = loadDatabase();
  if (!Array.isArray(db.learning_events)) return [];
  return db.learning_events
    .filter((e) => e.user_id === userId)
    .map((e) => ({ ...e }));
}

export function getAllLearningEventsForAdmin(): DbLearningEvent[] {
  const db = loadDatabase();
  if (!Array.isArray(db.learning_events)) return [];
  return structuredClone(db.learning_events);
}

export function getAllCourseProgressForAdmin(): DbCourseProgress[] {
  const db = loadDatabase();
  return structuredClone(db.course_progress);
}

export function getRecommendationDismissalsForUser(
  userId: string
): DbRecommendationDismissal[] {
  const db = loadDatabase();
  if (!Array.isArray(db.recommendation_dismissals)) return [];
  return db.recommendation_dismissals
    .filter((d) => d.user_id === userId)
    .map((d) => ({ ...d }));
}

export function dismissRecommendationForUser(input: {
  userId: string;
  recommendationId: string;
  evidenceSignature: string;
}): DbRecommendationDismissal {
  const userId = String(input.userId || "").trim();
  const recommendationId = String(input.recommendationId || "").trim();
  const evidenceSignature = String(input.evidenceSignature || "").trim();
  if (!userId || !recommendationId) {
    throw new Error("userId dan recommendationId wajib diisi.");
  }

  return executeMutation((db) => {
    if (!Array.isArray(db.recommendation_dismissals)) {
      db.recommendation_dismissals = [];
    }
    const now = new Date().toISOString();
    const existingIdx = db.recommendation_dismissals.findIndex(
      (d) => d.user_id === userId && d.recommendation_id === recommendationId
    );
    const entry: DbRecommendationDismissal = {
      id:
        existingIdx >= 0
          ? db.recommendation_dismissals[existingIdx].id
          : `rd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      recommendation_id: recommendationId,
      evidence_signature: evidenceSignature,
      dismissed_at: now,
    };
    if (existingIdx >= 0) {
      db.recommendation_dismissals[existingIdx] = entry;
    } else {
      db.recommendation_dismissals.push(entry);
    }
    return { ...entry };
  });
}

export function restoreRecommendationForUser(
  userId: string,
  recommendationId?: string
): number {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) return 0;
  return executeMutation((db) => {
    if (!Array.isArray(db.recommendation_dismissals)) return 0;
    const before = db.recommendation_dismissals.length;
    db.recommendation_dismissals = db.recommendation_dismissals.filter((d) => {
      if (d.user_id !== safeUserId) return true;
      if (recommendationId && d.recommendation_id !== recommendationId) return true;
      return false;
    });
    return before - db.recommendation_dismissals.length;
  });
}

