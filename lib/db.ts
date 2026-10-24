import fs from "node:fs";
import path from "node:path";

// Ensure data folder exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFilePath = path.join(dataDir, "academy.json");

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

interface DatabaseSchema {
  users: DbUser[];
  course_progress: DbCourseProgress[];
  quiz_submissions: DbQuizSubmission[];
}

// In-memory cache + file sync
let cache: DatabaseSchema | null = null;

function loadDatabase(): DatabaseSchema {
  if (cache) return cache;
  try {
    if (fs.existsSync(dbFilePath)) {
      const raw = fs.readFileSync(dbFilePath, "utf8");
      cache = JSON.parse(raw);
    }
  } catch (err) {
    console.error("Failed to read database file, initializing empty:", err);
  }

  if (!cache || typeof cache !== "object" || !Array.isArray(cache.users)) {
    cache = {
      users: [],
      course_progress: [],
      quiz_submissions: [],
    };
    saveDatabase(cache);
  }
  return cache;
}

function saveDatabase(data: DatabaseSchema): void {
  cache = data;
  try {
    const tmpPath = `${dbFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmpPath, dbFilePath);
  } catch (err) {
    console.error("Failed to persist database file:", err);
  }
}

export function getDatabase() {
  return loadDatabase();
}

// ── Database Operations ──────────────────────────────────────────

export function findUserByEmail(email: string): DbUser | null {
  const db = loadDatabase();
  const normalized = email.toLowerCase().trim();
  const user = db.users.find((u) => u.email.toLowerCase().trim() === normalized);
  return user || null;
}

export function findUserById(id: string): DbUser | null {
  const db = loadDatabase();
  const user = db.users.find((u) => u.id === id);
  return user || null;
}

export function createUser(user: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role?: string;
}): DbUser {
  const db = loadDatabase();
  const now = new Date().toISOString();
  const newUser: DbUser = {
    id: user.id,
    email: user.email.toLowerCase().trim(),
    name: user.name.trim(),
    password_hash: user.passwordHash,
    role: user.role || "USER",
    created_at: now,
    updated_at: now,
  };
  db.users.push(newUser);
  saveDatabase(db);
  return newUser;
}

export function getUserCourseProgress(userId: string, courseSlug: string): DbCourseProgress | null {
  const db = loadDatabase();
  const found = db.course_progress.find(
    (p) => p.user_id === userId && p.course_slug === courseSlug
  );
  return found || null;
}

export function getAllUserProgress(userId: string): DbCourseProgress[] {
  const db = loadDatabase();
  return db.course_progress
    .filter((p) => p.user_id === userId)
    .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1));
}

export function upsertUserProgress(data: {
  id: string;
  userId: string;
  courseSlug: string;
  completedLessonIds: string[];
  quizScores: Record<string, number>;
  lastLessonId?: string;
}): void {
  const db = loadDatabase();
  const now = new Date().toISOString();
  const index = db.course_progress.findIndex(
    (p) => p.user_id === data.userId && p.course_slug === data.courseSlug
  );

  const entry: DbCourseProgress = {
    id: index >= 0 ? db.course_progress[index].id : data.id,
    user_id: data.userId,
    course_slug: data.courseSlug,
    completed_lesson_ids: JSON.stringify(data.completedLessonIds),
    quiz_scores: JSON.stringify(data.quizScores),
    last_lesson_id: data.lastLessonId || null,
    updated_at: now,
  };

  if (index >= 0) {
    db.course_progress[index] = entry;
  } else {
    db.course_progress.push(entry);
  }
  saveDatabase(db);
}

export function recordQuizSubmission(sub: {
  id: string;
  userId: string;
  courseSlug: string;
  lessonId: string;
  score: number;
  answers: Record<string, number>;
}): void {
  const db = loadDatabase();
  const now = new Date().toISOString();
  db.quiz_submissions.push({
    id: sub.id,
    user_id: sub.userId,
    course_slug: sub.courseSlug,
    lesson_id: sub.lessonId,
    score: sub.score,
    answers: JSON.stringify(sub.answers),
    created_at: now,
  });
  saveDatabase(db);
}
