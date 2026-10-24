import { UserCourseProgress } from "./types";

const STORAGE_KEY = "sc_academy_progress";

export function getStoredProgress(): Record<string, UserCourseProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Failed to parse progress from storage", e);
    return {};
  }
}

export function saveStoredProgress(data: Record<string, UserCourseProgress>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save progress to storage", e);
  }
}

// Background sync to server database
export async function syncProgressToServer(
  courseSlug: string,
  progress: UserCourseProgress,
  quizSubmission?: { lessonId: string; score: number; answers: Record<string, number> }
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug,
        completedLessonIds: progress.completedLessonIds,
        quizScores: progress.quizScores,
        lastLessonId: progress.lastAccessedLessonId,
        quizSubmission,
      }),
    });
  } catch (err) {
    // Graceful offline fallback
    console.warn("Could not sync to server database (running offline/unauthenticated)", err);
  }
}

// Fetch server database progress and merge into local
export async function fetchServerProgress(): Promise<Record<string, UserCourseProgress> | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/progress");
    if (!res.ok) return null;
    const data = await res.json();
    if (data.progressMap) {
      const local = getStoredProgress();
      const merged = { ...local, ...data.progressMap };
      saveStoredProgress(merged);
      return merged;
    }
  } catch (e) {
    // Ignore if not logged in
  }
  return null;
}

export function getCourseProgress(courseSlug: string): UserCourseProgress {
  const all = getStoredProgress();
  if (all[courseSlug]) {
    return all[courseSlug];
  }
  return {
    courseSlug,
    completedLessonIds: [],
    quizScores: {},
    enrolledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function enrollCourse(courseSlug: string, firstLessonId?: string): UserCourseProgress {
  const all = getStoredProgress();
  if (!all[courseSlug]) {
    all[courseSlug] = {
      courseSlug,
      completedLessonIds: [],
      quizScores: {},
      lastAccessedLessonId: firstLessonId,
      enrolledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveStoredProgress(all);
    syncProgressToServer(courseSlug, all[courseSlug]);
  }
  return all[courseSlug];
}

export function toggleLessonComplete(courseSlug: string, lessonId: string): boolean {
  const all = getStoredProgress();
  const current = all[courseSlug] || {
    courseSlug,
    completedLessonIds: [],
    quizScores: {},
    enrolledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const isCompleted = current.completedLessonIds.includes(lessonId);
  if (isCompleted) {
    current.completedLessonIds = current.completedLessonIds.filter((id) => id !== lessonId);
  } else {
    current.completedLessonIds.push(lessonId);
  }

  current.lastAccessedLessonId = lessonId;
  current.updatedAt = new Date().toISOString();
  all[courseSlug] = current;
  saveStoredProgress(all);

  // Sync with server DB
  syncProgressToServer(courseSlug, current);

  return !isCompleted;
}

export function saveQuizScore(
  courseSlug: string,
  lessonId: string,
  score: number,
  answers?: Record<string, number>
): void {
  const all = getStoredProgress();
  const current = all[courseSlug] || {
    courseSlug,
    completedLessonIds: [],
    quizScores: {},
    enrolledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  current.quizScores[lessonId] = score;
  if (!current.completedLessonIds.includes(lessonId)) {
    current.completedLessonIds.push(lessonId);
  }
  current.updatedAt = new Date().toISOString();
  all[courseSlug] = current;
  saveStoredProgress(all);

  // Sync with server DB including full submission
  syncProgressToServer(courseSlug, current, {
    lessonId,
    score,
    answers: answers || {},
  });
}

export function calculateCoursePercentage(totalLessons: number, completedCount: number): number {
  if (totalLessons === 0) return 0;
  const pct = Math.round((completedCount / totalLessons) * 100);
  return Math.min(100, Math.max(0, pct));
}
