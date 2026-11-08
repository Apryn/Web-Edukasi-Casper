/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * ADMIN STUDENT INTELLIGENCE SERVICE (Task 3.6 & Task 3.7)
 *
 * Privacy & Educational Mandate:
 * - Accessible ONLY to ADMIN / MASTER_ADMIN roles.
 * - Provides strictly ANONYMIZED, AGGREGATE educational metrics across the academy cohort.
 * - NEVER exposes individual student journals, private P/L, account balances, trade notes,
 *   or personally identifiable student performance rankings.
 * - Includes explicit sample representativeness caveats when cohort data is limited.
 */

import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "./db";
import { isAdmin, type DbUser, type SafeUser } from "./auth";
import { isValidJournalPartition, ensureJournalDirectories } from "./journal-storage";
import { evaluateSampleStatus, filterEligibleClosedTrades } from "./analytics/core-metrics";
import { MISTAKE_LABELS, EMOTION_LABELS, SESSION_LABELS } from "./analytics/dimensional-slicer";
import { isConsentCurrentlyActive } from "./journal-consent";
import { roundToDecimals } from "./journal-service";
import type { UserJournalPartition } from "./journal-types";

const DATA_DIR = path.join(process.cwd(), "data");
const JOURNALS_DIR = path.join(DATA_DIR, "journals");

export interface AdminStudentIntelligenceReport {
  generatedAt: string;
  privacyGuarantee: "STRICT_ANONYMIZED_AGGREGATE_ONLY";
  cohortRepresentativenessStatus: "SUFFICIENT_COHORT" | "LIMITED_COHORT" | "EMPTY_COHORT";
  cohortDisclaimer: string;

  population: {
    totalRegisteredUsers: number;
    totalRegisteredStudents: number;
    studentsEnrolledInCoursesCount: number;
    studentsWithJournalCount: number;
    activeJournalingStudentsCount: number;
    journalAdoptionRate: number; // % of registered students with a journal
  };

  journalActivity: {
    totalAccountsAcrossCohort: number;
    activeAccountsCount: number;
    archivedAccountsCount: number;
    totalTradesAcrossCohort: number;
    totalClosedTradesAcrossCohort: number;
    totalOpenTradesAcrossCohort: number;
    journalCompletenessRate: number; // % of trades with risk + SL + setup + notes
    riskManagementAdoptionRate: number; // % of trades with plannedRiskAmount > 0
  };

  learningJournalingCrossTab: {
    enrolledAndJournalingCount: number;
    enrolledWithoutJournalCount: number;
    journalingWithoutEnrollmentCount: number;
    inactiveStudentsCount: number;
  };

  sampleStatusDistribution: {
    NO_DATA: number;
    INSUFFICIENT: number;
    LIMITED: number;
    SUFFICIENT: number;
  };

  accountTypeDistribution: {
    DEMO: number;
    LIVE: number;
    PROP_FIRM: number;
    PAPER: number;
  };

  behavioralInsights: {
    topMistakes: Array<{
      mistake: string;
      label: string;
      count: number;
      percentage: number;
    }>;
    topEmotions: Array<{
      emotion: string;
      label: string;
      count: number;
      percentage: number;
    }>;
    sessionDistribution: Array<{
      session: string;
      label: string;
      count: number;
      percentage: number;
    }>;
  };

  consentOverview: {
    activeConsentsCount: number;
    revokedOrExpiredConsentsCount: number;
    analyticsOnlyScopeCount: number;
    fullJournalScopeCount: number;
  };
}

/**
 * Generates the anonymized Admin Student Intelligence report.
 * Enforces server-side ADMIN / MASTER_ADMIN authorization.
 */
export function getAdminStudentIntelligence(
  actor: DbUser | SafeUser | null | undefined
): {
  ok: boolean;
  status: number;
  error?: string;
  data?: AdminStudentIntelligenceReport;
} {
  if (!actor || !actor.id) {
    return {
      ok: false,
      status: 401,
      error: "Autentikasi diperlukan.",
    };
  }

  if (!isAdmin(actor)) {
    return {
      ok: false,
      status: 403,
      error: "Akses ditolak: Hanya Administrator yang dapat mengakses agregat Student Intelligence.",
    };
  }

  ensureJournalDirectories();
  const db = getDatabase();

  const totalRegisteredUsers = db.users.length;
  const studentUsers = db.users.filter(
    (u) => u.role !== "ADMIN" && u.role !== "MASTER_ADMIN"
  );
  const registeredStudentIds = new Set<string>(studentUsers.map((u) => u.id));
  const totalRegisteredStudents = studentUsers.length;

  const enrolledUserIds = new Set<string>(
    db.course_progress.map((cp) => cp.user_id)
  );

  // Read all valid journal partitions on disk belonging to registered students
  const partitions: UserJournalPartition[] = [];
  if (fs.existsSync(JOURNALS_DIR)) {
    try {
      const files = fs
        .readdirSync(JOURNALS_DIR)
        .filter((f) => f.startsWith("u_") && f.endsWith(".json"));
      for (const f of files) {
        try {
          const raw = fs.readFileSync(path.join(JOURNALS_DIR, f), "utf8");
          const parsed = JSON.parse(raw);
          if (
            isValidJournalPartition(parsed) &&
            registeredStudentIds.has(parsed.userId)
          ) {
            partitions.push(parsed);
          }
        } catch {}
      }
    } catch {}
  }

  let studentsWithJournalCount = 0;
  let activeJournalingStudentsCount = 0;

  let totalAccountsAcrossCohort = 0;
  let activeAccountsCount = 0;
  let archivedAccountsCount = 0;

  let totalTradesAcrossCohort = 0;
  let totalClosedTradesAcrossCohort = 0;
  let totalOpenTradesAcrossCohort = 0;
  let completeTradesCount = 0;
  let riskPlannedTradesCount = 0;

  const accountTypeDistribution = {
    DEMO: 0,
    LIVE: 0,
    PROP_FIRM: 0,
    PAPER: 0,
  };

  const sampleStatusDistribution = {
    NO_DATA: 0,
    INSUFFICIENT: 0,
    LIMITED: 0,
    SUFFICIENT: 0,
  };

  const mistakeCounts: Record<string, number> = {};
  const emotionCounts: Record<string, number> = {};
  const sessionCounts: Record<string, number> = {};

  let activeConsentsCount = 0;
  let revokedOrExpiredConsentsCount = 0;
  let analyticsOnlyScopeCount = 0;
  let fullJournalScopeCount = 0;

  const journalingUserIds = new Set<string>();

  for (const part of partitions) {
    const hasAccountOrTrade =
      part.accounts.length > 0 || part.trades.length > 0;
    if (hasAccountOrTrade) {
      studentsWithJournalCount++;
      journalingUserIds.add(part.userId);
    }

    if (part.trades.length > 0) {
      activeJournalingStudentsCount++;
    }

    // Account metrics
    for (const acc of part.accounts) {
      totalAccountsAcrossCohort++;
      if (acc.isArchived) archivedAccountsCount++;
      else activeAccountsCount++;

      if (acc.accountType in accountTypeDistribution) {
        accountTypeDistribution[acc.accountType]++;
      }
    }

    // Sample status for this user's closed trades
    const eligibleClosed = filterEligibleClosedTrades(part.trades);
    const sampleEval = evaluateSampleStatus(eligibleClosed.length);
    sampleStatusDistribution[sampleEval.status]++;

    // Trade completeness & behavioral counts
    for (const tr of part.trades) {
      if (!tr || typeof tr !== "object") continue;
      totalTradesAcrossCohort++;
      if (tr.status === "CLOSED") totalClosedTradesAcrossCohort++;
      else if (tr.status === "OPEN") totalOpenTradesAcrossCohort++;

      const hasPlannedRisk =
        typeof tr.plannedRiskAmount === "number" && tr.plannedRiskAmount > 0;
      if (hasPlannedRisk) {
        riskPlannedTradesCount++;
      }

      const hasStopLoss = typeof tr.stopLoss === "number" && tr.stopLoss > 0;
      const hasSetup = Array.isArray(tr.setupTags) && tr.setupTags.length > 0;
      const hasNotes =
        typeof tr.notes === "string" && tr.notes.trim().length > 0;

      if (hasPlannedRisk && hasStopLoss && hasSetup && hasNotes) {
        completeTradesCount++;
      }

      const mKey = tr.mistake || "UNSPECIFIED";
      mistakeCounts[mKey] = (mistakeCounts[mKey] || 0) + 1;

      const eKey = tr.emotion || "UNSPECIFIED";
      emotionCounts[eKey] = (emotionCounts[eKey] || 0) + 1;

      const sKey = tr.session || "UNSPECIFIED";
      sessionCounts[sKey] = (sessionCounts[sKey] || 0) + 1;
    }

    // Consent overview
    if (part.consent) {
      if (isConsentCurrentlyActive(part.consent)) {
        activeConsentsCount++;
        if (part.consent.scope === "FULL_JOURNAL") fullJournalScopeCount++;
        else analyticsOnlyScopeCount++;
      } else {
        revokedOrExpiredConsentsCount++;
      }
    }
  }

  // Account for registered students who don't have a journal partition yet in NO_DATA
  const studentsWithoutPartition = Math.max(
    0,
    totalRegisteredStudents - partitions.length
  );
  sampleStatusDistribution.NO_DATA += studentsWithoutPartition;

  // Cross-tab learning vs journaling
  let enrolledAndJournalingCount = 0;
  let enrolledWithoutJournalCount = 0;
  let journalingWithoutEnrollmentCount = 0;
  let inactiveStudentsCount = 0;

  const allKnownUserIds = new Set<string>([
    ...studentUsers.map((u) => u.id),
    ...Array.from(journalingUserIds),
    ...Array.from(enrolledUserIds),
  ]);

  for (const uid of allKnownUserIds) {
    const isEnrolled = enrolledUserIds.has(uid);
    const isJournaling = journalingUserIds.has(uid);
    if (isEnrolled && isJournaling) enrolledAndJournalingCount++;
    else if (isEnrolled && !isJournaling) enrolledWithoutJournalCount++;
    else if (!isEnrolled && isJournaling) journalingWithoutEnrollmentCount++;
    else inactiveStudentsCount++;
  }

  const denominatorStudents = Math.max(
    totalRegisteredStudents,
    studentsWithJournalCount
  );
  const journalAdoptionRate =
    denominatorStudents > 0
      ? roundToDecimals((studentsWithJournalCount / denominatorStudents) * 100, 2)
      : 0;

  const journalCompletenessRate =
    totalTradesAcrossCohort > 0
      ? roundToDecimals((completeTradesCount / totalTradesAcrossCohort) * 100, 2)
      : 0;

  const riskManagementAdoptionRate =
    totalTradesAcrossCohort > 0
      ? roundToDecimals((riskPlannedTradesCount / totalTradesAcrossCohort) * 100, 2)
      : 0;

  const topMistakes = Object.entries(mistakeCounts)
    .map(([mistake, count]) => ({
      mistake,
      label: MISTAKE_LABELS[mistake] || mistake,
      count,
      percentage:
        totalTradesAcrossCohort > 0
          ? roundToDecimals((count / totalTradesAcrossCohort) * 100, 2)
          : 0,
    }))
    .sort((a, b) => b.count - a.count || a.mistake.localeCompare(b.mistake));

  const topEmotions = Object.entries(emotionCounts)
    .map(([emotion, count]) => ({
      emotion,
      label: EMOTION_LABELS[emotion] || emotion,
      count,
      percentage:
        totalTradesAcrossCohort > 0
          ? roundToDecimals((count / totalTradesAcrossCohort) * 100, 2)
          : 0,
    }))
    .sort((a, b) => b.count - a.count || a.emotion.localeCompare(b.emotion));

  const sessionDistribution = Object.entries(sessionCounts)
    .map(([session, count]) => ({
      session,
      label: SESSION_LABELS[session] || session,
      count,
      percentage:
        totalTradesAcrossCohort > 0
          ? roundToDecimals((count / totalTradesAcrossCohort) * 100, 2)
          : 0,
    }))
    .sort((a, b) => b.count - a.count || a.session.localeCompare(b.session));

  let cohortRepresentativenessStatus: AdminStudentIntelligenceReport["cohortRepresentativenessStatus"] =
    "EMPTY_COHORT";
  let cohortDisclaimer =
    "Belum ada aktivitas pencatatan jurnal siswa yang tersedia untuk analisis agregat.";

  if (activeJournalingStudentsCount >= 10 && totalClosedTradesAcrossCohort >= 100) {
    cohortRepresentativenessStatus = "SUFFICIENT_COHORT";
    cohortDisclaimer =
      "Agregat dianonimkan dari kohort aktif. Data ini hanya digunakan untuk evaluasi kurikulum pendidikan dan tidak menampilkan jurnal pribadi siswa.";
  } else if (studentsWithJournalCount > 0 || totalTradesAcrossCohort > 0) {
    cohortRepresentativenessStatus = "LIMITED_COHORT";
    cohortDisclaimer =
      "Peringatan Representativitas: Jumlah siswa aktif atau sampel trade agregat saat ini masih terbatas. Gunakan tren perilaku di bawah ini sebagai indikasi awal evaluasi materi edukasi, bukan generalisasi populasi penuh.";
  }

  return {
    ok: true,
    status: 200,
    data: {
      generatedAt: new Date().toISOString(),
      privacyGuarantee: "STRICT_ANONYMIZED_AGGREGATE_ONLY",
      cohortRepresentativenessStatus,
      cohortDisclaimer,
      population: {
        totalRegisteredUsers,
        totalRegisteredStudents,
        studentsEnrolledInCoursesCount: enrolledUserIds.size,
        studentsWithJournalCount,
        activeJournalingStudentsCount,
        journalAdoptionRate,
      },
      journalActivity: {
        totalAccountsAcrossCohort,
        activeAccountsCount,
        archivedAccountsCount,
        totalTradesAcrossCohort,
        totalClosedTradesAcrossCohort,
        totalOpenTradesAcrossCohort,
        journalCompletenessRate,
        riskManagementAdoptionRate,
      },
      learningJournalingCrossTab: {
        enrolledAndJournalingCount,
        enrolledWithoutJournalCount,
        journalingWithoutEnrollmentCount,
        inactiveStudentsCount,
      },
      sampleStatusDistribution,
      accountTypeDistribution,
      behavioralInsights: {
        topMistakes,
        topEmotions,
        sessionDistribution,
      },
      consentOverview: {
        activeConsentsCount,
        revokedOrExpiredConsentsCount,
        analyticsOnlyScopeCount,
        fullJournalScopeCount,
      },
    },
  };
}

