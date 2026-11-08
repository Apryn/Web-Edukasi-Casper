/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * PRIVACY, CONSENT MANAGEMENT, AUTHORIZATION & JOURNAL AUDIT TRAIL (Task 3.6)
 *
 * Security & Privacy Invariants:
 * 1. Student journals are PRIVATE BY DEFAULT.
 * 2. Students can only access and mutate their own journal partitions.
 * 3. ADMIN and MASTER_ADMIN do NOT have automatic read access to private student journals.
 * 4. MENTOR can only read a student's data when the student has granted explicit,
 *    unrevoked, non-expired StudentConsent matching the required scope:
 *    - "ANALYTICS_ONLY": allows reading aggregated analytics report ONLY (blocks raw trade list/notes).
 *    - "FULL_JOURNAL": allows reading both analytics and trade records (strictly read-only).
 * 5. Consent can be revoked at any time by the student, immediately blocking subsequent mentor requests.
 * 6. All sensitive actions (consent grant/revoke, mentor access, account/trade mutations) are logged.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  StudentConsent,
  ConsentScope,
  JournalAuditRecord,
} from "./journal-types";
import {
  assertValidUserId,
  readUserPartitionLocked,
  mutateUserPartition,
  rebuildJournalIndex,
  ensureJournalDirectories,
} from "./journal-storage";
import type { DbUser, SafeUser } from "./auth";

const DATA_DIR = path.join(process.cwd(), "data");
const AUDIT_DIR = path.join(DATA_DIR, "journals", "audit");
const MAX_AUDIT_RECORDS_PER_USER = 500;
const MAX_CONSENT_DURATION_DAYS = 90;

// ── Audit Trail Persistence ────────────────────────────────────────

function getStudentAuditFilePath(studentId: string): string {
  assertValidUserId(studentId);
  ensureJournalDirectories();
  const target = path.resolve(AUDIT_DIR, `audit_u_${studentId}.json`);
  if (!target.startsWith(path.resolve(AUDIT_DIR) + path.sep)) {
    throw new Error("Invalid studentId for audit log path.");
  }
  return target;
}

/**
 * Atomically appends a sensitive activity record to the student's journal audit log.
 * Never logs passwords, tokens, or raw financial secrets.
 */
export function recordJournalAudit(input: {
  actorId: string;
  actorRole: string;
  action: string;
  studentId: string;
  scope?: ConsentScope;
  summary?: string;
}): JournalAuditRecord {
  assertValidUserId(input.studentId);
  ensureJournalDirectories();

  const record: JournalAuditRecord = {
    id: `jaud-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    studentId: input.studentId,
    ...(input.scope ? { scope: input.scope } : {}),
    ...(input.summary ? { summary: input.summary.slice(0, 300) } : {}),
  };

  const filePath = getStudentAuditFilePath(input.studentId);
  const tmpPath = path.join(
    AUDIT_DIR,
    `.audit_u_${input.studentId}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`
  );

  try {
    let existing: JournalAuditRecord[] = [];
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          existing = parsed;
        }
      } catch {}
    }

    const updated = [record, ...existing].slice(0, MAX_AUDIT_RECORDS_PER_USER);
    fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2), "utf8");
    fs.renameSync(tmpPath, filePath);
  } catch {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }
  }

  return record;
}

/**
 * Reads the audit trail for a specific student's journal.
 */
export function getJournalAuditLogs(studentId: string, limit = 50): JournalAuditRecord[] {
  assertValidUserId(studentId);
  const filePath = getStudentAuditFilePath(studentId);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, limit);
  } catch {
    return [];
  }
}

// ── Consent Evaluation & Lifecycle ─────────────────────────────────

/**
 * Checks whether a StudentConsent object is currently active (not revoked and not expired).
 */
export function isConsentCurrentlyActive(
  consent: StudentConsent | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!consent || typeof consent !== "object") return false;
  if (consent.isRevoked) return false;
  const expiresMs = new Date(consent.expiresAt).getTime();
  if (isNaN(expiresMs) || expiresMs <= nowMs) return false;
  return true;
}

export interface GrantConsentInput {
  granteeId?: string; // Specific mentor ID or "ALL_ACADEMY_MENTORS"
  granteeName?: string;
  scope?: ConsentScope;
  durationDays?: number;
}

/**
 * Grants or updates explicit read-only mentor consent for a student's journal.
 * Strictly requires the caller to be the student who owns the journal.
 */
export async function grantStudentConsent(
  actor: DbUser | SafeUser | null | undefined,
  studentId: string,
  input: GrantConsentInput
): Promise<StudentConsent> {
  if (!actor || !actor.id) {
    throw Object.assign(new Error("Autentikasi diperlukan."), { statusCode: 401 });
  }
  assertValidUserId(studentId);

  if (actor.id !== studentId) {
    throw Object.assign(
      new Error("Akses ditolak: Hanya pemilik jurnal (siswa) yang dapat memberikan izin akses."),
      { statusCode: 403 }
    );
  }

  const scope: ConsentScope =
    input.scope === "FULL_JOURNAL"
      ? "FULL_JOURNAL"
      : input.scope === "ANALYTICS_ONLY"
      ? "ANALYTICS_ONLY"
      : (() => {
          throw Object.assign(
            new Error('Scope consent tidak valid. Pilih "ANALYTICS_ONLY" atau "FULL_JOURNAL".'),
            { statusCode: 422 }
          );
        })();

  const granteeId = (input.granteeId || "ALL_ACADEMY_MENTORS").trim();
  if (!granteeId || granteeId.length > 128) {
    throw Object.assign(new Error("granteeId penerima akses tidak valid."), {
      statusCode: 422,
    });
  }

  const granteeName =
    (input.granteeName || "").trim() ||
    (granteeId === "ALL_ACADEMY_MENTORS" ? "Seluruh Mentor Akademi" : `Mentor (${granteeId})`);

  const rawDays =
    typeof input.durationDays === "number" && Number.isFinite(input.durationDays)
      ? Math.floor(input.durationDays)
      : 30;
  if (rawDays < 1 || rawDays > MAX_CONSENT_DURATION_DAYS) {
    throw Object.assign(
      new Error(`Durasi consent harus antara 1 hingga ${MAX_CONSENT_DURATION_DAYS} hari.`),
      { statusCode: 422 }
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + rawDays * 24 * 60 * 60 * 1000).toISOString();

  const newConsent: StudentConsent = {
    id: `cns-${crypto.randomUUID()}`,
    studentId,
    granteeId,
    granteeName,
    scope,
    grantedAt: now.toISOString(),
    expiresAt,
    isRevoked: false,
  };

  await mutateUserPartition(studentId, (partition) => {
    return {
      result: newConsent,
      updatedPartition: {
        ...partition,
        consent: newConsent,
      },
    };
  });

  try {
    rebuildJournalIndex();
  } catch {}

  recordJournalAudit({
    actorId: actor.id,
    actorRole: actor.role || "USER",
    action: "CONSENT_GRANT",
    studentId,
    scope,
    summary: `Siswa memberikan akses ${scope} kepada ${granteeName} (${granteeId}) hingga ${expiresAt}.`,
  });

  return newConsent;
}

/**
 * Immediately revokes active consent on a student's journal.
 * Strictly requires the caller to be the student who owns the journal.
 */
export async function revokeStudentConsent(
  actor: DbUser | SafeUser | null | undefined,
  studentId: string
): Promise<{ revoked: boolean; consent: StudentConsent | null }> {
  if (!actor || !actor.id) {
    throw Object.assign(new Error("Autentikasi diperlukan."), { statusCode: 401 });
  }
  assertValidUserId(studentId);

  if (actor.id !== studentId) {
    throw Object.assign(
      new Error("Akses ditolak: Hanya pemilik jurnal (siswa) yang dapat mencabut izin akses."),
      { statusCode: 403 }
    );
  }

  const nowIso = new Date().toISOString();

  const updatedConsent = await mutateUserPartition(studentId, (partition) => {
    if (!partition.consent) {
      return {
        result: null,
        updatedPartition: partition,
      };
    }

    const revokedObj: StudentConsent = {
      ...partition.consent,
      isRevoked: true,
      revokedAt: nowIso,
    };

    return {
      result: revokedObj,
      updatedPartition: {
        ...partition,
        consent: revokedObj,
      },
    };
  });

  try {
    rebuildJournalIndex();
  } catch {}

  recordJournalAudit({
    actorId: actor.id,
    actorRole: actor.role || "USER",
    action: "CONSENT_REVOKE",
    studentId,
    summary: "Siswa mencabut izin akses mentor pada jurnal pribadinya.",
  });

  return {
    revoked: true,
    consent: updatedConsent,
  };
}

// ── Server-Side Authorization Gate ─────────────────────────────────

export type JournalOperationType =
  | "READ_ANALYTICS"
  | "READ_FULL_JOURNAL"
  | "MUTATE_JOURNAL"
  | "MANAGE_CONSENT";

export interface JournalAuthorizationResult {
  allowed: boolean;
  status: number;
  error?: string;
  targetUserId: string;
  accessMode?: "OWNER" | "MENTOR_CONSENT";
  consentScope?: ConsentScope;
}

/**
 * Enforces strict server-side authorization for all journal and analytics operations:
 * - Student can only access/mutate their own journal.
 * - ADMIN and MASTER_ADMIN have NO automatic read access to private journals.
 * - MENTOR can only read if explicit, active, unrevoked consent is present and covers the requested scope.
 */
export async function authorizeJournalAccess(
  actor: DbUser | SafeUser | null | undefined,
  requestedUserId: string | null | undefined,
  operation: JournalOperationType
): Promise<JournalAuthorizationResult> {
  if (!actor || !actor.id) {
    return {
      allowed: false,
      status: 401,
      error: "Autentikasi diperlukan. Silakan login terlebih dahulu.",
      targetUserId: "",
    };
  }

  const targetUserId =
    requestedUserId && requestedUserId.trim().length > 0
      ? requestedUserId.trim()
      : actor.id;

  try {
    assertValidUserId(targetUserId);
  } catch {
    return {
      allowed: false,
      status: 400,
      error: "Parameter userId tidak valid.",
      targetUserId,
    };
  }

  // Case 1: Owner accessing their own journal
  if (actor.id === targetUserId) {
    return {
      allowed: true,
      status: 200,
      targetUserId,
      accessMode: "OWNER",
    };
  }

  // Case 2: Cross-user mutation or consent management is ALWAYS forbidden for everyone
  if (operation === "MUTATE_JOURNAL" || operation === "MANAGE_CONSENT") {
    recordJournalAudit({
      actorId: actor.id,
      actorRole: actor.role || "USER",
      action: "UNAUTHORIZED_MUTATION_BLOCKED",
      studentId: targetUserId,
      summary: `Percobaan mutasi lintas pengguna oleh ${actor.id} (${actor.role}) ditolak.`,
    });
    return {
      allowed: false,
      status: 403,
      error:
        "Akses ditolak: Anda tidak diizinkan mengubah jurnal, akun, atau pengaturan privasi milik pengguna lain.",
      targetUserId,
    };
  }

  // Case 3: Cross-user read by regular student (USER) -> strictly forbidden
  if (actor.role === "USER") {
    recordJournalAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "UNAUTHORIZED_READ_BLOCKED",
      studentId: targetUserId,
      summary: `Percobaan baca jurnal pengguna lain oleh siswa ${actor.id} ditolak.`,
    });
    return {
      allowed: false,
      status: 403,
      error: "Akses ditolak: Jurnal trading bersifat privat dan hanya dapat diakses oleh pemiliknya.",
      targetUserId,
    };
  }

  // Case 4: Cross-user read by ADMIN, MASTER_ADMIN, or MENTOR
  // Note: ADMIN and MASTER_ADMIN do NOT get automatic access!
  // Let's inspect the target student's partition consent under lock.
  const partition = await readUserPartitionLocked(targetUserId);
  const consent = partition.consent;

  if (!isConsentCurrentlyActive(consent)) {
    recordJournalAudit({
      actorId: actor.id,
      actorRole: actor.role || "UNKNOWN",
      action: "PRIVATE_ACCESS_DENIED_NO_CONSENT",
      studentId: targetUserId,
      summary: `Akses baca jurnal oleh ${actor.role} (${actor.id}) ditolak karena tidak ada consent aktif.`,
    });
    return {
      allowed: false,
      status: 403,
      error:
        "Akses ditolak: Jurnal siswa bersifat privat. Tidak ada izin akses (consent) aktif dari siswa.",
      targetUserId,
    };
  }

  const activeConsent = consent as StudentConsent;

  // Verify grantee match:
  // - Specific user ID match: activeConsent.granteeId === actor.id
  // - Or "ALL_ACADEMY_MENTORS" ONLY if actor.role === "MENTOR" (NOT automatic for ADMIN / MASTER_ADMIN!)
  const isGranteeMatched =
    activeConsent.granteeId === actor.id ||
    (activeConsent.granteeId === "ALL_ACADEMY_MENTORS" && actor.role === "MENTOR");

  if (!isGranteeMatched) {
    recordJournalAudit({
      actorId: actor.id,
      actorRole: actor.role || "UNKNOWN",
      action: "PRIVATE_ACCESS_DENIED_GRANTEE_MISMATCH",
      studentId: targetUserId,
      summary: `Akses oleh ${actor.role} (${actor.id}) ditolak: bukan penerima consent yang ditunjuk (${activeConsent.granteeId}).`,
    });
    return {
      allowed: false,
      status: 403,
      error:
        "Akses ditolak: Anda tidak terdaftar sebagai mentor penerima consent untuk jurnal siswa ini.",
      targetUserId,
    };
  }

  // Verify scope match:
  // If operation requires READ_FULL_JOURNAL, scope MUST be FULL_JOURNAL
  if (
    operation === "READ_FULL_JOURNAL" &&
    activeConsent.scope !== "FULL_JOURNAL"
  ) {
    recordJournalAudit({
      actorId: actor.id,
      actorRole: actor.role || "MENTOR",
      action: "PRIVATE_ACCESS_DENIED_SCOPE_INSUFFICIENT",
      studentId: targetUserId,
      scope: activeConsent.scope,
      summary: `Mentor (${actor.id}) mencoba membaca catatan trade penuh namun scope hanya ANALYTICS_ONLY.`,
    });
    return {
      allowed: false,
      status: 403,
      error:
        "Akses ditolak: Siswa hanya memberikan izin ANALYTICS_ONLY. Catatan jurnal dan riwayat trade detail tetap privat.",
      targetUserId,
    };
  }

  // Authorized via explicit student consent! Log the access in the student's audit trail.
  recordJournalAudit({
    actorId: actor.id,
    actorRole: actor.role || "MENTOR",
    action:
      operation === "READ_FULL_JOURNAL"
        ? "MENTOR_JOURNAL_INSPECT"
        : "MENTOR_ANALYTICS_INSPECT",
    studentId: targetUserId,
    scope: activeConsent.scope,
    summary: `Mentor (${actor.id}) mengakses ${
      operation === "READ_FULL_JOURNAL" ? "jurnal lengkap" : "ringkasan analitik"
    } berdasarkan consent aktif.`,
  });

  return {
    allowed: true,
    status: 200,
    targetUserId,
    accessMode: "MENTOR_CONSENT",
    consentScope: activeConsent.scope,
  };
}

