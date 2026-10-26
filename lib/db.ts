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

export interface DatabaseSchema {
  users: DbUser[];
  course_progress: DbCourseProgress[];
  quiz_submissions: DbQuizSubmission[];
  custom_courses?: any[];
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
const dbFilePath = path.join(dataDir, "academy.json");
const sqliteLegacyPath = path.join(dataDir, "academy.db");

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

  // Check if cache can be reused by checking file mtime
  if (cache) {
    try {
      if (fs.existsSync(dbFilePath)) {
        const currentMtime = fs.statSync(dbFilePath).mtimeMs;
        if (currentMtime === lastKnownMtimeMs) {
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
        lastKnownMtimeMs = fs.statSync(dbFilePath).mtimeMs;
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

    // Atomic replace
    fs.renameSync(tmpPath, dbFilePath);
    lastKnownMtimeMs = fs.statSync(dbFilePath).mtimeMs;
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
}): void {
  executeMutation((db) => {
    const now = new Date().toISOString();
    const index = db.course_progress.findIndex(
      (p) => p.user_id === data.userId && p.course_slug === data.courseSlug
    );

    const entry: DbCourseProgress = {
      id: index >= 0 ? db.course_progress[index].id : data.id,
      user_id: data.userId,
      course_slug: data.courseSlug,
      completed_lesson_ids: JSON.stringify(data.completedLessonIds || []),
      quiz_scores: JSON.stringify(data.quizScores || {}),
      last_lesson_id: data.lastLessonId || null,
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

export function getCustomCourses(): any[] {
  const db = loadDatabase();
  return Array.isArray(db.custom_courses) ? structuredClone(db.custom_courses) : [];
}

export function upsertCustomCourse(course: any): void {
  executeMutation((db) => {
    if (!Array.isArray(db.custom_courses)) {
      db.custom_courses = [];
    }
    const idx = db.custom_courses.findIndex((c: any) => c.id === course.id || c.slug === course.slug);
    if (idx >= 0) {
      db.custom_courses[idx] = course;
    } else {
      db.custom_courses.push(course);
    }
  });
}

export function deleteCustomCourse(courseId: string): void {
  executeMutation((db) => {
    if (Array.isArray(db.custom_courses)) {
      db.custom_courses = db.custom_courses.filter((c: any) => c.id !== courseId && c.slug !== courseId);
    }
  });
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

