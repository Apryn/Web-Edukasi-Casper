"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Course } from "@/lib/types";
import type {
  AdaptiveLearningRecommendation,
  NormalizedCourseProgressItem,
  StudentLearningDashboardReport,
  TopicMasteryLevel,
} from "@/lib/learning-intelligence/types";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  EyeOff,
  Flame,
  GraduationCap,
  Layers,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

interface StudentLearningWorkspaceProps {
  currentUser: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
  allCourses: Course[];
  onOpenCertificate: (course: Course) => void;
}

function formatDateId(iso: string | null | undefined): string {
  if (!iso) return "Belum ada aktivitas";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || ms <= 0) return "Belum ada aktivitas";
  return new Date(ms).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getMasteryBadgeInfo(level: TopicMasteryLevel): {
  label: string;
  className: string;
} {
  switch (level) {
    case "MASTERED":
      return { label: "Dikuasai (≥ 85%)", className: "learning-badge-mastered" };
    case "DEVELOPING":
      return {
        label: "Berkembang (70–84%)",
        className: "learning-badge-developing",
      };
    case "NEEDS_PRACTICE":
      return {
        label: "Perlu Latihan (< 70%)",
        className: "learning-badge-weak",
      };
    default:
      return { label: "Belum Dikerjakan", className: "learning-badge-nodata" };
  }
}

function getRecommendationBadge(type: AdaptiveLearningRecommendation["type"]): {
  label: string;
  color: string;
} {
  switch (type) {
    case "RETRY_QUIZ":
      return { label: "ULANGI EVALUASI KUIS", color: "#f87171" };
    case "CONTINUE_LEARNING":
      return { label: "LANJUTKAN BELAJAR", color: "#41d9ef" };
    case "RETURN_TO_LEARNING":
      return { label: "KEMBALI AKTIF BELAJAR", color: "#fbbf24" };
    case "REVIEW_WEAK_TOPIC":
      return { label: "PERKUAT TOPIK LEMAH", color: "#fb923c" };
    case "NEXT_LESSON":
      return { label: "MATERI BERIKUTNYA", color: "#38bdf8" };
    case "START_FOUNDATION":
      return { label: "MULAI FONDASI UTAMA", color: "#6ce0b0" };
    case "ADVANCE_TO_NEXT_COURSE":
      return { label: "NAIK KE KELAS BERIKUTNYA", color: "#a78bfa" };
  }
}

export default function StudentLearningWorkspace({
  currentUser,
  allCourses,
  onOpenCertificate,
}: StudentLearningWorkspaceProps) {
  const [report, setReport] = useState<StudentLearningDashboardReport | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState<
    "ALL" | "IN_PROGRESS" | "COMPLETED" | "NOT_STARTED"
  >("ALL");
  const [topicFilter, setTopicFilter] = useState<"ALL" | "ATTEMPTED" | "WEAK">(
    "ALL"
  );
  const [isMutatingRec, setIsMutatingRec] = useState<boolean>(false);

  const loadDashboardReport = useCallback(async () => {
    if (!currentUser?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/learning/dashboard", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error || "Gagal memuat data Learning Intelligence dari server."
        );
      }
      setReport(data as StudentLearningDashboardReport);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Tidak dapat terhubung ke server Learning Intelligence."
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadDashboardReport();
  }, [loadDashboardReport]);

  const handleDismissRecommendation = async (recommendationId: string) => {
    if (isMutatingRec) return;
    setIsMutatingRec(true);
    try {
      const res = await fetch("/api/learning/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "dismiss",
          recommendationId,
        }),
      });
      if (res.ok) {
        await loadDashboardReport();
      }
    } catch {
      // Ignore network error on dismiss
    } finally {
      setIsMutatingRec(false);
    }
  };

  const handleRestoreRecommendations = async () => {
    if (isMutatingRec) return;
    setIsMutatingRec(true);
    try {
      const res = await fetch("/api/learning/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "restore",
        }),
      });
      if (res.ok) {
        await loadDashboardReport();
      }
    } catch {
      // Ignore
    } finally {
      setIsMutatingRec(false);
    }
  };

  if (!currentUser?.id) {
    return (
      <section className="wrap learning-workspace">
        <div className="empty-dashboard-box">
          <GraduationCap size={38} />
          <h3>Masuk untuk Membuka Dashboard Pembelajaran Adaptif</h3>
          <p>
            Pantau progres setiap modul, evaluasi penguasaan topik kuis, dan
            dapatkan rekomendasi materi berikutnya secara terpersonalisasi.
          </p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link href="/login" className="button button-primary">
              Login Akun Siswa <ArrowRight size={16} />
            </Link>
            <Link href="/belajar" className="button button-secondary">
              Lihat Katalog Kurikulum
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading && !report) {
    return (
      <section className="wrap learning-workspace" aria-busy="true">
        <div className="learning-skeleton-grid">
          <div className="learning-skeleton-card" />
          <div className="learning-skeleton-card" />
          <div className="learning-skeleton-card" />
          <div className="learning-skeleton-card" />
        </div>
        <div
          className="learning-skeleton-card"
          style={{ height: "180px", marginTop: "20px" }}
        />
      </section>
    );
  }

  if (errorMsg && !report) {
    return (
      <section className="wrap learning-workspace">
        <div className="auth-error-alert" role="alert">
          <AlertCircle size={18} />
          <div style={{ flex: 1 }}>
            <strong>Gagal Memuat Dashboard Pembelajaran</strong>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>{errorMsg}</div>
          </div>
          <button
            type="button"
            onClick={loadDashboardReport}
            className="button button-primary"
            style={{ padding: "8px 14px", fontSize: "12px" }}
          >
            <RefreshCw size={14} /> Coba Lagi
          </button>
        </div>
      </section>
    );
  }

  if (!report) return null;

  const {
    overall,
    continueLearning,
    recommendations,
    dismissedRecommendationsCount,
    courseProgress,
    continuity,
    quizIntelligence,
  } = report;

  const filteredCourses = courseProgress.filter((c) => {
    if (courseFilter === "ALL") return true;
    return c.status === courseFilter;
  });

  const filteredTopics = quizIntelligence.topics.filter((t) => {
    if (topicFilter === "ATTEMPTED") return t.attemptsCount > 0;
    if (topicFilter === "WEAK") return t.isWeakTopic;
    return true;
  });

  return (
    <div className="wrap learning-workspace">
      {/* SECTION A: LEARNING OVERVIEW KPI CARDS */}
      <div className="learning-kpi-grid">
        <div className="learning-kpi-card">
          <div className="learning-kpi-top">
            <span className="learning-kpi-label">PENYELESAIAN MATERI</span>
            <BookOpen size={18} className="learning-kpi-icon" />
          </div>
          <div className="learning-kpi-value">
            {overall.overallLessonCompletionRate !== null
              ? `${overall.overallLessonCompletionRate}%`
              : "NO DATA"}
          </div>
          <div className="learning-kpi-sub">
            {overall.lessonsCompleted} dari {overall.totalAvailableLessons}{" "}
            pelajaran aktif selesai
          </div>
        </div>

        <div className="learning-kpi-card">
          <div className="learning-kpi-top">
            <span className="learning-kpi-label">PROGRES KURSUS</span>
            <GraduationCap size={18} className="learning-kpi-icon" />
          </div>
          <div className="learning-kpi-value">
            {overall.coursesCompleted} / {overall.totalPublishedCourses}
          </div>
          <div className="learning-kpi-sub">
            {overall.coursesInProgress} sedang dipelajari •{" "}
            {overall.coursesNotStarted} belum dimulai
          </div>
        </div>

        <div className="learning-kpi-card">
          <div className="learning-kpi-top">
            <span className="learning-kpi-label">RATA-RATA EVALUASI KUIS</span>
            <Trophy size={18} className="learning-kpi-icon" />
          </div>
          <div className="learning-kpi-value">
            {overall.averageQuizScore !== null
              ? `${overall.averageQuizScore}%`
              : "Belum Ada Kuis"}
          </div>
          <div className="learning-kpi-sub">
            {overall.quizScoreDataStatus === "NO_DATA"
              ? "Kerjakan kuis evaluasi di dalam kelas"
              : overall.quizScoreDataStatus === "INSUFFICIENT_DATA"
                ? `${overall.totalQuizSubmissions} percobaan (Data awal)`
                : `${overall.totalQuizSubmissions} percobaan terverifikasi • ${quizIntelligence.masteredTopicsCount} topik dikuasai`}
          </div>
        </div>

        <div className="learning-kpi-card">
          <div className="learning-kpi-top">
            <span className="learning-kpi-label">KONTINUITAS BELAJAR</span>
            <Flame size={18} className="learning-kpi-icon" />
          </div>
          <div className="learning-kpi-value">
            {continuity.dataStatus === "NO_DATA"
              ? "0 Hari Aktif"
              : `${continuity.activeDaysLast7d} Hari / 7d`}
          </div>
          <div className="learning-kpi-sub">
            {continuity.dataStatus === "NO_DATA"
              ? "Mulai pelajaran pertama Anda hari ini"
              : `Streak: ${continuity.currentStreakDays ?? 0} hari (Terbaik: ${continuity.longestStreakDays ?? 0} hari)`}
          </div>
        </div>
      </div>

      {/* SECTION B: CONTINUE LEARNING HERO CARD */}
      {continueLearning.course && (
        <div className="learning-continue-banner">
          <div className="learning-continue-info">
            <div className="learning-continue-tags">
              <span className="learning-pill-cyan">
                <Sparkles size={12} />{" "}
                {continueLearning.hasActiveCourse
                  ? "LANJUTKAN PEMBELAJARAN AKTIF"
                  : overall.coursesCompleted === overall.totalPublishedCourses &&
                      overall.totalPublishedCourses > 0
                    ? "SELURUH KURIKULUM SELESAI"
                    : "MULAI LANGKAH PERTAMA"}
              </span>
              <span className="learning-pill-muted">
                {continueLearning.course.courseNumber} •{" "}
                {continueLearning.course.level} •{" "}
                {continueLearning.course.category}
              </span>
            </div>
            <h2>{continueLearning.course.courseTitle}</h2>
            <p>{continueLearning.course.courseSubtitle}</p>

            <div className="learning-continue-progress">
              <div className="learning-continue-meta">
                <span>
                  Progres Kelas:{" "}
                  <strong>{continueLearning.course.completionPercentage}%</strong>{" "}
                  ({continueLearning.course.completedLessonsCount} /{" "}
                  {continueLearning.course.totalEligibleLessons} Materi)
                </span>
                {continueLearning.course.nextEligibleLessonTitle && (
                  <span>
                    Target Berikutnya:{" "}
                    <strong>
                      {continueLearning.course.nextEligibleLessonTitle}
                    </strong>
                  </span>
                )}
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill ${
                    continueLearning.course.status === "COMPLETED"
                      ? "complete"
                      : ""
                  }`}
                  style={{
                    width: `${continueLearning.course.completionPercentage}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="learning-continue-cta">
            <Link
              href={continueLearning.primaryCtaUrl}
              className="button button-primary"
            >
              {continueLearning.primaryCtaLabel} <ArrowRight size={16} />
            </Link>
            <Link
              href={`/belajar/${continueLearning.course.courseSlug}`}
              className="button button-secondary"
            >
              Lihat Silabus
            </Link>
          </div>
        </div>
      )}

      {/* SECTION C: RECOMMENDED NEXT STEPS (ADAPTIVE LEARNING ENGINE) */}
      <div className="learning-panel">
        <div className="learning-panel-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" /> ADAPTIVE LEARNING RECOMMENDATIONS
            </div>
            <h3>Rekomendasi Langkah Belajar Berikutnya</h3>
            <p className="learning-panel-sub">
              Disusun secara deterministik berdasarkan progres materi, hasil
              evaluasi kuis, dan urutan kompetensi kurikulum Anda.
            </p>
          </div>
          {dismissedRecommendationsCount > 0 && (
            <button
              type="button"
              onClick={handleRestoreRecommendations}
              disabled={isMutatingRec}
              className="admin-btn"
              title="Tampilkan kembali rekomendasi yang disembunyikan"
            >
              <RotateCcw size={13} /> Pulihkan {dismissedRecommendationsCount}{" "}
              Rekomendasi Tersembunyi
            </button>
          )}
        </div>

        {recommendations.length === 0 ? (
          <div className="learning-empty-state">
            <CheckCircle2 size={28} style={{ color: "var(--green)" }} />
            <h4>Seluruh Rekomendasi Saat Ini Telah Dituntaskan</h4>
            <p>
              Anda telah menyelesaikan seluruh materi yang direkomendasikan atau
              menyembunyikan saran sementara. Jelajahi kelas di bawah untuk
              meninjau ulang materi kapan saja.
            </p>
          </div>
        ) : (
          <div className="learning-rec-grid">
            {recommendations.map((rec) => {
              const badge = getRecommendationBadge(rec.type);
              return (
                <div
                  key={rec.recommendationId}
                  className="learning-rec-card"
                  data-testid={`recommendation-card-${rec.type}`}
                >
                  <div className="learning-rec-topline">
                    <span
                      className="learning-rec-type"
                      style={{
                        borderColor: `${badge.color}55`,
                        color: badge.color,
                      }}
                    >
                      #{rec.rank} • {badge.label}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleDismissRecommendation(rec.recommendationId)
                      }
                      disabled={isMutatingRec}
                      className="learning-rec-dismiss"
                      title="Sembunyikan rekomendasi ini sampai ada perubahan progres baru"
                    >
                      <EyeOff size={13} /> Sembunyikan
                    </button>
                  </div>

                  <h4>{rec.shortTitle}</h4>
                  <p className="learning-rec-desc">{rec.explanation}</p>

                  <div className="learning-rec-evidence">
                    <Target size={13} style={{ color: "var(--cyan)" }} />
                    <span>
                      <strong>Bukti Data:</strong> {rec.evidenceSummary}
                    </span>
                  </div>

                  <div className="learning-rec-footer">
                    <span className="learning-rec-course">
                      {rec.courseNumber} — {rec.courseTitle}
                    </span>
                    <Link
                      href={rec.destination}
                      className="course-view-btn"
                      style={{
                        background: "rgba(65, 217, 239, 0.12)",
                        borderColor: "var(--cyan)",
                        color: "var(--cyan)",
                      }}
                    >
                      {rec.actionLabel} <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION D: COURSE PROGRESS CARDS */}
      <div className="learning-panel">
        <div className="learning-panel-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" /> KURIKULUM AKADEMI (
              {courseProgress.length} KELAS)
            </div>
            <h3>Progres Kelas &amp; Sertifikasi Kelulusan</h3>
          </div>

          <div className="learning-filter-pills" role="tablist">
            {(
              [
                { key: "ALL", label: `Semua (${courseProgress.length})` },
                {
                  key: "IN_PROGRESS",
                  label: `Sedang Dipelajari (${overall.coursesInProgress})`,
                },
                {
                  key: "COMPLETED",
                  label: `Selesai (${overall.coursesCompleted})`,
                },
                {
                  key: "NOT_STARTED",
                  label: `Belum Dimulai (${overall.coursesNotStarted})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCourseFilter(tab.key)}
                className={`learning-filter-pill ${
                  courseFilter === tab.key ? "active" : ""
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="learning-empty-state">
            <Compass size={28} />
            <h4>Tidak Ada Kelas pada Filter Ini</h4>
            <p>
              Ubah filter status di atas untuk melihat daftar lengkap kurikulum
              Signal Casper Academy.
            </p>
          </div>
        ) : (
          <div className="courses-grid">
            {filteredCourses.map((c: NormalizedCourseProgressItem) => {
              const fullCourseObj =
                allCourses.find((ac) => ac.slug === c.courseSlug) || null;
              return (
                <div key={c.courseId} className="course-card">
                  <div className="card-topline">
                    <span className="course-code">{c.courseNumber}</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span className="course-level-badge">{c.level}</span>
                      <span
                        className={`learning-status-tag status-${c.status.toLowerCase()}`}
                      >
                        {c.status === "COMPLETED"
                          ? "Lulus ✓"
                          : c.status === "IN_PROGRESS"
                            ? "Sedang Belajar"
                            : "Belum Dimulai"}
                      </span>
                    </div>
                  </div>

                  <h3 className="course-card-title">
                    <Link href={`/belajar/${c.courseSlug}`}>
                      {c.courseTitle}
                    </Link>
                  </h3>
                  <p className="course-card-subtitle">{c.courseSubtitle}</p>

                  <div className="card-progress">
                    <div className="progress-info">
                      <span>
                        {c.completedLessonsCount} / {c.totalEligibleLessons}{" "}
                        Pelajaran
                      </span>
                      <strong>{c.completionPercentage}%</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${
                          c.status === "COMPLETED" ? "complete" : ""
                        }`}
                        style={{ width: `${c.completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "#8fa1b3",
                      marginTop: "8px",
                    }}
                  >
                    <span>
                      <Clock
                        size={11}
                        style={{
                          display: "inline",
                          marginRight: "4px",
                          verticalAlign: "-1px",
                        }}
                      />
                      Aktivitas: {formatDateId(c.latestActivityAt)}
                    </span>
                    {c.bestQuizScore !== null ? (
                      <span
                        style={{
                          color:
                            c.bestQuizScore >= 70 ? "var(--green)" : "#fbbf24",
                          fontWeight: 600,
                        }}
                      >
                        Skor Kuis Terbaik: {c.bestQuizScore}%
                      </span>
                    ) : c.hasQuiz ? (
                      <span>Kuis: Belum dikerjakan</span>
                    ) : null}
                  </div>

                  <div
                    className="course-card-action"
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      alignItems: "center",
                      marginTop: "14px",
                    }}
                  >
                    <Link href={c.continueUrl} className="course-view-btn">
                      {c.status === "COMPLETED"
                        ? "Tinjau Materi"
                        : c.status === "IN_PROGRESS"
                          ? "Lanjutkan"
                          : "Mulai Belajar"}{" "}
                      <ArrowUpRight size={15} />
                    </Link>
                    {c.isEligibleForCertificate && fullCourseObj && (
                      <button
                        type="button"
                        onClick={() => onOpenCertificate(fullCourseObj)}
                        className="course-view-btn"
                        style={{
                          background: "#162b3a",
                          borderColor: "var(--cyan)",
                          color: "var(--cyan)",
                        }}
                      >
                        <Award size={14} /> Sertifikat
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION E & F: TOPIC MASTERY & LEARNING ACTIVITY TIMELINE */}
      <div className="learning-two-col">
        {/* SECTION F: QUIZ & TOPIC MASTERY */}
        <div className="learning-panel">
          <div className="learning-panel-header">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" /> PENGUASAAN TOPIK &amp; EVALUASI
              </div>
              <h3>Performa Kuis per Modul &amp; Topik</h3>
            </div>

            <div className="learning-filter-pills">
              {(
                [
                  {
                    key: "ALL",
                    label: `Semua (${quizIntelligence.topics.length})`,
                  },
                  {
                    key: "ATTEMPTED",
                    label: `Sudah Dikerjakan (${quizIntelligence.uniqueQuizzesAttempted})`,
                  },
                  {
                    key: "WEAK",
                    label: `Perlu Latihan (${quizIntelligence.weakTopicsCount})`,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTopicFilter(f.key)}
                  className={`learning-filter-pill ${
                    topicFilter === f.key ? "active" : ""
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Competency Pillars Summary */}
          <div className="learning-category-strip">
            {quizIntelligence.categorySummaries.map((cat) => {
              const badge = getMasteryBadgeInfo(cat.masteryLevel);
              return (
                <div key={cat.category} className="learning-category-chip">
                  <div className="learning-category-name">{cat.category}</div>
                  <div className="learning-category-score">
                    {cat.averageScore !== null
                      ? `${cat.averageScore}%`
                      : "Belum Ada Data"}
                  </div>
                  <span className={badge.className}>{badge.label}</span>
                </div>
              );
            })}
          </div>

          {quizIntelligence.dataStatus === "NO_DATA" ? (
            <div className="learning-empty-state">
              <Layers size={26} />
              <h4>Belum Ada Data Evaluasi Kuis</h4>
              <p>
                Selesaikan pelajaran berkuis di dalam ruang kelas untuk melihat
                pemetaan kekuatan dan topik yang masih perlu dilatih.
              </p>
            </div>
          ) : (
            <div className="learning-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Topik &amp; Kelas</th>
                    <th>Percobaan</th>
                    <th>Rata-Rata / Terbaik</th>
                    <th>Perkembangan</th>
                    <th>Status Penguasaan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTopics.slice(0, 12).map((t) => {
                    const badge = getMasteryBadgeInfo(t.masteryLevel);
                    return (
                      <tr key={t.topicId}>
                        <td>
                          <strong>{t.lessonTitle}</strong>
                          <div style={{ fontSize: "11px", color: "#7f91a3" }}>
                            {t.courseTitle} • {t.moduleTitle}
                          </div>
                        </td>
                        <td>{t.attemptsCount}x</td>
                        <td>
                          {t.averageScore !== null ? (
                            <>
                              <strong>{t.averageScore}%</strong>{" "}
                              <span style={{ color: "#8fa1b3", fontSize: "11px" }}>
                                (Max: {t.bestScore}%)
                              </span>
                            </>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </td>
                        <td>
                          {t.improvementDelta !== null ? (
                            <span
                              style={{
                                color:
                                  t.improvementDelta >= 0
                                    ? "var(--green)"
                                    : "#f87171",
                                fontWeight: 600,
                              }}
                            >
                              <TrendingUp
                                size={12}
                                style={{
                                  display: "inline",
                                  marginRight: "3px",
                                }}
                              />
                              {t.improvementDelta >= 0
                                ? `+${t.improvementDelta}%`
                                : `${t.improvementDelta}%`}
                            </span>
                          ) : t.attemptsCount === 1 ? (
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                              1 percobaan
                            </span>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={badge.className}>{badge.label}</span>
                        </td>
                        <td>
                          <Link href={t.actionUrl} className="admin-btn">
                            {t.attemptsCount === 0 ? "Kerjakan" : "Latih"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION E: LEARNING ACTIVITY & CONTINUITY */}
        <div className="learning-panel">
          <div className="learning-panel-header">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" /> RIWAYAT AKTIVITAS BELAJAR
              </div>
              <h3>Konsistensi 7 Hari Terakhir &amp; Jejak Materi</h3>
            </div>
          </div>

          <div className="learning-weekly-bars">
            {continuity.weeklyActivityTimeline.map((b) => {
              const isActive = b.eventsCount > 0;
              return (
                <div
                  key={b.dateUtc}
                  className={`learning-day-col ${isActive ? "active" : ""}`}
                  title={`${b.dateUtc}: ${b.eventsCount} aktivitas (${b.lessonsCompletedCount} materi selesai, ${b.quizzesSubmittedCount} kuis)`}
                >
                  <div className="learning-day-bar-track">
                    <div
                      className="learning-day-bar-fill"
                      style={{
                        height: `${Math.min(100, b.eventsCount * 25)}%`,
                      }}
                    />
                  </div>
                  <span className="learning-day-count">{b.eventsCount}</span>
                  <span className="learning-day-date">
                    {b.dateUtc.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>

          {continuity.recentEvents.length === 0 ? (
            <div className="learning-empty-state" style={{ marginTop: "14px" }}>
              <Clock size={24} />
              <h4>Belum Ada Riwayat Aktivitas</h4>
              <p>
                Aktivitas penyelesaian materi dan evaluasi kuis Anda akan
                tercatat secara otomatis di sini tanpa rekayasa data.
              </p>
            </div>
          ) : (
            <div className="learning-activity-feed">
              {continuity.recentEvents.slice(0, 6).map((ev) => (
                <div key={ev.id} className="learning-activity-item">
                  <div className="learning-activity-dot" />
                  <div className="learning-activity-body">
                    <div className="learning-activity-title">
                      {ev.eventType === "COURSE_COMPLETED"
                        ? `Menyelesaikan kelas ${ev.courseTitle}`
                        : ev.eventType === "QUIZ_SUBMITTED"
                          ? `Evaluasi Kuis: ${ev.lessonTitle || ev.courseTitle} (Skor: ${ev.score ?? 0}%)`
                          : ev.eventType === "LESSON_COMPLETED"
                            ? `Menyelesaikan materi: ${ev.lessonTitle || ev.courseTitle}`
                            : ev.eventType === "LESSON_STARTED"
                              ? `Mempelajari materi: ${ev.lessonTitle || ev.courseTitle}`
                              : `Memulai kelas: ${ev.courseTitle}`}
                    </div>
                    <div className="learning-activity-meta">
                      {ev.courseTitle} • {formatDateId(ev.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

