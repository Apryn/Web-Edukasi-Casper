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
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* ── Breadcrumb & Top Bar ──────────────────────────────────── */}
      <div className="drill-topbar">
        <div className="drill-topbar-inner">
          <Link
            href="/belajar"
            className="drill-back-link"
          >
            <ChevronLeft style={{ width: 16, height: 16 }} />
            <span>KEMBALI KE KATALOG DRILL</span>
          </Link>

          <div className="drill-meta-pills">
            <span className="drill-badge-inst">
              <Crosshair style={{ width: 14, height: 14 }} />
              {drill.instrument} · {drill.timeframe}
            </span>
            <span className="drill-badge-tag">
              {drill.classification}
            </span>
            {summary && (
              <span className="drill-badge-attempts">
                PERCOBAAN KE-{summary.attemptsCount} (TERBAIK: {summary.bestScore}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Workspace Main Grid ────────────────────────────────────── */}
      <main className="drill-page-wrap">
        {/* Title & Context Prompt */}
        <div className="drill-header">
          <div>
            <span className="drill-header-tag">
              STUDI KASUS PRAKTIK #{drill.slug.toUpperCase()}
            </span>
            <span className="drill-header-version">
              (Drill v{drill.drillVersion} · Rubrik v{drill.rubricVersion})
            </span>
          </div>
          <h1 className="drill-title">
            {drill.title}
          </h1>
          <p className="drill-desc">
            {drill.contextPrompt}
          </p>
        </div>

        {/* 2-Column Responsive Container */}
        <div className="drill-workspace-grid">
          {/* ── Left Column: Chart Area ─────── */}
          <div>
            {/* Chart Viewer */}
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
            />

            {/* Scenario Instructions & Objectives Accordion */}
            <div className="drill-instructions">
              <div className="drill-instructions-head">
                <Info style={{ width: 14, height: 14 }} />
                <span>Instruksi Analisis Objektif</span>
              </div>
              <ul>
                {drill.instructions.map((inst, idx) => (
                  <li key={idx}>{inst}</li>
                ))}
              </ul>
              <div className="drill-instructions-foot">
                <span>Batas Kelulusan: ≥ {drill.passingScore}%</span>
                <strong>
                  Syarat Stop-Loss: ≥ {drill.safetyGateMin}/25 Poin (Safety Gate)
                </strong>
              </div>
            </div>
          </div>

          {/* ── Right Column: Decision Console or Debrief ── */}
          <div>
            {viewMode === "CONSOLE" ? (
              /* ── Form Console Mode ───────────────────────────────── */
              <div className="drill-panel drill-card-inner">
                <div className="drill-console-head">
                  <h2 className="drill-console-title">
                    Student Decision Console
                  </h2>
                  <span className="drill-console-status">
                    <span className="live-dot" /> SIAP INPUT
                  </span>
                </div>

                <form onSubmit={handleSubmit}>
                  {/* Stance Selector: Trade vs No-Trade */}
                  <div className="drill-form-step">
                    <label className="drill-step-label">
                      1. Sikap Keputusan Eksekusi
                    </label>
                    <div className="drill-btn-grid-2" role="radiogroup">
                      <button
                        type="button"
                        onClick={() => setStance("TRADE")}
                        className={`drill-choice-btn trade ${stance === "TRADE" ? "active" : ""}`}
                      >
                        <TrendingUp style={{ width: 14, height: 14 }} />
                        <span>AMBIL POSISI</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStance("NO_TRADE")}
                        className={`drill-choice-btn notrade ${stance === "NO_TRADE" ? "active" : ""}`}
                      >
                        <MinusCircle style={{ width: 14, height: 14 }} />
                        <span>DISIPLIN NO-TRADE</span>
                      </button>
                    </div>
                  </div>

                  {/* Market Bias Selector */}
                  <div className="drill-form-step">
                    <label className="drill-step-label">
                      2. Analisis Bias Arah Pasar (Order Flow)
                    </label>
                    <div className="drill-btn-grid-3">
                      <button
                        type="button"
                        onClick={() => setBias("BULLISH")}
                        className={`drill-bias-btn bullish ${bias === "BULLISH" ? "active" : ""}`}
                      >
                        BULLISH (LONG)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBias("BEARISH")}
                        className={`drill-bias-btn bearish ${bias === "BEARISH" ? "active" : ""}`}
                      >
                        BEARISH (SHORT)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBias("SIDEWAYS_NEUTRAL")}
                        className={`drill-bias-btn sideways ${bias === "SIDEWAYS_NEUTRAL" ? "active" : ""}`}
                      >
                        SIDEWAYS
                      </button>
                    </div>
                  </div>

                  {/* Stance Branch A: Take Trade Inputs */}
                  {stance === "TRADE" ? (
                    <div className="drill-params-card">
                      <span className="drill-params-head">
                        3. Parameter Level Harga (Klik Chart atau Ketik)
                      </span>

                      <div className="drill-inputs-row">
                        {/* Entry */}
                        <div className="drill-input-field entry">
                          <label>ENTRY PRICE</label>
                          <input
                            type="number"
                            step="any"
                            value={entryPrice}
                            onChange={(e) =>
                              setEntryPrice(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            placeholder="0.00"
                            className="drill-text-input"
                          />
                        </div>

                        {/* Stop Loss */}
                        <div className="drill-input-field sl">
                          <label>STOP-LOSS (SL)</label>
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
                            className="drill-text-input"
                          />
                        </div>

                        {/* Target */}
                        <div className="drill-input-field tp">
                          <label>TARGET (TP)</label>
                          <input
                            type="number"
                            step="any"
                            value={targetPrice}
                            onChange={(e) =>
                              setTargetPrice(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            placeholder="0.00"
                            className="drill-text-input"
                          />
                        </div>
                      </div>

                      {/* Live R:R Pill */}
                      <div className="drill-rr-box">
                        <span style={{ color: "#6f7d88" }}>Risk/Reward Ratio:</span>
                        <span
                          className={`drill-rr-val ${
                            liveRiskReward.status === "OPTIMAL"
                              ? "optimal"
                              : liveRiskReward.status === "MARGINAL"
                              ? "marginal"
                              : "invalid"
                          }`}
                        >
                          {liveRiskReward.label}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Stance Branch B: NO-TRADE Contextual Reasons */
                    <div className="drill-notrade-card">
                      <span className="drill-notrade-head">
                        3. Landasan Struktural Keputusan Menahan Diri
                      </span>
                      <div className="drill-radio-list">
                        {COMMON_NO_TRADE_REASONS.map((reason) => (
                          <label
                            key={reason.id}
                            className="drill-radio-item"
                          >
                            <input
                              type="radio"
                              name="noTradeReasonGroup"
                              checked={noTradeReason === reason.id}
                              onChange={() => setNoTradeReason(reason.id)}
                            />
                            <span>{reason.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Structural Confirmations Checklist */}
                  {stance === "TRADE" && (
                    <div className="drill-form-step">
                      <label className="drill-step-label">
                        4. Konfirmasi Struktur Yang Teridentifikasi
                      </label>
                      <div className="drill-checklist">
                        {COMMON_CONFIRMATIONS.map((conf) => (
                          <label
                            key={conf.id}
                            className="drill-check-item"
                          >
                            <input
                              type="checkbox"
                              checked={selectedConfirmations.includes(conf.id)}
                              onChange={() => toggleConfirmation(conf.id)}
                            />
                            <span>{conf.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rationale Thesis */}
                  <div className="drill-form-step">
                    <label className="drill-step-label">
                      {stance === "TRADE"
                        ? "5. Narasi Analisis & Thesis Posisi"
                        : "4. Penjelasan Analisis Proteksi Modal"}
                    </label>
                    <textarea
                      rows={3}
                      value={rationaleText}
                      onChange={(e) => setRationaleText(e.target.value)}
                      placeholder="Jelaskan dasar pembacaan likuiditas, alasan penempatan stop-loss di balik swing structure, atau alasan menahan modal..."
                      className="drill-textarea"
                    />
                  </div>

                  {/* Error Callout */}
                  {submissionError && (
                    <div className="drill-alert-box">
                      <AlertTriangle style={{ width: 16, height: 16 }} />
                      <span>{submissionError}</span>
                    </div>
                  )}

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="drill-btn-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <RotateCcw style={{ width: 15, height: 15 }} className="animate-spin" />
                        <span>MENGEVALUASI DI SERVER...</span>
                      </>
                    ) : (
                      <>
                        <Send style={{ width: 15, height: 15 }} />
                        <span>KIRIM JAWABAN EVALUASI</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* ── Debrief Mode (After Submission) ─────────────────── */
              activeSubmission && (
                <div className="drill-panel drill-card-inner">
                  {/* Status Banner */}
                  <div
                    className={`drill-debrief-banner ${
                      activeSubmission.evaluation_status === "PASSED"
                        ? "passed"
                        : activeSubmission.evaluation_status === "FAILED_SAFETY_GATE"
                        ? "safety-fail"
                        : "failed"
                    }`}
                  >
                    <div className="drill-debrief-title">
                      {activeSubmission.evaluation_status === "PASSED" ? (
                        <>
                          <ShieldCheck style={{ width: 16, height: 16 }} />
                          <span>EVALUASI PRAKTIK: LULUS</span>
                        </>
                      ) : activeSubmission.evaluation_status === "FAILED_SAFETY_GATE" ? (
                        <>
                          <AlertTriangle style={{ width: 16, height: 16 }} />
                          <span>BELUM LULUS: PELANGGARAN SAFETY GATE</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert style={{ width: 16, height: 16 }} />
                          <span>EVALUASI PRAKTIK: BELUM LULUS</span>
                        </>
                      )}
                    </div>
                    <div className="drill-debrief-score">
                      {activeSubmission.score}%
                    </div>
                    <p className="drill-debrief-note">
                      {activeSubmission.evaluation_status === "PASSED"
                        ? "Analisis struktur dan manajemen risiko memenuhi standar kelulusan institusional."
                        : activeSubmission.evaluation_status === "FAILED_SAFETY_GATE"
                        ? `Skor Stop-Loss Anda ${activeSubmission.invalidation_score}/25 (Syarat: ≥ 18/25). Posisi dengan stop-loss tidak aman digagalkan demi proteksi modal.`
                        : `Skor Anda di bawah ambang batas kelulusan (≥ ${drill.passingScore}%).`}
                    </p>
                  </div>

                  {/* 5 Criteria Breakdown Table */}
                  <div style={{ marginBottom: 18 }}>
                    <span className="drill-step-label">
                      Rincian Evaluasi 5 Kriteria Objektif
                    </span>
                    <div className="drill-breakdown-card">
                      {activeSubmission.evaluation_breakdown.map((crit) => (
                        <div key={crit.criterionId} className="drill-breakdown-row">
                          <div className="drill-breakdown-meta">
                            <span>{crit.criterionName}</span>
                            <span
                              className={`drill-crit-score ${
                                crit.status === "FULL_CREDIT"
                                  ? "full"
                                  : crit.status === "PARTIAL_CREDIT"
                                  ? "partial"
                                  : "zero"
                              }`}
                            >
                              {crit.pointsEarned} / {crit.pointsPossible}
                            </span>
                          </div>
                          <p className="drill-crit-expl">
                            {crit.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instructor Debrief Text */}
                  {activeSubmission.debrief_text && (
                    <div className="drill-instructor-card">
                      <span className="drill-instructor-title">
                        CATATAN INSTRUKTUR:
                      </span>
                      <p style={{ margin: 0 }}>{activeSubmission.debrief_text}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div>
                    <button
                      type="button"
                      onClick={handleToggleSolution}
                      disabled={loadingSolution}
                      className="drill-btn-secondary"
                    >
                      <Eye style={{ width: 15, height: 15 }} />
                      <span>
                        {showSolutionOverlay
                          ? "Sembunyikan Solusi Instruktur"
                          : "Lihat Solusi & Anotasi Instruktur"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetForNewAttempt}
                      className="drill-btn-outline"
                    >
                      <RotateCcw style={{ width: 14, height: 14 }} />
                      <span>Coba Lagi Studi Kasus</span>
                    </button>
                  </div>

                  {/* Prior History Accordion */}
                  {history.length > 1 && (
                    <div className="drill-history-box">
                      <div className="drill-history-title">
                        <History style={{ width: 14, height: 14 }} />
                        <span>RIWAYAT PERCOBAAN ({history.length} KALI)</span>
                      </div>
                      <div>
                        {history.map((h) => (
                          <div
                            key={h.id}
                            className="drill-history-item"
                          >
                            <span style={{ color: "#87939f" }}>#{h.attemptNumber}</span>
                            <span
                              style={{
                                color: h.evaluationStatus === "PASSED" ? "var(--green)" : "#f43f5e",
                              }}
                            >
                              Skor: {h.score}% (SL: {h.invalidationScore}/25)
                            </span>
                            <span style={{ color: "#64748b" }}>
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
