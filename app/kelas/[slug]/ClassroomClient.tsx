"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Course, Lesson, QuizSubmissionReview } from "@/lib/types";
import {
  enrollCourse,
  toggleLessonComplete,
  calculateCoursePercentage,
  fetchServerProgress,
} from "@/lib/progress";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronLeft,
  Circle,
  HelpCircle,
  LayoutList,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Video,
  X,
  AlertCircle,
} from "lucide-react";

const studyCandles: [number, number, number, number, boolean][] = [
  [30, 80, 30, 20, false],
  [60, 95, 25, 18, false],
  [90, 85, 35, 22, true],
  [120, 70, 30, 25, true],
  [150, 60, 25, 20, true],
  [180, 75, 28, 24, false],
  [210, 88, 32, 28, false],
  [240, 105, 15, 38, true],
  [270, 90, 30, 20, true],
  [300, 70, 38, 22, true],
  [330, 55, 35, 18, true],
  [360, 40, 30, 20, true],
  [390, 48, 26, 22, false],
  [420, 35, 32, 19, true],
  [450, 25, 28, 16, true],
];

interface QuizEvalState {
  score: number;
  passed: boolean;
  passingScore: number;
  review: QuizSubmissionReview[];
}

function ClassroomInner({ course }: { course: Course }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Flatten all lessons in order
  const allLessons = useMemo(() => {
    const list: Array<{ lesson: Lesson; moduleTitle: string; moduleIndex: number }> = [];
    course.modules.forEach((mod, modIdx) => {
      mod.lessons.forEach((l) => {
        list.push({ lesson: l, moduleTitle: mod.title, moduleIndex: modIdx });
      });
    });
    return list;
  }, [course]);

  // Determine current lesson from query param or fallback to first
  const lessonIdFromParam = searchParams.get("lesson");
  const [currentLessonId, setCurrentLessonId] = useState<string>(() => {
    if (lessonIdFromParam && allLessons.some((item) => item.lesson.id === lessonIdFromParam)) {
      return lessonIdFromParam;
    }
    return allLessons[0]?.lesson.id || "";
  });

  // State for user progress
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Server-side Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizEvaluation, setQuizEvaluation] = useState<QuizEvalState | null>(null);

  useEffect(() => {
    // 1. Initial local enrollment
    const p = enrollCourse(course.slug, allLessons[0]?.lesson.id);
    setCompletedIds(p.completedLessonIds);

    // 2. Fetch server database progress if authenticated
    fetchServerProgress().then((merged) => {
      if (merged && merged[course.slug]) {
        setCompletedIds(merged[course.slug].completedLessonIds);
      }
    });

    // If param changes, update current lesson
    if (lessonIdFromParam && allLessons.some((item) => item.lesson.id === lessonIdFromParam)) {
      setCurrentLessonId(lessonIdFromParam);
    }
  }, [course.slug, lessonIdFromParam, allLessons]);

  // Reset quiz state when switching lessons
  useEffect(() => {
    setSelectedAnswers({});
    setQuizEvaluation(null);
    setQuizError(null);
  }, [currentLessonId]);

  const currentIndex = allLessons.findIndex((item) => item.lesson.id === currentLessonId);
  const currentItem = allLessons[currentIndex] || allLessons[0];
  const currentLesson = currentItem?.lesson;

  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1]?.lesson : null;
  const nextLesson =
    currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1]?.lesson : null;

  const isCurrentCompleted = completedIds.includes(currentLessonId);
  const progressPercent = calculateCoursePercentage(course.totalLessons, completedIds.length);
  const isCourseFullyCompleted = progressPercent === 100;

  const handleSelectLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
    router.push(`/kelas/${course.slug}?lesson=${lessonId}`, { scroll: false });
    setSidebarOpen(false);
  };

  const handleToggleComplete = () => {
    const isNowComplete = toggleLessonComplete(course.slug, currentLessonId);
    if (isNowComplete) {
      setCompletedIds((prev) => [...prev, currentLessonId]);
    } else {
      setCompletedIds((prev) => prev.filter((id) => id !== currentLessonId));
    }
  };

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (quizEvaluation) return; // Locked once evaluated
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  // Submit quiz to server for rigorous evaluation
  const handleSubmitQuiz = async () => {
    if (!currentLesson?.quiz || isSubmittingQuiz) return;
    setIsSubmittingQuiz(true);
    setQuizError(null);

    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: course.slug,
          lessonId: currentLesson.id,
          answers: selectedAnswers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengevaluasi kuis di server.");
      }

      setQuizEvaluation({
        score: data.score,
        passed: data.passed,
        passingScore: data.passingScore,
        review: data.review,
      });

      // Update completed lessons if passed
      if (data.updatedProgress?.completedLessonIds) {
        setCompletedIds(data.updatedProgress.completedLessonIds);
      } else if (data.passed) {
        setCompletedIds((prev) => (prev.includes(currentLesson.id) ? prev : [...prev, currentLesson.id]));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses kuis.";
      setQuizError(msg);
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  return (
    <div className="classroom-layout">
      {/* Top Bar */}
      <header className="classroom-topbar">
        <div className="classroom-brand">
          <Link href={`/belajar/${course.slug}`} className="back-link">
            <ChevronLeft size={16} /> Detail Silabus
          </Link>
          <span className="brand-divider">/</span>
          <span className="classroom-course-title">{course.title}</span>
        </div>

        <div className="classroom-top-progress">
          <div className="progress-bar-wrap">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="progress-text">{progressPercent}% Selesai</span>
        </div>

        <div className="classroom-actions">
          <Link href="/dashboard" className="exit-btn">
            Dashboard Siswa
          </Link>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle daftar materi"
          >
            <LayoutList size={18} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="classroom-body">
        {/* Sidebar Syllabus */}
        <aside className={`classroom-sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <div>
              <span className="sidebar-eyebrow">KURIKULUM PEMBELAJARAN</span>
              <h3>{course.title}</h3>
            </div>
            <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="sidebar-modules">
            {course.modules.map((mod, modIdx) => (
              <div key={mod.id} className="sidebar-mod-group">
                <div className="sidebar-mod-title">
                  <span>MODUL {modIdx + 1}</span>
                  <strong>{mod.title}</strong>
                </div>

                <div className="sidebar-lesson-links">
                  {mod.lessons.map((lesson) => {
                    const isDone = completedIds.includes(lesson.id);
                    const isActive = lesson.id === currentLessonId;

                    return (
                      <button
                        key={lesson.id}
                        className={`sidebar-lesson-item ${isActive ? "active" : ""} ${
                          isDone ? "completed" : ""
                        }`}
                        onClick={() => handleSelectLesson(lesson.id)}
                      >
                        <span className="status-icon">
                          {isDone ? (
                            <CheckCircle2 size={15} className="done" />
                          ) : (
                            <Circle size={15} className="undone" />
                          )}
                        </span>
                        <span className="lesson-label">{lesson.title}</span>
                        <span className="lesson-badge">
                          {lesson.type === "quiz" ? (
                            "Kuis"
                          ) : lesson.type === "video" ? (
                            "Video"
                          ) : (
                            lesson.duration
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Content Viewer Area */}
        <main className="classroom-content">
          <div className="content-container">
            {/* Lesson Header */}
            <div className="lesson-header">
              <div className="lesson-meta-eyebrow">
                <span>{currentItem?.moduleTitle.toUpperCase()}</span>
                <span className="dot">•</span>
                <span>{currentLesson?.duration}</span>
                <span className="dot">•</span>
                <span className="type-badge">{currentLesson?.type.toUpperCase()}</span>
              </div>
              <h1>{currentLesson?.title}</h1>
              <p className="lesson-summary-lead">{currentLesson?.summary}</p>
            </div>

            {/* Video Player if Lesson has Video */}
            {(currentLesson?.type === "video" || currentLesson?.videoUrl) && (
              <div className="video-lesson-box">
                <div className="video-iframe-wrap">
                  <iframe
                    src={currentLesson.videoUrl || "https://www.youtube.com/embed/b13a7c6oG1s"}
                    title={currentLesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="video-meta-bar">
                  <div className="video-meta-info">
                    <Video size={16} />
                    <span>Materi Video Pembelajaran Terverifikasi</span>
                  </div>
                  <span className="video-duration-badge">
                    Durasi: {currentLesson.videoDuration || currentLesson.duration}
                  </span>
                </div>
              </div>
            )}

            {/* Reading Content */}
            <div className="lesson-article">
              {currentLesson?.content.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>

            {/* Chart Case Study if available */}
            {currentLesson?.chartData && (
              <div className="chart-study-box">
                <div className="chart-study-header">
                  <div>
                    <span className="study-tag">STUDI KASUS VISUAL</span>
                    <h4>{currentLesson.chartData.title}</h4>
                  </div>
                  <div className="study-badge-row">
                    <span className="timeframe-badge">{currentLesson.chartData.timeframe}</span>
                    <span
                      className={`bias-badge ${currentLesson.chartData.bias.toLowerCase()}`}
                    >
                      {currentLesson.chartData.bias}
                    </span>
                  </div>
                </div>

                {/* SVG Candlestick Graphic */}
                <div className="study-svg-wrap">
                  <svg
                    className="study-svg"
                    viewBox="0 0 500 160"
                    role="img"
                    aria-label="Ilustrasi studi kasus teknikal"
                  >
                    {[30, 70, 110, 140].map((y) => (
                      <line key={y} x1="0" y1={y} x2="500" y2={y} className="chart-grid" />
                    ))}
                    {/* Dynamic candle pattern */}
                    {studyCandles.map(([x, y, h, wick, up], i) => (
                      <g key={i}>
                        <line
                          x1={x}
                          y1={Math.max(10, Number(y) - 10)}
                          x2={x}
                          y2={Number(y) + Number(wick) + 8}
                          className={up ? "wick up" : "wick down"}
                        />
                        <rect
                          x={Number(x) - 5}
                          y={y}
                          width="10"
                          height={h}
                          rx="1"
                          className={up ? "candle up" : "candle down"}
                        />
                      </g>
                    ))}
                    {/* Structure break line */}
                    <line
                      x1="180"
                      y1="75"
                      x2="470"
                      y2="75"
                      stroke="#41d9ef"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />
                    <text x="370" y="68" fill="#41d9ef" fontSize="9" fontFamily="monospace">
                      STRUCTURE LEVEL (BREAK &amp; EXPANSION)
                    </text>
                  </svg>
                </div>

                <p className="study-desc">{currentLesson.chartData.description}</p>
              </div>
            )}

            {/* Key Takeaways */}
            {currentLesson?.keyTakeaways && (
              <div className="takeaways-box">
                <div className="takeaways-header">
                  <Sparkles size={17} />
                  <strong>POIN KUNCI YANG HARUS DIINGAT</strong>
                </div>
                <ul>
                  {currentLesson.keyTakeaways.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Interactive Server-Side Quiz */}
            {currentLesson?.quiz && currentLesson.quiz.length > 0 && (
              <div className="quiz-container">
                <div className="quiz-header">
                  <HelpCircle size={20} />
                  <div>
                    <h3>Kuis Evaluasi Pemahaman (Server-Grade)</h3>
                    <p>
                      Pilih jawaban untuk setiap pertanyaan. Jawaban dinilai secara langsung di server
                      dengan batas kelulusan 70%.
                    </p>
                  </div>
                </div>

                {quizError && (
                  <div className="auth-error-alert">
                    <AlertCircle size={16} />
                    <span>{quizError}</span>
                  </div>
                )}

                {/* Evaluation Banner if evaluated */}
                {quizEvaluation && (
                  <div
                    className={`quiz-eval-banner ${
                      quizEvaluation.passed ? "passed" : "failed"
                    }`}
                  >
                    <div>
                      <div className="quiz-eval-title">
                        {quizEvaluation.passed ? (
                          <>
                            <CheckCircle2 size={18} /> Selamat, Anda Lulus Evaluasi!
                          </>
                        ) : (
                          <>
                            <AlertCircle size={18} /> Belum Memenuhi Kriteria Kelulusan
                          </>
                        )}
                      </div>
                      <small style={{ display: "block", marginTop: "4px" }}>
                        Batas kelulusan minimum: {quizEvaluation.passingScore}%.{" "}
                        {quizEvaluation.passed
                          ? "Progres materi otomatis tercatat selesai."
                          : "Silakan pelajari kembali materi di atas dan ulangi kuis."}
                      </small>
                    </div>
                    <div className="quiz-eval-score">{quizEvaluation.score}%</div>
                  </div>
                )}

                <div className="quiz-questions">
                  {currentLesson.quiz.map((q, qIdx) => {
                    const selected = selectedAnswers[q.id];
                    const reviewItem = quizEvaluation?.review.find(
                      (r) => r.questionId === q.id
                    );

                    return (
                      <div key={q.id} className="quiz-card">
                        <div className="quiz-q-num">PERTANYAAN 0{qIdx + 1}</div>
                        <h4 className="quiz-q-text">{q.question}</h4>

                        <div className="quiz-options">
                          {q.options.map((opt, optIdx) => {
                            let optionClass = "quiz-option";
                            if (selected === optIdx) {
                              optionClass += " selected";
                            }
                            if (reviewItem) {
                              if (optIdx === reviewItem.correctAnswer) {
                                optionClass += " correct";
                              } else if (selected === optIdx && !reviewItem.isCorrect) {
                                optionClass += " wrong";
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                className={optionClass}
                                onClick={() => handleSelectOption(q.id, optIdx)}
                                disabled={Boolean(quizEvaluation) || isSubmittingQuiz}
                              >
                                <span className="opt-letter">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="opt-text">{opt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {reviewItem && (
                          <div
                            className={`quiz-explanation ${
                              reviewItem.isCorrect ? "correct" : "wrong"
                            }`}
                          >
                            <strong>
                              {reviewItem.isCorrect
                                ? "✓ Jawaban Benar!"
                                : `✕ Kurang Tepat (Jawaban yang benar: ${String.fromCharCode(
                                    65 + reviewItem.correctAnswer
                                  )})`}
                            </strong>
                            <p>{reviewItem.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!quizEvaluation ? (
                  <button
                    className="button button-primary quiz-submit-btn"
                    onClick={handleSubmitQuiz}
                    disabled={
                      isSubmittingQuiz ||
                      Object.keys(selectedAnswers).length < currentLesson.quiz.length
                    }
                  >
                    {isSubmittingQuiz ? (
                      "Mengevaluasi di Server..."
                    ) : (
                      <>
                        Kirim &amp; Evaluasi Jawaban <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="quiz-submitted-result">
                    <span className="quiz-done-badge">
                      <CheckCircle2 size={16} /> Hasil Evaluasi Tersimpan di Database
                    </span>
                    <button
                      className="text-link"
                      onClick={() => {
                        setQuizEvaluation(null);
                        setSelectedAnswers({});
                      }}
                    >
                      <RotateCcw size={14} /> Ulangi Kuis
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Course Completion Celebration Card */}
            {isCourseFullyCompleted && (
              <div className="course-completed-card">
                <Trophy size={48} className="trophy-icon" />
                <h3>Selamat! Anda Telah Menyelesaikan Kelas Ini</h3>
                <p>
                  Seluruh materi dan evaluasi kuis pada kelas <strong>{course.title}</strong> telah
                  berhasil Anda selesaikan. Buka dashboard untuk meninjau status kelulusan Anda.
                </p>
                <Link href="/dashboard" className="button button-primary">
                  <Award size={16} /> Buka Dashboard Siswa
                </Link>
              </div>
            )}

            {/* Bottom Lesson Footer Navigation */}
            <div className="lesson-footer-nav">
              <div>
                {prevLesson && (
                  <button
                    className="nav-btn prev"
                    onClick={() => handleSelectLesson(prevLesson.id)}
                  >
                    <ArrowLeft size={16} />
                    <div>
                      <small>SEBELUMNYA</small>
                      <span>{prevLesson.title}</span>
                    </div>
                  </button>
                )}
              </div>

              <div className="center-complete-action">
                {currentLesson?.type === "quiz" ? (
                  <div
                    className={`complete-toggle-btn ${isCurrentCompleted ? "completed" : ""}`}
                    style={{ cursor: isCurrentCompleted ? "default" : "not-allowed", opacity: isCurrentCompleted ? 1 : 0.8 }}
                    title={
                      isCurrentCompleted
                        ? "Kuis telah diselesaikan dan lulus verifikasi server."
                        : "Selesaikan dan lulus kuis di atas dengan skor minimal 70%."
                    }
                  >
                    {isCurrentCompleted ? (
                      <>
                        <Check size={16} /> Kuis Lulus Terverifikasi
                      </>
                    ) : (
                      <>
                        <Circle size={16} /> Wajib Lulus Kuis (Min 70%)
                      </>
                    )}
                  </div>
                ) : (
                  <button
                    className={`complete-toggle-btn ${isCurrentCompleted ? "completed" : ""}`}
                    onClick={handleToggleComplete}
                  >
                    {isCurrentCompleted ? (
                      <>
                        <Check size={16} /> Sudah Selesai
                      </>
                    ) : (
                      <>
                        <Circle size={16} /> Tandai Selesai
                      </>
                    )}
                  </button>
                )}
              </div>

              <div>
                {nextLesson && (
                  <button
                    className="nav-btn next"
                    onClick={() => {
                      if (!isCurrentCompleted && currentLesson?.type !== "quiz") {
                        handleToggleComplete();
                      }
                      handleSelectLesson(nextLesson.id);
                    }}
                  >
                    <div>
                      <small>BERIKUTNYA</small>
                      <span>{nextLesson.title}</span>
                    </div>
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ClassroomClient({ course }: { course: Course }) {
  return (
    <Suspense
      fallback={
        <div className="classroom-loading">
          <div className="loading-spinner" />
          <p>Memuat Ruang Belajar Signal Casper...</p>
        </div>
      }
    >
      <ClassroomInner course={course} />
    </Suspense>
  );
}
