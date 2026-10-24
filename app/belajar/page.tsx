"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAllCourses } from "@/lib/courses-data";
import { CourseCategory, CourseLevel } from "@/lib/types";
import { getStoredProgress, calculateCoursePercentage } from "@/lib/progress";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Filter,
  GraduationCap,
  Layers,
  Search,
  Sparkles,
} from "lucide-react";

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

export default function BelajarPage() {
  const courses = getAllCourses();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CourseCategory | "All">("All");
  const [selectedLevel, setSelectedLevel] = useState<CourseLevel | "All">("All");
  const [userProgressMap, setUserProgressMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const progress = getStoredProgress();
    const map: Record<string, number> = {};
    courses.forEach((c) => {
      const p = progress[c.slug];
      if (p) {
        map[c.slug] = calculateCoursePercentage(c.totalLessons, p.completedLessonIds.length);
      }
    });
    setUserProgressMap(map);
  }, [courses]);

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(search.toLowerCase()) ||
      c.overview.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" || c.category === selectedCategory;

    const matchesLevel = selectedLevel === "All" || c.level === selectedLevel;

    return matchesSearch && matchesCategory && matchesLevel;
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
            Kurikulum edukasi bertahap dari pemahaman likuiditas pasar, aksi harga, struktur market institusional, hingga manajemen risiko psikologis.
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
        </div>
      </section>

      {/* Course Grid */}
      <section className="catalog-grid wrap">
        {filteredCourses.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={40} />
            <h3>Tidak ada kelas yang cocok</h3>
            <p>Coba gunakan kata kunci pencarian lain atau reset filter kategori.</p>
            <button
              className="button button-primary"
              onClick={() => {
                setSearch("");
                setSelectedCategory("All");
                setSelectedLevel("All");
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

              return (
                <article key={course.id} className="course-card">
                  <div className="card-topline">
                    <span className="course-code">{course.number}</span>
                    <span className="course-level-badge">{course.level}</span>
                  </div>

                  <div className="course-category-tag">{course.category}</div>
                  <h2 className="course-card-title">
                    <Link href={`/belajar/${course.slug}`}>{course.title}</Link>
                  </h2>
                  <p className="course-card-subtitle">{course.subtitle}</p>

                  <p className="course-card-overview">{course.overview}</p>

                  {/* Progress bar if started */}
                  {progress > 0 && (
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

                  <div className="course-card-action">
                    <Link href={`/belajar/${course.slug}`} className="course-view-btn">
                      {progress > 0 ? (
                        isCompleted ? "Tinjau Kelas Kembali" : "Lanjutkan Belajar"
                      ) : (
                        "Lihat Silabus & Detail"
                      )}
                      <ArrowUpRight size={15} />
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
