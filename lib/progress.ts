import type { Course, Lesson, UserCourseProgress } from "./types";

export const SESSION_STORAGE_KEY = "sc_user_session";
export const LEGACY_PROGRESS_KEY = "sc_academy_progress";
export const PROGRESS_KEY_PREFIX = "sc_academy_progress_u_";
export const GUEST_PROGRESS_KEY = "sc_academy_progress_guest";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

const memoryStore = new Map<string, string>();

// Per-user server hydration & pending operation state to prevent race-condition overwrites (BUG-02)
const hydratedUserIds = new Set<string>();
const lastFetchErrorByUser = new Map<string, string>();
const pendingLessonOpsByUser = new Map<string, Map<string, Map<string, boolean>>>();
let customTestFetcher: typeof fetch | null = null;

export function setProgressTestFetcher(fetcher: typeof fetch | null): void {
  customTestFetcher = fetcher;
}

function resolveFetcher(explicitFetcher?: typeof fetch): typeof fetch | null {
  if (explicitFetcher) return explicitFetcher;
  if (customTestFetcher) return customTestFetcher;
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    return window.fetch.bind(window);
  }
  return null;
}

function recordPendingLessonOp(
  userId: string,
  courseSlug: string,
  lessonId: string,
  isCompleted: boolean
): void {
  let userCourseMap = pendingLessonOpsByUser.get(userId);
  if (!userCourseMap) {
    userCourseMap = new Map<string, Map<string, boolean>>();
    pendingLessonOpsByUser.set(userId, userCourseMap);
  }
  let lessonMap = userCourseMap.get(courseSlug);
  if (!lessonMap) {
    lessonMap = new Map<string, boolean>();
    userCourseMap.set(courseSlug, lessonMap);
  }
  lessonMap.set(lessonId, isCompleted);
}

export function isServerProgressHydrated(userId?: string | null): boolean {
  const resolved = userId !== undefined ? userId : getActiveUserId();
  if (!resolved) return false;
  return hydratedUserIds.has(resolved) && !lastFetchErrorByUser.has(resolved);
}

function getStorage(): StorageLike | null {
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis && globalThis.localStorage) {
    const ls = globalThis.localStorage;
    return {
      getItem: (k) => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
      removeItem: (k) => ls.removeItem(k),
      keys: () => {
        const list: string[] = [];
        for (let i = 0; i < ls.length; i++) {
          const key = ls.key(i);
          if (key) list.push(key);
        }
        return list;
      },
    };
  }
  return {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
    setItem: (k, v) => {
      memoryStore.set(k, String(v));
    },
    removeItem: (k) => {
      memoryStore.delete(k);
    },
    keys: () => Array.from(memoryStore.keys()),
  };
}

export interface SessionUserCache {
  id: string;
  email?: string;
  name?: string;
  role?: string;
}

export function getActiveSessionUser(): SessionUserCache | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.id === "string" && parsed.id.trim()) {
      return parsed as SessionUserCache;
    }
    return null;
  } catch {
    return null;
  }
}

export function getActiveUserId(): string | null {
  return getActiveSessionUser()?.id || null;
}

export function getProgressStorageKey(userId?: string | null): string {
  const resolvedUserId = userId !== undefined ? userId : getActiveUserId();
  if (resolvedUserId && String(resolvedUserId).trim()) {
    return `${PROGRESS_KEY_PREFIX}${String(resolvedUserId).trim()}`;
  }
  return GUEST_PROGRESS_KEY;
}

export function clearSessionAndProgressStorage(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const activeId = getActiveUserId();
    storage.removeItem(SESSION_STORAGE_KEY);
    storage.removeItem(LEGACY_PROGRESS_KEY);
    storage.removeItem(GUEST_PROGRESS_KEY);
    if (activeId) {
      storage.removeItem(`${PROGRESS_KEY_PREFIX}${activeId}`);
      hydratedUserIds.delete(activeId);
      lastFetchErrorByUser.delete(activeId);
      pendingLessonOpsByUser.delete(activeId);
    }
    hydratedUserIds.clear();
    lastFetchErrorByUser.clear();
    pendingLessonOpsByUser.clear();
    for (const key of storage.keys()) {
      if (
        key === LEGACY_PROGRESS_KEY ||
        key === GUEST_PROGRESS_KEY ||
        key.startsWith(PROGRESS_KEY_PREFIX)
      ) {
        storage.removeItem(key);
      }
    }
  } catch (e) {
    console.error("Failed to clear session and progress storage", e);
  }
}

export function setAuthenticatedSessionUser(user: SessionUserCache | null): void {
  const storage = getStorage();
  if (!storage) return;
  if (!user || typeof user.id !== "string" || !user.id.trim()) {
    clearSessionAndProgressStorage();
    return;
  }

  try {
    const prevUser = getActiveSessionUser();
    if (prevUser?.id && prevUser.id !== user.id) {
      storage.removeItem(`${PROGRESS_KEY_PREFIX}${prevUser.id}`);
      hydratedUserIds.delete(prevUser.id);
      lastFetchErrorByUser.delete(prevUser.id);
      pendingLessonOpsByUser.delete(prevUser.id);
    }
    // Always remove un-namespaced legacy or guest progress so it cannot leak into authenticated user
    storage.removeItem(LEGACY_PROGRESS_KEY);
    storage.removeItem(GUEST_PROGRESS_KEY);
    for (const key of storage.keys()) {
      if (key.startsWith(PROGRESS_KEY_PREFIX) && key !== `${PROGRESS_KEY_PREFIX}${user.id}`) {
        storage.removeItem(key);
      }
    }
    const existingRaw = storage.getItem(`${PROGRESS_KEY_PREFIX}${user.id}`);
    if (!existingRaw || (prevUser?.id && prevUser.id !== user.id)) {
      hydratedUserIds.delete(user.id);
    }
    storage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      })
    );
  } catch (e) {
    console.error("Failed to set authenticated session user", e);
  }
}

export function getStoredProgress(userId?: string | null): Record<string, UserCourseProgress> {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const key = getProgressStorageKey(userId);
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Failed to parse progress from storage", e);
    return {};
  }
}

export function saveStoredProgress(
  data: Record<string, UserCourseProgress>,
  userId?: string | null
): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const key = getProgressStorageKey(userId);
    storage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save progress to storage", e);
  }
}

// Background sync to server database (strictly lesson progress; quiz scores are server-only)
export async function syncProgressToServer(
  courseSlug: string,
  progress: UserCourseProgress,
  explicitFetcher?: typeof fetch
): Promise<void> {
  const fetcher = resolveFetcher(explicitFetcher);
  if (!fetcher) return;
  // Only sync to server if there is an authenticated session user whose server progress has been hydrated
  const activeUserId = getActiveUserId();
  if (!activeUserId) return;
  if (!hydratedUserIds.has(activeUserId) || lastFetchErrorByUser.has(activeUserId)) {
    return;
  }
  try {
    await fetcher("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug,
        completedLessonIds: progress.completedLessonIds,
        lastLessonId: progress.lastAccessedLessonId,
      }),
    });
  } catch (err) {
    console.warn("Could not sync to server database (running offline/unauthenticated)", err);
  }
}

export interface ServerProgressFetchResult {
  status: "ok" | "unauthenticated" | "error";
  progressMap: Record<string, UserCourseProgress> | null;
  userId?: string | null;
  error?: string;
}

export async function fetchServerProgressWithStatus(
  explicitFetcher?: typeof fetch
): Promise<ServerProgressFetchResult> {
  const fetcher = resolveFetcher(explicitFetcher);
  if (!fetcher) {
    return { status: "unauthenticated", progressMap: null };
  }
  const activeUserId = getActiveUserId();
  try {
    const res = await fetcher("/api/progress");
    if (res.status === 401) {
      clearSessionAndProgressStorage();
      return { status: "unauthenticated", progressMap: null };
    }
    if (!res.ok) {
      const errMsg =
        "Gagal memuat progres belajar dari server. Progres Anda di server tetap aman—silakan coba lagi.";
      if (activeUserId) {
        hydratedUserIds.delete(activeUserId);
        lastFetchErrorByUser.set(activeUserId, errMsg);
      }
      return { status: "error", progressMap: null, error: errMsg };
    }
    const data = await res.json();
    if (data && data.progressMap && typeof data.progressMap === "object") {
      const serverUserId =
        typeof data.userId === "string" && data.userId.trim()
          ? data.userId.trim()
          : activeUserId;
      const mergedMap: Record<string, UserCourseProgress> = { ...data.progressMap };
      const coursesToSyncAfterMerge: string[] = [];

      if (serverUserId) {
        const existingUser = getActiveSessionUser();
        if (!existingUser || existingUser.id !== serverUserId) {
          setAuthenticatedSessionUser({ id: serverUserId });
        }

        // Merge any pending in-session local lesson operations recorded while server fetch was in-flight
        const pendingCourseMap = pendingLessonOpsByUser.get(serverUserId);
        if (pendingCourseMap && pendingCourseMap.size > 0) {
          const now = new Date().toISOString();
          for (const [slug, lessonOps] of pendingCourseMap.entries()) {
            const baseEntry: UserCourseProgress = mergedMap[slug]
              ? {
                  ...mergedMap[slug],
                  completedLessonIds: Array.isArray(mergedMap[slug].completedLessonIds)
                    ? [...mergedMap[slug].completedLessonIds]
                    : [],
                  quizScores: mergedMap[slug].quizScores ? { ...mergedMap[slug].quizScores } : {},
                }
              : {
                  courseSlug: slug,
                  completedLessonIds: [],
                  quizScores: {},
                  enrolledAt: now,
                  updatedAt: now,
                };

            let lastToggledLessonId = baseEntry.lastAccessedLessonId;
            for (const [lessonId, shouldBeCompleted] of lessonOps.entries()) {
              if (shouldBeCompleted) {
                if (!baseEntry.completedLessonIds.includes(lessonId)) {
                  baseEntry.completedLessonIds.push(lessonId);
                }
              } else {
                baseEntry.completedLessonIds = baseEntry.completedLessonIds.filter(
                  (id) => id !== lessonId
                );
              }
              lastToggledLessonId = lessonId;
            }
            baseEntry.completedLessonIds = Array.from(new Set(baseEntry.completedLessonIds));
            baseEntry.lastAccessedLessonId = lastToggledLessonId;
            baseEntry.updatedAt = now;
            mergedMap[slug] = baseEntry;
            coursesToSyncAfterMerge.push(slug);
          }
          pendingLessonOpsByUser.delete(serverUserId);
        }

        hydratedUserIds.add(serverUserId);
        lastFetchErrorByUser.delete(serverUserId);
        saveStoredProgress(mergedMap, serverUserId);

        for (const slug of coursesToSyncAfterMerge) {
          await syncProgressToServer(slug, mergedMap[slug], fetcher);
        }
      }

      return { status: "ok", progressMap: mergedMap, userId: serverUserId };
    }
    const invalidMsg = "Respons server tidak valid saat memuat progres.";
    if (activeUserId) {
      hydratedUserIds.delete(activeUserId);
      lastFetchErrorByUser.set(activeUserId, invalidMsg);
    }
    return { status: "error", progressMap: null, error: invalidMsg };
  } catch {
    const netMsg =
      "Tidak dapat terhubung ke server untuk memuat progres. Progres Anda di server tetap aman.";
    if (activeUserId) {
      hydratedUserIds.delete(activeUserId);
      lastFetchErrorByUser.set(activeUserId, netMsg);
    }
    return { status: "error", progressMap: null, error: netMsg };
  }
}

// Fetch server database progress and store isolated under authenticated userId
export async function fetchServerProgress(
  explicitFetcher?: typeof fetch
): Promise<Record<string, UserCourseProgress> | null> {
  const result = await fetchServerProgressWithStatus(explicitFetcher);
  return result.progressMap;
}

export interface ClassroomInitResult {
  status: "ok" | "guest" | "error";
  completedLessonIds: string[];
  progress: UserCourseProgress;
  error?: string;
}

/**
 * Safely initializes classroom progress without race-condition overwrites:
 * 1. Verifies session via `/api/auth/me`
 * 2. If authenticated, fetches & awaits server progress FIRST before enrolling
 * 3. If server progress fetch fails, preserves local cache without sending `completedLessonIds: []`
 */
export async function initializeClassroomCourseProgress(
  courseSlug: string,
  firstLessonId?: string,
  explicitFetcher?: typeof fetch
): Promise<ClassroomInitResult> {
  const fetcher = resolveFetcher(explicitFetcher);

  if (fetcher) {
    try {
      const meRes = await fetcher("/api/auth/me");
      if (meRes.status === 401) {
        clearSessionAndProgressStorage();
      } else if (meRes.ok) {
        const meData = await meRes.json();
        if (meData?.user?.id) {
          setAuthenticatedSessionUser(meData.user);
        } else {
          clearSessionAndProgressStorage();
        }
      } else {
        // Non-2xx (e.g. 500) on /api/auth/me: do not wipe local storage or overwrite server progress
        const activeUserId = getActiveUserId();
        if (activeUserId) {
          const errMsg =
            "Gagal memverifikasi sesi dari server. Progres Anda tetap diamankan.";
          hydratedUserIds.delete(activeUserId);
          lastFetchErrorByUser.set(activeUserId, errMsg);
          const localFallback = getCourseProgress(courseSlug, activeUserId);
          return {
            status: "error",
            completedLessonIds: localFallback.completedLessonIds,
            progress: localFallback,
            error: errMsg,
          };
        }
      }
    } catch {
      const activeUserId = getActiveUserId();
      if (activeUserId) {
        const errMsg =
          "Koneksi terputus saat memverifikasi sesi. Progres Anda di server tetap aman.";
        hydratedUserIds.delete(activeUserId);
        lastFetchErrorByUser.set(activeUserId, errMsg);
        const localFallback = getCourseProgress(courseSlug, activeUserId);
        return {
          status: "error",
          completedLessonIds: localFallback.completedLessonIds,
          progress: localFallback,
          error: errMsg,
        };
      }
    }
  }

  const activeUserId = getActiveUserId();
  if (activeUserId && fetcher) {
    // 1. Authenticated user: MUST fetch server progress FIRST before enrolling!
    const serverRes = await fetchServerProgressWithStatus(fetcher);
    if (serverRes.status === "error") {
      const localFallback = getCourseProgress(courseSlug, activeUserId);
      return {
        status: "error",
        completedLessonIds: localFallback.completedLessonIds,
        progress: localFallback,
        error: serverRes.error || "Gagal memuat progres dari server.",
      };
    }
    if (serverRes.status === "unauthenticated") {
      const guestProg = enrollCourse(courseSlug, firstLessonId, null);
      return {
        status: "guest",
        completedLessonIds: guestProg.completedLessonIds,
        progress: guestProg,
      };
    }

    // 2. Server progress is now hydrated: enroll only if course does not exist on server yet
    const enrolledOrRecovered = enrollCourse(courseSlug, firstLessonId, activeUserId, fetcher);
    return {
      status: "ok",
      completedLessonIds: enrolledOrRecovered.completedLessonIds,
      progress: enrolledOrRecovered,
    };
  }

  // Unauthenticated / guest mode
  const guestProgress = enrollCourse(courseSlug, firstLessonId, activeUserId);
  return {
    status: activeUserId ? "ok" : "guest",
    completedLessonIds: guestProgress.completedLessonIds,
    progress: guestProgress,
  };
}

export function applyServerCourseProgress(
  courseSlug: string,
  updatedProgress: { completedLessonIds: string[]; quizScores: Record<string, number> },
  lastLessonId?: string,
  userId?: string | null
): UserCourseProgress {
  const all = getStoredProgress(userId);
  const existing = all[courseSlug];
  const now = new Date().toISOString();

  const nextEntry: UserCourseProgress = {
    courseSlug,
    completedLessonIds: Array.isArray(updatedProgress.completedLessonIds)
      ? Array.from(new Set(updatedProgress.completedLessonIds))
      : [],
    quizScores:
      updatedProgress.quizScores && typeof updatedProgress.quizScores === "object"
        ? { ...updatedProgress.quizScores }
        : {},
    lastAccessedLessonId: lastLessonId ?? existing?.lastAccessedLessonId,
    enrolledAt: existing?.enrolledAt || now,
    updatedAt: now,
  };

  all[courseSlug] = nextEntry;
  saveStoredProgress(all, userId);
  return nextEntry;
}

export function getCourseProgress(
  courseSlug: string,
  userId?: string | null
): UserCourseProgress {
  const all = getStoredProgress(userId);
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

export function enrollCourse(
  courseSlug: string,
  firstLessonId?: string,
  userId?: string | null,
  explicitFetcher?: typeof fetch
): UserCourseProgress {
  const resolvedUserId = userId !== undefined ? userId : getActiveUserId();
  const all = getStoredProgress(resolvedUserId);
  if (!all[courseSlug]) {
    all[courseSlug] = {
      courseSlug,
      completedLessonIds: [],
      quizScores: {},
      lastAccessedLessonId: firstLessonId,
      enrolledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveStoredProgress(all, resolvedUserId);
    if (
      resolvedUserId &&
      hydratedUserIds.has(resolvedUserId) &&
      !lastFetchErrorByUser.has(resolvedUserId)
    ) {
      syncProgressToServer(courseSlug, all[courseSlug], explicitFetcher);
    }
  }
  return all[courseSlug];
}

export function toggleLessonComplete(
  courseSlug: string,
  lessonId: string,
  userId?: string | null,
  explicitFetcher?: typeof fetch
): boolean {
  const resolvedUserId = userId !== undefined ? userId : getActiveUserId();
  const all = getStoredProgress(resolvedUserId);
  const current = all[courseSlug] || {
    courseSlug,
    completedLessonIds: [],
    quizScores: {},
    enrolledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const isCompleted = current.completedLessonIds.includes(lessonId);
  const nextCompletedState = !isCompleted;
  if (isCompleted) {
    current.completedLessonIds = current.completedLessonIds.filter((id) => id !== lessonId);
  } else {
    current.completedLessonIds.push(lessonId);
  }

  current.lastAccessedLessonId = lessonId;
  current.updatedAt = new Date().toISOString();
  all[courseSlug] = current;
  saveStoredProgress(all, resolvedUserId);

  if (resolvedUserId) {
    if (!hydratedUserIds.has(resolvedUserId) || lastFetchErrorByUser.has(resolvedUserId)) {
      // Queue pending local completion so in-flight server recovery merges it instead of losing it
      recordPendingLessonOp(resolvedUserId, courseSlug, lessonId, nextCompletedState);
    } else {
      syncProgressToServer(courseSlug, current, explicitFetcher);
    }
  }

  return nextCompletedState;
}

export function calculateCoursePercentage(totalLessons: number, completedCount: number): number {
  if (totalLessons <= 0 || completedCount <= 0) return 0;
  const pct = Math.round((completedCount / totalLessons) * 100);
  return Math.min(100, Math.max(0, pct));
}

export interface CourseCompletionEvaluation {
  totalLessons: number;
  completedCount: number;
  percentage: number;
  isComplete: boolean;
  hasQuiz: boolean;
  allQuizzesPassed: boolean;
  isEligibleForCertificate: boolean;
  validCompletedLessonIds: string[];
}

export function evaluateCourseCompletion(
  course: Pick<Course, "modules"> | null | undefined,
  progress?: { completedLessonIds?: string[]; quizScores?: Record<string, number> } | null
): CourseCompletionEvaluation {
  const actualLessons: Lesson[] =
    course && Array.isArray(course.modules)
      ? course.modules.flatMap((m) => (m && Array.isArray(m.lessons) ? m.lessons : []))
      : [];

  const totalLessons = actualLessons.length;
  if (totalLessons === 0) {
    return {
      totalLessons: 0,
      completedCount: 0,
      percentage: 0,
      isComplete: false,
      hasQuiz: false,
      allQuizzesPassed: false,
      isEligibleForCertificate: false,
      validCompletedLessonIds: [],
    };
  }

  const lessonById = new Map<string, Lesson>();
  for (const lesson of actualLessons) {
    lessonById.set(lesson.id, lesson);
  }

  const quizScores = progress?.quizScores || {};
  const rawCompleted = Array.isArray(progress?.completedLessonIds)
    ? Array.from(new Set(progress.completedLessonIds))
    : [];

  const validCompletedLessonIds = rawCompleted.filter((id) => {
    const lesson = lessonById.get(id);
    if (!lesson) return false;
    const isQuizLesson = lesson.type === "quiz";
    if (isQuizLesson) {
      const threshold = typeof lesson.passingScore === "number" ? lesson.passingScore : 70;
      return (quizScores[id] ?? 0) >= Math.min(threshold, 70);
    }
    return true;
  });

  const completedCount = validCompletedLessonIds.length;
  const percentage = calculateCoursePercentage(totalLessons, completedCount);
  const isComplete = totalLessons > 0 && completedCount === totalLessons && percentage === 100;

  const quizLessons = actualLessons.filter((l) => l.type === "quiz");
  const hasQuiz = quizLessons.length > 0;
  const allQuizzesPassed =
    !hasQuiz ||
    quizLessons.every((ql) => {
      const threshold = typeof ql.passingScore === "number" ? ql.passingScore : 70;
      const grandfathered = rawCompleted.includes(ql.id) && (quizScores[ql.id] ?? 0) >= 70;
      return (quizScores[ql.id] ?? 0) >= threshold || grandfathered;
    });

  const isEligibleForCertificate = isComplete && allQuizzesPassed;

  return {
    totalLessons,
    completedCount,
    percentage,
    isComplete,
    hasQuiz,
    allQuizzesPassed,
    isEligibleForCertificate,
    validCompletedLessonIds,
  };
}
