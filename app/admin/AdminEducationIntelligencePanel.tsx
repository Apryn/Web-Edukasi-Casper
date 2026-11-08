"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  AdminFullEducationIntelligenceBundle,
  AdminTimePeriod,
} from "@/lib/learning-intelligence/types";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Filter,
  GraduationCap,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  Trophy,
  Users,
} from "lucide-react";

export default function AdminEducationIntelligencePanel() {
  const [period, setPeriod] = useState<AdminTimePeriod>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [bundle, setBundle] =
    useState<AdminFullEducationIntelligenceBundle | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSubView, setActiveSubView] = useState<
    "overview" | "courses" | "lessons" | "quizzes" | "engagement"
  >("overview");

  const loadEducationIntelligence = useCallback(
    async (selectedPeriod: AdminTimePeriod) => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(
          `/api/admin/learning-intelligence/overview?period=${encodeURIComponent(
            selectedPeriod
          )}&bundle=true`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data?.error || "Gagal memuat data Admin Education Intelligence."
          );
        }
        if (data?.bundle) {
          setBundle(data.bundle as AdminFullEducationIntelligenceBundle);
        }
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Tidak dapat memuat laporan Education Intelligence."
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadEducationIntelligence(period);
  }, [period, loadEducationIntelligence]);

  if (isLoading && !bundle) {
    return (
      <div className="admin-intelligence-panel" aria-busy="true">
        <div className="journal-empty-inline">
          Memuat laporan agregat Admin Education Intelligence...
        </div>
      </div>
    );
  }

  if (errorMsg && !bundle) {
    return (
      <div className="admin-intelligence-panel">
        <div className="auth-error-alert" role="alert">
          <AlertCircle size={18} />
          <div style={{ flex: 1 }}>{errorMsg}</div>
          <button
            type="button"
            onClick={() => loadEducationIntelligence(period)}
            className="admin-btn admin-btn-primary"
          >
            <RefreshCw size={13} /> Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!bundle) return null;

  const { overview, courses, lessons, quizzes, engagement } = bundle;
  const filteredLessons =
    courseFilter === "all"
      ? lessons
      : lessons.filter((l) => l.courseSlug === courseFilter);

  return (
    <div className="admin-intelligence-panel">
      {/* Privacy & Period Filter Header */}
      <div
        className="journal-privacy-explainer"
        style={{ marginBottom: "20px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <strong style={{ color: "var(--cyan)", fontSize: "13px" }}>
            <ShieldCheck
              size={15}
              style={{
                display: "inline",
                marginRight: "6px",
                verticalAlign: "-2px",
              }}
            />
            PRIVACY GUARANTEE: {bundle.privacyGuarantee}
          </strong>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              <Filter
                size={12}
                style={{ display: "inline", marginRight: "4px" }}
              />
              Periode Laporan:
            </span>
            {(
              [
                { key: "7d", label: "7 Hari" },
                { key: "30d", label: "30 Hari" },
                { key: "90d", label: "90 Hari" },
                { key: "all", label: "Seluruh Waktu" },
              ] as const
            ).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`admin-btn ${
                  period === p.key ? "admin-btn-primary" : ""
                }`}
                style={{ padding: "4px 10px", fontSize: "11px" }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
          Menampilkan analitik pendidikan agregat untuk periode{" "}
          <strong>{overview.periodLabel}</strong>. Akun Admin dan Mentor
          dikecualikan dari populasi siswa. Data jurnal trading pribadi siswa
          tidak pernah diakses oleh modul ini.
          {overview.smallCohortProtected && (
            <span
              style={{
                display: "block",
                marginTop: "6px",
                color: "#fde047",
                fontWeight: 600,
              }}
            >
              [PROTEKSI KOHORT KECIL AKTIF]: Jumlah siswa yang memulai belajar (
              {overview.studentsStartedAnyCourse}) kurang dari ambang minimum (
              {overview.minSafeCohortThreshold} siswa). Rincian sub-kohort
              sensitif disamarkan.
            </span>
          )}
        </p>
      </div>

      {/* Sub-navigation inside Education Intelligence */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        {(
          [
            { key: "overview", label: "Ringkasan & Distribusi" },
            {
              key: "courses",
              label: `Performa Kelas (${courses.length})`,
            },
            {
              key: "lessons",
              label: `Drop-Off Materi & Modul (${lessons.length})`,
            },
            {
              key: "quizzes",
              label: `Inteligensi Kuis & Soal (${quizzes.totalSubmissions})`,
            },
            {
              key: "engagement",
              label: "Engagement, Funnel & Retensi",
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSubView(tab.key)}
            className={`admin-btn ${
              activeSubView === tab.key ? "admin-btn-primary" : ""
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Top KPI Grid (Always visible for quick context) */}
      <div className="admin-stats-grid" style={{ marginBottom: "22px" }}>
        <div className="admin-stat-card">
          <small>
            <Users size={12} style={{ display: "inline", marginRight: "4px" }} />{" "}
            Populasi Siswa (Terdaftar vs Mulai Belajar)
          </small>
          <strong>
            {overview.studentsStartedAnyCourse} /{" "}
            {overview.totalRegisteredStudents}
          </strong>
          <div style={{ fontSize: "11px", color: "#7f91a3", marginTop: "4px" }}>
            Aktif di periode ({overview.periodLabel}):{" "}
            <strong>{overview.activeStudentsInPeriod} siswa</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <small>
            <GraduationCap
              size={12}
              style={{ display: "inline", marginRight: "4px" }}
            />{" "}
            Siswa Lulus ≥ 1 Kelas
          </small>
          <strong>{overview.studentsCompletedAtLeastOneCourse} Siswa</strong>
          <div style={{ fontSize: "11px", color: "#7f91a3", marginTop: "4px" }}>
            Konversi Mulai → Lulus:{" "}
            {overview.startedToCompletedConversionRate !== null
              ? `${overview.startedToCompletedConversionRate}%`
              : "NO DATA"}
          </div>
        </div>

        <div className="admin-stat-card">
          <small>
            <BookOpen
              size={12}
              style={{ display: "inline", marginRight: "4px" }}
            />{" "}
            Total Penyelesaian Pelajaran
          </small>
          <strong>{overview.totalLessonCompletionsAcrossCohort}</strong>
          <div style={{ fontSize: "11px", color: "#7f91a3", marginTop: "4px" }}>
            Lintas {courses.length} kelas berstatus Published
          </div>
        </div>

        <div className="admin-stat-card">
          <small>
            <Trophy
              size={12}
              style={{ display: "inline", marginRight: "4px" }}
            />{" "}
            Performa Evaluasi Kuis ({overview.periodLabel})
          </small>
          <strong>
            {overview.aggregateQuizAverageScore !== null
              ? `${overview.aggregateQuizAverageScore}%`
              : "NO DATA"}
          </strong>
          <div style={{ fontSize: "11px", color: "#7f91a3", marginTop: "4px" }}>
            Pass Rate:{" "}
            {overview.aggregateQuizPassRate !== null
              ? `${overview.aggregateQuizPassRate}%`
              : "—"}{" "}
            ({overview.totalQuizSubmissionsInPeriod} pengumpulan)
          </div>
        </div>
      </div>

      {/* SUBVIEW 1: OVERVIEW & COURSE COMPLETION DISTRIBUTION */}
      {activeSubView === "overview" && (
        <div className="journal-intel-two-col">
          <div className="journal-panel">
            <h4>Distribusi Penyelesaian Kursus Siswa</h4>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kategori Penyelesaian</th>
                  <th>Jumlah Siswa</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Belum Menyelesaikan Kelas (0 Kelas Lulus)</td>
                  <td>
                    <strong>
                      {
                        overview.courseCompletionDistribution
                          .completedZeroCourses
                      }
                    </strong>
                  </td>
                </tr>
                <tr>
                  <td>Menyelesaikan 1 – 2 Kelas</td>
                  <td>
                    <strong style={{ color: "var(--cyan)" }}>
                      {
                        overview.courseCompletionDistribution
                          .completedOneToTwoCourses
                      }
                    </strong>
                  </td>
                </tr>
                <tr>
                  <td>Menyelesaikan ≥ 3 Kelas</td>
                  <td>
                    <strong style={{ color: "var(--green)" }}>
                      {
                        overview.courseCompletionDistribution
                          .completedThreeOrMoreCourses
                      }
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="journal-panel">
            <h4>Kelas yang Membutuhkan Perhatian Kurikulum</h4>
            {courses.filter((c) => c.needsContentAttention).length === 0 ? (
              <div className="journal-empty-inline">
                <CheckCircle2
                  size={16}
                  style={{
                    display: "inline",
                    marginRight: "6px",
                    color: "var(--green)",
                    verticalAlign: "-3px",
                  }}
                />
                Tidak ada kelas dengan indikasi hambatan kritis pada sampel yang
                memenuhi syarat (≥ {overview.minSafeCohortThreshold} siswa).
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Kelas</th>
                    <th>Indikasi Evaluasi</th>
                  </tr>
                </thead>
                <tbody>
                  {courses
                    .filter((c) => c.needsContentAttention)
                    .map((c) => (
                      <tr key={c.courseId}>
                        <td>
                          <strong>
                            {c.courseNumber} — {c.courseTitle}
                          </strong>
                        </td>
                        <td style={{ color: "#fca5a5" }}>
                          {c.attentionReason}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW 2: COURSE PERFORMANCE TABLE */}
      {activeSubView === "courses" && (
        <div className="journal-panel">
          <h4>Tabel Efektivitas &amp; Penyelesaian per Kelas (Published)</h4>
          <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: 0 }}>
            Completion Rate dihitung secara ketat dari{" "}
            <code>Siswa Selesai / Siswa yang Memulai Kelas</code> (bukan dibagi
            seluruh akun terdaftar).
          </p>
          <div className="learning-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th>Mulai / Selesai</th>
                  <th>Completion Rate</th>
                  <th>Rata-Rata Progres</th>
                  <th>Performa Kuis</th>
                  <th>Materi &quot;Belum Melanjutkan&quot; Tertinggi</th>
                  <th>Status Sampel</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.courseId}>
                    <td>
                      <strong>
                        {c.courseNumber} — {c.courseTitle}
                      </strong>
                      <div style={{ fontSize: "11px", color: "#7f91a3" }}>
                        {c.category} • {c.level} • {c.totalLessons} Pelajaran
                      </div>
                    </td>
                    <td>
                      <strong>{c.startedStudentsCount}</strong> mulai /{" "}
                      <strong style={{ color: "var(--green)" }}>
                        {c.completedStudentsCount}
                      </strong>{" "}
                      lulus
                    </td>
                    <td>
                      {c.completionRate !== null ? (
                        <strong>{c.completionRate}%</strong>
                      ) : (
                        <span style={{ color: "#64748b" }}>NO DATA</span>
                      )}
                    </td>
                    <td>
                      {c.averageLessonCompletionPercentage !== null
                        ? `${c.averageLessonCompletionPercentage}%`
                        : "—"}
                    </td>
                    <td>
                      {c.quizSubmissionsCount > 0 ? (
                        <span>
                          Avg: <strong>{c.quizAverageScore}%</strong> • Pass:{" "}
                          <strong>{c.quizPassRate}%</strong> (
                          {c.quizSubmissionsCount})
                        </span>
                      ) : (
                        <span style={{ color: "#64748b" }}>0 pengumpulan</span>
                      )}
                    </td>
                    <td>
                      {c.highestDropOffLessonTitle ? (
                        <span>
                          {c.highestDropOffLessonTitle} (
                          <strong>{c.highestNotYetProceededRate}%</strong>)
                        </span>
                      ) : (
                        <span style={{ color: "#64748b" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="journal-status-pill">
                        {c.sampleSizeStatus} (N={c.startedStudentsCount})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 3: LESSON & MODULE DROP-OFF */}
      {activeSubView === "lessons" && (
        <div className="journal-panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>
                Analisis Kemajuan &amp; Titik &quot;Belum Melanjutkan&quot; per
                Pelajaran
              </h4>
              <p
                style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  margin: "4px 0 0",
                }}
              >
                Mengukur proporsi siswa yang telah mencapai suatu pelajaran
                namun belum menyelesaikannya.
              </p>
            </div>

            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="admin-input"
              style={{ width: "auto", minWidth: "240px" }}
              aria-label="Filter Kelas untuk Drop-off Materi"
            >
              <option value="all">Semua Kelas ({lessons.length} Materi)</option>
              {courses.map((c) => (
                <option key={c.courseSlug} value={c.courseSlug}>
                  {c.courseNumber} — {c.courseTitle}
                </option>
              ))}
            </select>
          </div>

          <div className="learning-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kelas &amp; Modul</th>
                  <th>Urutan &amp; Materi</th>
                  <th>Mencapai Materi</th>
                  <th>Selesai</th>
                  <th>Lanjut ke Materi Berikutnya</th>
                  <th>Belum Melanjutkan (%)</th>
                  <th>Evaluasi Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLessons.map((l) => (
                  <tr key={`${l.courseSlug}:${l.lessonId}`}>
                    <td>
                      <strong>{l.courseNumber}</strong>
                      <div style={{ fontSize: "11px", color: "#7f91a3" }}>
                        {l.moduleTitle}
                      </div>
                    </td>
                    <td>
                      <strong>
                        #{l.lessonIndex}. {l.lessonTitle}
                      </strong>
                      <div style={{ fontSize: "11px", color: "#7f91a3" }}>
                        Tipe: {l.lessonType.toUpperCase()}
                      </div>
                    </td>
                    <td>{l.reachedStudentsCount} siswa</td>
                    <td>
                      {l.completedStudentsCount} siswa{" "}
                      {l.completionRate !== null && `(${l.completionRate}%)`}
                    </td>
                    <td>
                      {l.proceededToNextCount !== null
                        ? `${l.proceededToNextCount} siswa`
                        : "Materi Terakhir"}
                    </td>
                    <td>
                      {l.notYetProceededRate !== null ? (
                        <strong
                          style={{
                            color:
                              l.notYetProceededRate >= 50
                                ? "#f87171"
                                : l.notYetProceededRate >= 25
                                  ? "#fbbf24"
                                  : "var(--green)",
                          }}
                        >
                          {l.notYetProceededRate}% ({l.notYetProceededCount}{" "}
                          siswa)
                        </strong>
                      ) : (
                        <span style={{ color: "#64748b" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="journal-status-pill">
                        {l.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 4: QUIZ & QUESTION DIFFICULTY INTELLIGENCE */}
      {activeSubView === "quizzes" && (
        <div className="journal-section-stack">
          <div className="journal-panel">
            <h4>
              <TrendingDown
                size={16}
                style={{
                  display: "inline",
                  marginRight: "6px",
                  color: "#f87171",
                  verticalAlign: "-3px",
                }}
              />
              Pertanyaan Kuis dengan Tingkat Keberhasilan Rendah (Sampel Valid ≥{" "}
              {overview.minSafeCohortThreshold} Percobaan)
            </h4>
            {quizzes.lowSuccessQuestions.length === 0 ? (
              <div className="journal-empty-inline">
                Belum ada pertanyaan kuis yang teridentifikasi memiliki tingkat
                kegagalan tinggi pada sampel yang memadai (≥{" "}
                {overview.minSafeCohortThreshold} percobaan). Pertanyaan dengan
                sampel kecil tidak dilabeli bermasalah untuk mencegah bias
                statistik.
              </div>
            ) : (
              <div className="learning-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Kelas &amp; Materi</th>
                      <th>Pertanyaan</th>
                      <th>Percobaan</th>
                      <th>Tingkat Keberhasilan</th>
                      <th>Indikator Kesulitan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzes.lowSuccessQuestions.map((q) => (
                      <tr key={`${q.courseSlug}:${q.lessonId}:${q.questionId}`}>
                        <td>
                          <strong>{q.courseTitle}</strong>
                          <div style={{ fontSize: "11px", color: "#7f91a3" }}>
                            {q.lessonTitle}
                          </div>
                        </td>
                        <td>{q.questionText}</td>
                        <td>{q.attemptsCount}x</td>
                        <td>
                          <strong style={{ color: "#f87171" }}>
                            {q.successRate}% ({q.correctCount}/{q.attemptsCount}
                            )
                          </strong>
                        </td>
                        <td>
                          <span className="journal-status-pill">
                            {q.difficultyStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="journal-panel">
            <h4>
              <HelpCircle
                size={16}
                style={{
                  display: "inline",
                  marginRight: "6px",
                  color: "var(--cyan)",
                  verticalAlign: "-3px",
                }}
              />
              Partisipasi &amp; Kelulusan Kuis per Topik Materi
            </h4>
            <div className="learning-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Kelas &amp; Modul</th>
                    <th>Materi Evaluasi</th>
                    <th>Siswa Berpartisipasi</th>
                    <th>Total Pengumpulan</th>
                    <th>Rata-Rata Skor</th>
                    <th>Tingkat Kelulusan (≥ Syarat)</th>
                    <th>Status Sampel</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.topicPerformance.map((tp) => (
                    <tr key={`${tp.courseSlug}:${tp.lessonId}`}>
                      <td>
                        <strong>
                          {tp.courseNumber} — {tp.courseTitle}
                        </strong>
                        <div style={{ fontSize: "11px", color: "#7f91a3" }}>
                          {tp.moduleTitle}
                        </div>
                      </td>
                      <td>
                        {tp.lessonTitle} (Syarat ≥ {tp.passingScore}%)
                      </td>
                      <td>{tp.participatingStudentsCount} siswa</td>
                      <td>{tp.totalSubmissionsCount}x</td>
                      <td>
                        {tp.averageScore !== null ? (
                          <strong>{tp.averageScore}%</strong>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {tp.passingRate !== null ? (
                          <strong>{tp.passingRate}%</strong>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className="journal-status-pill">
                          {tp.sampleStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 5: ENGAGEMENT, FUNNEL & COHORT RETENTION */}
      {activeSubView === "engagement" && (
        <div className="journal-section-stack">
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <small>Daily Active Learners (24 Jam)</small>
              <strong>{engagement.dailyActiveLearners} Siswa</strong>
            </div>
            <div className="admin-stat-card">
              <small>Weekly Active Learners (7 Hari)</small>
              <strong>{engagement.weeklyActiveLearners} Siswa</strong>
            </div>
            <div className="admin-stat-card">
              <small>Monthly Active Learners (30 Hari)</small>
              <strong>{engagement.monthlyActiveLearners} Siswa</strong>
            </div>
            <div className="admin-stat-card">
              <small>Returning Learners (Aktif Kembali &gt; 1 Hari)</small>
              <strong>
                {engagement.returningLearnersCount} Siswa{" "}
                {engagement.returningLearnersRate !== null &&
                  `(${engagement.returningLearnersRate}%)`}
              </strong>
            </div>
          </div>

          <div className="journal-intel-two-col">
            <div className="journal-panel">
              <h4>Funnel Perjalanan Belajar Siswa</h4>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tahap Funnel</th>
                    <th>Jumlah Siswa</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1. Akun Siswa Terdaftar</td>
                    <td>
                      <strong>{engagement.funnel.registeredStudents}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>2. Memulai Minimal 1 Kelas</td>
                    <td>
                      <strong>
                        {engagement.funnel.startedAtLeastOneCourse}
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <td>3. Menyelesaikan Minimal 1 Pelajaran</td>
                    <td>
                      <strong>
                        {engagement.funnel.completedAtLeastOneLesson}
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <td>4. Mengumpulkan Minimal 1 Evaluasi Kuis</td>
                    <td>
                      <strong>
                        {engagement.funnel.submittedAtLeastOneQuiz}
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <td>5. Menyelesaikan Minimal 1 Kelas Penuh (100%)</td>
                    <td>
                      <strong style={{ color: "var(--green)" }}>
                        {engagement.funnel.completedAtLeastOneCourse}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="journal-panel">
              <h4>Distribusi Ketidakaktifan Siswa</h4>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Status Aktivitas Terakhir</th>
                    <th>Jumlah Siswa</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Aktif dalam 7 Hari Terakhir</td>
                    <td>
                      <strong style={{ color: "var(--green)" }}>
                        {engagement.inactivityDistribution.activeLast7Days}
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Tidak Aktif 8 – 30 Hari</td>
                    <td>
                      <strong style={{ color: "#fbbf24" }}>
                        {engagement.inactivityDistribution.inactive8To30Days}
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Tidak Aktif &gt; 30 Hari</td>
                    <td>
                      <strong style={{ color: "#f87171" }}>
                        {engagement.inactivityDistribution.inactiveOver30Days}
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Belum Pernah Memulai Belajar</td>
                    <td>
                      <strong>
                        {engagement.inactivityDistribution.neverStarted}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="journal-panel">
            <h4>Retensi Berbasis Kohort Minggu Aktivitas Pertama</h4>
            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: 0 }}>
              {engagement.continuityNote}
            </p>
            {engagement.retentionCohorts.length === 0 ? (
              <div className="journal-empty-inline">
                Belum ada kohort aktivitas belajar siswa.
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Minggu Kohort Pertama</th>
                    <th>Ukuran Kohort</th>
                    <th>Siswa Kembali Belajar (Hari Berikutnya)</th>
                    <th>Tingkat Retensi Kohort</th>
                    <th>Status Privasi / Data</th>
                  </tr>
                </thead>
                <tbody>
                  {engagement.retentionCohorts.map((rc) => (
                    <tr key={rc.cohortKey}>
                      <td>
                        <strong>{rc.cohortKey}</strong>
                      </td>
                      <td>{rc.cohortSize} siswa</td>
                      <td>
                        {rc.smallCohortSuppressed
                          ? "Disamarkan (< 3 siswa)"
                          : `${rc.returnedLearnersCount} siswa`}
                      </td>
                      <td>
                        {rc.smallCohortSuppressed
                          ? "—"
                          : `${rc.retentionRate}%`}
                      </td>
                      <td>
                        <span className="journal-status-pill">
                          {rc.smallCohortSuppressed
                            ? "SMALL_COHORT_PROTECTED"
                            : rc.dataStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

