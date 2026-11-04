"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAllCourses, countCourseLessons } from "@/lib/courses-data";
import { Course, CourseCategory, CourseLevel, UserCourseProgress } from "@/lib/types";
import {
  getStoredProgress,
  fetchServerProgress,
  evaluateCourseCompletion,
  setAuthenticatedSessionUser,
  clearSessionAndProgressStorage,
} from "@/lib/progress";
import {
  ArrowUpRight,
  BookOpen,
  Clock3,
  Filter,
  Layers,
  Search,
  Play,
} from "lucide-react";

type LearningStatusFilter = "All" | "NotStarted" | "InProgress" | "Completed";

const categories: Array<{ label: string; value: CourseCategory | "All" }> = [
  { label: "Semua Kategori", value: "All" },
  { label: "Trading Foundation", value: "Trading Foundation" },
  { label: "Technical Analysis", value: "Technical Analysis" },
  { label: "Market Structure", value: "Market Structure" },
  { label: "Risk & Psychology", value: "Risk & Psychology" },
  { label: "Specialized Asset (XAUUSD)", value: "Specialized Asset" },
];

const levels: Array<{ label: string; value: CourseLevel | "All" }> = [
  { label: "Semua Tingkat", value: "All" },
  { label: "Beginner", value: "Beginner" },
  { label: "Intermediate", value: "Intermediate" },
  { label: "Advanced", value: "Advanced" },
];

const statusFilters: Array<{ label: string; value: LearningStatusFilter }> = [
  { label: "Semua Status", value: "All" },
  { label: "Belum Dimulai", value: "NotStarted" },
  { label: "Sedang Dipelajari", value: "InProgress" },
  { label: "Selesai", value: "Completed" },
];

export default function BelajarPage() {
  const [courses, setCourses] = useState<Course[]>(() => getAllCourses());
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CourseCategory | "All">("All");
  const [selectedLevel, setSelectedLevel] = useState<CourseLevel | "All">("All");
  const [selectedStatus, setSelectedStatus] = useState<LearningStatusFilter>("All");
  const [userProgressMap, setUserProgressMap] = useState<Record<string, number>>({});
  const [lastLessonMap, setLastLessonMap] = useState<Record<string, string | undefined>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const computeProgressState = (
      courseList: Course[],
      progressSource: Record<string, UserCourseProgress>
    ) => {
      const map: Record<string, number> = {};
      const lastMap: Record<string, string | undefined> = {};

      courseList.forEach((c) => {
        const p = progressSource[c.slug];
        if (p) {
          const evalResult = evaluateCourseCompletion(c, p);
          map[c.slug] = evalResult.percentage;
          lastMap[c.slug] = p.lastAccessedLessonId;
        }
      });

      if (active) {
        setUserProgressMap(map);
        setLastLessonMap(lastMap);
      }
    };

    async function initCatalog() {
      let currentCourseList = getAllCourses();
      try {
        const resCourses = await fetch("/api/courses");
        if (resCourses.ok) {
          const dataCourses = await resCourses.json();
          if (Array.isArray(dataCourses.courses) && dataCourses.courses.length > 0) {
            currentCourseList = dataCourses.courses;
            if (active) setCourses(currentCourseList);
          }
        }
      } catch {
        // Fallback to static courses
      }

      try {
        const meRes = await fetch("/api/auth/me");
        const meData = await meRes.json();
        if (meData?.user?.id) {
          setAuthenticatedSessionUser(meData.user);
          computeProgressState(currentCourseList, getStoredProgress(meData.user.id));
          const serverMap = await fetchServerProgress();
          if (serverMap) {
            computeProgressState(currentCourseList, serverMap);
          }
        } else {
          clearSessionAndProgressStorage();
          computeProgressState(currentCourseList, {});
        }
      } catch {
        computeProgressState(currentCourseList, getStoredProgress());
      } finally {
        if (active) setIsLoading(false);
      }
    }

    initCatalog();

    return () => {
      active = false;
    };
  }, []);

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(search.toLowerCase()) ||
      c.overview.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" || c.category === selectedCategory;

    const matchesLevel = selectedLevel === "All" || c.level === selectedLevel;

    const actualTotal = countCourseLessons(c);
    const pct = userProgressMap[c.slug] || 0;
    let matchesStatus = true;
    if (selectedStatus === "NotStarted") {
      matchesStatus = pct === 0;
    } else if (selectedStatus === "InProgress") {
      matchesStatus = pct > 0 && pct < 100;
    } else if (selectedStatus === "Completed") {
      matchesStatus = actualTotal > 0 && pct === 100;
    }

    return matchesSearch && matchesCategory && matchesLevel && matchesStatus;
  });

  return (
    <main>
      <Navbar />

      {/* Academy Hero Header */}
      <section className="academy-header wrap">
        <div className="academy-hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" /> SIGNAL CASPER ACADEMY
            <span className="eyebrow-muted">KURIKULUM TRADING TERSTRUKTUR</span>
          </div>
          <h1>
            Katalog Kelas Trading.<br />
            <em>Bukan Jalan Pintas. Ini Proses.</em>
          </h1>
          <p className="hero-description">
            Kurikulum edukasi bertahap dari pemahaman likuiditas pasar, aksi harga, struktur market institusional, hingga manajemen risiko psikologis. Semua kelas 100% gratis dan terstruktur.
          </p>

          <div className="academy-stats-row">
            <div className="stat-box">
              <strong>{courses.length}</strong>
              <span>Kelas Aktif</span>
            </div>
            <div className="stat-box">
              <strong>50+</strong>
              <span>Modul &amp; Pelajaran</span>
            </div>
            <div className="stat-box">
              <strong>100%</strong>
              <span>Studi Kasus &amp; Kuis</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Search Bar */}
      <section className="catalog-toolbar wrap">
        <div className="search-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Cari materi: misal Market Structure, XAUUSD, Candlestick..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <span className="filter-label"><Filter size={13} /> KATEGORI:</span>
            <div className="filter-pills">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  className={`pill-btn ${selectedCategory === cat.value ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat.value)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">TINGKAT:</span>
            <div className="filter-pills">
              {levels.map((lvl) => (
                <button
                  key={lvl.value}
                  className={`pill-btn ${selectedLevel === lvl.value ? "active" : ""}`}
                  onClick={() => setSelectedLevel(lvl.value)}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">STATUS BELAJAR:</span>
            <div className="filter-pills">
              {statusFilters.map((st) => (
                <button
                  key={st.value}
                  className={`pill-btn ${selectedStatus === st.value ? "active" : ""}`}
                  onClick={() => setSelectedStatus(st.value)}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Course Grid */}
      <section className="catalog-grid wrap">
        {isLoading ? (
          <div className="classroom-loading">
            <div className="loading-spinner" />
            <p>Memuat katalog kelas...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={40} />
            <h3>Tidak ada kelas yang cocok</h3>
            <p>Coba gunakan kata kunci pencarian lain atau reset filter kategori/status.</p>
            <button
              className="button button-primary"
              onClick={() => {
                setSearch("");
                setSelectedCategory("All");
                setSelectedLevel("All");
                setSelectedStatus("All");
              }}
            >
              Reset Semua Filter
            </button>
          </div>
        ) : (
          <div className="courses-grid">
            {filteredCourses.map((course) => {
              const actualTotalLessons = countCourseLessons(course);
              const progress = userProgressMap[course.slug] || 0;
              const isCompleted = actualTotalLessons > 0 && progress === 100;
              const isStarted = actualTotalLessons > 0 && progress > 0;
              const lastLessonId = lastLessonMap[course.slug];

              const directClassroomHref = lastLessonId
                ? `/kelas/${course.slug}?lesson=${lastLessonId}`
                : `/kelas/${course.slug}`;

              return (
                <article key={course.id} className="course-card">
                  <div className="card-topline">
                    <span className="course-code">{course.number}</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {isCompleted ? (
                        <span className="badge-role" style={{ background: "#0e2920", color: "#86efac", border: "1px solid #14532d" }}>
                          Selesai ✓
                        </span>
                      ) : isStarted ? (
                        <span className="badge-role" style={{ background: "#17283c", color: "var(--cyan)", border: "1px solid #1e3a5f" }}>
                          {progress}% Berjalan
                        </span>
                      ) : null}
                      <span className="course-level-badge">{course.level}</span>
                    </div>
                  </div>

                  <div className="course-category-tag">{course.category}</div>
                  <h2 className="course-card-title">
                    <Link href={`/belajar/${course.slug}`}>{course.title}</Link>
                  </h2>
                  <p className="course-card-subtitle">{course.subtitle}</p>

                  <p className="course-card-overview">{course.overview}</p>

                  {/* Progress bar if started */}
                  {isStarted && (
                    <div className="card-progress">
                      <div className="progress-info">
                        <span>Progres Anda</span>
                        <strong>{progress}%</strong>
                      </div>
                      <div className="progress-track">
                        <div
                          className={`progress-fill ${isCompleted ? "complete" : ""}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="course-card-meta">
                    <span className="meta-item">
                      <Clock3 size={13} /> {course.duration}
                    </span>
                    <span className="meta-item">
                      <Layers size={13} /> {actualTotalLessons} Pelajaran
                    </span>
                  </div>

                  <div className="course-card-action" style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                    <Link href={`/belajar/${course.slug}`} className="course-view-btn" style={{ flex: 1 }}>
                      Silabus <ArrowUpRight size={14} />
                    </Link>
                    <Link href={directClassroomHref} className="button button-primary" style={{ padding: "8px 14px", fontSize: "12px" }}>
                      {isCompleted ? "Ulas Materi" : isStarted ? "Lanjut" : "Mulai"} <Play size={13} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
