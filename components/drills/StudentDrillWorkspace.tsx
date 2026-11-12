"use client";

/**
 * SIGNAL CASPER ACADEMY — SPRINT 5
 * Student Practical Drill Workspace Component (Task 5.4)
 *
 * Integrates ScopedChartViewer with 16:9 container, interactive two-way level sync,
 * two-stance decision console (Take Trade vs No-Trade), realtime R:R calculator,
 * deterministic submission flow with idempotency, and comprehensive debrief view.
 */

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Crosshair,
  TrendingUp,
  MinusCircle,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Send,
  Eye,
  History,
  Info,
} from "lucide-react";
import ScopedChartViewer, { type ActivePlacementTool } from "./ScopedChartViewer";
import type {
  PublicDrillCase,
  StudentDrillAnswer,
  DbDrillSubmission,
  StudentDrillSummary,
} from "@/lib/drill-types";
import {
  priceToNormalizedY,
  type DrillLevels,
} from "@/lib/chart-coordinates";

export interface StudentDrillWorkspaceProps {
  drill: PublicDrillCase;
  initialSummary?: StudentDrillSummary | null;
  initialLatestSubmission?: DbDrillSubmission | null;
  initialHistory?: Array<{
    id: string;
    attemptNumber: number;
    score: number;
    invalidationScore: number;
    safetyGatePassed: boolean;
    evaluationStatus: string;
    createdAt: string;
  }>;
}

const COMMON_CONFIRMATIONS = [
  { id: "LIQUIDITY_SWEEP", label: "Liquidity Sweep (Pembersihan Likuiditas)" },
  { id: "M15_CHOC", label: "Change of Character (CHoCH / Shift Struktur)" },
  { id: "FVG_TAP", label: "Fair Value Gap (FVG Tap / Imbalance Rebalance)" },
  { id: "DISCOUNT_ZONE", label: "Premium / Discount Zone Equilibrium" },
  { id: "SUPPLY_DEMAND", label: "Institutional Order Block / Supply-Demand" },
];

const COMMON_NO_TRADE_REASONS = [
  { id: "LOW_RISK_REWARD", label: "Rasio Risk/Reward tidak memadai (< 1:2.0)" },
  { id: "MAJOR_NEWS_IMMINENT", label: "Rilis berita ekonomi berdampak tinggi (FOMC/CPI/NFP) mendekat" },
  { id: "CHOPPY_RANGE", label: "Pasar berada di tengah konsolidasi tanpa arah struktur dominan" },
  { id: "NO_LIQUIDITY_SWEEP", label: "Likuiditas utama belum diambil; rentan jebakan rekayasa institusional" },
];

export default function StudentDrillWorkspace({
  drill,
  initialSummary = null,
  initialLatestSubmission = null,
  initialHistory = [],
}: StudentDrillWorkspaceProps) {
  // ── Session & History States ───────────────────────────────────
  const [summary, setSummary] = useState<StudentDrillSummary | null>(initialSummary);
  const [history, setHistory] = useState(initialHistory);
  const [activeSubmission, setActiveSubmission] = useState<DbDrillSubmission | null>(
    initialLatestSubmission
  );

  // If latest submission exists and user hasn't explicitly clicked "Coba Lagi", show Debrief View
  const [viewMode, setViewMode] = useState<"CONSOLE" | "DEBRIEF">(
    initialLatestSubmission ? "DEBRIEF" : "CONSOLE"
  );

  // Generate stable idempotency key per attempt
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => {
    return `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  });

  // ── Decision Form State ─────────────────────────────────────────
  const [stance, setStance] = useState<"TRADE" | "NO_TRADE">("TRADE");
  const [bias, setBias] = useState<"BULLISH" | "BEARISH" | "SIDEWAYS_NEUTRAL">("BULLISH");
  const [noTradeReason, setNoTradeReason] = useState<string>("");

  // Prices
  const [entryPrice, setEntryPrice] = useState<number | "">("");
  const [invalidationPrice, setInvalidationPrice] = useState<number | "">("");
  const [targetPrice, setTargetPrice] = useState<number | "">("");

  // Confirmations & Rationale
  const [selectedConfirmations, setSelectedConfirmations] = useState<string[]>([]);
  const [rationaleText, setRationaleText] = useState<string>("");

  // Chart Viewer Active Tool
  const [activePlacementTool, setActivePlacementTool] = useState<ActivePlacementTool>("ENTRY");

  // Solution Overlay State
  const [showSolutionOverlay, setShowSolutionOverlay] = useState<boolean>(false);
  const [solutionData, setSolutionData] = useState<{
    solutionOverlayUrl?: string | null;
    instructorDebrief?: string;
  } | null>(null);
  const [loadingSolution, setLoadingSolution] = useState<boolean>(false);

  // Submission Status
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // ── Computed Levels for ScopedChartViewer ───────────────────────
  const levels: DrillLevels = useMemo(() => {
    // In debrief mode, show levels from evaluated submission
    if (viewMode === "DEBRIEF" && activeSubmission) {
      const a = activeSubmission.answers;
      if (a.isNoTrade) return {};
      return {
        entry:
          typeof a.entryPrice === "number"
            ? {
                normalizedY: priceToNormalizedY(a.entryPrice, drill.priceBounds),
                price: a.entryPrice,
              }
            : null,
        invalidation:
          typeof a.invalidationPrice === "number"
            ? {
                normalizedY: priceToNormalizedY(a.invalidationPrice, drill.priceBounds),
                price: a.invalidationPrice,
              }
            : null,
        target:
          typeof a.targetPrice === "number"
            ? {
                normalizedY: priceToNormalizedY(a.targetPrice, drill.priceBounds),
                price: a.targetPrice,
              }
            : null,
      };
    }

    if (stance === "NO_TRADE") return {};

    return {
      entry:
        typeof entryPrice === "number"
          ? {
              normalizedY: priceToNormalizedY(entryPrice, drill.priceBounds),
              price: entryPrice,
            }
          : null,
      invalidation:
        typeof invalidationPrice === "number"
          ? {
              normalizedY: priceToNormalizedY(invalidationPrice, drill.priceBounds),
              price: invalidationPrice,
            }
          : null,
      target:
        typeof targetPrice === "number"
          ? {
              normalizedY: priceToNormalizedY(targetPrice, drill.priceBounds),
              price: targetPrice,
            }
          : null,
    };
  }, [viewMode, activeSubmission, stance, entryPrice, invalidationPrice, targetPrice, drill.priceBounds]);

  // Handle level change emitted from chart drag
  const handleChartLevelsChange = useCallback((nextLevels: DrillLevels) => {
    if (nextLevels.entry && typeof nextLevels.entry.price === "number") {
      setEntryPrice(nextLevels.entry.price);
    }
    if (nextLevels.invalidation && typeof nextLevels.invalidation.price === "number") {
      setInvalidationPrice(nextLevels.invalidation.price);
    }
    if (nextLevels.target && typeof nextLevels.target.price === "number") {
      setTargetPrice(nextLevels.target.price);
    }
  }, []);

  // ── Realtime Risk/Reward Calculator ─────────────────────────────
  const liveRiskReward = useMemo<{
    ratio: number | null;
    status: "OPTIMAL" | "MARGINAL" | "INVALID";
    label: string;
  }>(() => {
    if (
      typeof entryPrice !== "number" ||
      typeof invalidationPrice !== "number" ||
      typeof targetPrice !== "number"
    ) {
      return { ratio: null, status: "INVALID", label: "Lengkapi Entry, SL, dan Target" };
    }

    const risk = Math.abs(entryPrice - invalidationPrice);
    const reward = Math.abs(targetPrice - entryPrice);

    if (risk === 0) {
      return { ratio: 0, status: "INVALID", label: "Jarak Risiko 0 (Entry = SL)" };
    }

    const rr = Math.round((reward / risk) * 100) / 100;
    if (rr >= (drill.passingScore ? 2.0 : 2.0)) {
      return { ratio: rr, status: "OPTIMAL", label: `1:${rr.toFixed(2)} — Standar Institusional (≥ 1:2.0)` };
    }
    if (rr >= 1.5) {
      return { ratio: rr, status: "MARGINAL", label: `1:${rr.toFixed(2)} — Marginal (Dapat diterima, di bawah 1:2.0)` };
    }
    return { ratio: rr, status: "INVALID", label: `1:${rr.toFixed(2)} — Risiko terlalu besar (di bawah 1:1.5)` };
  }, [entryPrice, invalidationPrice, targetPrice, drill.passingScore]);

  // ── Confirmation Checklist Toggle ───────────────────────────────
  const toggleConfirmation = (id: string) => {
    setSelectedConfirmations((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  // ── Submission Handler ──────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    // Validation
    if (stance === "TRADE") {
      if (entryPrice === "" || invalidationPrice === "" || targetPrice === "") {
        setSubmissionError("Level Entry, Stop-Loss, dan Target wajib diisi.");
        return;
      }
      if (bias === "BULLISH" && (invalidationPrice as number) >= (entryPrice as number)) {
        setSubmissionError("Untuk posisi Bullish/Long, Stop-Loss harus berada di BAWAH harga Entry.");
        return;
      }
      if (bias === "BEARISH" && (invalidationPrice as number) <= (entryPrice as number)) {
        setSubmissionError("Untuk posisi Bearish/Short, Stop-Loss harus berada di ATAS harga Entry.");
        return;
      }
      if (bias === "BULLISH" && (targetPrice as number) <= (entryPrice as number)) {
        setSubmissionError("Untuk posisi Bullish/Long, Target harus berada di ATAS harga Entry.");
        return;
      }
      if (bias === "BEARISH" && (targetPrice as number) >= (entryPrice as number)) {
        setSubmissionError("Untuk posisi Bearish/Short, Target harus berada di BAWAH harga Entry.");
        return;
      }
    } else {
      if (!noTradeReason && rationaleText.trim().length < 5) {
        setSubmissionError("Pilih minimal satu alasan NO-TRADE atau tuliskan narasi analisa proteksi modal.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: Partial<StudentDrillAnswer> & { idempotencyKey: string } = {
        idempotencyKey,
        bias,
        isNoTrade: stance === "NO_TRADE",
        noTradeReason: stance === "NO_TRADE" ? noTradeReason : undefined,
        entryPrice: stance === "TRADE" ? (entryPrice as number) : undefined,
        invalidationPrice: stance === "TRADE" ? (invalidationPrice as number) : undefined,
        targetPrice: stance === "TRADE" ? (targetPrice as number) : undefined,
        selectedConfirmations,
        rationaleText,
      };

      const res = await fetch(`/api/drills/${drill.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirimkan jawaban evaluasi.");
      }

      // Success
      setActiveSubmission(data.submission);
      setSummary(data.updatedSummary);
      setViewMode("DEBRIEF");

      // Update history list
      setHistory((prev) => [
        ...prev,
        {
          id: data.submission.id,
          attemptNumber: data.submission.attempt_number,
          score: data.submission.score,
          invalidationScore: data.submission.invalidation_score,
          safetyGatePassed: data.submission.safety_gate_passed,
          evaluationStatus: data.submission.evaluation_status,
          createdAt: data.submission.created_at,
        },
      ]);
    } catch (err: unknown) {
      console.error("[DRILL SUBMIT ERROR]", err);
      setSubmissionError((err as Error).message || "Terjadi kesalahan saat memproses jawaban.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Solution Overlay Fetcher ────────────────────────────────────
  const handleToggleSolution = async () => {
    if (showSolutionOverlay) {
      setShowSolutionOverlay(false);
      return;
    }

    if (solutionData) {
      setShowSolutionOverlay(true);
      return;
    }

    setLoadingSolution(true);
    try {
      const res = await fetch(`/api/drills/${drill.id}/solution`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat solusi.");
      }
      setSolutionData(data);
      setShowSolutionOverlay(true);
    } catch (err) {
      alert((err as Error).message || "Gagal memuat solusi instruktur.");
    } finally {
      setLoadingSolution(false);
    }
  };

  // Reset to fresh attempt
  const handleResetForNewAttempt = () => {
    setIdempotencyKey(`idemp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
    setViewMode("CONSOLE");
    setShowSolutionOverlay(false);
    setSubmissionError(null);
  };

  return (
    <div className="min-h-screen bg-[#090c10] text-[#eef2f5]">
      {/* ── Breadcrumb & Top Bar ──────────────────────────────────── */}
      <div className="border-b border-[#1c252d] bg-[#0c1116] px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 font-['DM_Mono'] text-[11px]">
          <Link
            href="/belajar"
            className="flex items-center gap-1.5 text-[#87939f] transition hover:text-[#41d9ef]"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>KEMBALI KE KATALOG DRILL</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[#41d9ef]">
              <Crosshair className="h-3.5 w-3.5" />
              {drill.instrument} · {drill.timeframe}
            </span>
            <span className="rounded border border-[#28323c] bg-[#10151b] px-2 py-0.5 text-[#87939f]">
              {drill.classification}
            </span>
            {summary && (
              <span className="rounded border border-[#53d9bf]/30 bg-[#53d9bf]/10 px-2 py-0.5 text-[#53d9bf]">
                PERCOBAAN KE-{summary.attemptsCount} (TERBAIK: {summary.bestScore}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Workspace Main Grid ────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        {/* Title & Context Prompt */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-['DM_Mono'] text-xs font-semibold text-[#41d9ef]">
              STUDI KASUS PRAKTIK #{drill.slug.toUpperCase()}
            </span>
            <span className="font-['DM_Mono'] text-xs text-[#6f7d88]">
              (Drill v{drill.drillVersion} · Rubrik v{drill.rubricVersion})
            </span>
          </div>
          <h1 className="mt-1 font-['Manrope'] text-2xl font-bold tracking-tight text-[#eef2f5] sm:text-3xl">
            {drill.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94a3b8]">
            {drill.contextPrompt}
          </p>
        </div>

        {/* 2-Column Responsive Container */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ── Left Column: Chart Area (7 of 12 cols = ~60%) ─────── */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            {/* Chart Container Locked to 16:9 Aspect Ratio to Eliminate Letterboxing */}
            <div className="aspect-[16/9] w-full overflow-hidden border border-[#28323c] bg-[#10151b] shadow-2xl">
              <ScopedChartViewer
                chartAssetUrl={drill.chartAssetUrl}
                priceBounds={drill.priceBounds}
                provenance={{
                  instrument: drill.instrument,
                  timeframe: drill.timeframe,
                  dataPeriod: drill.dataPeriod,
                  dataSource: drill.dataSource,
                  classification: drill.classification,
                }}
                levels={levels}
                onLevelsChange={handleChartLevelsChange}
                readOnly={viewMode === "DEBRIEF"}
                activePlacementTool={activePlacementTool}
                onActivePlacementToolChange={setActivePlacementTool}
                solutionOverlayUrl={solutionData?.solutionOverlayUrl}
                showSolutionOverlay={showSolutionOverlay}
                className="h-full w-full"
              />
            </div>

            {/* Scenario Instructions & Objectives Accordion */}
            <div className="border border-[#28323c] bg-[#10151b] p-4 text-xs text-[#87939f]">
              <div className="mb-2 flex items-center gap-2 font-['DM_Mono'] text-[10px] font-semibold uppercase text-[#41d9ef]">
                <Info className="h-3.5 w-3.5" />
                Instruksi Analisis Objektif
              </div>
              <ul className="list-inside list-disc space-y-1.5 leading-relaxed text-[#cbd5e1]">
                {drill.instructions.map((inst, idx) => (
                  <li key={idx}>{inst}</li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-[#1c252d] pt-2 font-['DM_Mono'] text-[10px] text-[#6f7d88]">
                <span>Batas Kelulusan: ≥ {drill.passingScore}%</span>
                <span className="text-amber-400">
                  Syarat Stop-Loss: ≥ {drill.safetyGateMin}/25 Poin (Safety Gate)
                </span>
              </div>
            </div>
          </div>

          {/* ── Right Column: Decision Console or Debrief (5 of 12 = ~40%) ── */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            {viewMode === "CONSOLE" ? (
              /* ── Form Console Mode ───────────────────────────────── */
              <div className="border border-[#28323c] bg-[#10151b] p-5">
                <div className="mb-4 flex items-center justify-between border-b border-[#1c252d] pb-3">
                  <h2 className="font-['Manrope'] text-sm font-bold uppercase tracking-wider text-[#eef2f5]">
                    Student Decision Console
                  </h2>
                  <span className="font-['DM_Mono'] text-[10px] text-[#6ce0b0]">
                    ● SIAP INPUT
                  </span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Stance Selector: Trade vs No-Trade */}
                  <div>
                    <label className="mb-2 block font-['DM_Mono'] text-[10px] uppercase text-[#6f7d88]">
                      1. Sikap Keputusan Eksekusi
                    </label>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup">
                      <button
                        type="button"
                        onClick={() => setStance("TRADE")}
                        className={`flex items-center justify-center gap-2 border py-2.5 font-['DM_Mono'] text-xs font-semibold transition ${
                          stance === "TRADE"
                            ? "border-[#41d9ef] bg-[#41d9ef]/15 text-[#41d9ef]"
                            : "border-[#28323c] bg-[#0c1116] text-[#87939f] hover:border-[#384857]"
                        }`}
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                        AMBIL POSISI
                      </button>
                      <button
                        type="button"
                        onClick={() => setStance("NO_TRADE")}
                        className={`flex items-center justify-center gap-2 border py-2.5 font-['DM_Mono'] text-xs font-semibold transition ${
                          stance === "NO_TRADE"
                            ? "border-amber-400 bg-amber-400/15 text-amber-300"
                            : "border-[#28323c] bg-[#0c1116] text-[#87939f] hover:border-[#384857]"
                        }`}
                      >
                        <MinusCircle className="h-3.5 w-3.5" />
                        DISIPLIN NO-TRADE
                      </button>
                    </div>
                  </div>

                  {/* Market Bias Selector */}
                  <div>
                    <label className="mb-2 block font-['DM_Mono'] text-[10px] uppercase text-[#6f7d88]">
                      2. Analisis Bias Arah Pasar (Order Flow)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setBias("BULLISH")}
                        className={`border py-2 text-center font-['DM_Mono'] text-xs font-semibold transition ${
                          bias === "BULLISH"
                            ? "border-[#53d9bf] bg-[#53d9bf]/15 text-[#53d9bf]"
                            : "border-[#28323c] bg-[#0c1116] text-[#87939f]"
                        }`}
                      >
                        BULLISH (LONG)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBias("BEARISH")}
                        className={`border py-2 text-center font-['DM_Mono'] text-xs font-semibold transition ${
                          bias === "BEARISH"
                            ? "border-[#f43f5e] bg-[#f43f5e]/15 text-[#f43f5e]"
                            : "border-[#28323c] bg-[#0c1116] text-[#87939f]"
                        }`}
                      >
                        BEARISH (SHORT)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBias("SIDEWAYS_NEUTRAL")}
                        className={`border py-2 text-center font-['DM_Mono'] text-xs font-semibold transition ${
                          bias === "SIDEWAYS_NEUTRAL"
                            ? "border-[#cbd5e1] bg-[#cbd5e1]/15 text-[#cbd5e1]"
                            : "border-[#28323c] bg-[#0c1116] text-[#87939f]"
                        }`}
                      >
                        SIDEWAYS
                      </button>
                    </div>
                  </div>

                  {/* Stance Branch A: Take Trade Inputs */}
                  {stance === "TRADE" ? (
                    <div className="space-y-4 rounded border border-[#1f2937] bg-[#090c10] p-4">
                      <span className="font-['DM_Mono'] text-[10px] uppercase text-[#41d9ef]">
                        3. Parameter Level Harga (Klik Chart atau Ketik)
                      </span>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {/* Entry */}
                        <div>
                          <label className="mb-1 block font-['DM_Mono'] text-[9px] text-[#41d9ef]">
                            ENTRY PRICE
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={entryPrice}
                            onChange={(e) =>
                              setEntryPrice(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            placeholder="0.00"
                            className="w-full border border-[#28323c] bg-[#10151b] px-2.5 py-1.5 font-['DM_Mono'] text-xs text-[#eef2f5] focus:border-[#41d9ef] focus:outline-none"
                          />
                        </div>

                        {/* Stop Loss */}
                        <div>
                          <label className="mb-1 block font-['DM_Mono'] text-[9px] text-[#f43f5e]">
                            STOP-LOSS (SL)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={invalidationPrice}
                            onChange={(e) =>
                              setInvalidationPrice(
                                e.target.value === "" ? "" : Number(e.target.value)
                              )
                            }
                            placeholder="0.00"
                            className="w-full border border-[#28323c] bg-[#10151b] px-2.5 py-1.5 font-['DM_Mono'] text-xs text-[#eef2f5] focus:border-[#f43f5e] focus:outline-none"
                          />
                        </div>

                        {/* Target */}
                        <div>
                          <label className="mb-1 block font-['DM_Mono'] text-[9px] text-[#53d9bf]">
                            TARGET (TP)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={targetPrice}
                            onChange={(e) =>
                              setTargetPrice(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            placeholder="0.00"
                            className="w-full border border-[#28323c] bg-[#10151b] px-2.5 py-1.5 font-['DM_Mono'] text-xs text-[#eef2f5] focus:border-[#53d9bf] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Live R:R Pill */}
                      <div className="flex items-center justify-between border-t border-[#1c252d] pt-2 font-['DM_Mono'] text-[10px]">
                        <span className="text-[#6f7d88]">Risk/Reward Ratio:</span>
                        <span
                          className={`font-bold ${
                            liveRiskReward.status === "OPTIMAL"
                              ? "text-[#53d9bf]"
                              : liveRiskReward.status === "MARGINAL"
                              ? "text-amber-400"
                              : "text-[#87939f]"
                          }`}
                        >
                          {liveRiskReward.label}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Stance Branch B: NO-TRADE Contextual Reasons */
                    <div className="space-y-3 rounded border border-amber-500/20 bg-amber-500/5 p-4">
                      <span className="font-['DM_Mono'] text-[10px] uppercase text-amber-300">
                        3. Landasan Struktural Keputusan Menahan Diri
                      </span>
                      <div className="space-y-2">
                        {COMMON_NO_TRADE_REASONS.map((reason) => (
                          <label
                            key={reason.id}
                            className="flex cursor-pointer items-start gap-2 text-xs text-[#cbd5e1]"
                          >
                            <input
                              type="radio"
                              name="noTradeReasonGroup"
                              checked={noTradeReason === reason.id}
                              onChange={() => setNoTradeReason(reason.id)}
                              className="mt-0.5"
                            />
                            <span>{reason.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Structural Confirmations Checklist */}
                  {stance === "TRADE" && (
                    <div>
                      <label className="mb-2 block font-['DM_Mono'] text-[10px] uppercase text-[#6f7d88]">
                        4. Konfirmasi Struktur Yang Teridentifikasi
                      </label>
                      <div className="space-y-1.5">
                        {COMMON_CONFIRMATIONS.map((conf) => (
                          <label
                            key={conf.id}
                            className="flex cursor-pointer items-center gap-2 rounded border border-[#1f2937] bg-[#0c1116] px-3 py-1.5 text-xs text-[#cbd5e1] hover:border-[#374151]"
                          >
                            <input
                              type="checkbox"
                              checked={selectedConfirmations.includes(conf.id)}
                              onChange={() => toggleConfirmation(conf.id)}
                              className="rounded border-[#28323c]"
                            />
                            <span>{conf.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rationale Thesis */}
                  <div>
                    <label className="mb-1 block font-['DM_Mono'] text-[10px] uppercase text-[#6f7d88]">
                      {stance === "TRADE"
                        ? "5. Narasi Analisis & Thesis Posisi"
                        : "4. Penjelasan Analisis Proteksi Modal"}
                    </label>
                    <textarea
                      rows={3}
                      value={rationaleText}
                      onChange={(e) => setRationaleText(e.target.value)}
                      placeholder="Jelaskan dasar pembacaan likuiditas, alasan penempatan stop-loss di balik swing structure, atau alasan menahan modal..."
                      className="w-full border border-[#28323c] bg-[#0c1116] p-2.5 text-xs text-[#eef2f5] focus:border-[#41d9ef] focus:outline-none"
                    />
                  </div>

                  {/* Error Callout */}
                  {submissionError && (
                    <div className="flex items-center gap-2 border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                      <span>{submissionError}</span>
                    </div>
                  )}

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 border border-[#41d9ef] bg-[#41d9ef] py-3 font-['DM_Mono'] text-xs font-bold text-[#061116] transition hover:bg-[#a3f1fa] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RotateCcw className="h-4 w-4 animate-spin" />
                        <span>MENGEVALUASI DI SERVER...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>KIRIM JAWABAN EVALUASI</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* ── Debrief Mode (After Submission) ─────────────────── */
              activeSubmission && (
                <div className="border border-[#28323c] bg-[#10151b] p-5">
                  {/* Status Banner */}
                  <div
                    className={`mb-5 border p-4 text-center ${
                      activeSubmission.evaluation_status === "PASSED"
                        ? "border-[#53d9bf]/40 bg-[#53d9bf]/10 text-[#53d9bf]"
                        : activeSubmission.evaluation_status === "FAILED_SAFETY_GATE"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                        : "border-[#f43f5e]/40 bg-[#f43f5e]/10 text-[#f43f5e]"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-center gap-1.5 font-['DM_Mono'] text-xs font-bold">
                      {activeSubmission.evaluation_status === "PASSED" ? (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          <span>EVALUASI PRAKTIK: LULUS</span>
                        </>
                      ) : activeSubmission.evaluation_status === "FAILED_SAFETY_GATE" ? (
                        <>
                          <AlertTriangle className="h-4 w-4" />
                          <span>BELUM LULUS: PELANGGARAN SAFETY GATE</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-4 w-4" />
                          <span>EVALUASI PRAKTIK: BELUM LULUS</span>
                        </>
                      )}
                    </div>
                    <div className="font-['Manrope'] text-3xl font-extrabold tracking-tight">
                      {activeSubmission.score}%
                    </div>
                    <p className="mt-1.5 text-xs text-[#cbd5e1]">
                      {activeSubmission.evaluation_status === "PASSED"
                        ? "Analisis struktur dan manajemen risiko memenuhi standar kelulusan institusional."
                        : activeSubmission.evaluation_status === "FAILED_SAFETY_GATE"
                        ? `Skor Stop-Loss Anda ${activeSubmission.invalidation_score}/25 (Syarat: ≥ 18/25). Posisi dengan stop-loss tidak aman digagalkan demi proteksi modal.`
                        : `Skor Anda di bawah ambang batas kelulusan (≥ ${drill.passingScore}%).`}
                    </p>
                  </div>

                  {/* 5 Criteria Breakdown Table */}
                  <div className="mb-5 space-y-2">
                    <span className="font-['DM_Mono'] text-[10px] uppercase text-[#6f7d88]">
                      Rincian Evaluasi 5 Kriteria Objektif
                    </span>
                    <div className="divide-y divide-[#1c252d] border border-[#1f2937]">
                      {activeSubmission.evaluation_breakdown.map((crit) => (
                        <div key={crit.criterionId} className="p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[#eef2f5]">
                              {crit.criterionName}
                            </span>
                            <span
                              className={`font-['DM_Mono'] font-bold ${
                                crit.status === "FULL_CREDIT"
                                  ? "text-[#53d9bf]"
                                  : crit.status === "PARTIAL_CREDIT"
                                  ? "text-amber-400"
                                  : "text-[#f43f5e]"
                              }`}
                            >
                              {crit.pointsEarned} / {crit.pointsPossible}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[#94a3b8]">
                            {crit.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instructor Debrief Text */}
                  {activeSubmission.debrief_text && (
                    <div className="mb-5 border-l-2 border-[#41d9ef] bg-[#0c1116] p-3 text-xs text-[#cbd5e1]">
                      <span className="mb-1 block font-['DM_Mono'] text-[10px] font-semibold text-[#41d9ef]">
                        CATATAN INSTRUKTUR:
                      </span>
                      <p className="leading-relaxed">{activeSubmission.debrief_text}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleToggleSolution}
                      disabled={loadingSolution}
                      className="flex w-full items-center justify-center gap-2 border border-[#53d9bf] bg-[#53d9bf]/10 py-2.5 font-['DM_Mono'] text-xs font-semibold text-[#53d9bf] transition hover:bg-[#53d9bf]/20"
                    >
                      <Eye className="h-4 w-4" />
                      <span>
                        {showSolutionOverlay
                          ? "Sembunyikan Solusi Instruktur"
                          : "Lihat Solusi & Anotasi Instruktur"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetForNewAttempt}
                      className="flex w-full items-center justify-center gap-2 border border-[#28323c] bg-[#090c10] py-2.5 font-['DM_Mono'] text-xs text-[#eef2f5] transition hover:border-[#41d9ef] hover:text-[#41d9ef]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Coba Lagi Studi Kasus</span>
                    </button>
                  </div>

                  {/* Prior History Accordion */}
                  {history.length > 1 && (
                    <div className="mt-5 border-t border-[#1c252d] pt-3">
                      <div className="flex items-center gap-1.5 font-['DM_Mono'] text-[10px] text-[#6f7d88]">
                        <History className="h-3.5 w-3.5" />
                        <span>RIWAYAT PERCOBAAN ({history.length} KALI)</span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {history.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-center justify-between border border-[#1f2937] bg-[#0c1116] px-2.5 py-1.5 font-['DM_Mono'] text-[10px]"
                          >
                            <span className="text-[#87939f]">#{h.attemptNumber}</span>
                            <span
                              className={
                                h.evaluationStatus === "PASSED"
                                  ? "text-[#53d9bf]"
                                  : "text-[#f43f5e]"
                              }
                            >
                              Skor: {h.score}% (SL: {h.invalidationScore}/25)
                            </span>
                            <span className="text-[#64748b]">
                              {new Date(h.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
