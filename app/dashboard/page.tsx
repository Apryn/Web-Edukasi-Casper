"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAllCourses } from "@/lib/courses-data";
import { getStoredProgress, calculateCoursePercentage } from "@/lib/progress";
import { UserCourseProgress } from "@/lib/types";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  GraduationCap,
  Layers,
  LogOut,
  Sparkles,
  Trophy,
  User,
} from "lucide-react";

export default function DashboardPage() {
  const allCourses = getAllCourses();
  const [progressMap, setProgressMap] = useState<Record<string, UserCourseProgress>>({});
  const [currentUser, setCurrentUser] = useState<{ id?: string; name?: string; email?: string } | null>(null);

  useEffect(() => {
    // 1. Load initial local progress
    setProgressMap(getStoredProgress());

    // 2. Fetch authenticated user profile
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
        } else if (typeof window !== "undefined") {
          const raw = localStorage.getItem("sc_user_session");
          if (raw) setCurrentUser(JSON.parse(raw));
        }
      })
      .catch(() => {});

    // 3. Sync with server SQLite database
    import("@/lib/progress").then(({ fetchServerProgress }) => {
      fetchServerProgress().then((merged) => {
        if (merged) setProgressMap(merged);
      });
    });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      localStorage.removeItem("sc_user_session");
    }
    window.location.href = "/login";
  };

  const enrolledSlugs = Object.keys(progressMap);
  const enrolledCourses = allCourses.filter((c) => enrolledSlugs.includes(c.slug));

  let totalCompletedLessons = 0;
  let totalLessonsEnrolled = 0;

  enrolledCourses.forEach((c) => {
    const p = progressMap[c.slug];
    if (p) {
      totalCompletedLessons += p.completedLessonIds.length;
      totalLessonsEnrolled += c.totalLessons;
    }
  });

  const overallPercentage =
    totalLessonsEnrolled > 0
      ? Math.round((totalCompletedLessons / totalLessonsEnrolled) * 100)
      : 0;

  // Find active course to resume (most recently updated or first)
  const activeCourse =
    enrolledCourses.length > 0
      ? enrolledCourses.sort((a, b) => {
          const timeA = new Date(progressMap[a.slug]?.updatedAt || 0).getTime();
          const timeB = new Date(progressMap[b.slug]?.updatedAt || 0).getTime();
          return timeB - timeA;
        })[0]
      : allCourses[0];

  const activeProgress = activeCourse ? progressMap[activeCourse.slug] : null;
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
                    {calculateCoursePercentage(
                      activeCourse.totalLessons,
                      activeProgress?.completedLessonIds.length || 0
                    )}
                    %
                  </b>
                </span>
                <span>
                  {activeProgress?.completedLessonIds.length || 0} dari{" "}
                  {activeCourse.totalLessons} Pelajaran Selesai
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${calculateCoursePercentage(
                      activeCourse.totalLessons,
                      activeProgress?.completedLessonIds.length || 0
                    )}%`,
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

      {/* Metrics Row */}
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
              const pct = calculateCoursePercentage(
                course.totalLessons,
                p?.completedLessonIds.length || 0
              );
              const isComplete = pct === 100;

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

                  <div className="course-card-action">
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

      <Footer />
    </main>
  );
}
