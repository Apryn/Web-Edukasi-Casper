"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAllCourses } from "@/lib/courses-data";
import { CourseCategory, CourseLevel } from "@/lib/types";
import {
  getStoredProgress,
  calculateCoursePercentage,
  fetchServerProgress,
} from "@/lib/progress";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Filter,
  Layers,
  Search,
  Sparkles,
  Play,
  RotateCcw,
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
  const courses = getAllCourses();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CourseCategory | "All">("All");
  const [selectedLevel, setSelectedLevel] = useState<CourseLevel | "All">("All");
  const [selectedStatus, setSelectedStatus] = useState<LearningStatusFilter>("All");
  const [userProgressMap, setUserProgressMap] = useState<Record<string, number>>({});
  const [lastLessonMap, setLastLessonMap] = useState<Record<string, string | undefined>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Initial local load
    const local = getStoredProgress();
    const map: Record<string, number> = {};
    const lastMap: Record<string, string | undefined> = {};

    courses.forEach((c) => {
      const p = local[c.slug];
      if (p) {
        map[c.slug] = calculateCoursePercentage(c.totalLessons, p.completedLessonIds.length);
        lastMap[c.slug] = p.lastAccessedLessonId;
      }
    });
    setUserProgressMap(map);
    setLastLessonMap(lastMap);
    setIsLoading(false);

    // 2. Fetch server database sync
    fetchServerProgress().then((merged) => {
      if (merged) {
        const updatedMap: Record<string, number> = {};
        const updatedLastMap: Record<string, string | undefined> = {};
        courses.forEach((c) => {
          const p = merged[c.slug];
          if (p) {
            updatedMap[c.slug] = calculateCoursePercentage(c.totalLessons, p.completedLessonIds.length);
            updatedLastMap[c.slug] = p.lastAccessedLessonId;
          }
        });
        setUserProgressMap(updatedMap);
        setLastLessonMap(updatedLastMap);
      }
    });
  }, [courses]);

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(search.toLowerCase()) ||
      c.overview.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" || c.category === selectedCategory;

    const matchesLevel = selectedLevel === "All" || c.level === selectedLevel;

    const pct = userProgressMap[c.slug] || 0;
    let matchesStatus = true;
    if (selectedStatus === "NotStarted") {
      matchesStatus = pct === 0;
    } else if (selectedStatus === "InProgress") {
      matchesStatus = pct > 0 && pct < 100;
    } else if (selectedStatus === "Completed") {
      matchesStatus = pct === 100;
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
              <strong>9</strong>
              <span>Kelas Utama</span>
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
              const progress = userProgressMap[course.slug] || 0;
              const isCompleted = progress === 100;
              const isStarted = progress > 0;
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
                      <Layers size={13} /> {course.totalLessons} Pelajaran
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
