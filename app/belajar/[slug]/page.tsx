import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCourseBySlug, getAllCourses } from "@/lib/courses-data";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  HelpCircle,
  Layers,
  LineChart,
  ShieldCheck,
  User,
  Video,
} from "lucide-react";

export function generateStaticParams() {
  const courses = getAllCourses();
  return courses.map((course) => ({
    slug: course.slug,
  }));
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = getCourseBySlug(slug);

  if (!course) {
    notFound();
  }

  const firstLesson = course.modules[0]?.lessons[0];
  const startHref = firstLesson
    ? `/kelas/${course.slug}?lesson=${firstLesson.id}`
    : `/kelas/${course.slug}`;

  return (
    <main>
      <Navbar />

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
            <Link href={startHref} className="button button-primary">
              Mulai Belajar Sekarang <ArrowRight size={16} />
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

          <div className="meta-list">
            <div className="meta-row">
              <span className="meta-title"><Clock3 size={15} /> Estimasi Waktu</span>
              <strong>{course.duration}</strong>
            </div>
            <div className="meta-row">
              <span className="meta-title"><Layers size={15} /> Total Materi</span>
              <strong>{course.totalLessons} Pelajaran</strong>
            </div>
            <div className="meta-row">
              <span className="meta-title"><BookOpen size={15} /> Jumlah Modul</span>
              <strong>{course.modules.length} Modul</strong>
            </div>
            <div className="meta-row">
              <span className="meta-title"><Award size={15} /> Format</span>
              <strong>Teks, Chart &amp; Kuis</strong>
            </div>
          </div>

          <div className="instructor-box">
            <div className="instructor-avatar">
              <User size={18} />
            </div>
            <div>
              <span className="instructor-label">INSTRUKTUR PENYUSUN</span>
              <strong>{course.instructor.name}</strong>
              <small>{course.instructor.role}</small>
            </div>
          </div>
        </div>
      </section>

      {/* Objectives & Prerequisites */}
      <section className="course-body-section wrap">
        <div className="objectives-card">
          <h3>Target Kompetensi Belajar</h3>
          <ul className="objectives-list">
            {course.objectives.map((obj, i) => (
              <li key={i}>
                <CheckCircle2 size={17} className="check-icon" />
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </div>

        {course.prerequisites && (
          <div className="prereq-card">
            <h4>Prasyarat Mengikuti Kelas</h4>
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
            {course.modules.length} Modul · {course.totalLessons} Pelajaran
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
                {mod.lessons.map((lesson, lIdx) => (
                  <Link
                    key={lesson.id}
                    href={`/kelas/${course.slug}?lesson=${lesson.id}`}
                    className="lesson-row"
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
                      <span className="lesson-duration">{lesson.duration}</span>
                      <ArrowUpRight size={15} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="curriculum-bottom-cta">
          <div>
            <h3>Siap Mulai Menguasai Materi Ini?</h3>
            <p>Pelajari modul langkah demi langkah dan uji pemahaman dengan kuis di akhir materi.</p>
          </div>
          <Link href={startHref} className="button button-primary">
            Masuk ke Ruang Belajar <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
