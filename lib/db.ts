import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Ensure data folder exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "academy.db");

// Singleton connection
let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync): void {
  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'USER',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Course progress table (per user per course)
  db.exec(`
    CREATE TABLE IF NOT EXISTS course_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      course_slug TEXT NOT NULL,
      completed_lesson_ids TEXT DEFAULT '[]',
      quiz_scores TEXT DEFAULT '{}',
      last_lesson_id TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, course_slug),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. Quiz submissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      course_slug TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      answers TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

// ── Database Operations ──────────────────────────────────────────

export interface DbUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export function findUserByEmail(email: string): DbUser | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
  const result = stmt.get(email.toLowerCase().trim()) as DbUser | undefined;
  return result || null;
}

export function findUserById(id: string): DbUser | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
  const result = stmt.get(id) as DbUser | undefined;
  return result || null;
}

export function createUser(user: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role?: string;
}): DbUser {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    user.id,
    user.email.toLowerCase().trim(),
    user.name.trim(),
    user.passwordHash,
    user.role || "USER",
    now,
    now
  );
  return {
    id: user.id,
    email: user.email.toLowerCase().trim(),
    name: user.name.trim(),
    password_hash: user.passwordHash,
    role: user.role || "USER",
    created_at: now,
    updated_at: now,
  };
}

export interface DbCourseProgress {
  id: string;
  user_id: string;
  course_slug: string;
  completed_lesson_ids: string;
  quiz_scores: string;
  last_lesson_id: string | null;
  updated_at: string;
}

export function getUserCourseProgress(userId: string, courseSlug: string): DbCourseProgress | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM course_progress WHERE user_id = ? AND course_slug = ? LIMIT 1
  `);
  const row = stmt.get(userId, courseSlug) as DbCourseProgress | undefined;
  return row || null;
}

export function getAllUserProgress(userId: string): DbCourseProgress[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM course_progress WHERE user_id = ? ORDER BY updated_at DESC
  `);
  return stmt.all(userId) as unknown as DbCourseProgress[];
}

export function upsertUserProgress(data: {
  id: string;
  userId: string;
  courseSlug: string;
  completedLessonIds: string[];
  quizScores: Record<string, number>;
  lastLessonId?: string;
}): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO course_progress (id, user_id, course_slug, completed_lesson_ids, quiz_scores, last_lesson_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, course_slug) DO UPDATE SET
      completed_lesson_ids = excluded.completed_lesson_ids,
      quiz_scores = excluded.quiz_scores,
      last_lesson_id = excluded.last_lesson_id,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    data.id,
    data.userId,
    data.courseSlug,
    JSON.stringify(data.completedLessonIds),
    JSON.stringify(data.quizScores),
    data.lastLessonId || null,
    now
  );
}

export function recordQuizSubmission(sub: {
  id: string;
  userId: string;
  courseSlug: string;
  lessonId: string;
  score: number;
  answers: Record<string, number>;
}): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO quiz_submissions (id, user_id, course_slug, lesson_id, score, answers, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    sub.id,
    sub.userId,
    sub.courseSlug,
    sub.lessonId,
    sub.score,
    JSON.stringify(sub.answers),
    now
  );
}
