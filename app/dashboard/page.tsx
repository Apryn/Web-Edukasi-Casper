"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getStaticCourses, countCourseLessons } from "@/lib/courses-data";
import {
  getStoredProgress,
  calculateCoursePercentage,
  evaluateCourseCompletion,
  fetchServerProgress,
  setAuthenticatedSessionUser,
  clearSessionAndProgressStorage,
} from "@/lib/progress";
import { UserCourseProgress, Course } from "@/lib/types";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  LogOut,
  Sparkles,
  Trophy,
  Printer,
  X,
  BarChart3,
} from "lucide-react";
import StudentJournalWorkspace from "./StudentJournalWorkspace";
import StudentLearningWorkspace from "./StudentLearningWorkspace";

export default function DashboardPage() {
  const [allCourses, setAllCourses] = useState<Course[]>(() => getStaticCourses());
  const [progressMap, setProgressMap] = useState<Record<string, UserCourseProgress>>({});
  const [currentUser, setCurrentUser] = useState<{ id?: string; name?: string; email?: string; role?: string } | null>(null);
  const [selectedCertCourse, setSelectedCertCourse] = useState<Course | null>(null);
  const [dashboardMode, setDashboardMode] = useState<"learning" | "journal">("learning");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkModeFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("tab") === "journal" || window.location.hash === "#journal") {
          setDashboardMode("journal");
        } else if (params.get("tab") === "learning") {
          setDashboardMode("learning");
        }
      };
      checkModeFromUrl();
      window.addEventListener("popstate", checkModeFromUrl);
      return () => window.removeEventListener("popstate", checkModeFromUrl);
    }
  }, []);

  useEffect(() => {
    // 1. Load initial local progress for active session user (if any)
    setProgressMap(getStoredProgress());

    // 2. Fetch all courses (static + custom courses)
    fetch("/api/courses")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.courses && Array.isArray(data.courses)) {
          setAllCourses(data.courses);
        }
      })
      .catch(() => {});

    // 3. Verify authenticated user profile from server cookie (no local fallback)
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user?.id) {
          setAuthenticatedSessionUser(data.user);
          setCurrentUser(data.user);
          setProgressMap(getStoredProgress(data.user.id));

          fetchServerProgress().then((merged) => {
            if (merged) setProgressMap(merged);
          });
        } else {
          clearSessionAndProgressStorage();
          setCurrentUser(null);
          setProgressMap({});
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearSessionAndProgressStorage();
    setCurrentUser(null);
    setProgressMap({});
    window.location.href = "/login";
  };

  const enrolledSlugs = Object.keys(progressMap);
  const enrolledCourses = allCourses.filter((c) => enrolledSlugs.includes(c.slug));

  let totalCompletedLessons = 0;
  let totalLessonsEnrolled = 0;

  enrolledCourses.forEach((c) => {
    const p = progressMap[c.slug];
    if (p) {
      const evalState = evaluateCourseCompletion(c, p);
      totalCompletedLessons += evalState.completedCount;
      totalLessonsEnrolled += evalState.totalLessons;
    }
  });

  const overallPercentage =
    totalLessonsEnrolled > 0
      ? Math.round((totalCompletedLessons / totalLessonsEnrolled) * 100)
      : 0;

  // Find active course to resume (most recently updated or first)
  const activeCourse =
    enrolledCourses.length > 0
      ? [...enrolledCourses].sort((a, b) => {
          const timeA = new Date(progressMap[a.slug]?.updatedAt || 0).getTime();
          const timeB = new Date(progressMap[b.slug]?.updatedAt || 0).getTime();
          return timeB - timeA;
        })[0]
      : allCourses[0];

  const activeProgress = activeCourse ? progressMap[activeCourse.slug] : null;
  const activeCourseEval = activeCourse
    ? evaluateCourseCompletion(activeCourse, activeProgress)
    : null;
  const activeResumeLessonId = activeProgress?.lastAccessedLessonId;
  const resumeHref = activeCourse
    ? activeResumeLessonId
      ? `/kelas/${activeCourse.slug}?lesson=${activeResumeLessonId}`
      : `/kelas/${activeCourse.slug}`
    : "/belajar";

  return (
    <main>
      <Navbar />

      <section className="dashboard-hero wrap">
        <div className="dashboard-welcome">
          <div className="eyebrow">
            <span className="eyebrow-line" /> STUDENT PORTAL
            <span className="eyebrow-muted">CASPER ACADEMY DASHBOARD</span>
            {currentUser && (
              <button onClick={handleLogout} className="dashboard-logout-link" title="Keluar akun">
                <LogOut size={13} /> Keluar
              </button>
            )}
          </div>
          <h1>
            Halo, {currentUser?.name || "Trader"}.<br />
            <em>Disiplin Dibangun Setiap Hari.</em>
          </h1>
          <p className="hero-description">
            Pantau progres modul, riwayat pelajaran, dan kuis Anda. Data tersinkronisasi otomatis dengan database server Casper.
          </p>
        </div>

        {currentUser?.role === "ADMIN" && (
          <div className="admin-dashboard-banner">
            <div className="admin-banner-text">
              <span className="admin-banner-tag">ADMIN ACCESS</span>
              <span>Anda masuk sebagai Administrator. Kelola kurikulum, kelas baru, dan data seluruh siswa.</span>
            </div>
            <Link href="/admin" className="button button-primary" style={{ padding: "6px 14px", fontSize: "12px" }}>
              Buka Panel Admin <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Highlight Resume Card */}
        {activeCourse && (
          <div className="resume-hero-card">
            <div className="resume-tag">
              <Sparkles size={14} /> KELAS AKTIF ANDA
            </div>
            <h2>{activeCourse.title}</h2>
            <p>{activeCourse.subtitle}</p>

            <div className="resume-progress-box">
              <div className="resume-meta">
                <span>
                  Progres:{" "}
                  <b>
                    {activeCourseEval?.percentage ??
                      calculateCoursePercentage(
                        countCourseLessons(activeCourse),
                        activeProgress?.completedLessonIds.length || 0
                      )}
                    %
                  </b>
                </span>
                <span>
                  {activeCourseEval?.completedCount ??
                    (activeProgress?.completedLessonIds.length || 0)}{" "}
                  dari {activeCourseEval?.totalLessons ?? countCourseLessons(activeCourse)}{" "}
                  Pelajaran Selesai
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${
                      activeCourseEval?.percentage ??
                      calculateCoursePercentage(
                        countCourseLessons(activeCourse),
                        activeProgress?.completedLessonIds.length || 0
                      )
                    }%`,
                  }}
                />
              </div>
            </div>

            <Link href={resumeHref} className="button button-primary">
              Lanjutkan Belajar <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>

      {/* Portal Mode Switcher: Learning Intelligence vs Trading Journal & Analytics */}
      <section className="wrap dashboard-mode-bar">
        <div className="dashboard-mode-tabs">
          <button
            type="button"
            className={`dashboard-mode-tab ${dashboardMode === "learning" ? "active" : ""}`}
            onClick={() => setDashboardMode("learning")}
          >
            <GraduationCap size={16} /> Learning Intelligence &amp; Kurikulum ({enrolledCourses.length})
          </button>
          <button
            type="button"
            className={`dashboard-mode-tab ${dashboardMode === "journal" ? "active" : ""}`}
            onClick={() => setDashboardMode("journal")}
          >
            <BarChart3 size={16} /> Trading Journal &amp; Performance Analytics
          </button>
        </div>
      </section>

      {dashboardMode === "journal" && (
        <section className="wrap journal-outer-section">
          {currentUser?.id ? (
            <StudentJournalWorkspace currentUser={currentUser} />
          ) : (
            <div className="empty-dashboard-box">
              <BarChart3 size={36} />
              <h3>Masuk untuk Membuka Jurnal Trading &amp; Analitik Performa</h3>
              <p>
                Jurnal Trading Kuantitatif disimpan secara terisolasi dan aman di server Casper Academy untuk setiap akun siswa.
              </p>
              <Link href="/login" className="button button-primary">
                Login Akun Siswa <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Learning Intelligence & Adaptive Curriculum Workspace */}
      {dashboardMode === "learning" && (
      <>
      {currentUser?.id ? (
        <section className="wrap journal-outer-section">
          <StudentLearningWorkspace
            currentUser={currentUser}
            allCourses={allCourses}
            onOpenCertificate={(c) => setSelectedCertCourse(c)}
          />
        </section>
      ) : (
      <>
      <section className="dashboard-metrics wrap">
        <div className="metric-card">
          <div className="metric-icon">
            <GraduationCap size={22} />
          </div>
          <div className="metric-value">{enrolledCourses.length}</div>
          <div className="metric-label">Kelas Diikuti</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <CheckCircle2 size={22} />
          </div>
          <div className="metric-value">{totalCompletedLessons}</div>
          <div className="metric-label">Materi Diselesaikan</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <Trophy size={22} />
          </div>
          <div className="metric-value">{overallPercentage}%</div>
          <div className="metric-label">Rata-Rata Kelulusan</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <Clock size={22} />
          </div>
          <div className="metric-value">Proses</div>
          <div className="metric-label">Mindset Berkelanjutan</div>
        </div>
      </section>

      {/* Enrolled Courses Section */}
      <section className="enrolled-section wrap">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" /> KURSUS SAYA
            </div>
            <h2>Kelas yang Sedang Dipelajari</h2>
          </div>
          <Link href="/belajar" className="text-link">
            Jelajahi Kelas Lain <ArrowUpRight size={15} />
          </Link>
        </div>

        {enrolledCourses.length === 0 ? (
          <div className="empty-dashboard-box">
            <BookOpen size={36} />
            <h3>Belum Ada Kelas yang Diikuti</h3>
            <p>
              Pilih kelas dari katalog untuk mulai membangun pemahaman struktur pasar trading Anda.
            </p>
            <Link href="/belajar" className="button button-primary">
              Buka Katalog Kelas <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="courses-grid">
            {enrolledCourses.map((course) => {
              const p = progressMap[course.slug];
              const evalState = evaluateCourseCompletion(course, p);
              const pct = evalState.percentage;
              const isComplete = evalState.isComplete;
              const courseQuizLessons = course.modules.flatMap((m) => m.lessons).filter((l) => l.type === "quiz");
              const hasQuiz = courseQuizLessons.length > 0;
              const allQuizzesPassed = evalState.allQuizzesPassed;
              const isEligibleForCertificate = evalState.isEligibleForCertificate;

              return (
                <div key={course.id} className="course-card">
                  <div className="card-topline">
                    <span className="course-code">{course.number}</span>
                    <span className="course-level-badge">{course.level}</span>
                  </div>

                  <h3 className="course-card-title">
                    <Link href={`/belajar/${course.slug}`}>{course.title}</Link>
                  </h3>
                  <p className="course-card-subtitle">{course.subtitle}</p>

                  <div className="card-progress">
                    <div className="progress-info">
                      <span>Progres Belajar</span>
                      <strong>{pct}%</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${isComplete ? "complete" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {(() => {
                    const quizScores = p?.quizScores ? Object.values(p.quizScores) : [];
                    const highestScore = quizScores.length > 0 ? Math.max(...quizScores) : null;
                    if (highestScore !== null) {
                      return (
                        <div className={`course-quiz-badge ${highestScore >= 70 ? "passed" : "pending"}`}>
                          <Trophy size={11} /> Skor Kuis: {highestScore}% ({highestScore >= 70 ? "Lulus" : "Perlu Ulang"})
                        </div>
                      );
                    }
                    if (hasQuiz) {
                      return (
                        <div className="course-quiz-badge pending">
                          <Trophy size={11} /> Kuis Belum Dikerjakan (Syarat Lulus: ≥ 70%)
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {isComplete && !allQuizzesPassed && (
                    <div className="course-quiz-badge pending" style={{ background: "#281710", borderColor: "#78350f", color: "#fdba74" }}>
                      <Award size={11} /> Sertifikat tertunda: Kuis wajib lulus ≥ 70%
                    </div>
                  )}

                  <div className="course-card-action" style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <Link
                      href={
                        p?.lastAccessedLessonId
                          ? `/kelas/${course.slug}?lesson=${p.lastAccessedLessonId}`
                          : `/kelas/${course.slug}`
                      }
                      className="course-view-btn"
                    >
                      {isComplete ? "Tinjau Materi" : "Lanjutkan"} <ArrowUpRight size={15} />
                    </Link>
                    {isEligibleForCertificate && (
                      <button
                        onClick={() => setSelectedCertCourse(course)}
                        className="course-view-btn"
                        style={{ background: "#162b3a", borderColor: "var(--cyan)", color: "var(--cyan)" }}
                        title="Buka Sertifikat Kelulusan Resmi"
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
      </section>

      {/* Suggested Curriculum Progression */}
      <section className="suggested-section wrap">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" /> REKOMENDASI JALUR BELAJAR
            </div>
            <h2>Peta Kurikulum Lengkap</h2>
          </div>
        </div>

        <div className="path-grid">
          {allCourses.slice(0, 4).map((c, i) => (
            <div key={c.id} className="path-card">
              <span className="path-step">FASE 0{i + 1}</span>
              <h4>{c.title}</h4>
              <p>{c.subtitle}</p>
              <Link href={`/belajar/${c.slug}`} className="path-link">
                Lihat Silabus <ArrowUpRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>
      </>
      )}
      </>
      )}

      {/* Certificate Modal */}
      {selectedCertCourse && (
        <div className="certificate-modal-overlay" onClick={() => setSelectedCertCourse(null)}>
          <div className="certificate-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="certificate-close-btn"
              onClick={() => setSelectedCertCourse(null)}
              title="Tutup"
            >
              <X size={16} />
            </button>

            <div className="certificate-canvas">
              <div className="cert-brand">
                <Award size={20} color="var(--cyan)" />
                <span className="cert-brand-text">SIGNAL CASPER ACADEMY</span>
              </div>

              <div className="cert-title">SERTIFIKAT KELULUSAN</div>
              <div className="cert-subtitle">CERTIFICATE OF ACADEMIC COMPLETION</div>

              <div className="cert-presented-to">DIBERIKAN DENGAN BANGGA KEPADA</div>
              <div className="cert-recipient">{currentUser?.name || "Trader Disiplin"}</div>

              <div className="cert-description">
                Telah sukses menyelesaikan kurikulum komprehensif, evaluasi pemahaman pasar,
                dan kuis kelulusan materi dengan predikat memuaskan pada program:
                <br />
                <strong style={{ color: "var(--cyan)", display: "block", marginTop: "6px", fontSize: "15px" }}>
                  {selectedCertCourse.title} ({selectedCertCourse.level})
                </strong>
              </div>

              <div className="cert-meta-grid">
                <div className="cert-meta-item">
                  <small>KREDENSIAL ID</small>
                  <strong>CASPER-{(currentUser?.id || "STD").slice(0, 8).toUpperCase()}-{(selectedCertCourse.id || "C").toUpperCase()}</strong>
                </div>
                <div className="cert-meta-item">
                  <small>TANGGAL VERIFIKASI</small>
                  <strong>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</strong>
                </div>
              </div>
            </div>

            <div className="cert-actions">
              <button
                className="button button-secondary"
                onClick={() => setSelectedCertCourse(null)}
              >
                Tutup
              </button>
              <button
                className="button button-primary"
                onClick={() => window.print()}
              >
                <Printer size={15} /> Cetak / Unduh PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
