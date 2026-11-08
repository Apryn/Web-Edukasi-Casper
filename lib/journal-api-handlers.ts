/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * SECURE JOURNAL & ANALYTICS API CONTROLLER LAYER (Task 3.6)
 *
 * Enforces:
 * - Server-side authentication & strict tenant/consent authorization (authorizeJournalAccess)
 * - XSS & payload sanitization on all user text fields
 * - Safe error normalization (zero internal path, stack trace, or cross-user leakage)
 * - Comprehensive audit logging for sensitive mutations and mentor inspections
 */

import { sanitizeCurriculumText } from "./courses-data";
import { getDatabase } from "./db";
import type { DbUser, SafeUser } from "./auth";
import {
  createTradingAccount,
  updateTradingAccount,
  archiveTradingAccount,
  restoreTradingAccount,
  createTrade,
  getTrades,
  updateTrade,
  closeTrade,
  cancelTrade,
  deleteTrade,
  createCashTransaction,
  getCashTransactions,
  updateCashTransaction,
  deleteCashTransaction,
  calculateAccountBalances,
  JournalServiceError,
} from "./journal-service";
import {
  readUserPartitionLocked,
} from "./journal-storage";
import {
  JournalStorageError,
  type MarketSession,
  type TimeFrame,
  type MarketCondition,
  type TradeStatus,
  type TradeDirection,
  type TradeOutcome,
  type EmotionState,
  type ExecutionMistake,
  type AccountType,
  type ConsentScope,
} from "./journal-types";
import {
  authorizeJournalAccess,
  grantStudentConsent,
  revokeStudentConsent,
  isConsentCurrentlyActive,
  getJournalAuditLogs,
  recordJournalAudit,
} from "./journal-consent";
import {
  getStudentAnalyticsReport,
} from "./analytics/analytics-orchestrator";
import type {
  AnalyticsFilterInput,
  DayOfWeekKey,
  TimeSeriesGranularity,
} from "./analytics/analytics-types";

export interface ApiHandlerResult<T = unknown> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

/**
 * Safely maps domain errors to HTTP status codes without leaking stack traces or filesystem paths.
 */
function mapErrorToSafeResponse(err: unknown): ApiHandlerResult<never> {
  if (err instanceof JournalServiceError || err instanceof JournalStorageError) {
    return {
      ok: false,
      status: err.statusCode || 400,
      error: err.message,
    };
  }
  if (err && typeof err === "object" && "statusCode" in err) {
    const status = Number((err as { statusCode?: number }).statusCode) || 400;
    const rawMsg = (err as { message?: unknown }).message;
    const message =
      typeof rawMsg === "string"
        ? rawMsg
        : "Permintaan tidak dapat diproses.";
    return {
      ok: false,
      status,
      error: message,
    };
  }
  return {
    ok: false,
    status: 500,
    error: "Terjadi kesalahan internal pada server saat memproses permintaan jurnal.",
  };
}

// ── 1. Trading Accounts Handler ────────────────────────────────────

export async function handleJournalAccountsRequest(
  actor: DbUser | SafeUser | null | undefined,
  method: "GET" | "POST" | "PUT" | "PATCH",
  params: {
    queryUserId?: string | null;
    includeArchived?: boolean;
    body?: Record<string, unknown> | null;
  } = {}
): Promise<ApiHandlerResult> {
  try {
    if (method === "GET") {
      const auth = await authorizeJournalAccess(
        actor,
        params.queryUserId,
        "READ_FULL_JOURNAL"
      );
      if (!auth.allowed) {
        return { ok: false, status: auth.status, error: auth.error };
      }

      const partition = await readUserPartitionLocked(auth.targetUserId);
      const includeArchived =
        params.includeArchived !== undefined ? params.includeArchived : true;
      const accounts = partition.accounts
        .filter((a) => includeArchived || !a.isArchived)
        .map((acc) => ({
          ...acc,
          balanceSummary: calculateAccountBalances(
            acc,
            partition.cashTransactions,
            partition.trades
          ),
        }));

      return {
        ok: true,
        status: 200,
        data: {
          accounts,
          accessMode: auth.accessMode,
        },
      };
    }

    const body = params.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, status: 400, error: "Payload request tidak valid." };
    }

    const requestedUserId =
      typeof body.userId === "string" ? body.userId : params.queryUserId;
    const auth = await authorizeJournalAccess(
      actor,
      requestedUserId,
      "MUTATE_JOURNAL"
    );
    if (!auth.allowed) {
      return { ok: false, status: auth.status, error: auth.error };
    }

    if (method === "POST") {
      const accountName = sanitizeCurriculumText(body.accountName).trim();
      const brokerLabel = body.brokerLabel
        ? sanitizeCurriculumText(body.brokerLabel).trim()
        : undefined;
      const accountCurrency =
        typeof body.accountCurrency === "string"
          ? body.accountCurrency.trim().toUpperCase()
          : "USD";
      const accountType = (body.accountType as AccountType) || "DEMO";
      const initialBalance = Number(body.initialBalance);

      const created = await createTradingAccount(auth.targetUserId, {
        accountName,
        brokerLabel,
        accountCurrency,
        accountType,
        initialBalance,
      });

      recordJournalAudit({
        actorId: auth.targetUserId,
        actorRole: actor?.role || "USER",
        action: "ACCOUNT_CREATE",
        studentId: auth.targetUserId,
        summary: `Membuat akun trading "${created.accountName}" (${created.accountCurrency}).`,
      });

      return {
        ok: true,
        status: 201,
        data: { account: created },
      };
    }

    if (method === "PUT" || method === "PATCH") {
      const accountId =
        typeof body.accountId === "string" ? body.accountId.trim() : "";
      if (!accountId) {
        return { ok: false, status: 400, error: "accountId wajib disertakan." };
      }

      const action =
        typeof body.action === "string" ? body.action.trim().toLowerCase() : "update";

      if (action === "archive") {
        const archived = await archiveTradingAccount(auth.targetUserId, accountId);
        recordJournalAudit({
          actorId: auth.targetUserId,
          actorRole: actor?.role || "USER",
          action: "ACCOUNT_ARCHIVE",
          studentId: auth.targetUserId,
          summary: `Mengarsipkan akun trading "${archived.accountName}" (${archived.id}).`,
        });
        return { ok: true, status: 200, data: { account: archived } };
      }

      if (action === "restore") {
        const restored = await restoreTradingAccount(auth.targetUserId, accountId);
        recordJournalAudit({
          actorId: auth.targetUserId,
          actorRole: actor?.role || "USER",
          action: "ACCOUNT_RESTORE",
          studentId: auth.targetUserId,
          summary: `Memulihkan akun trading "${restored.accountName}" (${restored.id}).`,
        });
        return { ok: true, status: 200, data: { account: restored } };
      }

      const updated = await updateTradingAccount(auth.targetUserId, accountId, {
        ...(body.accountName !== undefined
          ? { accountName: sanitizeCurriculumText(body.accountName).trim() }
          : {}),
        ...(body.brokerLabel !== undefined
          ? { brokerLabel: sanitizeCurriculumText(body.brokerLabel).trim() }
          : {}),
        ...(body.accountType !== undefined
          ? { accountType: body.accountType as AccountType }
          : {}),
        ...(body.initialBalance !== undefined
          ? { initialBalance: Number(body.initialBalance) }
          : {}),
      });

      recordJournalAudit({
        actorId: auth.targetUserId,
        actorRole: actor?.role || "USER",
        action: "ACCOUNT_UPDATE",
        studentId: auth.targetUserId,
        summary: `Memperbarui akun trading "${updated.accountName}" (${updated.id}).`,
      });

      return { ok: true, status: 200, data: { account: updated } };
    }

    return { ok: false, status: 405, error: "Metode tidak didukung." };
  } catch (err) {
    return mapErrorToSafeResponse(err);
  }
}

// ── 2. Trade Journal CRUD Handler ──────────────────────────────────

export async function handleJournalTradesRequest(
  actor: DbUser | SafeUser | null | undefined,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  params: {
    queryUserId?: string | null;
    tradeId?: string | null;
    filters?: {
      accountId?: string;
      status?: TradeStatus;
      pair?: string;
      direction?: TradeDirection;
      outcome?: TradeOutcome;
      strategyId?: string;
      startDate?: string;
      endDate?: string;
    };
    body?: Record<string, unknown> | null;
  } = {}
): Promise<ApiHandlerResult> {
  try {
    if (method === "GET") {
      const auth = await authorizeJournalAccess(
        actor,
        params.queryUserId,
        "READ_FULL_JOURNAL"
      );
      if (!auth.allowed) {
        return { ok: false, status: auth.status, error: auth.error };
      }

      const trades = await getTrades(auth.targetUserId, params.filters);
      return {
        ok: true,
        status: 200,
        data: {
          trades,
          accessMode: auth.accessMode,
        },
      };
    }

    const body = params.body || {};
    const requestedUserId =
      typeof body.userId === "string" ? body.userId : params.queryUserId;
    const auth = await authorizeJournalAccess(
      actor,
      requestedUserId,
      "MUTATE_JOURNAL"
    );
    if (!auth.allowed) {
      return { ok: false, status: auth.status, error: auth.error };
    }

    if (method === "POST") {
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { ok: false, status: 400, error: "Payload trade tidak valid." };
      }

      const setupTags = Array.isArray(body.setupTags)
        ? body.setupTags
            .map((t) => sanitizeCurriculumText(t).trim())
            .filter(Boolean)
        : [];

      const created = await createTrade(auth.targetUserId, {
        accountId: String(body.accountId || "").trim(),
        pair: sanitizeCurriculumText(body.pair || "").trim(),
        direction: String(body.direction || "LONG") as "LONG" | "SHORT" | "BUY" | "SELL",
        status: (body.status as TradeStatus) || "OPEN",
        entryDate: String(body.entryDate || ""),
        exitDate: body.exitDate ? String(body.exitDate) : undefined,
        timeframe: (body.timeframe as TimeFrame) || "H1",
        session: (body.session as MarketSession) || "LONDON",
        entryPrice: Number(body.entryPrice),
        exitPrice: body.exitPrice !== undefined && body.exitPrice !== "" ? Number(body.exitPrice) : undefined,
        stopLoss: Number(body.stopLoss),
        takeProfit: body.takeProfit !== undefined && body.takeProfit !== "" ? Number(body.takeProfit) : undefined,
        positionSize: Number(body.positionSize),
        plannedRiskAmount:
          body.plannedRiskAmount !== undefined && body.plannedRiskAmount !== "" && body.plannedRiskAmount !== null
            ? Number(body.plannedRiskAmount)
            : undefined,
        grossPnl:
          body.grossPnl !== undefined && body.grossPnl !== "" && body.grossPnl !== null
            ? Number(body.grossPnl)
            : undefined,
        commission:
          body.commission !== undefined && body.commission !== "" ? Number(body.commission) : 0,
        swap: body.swap !== undefined && body.swap !== "" ? Number(body.swap) : 0,
        otherFees:
          body.otherFees !== undefined && body.otherFees !== "" ? Number(body.otherFees) : 0,
        strategyId: body.strategyId
          ? sanitizeCurriculumText(body.strategyId).trim()
          : undefined,
        setupTags,
        emotion: (body.emotion as EmotionState) || "NEUTRAL",
        mistake: (body.mistake as ExecutionMistake) || "NONE",
        marketCondition: body.marketCondition
          ? (String(body.marketCondition) as MarketCondition)
          : undefined,
        notes: body.notes !== undefined ? sanitizeCurriculumText(body.notes) : undefined,
      });

      recordJournalAudit({
        actorId: auth.targetUserId,
        actorRole: actor?.role || "USER",
        action: "TRADE_CREATE",
        studentId: auth.targetUserId,
        summary: `Mencatat trade ${created.pair} (${created.direction}, ${created.status}).`,
      });

      return {
        ok: true,
        status: 201,
        data: { trade: created },
      };
    }

    if (method === "PUT" || method === "PATCH") {
      const tradeId =
        typeof body.tradeId === "string"
          ? body.tradeId.trim()
          : params.tradeId?.trim() || "";
      if (!tradeId) {
        return { ok: false, status: 400, error: "tradeId wajib disertakan." };
      }

      const action =
        typeof body.action === "string" ? body.action.trim().toLowerCase() : "update";

      if (action === "close") {
        const closed = await closeTrade(auth.targetUserId, tradeId, {
          exitPrice: Number(body.exitPrice),
          exitDate: String(body.exitDate || ""),
          grossPnl: Number(body.grossPnl),
          commission:
            body.commission !== undefined ? Number(body.commission) : undefined,
          swap: body.swap !== undefined ? Number(body.swap) : undefined,
          otherFees:
            body.otherFees !== undefined ? Number(body.otherFees) : undefined,
          emotion: body.emotion as EmotionState | undefined,
          mistake: body.mistake as ExecutionMistake | undefined,
          notes:
            body.notes !== undefined
              ? sanitizeCurriculumText(body.notes)
              : undefined,
        });

        recordJournalAudit({
          actorId: auth.targetUserId,
          actorRole: actor?.role || "USER",
          action: "TRADE_CLOSE",
          studentId: auth.targetUserId,
          summary: `Menutup trade ${closed.pair} (${closed.id}) dengan Net P/L ${closed.netPnl}.`,
        });

        return { ok: true, status: 200, data: { trade: closed } };
      }

      if (action === "cancel") {
        const cancelled = await cancelTrade(auth.targetUserId, tradeId);
        recordJournalAudit({
          actorId: auth.targetUserId,
          actorRole: actor?.role || "USER",
          action: "TRADE_CANCEL",
          studentId: auth.targetUserId,
          summary: `Membatalkan trade ${cancelled.pair} (${cancelled.id}).`,
        });
        return { ok: true, status: 200, data: { trade: cancelled } };
      }

      const updated = await updateTrade(auth.targetUserId, tradeId, {
        ...(body.pair !== undefined
          ? { pair: sanitizeCurriculumText(body.pair).trim() }
          : {}),
        ...(body.direction !== undefined
          ? { direction: String(body.direction) as "LONG" | "SHORT" | "BUY" | "SELL" }
          : {}),
        ...(body.timeframe !== undefined
          ? { timeframe: body.timeframe as TimeFrame }
          : {}),
        ...(body.session !== undefined
          ? { session: body.session as MarketSession }
          : {}),
        ...(body.entryPrice !== undefined
          ? { entryPrice: Number(body.entryPrice) }
          : {}),
        ...(body.stopLoss !== undefined ? { stopLoss: Number(body.stopLoss) } : {}),
        ...(body.takeProfit !== undefined
          ? { takeProfit: body.takeProfit === null || body.takeProfit === "" ? undefined : Number(body.takeProfit) }
          : {}),
        ...(body.positionSize !== undefined
          ? { positionSize: Number(body.positionSize) }
          : {}),
        ...(body.plannedRiskAmount !== undefined
          ? {
              plannedRiskAmount:
                body.plannedRiskAmount === null || body.plannedRiskAmount === ""
                  ? undefined
                  : Number(body.plannedRiskAmount),
            }
          : {}),
        ...(body.grossPnl !== undefined ? { grossPnl: Number(body.grossPnl) } : {}),
        ...(body.commission !== undefined
          ? { commission: Number(body.commission) }
          : {}),
        ...(body.swap !== undefined ? { swap: Number(body.swap) } : {}),
        ...(body.otherFees !== undefined
          ? { otherFees: Number(body.otherFees) }
          : {}),
        ...(body.strategyId !== undefined
          ? { strategyId: sanitizeCurriculumText(body.strategyId).trim() }
          : {}),
        ...(Array.isArray(body.setupTags)
          ? {
              setupTags: body.setupTags
                .map((t) => sanitizeCurriculumText(t).trim())
                .filter(Boolean),
            }
          : {}),
        ...(body.emotion !== undefined
          ? { emotion: body.emotion as EmotionState }
          : {}),
        ...(body.mistake !== undefined
          ? { mistake: body.mistake as ExecutionMistake }
          : {}),
        ...(body.marketCondition !== undefined
          ? { marketCondition: body.marketCondition as MarketCondition }
          : {}),
        ...(body.notes !== undefined
          ? { notes: sanitizeCurriculumText(body.notes) }
          : {}),
      });

      recordJournalAudit({
        actorId: auth.targetUserId,
        actorRole: actor?.role || "USER",
        action: "TRADE_UPDATE",
        studentId: auth.targetUserId,
        summary: `Memperbarui trade ${updated.pair} (${updated.id}).`,
      });

      return { ok: true, status: 200, data: { trade: updated } };
    }

    if (method === "DELETE") {
      const tradeId =
        params.tradeId?.trim() ||
        (typeof body.tradeId === "string" ? body.tradeId.trim() : "");
      if (!tradeId) {
        return { ok: false, status: 400, error: "tradeId wajib disertakan untuk penghapusan." };
      }

      const deleted = await deleteTrade(auth.targetUserId, tradeId);
      recordJournalAudit({
        actorId: auth.targetUserId,
        actorRole: actor?.role || "USER",
        action: "TRADE_DELETE",
        studentId: auth.targetUserId,
        summary: `Menghapus trade (${tradeId}).`,
      });

      return { ok: true, status: 200, data: deleted };
    }

    return { ok: false, status: 405, error: "Metode tidak didukung." };
  } catch (err) {
    return mapErrorToSafeResponse(err);
  }
}

// ── 3. Cash Transactions Handler ───────────────────────────────────

export async function handleJournalCashRequest(
  actor: DbUser | SafeUser | null | undefined,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  params: {
    queryUserId?: string | null;
    accountId?: string | null;
    transactionId?: string | null;
    body?: Record<string, unknown> | null;
  } = {}
): Promise<ApiHandlerResult> {
  try {
    if (method === "GET") {
      const auth = await authorizeJournalAccess(
        actor,
        params.queryUserId,
        "READ_FULL_JOURNAL"
      );
      if (!auth.allowed) {
        return { ok: false, status: auth.status, error: auth.error };
      }

      const transactions = await getCashTransactions(auth.targetUserId, {
        accountId: params.accountId || undefined,
      });

      return {
        ok: true,
        status: 200,
        data: { transactions },
      };
    }

    const body = params.body || {};
    const requestedUserId =
      typeof body.userId === "string" ? body.userId : params.queryUserId;
    const auth = await authorizeJournalAccess(
      actor,
      requestedUserId,
      "MUTATE_JOURNAL"
    );
    if (!auth.allowed) {
      return { ok: false, status: auth.status, error: auth.error };
    }

    if (method === "POST") {
      const created = await createCashTransaction(auth.targetUserId, {
        accountId: String(body.accountId || "").trim(),
        type: String(body.type || "").toUpperCase() as "DEPOSIT" | "WITHDRAWAL",
        amount: Number(body.amount),
        transactionDate: body.transactionDate
          ? String(body.transactionDate)
          : undefined,
        notes: body.notes
          ? sanitizeCurriculumText(body.notes).trim()
          : undefined,
      });

      recordJournalAudit({
        actorId: auth.targetUserId,
        actorRole: actor?.role || "USER",
        action: "CASH_TRANSACTION_CREATE",
        studentId: auth.targetUserId,
        summary: `Mencatat transaksi kas ${created.type} sebesar ${created.amount} pada akun ${created.accountId}.`,
      });

      return { ok: true, status: 201, data: { transaction: created } };
    }

    if (method === "PUT" || method === "PATCH") {
      const transactionId =
        params.transactionId?.trim() ||
        (typeof body.transactionId === "string" ? body.transactionId.trim() : "");
      if (!transactionId) {
        return { ok: false, status: 400, error: "transactionId wajib disertakan." };
      }

      const updated = await updateCashTransaction(
        auth.targetUserId,
        transactionId,
        {
          ...(body.amount !== undefined ? { amount: Number(body.amount) } : {}),
          ...(body.transactionDate !== undefined
            ? { transactionDate: String(body.transactionDate) }
            : {}),
          ...(body.notes !== undefined
            ? { notes: sanitizeCurriculumText(body.notes).trim() }
            : {}),
        }
      );

      recordJournalAudit({
        actorId: auth.targetUserId,
        actorRole: actor?.role || "USER",
        action: "CASH_TRANSACTION_UPDATE",
        studentId: auth.targetUserId,
        summary: `Memperbarui transaksi kas (${transactionId}).`,
      });

      return { ok: true, status: 200, data: { transaction: updated } };
    }

    if (method === "DELETE") {
      const transactionId =
        params.transactionId?.trim() ||
        (typeof body.transactionId === "string" ? body.transactionId.trim() : "");
      if (!transactionId) {
        return { ok: false, status: 400, error: "transactionId wajib disertakan." };
      }

      const deleted = await deleteCashTransaction(
        auth.targetUserId,
        transactionId
      );

      recordJournalAudit({
        actorId: auth.targetUserId,
        actorRole: actor?.role || "USER",
        action: "CASH_TRANSACTION_DELETE",
        studentId: auth.targetUserId,
        summary: `Menghapus transaksi kas (${transactionId}).`,
      });

      return { ok: true, status: 200, data: deleted };
    }

    return { ok: false, status: 405, error: "Metode tidak didukung." };
  } catch (err) {
    return mapErrorToSafeResponse(err);
  }
}

// ── 4. Analytics Orchestration Handler ─────────────────────────────

export async function handleJournalAnalyticsRequest(
  actor: DbUser | SafeUser | null | undefined,
  params: {
    queryUserId?: string | null;
    filters?: AnalyticsFilterInput;
  } = {}
): Promise<ApiHandlerResult> {
  try {
    const auth = await authorizeJournalAccess(
      actor,
      params.queryUserId,
      "READ_ANALYTICS"
    );
    if (!auth.allowed) {
      return { ok: false, status: auth.status, error: auth.error };
    }

    const report = await getStudentAnalyticsReport(
      auth.targetUserId,
      params.filters || {}
    );

    if (report.status === "INVALID_TIMEZONE") {
      return {
        ok: false,
        status: 400,
        error: `Timezone IANA tidak valid: "${params.filters?.timeZone}".`,
      };
    }

    if (report.status === "ACCOUNT_NOT_FOUND") {
      return {
        ok: false,
        status: 404,
        error: "Akun trading yang diminta tidak ditemukan.",
      };
    }

    return {
      ok: true,
      status: 200,
      data: {
        report,
        analytics: report,
        accessMode: auth.accessMode,
        consentScope: auth.consentScope || null,
      },
    };
  } catch (err) {
    return mapErrorToSafeResponse(err);
  }
}

// ── 5. Privacy & Consent Management Handler ────────────────────────

export async function handleJournalConsentRequest(
  actor: DbUser | SafeUser | null | undefined,
  method: "GET" | "POST" | "DELETE" | "PATCH",
  params: {
    queryUserId?: string | null;
    body?: Record<string, unknown> | null;
  } = {}
): Promise<ApiHandlerResult> {
  try {
    const body = params.body || {};
    const requestedUserId =
      typeof body.userId === "string" ? body.userId : params.queryUserId;

    const auth = await authorizeJournalAccess(
      actor,
      requestedUserId,
      "MANAGE_CONSENT"
    );
    if (!auth.allowed) {
      return { ok: false, status: auth.status, error: auth.error };
    }

    if (method === "GET") {
      const partition = await readUserPartitionLocked(auth.targetUserId);
      const consent = partition.consent;
      const isActive = isConsentCurrentlyActive(consent);
      const auditLogs = getJournalAuditLogs(auth.targetUserId, 50);
      const db = getDatabase();
      const mentors = [
        {
          id: "ALL_ACADEMY_MENTORS",
          name: "Semua Mentor Resmi Casper Academy",
          email: "mentors@casper.academy",
          role: "MENTOR",
        },
        ...(db.users || [])
          .filter((u: DbUser) => u.role === "MENTOR")
          .map((u: DbUser) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
          })),
      ];

      return {
        ok: true,
        status: 200,
        data: {
          consent,
          consents: consent ? [consent] : [],
          isActive,
          auditLogs,
          mentors,
        },
      };
    }

    if (method === "POST") {
      const rawGrantee =
        typeof body.granteeId === "string"
          ? body.granteeId
          : typeof body.mentorId === "string"
            ? body.mentorId
            : "ALL_ACADEMY_MENTORS";
      const granted = await grantStudentConsent(actor, auth.targetUserId, {
        granteeId: sanitizeCurriculumText(rawGrantee).trim() || "ALL_ACADEMY_MENTORS",
        granteeName:
          typeof body.granteeName === "string"
            ? sanitizeCurriculumText(body.granteeName).trim()
            : undefined,
        scope: body.scope as ConsentScope,
        durationDays:
          body.durationDays !== undefined ? Number(body.durationDays) : 30,
      });

      return {
        ok: true,
        status: 201,
        data: {
          consent: granted,
          isActive: true,
        },
      };
    }

    if (method === "DELETE" || method === "PATCH") {
      const result = await revokeStudentConsent(actor, auth.targetUserId);
      return {
        ok: true,
        status: 200,
        data: {
          revoked: result.revoked,
          consent: result.consent,
          isActive: false,
        },
      };
    }

    return { ok: false, status: 405, error: "Metode tidak didukung." };
  } catch (err) {
    return mapErrorToSafeResponse(err);
  }
}

/**
 * Helper to parse AnalyticsFilterInput from URLSearchParams.
 */
export function parseAnalyticsFiltersFromSearchParams(
  searchParams: URLSearchParams
): AnalyticsFilterInput {
  return {
    accountId: searchParams.get("accountId") || undefined,
    currency: searchParams.get("currency") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    symbol: searchParams.get("symbol") || searchParams.get("pair") || undefined,
    direction: (searchParams.get("direction") as "LONG" | "SHORT" | "BUY" | "SELL") || undefined,
    session: (searchParams.get("session") as MarketSession) || undefined,
    dayOfWeek: (searchParams.get("dayOfWeek") as DayOfWeekKey) || undefined,
    setup: searchParams.get("setup") || undefined,
    strategyId: searchParams.get("strategyId") || undefined,
    timeframe: (searchParams.get("timeframe") as TimeFrame) || undefined,
    marketCondition: (searchParams.get("marketCondition") as MarketCondition) || undefined,
    timeZone: searchParams.get("timeZone") || undefined,
    granularity: (searchParams.get("granularity") as TimeSeriesGranularity) || undefined,
    includeEmptyPeriods: searchParams.get("includeEmptyPeriods") === "true",
    includeArchivedAccounts: searchParams.get("includeArchivedAccounts") === "true",
  };
}
