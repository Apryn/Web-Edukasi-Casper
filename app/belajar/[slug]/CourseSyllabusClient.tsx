"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import type { Course, UserCourseProgress } from "@/lib/types";
import {
  evaluateCourseCompletion,
  fetchServerProgressWithStatus,
  getStoredProgress,
  setAuthenticatedSessionUser,
  clearSessionAndProgressStorage,
} from "@/lib/progress";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Layers,
  LineChart,
  RotateCcw,
  ShieldCheck,
  User,
  Video,
} from "lucide-react";

interface CourseSyllabusClientProps {
  course: Course;
  actualTotalLessons: number;
}

export default function CourseSyllabusClient({
  course,
  actualTotalLessons,
}: CourseSyllabusClientProps) {
  const [courseProgress, setCourseProgress] = useState<UserCourseProgress | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState<boolean>(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  const loadSyllabusProgress = useCallback(async () => {
    setIsLoadingProgress(true);
    setProgressError(null);
    try {
      const meRes = await fetch("/api/auth/me");
      if (meRes.status === 401) {
        clearSessionAndProgressStorage();
        const guestAll = getStoredProgress(null);
        setCourseProgress(guestAll[course.slug] || null);
        setIsLoadingProgress(false);
        return;
      }

      if (!meRes.ok) {
        const cached = getStoredProgress()[course.slug] || null;
        setCourseProgress(cached);
        setProgressError("Gagal memuat status progres terbaru dari server.");
        setIsLoadingProgress(false);
        return;
      }

      const meData = await meRes.json();
      if (meData?.user?.id) {
        setAuthenticatedSessionUser(meData.user);
        const serverRes = await fetchServerProgressWithStatus();
        if (serverRes.status === "error") {
          const cached = getStoredProgress(meData.user.id)[course.slug] || null;
          setCourseProgress(cached);
          setProgressError(serverRes.error || "Gagal memuat status progres dari server.");
        } else if (serverRes.status === "ok" && serverRes.progressMap) {
          setCourseProgress(serverRes.progressMap[course.slug] || null);
        } else {
          setCourseProgress(null);
        }
      } else {
        clearSessionAndProgressStorage();
        const guestAll = getStoredProgress(null);
        setCourseProgress(guestAll[course.slug] || null);
      }
    } catch {
      const cached = getStoredProgress()[course.slug] || null;
      setCourseProgress(cached);
      setProgressError("Koneksi terputus saat memuat progres kelas.");
    } finally {
      setIsLoadingProgress(false);
    }
  }, [course.slug]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await loadSyllabusProgress();
    })();
    return () => {
      active = false;
    };
  }, [loadSyllabusProgress]);

  const allLessons = useMemo(
    () => course.modules.flatMap((mod) => mod.lessons),
    [course.modules]
  );

  const evaluation = useMemo(
    () => evaluateCourseCompletion(course, courseProgress),
    [course, courseProgress]
  );

  const completedLessonSet = useMemo(
    () => new Set(evaluation.validCompletedLessonIds),
    [evaluation.validCompletedLessonIds]
  );

  const hasStarted =
    evaluation.completedCount > 0 ||
    Boolean(
      courseProgress?.lastAccessedLessonId &&
        allLessons.some((l) => l.id === courseProgress.lastAccessedLessonId)
    );

  const isCourseCompleted = evaluation.isComplete && evaluation.allQuizzesPassed;

  const courseStatusLabel: "Belum Dimulai" | "Sedang Dipelajari" | "Selesai" = isCourseCompleted
    ? "Selesai"
    : hasStarted
      ? "Sedang Dipelajari"
      : "Belum Dimulai";

  const ctaLabel: "Mulai Belajar" | "Lanjutkan Belajar" | "Tinjau Kembali" = isCourseCompleted
    ? "Tinjau Kembali"
    : hasStarted
      ? "Lanjutkan Belajar"
      : "Mulai Belajar";

  const targetLessonId = useMemo(() => {
    const firstLessonId = allLessons[0]?.id;
    if (!firstLessonId) return "";
    if (isCourseCompleted) return firstLessonId;
    if (hasStarted) {
      const firstUncompleted = allLessons.find((l) => !completedLessonSet.has(l.id));
      if (firstUncompleted) return firstUncompleted.id;
      if (
        courseProgress?.lastAccessedLessonId &&
        allLessons.some((l) => l.id === courseProgress.lastAccessedLessonId)
      ) {
        return courseProgress.lastAccessedLessonId;
      }
    }
    return firstLessonId;
  }, [allLessons, isCourseCompleted, hasStarted, completedLessonSet, courseProgress]);

  const ctaHref = targetLessonId
    ? `/kelas/${course.slug}?lesson=${targetLessonId}`
    : `/kelas/${course.slug}`;

  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb wrap">
        <Link href="/belajar">
          <ArrowLeft size={14} /> Kembali ke Katalog
        </Link>
        <span>/</span>
        <span>{course.category}</span>
        <span>/</span>
        <strong>{course.title}</strong>
      </div>

      {/* Hero Section */}
      <section className="course-detail-hero wrap">
        <div className="course-hero-main">
          <div className="eyebrow">
            <span className="eyebrow-line" /> {course.number} — {course.category.toUpperCase()}
          </div>
          <h1>{course.title}</h1>
          <p className="course-hero-sub">{course.subtitle}</p>

          <p className="course-hero-desc">{course.overview}</p>

          <div className="course-cta-bar">
            <Link href={ctaHref} className="button button-primary">
              {ctaLabel} <ArrowRight size={16} />
            </Link>
            <span className="free-access-tag">
              <ShieldCheck size={16} /> Akses Terbuka Tanpa Biaya Tersembunyi
            </span>
          </div>
        </div>

        {/* Course Meta Sidebar */}
        <div className="course-meta-card">
          <div className="meta-card-header">
            <span>PARAMETER KELAS</span>
            <span className="level-tag">{course.level}</span>
          </div>

          {/* Course Progress Status Panel (BUG-04) */}
          <div className="syllabus-progress-panel" data-testid="syllabus-progress-panel">
            <div className="syllabus-progress-top">
              <span className="syllabus-progress-label">STATUS PROGRES</span>
              <span
                className={`syllabus-status-badge ${
                  courseStatusLabel === "Selesai"
                    ? "completed"
                    : courseStatusLabel === "Sedang Dipelajari"
                      ? "in-progress"
                      : "not-started"
                }`}
              >
                {courseStatusLabel}
              </span>
            </div>

            <div className="progress-track" style={{ marginTop: "10px", marginBottom: "8px" }}>
              <div
                className={`progress-fill ${isCourseCompleted ? "complete" : ""}`}
                style={{ width: `${evaluation.percentage}%` }}
              />
            </div>

            <div className="syllabus-progress-stats">
              <span>
                {isLoadingProgress
                  ? "Memuat progres..."
                  : `${evaluation.completedCount} dari ${actualTotalLessons} pelajaran selesai`}
              </span>
              <strong>{evaluation.percentage}%</strong>
            </div>

            {progressError && (
              <div className="syllabus-progress-error" role="alert">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertCircle size={13} />
                  <span>{progressError}</span>
                </div>
                <button
                  type="button"
                  className="syllabus-retry-btn"
                  onClick={loadSyllabusProgress}
                  disabled={isLoadingProgress}
                >
                  <RotateCcw size={12} /> Coba Lagi
                </button>
              </div>
            )}
          </div>

          <div className="meta-list">
            <div className="meta-row">
              <span className="meta-title">
                <Clock3 size={15} /> Estimasi Waktu
              </span>
              <strong>{course.duration}</strong>
            </div>
            <div className="meta-row">
              <span className="meta-title">
                <Layers size={15} /> Total Materi
              </span>
              <strong>{actualTotalLessons} Pelajaran</strong>
            </div>
            <div className="meta-row">
              <span className="meta-title">
                <BookOpen size={15} /> Jumlah Modul
              </span>
              <strong>{course.modules.length} Modul</strong>
            </div>
            <div className="meta-row">
              <span className="meta-title">
                <Award size={15} /> Format
              </span>
              <strong>Teks, Chart &amp; Kuis</strong>
            </div>
          </div>

          <div className="instructor-box">
            <div className="instructor-avatar">
              <User size={18} />
            </div>
            <div className="instructor-info">
              <span className="instructor-label">INSTRUKTUR PENYUSUN</span>
              <strong className="instructor-name">{course.instructor.name}</strong>
              <small className="instructor-role">{course.instructor.role}</small>
            </div>
          </div>
        </div>
      </section>

      {/* Objectives, Competencies & Prerequisites */}
      <section className="course-body-section wrap">
        <div className="objectives-card">
          <h3>Tujuan Pembelajaran</h3>
          <ul className="objectives-list">
            {course.objectives.map((obj, i) => (
              <li key={i}>
                <CheckCircle2 size={17} className="check-icon" />
                <span>{obj}</span>
              </li>
            ))}
          </ul>

          {course.competencies && course.competencies.length > 0 && (
            <div
              style={{
                marginTop: "24px",
                paddingTop: "20px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h4 style={{ marginBottom: "12px", color: "var(--cyan)" }}>
                Target Kemampuan Setelah Menyelesaikan Kelas
              </h4>
              <ul className="objectives-list">
                {course.competencies.map((comp, idx) => (
                  <li key={idx}>
                    <Award size={16} className="check-icon" />
                    <span>{comp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {course.prerequisites && (
          <div className="prereq-card">
            <h4>Prasyarat Pembelajaran</h4>
            <ul>
              {course.prerequisites.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Curriculum Syllabus */}
      <section className="curriculum-section wrap">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" /> SILABUS KURIKULUM
            </div>
            <h2>Daftar Materi Pembelajaran</h2>
          </div>
          <span className="syllabus-count">
            {course.modules.length} Modul · {actualTotalLessons} Pelajaran
          </span>
        </div>

        <div className="curriculum-accordion">
          {course.modules.map((mod, modIdx) => (
            <div key={mod.id} className="module-block">
              <div className="module-header">
                <div>
                  <span className="mod-num">BAGIAN {String(modIdx + 1).padStart(2, "0")}</span>
                  <h3>{mod.title}</h3>
                  <p>{mod.description}</p>
                </div>
                <span className="mod-lessons-count">{mod.lessons.length} Pelajaran</span>
              </div>

              <div className="lessons-list">
                {mod.lessons.map((lesson, lIdx) => {
                  const isLessonDone = completedLessonSet.has(lesson.id);

                  return (
                    <Link
                      key={lesson.id}
                      href={`/kelas/${course.slug}?lesson=${lesson.id}`}
                      className={`lesson-row ${isLessonDone ? "completed" : ""}`}
                    >
                      <div className="lesson-left">
                        <span className="lesson-num">
                          {modIdx + 1}.{lIdx + 1}
                        </span>
                        {lesson.type === "quiz" ? (
                          <HelpCircle size={16} className="lesson-type-icon quiz" />
                        ) : lesson.type === "video" ? (
                          <Video size={16} className="lesson-type-icon chart" />
                        ) : lesson.type === "chart-study" ? (
                          <LineChart size={16} className="lesson-type-icon chart" />
                        ) : (
                          <BookOpen size={16} className="lesson-type-icon read" />
                        )}
                        <div>
                          <h4>{lesson.title}</h4>
                          <small>{lesson.summary}</small>
                        </div>
                      </div>
                      <div className="lesson-right">
                        {isLessonDone && (
                          <span className="lesson-complete-badge" title="Materi telah diselesaikan">
                            <CheckCircle2 size={13} /> ✓ Selesai
                          </span>
                        )}
                        <span className="lesson-duration">{lesson.duration}</span>
                        <ArrowUpRight size={15} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {(course.courseSummary?.length || course.references?.length) && (
          <div
            className="course-body-section"
            style={{ marginTop: "32px", marginBottom: "32px", padding: 0 }}
          >
            {course.courseSummary && course.courseSummary.length > 0 && (
              <div className="objectives-card">
                <h3>Ringkasan Kelas</h3>
                <ul className="objectives-list">
                  {course.courseSummary.map((item, idx) => (
                    <li key={idx}>
                      <CheckCircle2 size={16} className="check-icon" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {course.references && course.references.length > 0 && (
              <div className="prereq-card">
                <h4>Referensi Belajar</h4>
                <ul>
                  {course.references.map((ref, idx) => (
                    <li key={idx}>{ref}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="curriculum-bottom-cta">
          <div>
            <h3>Siap Mulai Menguasai Materi Ini?</h3>
            <p>Pelajari modul langkah demi langkah dan uji pemahaman dengan kuis di akhir materi.</p>
          </div>
          <Link href={ctaHref} className="button button-primary">
            {ctaLabel} <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}

