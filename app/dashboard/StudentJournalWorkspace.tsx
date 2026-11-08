"use client";

import React, { useState, useEffect, useCallback } from "react";
import type {
  TradingAccount,
  TradeRecord,
  CashTransaction,
  StudentConsent,
  JournalAuditRecord,
  AccountType,
  TradeDirection,
  TradeStatus,
  TimeFrame,
  MarketSession,
  EmotionState,
  ExecutionMistake,
  MarketCondition,
  ConsentScope,
} from "@/lib/journal-types";
import type {
  AnalyticsOrchestrationReport,
  SlicerDimension,
  TimeSeriesGranularity,
  DimensionalSliceResult,
  DrawdownCurvePoint,
  TimeSeriesPeriodBucket,
  DimensionalBucketMetrics,
} from "@/lib/analytics/analytics-types";
import type { AccountBalanceSummary } from "@/lib/journal-service";
import {
  Activity,
  Wallet,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  BarChart3,
  Layers,
  RefreshCw,
  Archive,
  RotateCcw,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  Filter,
} from "lucide-react";

interface AccountWithBalance extends TradingAccount {
  balanceSummary?: AccountBalanceSummary;
}

interface MentorCandidate {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface StudentJournalWorkspaceProps {
  currentUser: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
}

const DIMENSIONS_CONFIG: Array<{ key: SlicerDimension; label: string }> = [
  { key: "SESSION", label: "Sesi Pasar" },
  { key: "DAY_OF_WEEK", label: "Hari" },
  { key: "SYMBOL", label: "Simbol / Pair" },
  { key: "DIRECTION", label: "Arah (Long/Short)" },
  { key: "SETUP", label: "Setup Tag" },
  { key: "TIMEFRAME", label: "Timeframe" },
  { key: "MARKET_CONDITION", label: "Kondisi Pasar" },
  { key: "EMOTION", label: "Psikologi / Emosi" },
  { key: "MISTAKE", label: "Kesalahan Eksekusi" },
];

function selectDimensionSlice(
  report: AnalyticsOrchestrationReport | null,
  dim: SlicerDimension
): DimensionalSliceResult | null {
  if (!report?.dimensionalBreakdown) return null;
  const db = report.dimensionalBreakdown;
  switch (dim) {
    case "SESSION":
      return db.bySession;
    case "DAY_OF_WEEK":
      return db.byDayOfWeek;
    case "SYMBOL":
      return db.bySymbol;
    case "DIRECTION":
      return db.byDirection;
    case "SETUP":
      return db.bySetup;
    case "STRATEGY":
      return db.byStrategy;
    case "TIMEFRAME":
      return db.byTimeframe;
    case "MARKET_CONDITION":
      return db.byMarketCondition;
    case "EMOTION":
      return db.byEmotion;
    case "MISTAKE":
      return db.byMistake;
    default:
      return db.bySession;
  }
}

export default function StudentJournalWorkspace({
  currentUser,
}: StudentJournalWorkspaceProps) {
  const [subTab, setSubTab] = useState<
    "analytics" | "trades" | "accounts" | "consent"
  >("analytics");

  // Data States
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [showArchivedAccounts, setShowArchivedAccounts] = useState(false);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [analytics, setAnalytics] =
    useState<AnalyticsOrchestrationReport | null>(null);
  const [consents, setConsents] = useState<StudentConsent[]>([]);
  const [auditLogs, setAuditLogs] = useState<JournalAuditRecord[]>([]);
  const [mentors, setMentors] = useState<MentorCandidate[]>([]);

  // Mentor Target Student inspection (when logged in as MENTOR)
  const [targetStudentId, setTargetStudentId] = useState<string>("");

  // Analytics Filters
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterSymbol, setFilterSymbol] = useState<string>("");
  const [filterDirection, setFilterDirection] = useState<string>("ALL");
  const [filterSession, setFilterSession] = useState<string>("ALL");
  const [filterTimeframe, setFilterTimeframe] = useState<string>("ALL");
  const [timeZone, setTimeZone] = useState<string>("UTC");
  const [granularity, setGranularity] = useState<TimeSeriesGranularity>("DAILY");
  const [includeEmptyPeriods, setIncludeEmptyPeriods] = useState<boolean>(false);
  const [activeDimension, setActiveDimension] =
    useState<SlicerDimension>("SESSION");

  // UI Status
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Account Form State
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(
    null
  );
  const [accName, setAccName] = useState("");
  const [accBroker, setAccBroker] = useState("");
  const [accCurrency, setAccCurrency] = useState("USD");
  const [accType, setAccType] = useState<AccountType>("PROP_FIRM");
  const [accInitialBalance, setAccInitialBalance] = useState("10000");

  // Cash Form State
  const [cashType, setCashType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [cashAmount, setCashAmount] = useState("");
  const [cashDate, setCashDate] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [cashNotes, setCashNotes] = useState("");

  // Trade Form State
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<TradeRecord | null>(null);
  const [closingTrade, setClosingTrade] = useState<TradeRecord | null>(null);

  const [trPair, setTrPair] = useState("XAUUSD");
  const [trDirection, setTrDirection] = useState<TradeDirection>("LONG");
  const [trStatus, setTrStatus] = useState<TradeStatus>("CLOSED");
  const [trEntryDate, setTrEntryDate] = useState(() =>
    new Date(Date.now() - 3600_000).toISOString().slice(0, 16)
  );
  const [trExitDate, setTrExitDate] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [trTimeframe, setTrTimeframe] = useState<TimeFrame>("M15");
  const [trSession, setTrSession] = useState<MarketSession>("LONDON");
  const [trMarketCondition, setTrMarketCondition] =
    useState<MarketCondition>("TRENDING_BULL");
  const [trEntryPrice, setTrEntryPrice] = useState("2000");
  const [trExitPrice, setTrExitPrice] = useState("2015");
  const [trStopLoss, setTrStopLoss] = useState("1995");
  const [trTakeProfit, setTrTakeProfit] = useState("2015");
  const [trPositionSize, setTrPositionSize] = useState("1.0");
  const [trPlannedRisk, setTrPlannedRisk] = useState("100");
  const [trGrossPnl, setTrGrossPnl] = useState("300");
  const [trCommission, setTrCommission] = useState("5");
  const [trSwap, setTrSwap] = useState("0");
  const [trOtherFees, setTrOtherFees] = useState("0");
  const [trSetupTags, setTrSetupTags] = useState("OB, FVG");
  const [trEmotion, setTrEmotion] = useState<EmotionState>("DISCIPLINED");
  const [trMistake, setTrMistake] = useState<ExecutionMistake>("NONE");
  const [trNotes, setTrNotes] = useState("");

  // Consent Form State
  const [consentMentorId, setConsentMentorId] = useState("ALL_ACADEMY_MENTORS");
  const [consentScope, setConsentScope] =
    useState<ConsentScope>("ANALYTICS_ONLY");
  const [consentDays, setConsentDays] = useState("30");

  const effectiveStudentParam =
    targetStudentId.trim() && currentUser?.role === "MENTOR"
      ? `&userId=${encodeURIComponent(targetStudentId.trim())}`
      : "";

  const loadAccountsAndCore = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(
        `/api/journal/accounts?includeArchived=${showArchivedAccounts}${effectiveStudentParam}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err?.error) {
          setFeedback({ type: "error", text: err.error });
        }
        return;
      }
      const data = await res.json();
      const loadedAccounts: AccountWithBalance[] = data.accounts || [];
      setAccounts(loadedAccounts);

      const activeAccs = loadedAccounts.filter((a) => !a.isArchived);
      if (!selectedAccountId && activeAccs.length > 0) {
        setSelectedAccountId(activeAccs[0].id);
      } else if (
        selectedAccountId &&
        !loadedAccounts.some((a) => a.id === selectedAccountId)
      ) {
        setSelectedAccountId(activeAccs[0]?.id || "");
      }
    } catch {
      // Ignore network transient
    }
  }, [currentUser?.id, showArchivedAccounts, effectiveStudentParam, selectedAccountId]);

  const loadAnalytics = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccountId) params.set("accountId", selectedAccountId);
      if (filterStartDate)
        params.set("startDate", new Date(filterStartDate).toISOString());
      if (filterEndDate)
        params.set("endDate", new Date(filterEndDate).toISOString());
      if (filterSymbol.trim()) params.set("symbol", filterSymbol.trim());
      if (filterDirection !== "ALL") params.set("direction", filterDirection);
      if (filterSession !== "ALL") params.set("session", filterSession);
      if (filterTimeframe !== "ALL") params.set("timeframe", filterTimeframe);
      params.set("timeZone", timeZone);
      params.set("granularity", granularity);
      params.set("includeEmptyPeriods", String(includeEmptyPeriods));
      if (targetStudentId.trim() && currentUser?.role === "MENTOR") {
        params.set("userId", targetStudentId.trim());
      }

      const res = await fetch(`/api/journal/analytics?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Gagal memuat analitik performa.",
        });
        setAnalytics(null);
      } else {
        setAnalytics(data.report || data.analytics || null);
      }
    } catch {
      setFeedback({ type: "error", text: "Kesalahan jaringan saat memuat analitik." });
    } finally {
      setLoading(false);
    }
  }, [
    currentUser?.id,
    currentUser?.role,
    selectedAccountId,
    filterStartDate,
    filterEndDate,
    filterSymbol,
    filterDirection,
    filterSession,
    filterTimeframe,
    timeZone,
    granularity,
    includeEmptyPeriods,
    targetStudentId,
  ]);

  const loadTradesAndCash = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const tradeParams = new URLSearchParams();
      if (selectedAccountId) tradeParams.set("accountId", selectedAccountId);
      if (filterSymbol.trim()) tradeParams.set("pair", filterSymbol.trim());
      if (filterDirection !== "ALL") tradeParams.set("direction", filterDirection);
      if (targetStudentId.trim() && currentUser?.role === "MENTOR") {
        tradeParams.set("userId", targetStudentId.trim());
      }

      const [tradesRes, cashRes] = await Promise.all([
        fetch(`/api/journal/trades?${tradeParams.toString()}`),
        fetch(
          `/api/journal/cash?${
            selectedAccountId ? `accountId=${encodeURIComponent(selectedAccountId)}` : ""
          }${effectiveStudentParam}`
        ),
      ]);

      if (tradesRes.ok) {
        const tData = await tradesRes.json();
        setTrades(tData.trades || []);
      }
      if (cashRes.ok) {
        const cData = await cashRes.json();
        setCashTransactions(cData.transactions || []);
      }
    } catch {
      // Ignore
    }
  }, [
    currentUser?.id,
    currentUser?.role,
    selectedAccountId,
    filterSymbol,
    filterDirection,
    targetStudentId,
    effectiveStudentParam,
  ]);

  const loadConsentData = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch("/api/journal/consent");
      if (res.ok) {
        const data = await res.json();
        setConsents(data.consents || (data.consent ? [data.consent] : []));
        setAuditLogs(data.auditLogs || []);
        setMentors(data.mentors || []);
        if (!consentMentorId && data.mentors?.length > 0) {
          setConsentMentorId(data.mentors[0].id);
        }
      }
    } catch {
      // Ignore
    }
  }, [currentUser?.id, consentMentorId]);

  useEffect(() => {
    loadAccountsAndCore();
    loadConsentData();
  }, [loadAccountsAndCore, loadConsentData]);

  useEffect(() => {
    loadAnalytics();
    loadTradesAndCash();
  }, [loadAnalytics, loadTradesAndCash]);

  // ── Account Handlers ─────────────────────────────────────────────
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await fetch("/api/journal/accounts", {
        method: editingAccount ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingAccount
            ? {
                accountId: editingAccount.id,
                accountName: accName,
                brokerLabel: accBroker || undefined,
                accountType: accType,
              }
            : {
                accountName: accName,
                brokerLabel: accBroker || undefined,
                accountCurrency: accCurrency,
                accountType: accType,
                initialBalance: Number(accInitialBalance),
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan akun trading.");
      }
      setFeedback({
        type: "success",
        text: editingAccount
          ? `Akun "${accName}" berhasil diperbarui.`
          : `Akun "${accName}" berhasil dibuat.`,
      });
      setShowAccountForm(false);
      setEditingAccount(null);
      setAccName("");
      setAccBroker("");
      await loadAccountsAndCore();
      if (data.account?.id && !selectedAccountId) {
        setSelectedAccountId(data.account.id);
      }
      await loadAnalytics();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menyimpan akun.",
      });
    }
  };

  const handleToggleArchiveAccount = async (acc: AccountWithBalance) => {
    setFeedback(null);
    try {
      const res = await fetch("/api/journal/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: acc.id,
          action: acc.isArchived ? "restore" : "archive",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status arsip akun.");
      setFeedback({
        type: "success",
        text: acc.isArchived
          ? `Akun "${acc.accountName}" dipulihkan.`
          : `Akun "${acc.accountName}" diarsipkan.`,
      });
      await loadAccountsAndCore();
      await loadAnalytics();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal memproses akun.",
      });
    }
  };

  // ── Cash Handlers ────────────────────────────────────────────────
  const handleRecordCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      setFeedback({ type: "error", text: "Pilih akun trading terlebih dahulu." });
      return;
    }
    setFeedback(null);
    try {
      const res = await fetch("/api/journal/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          type: cashType,
          amount: Number(cashAmount),
          transactionDate: new Date(cashDate).toISOString(),
          notes: cashNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mencatat mutasi kas.");
      setFeedback({
        type: "success",
        text: `Transaksi ${cashType === "DEPOSIT" ? "Deposit" : "Withdrawal"} berhasil dicatat.`,
      });
      setCashAmount("");
      setCashNotes("");
      await loadAccountsAndCore();
      await loadTradesAndCash();
      await loadAnalytics();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mencatat mutasi kas.",
      });
    }
  };

  const handleDeleteCash = async (txId: string) => {
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/journal/cash?id=${encodeURIComponent(txId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus transaksi kas.");
      setFeedback({ type: "success", text: "Transaksi kas berhasil dihapus." });
      await loadAccountsAndCore();
      await loadTradesAndCash();
      await loadAnalytics();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menghapus transaksi kas.",
      });
    }
  };

  // ── Trade Handlers ───────────────────────────────────────────────
  const openCreateTradeModal = () => {
    setEditingTrade(null);
    setClosingTrade(null);
    setTrPair("XAUUSD");
    setTrDirection("LONG");
    setTrStatus("CLOSED");
    setTrEntryDate(new Date(Date.now() - 3600_000).toISOString().slice(0, 16));
    setTrExitDate(new Date().toISOString().slice(0, 16));
    setTrEntryPrice("2000");
    setTrExitPrice("2015");
    setTrStopLoss("1995");
    setTrTakeProfit("2015");
    setTrPositionSize("1.0");
    setTrPlannedRisk("100");
    setTrGrossPnl("300");
    setTrCommission("5");
    setTrSwap("0");
    setTrOtherFees("0");
    setTrSetupTags("OB, FVG");
    setTrEmotion("DISCIPLINED");
    setTrMistake("NONE");
    setTrMarketCondition("TRENDING_BULL");
    setTrNotes("");
    setShowTradeForm(true);
  };

  const openEditTradeModal = (trade: TradeRecord) => {
    setEditingTrade(trade);
    setClosingTrade(null);
    setTrPair(trade.pair);
    setTrDirection(trade.direction);
    setTrStatus(trade.status);
    setTrEntryDate(trade.entryDate.slice(0, 16));
    setTrExitDate(
      trade.exitDate
        ? trade.exitDate.slice(0, 16)
        : new Date().toISOString().slice(0, 16)
    );
    setTrTimeframe(trade.timeframe);
    setTrSession(trade.session);
    setTrMarketCondition(trade.marketCondition || "TRENDING_BULL");
    setTrEntryPrice(String(trade.entryPrice));
    setTrExitPrice(String(trade.exitPrice ?? trade.entryPrice));
    setTrStopLoss(trade.stopLoss !== undefined ? String(trade.stopLoss) : "");
    setTrTakeProfit(
      trade.takeProfit !== undefined ? String(trade.takeProfit) : ""
    );
    setTrPositionSize(String(trade.positionSize));
    setTrPlannedRisk(
      trade.plannedRiskAmount !== undefined
        ? String(trade.plannedRiskAmount)
        : ""
    );
    setTrGrossPnl(
      trade.grossPnl !== undefined ? String(trade.grossPnl) : "0"
    );
    setTrCommission(String(trade.commission ?? 0));
    setTrSwap(String(trade.swap ?? 0));
    setTrOtherFees(String(trade.otherFees ?? 0));
    setTrSetupTags(trade.setupTags.join(", "));
    setTrEmotion(trade.emotion || "NEUTRAL");
    setTrMistake(trade.mistake || "NONE");
    setTrNotes(trade.notes ?? "");
    setShowTradeForm(true);
  };

  const openCloseTradeModal = (trade: TradeRecord) => {
    setClosingTrade(trade);
    setEditingTrade(null);
    setTrExitDate(new Date().toISOString().slice(0, 16));
    setTrExitPrice(String(trade.entryPrice));
    setTrGrossPnl("100");
    setTrCommission(String(trade.commission || 0));
    setTrSwap(String(trade.swap || 0));
    setTrOtherFees(String(trade.otherFees || 0));
    setTrEmotion(trade.emotion || "DISCIPLINED");
    setTrMistake(trade.mistake || "NONE");
    setTrSetupTags(trade.setupTags.join(", "));
    setTrNotes(trade.notes ?? "");
    setShowTradeForm(true);
  };

  const handleSaveTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId && !editingTrade && !closingTrade) {
      setFeedback({ type: "error", text: "Pilih atau buat akun trading terlebih dahulu." });
      return;
    }
    setFeedback(null);
    const parsedTags = trSetupTags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (closingTrade) {
        const res = await fetch("/api/journal/trades", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "close",
            tradeId: closingTrade.id,
            exitPrice: Number(trExitPrice),
            exitDate: new Date(trExitDate).toISOString(),
            grossPnl: Number(trGrossPnl),
            commission: Number(trCommission || 0),
            swap: Number(trSwap || 0),
            otherFees: Number(trOtherFees || 0),
            emotion: trEmotion,
            mistake: trMistake,
            setupTags: parsedTags,
            notes: trNotes,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menutup trade.");
        setFeedback({
          type: "success",
          text: `Trade ${closingTrade.pair} berhasil ditutup (CLOSED).`,
        });
      } else if (editingTrade) {
        const res = await fetch("/api/journal/trades", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            tradeId: editingTrade.id,
            pair: trPair,
            direction: trDirection,
            status: trStatus,
            entryDate: new Date(trEntryDate).toISOString(),
            exitDate:
              trStatus === "CLOSED"
                ? new Date(trExitDate).toISOString()
                : undefined,
            timeframe: trTimeframe,
            session: trSession,
            marketCondition: trMarketCondition,
            entryPrice: Number(trEntryPrice),
            exitPrice: trStatus === "CLOSED" ? Number(trExitPrice) : undefined,
            stopLoss: trStopLoss ? Number(trStopLoss) : undefined,
            takeProfit: trTakeProfit ? Number(trTakeProfit) : null,
            positionSize: Number(trPositionSize),
            plannedRiskAmount: trPlannedRisk ? Number(trPlannedRisk) : null,
            grossPnl: trStatus === "CLOSED" ? Number(trGrossPnl) : undefined,
            commission: Number(trCommission || 0),
            swap: Number(trSwap || 0),
            otherFees: Number(trOtherFees || 0),
            setupTags: parsedTags,
            emotion: trEmotion,
            mistake: trMistake,
            notes: trNotes,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memperbarui trade.");
        setFeedback({
          type: "success",
          text: `Trade ${trPair} berhasil diperbarui.`,
        });
      } else {
        const res = await fetch("/api/journal/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: selectedAccountId,
            pair: trPair,
            direction: trDirection,
            status: trStatus,
            entryDate: new Date(trEntryDate).toISOString(),
            exitDate:
              trStatus === "CLOSED"
                ? new Date(trExitDate).toISOString()
                : undefined,
            timeframe: trTimeframe,
            session: trSession,
            marketCondition: trMarketCondition,
            entryPrice: Number(trEntryPrice),
            exitPrice: trStatus === "CLOSED" ? Number(trExitPrice) : undefined,
            stopLoss: Number(trStopLoss || trEntryPrice),
            takeProfit: trTakeProfit ? Number(trTakeProfit) : undefined,
            positionSize: Number(trPositionSize),
            plannedRiskAmount: trPlannedRisk ? Number(trPlannedRisk) : undefined,
            grossPnl: trStatus === "CLOSED" ? Number(trGrossPnl) : undefined,
            commission: Number(trCommission || 0),
            swap: Number(trSwap || 0),
            otherFees: Number(trOtherFees || 0),
            setupTags: parsedTags,
            emotion: trEmotion,
            mistake: trMistake,
            notes: trNotes,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal mencatat trade baru.");
        setFeedback({
          type: "success",
          text: `Trade ${trPair} (${trStatus}) berhasil dicatat ke jurnal.`,
        });
      }

      setShowTradeForm(false);
      setEditingTrade(null);
      setClosingTrade(null);
      await loadAccountsAndCore();
      await loadTradesAndCash();
      await loadAnalytics();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menyimpan trade.",
      });
    }
  };

  const handleDeleteTrade = async (tradeId: string, pair: string) => {
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/journal/trades?id=${encodeURIComponent(tradeId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus trade.");
      setFeedback({
        type: "success",
        text: `Trade ${pair} berhasil dihapus dari jurnal.`,
      });
      await loadAccountsAndCore();
      await loadTradesAndCash();
      await loadAnalytics();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menghapus trade.",
      });
    }
  };

  // ── Consent Handlers ─────────────────────────────────────────────
  const handleGrantConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentMentorId) {
      setFeedback({ type: "error", text: "Pilih mentor terlebih dahulu." });
      return;
    }
    setFeedback(null);
    try {
      const selectedMentor = mentors.find((m) => m.id === consentMentorId);
      const res = await fetch("/api/journal/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          granteeId: consentMentorId,
          granteeName: selectedMentor?.name || consentMentorId,
          scope: consentScope,
          durationDays: Number(consentDays) > 0 ? Number(consentDays) : 90,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memberikan izin akses mentor.");
      setFeedback({
        type: "success",
        text: `Izin akses (${consentScope}) berhasil diberikan kepada mentor.`,
      });
      await loadConsentData();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menyimpan consent.",
      });
    }
  };

  const handleRevokeConsent = async () => {
    setFeedback(null);
    try {
      const res = await fetch("/api/journal/consent", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mencabut izin mentor.");
      setFeedback({
        type: "success",
        text: "Izin akses mentor berhasil dicabut secara instan.",
      });
      await loadConsentData();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mencabut consent.",
      });
    }
  };

  const activeAccount = accounts.find((a) => a.id === selectedAccountId) || null;
  const activeCurrency =
    analytics?.currency || activeAccount?.accountCurrency || "USD";

  const formatMoney = (val: number | null | undefined, currency = activeCurrency) => {
    if (val === null || val === undefined || Number.isNaN(val)) return "—";
    const sign = val < 0 ? "-" : val > 0 ? "+" : "";
    const abs = Math.abs(val);
    return `${sign}${currency} ${abs.toLocaleString("en-US", {
      minimumFractionDigits: currency === "IDR" || currency === "JPY" ? 0 : 2,
      maximumFractionDigits: currency === "IDR" || currency === "JPY" ? 0 : 2,
    })}`;
  };

  const activeDimReport = selectDimensionSlice(analytics, activeDimension);
  const isMultiValuedDim = activeDimension === "SETUP";

  return (
    <div className="journal-workspace">
      {/* Top Sub-Navigation & Account Selector */}
      <div className="journal-topbar">
        <div className="journal-subtabs">
          <button
            type="button"
            className={`journal-subtab ${subTab === "analytics" ? "active" : ""}`}
            onClick={() => setSubTab("analytics")}
          >
            <BarChart3 size={15} /> Performance Analytics
          </button>
          <button
            type="button"
            className={`journal-subtab ${subTab === "trades" ? "active" : ""}`}
            onClick={() => setSubTab("trades")}
          >
            <Activity size={15} /> Jurnal Trade ({trades.length})
          </button>
          <button
            type="button"
            className={`journal-subtab ${subTab === "accounts" ? "active" : ""}`}
            onClick={() => setSubTab("accounts")}
          >
            <Wallet size={15} /> Akun &amp; Mutasi Kas ({accounts.length})
          </button>
          <button
            type="button"
            className={`journal-subtab ${subTab === "consent" ? "active" : ""}`}
            onClick={() => setSubTab("consent")}
          >
            <Lock size={15} /> Privasi &amp; Izin Mentor
          </button>
        </div>

        <div className="journal-account-bar">
          {currentUser?.role === "MENTOR" && (
            <div className="journal-mentor-inspect">
              <label htmlFor="mentor-student-id">Mode Mentor (Student ID):</label>
              <input
                id="mentor-student-id"
                type="text"
                value={targetStudentId}
                onChange={(e) => setTargetStudentId(e.target.value)}
                placeholder="Kosongkan untuk jurnal pribadi"
                className="journal-select"
                style={{ width: "190px" }}
              />
            </div>
          )}

          <label htmlFor="active-account-select" className="journal-bar-label">
            AKUN AKTIF:
          </label>
          <select
            id="active-account-select"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="journal-select"
          >
            {accounts.length === 0 && (
              <option value="">Belum Ada Akun Trading</option>
            )}
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.accountName} ({acc.accountType} · {acc.accountCurrency})
                {acc.isArchived ? " [ARSIP]" : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="journal-icon-btn"
            onClick={() => {
              loadAccountsAndCore();
              loadAnalytics();
              loadTradesAndCash();
            }}
            title="Sinkronkan ulang data"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`journal-feedback ${
            feedback.type === "error" ? "error" : "success"
          }`}
        >
          <span>
            {feedback.type === "error" ? (
              <AlertTriangle size={15} />
            ) : (
              <CheckCircle2 size={15} />
            )}
            {feedback.text}
          </span>
          <button type="button" onClick={() => setFeedback(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Empty Accounts Prompt */}
      {accounts.length === 0 && subTab !== "accounts" && subTab !== "consent" && (
        <div className="journal-empty-banner">
          <div>
            <span className="eyebrow">
              <span className="eyebrow-line" /> LANGKAH PERTAMA
            </span>
            <h3>Buat Akun Trading Pertama Anda</h3>
            <p>
              Sebelum mencatat trade atau melihat analitik kuantitatif, buat akun
              trading (Live, Demo, Prop Firm, atau Paper) dengan mata uang dasar
              dan modal awal (initialBalance).
            </p>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setSubTab("accounts");
              setShowAccountForm(true);
            }}
          >
            <Plus size={15} /> Buat Akun Trading
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-TAB 1: PERFORMANCE ANALYTICS DASHBOARD
      ═══════════════════════════════════════════════════════════════ */}
      {subTab === "analytics" && (
        <div className="journal-section-stack">
          {/* Filter Bar */}
          <div className="journal-filter-card">
            <div className="journal-filter-header">
              <span>
                <Filter size={13} /> FILTER KOHORT &amp; PARAMETER ANALITIK
              </span>
              <button
                type="button"
                className="journal-reset-btn"
                onClick={() => {
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setFilterSymbol("");
                  setFilterDirection("ALL");
                  setFilterSession("ALL");
                  setFilterTimeframe("ALL");
                  setTimeZone("UTC");
                  setGranularity("DAILY");
                  setIncludeEmptyPeriods(false);
                }}
              >
                Reset Filter
              </button>
            </div>

            <div className="journal-filter-grid">
              <div className="journal-field">
                <label>Dari Tanggal (Exit)</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="journal-input"
                />
              </div>
              <div className="journal-field">
                <label>Sampai Tanggal</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="journal-input"
                />
              </div>
              <div className="journal-field">
                <label>Simbol / Pair</label>
                <input
                  type="text"
                  placeholder="Cth: XAUUSD"
                  value={filterSymbol}
                  onChange={(e) => setFilterSymbol(e.target.value)}
                  className="journal-input"
                />
              </div>
              <div className="journal-field">
                <label>Arah</label>
                <select
                  value={filterDirection}
                  onChange={(e) => setFilterDirection(e.target.value)}
                  className="journal-input"
                >
                  <option value="ALL">Semua Arah</option>
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
              </div>
              <div className="journal-field">
                <label>Sesi Pasar</label>
                <select
                  value={filterSession}
                  onChange={(e) => setFilterSession(e.target.value)}
                  className="journal-input"
                >
                  <option value="ALL">Semua Sesi</option>
                  <option value="ASIA">ASIA</option>
                  <option value="LONDON">LONDON</option>
                  <option value="NEW_YORK">NEW YORK</option>
                  <option value="LONDON_NY_OVERLAP">LONDON-NY OVERLAP</option>
                </select>
              </div>
              <div className="journal-field">
                <label>Timeframe</label>
                <select
                  value={filterTimeframe}
                  onChange={(e) => setFilterTimeframe(e.target.value)}
                  className="journal-input"
                >
                  <option value="ALL">Semua TF</option>
                  <option value="M1">M1</option>
                  <option value="M5">M5</option>
                  <option value="M15">M15</option>
                  <option value="H1">H1</option>
                  <option value="H4">H4</option>
                  <option value="D1">D1</option>
                  <option value="W1">W1</option>
                </select>
              </div>
              <div className="journal-field">
                <label>Zona Waktu (IANA)</label>
                <select
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="journal-input"
                >
                  <option value="UTC">UTC (Default)</option>
                  <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                </select>
              </div>
            </div>
          </div>

          {analytics && (
            <>
              {/* Sample Confidence & Cohort Status Banner */}
              <div
                className={`journal-sample-banner ${analytics.sampleConfidence.status.toLowerCase()}`}
              >
                <div className="sample-banner-left">
                  <span className="sample-badge">
                    SAMPLE STATUS: {analytics.sampleConfidence.status}
                  </span>
                  <span>
                    Eligible Closed Trades:{" "}
                    <strong>{analytics.sampleConfidence.eligibleTradesCount}</strong> ·{" "}
                    {analytics.sampleConfidence.disclaimer}
                  </span>
                </div>
                <div className="sample-banner-right">
                  {analytics.status !== "VALID" && (
                    <span className="calc-status-pill">{analytics.status}</span>
                  )}
                  <button
                    type="button"
                    className="journal-btn-sm"
                    onClick={() => {
                      setSubTab("trades");
                      openCreateTradeModal();
                    }}
                  >
                    <Plus size={13} /> Catat Trade Baru
                  </button>
                </div>
              </div>

              {/* Core Metrics Grid (Task 3.2) */}
              <div className="journal-kpi-grid">
                <div className="journal-kpi-card">
                  <small>NET REALIZED P/L</small>
                  <strong
                    className={
                      (analytics.coreMetrics.totalNetPnl ?? 0) > 0
                        ? "pos"
                        : (analytics.coreMetrics.totalNetPnl ?? 0) < 0
                          ? "neg"
                          : ""
                    }
                  >
                    {formatMoney(analytics.coreMetrics.totalNetPnl)}
                  </strong>
                  <span>
                    Gross Profit: {formatMoney(analytics.coreMetrics.grossProfit)} ·
                    Loss: -{formatMoney(analytics.coreMetrics.grossLoss).replace("+", "")}
                  </span>
                </div>

                <div className="journal-kpi-card">
                  <small>WIN RATE (COMPREHENSIVE / DECISIVE)</small>
                  <strong>
                    {analytics.coreMetrics.winRates.winRateAll !== null
                      ? `${analytics.coreMetrics.winRates.winRateAll.toFixed(2)}%`
                      : "—"}
                  </strong>
                  <span>
                    W: {analytics.coreMetrics.winRates.winningTrades} · L:{" "}
                    {analytics.coreMetrics.winRates.losingTrades} · BE:{" "}
                    {analytics.coreMetrics.winRates.breakevenTrades} (Decisive:{" "}
                    {analytics.coreMetrics.winRates.winRateDecisive !== null
                      ? `${analytics.coreMetrics.winRates.winRateDecisive.toFixed(1)}%`
                      : "—"}
                    )
                  </span>
                </div>

                <div className="journal-kpi-card">
                  <small>PROFIT FACTOR &amp; PAYOFF RATIO</small>
                  <strong>
                    {analytics.coreMetrics.profitFactor.profitFactor !== null
                      ? analytics.coreMetrics.profitFactor.profitFactor.toFixed(2)
                      : analytics.coreMetrics.profitFactor.calculationStatus ===
                          "ZERO_LOSSES"
                        ? "∞ (Zero Loss)"
                        : "—"}
                  </strong>
                  <span>
                    Payoff Ratio:{" "}
                    {analytics.coreMetrics.avgWinLoss.winLossRatio !== null
                      ? `${analytics.coreMetrics.avgWinLoss.winLossRatio.toFixed(2)}x`
                      : "—"}
                  </span>
                </div>

                <div className="journal-kpi-card">
                  <small>EXPECTANCY PER TRADE</small>
                  <strong
                    className={
                      (analytics.coreMetrics.expectancy.expectancy ?? 0) > 0
                        ? "pos"
                        : (analytics.coreMetrics.expectancy.expectancy ?? 0) < 0
                          ? "neg"
                          : ""
                    }
                  >
                    {formatMoney(analytics.coreMetrics.expectancy.expectancy)}
                  </strong>
                  <span>
                    Rekonsiliasi Rasional BigInt:{" "}
                    {analytics.coreMetrics.expectancy.exactRationalReconciled
                      ? "TERVERIFIKASI ✓"
                      : "—"}
                  </span>
                </div>

                <div className="journal-kpi-card">
                  <small>RATA-RATA R-MULTIPLE</small>
                  <strong>
                    {analytics.coreMetrics.rMultiple.averageR !== null
                      ? `${analytics.coreMetrics.rMultiple.averageR.toFixed(2)}R`
                      : "—"}
                  </strong>
                  <span>
                    Valid R Coverage:{" "}
                    {analytics.coreMetrics.rMultiple.rEligibleTradesCount}/
                    {analytics.coreMetrics.rMultiple.totalTradesRecorded} Trades
                  </span>
                </div>

                <div className="journal-kpi-card">
                  <small>RATA-RATA WIN vs LOSS</small>
                  <strong>
                    {formatMoney(analytics.coreMetrics.avgWinLoss.averageWin)} /{" "}
                    {analytics.coreMetrics.avgWinLoss.signedAverageLoss !== null
                      ? formatMoney(analytics.coreMetrics.avgWinLoss.signedAverageLoss)
                      : "—"}
                  </strong>
                  <span>
                    Total Closed: {analytics.coreMetrics.totalClosedTrades} Trades
                  </span>
                </div>
              </div>

              {/* Drawdown Analytics Section (Task 3.3) */}
              <div className="journal-panel">
                <div className="journal-panel-header">
                  <div>
                    <span className="eyebrow">
                      <span className="eyebrow-line" /> TASK 3.3 · DRAWDOWN ENGINE
                    </span>
                    <h3>Drawdown &amp; High-Water Mark Equity</h3>
                  </div>
                  <div className="journal-badge-row">
                    <span
                      className={`journal-status-pill ${analytics.drawdown.calculationStatus.toLowerCase()}`}
                    >
                      DRAWDOWN STATUS: {analytics.drawdown.calculationStatus}
                    </span>
                    <span className="journal-status-pill">
                      STARTING CAPITAL:{" "}
                      {analytics.accountContext.initialBalance !== null
                        ? formatMoney(analytics.accountContext.initialBalance).replace(
                            "+",
                            ""
                          )
                        : "UNAVAILABLE"}
                    </span>
                  </div>
                </div>

                <div className="journal-dd-grid">
                  <div className="journal-dd-stat">
                    <small>MAX DRAWDOWN (NOMINAL)</small>
                    <strong className="neg">
                      {(analytics.drawdown.maxDrawdownNominal ?? 0) > 0
                        ? `-${formatMoney(analytics.drawdown.maxDrawdownNominal).replace("+", "")}`
                        : formatMoney(0)}
                    </strong>
                    <span>Peak-to-Trough Kerugian Maksimum</span>
                  </div>

                  <div className="journal-dd-stat">
                    <small>MAX DRAWDOWN (% UNCLIPPED)</small>
                    <strong className="neg">
                      {analytics.drawdown.maxDrawdownPercentage !== null
                        ? `-${analytics.drawdown.maxDrawdownPercentage.toFixed(2)}%`
                        : "N/A (No Base Capital)"}
                    </strong>
                    <span>
                      {analytics.drawdown.calculationStatus === "CAPITAL_DEPLETED"
                        ? "Melebihi 100% modal awal (Capital Depleted)"
                        : "Tanpa clipping artifisial 100%"}
                    </span>
                  </div>

                  <div className="journal-dd-stat">
                    <small>CURRENT DRAWDOWN</small>
                    <strong>
                      {(analytics.drawdown.currentDrawdownNominal ?? 0) > 0
                        ? `-${formatMoney(analytics.drawdown.currentDrawdownNominal).replace("+", "")}`
                        : "0.00 (At High-Water Mark)"}
                    </strong>
                    <span>
                      {analytics.drawdown.currentDrawdownPercentage !== null
                        ? `${analytics.drawdown.currentDrawdownPercentage.toFixed(2)}% dari Peak`
                        : "Status Terkini"}
                    </span>
                  </div>

                  <div className="journal-dd-stat">
                    <small>SIKLUS PEMULIHAN (RECOVERY)</small>
                    <strong>
                      {analytics.drawdown.maxDrawdownEpoch
                        ? analytics.drawdown.maxDrawdownEpoch.isRecovered
                          ? "PULIH (RECOVERED)"
                          : "BELUM PULIH (OPEN DD)"
                        : "TIDAK ADA DRAWDOWN"}
                    </strong>
                    <span>
                      Total Siklus DD: {analytics.drawdown.allEpochs.length}
                    </span>
                  </div>
                </div>

                {/* SVG Equity & High-Water Mark Curve */}
                {analytics.drawdown.curvePoints.length > 0 ? (
                  <div className="journal-chart-box">
                    <div className="journal-chart-caption">
                      <span>
                        KURVA REALIZED TRADING P/L KUMULATIF vs HIGH-WATER MARK (PEAK)
                      </span>
                      <span>
                        Titik Terakhir:{" "}
                        <strong>
                          {formatMoney(
                            analytics.drawdown.curvePoints[
                              analytics.drawdown.curvePoints.length - 1
                            ]?.cumulativeNetPnl ?? 0
                          )}
                        </strong>
                      </span>
                    </div>
                    {(() => {
                      const pts: DrawdownCurvePoint[] =
                        analytics.drawdown.curvePoints;
                      const values = [
                        0,
                        ...pts.map((p: DrawdownCurvePoint) => p.cumulativeNetPnl),
                        ...pts.map((p: DrawdownCurvePoint) => p.highWaterMark),
                      ];
                      const minVal = Math.min(...values, 0);
                      const maxVal = Math.max(...values, 1);
                      const span = Math.max(maxVal - minVal, 1);
                      const width = 760;
                      const height = 190;
                      const padX = 28;
                      const padY = 20;
                      const toX = (i: number) =>
                        padX +
                        (pts.length <= 1
                          ? (width - 2 * padX) / 2
                          : (i / (pts.length - 1)) * (width - 2 * padX));
                      const toY = (v: number) =>
                        height -
                        padY -
                        ((v - minVal) / span) * (height - 2 * padY);

                      const eqPath = pts
                        .map(
                          (p: DrawdownCurvePoint, i: number) =>
                            `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(
                              p.cumulativeNetPnl
                            ).toFixed(1)}`
                        )
                        .join(" ");
                      const peakPath = pts
                        .map(
                          (p: DrawdownCurvePoint, i: number) =>
                            `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(
                              p.highWaterMark
                            ).toFixed(1)}`
                        )
                        .join(" ");
                      const zeroY = toY(0);

                      return (
                        <svg
                          viewBox={`0 0 ${width} ${height}`}
                          className="journal-svg-chart"
                          role="img"
                          aria-label="Cumulative Realized P/L and High Water Mark Curve"
                        >
                          <line
                            x1={padX}
                            y1={zeroY}
                            x2={width - padX}
                            y2={zeroY}
                            stroke="#263442"
                            strokeDasharray="4 4"
                            strokeWidth="1"
                          />
                          <path
                            d={peakPath}
                            fill="none"
                            stroke="#6ce0b0"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                            opacity="0.7"
                          />
                          <path
                            d={eqPath}
                            fill="none"
                            stroke="#41d9ef"
                            strokeWidth="2.4"
                          />
                          {pts.map((p: DrawdownCurvePoint, idx: number) => (
                            <circle
                              key={p.tradeId}
                              cx={toX(idx)}
                              cy={toY(p.cumulativeNetPnl)}
                              r="3.5"
                              fill={
                                p.drawdownNominal > 0 ? "#f87171" : "#41d9ef"
                              }
                            />
                          ))}
                        </svg>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="journal-empty-inline">
                    Belum ada trade CLOSED untuk membentuk kurva ekuitas &amp; drawdown.
                  </div>
                )}
              </div>

              {/* Time-Series Analytics Section (Task 3.3) */}
              <div className="journal-panel">
                <div className="journal-panel-header">
                  <div>
                    <span className="eyebrow">
                      <span className="eyebrow-line" /> TASK 3.3 · TIME-SERIES ENGINE
                    </span>
                    <h3>Time-Series Performance ({analytics.timeSeries.timeZone})</h3>
                  </div>

                  <div className="journal-controls-inline">
                    <div className="journal-pill-group">
                      {(["DAILY", "WEEKLY", "MONTHLY"] as TimeSeriesGranularity[]).map(
                        (g) => (
                          <button
                            key={g}
                            type="button"
                            className={`journal-pill ${granularity === g ? "active" : ""}`}
                            onClick={() => setGranularity(g)}
                          >
                            {g === "DAILY"
                              ? "Harian"
                              : g === "WEEKLY"
                                ? "Mingguan (ISO-8601)"
                                : "Bulanan"}
                          </button>
                        )
                      )}
                    </div>

                    <label className="journal-checkbox-label">
                      <input
                        type="checkbox"
                        checked={includeEmptyPeriods}
                        onChange={(e) => setIncludeEmptyPeriods(e.target.checked)}
                      />
                      Dense Mode (Tampilkan Periode Kosong)
                    </label>
                  </div>
                </div>

                {/* Best & Worst Period Highlight */}
                {analytics.timeSeries.bestPeriod && analytics.timeSeries.worstPeriod && (
                  <div className="journal-best-worst-row">
                    <div className="journal-bw-card best">
                      <small>
                        <ArrowUpRight size={13} /> PERIODE TERBAIK (
                        {analytics.timeSeries.bestPeriod.periodKey})
                      </small>
                      <strong className="pos">
                        {formatMoney(analytics.timeSeries.bestPeriod.netPnl)}
                      </strong>
                      <span>
                        {analytics.timeSeries.bestPeriod.tradeCount} Trades · Win Rate:{" "}
                        {analytics.timeSeries.bestPeriod.winRate !== null
                          ? `${analytics.timeSeries.bestPeriod.winRate.toFixed(1)}%`
                          : "—"}
                      </span>
                    </div>

                    <div className="journal-bw-card worst">
                      <small>
                        <ArrowDownRight size={13} /> PERIODE TERBURUK (
                        {analytics.timeSeries.worstPeriod.periodKey})
                      </small>
                      <strong className="neg">
                        {formatMoney(analytics.timeSeries.worstPeriod.netPnl)}
                      </strong>
                      <span>
                        {analytics.timeSeries.worstPeriod.tradeCount} Trades · Win Rate:{" "}
                        {analytics.timeSeries.worstPeriod.winRate !== null
                          ? `${analytics.timeSeries.worstPeriod.winRate.toFixed(1)}%`
                          : "—"}
                      </span>
                    </div>
                  </div>
                )}

                {analytics.timeSeries.periods.length > 0 ? (
                  <div className="journal-table-wrap">
                    <table className="journal-table">
                      <thead>
                        <tr>
                          <th>Periode ({analytics.timeSeries.granularity})</th>
                          <th>Trades</th>
                          <th>W / L / BE</th>
                          <th>Win Rate</th>
                          <th>Gross Profit</th>
                          <th>Gross Loss</th>
                          <th>Expectancy</th>
                          <th>Net P/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.timeSeries.periods.map(
                          (pt: TimeSeriesPeriodBucket) => (
                            <tr key={pt.periodKey}>
                              <td>
                                <strong>{pt.periodKey}</strong>
                              </td>
                              <td>{pt.tradeCount}</td>
                              <td>
                                {pt.winningTrades} / {pt.losingTrades} /{" "}
                                {pt.breakEvenTrades}
                              </td>
                              <td>
                                {pt.winRate !== null
                                  ? `${pt.winRate.toFixed(1)}%`
                                  : "—"}
                              </td>
                              <td className="pos">
                                {formatMoney(pt.grossProfit).replace("+", "")}
                              </td>
                              <td className="neg">
                                {pt.grossLoss > 0
                                  ? `-${formatMoney(pt.grossLoss).replace("+", "")}`
                                  : formatMoney(0)}
                              </td>
                              <td>
                                {pt.expectancy !== null
                                  ? formatMoney(pt.expectancy)
                                  : "—"}
                              </td>
                              <td
                                className={
                                  pt.netPnl > 0
                                    ? "pos"
                                    : pt.netPnl < 0
                                      ? "neg"
                                      : ""
                                }
                              >
                                <strong>{formatMoney(pt.netPnl)}</strong>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="journal-empty-inline">
                    Tidak ada data periode untuk filter yang dipilih.
                  </div>
                )}
              </div>

              {/* Dimensional Slicer Breakdown Section (Task 3.4) */}
              <div className="journal-panel">
                <div className="journal-panel-header">
                  <div>
                    <span className="eyebrow">
                      <span className="eyebrow-line" /> TASK 3.4 · DIMENSIONAL SLICER ENGINE
                    </span>
                    <h3>Dimensional Performance Breakdown</h3>
                  </div>
                  <span className="journal-subnote">
                    {isMultiValuedDim
                      ? "Multi-Tag Mode: Sum of bucket counts dapat melebihi total trade unik."
                      : "Single-Value Partition: Sum of bucket counts = Total Eligible Trades."}
                  </span>
                </div>

                <div className="journal-dim-tabs">
                  {DIMENSIONS_CONFIG.map((dim) => (
                    <button
                      key={dim.key}
                      type="button"
                      className={`journal-dim-tab ${
                        activeDimension === dim.key ? "active" : ""
                      }`}
                      onClick={() => setActiveDimension(dim.key)}
                    >
                      <Layers size={12} /> {dim.label}
                    </button>
                  ))}
                </div>

                {activeDimReport && activeDimReport.buckets.length > 0 ? (
                  <div className="journal-table-wrap">
                    <table className="journal-table">
                      <thead>
                        <tr>
                          <th>Bucket ({activeDimension})</th>
                          <th>Trades</th>
                          <th>Sample Confidence</th>
                          <th>Win Rate</th>
                          <th>Profit Factor</th>
                          <th>Expectancy</th>
                          <th>Avg R</th>
                          <th>Net P/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDimReport.buckets.map(
                          (b: DimensionalBucketMetrics) => (
                            <tr key={b.bucketKey}>
                              <td>
                                <strong>{b.bucketLabel}</strong>
                              </td>
                              <td>{b.totalTrades}</td>
                              <td>
                                <span
                                  className={`sample-pill ${b.sampleStatus.toLowerCase()}`}
                                >
                                  {b.sampleStatus}
                                </span>
                              </td>
                              <td>
                                {b.winRate !== null
                                  ? `${b.winRate.toFixed(1)}%`
                                  : "—"}
                              </td>
                              <td>
                                {b.profitFactor !== null
                                  ? b.profitFactor.toFixed(2)
                                  : b.calculationStatus === "ZERO_LOSSES"
                                    ? "∞"
                                    : "—"}
                              </td>
                              <td
                                className={
                                  (b.expectancy ?? 0) > 0
                                    ? "pos"
                                    : (b.expectancy ?? 0) < 0
                                      ? "neg"
                                      : ""
                                }
                              >
                                {formatMoney(b.expectancy)}
                              </td>
                              <td>
                                {b.averageR !== null
                                  ? `${b.averageR.toFixed(2)}R`
                                  : "—"}
                              </td>
                              <td
                                className={
                                  (b.totalNetPnl ?? 0) > 0
                                    ? "pos"
                                    : (b.totalNetPnl ?? 0) < 0
                                      ? "neg"
                                      : ""
                                }
                              >
                                <strong>{formatMoney(b.totalNetPnl)}</strong>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="journal-empty-inline">
                    Belum ada distribusi bucket pada dimensi ini.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-TAB 2: TRADING JOURNAL (CREATE, EDIT, CLOSE, DELETE TRADES)
      ═══════════════════════════════════════════════════════════════ */}
      {subTab === "trades" && (
        <div className="journal-section-stack">
          <div className="journal-panel">
            <div className="journal-panel-header">
              <div>
                <span className="eyebrow">
                  <span className="eyebrow-line" /> EXECUTION LOG &amp; TRADE LEDGER
                </span>
                <h3>Riwayat &amp; Pencatatan Trade</h3>
              </div>
              <button
                type="button"
                className="button button-primary"
                onClick={openCreateTradeModal}
              >
                <Plus size={15} /> Catat Trade Baru
              </button>
            </div>

            {showTradeForm && (
              <form onSubmit={handleSaveTrade} className="journal-form-box">
                <div className="journal-form-header">
                  <h4>
                    {closingTrade
                      ? `Tutup Trade OPEN: ${closingTrade.pair} (${closingTrade.direction})`
                      : editingTrade
                        ? `Edit Trade: ${editingTrade.pair}`
                        : "Catat Eksekusi Trade Baru"}
                  </h4>
                  <button
                    type="button"
                    className="journal-icon-btn"
                    onClick={() => {
                      setShowTradeForm(false);
                      setEditingTrade(null);
                      setClosingTrade(null);
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>

                {!closingTrade && (
                  <div className="journal-form-grid">
                    <div className="journal-field">
                      <label>Simbol / Pair *</label>
                      <input
                        type="text"
                        required
                        value={trPair}
                        onChange={(e) => setTrPair(e.target.value.toUpperCase())}
                        placeholder="XAUUSD / EURUSD"
                        className="journal-input"
                      />
                    </div>
                    <div className="journal-field">
                      <label>Arah Posisi *</label>
                      <select
                        value={trDirection}
                        onChange={(e) =>
                          setTrDirection(e.target.value as TradeDirection)
                        }
                        className="journal-input"
                      >
                        <option value="LONG">LONG (Buy)</option>
                        <option value="SHORT">SHORT (Sell)</option>
                      </select>
                    </div>
                    <div className="journal-field">
                      <label>Status Trade *</label>
                      <select
                        value={trStatus}
                        onChange={(e) => setTrStatus(e.target.value as TradeStatus)}
                        className="journal-input"
                      >
                        <option value="CLOSED">CLOSED (Sudah Selesai)</option>
                        <option value="OPEN">OPEN (Masih Berjalan)</option>
                      </select>
                    </div>
                    <div className="journal-field">
                      <label>Timeframe *</label>
                      <select
                        value={trTimeframe}
                        onChange={(e) => setTrTimeframe(e.target.value as TimeFrame)}
                        className="journal-input"
                      >
                        <option value="M1">M1</option>
                        <option value="M5">M5</option>
                        <option value="M15">M15</option>
                        <option value="H1">H1</option>
                        <option value="H4">H4</option>
                        <option value="D1">D1</option>
                        <option value="W1">W1</option>
                      </select>
                    </div>
                    <div className="journal-field">
                      <label>Sesi Pasar *</label>
                      <select
                        value={trSession}
                        onChange={(e) =>
                          setTrSession(e.target.value as MarketSession)
                        }
                        className="journal-input"
                      >
                        <option value="ASIA">ASIA</option>
                        <option value="LONDON">LONDON</option>
                        <option value="NEW_YORK">NEW YORK</option>
                        <option value="LONDON_NY_OVERLAP">LONDON-NY OVERLAP</option>
                      </select>
                    </div>
                    <div className="journal-field">
                      <label>Kondisi Pasar</label>
                      <select
                        value={trMarketCondition}
                        onChange={(e) =>
                          setTrMarketCondition(e.target.value as MarketCondition)
                        }
                        className="journal-input"
                      >
                        <option value="TRENDING_BULL">TRENDING BULL</option>
                        <option value="TRENDING_BEAR">TRENDING BEAR</option>
                        <option value="RANGING">RANGING</option>
                        <option value="HIGH_VOLATILITY">HIGH VOLATILITY</option>
                        <option value="LOW_LIQUIDITY">LOW LIQUIDITY</option>
                        <option value="NEWS_DRIVEN">NEWS DRIVEN</option>
                      </select>
                    </div>
                    <div className="journal-field">
                      <label>Waktu Entry *</label>
                      <input
                        type="datetime-local"
                        required
                        value={trEntryDate}
                        onChange={(e) => setTrEntryDate(e.target.value)}
                        className="journal-input"
                      />
                    </div>
                    <div className="journal-field">
                      <label>Harga Entry *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={trEntryPrice}
                        onChange={(e) => setTrEntryPrice(e.target.value)}
                        className="journal-input"
                      />
                    </div>
                    <div className="journal-field">
                      <label>Stop Loss *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={trStopLoss}
                        onChange={(e) => setTrStopLoss(e.target.value)}
                        className="journal-input"
                      />
                    </div>
                    <div className="journal-field">
                      <label>Take Profit (Opsional)</label>
                      <input
                        type="number"
                        step="any"
                        value={trTakeProfit}
                        onChange={(e) => setTrTakeProfit(e.target.value)}
                        className="journal-input"
                      />
                    </div>
                    <div className="journal-field">
                      <label>Ukuran Lot / Position Size *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={trPositionSize}
                        onChange={(e) => setTrPositionSize(e.target.value)}
                        className="journal-input"
                      />
                    </div>
                    <div className="journal-field">
                      <label>Risiko Terencana / 1R ({activeCurrency})</label>
                      <input
                        type="number"
                        step="any"
                        value={trPlannedRisk}
                        onChange={(e) => setTrPlannedRisk(e.target.value)}
                        placeholder="Cth: 100"
                        className="journal-input"
                      />
                    </div>
                  </div>
                )}

                {(closingTrade || trStatus === "CLOSED") && (
                  <div className="journal-form-grid" style={{ marginTop: "14px" }}>
                    <div className="journal-field">
                      <label>Waktu Exit *</label>
                      <input
                        type="datetime-local"
                        required
                        value={trExitDate}
                        onChange={(e) => setTrExitDate(e.target.value)}
                        className="journal-input"
                      />
                    </div>
                    <div className="journal-field">
                      <label>Harga Exit *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={trExitPrice}
                        onChange={(e) => setTrExitPrice(e.target.value)}
                        className="journal-input"
                      />
                    </div>
                    <div className="journal-field">
                      <label>Gross P/L ({activeCurrency}) *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={trGrossPnl}
                        onChange={(e) => setTrGrossPnl(e.target.value)}
                        className="journal-input"
                      />
                    </div>
                    <div className="journal-field">
                      <label>Komisi ({activeCurrency})</label>
                      <input
                        type="number"
                        step="any"
                        value={trCommission}
                        onChange={(e) => setTrCommission(e.target.value)}
                        className="journal-input"
                      />
                    </div>
                    <div className="journal-field">
                      <label>Biaya Swap ({activeCurrency})</label>
                      <input
                        type="number"
                        step="any"
                        value={trSwap}
                        onChange={(e) => setTrSwap(e.target.value)}
                        className="journal-input"
                      />
                    </div>
                    <div className="journal-field">
                      <label>Biaya Lain ({activeCurrency})</label>
                      <input
                        type="number"
                        step="any"
                        value={trOtherFees}
                        onChange={(e) => setTrOtherFees(e.target.value)}
                        className="journal-input"
                      />
                    </div>
                  </div>
                )}

                <div className="journal-form-grid" style={{ marginTop: "14px" }}>
                  <div className="journal-field">
                    <label>Setup Tags (Pisahkan dengan koma)</label>
                    <input
                      type="text"
                      value={trSetupTags}
                      onChange={(e) => setTrSetupTags(e.target.value)}
                      placeholder="OB, FVG, Liquidity Sweep"
                      className="journal-input"
                    />
                  </div>
                  <div className="journal-field">
                    <label>Kondisi Psikologi / Emosi</label>
                    <select
                      value={trEmotion}
                      onChange={(e) => setTrEmotion(e.target.value as EmotionState)}
                      className="journal-input"
                    >
                      <option value="DISCIPLINED">DISCIPLINED</option>
                      <option value="CONFIDENT">CONFIDENT</option>
                      <option value="NEUTRAL">NEUTRAL</option>
                      <option value="ANXIOUS">ANXIOUS</option>
                      <option value="FOMO">FOMO</option>
                      <option value="REVENGE">REVENGE</option>
                      <option value="TIRED">TIRED</option>
                    </select>
                  </div>
                  <div className="journal-field">
                    <label>Evaluasi Kesalahan Eksekusi</label>
                    <select
                      value={trMistake}
                      onChange={(e) =>
                        setTrMistake(e.target.value as ExecutionMistake)
                      }
                      className="journal-input"
                    >
                      <option value="NONE">NONE (Sesuai Plan)</option>
                      <option value="FOMO_ENTRY">FOMO ENTRY</option>
                      <option value="CHASING">CHASING PRICE</option>
                      <option value="OVERLEVERAGING">OVERLEVERAGING</option>
                      <option value="EARLY_EXIT">EARLY EXIT</option>
                      <option value="WIDENING_SL">WIDENING STOP LOSS</option>
                      <option value="NO_PLAN">NO TRADING PLAN</option>
                      <option value="REVENGE_TRADING">REVENGE TRADING</option>
                    </select>
                  </div>
                </div>

                <div className="journal-field" style={{ marginTop: "12px" }}>
                  <label>Catatan &amp; Evaluasi Trade</label>
                  <textarea
                    value={trNotes}
                    onChange={(e) => setTrNotes(e.target.value)}
                    placeholder="Tulis alasan entry, konfirmasi struktur, dan evaluasi pasca-eksekusi..."
                    className="journal-textarea"
                  />
                </div>

                <div className="journal-form-actions">
                  <button
                    type="button"
                    className="journal-btn-secondary"
                    onClick={() => {
                      setShowTradeForm(false);
                      setEditingTrade(null);
                      setClosingTrade(null);
                    }}
                  >
                    Batal
                  </button>
                  <button type="submit" className="button button-primary">
                    <Check size={15} />{" "}
                    {closingTrade
                      ? "Konfirmasi Tutup Trade"
                      : editingTrade
                        ? "Simpan Perubahan"
                        : "Simpan ke Jurnal"}
                  </button>
                </div>
              </form>
            )}

            {/* Trades Table */}
            {trades.length > 0 ? (
              <div className="journal-table-wrap">
                <table className="journal-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Pair &amp; Arah</th>
                      <th>Status</th>
                      <th>Sesi / TF</th>
                      <th>Entry → Exit</th>
                      <th>Setup &amp; Psikologi</th>
                      <th>Net P/L (R)</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <div>
                            {new Date(t.exitDate || t.entryDate).toLocaleDateString(
                              "id-ID"
                            )}
                          </div>
                          <small style={{ color: "#6e8091" }}>
                            {new Date(t.exitDate || t.entryDate).toLocaleTimeString(
                              "id-ID",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </small>
                        </td>
                        <td>
                          <strong>{t.pair}</strong>{" "}
                          <span
                            className={`dir-badge ${
                              t.direction === "LONG" ? "long" : "short"
                            }`}
                          >
                            {t.direction}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${t.status.toLowerCase()}`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td>
                          {t.session} · <code>{t.timeframe}</code>
                        </td>
                        <td>
                          {t.entryPrice} {t.exitPrice !== undefined ? `→ ${t.exitPrice}` : ""}
                        </td>
                        <td>
                          <div style={{ fontSize: "11px" }}>
                            {t.setupTags.length > 0
                              ? t.setupTags.join(", ")
                              : "Tanpa Tag"}
                          </div>
                          <small style={{ color: "#7f91a2" }}>
                            {t.emotion || "—"} ·{" "}
                            {t.mistake && t.mistake !== "NONE" ? (
                              <span style={{ color: "#fca5a5" }}>{t.mistake}</span>
                            ) : (
                              "Disiplin"
                            )}
                          </small>
                        </td>
                        <td
                          className={
                            (t.netPnl ?? 0) > 0
                              ? "pos"
                              : (t.netPnl ?? 0) < 0
                                ? "neg"
                                : ""
                          }
                        >
                          {t.status === "CLOSED" ? (
                            <>
                              <strong>{formatMoney(t.netPnl)}</strong>
                              {t.realizedR !== undefined && (
                                <div style={{ fontSize: "10px" }}>
                                  ({t.realizedR.toFixed(2)}R)
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>OPEN</span>
                          )}
                        </td>
                        <td>
                          <div className="journal-row-actions">
                            {t.status === "OPEN" && (
                              <button
                                type="button"
                                className="journal-btn-sm"
                                onClick={() => openCloseTradeModal(t)}
                                title="Tutup Trade (Close)"
                              >
                                Tutup
                              </button>
                            )}
                            <button
                              type="button"
                              className="journal-icon-btn"
                              onClick={() => openEditTradeModal(t)}
                              title="Edit Trade"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              className="journal-icon-btn danger"
                              onClick={() => handleDeleteTrade(t.id, t.pair)}
                              title="Hapus Trade"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="journal-empty-inline">
                Belum ada trade tercatat pada akun/filter ini. Klik &ldquo;Catat Trade
                Baru&rdquo; untuk memulai.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-TAB 3: TRADING ACCOUNTS & CASH TRANSACTIONS
      ═══════════════════════════════════════════════════════════════ */}
      {subTab === "accounts" && (
        <div className="journal-section-stack">
          <div className="journal-panel">
            <div className="journal-panel-header">
              <div>
                <span className="eyebrow">
                  <span className="eyebrow-line" /> MULTI-ACCOUNT LEDGER
                </span>
                <h3>Manajemen Akun Trading</h3>
              </div>

              <div className="journal-controls-inline">
                <label className="journal-checkbox-label">
                  <input
                    type="checkbox"
                    checked={showArchivedAccounts}
                    onChange={(e) => setShowArchivedAccounts(e.target.checked)}
                  />
                  Tampilkan Akun Diarsipkan
                </label>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setEditingAccount(null);
                    setAccName("");
                    setAccBroker("");
                    setAccCurrency("USD");
                    setAccType("PROP_FIRM");
                    setAccInitialBalance("10000");
                    setShowAccountForm(true);
                  }}
                >
                  <Plus size={15} /> Tambah Akun Baru
                </button>
              </div>
            </div>

            {showAccountForm && (
              <form onSubmit={handleSaveAccount} className="journal-form-box">
                <div className="journal-form-header">
                  <h4>
                    {editingAccount
                      ? `Edit Akun: ${editingAccount.accountName}`
                      : "Buat Akun Trading Baru"}
                  </h4>
                  <button
                    type="button"
                    className="journal-icon-btn"
                    onClick={() => {
                      setShowAccountForm(false);
                      setEditingAccount(null);
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="journal-form-grid">
                  <div className="journal-field">
                    <label>Nama Akun Trading *</label>
                    <input
                      type="text"
                      required
                      value={accName}
                      onChange={(e) => setAccName(e.target.value)}
                      placeholder="Cth: FTMO $100K Phase 1"
                      className="journal-input"
                    />
                  </div>
                  <div className="journal-field">
                    <label>Broker / Platform</label>
                    <input
                      type="text"
                      value={accBroker}
                      onChange={(e) => setAccBroker(e.target.value)}
                      placeholder="Cth: IC Markets / MT5"
                      className="journal-input"
                    />
                  </div>
                  <div className="journal-field">
                    <label>Tipe Akun *</label>
                    <select
                      value={accType}
                      onChange={(e) => setAccType(e.target.value as AccountType)}
                      className="journal-input"
                    >
                      <option value="PROP_FIRM">PROP FIRM</option>
                      <option value="LIVE">LIVE</option>
                      <option value="DEMO">DEMO</option>
                      <option value="PAPER">PAPER</option>
                    </select>
                  </div>
                  {!editingAccount && (
                    <>
                      <div className="journal-field">
                        <label>Mata Uang Dasar (ISO 4217) *</label>
                        <select
                          value={accCurrency}
                          onChange={(e) => setAccCurrency(e.target.value)}
                          className="journal-input"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="IDR">IDR (Rp)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                          <option value="JPY">JPY (¥)</option>
                          <option value="AUD">AUD (A$)</option>
                          <option value="SGD">SGD (S$)</option>
                        </select>
                      </div>
                      <div className="journal-field">
                        <label>Modal Awal / Initial Balance *</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          value={accInitialBalance}
                          onChange={(e) => setAccInitialBalance(e.target.value)}
                          className="journal-input"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="journal-form-actions">
                  <button
                    type="button"
                    className="journal-btn-secondary"
                    onClick={() => {
                      setShowAccountForm(false);
                      setEditingAccount(null);
                    }}
                  >
                    Batal
                  </button>
                  <button type="submit" className="button button-primary">
                    <Check size={15} /> Simpan Akun
                  </button>
                </div>
              </form>
            )}

            <div className="journal-accounts-grid">
              {accounts.map((acc) => {
                const bs = acc.balanceSummary;
                const isSelected = acc.id === selectedAccountId;
                return (
                  <div
                    key={acc.id}
                    className={`journal-account-card ${isSelected ? "selected" : ""} ${
                      acc.isArchived ? "archived" : ""
                    }`}
                  >
                    <div className="acc-card-top">
                      <div>
                        <span className="acc-type-tag">
                          {acc.accountType} · {acc.accountCurrency}
                        </span>
                        <h4>{acc.accountName}</h4>
                        <small>{acc.brokerLabel || "Broker Standar"}</small>
                      </div>
                      <div className="journal-row-actions">
                        <button
                          type="button"
                          className="journal-icon-btn"
                          onClick={() => {
                            setEditingAccount(acc);
                            setAccName(acc.accountName);
                            setAccBroker(acc.brokerLabel || "");
                            setAccType(acc.accountType);
                            setShowAccountForm(true);
                          }}
                          title="Edit Akun"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          className="journal-icon-btn"
                          onClick={() => handleToggleArchiveAccount(acc)}
                          title={acc.isArchived ? "Pulihkan Akun" : "Arsipkan Akun"}
                        >
                          {acc.isArchived ? (
                            <RotateCcw size={13} />
                          ) : (
                            <Archive size={13} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="acc-metrics-list">
                      <div>
                        <span>Initial Balance:</span>
                        <strong>
                          {formatMoney(
                            bs?.initialBalance ?? acc.initialBalance,
                            acc.accountCurrency
                          ).replace("+", "")}
                        </strong>
                      </div>
                      <div>
                        <span>Cash Balance (Initial + Dep - Wd):</span>
                        <strong>
                          {formatMoney(
                            bs?.cashBalance ?? acc.initialBalance,
                            acc.accountCurrency
                          ).replace("+", "")}
                        </strong>
                      </div>
                      <div>
                        <span>Realized Trading P/L:</span>
                        <strong
                          className={
                            (bs?.realizedPnl ?? 0) > 0
                              ? "pos"
                              : (bs?.realizedPnl ?? 0) < 0
                                ? "neg"
                                : ""
                          }
                        >
                          {formatMoney(bs?.realizedPnl ?? 0, acc.accountCurrency)}
                        </strong>
                      </div>
                      <div className="acc-total-row">
                        <span>Realized Balance Akhir:</span>
                        <strong>
                          {formatMoney(
                            bs?.realizedBalance ?? acc.realizedBalance,
                            acc.accountCurrency
                          ).replace("+", "")}
                        </strong>
                      </div>
                      <div>
                        <span>Posisi OPEN Saat Ini:</span>
                        <strong>{bs?.openTradesCount ?? 0} Trade</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`journal-select-acc-btn ${
                        isSelected ? "active" : ""
                      }`}
                      onClick={() => setSelectedAccountId(acc.id)}
                    >
                      {isSelected ? "✓ Akun Sedang Aktif" : "Pilih Sebagai Akun Aktif"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cash Transactions Panel */}
          <div className="journal-panel">
            <div className="journal-panel-header">
              <div>
                <span className="eyebrow">
                  <span className="eyebrow-line" /> CASH FLOW SEPARATION
                </span>
                <h3>Mutasi Kas (Deposit &amp; Withdrawal)</h3>
              </div>
              <span className="journal-subnote">
                Deposit dan Withdrawal mengubah Cash Balance akun, tetapi tidak
                memanipulasi kurva performa trading P/L.
              </span>
            </div>

            <form onSubmit={handleRecordCash} className="journal-cash-form">
              <div className="journal-field">
                <label>Jenis Transaksi</label>
                <select
                  value={cashType}
                  onChange={(e) =>
                    setCashType(e.target.value as "DEPOSIT" | "WITHDRAWAL")
                  }
                  className="journal-input"
                >
                  <option value="DEPOSIT">DEPOSIT (Tambah Modal)</option>
                  <option value="WITHDRAWAL">WITHDRAWAL (Tarik Dana)</option>
                </select>
              </div>
              <div className="journal-field">
                <label>Nominal ({activeCurrency}) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="Cth: 2500"
                  className="journal-input"
                />
              </div>
              <div className="journal-field">
                <label>Tanggal Transaksi *</label>
                <input
                  type="datetime-local"
                  required
                  value={cashDate}
                  onChange={(e) => setCashDate(e.target.value)}
                  className="journal-input"
                />
              </div>
              <div className="journal-field">
                <label>Catatan</label>
                <input
                  type="text"
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  placeholder="Top-up margin / Payout"
                  className="journal-input"
                />
              </div>
              <button type="submit" className="button button-primary">
                <Plus size={14} /> Catat Kas
              </button>
            </form>

            {cashTransactions.length > 0 ? (
              <div className="journal-table-wrap">
                <table className="journal-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Tipe</th>
                      <th>Nominal</th>
                      <th>Catatan</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          {new Date(tx.transactionDate).toLocaleString("id-ID")}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${
                              tx.type === "DEPOSIT" ? "closed" : "cancelled"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className={tx.type === "DEPOSIT" ? "pos" : "neg"}>
                          <strong>
                            {tx.type === "DEPOSIT" ? "+" : "-"}
                            {formatMoney(tx.amount, activeCurrency).replace("+", "")}
                          </strong>
                        </td>
                        <td>{tx.notes || "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="journal-icon-btn danger"
                            onClick={() => handleDeleteCash(tx.id)}
                            title="Hapus Transaksi Kas"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="journal-empty-inline">
                Belum ada mutasi deposit/withdrawal pada akun ini.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-TAB 4: PRIVACY, MENTOR CONSENT & AUDIT TRAIL (TASK 3.6)
      ═══════════════════════════════════════════════════════════════ */}
      {subTab === "consent" && (
        <div className="journal-section-stack">
          <div className="journal-panel">
            <div className="journal-panel-header">
              <div>
                <span className="eyebrow">
                  <span className="eyebrow-line" /> TASK 3.6 · ZERO-TRUST PRIVACY ARCHITECTURE
                </span>
                <h3>Privasi Jurnal &amp; Otorisasi Mentor</h3>
              </div>
              <span className="journal-status-pill available">
                <ShieldCheck size={13} /> DEFAULT: PRIVATE (HANYA PEMILIK)
              </span>
            </div>

            <div className="journal-privacy-explainer">
              <p>
                <strong>Perlindungan Privasi Ketat:</strong> Secara default, seluruh
                catatan trade, nominal P/L, ukuran lot, dan kurva ekuitas Anda
                bersifat privat. Bahkan akun <code>ADMIN</code> atau{" "}
                <code>MASTER_ADMIN</code> tidak dapat membuka isi jurnal maupun
                nominal P/L pribadi Anda tanpa otorisasi. Anda dapat memberikan izin
                opsional kepada <strong>Mentor</strong> dengan cakupan terbatas (
                <code>ANALYTICS_ONLY</code> atau <code>FULL_JOURNAL</code>) dan
                mencabutnya kapan saja secara instan.
              </p>
            </div>

            <form onSubmit={handleGrantConsent} className="journal-cash-form">
              <div className="journal-field">
                <label>Pilih Mentor / Instruktur *</label>
                <select
                  value={consentMentorId}
                  onChange={(e) => setConsentMentorId(e.target.value)}
                  className="journal-input"
                >
                  {mentors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="journal-field">
                <label>Cakupan Izin (Scope) *</label>
                <select
                  value={consentScope}
                  onChange={(e) => setConsentScope(e.target.value as ConsentScope)}
                  className="journal-input"
                >
                  <option value="ANALYTICS_ONLY">
                    ANALYTICS_ONLY (Hanya Metrik &amp; Grafik, Tanpa Catatan Trade)
                  </option>
                  <option value="FULL_JOURNAL">
                    FULL_JOURNAL (Metrik + Riwayat Trade Lengkap)
                  </option>
                </select>
              </div>

              <div className="journal-field">
                <label>Durasi Berlaku (Maks 90 Hari)</label>
                <select
                  value={consentDays}
                  onChange={(e) => setConsentDays(e.target.value)}
                  className="journal-input"
                >
                  <option value="7">7 Hari</option>
                  <option value="30">30 Hari</option>
                  <option value="90">90 Hari</option>
                </select>
              </div>

              <button
                type="submit"
                className="button button-primary"
                disabled={mentors.length === 0}
              >
                <ShieldCheck size={14} /> Berikan Izin Mentor
              </button>
            </form>

            {consents.length > 0 ? (
              <div className="journal-table-wrap">
                <table className="journal-table">
                  <thead>
                    <tr>
                      <th>Mentor Penerima Izin</th>
                      <th>Scope</th>
                      <th>Status</th>
                      <th>Diberikan Pada</th>
                      <th>Kedaluwarsa</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consents.map((c) => {
                      const isRevoked = Boolean(c.isRevoked || c.revokedAt);
                      return (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.granteeName || c.granteeId}</strong>
                          </td>
                          <td>
                            <code>{c.scope}</code>
                          </td>
                          <td>
                            <span
                              className={`status-badge ${
                                isRevoked ? "cancelled" : "closed"
                              }`}
                            >
                              {isRevoked ? "DICABUT (REVOKED)" : "AKTIF"}
                            </span>
                          </td>
                          <td>{new Date(c.grantedAt).toLocaleString("id-ID")}</td>
                          <td>
                            {c.expiresAt
                              ? new Date(c.expiresAt).toLocaleDateString("id-ID")
                              : "Sampai Dicabut"}
                          </td>
                          <td>
                            {!isRevoked && (
                              <button
                                type="button"
                                className="journal-btn-sm danger"
                                onClick={handleRevokeConsent}
                              >
                                Cabut Izin Instan
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="journal-empty-inline">
                Tidak ada mentor yang memiliki akses ke jurnal Anda saat ini.
              </div>
            )}
          </div>

          {/* Access Audit Trail */}
          <div className="journal-panel">
            <div className="journal-panel-header">
              <div>
                <span className="eyebrow">
                  <span className="eyebrow-line" /> SECURITY AUDIT TRAIL
                </span>
                <h3>Log Audit Akses &amp; Perubahan Izin</h3>
              </div>
            </div>

            {auditLogs.length > 0 ? (
              <div className="journal-table-wrap">
                <table className="journal-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Aksi</th>
                      <th>Actor Role</th>
                      <th>Ringkasan Keamanan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.slice(0, 25).map((log) => (
                      <tr key={log.id}>
                        <td>{new Date(log.timestamp).toLocaleString("id-ID")}</td>
                        <td>
                          <code>{log.action}</code>
                        </td>
                        <td>{log.actorRole}</td>
                        <td>{log.summary || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="journal-empty-inline">
                Belum ada riwayat aktivitas consent atau akses pihak ketiga.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
