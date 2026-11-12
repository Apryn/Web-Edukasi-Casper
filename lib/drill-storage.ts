/**
 * SIGNAL CASPER ACADEMY — SPRINT 5
 * Practical Learning & Interactive Drill Storage Service
 *
 * Implements atomic persistence, per-user/drill mutex locking, idempotency control,
 * versioning, and derived student progress projections.
 */

import crypto from "node:crypto";
import {
  getDatabase,
  executeMutation,
  recordAdminAuditLog,
  type DatabaseSchema,
} from "./db";
import type {
  DbDrillCase,
  DbDrillSubmission,
  DrillModelAnswer,
  DrillPublicationStatus,
  DrillRubric,
  StudentDrillAnswer,
  CriterionEvaluationResult,
  DrillEvaluationStatus,
  StudentDrillSummary,
} from "./drill-types";

// ── Concurrency Mutex: In-Memory Submission Queue ───────────────────
// Serializes parallel requests per (userId::drillId) tuple to prevent race conditions
// and guarantee sequential, atomic attempt numbering in the single-file JSON store.
const submissionMutexMap = new Map<string, Promise<void>>();

export async function withSubmissionLock<T>(
  userId: string,
  drillId: string,
  operation: () => Promise<T>
): Promise<T> {
  const safeUserId = String(userId || "").trim();
  const safeDrillId = String(drillId || "").trim();
  if (!safeUserId || !safeDrillId) {
    throw new Error("userId dan drillId wajib diisi untuk submission lock.");
  }

  const lockKey = `${safeUserId}::${safeDrillId}`;
  const previousLock = submissionMutexMap.get(lockKey) || Promise.resolve();

  let releaseLock: () => void;
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  submissionMutexMap.set(lockKey, currentLock);

  try {
    await previousLock;
    return await operation();
  } finally {
    releaseLock!();
    if (submissionMutexMap.get(lockKey) === currentLock) {
      submissionMutexMap.delete(lockKey);
    }
  }
}

export function clearSubmissionLocksForTest(): void {
  submissionMutexMap.clear();
}

// ── Rubric Integrity Validation ───────────────────────────────────
export function validateRubricIntegrity(rubric: DrillRubric): { ok: boolean; error?: string } {
  if (!rubric || !Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
    return { ok: false, error: "Rubrik wajib memiliki daftar kriteria penilaian." };
  }

  const totalWeight = rubric.criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
  if (totalWeight !== 100) {
    return {
      ok: false,
      error: `Total bobot kriteria rubrik harus tepat 100 poin (saat ini: ${totalWeight}).`,
    };
  }

  const invalidCrit = rubric.criteria.find((c) => c.id === "CRIT_INVALID");
  if (!invalidCrit) {
    return { ok: false, error: "Kriteria Invalidation/Stop-Loss (CRIT_INVALID) wajib ada." };
  }

  const safetyGateMin = rubric.invalidationSafetyGatePoints ?? 18;
  if (safetyGateMin > invalidCrit.weight) {
    return {
      ok: false,
      error: `Ambang batas safety gate (${safetyGateMin}) tidak boleh melebihi bobot kriteria (${invalidCrit.weight}).`,
    };
  }

  return { ok: true };
}

// ── Model Answer Consistency Validation ───────────────────────────
export function validateModelAnswerConsistency(
  model: DrillModelAnswer
): { ok: boolean; error?: string } {
  if (!model) return { ok: false, error: "Model answer wajib diisi." };

  if (!model.isNoTradeValid) {
    if (!model.entryZone || !model.invalidationPrice || !model.targetPrice) {
      return { ok: false, error: "Level Entry, Stop-Loss, dan Target wajib diisi jika posisi trading dibuka." };
    }

    if (model.expectedBias === "BULLISH") {
      if (model.invalidationPrice.ideal >= model.entryZone.min) {
        return {
          ok: false,
          error: "Untuk bias Bullish/Long, Stop-Loss harus berada di bawah zona Entry.",
        };
      }
      if (model.targetPrice.ideal <= model.entryZone.max) {
        return {
          ok: false,
          error: "Untuk bias Bullish/Long, Target harus berada di atas zona Entry.",
        };
      }
    } else if (model.expectedBias === "BEARISH") {
      if (model.invalidationPrice.ideal <= model.entryZone.max) {
        return {
          ok: false,
          error: "Untuk bias Bearish/Short, Stop-Loss harus berada di atas zona Entry.",
        };
      }
      if (model.targetPrice.ideal >= model.entryZone.min) {
        return {
          ok: false,
          error: "Untuk bias Bearish/Short, Target harus berada di bawah zona Entry.",
        };
      }
    }
  }

  return { ok: true };
}

// ── Drill CRUD Operations ─────────────────────────────────────────

export function getAllDrills(filter?: {
  status?: DrillPublicationStatus;
  courseId?: string;
}): DbDrillCase[] {
  const db = getDatabase();
  const drills = Array.isArray(db.drills) ? db.drills : [];
  return drills.filter((d) => {
    if (filter?.status && d.status !== filter.status) return false;
    if (filter?.courseId && d.course_id !== filter.courseId) return false;
    return true;
  });
}

export function getDrillById(drillId: string): DbDrillCase | null {
  const safeId = String(drillId || "").trim();
  if (!safeId) return null;
  const db = getDatabase();
  const drills = Array.isArray(db.drills) ? db.drills : [];
  return drills.find((d) => d.id === safeId || d.slug === safeId) || null;
}

export function saveDrillCase(
  input: DbDrillCase,
  adminUser: { id: string; email: string }
): DbDrillCase {
  const rubricCheck = validateRubricIntegrity(input.rubric);
  if (!rubricCheck.ok) {
    throw new Error(`Validasi Rubrik Gagal: ${rubricCheck.error}`);
  }

  const modelCheck = validateModelAnswerConsistency(input.model_answer);
  if (!modelCheck.ok) {
    throw new Error(`Validasi Model Answer Gagal: ${modelCheck.error}`);
  }

  return executeMutation((db: DatabaseSchema) => {
    if (!Array.isArray(db.drills)) {
      db.drills = [];
    }

    const now = new Date().toISOString();
    const existingIdx = db.drills.findIndex((d: DbDrillCase) => d.id === input.id);

    let savedCase: DbDrillCase;
    if (existingIdx >= 0) {
      const existing = db.drills[existingIdx];

      // Dual versioning increments
      const isModelChanged =
        JSON.stringify(existing.model_answer) !== JSON.stringify(input.model_answer) ||
        JSON.stringify(existing.price_bounds) !== JSON.stringify(input.price_bounds);
      const isRubricChanged =
        JSON.stringify(existing.rubric) !== JSON.stringify(input.rubric);

      const nextDrillVer = isModelChanged ? (existing.drill_version || 1) + 1 : (existing.drill_version || 1);
      const nextRubricVer = isRubricChanged ? (existing.rubric_version || 1) + 1 : (existing.rubric_version || 1);

      savedCase = {
        ...input,
        drill_version: nextDrillVer,
        rubric_version: nextRubricVer,
        updated_at: now,
      };
      db.drills[existingIdx] = savedCase;

      recordAdminAuditLog({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        action: "DRILL_UPDATED",
        targetCourseId: input.course_id,
        targetCourseSlug: input.course_slug,
        summary: `Mengupdate drill "${input.title}" (drill_v${nextDrillVer}, rubric_v${nextRubricVer})`,
      });
    } else {
      savedCase = {
        ...input,
        drill_version: 1,
        rubric_version: 1,
        created_at: now,
        updated_at: now,
      };
      db.drills.push(savedCase);

      recordAdminAuditLog({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        action: "DRILL_CREATED",
        targetCourseId: input.course_id,
        targetCourseSlug: input.course_slug,
        summary: `Membuat draft drill baru: "${input.title}"`,
      });
    }

    return { ...savedCase };
  });
}

// ── Submissions & Concurrency Management ──────────────────────────

export function getDrillSubmissions(userId: string, drillId: string): DbDrillSubmission[] {
  const safeUserId = String(userId || "").trim();
  const safeDrillId = String(drillId || "").trim();
  if (!safeUserId || !safeDrillId) return [];

  const db = getDatabase();
  const subs = Array.isArray(db.drill_submissions) ? db.drill_submissions : [];
  return subs
    .filter((s) => s.user_id === safeUserId && s.drill_id === safeDrillId)
    .sort((a, b) => a.attempt_number - b.attempt_number);
}

export function getAllSubmissionsForUser(userId: string): DbDrillSubmission[] {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) return [];
  const db = getDatabase();
  const subs = Array.isArray(db.drill_submissions) ? db.drill_submissions : [];
  return subs.filter((s) => s.user_id === safeUserId);
}

export interface RecordSubmissionInput {
  userId: string;
  drillId: string;
  drillVersion: number;
  rubricVersion: number;
  idempotencyKey: string;
  score: number;
  invalidationScore: number;
  safetyGatePassed: boolean;
  evaluationStatus: DrillEvaluationStatus;
  rubricSnapshot: DrillRubric;
  answers: StudentDrillAnswer;
  evaluationBreakdown: CriterionEvaluationResult[];
  debriefText: string;
}

export interface RecordSubmissionResult {
  submission: DbDrillSubmission;
  isIdempotentReplay: boolean;
}

export async function recordDrillSubmission(
  input: RecordSubmissionInput
): Promise<RecordSubmissionResult> {
  const userId = String(input.userId || "").trim();
  const drillId = String(input.drillId || "").trim();
  const idempotencyKey = String(input.idempotencyKey || "").trim();

  if (!userId || !drillId) {
    throw new Error("userId dan drillId wajib diisi.");
  }
  if (!idempotencyKey) {
    throw new Error("idempotencyKey wajib disertakan untuk submission aman.");
  }

  // Execute within per-user-and-drill mutex lock
  return withSubmissionLock(userId, drillId, async () => {
    // 1. Idempotency Check: Did this exact request already get processed?
    const existingSubs = getDrillSubmissions(userId, drillId);
    const existingIdempotent = existingSubs.find((s) => s.idempotency_key === idempotencyKey);
    if (existingIdempotent) {
      return {
        submission: { ...existingIdempotent },
        isIdempotentReplay: true,
      };
    }

    // 2. Atomic attempt numbering
    const nextAttemptNumber = existingSubs.length + 1;
    const submissionId = `sub_drill_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const newSubmission: DbDrillSubmission = {
      id: submissionId,
      user_id: userId,
      drill_id: drillId,
      drill_version: input.drillVersion,
      rubric_version: input.rubricVersion,
      attempt_number: nextAttemptNumber,
      idempotency_key: idempotencyKey,
      score: input.score,
      invalidation_score: input.invalidationScore,
      safety_gate_passed: input.safetyGatePassed,
      evaluation_status: input.evaluationStatus,
      rubric_snapshot: structuredClone(input.rubricSnapshot),
      answers: structuredClone(input.answers),
      evaluation_breakdown: structuredClone(input.evaluationBreakdown),
      debrief_text: input.debriefText,
      created_at: now,
    };

    // 3. Atomic commit to storage
    executeMutation((db: DatabaseSchema) => {
      if (!Array.isArray(db.drill_submissions)) {
        db.drill_submissions = [];
      }
      db.drill_submissions.push(newSubmission);
    });

    return {
      submission: { ...newSubmission },
      isIdempotentReplay: false,
    };
  });
}

// ── Derived Progress Summary Projection ───────────────────────────

export function computeStudentDrillSummary(
  userId: string,
  drillId: string,
  submissions: DbDrillSubmission[]
): StudentDrillSummary | null {
  const userSubs = submissions
    .filter((s) => s.user_id === userId && s.drill_id === drillId)
    .sort((a, b) => a.attempt_number - b.attempt_number);

  if (userSubs.length === 0) return null;

  const first = userSubs[0];
  const latest = userSubs[userSubs.length - 1];
  const passedSubs = userSubs.filter((s) => s.evaluation_status === "PASSED");
  const best = userSubs.reduce((max, s) => (s.score > max.score ? s : max), first);

  return {
    userId,
    drillId,
    attemptsCount: userSubs.length,
    firstScore: first.score,
    firstAttemptPassed: first.evaluation_status === "PASSED",
    latestScore: latest.score,
    bestScore: best.score,
    isPassed: passedSubs.length > 0,
    safetyGateMet: userSubs.some((s) => s.safety_gate_passed),
    firstAttemptAt: first.created_at,
    lastAttemptAt: latest.created_at,
  };
}

export function getStudentDrillSummary(
  userId: string,
  drillId: string
): StudentDrillSummary | null {
  const subs = getDrillSubmissions(userId, drillId);
  return computeStudentDrillSummary(userId, drillId, subs);
}
