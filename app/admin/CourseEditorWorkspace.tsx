"use client";

import { useState } from "react";
import type {
  Course,
  CourseCategory,
  CourseLevel,
  CourseModule,
  CoursePublicationStatus,
  Lesson,
  LessonContentBlock,
  ContentBlockType,
  QuizQuestion,
  VisualDiagramType,
} from "@/lib/types";
import { countCourseLessons } from "@/lib/courses-data";
import { EducationalVisualDiagram } from "@/app/kelas/[slug]/ClassroomClient";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Save,
  Eye,
  BookOpen,
  Layers,
  FileText,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Lock,
  Sparkles,
  Video,
  Award,
  Check,
  RotateCcw,
} from "lucide-react";

const VISUAL_DIAGRAM_OPTIONS: Array<{ value: VisualDiagramType | ""; label: string }> = [
  { value: "", label: "— Tidak Menggunakan Diagram Visual —" },
  {
    value: "liquidity-orderbook",
    label: "C1: Kedalaman Order Book & Likuiditas (Limit vs Market)",
  },
  {
    value: "candlestick-anatomy",
    label: "C2: Anatomi OHLC & Psikologi Penolakan Ekor (Rejection Wick)",
  },
  {
    value: "market-structure-bos-choch",
    label: "C3: Siklus Struktur Pasar (HH, HL, BOS, dan CHoCH)",
  },
  {
    value: "snr-zones-sbr-rbs",
    label: "C4: Zona Likuiditas SNR & Role Reversal (SBR / RBS)",
  },
  {
    value: "confluence-workflow",
    label: "C5: Alur Kerja Multi-Timeframe (HTF -> MTF -> LTF Execution)",
  },
  {
    value: "xauusd-macro-session",
    label: "C6: Peta Sesi XAUUSD (Asia, London, Overlap NY) & DXY/Yield",
  },
  {
    value: "position-sizing-rrr",
    label: "C7: Kalkulasi Position Sizing & Asimetri Risk-to-Reward (1:2)",
  },
  {
    value: "psychology-cycle",
    label: "C8: Siklus Emosi Impulsif vs Protokol Regulasi Kognitif",
  },
  {
    value: "journal-expectancy",
    label: "C9: Siklus Evaluasi Jurnal & Matriks Expectancy Kuantitatif",
  },
];

interface CourseEditorWorkspaceProps {
  initialCourse: Course;
  onClose: () => void;
  onSaved: (updated: Course) => void;
  onResetBaseline?: (courseId: string) => Promise<void>;
}

function StringListEditor({
  label,
  helperText,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  helperText?: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const handleItemChange = (idx: number, val: string) => {
    const next = [...items];
    next[idx] = val;
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...items, ""]);
  };

  const handleRemove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const handleMove = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const temp = next[idx];
    next[idx] = next[target];
    next[target] = temp;
    onChange(next);
  };

  return (
    <div className="admin-input-group" style={{ marginBottom: "18px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          marginBottom: "6px",
        }}
      >
        <div>
          <label style={{ display: "block", fontWeight: 600 }}>{label}</label>
          {helperText && (
            <span style={{ fontSize: "11px", color: "#788a9c" }}>{helperText}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="admin-btn"
          style={{ fontSize: "12px", padding: "5px 10px" }}
        >
          <Plus size={13} /> Tambah Poin
        </button>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: "12px",
            border: "1px dashed #253545",
            borderRadius: "4px",
            fontSize: "12px",
            color: "#788a9c",
          }}
        >
          Belum ada poin. Klik &quot;Tambah Poin&quot; untuk menambahkan.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: "6px",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "11px",
                  color: "#64748b",
                  minWidth: "22px",
                }}
              >
                {idx + 1}.
              </span>
              <input
                type="text"
                value={item}
                onChange={(e) => handleItemChange(idx, e.target.value)}
                placeholder={placeholder || `Poin ke-${idx + 1}...`}
                className="admin-input"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => handleMove(idx, -1)}
                disabled={idx === 0}
                className="admin-btn"
                title="Geser naik"
                style={{ padding: "6px 8px" }}
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleMove(idx, 1)}
                disabled={idx === items.length - 1}
                className="admin-btn"
                title="Geser turun"
                style={{ padding: "6px 8px" }}
              >
                <ArrowDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="admin-btn admin-btn-danger"
                title="Hapus poin"
                style={{ padding: "6px 8px" }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CourseEditorWorkspace({
  initialCourse,
  onClose,
  onSaved,
  onResetBaseline,
}: CourseEditorWorkspaceProps) {
  const [course, setCourse] = useState<Course>(() => structuredClone(initialCourse));
  const [activeTab, setActiveTab] = useState<
    "overview" | "curriculum" | "content" | "quiz" | "preview"
  >("overview");
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number>(0);
  const [selectedLessonIndex, setSelectedLessonIndex] = useState<number>(0);
  const [previewMode, setPreviewMode] = useState<"syllabus" | "classroom">("classroom");

  const [isSaving, setIsSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error" | "warning";
    text: string;
    canForceDelete?: boolean;
  } | null>(null);

  const currentModule: CourseModule | undefined =
    course.modules[selectedModuleIndex] || course.modules[0];
  const currentLesson: Lesson | undefined =
    currentModule?.lessons[selectedLessonIndex] || currentModule?.lessons[0];

  const totalLessonsCount = countCourseLessons(course);
  const totalQuestionsCount = course.modules.reduce(
    (sum, m) =>
      sum + m.lessons.reduce((lSum, l) => lSum + (l.quiz ? l.quiz.length : 0), 0),
    0
  );

  const updateCourseField = <K extends keyof Course>(key: K, value: Course[K]) => {
    setCourse((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateCurrentModule = (updater: (mod: CourseModule) => CourseModule) => {
    setCourse((prev) => {
      const nextModules = [...prev.modules];
      const targetIdx = nextModules[selectedModuleIndex] ? selectedModuleIndex : 0;
      if (!nextModules[targetIdx]) return prev;
      nextModules[targetIdx] = updater({ ...nextModules[targetIdx] });
      return {
        ...prev,
        modules: nextModules,
        totalLessons: countCourseLessons({ modules: nextModules }),
      };
    });
  };

  const updateCurrentLesson = (updater: (les: Lesson) => Lesson) => {
    setCourse((prev) => {
      const nextModules = [...prev.modules];
      const mIdx = nextModules[selectedModuleIndex] ? selectedModuleIndex : 0;
      if (!nextModules[mIdx]) return prev;
      const nextLessons = [...nextModules[mIdx].lessons];
      const lIdx = nextLessons[selectedLessonIndex] ? selectedLessonIndex : 0;
      if (!nextLessons[lIdx]) return prev;
      nextLessons[lIdx] = updater({ ...nextLessons[lIdx] });
      nextModules[mIdx] = {
        ...nextModules[mIdx],
        lessons: nextLessons,
      };
      return {
        ...prev,
        modules: nextModules,
        totalLessons: countCourseLessons({ modules: nextModules }),
      };
    });
  };

  // ── Module Operations ──
  const handleAddModule = () => {
    const newModId = `m-${Date.now().toString(36).slice(-5)}`;
    const newLessonId = `l-${Date.now().toString(36).slice(-5)}-1`;
    const nextModNum = course.modules.length + 1;
    const newMod: CourseModule = {
      id: newModId,
      title: `Modul ${nextModNum}: Topik Pembelajaran Baru`,
      description: "Deskripsi cakupan materi pada modul ini.",
      lessons: [
        {
          id: newLessonId,
          slug: `materi-${nextModNum}-1`,
          title: `Materi ${nextModNum}.1: Pengantar Modul`,
          duration: "15 Menit",
          type: "reading",
          summary: "Ringkasan konsep utama yang dibahas pada pelajaran ini.",
          learningObjectives: ["Memahami konsep dasar materi ini."],
          content: ["Tuliskan pembahasan konseptual materi di sini."],
          keyTakeaways: ["Poin kunci pertama dari materi ini."],
        },
      ],
    };

    const nextModules = [...course.modules, newMod];
    setCourse((prev) => ({
      ...prev,
      modules: nextModules,
      totalLessons: countCourseLessons({ modules: nextModules }),
    }));
    setSelectedModuleIndex(nextModules.length - 1);
    setSelectedLessonIndex(0);
  };

  const handleMoveModule = (mIdx: number, dir: -1 | 1) => {
    const targetIdx = mIdx + dir;
    if (targetIdx < 0 || targetIdx >= course.modules.length) return;
    const nextModules = [...course.modules];
    const temp = nextModules[mIdx];
    nextModules[mIdx] = nextModules[targetIdx];
    nextModules[targetIdx] = temp;
    setCourse((prev) => ({ ...prev, modules: nextModules }));
    setSelectedModuleIndex(targetIdx);
  };

  const handleDeleteModule = (mIdx: number) => {
    if (course.modules.length <= 1) {
      setStatusBanner({
        type: "error",
        text: "Setiap kelas wajib memiliki minimal 1 modul.",
      });
      return;
    }
    const targetMod = course.modules[mIdx];
    if (
      !confirm(
        `Hapus "${targetMod.title}" beserta ${targetMod.lessons.length} pelajaran di dalamnya?`
      )
    ) {
      return;
    }
    const nextModules = course.modules.filter((_, i) => i !== mIdx);
    setCourse((prev) => ({
      ...prev,
      modules: nextModules,
      totalLessons: countCourseLessons({ modules: nextModules }),
    }));
    setSelectedModuleIndex(Math.max(0, mIdx - 1));
    setSelectedLessonIndex(0);
  };

  // ── Lesson Operations ──
  const handleAddLesson = (mIdx: number) => {
    const mod = course.modules[mIdx];
    if (!mod) return;
    const nextLesNum = mod.lessons.length + 1;
    const newLesId = `l-${Date.now().toString(36).slice(-6)}`;
    const newLesson: Lesson = {
      id: newLesId,
      slug: `materi-${mIdx + 1}-${nextLesNum}`,
      title: `Materi ${mIdx + 1}.${nextLesNum}: Judul Pelajaran Baru`,
      duration: "20 Menit",
      type: "reading",
      summary: "Ringkasan tujuan dan pembahasan pelajaran ini.",
      learningObjectives: ["Memahami prinsip utama dari materi ini."],
      content: ["Paragraf penjelasan konsep pertama."],
      keyTakeaways: ["Intisari utama yang wajib diingat siswa."],
    };

    const nextModules = [...course.modules];
    nextModules[mIdx] = {
      ...mod,
      lessons: [...mod.lessons, newLesson],
    };
    setCourse((prev) => ({
      ...prev,
      modules: nextModules,
      totalLessons: countCourseLessons({ modules: nextModules }),
    }));
    setSelectedModuleIndex(mIdx);
    setSelectedLessonIndex(mod.lessons.length);
  };

  const handleMoveLesson = (mIdx: number, lIdx: number, dir: -1 | 1) => {
    const mod = course.modules[mIdx];
    if (!mod) return;
    const targetIdx = lIdx + dir;
    if (targetIdx < 0 || targetIdx >= mod.lessons.length) return;
    const nextLessons = [...mod.lessons];
    const temp = nextLessons[lIdx];
    nextLessons[lIdx] = nextLessons[targetIdx];
    nextLessons[targetIdx] = temp;
    const nextModules = [...course.modules];
    nextModules[mIdx] = { ...mod, lessons: nextLessons };
    setCourse((prev) => ({ ...prev, modules: nextModules }));
    setSelectedModuleIndex(mIdx);
    setSelectedLessonIndex(targetIdx);
  };

  const handleMoveLessonAcrossModules = (targetModuleIdx: number) => {
    if (
      targetModuleIdx === selectedModuleIndex ||
      !course.modules[selectedModuleIndex] ||
      !course.modules[targetModuleIdx] ||
      !currentLesson
    ) {
      return;
    }
    const sourceMod = course.modules[selectedModuleIndex];
    if (sourceMod.lessons.length <= 1) {
      setStatusBanner({
        type: "error",
        text: "Modul asal harus menyisakan minimal 1 pelajaran.",
      });
      return;
    }
    const lessonToMove = currentLesson;
    const nextModules = course.modules.map((mod, idx) => {
      if (idx === selectedModuleIndex) {
        return {
          ...mod,
          lessons: mod.lessons.filter((_, i) => i !== selectedLessonIndex),
        };
      }
      if (idx === targetModuleIdx) {
        return {
          ...mod,
          lessons: [...mod.lessons, lessonToMove],
        };
      }
      return mod;
    });

    setCourse((prev) => ({
      ...prev,
      modules: nextModules,
      totalLessons: countCourseLessons({ modules: nextModules }),
    }));
    setSelectedModuleIndex(targetModuleIdx);
    setSelectedLessonIndex(course.modules[targetModuleIdx].lessons.length);
    setStatusBanner({
      type: "success",
      text: `Pelajaran "${lessonToMove.title}" (ID: ${lessonToMove.id}) dipindahkan ke "${course.modules[targetModuleIdx].title}" dengan ID tetap utuh.`,
    });
  };

  const handleDeleteLesson = (mIdx: number, lIdx: number) => {
    const mod = course.modules[mIdx];
    if (!mod) return;
    if (mod.lessons.length <= 1) {
      setStatusBanner({
        type: "error",
        text: "Setiap modul wajib memiliki minimal 1 pelajaran.",
      });
      return;
    }
    const targetLesson = mod.lessons[lIdx];
    if (!confirm(`Hapus pelajaran "${targetLesson.title}" (ID: ${targetLesson.id})?`)) {
      return;
    }
    const nextLessons = mod.lessons.filter((_, i) => i !== lIdx);
    const nextModules = [...course.modules];
    nextModules[mIdx] = { ...mod, lessons: nextLessons };
    setCourse((prev) => ({
      ...prev,
      modules: nextModules,
      totalLessons: countCourseLessons({ modules: nextModules }),
    }));
    setSelectedLessonIndex(Math.max(0, lIdx - 1));
  };

  // ── Content Block Operations ──
  const handleAddContentBlock = (type: ContentBlockType) => {
    if (!currentLesson) return;
    const newBlock: LessonContentBlock = {
      id: `blk-${Date.now().toString(36).slice(-5)}`,
      type,
      ...(type === "heading" ? { level: 2, text: "Sub-Judul Pembahasan" } : {}),
      ...(type === "paragraph" ? { text: "Paragraf penjelasan materi..." } : {}),
      ...(type === "list"
        ? { style: "bullet", items: ["Poin pembahasan pertama", "Poin pembahasan kedua"] }
        : {}),
      ...(type === "callout"
        ? {
            variant: "info",
            caption: "CATATAN PENTING",
            text: "Penjelasan catatan penting bagi trader.",
          }
        : {}),
      ...(type === "image"
        ? {
            imageUrl: "/images/chart-placeholder.png",
            imageAlt: "Ilustrasi Chart",
            caption: "Keterangan gambar ilustrasi",
          }
        : {}),
    };
    updateCurrentLesson((les) => ({
      ...les,
      contentBlocks: [...(les.contentBlocks || []), newBlock],
    }));
  };

  const handleConvertParagraphsToBlocks = () => {
    if (!currentLesson) return;
    const blocks: LessonContentBlock[] = currentLesson.content.map((p, idx) => ({
      id: `blk-p-${idx + 1}`,
      type: "paragraph",
      text: p,
    }));
    updateCurrentLesson((les) => ({
      ...les,
      contentBlocks: blocks,
    }));
  };

  // ── Quiz Operations ──
  const handleAddQuizQuestion = () => {
    if (!currentLesson) return;
    const existingQuiz = currentLesson.quiz || [];
    const newQ: QuizQuestion = {
      id: `q-${currentLesson.id}-${Date.now().toString(36).slice(-4)}`,
      question: "Tuliskan pertanyaan evaluasi di sini...",
      options: [
        "Pilihan jawaban A",
        "Pilihan jawaban B",
        "Pilihan jawaban C",
        "Pilihan jawaban D",
      ],
      correctAnswer: 0,
      explanation: "Pembahasan mengapa jawaban tersebut benar secara konseptual.",
    };
    updateCurrentLesson((les) => ({
      ...les,
      quiz: [...existingQuiz, newQ],
    }));
  };

  // ── Save to Server ──
  const handleSaveCourse = async (
    overrideStatus?: CoursePublicationStatus,
    forceDeleteLessons = false
  ) => {
    setIsSaving(true);
    setStatusBanner(null);

    const payloadCourse: Course = {
      ...course,
      status: overrideStatus || course.status || "published",
      totalLessons: countCourseLessons(course),
    };

    try {
      const res = await fetch("/api/admin/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: payloadCourse,
          forceDeleteLessons,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.impact?.affectedLessonUsersCount > 0) {
          setStatusBanner({
            type: "warning",
            text: data.error,
            canForceDelete: true,
          });
          return;
        }
        throw new Error(data.error || "Gagal menyimpan perubahan kelas.");
      }

      const savedCourse: Course = data.course || payloadCourse;
      setCourse(savedCourse);
      onSaved(savedCourse);
      setStatusBanner({
        type: "success",
        text: `Kurikulum kelas "${savedCourse.title}" berhasil disimpan (${savedCourse.status?.toUpperCase()}).`,
      });
    } catch (err: unknown) {
      setStatusBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        background: "#090e14",
        border: "1px solid #1c2734",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "32px",
      }}
    >
      {/* Top Sticky Action Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          paddingBottom: "16px",
          marginBottom: "18px",
          borderBottom: "1px solid #1c2734",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button type="button" onClick={onClose} className="admin-btn">
            <ArrowLeft size={14} /> Kembali ke Daftar Kelas
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <code style={{ color: "var(--cyan)", fontSize: "12px" }}>{course.number}</code>
              <strong style={{ fontSize: "17px", color: "#f8fafc" }}>{course.title}</strong>
              <span
                className="badge-role"
                style={{
                  background:
                    course.status === "draft"
                      ? "#3b2f13"
                      : course.status === "archived"
                        ? "#1e293b"
                        : "#0e2920",
                  color:
                    course.status === "draft"
                      ? "#fde047"
                      : course.status === "archived"
                        ? "#94a3b8"
                        : "#86efac",
                }}
              >
                {(course.status || "published").toUpperCase()}
              </span>
              {course.isStaticBaseline && (
                <span
                  className="badge-role"
                  style={{
                    background: course.isOverridden ? "#2e1a47" : "#112233",
                    color: course.isOverridden ? "#d8b4fe" : "#7dd3fc",
                  }}
                >
                  {course.isOverridden ? "Kurikulum Inti (Diedit)" : "Kurikulum Inti (Default)"}
                </span>
              )}
            </div>
            <div style={{ fontSize: "12px", color: "#788a9c", marginTop: "2px" }}>
              ID: <code>{course.id}</code> • Slug: <code>/{course.slug}</code> •{" "}
              {course.modules.length} Modul • {totalLessonsCount} Pelajaran • {totalQuestionsCount}{" "}
              Soal Kuis
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {course.isStaticBaseline && course.isOverridden && onResetBaseline && (
            <button
              type="button"
              onClick={async () => {
                if (
                  confirm(
                    `Kembalikan kelas "${course.title}" ke kurikulum bawaan pabrik (Factory Default)? Progres siswa tetap aman.`
                  )
                ) {
                  await onResetBaseline(course.id);
                }
              }}
              className="admin-btn"
              style={{ borderColor: "#f59e0b", color: "#fbbf24" }}
            >
              <RotateCcw size={14} /> Reset ke Default
            </button>
          )}

          <select
            value={course.status || "published"}
            onChange={(e) =>
              updateCourseField("status", e.target.value as CoursePublicationStatus)
            }
            className="admin-input"
            style={{ width: "auto", padding: "7px 12px", fontSize: "12px" }}
            aria-label="Status Publikasi Kelas"
          >
            <option value="published">Status: Published (Aktif)</option>
            <option value="draft">Status: Draft (Sembunyikan)</option>
            <option value="archived">Status: Archived (Arsip)</option>
          </select>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveCourse()}
            className="admin-btn admin-btn-primary"
            style={{ padding: "8px 16px" }}
          >
            <Save size={14} /> {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>

      {/* Status / Feedback Banner */}
      {statusBanner && (
        <div
          className={
            statusBanner.type === "success" ? "quiz-eval-banner passed" : "auth-error-alert"
          }
          style={{
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {statusBanner.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{statusBanner.text}</span>
          </div>
          {statusBanner.canForceDelete && (
            <button
              type="button"
              onClick={() => handleSaveCourse(undefined, true)}
              className="admin-btn admin-btn-danger"
            >
              Tetap Simpan &amp; Hapus Materi Terkait
            </button>
          )}
        </div>
      )}

      {/* Workspace Navigation Tabs */}
      <div className="admin-tabs" style={{ marginBottom: "20px" }}>
        <button
          type="button"
          className={`admin-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <BookOpen size={14} style={{ display: "inline", marginRight: "6px" }} />
          1. Informasi &amp; Silabus Kelas
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "curriculum" ? "active" : ""}`}
          onClick={() => setActiveTab("curriculum")}
        >
          <Layers size={14} style={{ display: "inline", marginRight: "6px" }} />
          2. Struktur Modul &amp; Pelajaran ({course.modules.length}M / {totalLessonsCount}L)
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "content" ? "active" : ""}`}
          onClick={() => setActiveTab("content")}
        >
          <FileText size={14} style={{ display: "inline", marginRight: "6px" }} />
          3. Content &amp; Diagram Editor
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "quiz" ? "active" : ""}`}
          onClick={() => setActiveTab("quiz")}
        >
          <HelpCircle size={14} style={{ display: "inline", marginRight: "6px" }} />
          4. Quiz &amp; Assessment Editor ({totalQuestionsCount} Soal)
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "preview" ? "active" : ""}`}
          onClick={() => setActiveTab("preview")}
        >
          <Eye size={14} style={{ display: "inline", marginRight: "6px" }} />
          5. Live Preview Mode
        </button>
      </div>

      {/* ================================================================
          TAB 1: COURSE OVERVIEW & METADATA EDITOR
         ================================================================ */}
      {activeTab === "overview" && (
        <div
          style={{
            background: "#0d131b",
            border: "1px solid #1c2734",
            borderRadius: "6px",
            padding: "20px",
          }}
        >
          <h3 style={{ fontSize: "16px", marginTop: 0, marginBottom: "16px" }}>
            Informasi Utama &amp; Parameter Kelas
          </h3>

          <div className="admin-form-row" style={{ gridTemplateColumns: "140px 1fr 1fr" }}>
            <div className="admin-input-group">
              <label>Kode Kelas</label>
              <input
                type="text"
                value={course.number}
                onChange={(e) => updateCourseField("number", e.target.value)}
                className="admin-input"
                placeholder="SC-01"
              />
            </div>
            <div className="admin-input-group">
              <label>Judul Kelas *</label>
              <input
                type="text"
                value={course.title}
                onChange={(e) => updateCourseField("title", e.target.value)}
                className="admin-input"
              />
            </div>
            <div className="admin-input-group">
              <label>
                Slug URL Kelas{" "}
                {course.isStaticBaseline && (
                  <span style={{ color: "#fbbf24", fontSize: "11px" }}>
                    <Lock size={11} style={{ display: "inline" }} /> Terkunci (Kurikulum Inti)
                  </span>
                )}
              </label>
              <input
                type="text"
                value={course.slug}
                disabled={Boolean(course.isStaticBaseline)}
                onChange={(e) => updateCourseField("slug", e.target.value)}
                className="admin-input"
                style={
                  course.isStaticBaseline ? { opacity: 0.65, cursor: "not-allowed" } : undefined
                }
              />
            </div>
          </div>

          <div className="admin-input-group" style={{ marginTop: "14px" }}>
            <label>Sub-Judul Kelas</label>
            <input
              type="text"
              value={course.subtitle}
              onChange={(e) => updateCourseField("subtitle", e.target.value)}
              className="admin-input"
            />
          </div>

          <div
            className="admin-form-row"
            style={{ gridTemplateColumns: "1fr 1fr 1fr 120px", marginTop: "14px" }}
          >
            <div className="admin-input-group">
              <label>Kategori Kurikulum</label>
              <select
                value={course.category}
                onChange={(e) =>
                  updateCourseField("category", e.target.value as CourseCategory)
                }
                className="admin-input"
              >
                <option value="Trading Foundation">Trading Foundation</option>
                <option value="Technical Analysis">Technical Analysis</option>
                <option value="Market Structure">Market Structure</option>
                <option value="Risk & Psychology">Risk &amp; Psychology</option>
                <option value="Specialized Asset">Specialized Asset</option>
              </select>
            </div>
            <div className="admin-input-group">
              <label>Tingkat Kesulitan</label>
              <select
                value={course.level}
                onChange={(e) => updateCourseField("level", e.target.value as CourseLevel)}
                className="admin-input"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
            <div className="admin-input-group">
              <label>Estimasi Durasi</label>
              <input
                type="text"
                value={course.duration}
                onChange={(e) => updateCourseField("duration", e.target.value)}
                className="admin-input"
                placeholder="misal 3 Jam"
              />
            </div>
            <div className="admin-input-group">
              <label>Urutan Katalog</label>
              <input
                type="number"
                min={1}
                value={course.order ?? 1}
                onChange={(e) =>
                  updateCourseField("order", Math.max(1, parseInt(e.target.value || "1", 10)))
                }
                className="admin-input"
              />
            </div>
          </div>

          <div className="admin-form-row" style={{ marginTop: "14px" }}>
            <div className="admin-input-group">
              <label>Nama Instruktur</label>
              <input
                type="text"
                value={course.instructor?.name || ""}
                onChange={(e) =>
                  updateCourseField("instructor", {
                    ...course.instructor,
                    name: e.target.value,
                  })
                }
                className="admin-input"
              />
            </div>
            <div className="admin-input-group">
              <label>Jabatan / Peran Instruktur</label>
              <input
                type="text"
                value={course.instructor?.role || ""}
                onChange={(e) =>
                  updateCourseField("instructor", {
                    ...course.instructor,
                    role: e.target.value,
                  })
                }
                className="admin-input"
              />
            </div>
          </div>

          <div className="admin-form-row" style={{ marginTop: "14px" }}>
            <div className="admin-input-group">
              <label>Thumbnail URL (Opsional — HTTPS atau /images/...)</label>
              <input
                type="text"
                value={course.thumbnailUrl || ""}
                onChange={(e) => updateCourseField("thumbnailUrl", e.target.value)}
                placeholder="https://... atau /images/course-thumb.png"
                className="admin-input"
              />
            </div>
            <div className="admin-input-group">
              <label>Cover Hero URL (Opsional — HTTPS atau /images/...)</label>
              <input
                type="text"
                value={course.coverUrl || ""}
                onChange={(e) => updateCourseField("coverUrl", e.target.value)}
                placeholder="https://... atau /images/course-cover.png"
                className="admin-input"
              />
            </div>
          </div>

          <div className="admin-input-group" style={{ marginTop: "14px", marginBottom: "22px" }}>
            <label>Deskripsi &amp; Overview Kelas</label>
            <textarea
              value={course.overview}
              onChange={(e) => updateCourseField("overview", e.target.value)}
              className="admin-textarea"
              rows={4}
            />
          </div>

          <hr style={{ borderColor: "#1c2734", margin: "24px 0" }} />

          <StringListEditor
            label="Tujuan Pembelajaran (Learning Objectives)"
            helperText="Ditampilkan pada halaman detail silabus /belajar/[slug]"
            items={course.objectives || []}
            onChange={(next) => updateCourseField("objectives", next)}
            placeholder="Contoh: Memahami mekanisme lelang dua arah dan likuiditas pasar..."
          />

          <StringListEditor
            label="Target Kompetensi Lulusan (Competencies)"
            helperText="Kemampuan terukur yang dikuasai siswa setelah lulus kelas ini"
            items={course.competencies || []}
            onChange={(next) => updateCourseField("competencies", next)}
            placeholder="Contoh: Mampu mengidentifikasi zona likuiditas institusional secara mandiri..."
          />

          <StringListEditor
            label="Prasyarat Pembelajaran (Prerequisites)"
            helperText="Kelas atau pengetahuan dasar yang disarankan sebelum mengikuti kelas ini"
            items={course.prerequisites || []}
            onChange={(next) => updateCourseField("prerequisites", next)}
            placeholder="Contoh: Telah menyelesaikan Kelas 1 (Trading Fundamentals)..."
          />

          <StringListEditor
            label="Ringkasan Kelas (Course Summary)"
            helperText="Intisari kurikulum kelas secara menyeluruh"
            items={course.courseSummary || []}
            onChange={(next) => updateCourseField("courseSummary", next)}
            placeholder="Contoh: Kelas ini mengintegrasikan analisis struktur pasar dengan..."
          />

          <StringListEditor
            label="Referensi & Literatur Belajar (References)"
            helperText="Daftar buku, riset, atau dokumentasi acuan kelas"
            items={course.references || []}
            onChange={(next) => updateCourseField("references", next)}
            placeholder="Contoh: Harris, L. (2003). Trading and Exchanges: Market Microstructure..."
          />
        </div>
      )}

      {/* ================================================================
          TAB 2: MODULE & LESSON STRUCTURE MANAGER
         ================================================================ */}
      {activeTab === "curriculum" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 370px) 1fr",
            gap: "20px",
            alignItems: "start",
          }}
          className="admin-curriculum-grid"
        >
          {/* Left Tree: Modules & Lessons */}
          <div
            style={{
              background: "#0d131b",
              border: "1px solid #1c2734",
              borderRadius: "6px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <strong style={{ fontSize: "14px" }}>Pohon Kurikulum</strong>
              <button
                type="button"
                onClick={handleAddModule}
                className="admin-btn admin-btn-primary"
                style={{ padding: "5px 10px", fontSize: "12px" }}
              >
                <Plus size={13} /> Tambah Modul
              </button>
            </div>

            <div style={{ display: "grid", gap: "14px" }}>
              {course.modules.map((mod, mIdx) => {
                const isSelectedMod = mIdx === selectedModuleIndex;
                return (
                  <div
                    key={mod.id}
                    style={{
                      border: `1px solid ${isSelectedMod ? "var(--cyan)" : "#1c2734"}`,
                      borderRadius: "6px",
                      background: "#090e14",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        background: isSelectedMod ? "rgba(65,217,239,0.08)" : "#111923",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModuleIndex(mIdx);
                          setSelectedLessonIndex(0);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#f8fafc",
                          fontWeight: 700,
                          fontSize: "13px",
                          textAlign: "left",
                          cursor: "pointer",
                          flex: 1,
                        }}
                      >
                        <div>{mod.title}</div>
                        <small style={{ color: "#788a9c", fontWeight: 400 }}>
                          ID: {mod.id} • {mod.lessons.length} Pelajaran
                        </small>
                      </button>

                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          onClick={() => handleMoveModule(mIdx, -1)}
                          disabled={mIdx === 0}
                          className="admin-btn"
                          style={{ padding: "4px 6px" }}
                          title="Geser modul naik"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveModule(mIdx, 1)}
                          disabled={mIdx === course.modules.length - 1}
                          className="admin-btn"
                          style={{ padding: "4px 6px" }}
                          title="Geser modul turun"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteModule(mIdx)}
                          className="admin-btn admin-btn-danger"
                          style={{ padding: "4px 6px" }}
                          title="Hapus modul"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Lessons inside module */}
                    <div style={{ padding: "8px", display: "grid", gap: "6px" }}>
                      {mod.lessons.map((les, lIdx) => {
                        const isSelectedLes =
                          isSelectedMod && lIdx === selectedLessonIndex;
                        return (
                          <div
                            key={les.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "7px 8px",
                              borderRadius: "4px",
                              background: isSelectedLes
                                ? "rgba(65, 217, 239, 0.14)"
                                : "#0d131b",
                              border: `1px solid ${
                                isSelectedLes ? "var(--cyan)" : "#1c2734"
                              }`,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedModuleIndex(mIdx);
                                setSelectedLessonIndex(lIdx);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#e2e8f0",
                                textAlign: "left",
                                cursor: "pointer",
                                flex: 1,
                                fontSize: "12px",
                              }}
                            >
                              <div style={{ fontWeight: 600 }}>{les.title}</div>
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "#94a3b8",
                                  marginTop: "2px",
                                  display: "flex",
                                  gap: "6px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <code>{les.id}</code>
                                <span>• {les.type.toUpperCase()}</span>
                                <span>• {les.duration}</span>
                                {les.quiz && les.quiz.length > 0 && (
                                  <span style={{ color: "var(--cyan)" }}>
                                    • {les.quiz.length} Soal
                                  </span>
                                )}
                              </div>
                            </button>

                            <div style={{ display: "flex", gap: "3px" }}>
                              <button
                                type="button"
                                onClick={() => handleMoveLesson(mIdx, lIdx, -1)}
                                disabled={lIdx === 0}
                                className="admin-btn"
                                style={{ padding: "3px 5px" }}
                                title="Geser pelajaran naik"
                              >
                                <ArrowUp size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveLesson(mIdx, lIdx, 1)}
                                disabled={lIdx === mod.lessons.length - 1}
                                className="admin-btn"
                                style={{ padding: "3px 5px" }}
                                title="Geser pelajaran turun"
                              >
                                <ArrowDown size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLesson(mIdx, lIdx)}
                                className="admin-btn admin-btn-danger"
                                style={{ padding: "3px 5px" }}
                                title="Hapus pelajaran"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => handleAddLesson(mIdx)}
                        className="admin-btn"
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          fontSize: "11px",
                          padding: "6px",
                          marginTop: "4px",
                        }}
                      >
                        <Plus size={12} /> Tambah Pelajaran di Modul {mIdx + 1}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Detail Panel: Module & Selected Lesson Metadata */}
          <div style={{ display: "grid", gap: "18px" }}>
            {currentModule && (
              <div
                style={{
                  background: "#0d131b",
                  border: "1px solid #1c2734",
                  borderRadius: "6px",
                  padding: "18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <h3 style={{ fontSize: "15px", margin: 0 }}>
                    Pengaturan Modul #{selectedModuleIndex + 1}
                  </h3>
                  <code style={{ fontSize: "11px", color: "var(--cyan)" }}>
                    ID Modul: {currentModule.id}
                  </code>
                </div>

                <div className="admin-form-row">
                  <div className="admin-input-group">
                    <label>Nama Modul *</label>
                    <input
                      type="text"
                      value={currentModule.title}
                      onChange={(e) =>
                        updateCurrentModule((m) => ({ ...m, title: e.target.value }))
                      }
                      className="admin-input"
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Deskripsi Modul</label>
                    <input
                      type="text"
                      value={currentModule.description}
                      onChange={(e) =>
                        updateCurrentModule((m) => ({ ...m, description: e.target.value }))
                      }
                      className="admin-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentLesson && (
              <div
                style={{
                  background: "#0d131b",
                  border: "1px solid #1c2734",
                  borderRadius: "6px",
                  padding: "18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "15px", margin: 0 }}>
                      Pengaturan Pelajaran #{selectedLessonIndex + 1} ({currentLesson.title})
                    </h3>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                      <Lock size={11} style={{ display: "inline", marginRight: "4px" }} />
                      ID Pelajaran: <code>{currentLesson.id}</code> (Stabil untuk menjaga progres
                      siswa)
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab("content")}
                      className="admin-btn admin-btn-primary"
                    >
                      <FileText size={13} /> Buka Content Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("quiz")}
                      className="admin-btn"
                    >
                      <HelpCircle size={13} /> Kelola Kuis ({currentLesson.quiz?.length || 0})
                    </button>
                  </div>
                </div>

                <div className="admin-form-row">
                  <div className="admin-input-group">
                    <label>Judul Pelajaran *</label>
                    <input
                      type="text"
                      value={currentLesson.title}
                      onChange={(e) =>
                        updateCurrentLesson((l) => ({ ...l, title: e.target.value }))
                      }
                      className="admin-input"
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Slug Pelajaran</label>
                    <input
                      type="text"
                      value={currentLesson.slug}
                      onChange={(e) =>
                        updateCurrentLesson((l) => ({ ...l, slug: e.target.value }))
                      }
                      className="admin-input"
                    />
                  </div>
                </div>

                <div
                  className="admin-form-row"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: "12px" }}
                >
                  <div className="admin-input-group">
                    <label>Tipe Pelajaran</label>
                    <select
                      value={currentLesson.type}
                      onChange={(e) =>
                        updateCurrentLesson((l) => ({
                          ...l,
                          type: e.target.value as Lesson["type"],
                        }))
                      }
                      className="admin-input"
                    >
                      <option value="reading">Reading (Materi Bacaan &amp; Konsep)</option>
                      <option value="chart-study">Chart Study (Studi Kasus Grafik)</option>
                      <option value="video">Video (Materi Video)</option>
                      <option value="quiz">Quiz (Evaluasi Modul / Final Assessment Wajib)</option>
                    </select>
                  </div>

                  <div className="admin-input-group">
                    <label>Estimasi Durasi Baca/Belajar</label>
                    <input
                      type="text"
                      value={currentLesson.duration}
                      onChange={(e) =>
                        updateCurrentLesson((l) => ({ ...l, duration: e.target.value }))
                      }
                      placeholder="20 Menit"
                      className="admin-input"
                    />
                  </div>

                  <div className="admin-input-group">
                    <label>Pindahkan ke Modul Lain</label>
                    <select
                      value={selectedModuleIndex}
                      onChange={(e) =>
                        handleMoveLessonAcrossModules(parseInt(e.target.value, 10))
                      }
                      className="admin-input"
                    >
                      {course.modules.map((m, idx) => (
                        <option key={m.id} value={idx}>
                          Modul {idx + 1}: {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="admin-input-group" style={{ marginTop: "12px" }}>
                  <label>Ringkasan Materi (Lead Summary)</label>
                  <textarea
                    value={currentLesson.summary}
                    onChange={(e) =>
                      updateCurrentLesson((l) => ({ ...l, summary: e.target.value }))
                    }
                    className="admin-textarea"
                    rows={2}
                  />
                </div>

                <div style={{ marginTop: "16px" }}>
                  <StringListEditor
                    label="Tujuan Pembelajaran Materi Ini (Lesson Learning Objectives)"
                    items={currentLesson.learningObjectives || []}
                    onChange={(next) =>
                      updateCurrentLesson((l) => ({ ...l, learningObjectives: next }))
                    }
                    placeholder="Contoh: Mampu membedakan market order agresif dan limit order pasif..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          TAB 3: STRUCTURED CONTENT & DIAGRAM EDITOR
         ================================================================ */}
      {activeTab === "content" && currentLesson && (
        <div
          style={{
            background: "#0d131b",
            border: "1px solid #1c2734",
            borderRadius: "6px",
            padding: "20px",
          }}
        >
          {/* Lesson Switcher Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              paddingBottom: "16px",
              marginBottom: "18px",
              borderBottom: "1px solid #1c2734",
            }}
          >
            <div>
              <span style={{ fontSize: "11px", color: "var(--cyan)", fontWeight: 700 }}>
                CONTENT EDITOR — PILIH PELAJARAN AKTIF
              </span>
              <h3 style={{ fontSize: "16px", margin: "4px 0 0" }}>
                {currentLesson.title} (<code>{currentLesson.id}</code>)
              </h3>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={`${selectedModuleIndex}:${selectedLessonIndex}`}
                onChange={(e) => {
                  const [m, l] = e.target.value.split(":").map(Number);
                  setSelectedModuleIndex(m);
                  setSelectedLessonIndex(l);
                }}
                className="admin-input"
                style={{ width: "auto", minWidth: "280px" }}
              >
                {course.modules.map((m, mIdx) =>
                  m.lessons.map((l, lIdx) => (
                    <option key={l.id} value={`${mIdx}:${lIdx}`}>
                      [M{mIdx + 1}] {l.title} ({l.id})
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={() => {
                  setPreviewMode("classroom");
                  setActiveTab("preview");
                }}
                className="admin-btn"
              >
                <Eye size={14} /> Pratinjau Materi Ini
              </button>
            </div>
          </div>

          {/* 1. Conceptual Paragraphs Editor */}
          <StringListEditor
            label="Paragraf Penjelasan Konsep Mendalam (content[])"
            helperText="Setiap poin dirender sebagai satu paragraf utuh pada artikel ruang belajar"
            items={currentLesson.content || []}
            onChange={(next) => updateCurrentLesson((l) => ({ ...l, content: next }))}
            placeholder="Tuliskan penjelasan konseptual yang mendalam..."
          />

          {/* 2. Rich Content Blocks Editor (Headings, Lists, Callouts, Images) */}
          <div
            style={{
              background: "#090e14",
              border: "1px solid #1c2734",
              borderRadius: "6px",
              padding: "16px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <div>
                <strong style={{ fontSize: "14px" }}>
                  Blok Konten Terstruktur (Sub-Heading, Daftar, Callout Box, Gambar)
                </strong>
                <div style={{ fontSize: "11px", color: "#788a9c" }}>
                  Opsional: Jika diisi, ruang belajar akan merender blok terstruktur ini secara
                  berurutan.
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {(!currentLesson.contentBlocks || currentLesson.contentBlocks.length === 0) &&
                  currentLesson.content.length > 0 && (
                    <button
                      type="button"
                      onClick={handleConvertParagraphsToBlocks}
                      className="admin-btn"
                      style={{ fontSize: "11px" }}
                    >
                      Salin Paragraf ke Blok
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => handleAddContentBlock("heading")}
                  className="admin-btn"
                  style={{ fontSize: "11px" }}
                >
                  + Heading
                </button>
                <button
                  type="button"
                  onClick={() => handleAddContentBlock("paragraph")}
                  className="admin-btn"
                  style={{ fontSize: "11px" }}
                >
                  + Paragraf
                </button>
                <button
                  type="button"
                  onClick={() => handleAddContentBlock("list")}
                  className="admin-btn"
                  style={{ fontSize: "11px" }}
                >
                  + List Poin
                </button>
                <button
                  type="button"
                  onClick={() => handleAddContentBlock("callout")}
                  className="admin-btn"
                  style={{ fontSize: "11px" }}
                >
                  + Callout Box
                </button>
                <button
                  type="button"
                  onClick={() => handleAddContentBlock("image")}
                  className="admin-btn"
                  style={{ fontSize: "11px" }}
                >
                  + Gambar
                </button>
              </div>
            </div>

            {currentLesson.contentBlocks && currentLesson.contentBlocks.length > 0 && (
              <div style={{ display: "grid", gap: "10px" }}>
                {currentLesson.contentBlocks.map((blk, bIdx) => (
                  <div
                    key={blk.id || bIdx}
                    style={{
                      background: "#0d131b",
                      border: "1px solid #253545",
                      borderRadius: "4px",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "var(--cyan)",
                          textTransform: "uppercase",
                        }}
                      >
                        Blok #{bIdx + 1}: {blk.type}
                      </span>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const blocks = [...(currentLesson.contentBlocks || [])];
                            if (bIdx === 0) return;
                            const tmp = blocks[bIdx];
                            blocks[bIdx] = blocks[bIdx - 1];
                            blocks[bIdx - 1] = tmp;
                            updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                          }}
                          disabled={bIdx === 0}
                          className="admin-btn"
                          style={{ padding: "3px 6px" }}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const blocks = [...(currentLesson.contentBlocks || [])];
                            if (bIdx >= blocks.length - 1) return;
                            const tmp = blocks[bIdx];
                            blocks[bIdx] = blocks[bIdx + 1];
                            blocks[bIdx + 1] = tmp;
                            updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                          }}
                          disabled={bIdx === (currentLesson.contentBlocks?.length || 1) - 1}
                          className="admin-btn"
                          style={{ padding: "3px 6px" }}
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const blocks = (currentLesson.contentBlocks || []).filter(
                              (_, i) => i !== bIdx
                            );
                            updateCurrentLesson((l) => ({
                              ...l,
                              contentBlocks: blocks.length > 0 ? blocks : undefined,
                            }));
                          }}
                          className="admin-btn admin-btn-danger"
                          style={{ padding: "3px 6px" }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {blk.type === "heading" && (
                      <div className="admin-form-row" style={{ gridTemplateColumns: "120px 1fr" }}>
                        <select
                          value={blk.level || 2}
                          onChange={(e) => {
                            const blocks = [...(currentLesson.contentBlocks || [])];
                            blocks[bIdx] = {
                              ...blk,
                              level: Number(e.target.value) === 3 ? 3 : 2,
                            };
                            updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                          }}
                          className="admin-input"
                        >
                          <option value={2}>Heading H2</option>
                          <option value={3}>Heading H3</option>
                        </select>
                        <input
                          type="text"
                          value={blk.text || ""}
                          onChange={(e) => {
                            const blocks = [...(currentLesson.contentBlocks || [])];
                            blocks[bIdx] = { ...blk, text: e.target.value };
                            updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                          }}
                          className="admin-input"
                          placeholder="Teks sub-judul..."
                        />
                      </div>
                    )}

                    {blk.type === "paragraph" && (
                      <textarea
                        value={blk.text || ""}
                        onChange={(e) => {
                          const blocks = [...(currentLesson.contentBlocks || [])];
                          blocks[bIdx] = { ...blk, text: e.target.value };
                          updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                        }}
                        className="admin-textarea"
                        rows={3}
                      />
                    )}

                    {blk.type === "list" && (
                      <div>
                        <select
                          value={blk.style || "bullet"}
                          onChange={(e) => {
                            const blocks = [...(currentLesson.contentBlocks || [])];
                            blocks[bIdx] = {
                              ...blk,
                              style: e.target.value === "ordered" ? "ordered" : "bullet",
                            };
                            updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                          }}
                          className="admin-input"
                          style={{ marginBottom: "8px", width: "200px" }}
                        >
                          <option value="bullet">Bullet List (•)</option>
                          <option value="ordered">Numbered List (1, 2, 3)</option>
                        </select>
                        <StringListEditor
                          label="Item Daftar"
                          items={blk.items || []}
                          onChange={(nextItems) => {
                            const blocks = [...(currentLesson.contentBlocks || [])];
                            blocks[bIdx] = { ...blk, items: nextItems };
                            updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                          }}
                        />
                      </div>
                    )}

                    {blk.type === "callout" && (
                      <div style={{ display: "grid", gap: "8px" }}>
                        <div
                          className="admin-form-row"
                          style={{ gridTemplateColumns: "160px 1fr" }}
                        >
                          <select
                            value={blk.variant || "info"}
                            onChange={(e) => {
                              const blocks = [...(currentLesson.contentBlocks || [])];
                              blocks[bIdx] = {
                                ...blk,
                                variant: e.target.value as "info" | "warning" | "tip",
                              };
                              updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                            }}
                            className="admin-input"
                          >
                            <option value="info">Info (Cyan)</option>
                            <option value="tip">Pro Tip (Hijau)</option>
                            <option value="warning">Warning (Kuning)</option>
                          </select>
                          <input
                            type="text"
                            value={blk.caption || ""}
                            onChange={(e) => {
                              const blocks = [...(currentLesson.contentBlocks || [])];
                              blocks[bIdx] = { ...blk, caption: e.target.value };
                              updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                            }}
                            placeholder="Judul Callout (misal: CATATAN INSTITUSIONAL)"
                            className="admin-input"
                          />
                        </div>
                        <textarea
                          value={blk.text || ""}
                          onChange={(e) => {
                            const blocks = [...(currentLesson.contentBlocks || [])];
                            blocks[bIdx] = { ...blk, text: e.target.value };
                            updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                          }}
                          className="admin-textarea"
                          rows={2}
                        />
                      </div>
                    )}

                    {blk.type === "image" && (
                      <div className="admin-form-row">
                        <div className="admin-input-group">
                          <label>URL Gambar (HTTPS atau /images/...)</label>
                          <input
                            type="text"
                            value={blk.imageUrl || ""}
                            onChange={(e) => {
                              const blocks = [...(currentLesson.contentBlocks || [])];
                              blocks[bIdx] = { ...blk, imageUrl: e.target.value };
                              updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                            }}
                            className="admin-input"
                          />
                        </div>
                        <div className="admin-input-group">
                          <label>Caption / Keterangan Gambar</label>
                          <input
                            type="text"
                            value={blk.caption || ""}
                            onChange={(e) => {
                              const blocks = [...(currentLesson.contentBlocks || [])];
                              blocks[bIdx] = { ...blk, caption: e.target.value };
                              updateCurrentLesson((l) => ({ ...l, contentBlocks: blocks }));
                            }}
                            className="admin-input"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Interactive Visual Diagram Picker */}
          <div
            style={{
              background: "#090e14",
              border: "1px solid #1c2734",
              borderRadius: "6px",
              padding: "16px",
              marginBottom: "20px",
            }}
          >
            <div className="admin-input-group">
              <label>Skema Diagram Visual Edukatif Interaktif (SVG)</label>
              <select
                value={currentLesson.visualDiagram || ""}
                onChange={(e) =>
                  updateCurrentLesson((l) => ({
                    ...l,
                    visualDiagram: e.target.value
                      ? (e.target.value as VisualDiagramType)
                      : undefined,
                  }))
                }
                className="admin-input"
              >
                {VISUAL_DIAGRAM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {currentLesson.visualDiagram && (
              <div style={{ marginTop: "12px" }}>
                <EducationalVisualDiagram type={currentLesson.visualDiagram} />
              </div>
            )}
          </div>

          {/* 4. Video & Chart Study Settings */}
          <div className="admin-form-row" style={{ marginBottom: "18px" }}>
            <div className="admin-input-group">
              <label>Video Embed URL (Opsional — misal https://www.youtube.com/embed/...)</label>
              <input
                type="text"
                value={currentLesson.videoUrl || ""}
                onChange={(e) =>
                  updateCurrentLesson((l) => ({
                    ...l,
                    videoUrl: e.target.value || undefined,
                  }))
                }
                placeholder="https://www.youtube.com/embed/..."
                className="admin-input"
              />
            </div>
            <div className="admin-input-group">
              <label>Durasi Video (Opsional)</label>
              <input
                type="text"
                value={currentLesson.videoDuration || ""}
                onChange={(e) =>
                  updateCurrentLesson((l) => ({
                    ...l,
                    videoDuration: e.target.value || undefined,
                  }))
                }
                placeholder="12:45"
                className="admin-input"
              />
            </div>
          </div>

          {/* Chart Case Study Editor */}
          <div
            style={{
              background: "#090e14",
              border: "1px solid #1c2734",
              borderRadius: "6px",
              padding: "16px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <strong style={{ fontSize: "13px" }}>
                Panel Studi Kasus Chart (Chart Case Study Box)
              </strong>
              <button
                type="button"
                onClick={() =>
                  updateCurrentLesson((l) => ({
                    ...l,
                    chartData: l.chartData
                      ? undefined
                      : {
                          title: `Studi Kasus Chart: ${l.title}`,
                          timeframe: "H4 / M15",
                          bias: "Bullish",
                          description: "Penjelasan struktur candlestick dan eksekusi pada chart.",
                        },
                  }))
                }
                className="admin-btn"
                style={{ fontSize: "11px" }}
              >
                {currentLesson.chartData ? "Nonaktifkan Chart Box" : "+ Aktifkan Chart Box"}
              </button>
            </div>

            {currentLesson.chartData && (
              <div style={{ display: "grid", gap: "10px" }}>
                <div
                  className="admin-form-row"
                  style={{ gridTemplateColumns: "1fr 140px 140px" }}
                >
                  <div className="admin-input-group">
                    <label>Judul Studi Kasus Chart</label>
                    <input
                      type="text"
                      value={currentLesson.chartData.title}
                      onChange={(e) =>
                        updateCurrentLesson((l) => ({
                          ...l,
                          chartData: l.chartData
                            ? { ...l.chartData, title: e.target.value }
                            : undefined,
                        }))
                      }
                      className="admin-input"
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Timeframe</label>
                    <input
                      type="text"
                      value={currentLesson.chartData.timeframe}
                      onChange={(e) =>
                        updateCurrentLesson((l) => ({
                          ...l,
                          chartData: l.chartData
                            ? { ...l.chartData, timeframe: e.target.value }
                            : undefined,
                        }))
                      }
                      className="admin-input"
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Bias Arah</label>
                    <select
                      value={currentLesson.chartData.bias}
                      onChange={(e) =>
                        updateCurrentLesson((l) => ({
                          ...l,
                          chartData: l.chartData
                            ? {
                                ...l.chartData,
                                bias: e.target.value as "Bullish" | "Bearish" | "Neutral",
                              }
                            : undefined,
                        }))
                      }
                      className="admin-input"
                    >
                      <option value="Bullish">Bullish</option>
                      <option value="Bearish">Bearish</option>
                      <option value="Neutral">Neutral</option>
                    </select>
                  </div>
                </div>
                <div className="admin-input-group">
                  <label>Deskripsi Analisis Chart</label>
                  <textarea
                    value={currentLesson.chartData.description}
                    onChange={(e) =>
                      updateCurrentLesson((l) => ({
                        ...l,
                        chartData: l.chartData
                          ? { ...l.chartData, description: e.target.value }
                          : undefined,
                      }))
                    }
                    className="admin-textarea"
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Application Example & Case Study */}
          <div className="admin-form-row" style={{ marginBottom: "18px" }}>
            <div className="admin-input-group">
              <label>Contoh Penerapan Praktis (Application Example)</label>
              <textarea
                value={currentLesson.applicationExample || ""}
                onChange={(e) =>
                  updateCurrentLesson((l) => ({
                    ...l,
                    applicationExample: e.target.value || undefined,
                  }))
                }
                className="admin-textarea"
                rows={3}
              />
            </div>
            <div className="admin-input-group">
              <label>Studi Kasus Analisis Pasar (Structured Case Study)</label>
              <textarea
                value={currentLesson.caseStudy || ""}
                onChange={(e) =>
                  updateCurrentLesson((l) => ({
                    ...l,
                    caseStudy: e.target.value || undefined,
                  }))
                }
                className="admin-textarea"
                rows={3}
              />
            </div>
          </div>

          <StringListEditor
            label="Langkah Praktik Terukur (Practical Steps)"
            items={currentLesson.practicalSteps || []}
            onChange={(next) =>
              updateCurrentLesson((l) => ({ ...l, practicalSteps: next }))
            }
            placeholder="Langkah 1: Identifikasi struktur swing high dan swing low pada H4..."
          />

          <StringListEditor
            label="Kesalahan Umum yang Wajib Dihindari (Common Mistakes)"
            items={currentLesson.commonMistakes || []}
            onChange={(next) =>
              updateCurrentLesson((l) => ({ ...l, commonMistakes: next }))
            }
            placeholder="Contoh: Masuk posisi sebelum candle benar-benar close (body break)..."
          />

          <StringListEditor
            label="Ringkasan & Poin Kunci Materi (Key Takeaways)"
            items={currentLesson.keyTakeaways || []}
            onChange={(next) =>
              updateCurrentLesson((l) => ({ ...l, keyTakeaways: next }))
            }
            placeholder="Poin kunci yang wajib diingat dari pelajaran ini..."
          />
        </div>
      )}

      {/* ================================================================
          TAB 4: QUIZ & ASSESSMENT EDITOR
         ================================================================ */}
      {activeTab === "quiz" && currentLesson && (
        <div
          style={{
            background: "#0d131b",
            border: "1px solid #1c2734",
            borderRadius: "6px",
            padding: "20px",
          }}
        >
          {/* Lesson Switcher Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              paddingBottom: "16px",
              marginBottom: "18px",
              borderBottom: "1px solid #1c2734",
            }}
          >
            <div>
              <span style={{ fontSize: "11px", color: "var(--cyan)", fontWeight: 700 }}>
                QUIZ &amp; ASSESSMENT EDITOR
              </span>
              <h3 style={{ fontSize: "16px", margin: "4px 0 0" }}>
                {currentLesson.title} (<code>{currentLesson.id}</code>)
              </h3>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={`${selectedModuleIndex}:${selectedLessonIndex}`}
                onChange={(e) => {
                  const [m, l] = e.target.value.split(":").map(Number);
                  setSelectedModuleIndex(m);
                  setSelectedLessonIndex(l);
                }}
                className="admin-input"
                style={{ width: "auto", minWidth: "280px" }}
              >
                {course.modules.map((m, mIdx) =>
                  m.lessons.map((l, lIdx) => (
                    <option key={l.id} value={`${mIdx}:${lIdx}`}>
                      [M{mIdx + 1}] {l.title} ({l.quiz?.length || 0} Soal)
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={handleAddQuizQuestion}
                className="admin-btn admin-btn-primary"
              >
                <Plus size={14} /> Tambah Soal Kuis
              </button>
            </div>
          </div>

          {/* Quiz Role Banner (Practice vs Mandatory Assessment) */}
          <div
            style={{
              background:
                currentLesson.type === "quiz"
                  ? "rgba(65, 217, 239, 0.08)"
                  : "rgba(108, 224, 176, 0.08)",
              border: `1px solid ${
                currentLesson.type === "quiz"
                  ? "rgba(65, 217, 239, 0.35)"
                  : "rgba(108, 224, 176, 0.35)"
              }`,
              borderRadius: "6px",
              padding: "14px 16px",
              marginBottom: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <strong style={{ fontSize: "13px", color: "#f8fafc" }}>
                {currentLesson.type === "quiz"
                  ? "Mode Evaluasi Wajib (Evaluasi Modul / Final Assessment Kelulusan Kelas)"
                  : "Mode Kuis Latihan Pemahaman Materi (Self-Check Practice Quiz)"}
              </strong>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "3px" }}>
                {currentLesson.type === "quiz"
                  ? `Siswa wajib mencapai skor minimal ${currentLesson.passingScore ?? 70}% di server agar pelajaran ini ditandai selesai dan memenuhi syarat sertifikat.`
                  : "Kuis pada materi bacaan/video bersifat latihan mandiri: kegagalan menjawab tidak pernah membatalkan status selesai materi siswa."}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontSize: "12px", color: "#cbd5e1" }}>
                Passing Score (%):
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={currentLesson.passingScore ?? 70}
                  onChange={(e) =>
                    updateCurrentLesson((l) => ({
                      ...l,
                      passingScore: Math.min(
                        100,
                        Math.max(10, parseInt(e.target.value || "70", 10))
                      ),
                    }))
                  }
                  className="admin-input"
                  style={{ width: "80px", marginLeft: "8px", padding: "5px 8px" }}
                />
              </label>
            </div>
          </div>

          {/* Questions List */}
          {!currentLesson.quiz || currentLesson.quiz.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                border: "1px dashed #253545",
                borderRadius: "6px",
                color: "#788a9c",
              }}
            >
              Belum ada soal kuis pada pelajaran ini. Klik &quot;Tambah Soal Kuis&quot; untuk
              menambahkan pertanyaan pilihan ganda.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {currentLesson.quiz.map((q, qIdx) => (
                <div
                  key={q.id || qIdx}
                  style={{
                    background: "#090e14",
                    border: "1px solid #1c2734",
                    borderRadius: "6px",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                    }}
                  >
                    <div>
                      <strong style={{ color: "var(--cyan)", fontSize: "13px" }}>
                        Pertanyaan #{qIdx + 1}
                      </strong>{" "}
                      <code style={{ fontSize: "11px", color: "#64748b" }}>ID: {q.id}</code>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        disabled={qIdx === 0}
                        onClick={() => {
                          const list = [...(currentLesson.quiz || [])];
                          const tmp = list[qIdx];
                          list[qIdx] = list[qIdx - 1];
                          list[qIdx - 1] = tmp;
                          updateCurrentLesson((l) => ({ ...l, quiz: list }));
                        }}
                        className="admin-btn"
                        style={{ padding: "4px 8px" }}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={qIdx === (currentLesson.quiz?.length || 1) - 1}
                        onClick={() => {
                          const list = [...(currentLesson.quiz || [])];
                          const tmp = list[qIdx];
                          list[qIdx] = list[qIdx + 1];
                          list[qIdx + 1] = tmp;
                          updateCurrentLesson((l) => ({ ...l, quiz: list }));
                        }}
                        className="admin-btn"
                        style={{ padding: "4px 8px" }}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const list = (currentLesson.quiz || []).filter((_, i) => i !== qIdx);
                          updateCurrentLesson((l) => ({ ...l, quiz: list }));
                        }}
                        className="admin-btn admin-btn-danger"
                        style={{ padding: "4px 8px" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="admin-input-group" style={{ marginBottom: "12px" }}>
                    <label>Teks Pertanyaan *</label>
                    <textarea
                      value={q.question}
                      onChange={(e) => {
                        const list = [...(currentLesson.quiz || [])];
                        list[qIdx] = { ...q, question: e.target.value };
                        updateCurrentLesson((l) => ({ ...l, quiz: list }));
                      }}
                      className="admin-textarea"
                      rows={2}
                    />
                  </div>

                  <div className="admin-input-group" style={{ marginBottom: "12px" }}>
                    <label style={{ marginBottom: "6px", display: "block" }}>
                      Pilihan Jawaban (Pilih Radio Button untuk Kunci Jawaban Benar)
                    </label>
                    <div style={{ display: "grid", gap: "8px" }}>
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = q.correctAnswer === oIdx;
                        return (
                          <div
                            key={oIdx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              background: isCorrect ? "rgba(16, 185, 129, 0.12)" : "#0d131b",
                              border: `1px solid ${isCorrect ? "#10b981" : "#253545"}`,
                            }}
                          >
                            <input
                              type="radio"
                              name={`correct-${q.id}-${qIdx}`}
                              checked={isCorrect}
                              onChange={() => {
                                const list = [...(currentLesson.quiz || [])];
                                list[qIdx] = { ...q, correctAnswer: oIdx };
                                updateCurrentLesson((l) => ({ ...l, quiz: list }));
                              }}
                              title="Tandai sebagai jawaban benar"
                            />
                            <span
                              style={{
                                fontFamily: "var(--font-mono, monospace)",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: isCorrect ? "#6ce0b0" : "#94a3b8",
                                minWidth: "20px",
                              }}
                            >
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const nextOpts = [...q.options];
                                nextOpts[oIdx] = e.target.value;
                                const list = [...(currentLesson.quiz || [])];
                                list[qIdx] = { ...q, options: nextOpts };
                                updateCurrentLesson((l) => ({ ...l, quiz: list }));
                              }}
                              className="admin-input"
                              style={{ flex: 1 }}
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextOpts = q.options.filter((_, i) => i !== oIdx);
                                  const nextCorrect =
                                    q.correctAnswer >= nextOpts.length
                                      ? 0
                                      : q.correctAnswer;
                                  const list = [...(currentLesson.quiz || [])];
                                  list[qIdx] = {
                                    ...q,
                                    options: nextOpts,
                                    correctAnswer: nextCorrect,
                                  };
                                  updateCurrentLesson((l) => ({ ...l, quiz: list }));
                                }}
                                className="admin-btn admin-btn-danger"
                                style={{ padding: "4px 6px" }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {q.options.length < 6 && (
                      <button
                        type="button"
                        onClick={() => {
                          const list = [...(currentLesson.quiz || [])];
                          list[qIdx] = {
                            ...q,
                            options: [
                              ...q.options,
                              `Pilihan ${String.fromCharCode(65 + q.options.length)}`,
                            ],
                          };
                          updateCurrentLesson((l) => ({ ...l, quiz: list }));
                        }}
                        className="admin-btn"
                        style={{ marginTop: "8px", fontSize: "11px" }}
                      >
                        <Plus size={12} /> Tambah Opsi Jawaban
                      </button>
                    )}
                  </div>

                  <div className="admin-input-group">
                    <label>Pembahasan Jawaban Benar (Explanation — Hanya dikirim setelah submit)</label>
                    <textarea
                      value={q.explanation}
                      onChange={(e) => {
                        const list = [...(currentLesson.quiz || [])];
                        list[qIdx] = { ...q, explanation: e.target.value };
                        updateCurrentLesson((l) => ({ ...l, quiz: list }));
                      }}
                      className="admin-textarea"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          TAB 5: LIVE PREVIEW MODE (SYLLABUS & CLASSROOM)
         ================================================================ */}
      {activeTab === "preview" && (
        <div
          style={{
            background: "#0d131b",
            border: "1px solid #1c2734",
            borderRadius: "6px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              paddingBottom: "16px",
              marginBottom: "20px",
              borderBottom: "1px solid #1c2734",
            }}
          >
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setPreviewMode("syllabus")}
                className={`admin-btn ${previewMode === "syllabus" ? "admin-btn-primary" : ""}`}
              >
                Pratinjau Halaman Silabus (/belajar/{course.slug})
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("classroom")}
                className={`admin-btn ${previewMode === "classroom" ? "admin-btn-primary" : ""}`}
              >
                Pratinjau Ruang Belajar (/kelas/{course.slug})
              </button>
            </div>

            {previewMode === "classroom" && (
              <select
                value={`${selectedModuleIndex}:${selectedLessonIndex}`}
                onChange={(e) => {
                  const [m, l] = e.target.value.split(":").map(Number);
                  setSelectedModuleIndex(m);
                  setSelectedLessonIndex(l);
                }}
                className="admin-input"
                style={{ width: "auto", minWidth: "260px" }}
              >
                {course.modules.map((m, mIdx) =>
                  m.lessons.map((l, lIdx) => (
                    <option key={l.id} value={`${mIdx}:${lIdx}`}>
                      [M{mIdx + 1}] {l.title}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {previewMode === "syllabus" ? (
            <div style={{ display: "grid", gap: "18px" }}>
              <div
                style={{
                  background: "#090e14",
                  border: "1px solid #1c2734",
                  borderRadius: "6px",
                  padding: "20px",
                }}
              >
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <span className="course-num">{course.number}</span>
                  <span className="course-level-badge">{course.level}</span>
                  <span className="course-cat-tag">{course.category}</span>
                </div>
                <h2 style={{ fontSize: "24px", margin: "0 0 6px" }}>{course.title}</h2>
                <p style={{ color: "#94a3b8", margin: "0 0 12px" }}>{course.subtitle}</p>
                <p style={{ lineHeight: 1.7, color: "#cbd5e1", margin: 0 }}>{course.overview}</p>
              </div>

              <div className="admin-form-row">
                <div className="takeaways-box">
                  <div className="takeaways-header">
                    <CheckCircle2 size={16} />
                    <strong>TUJUAN PEMBELAJARAN</strong>
                  </div>
                  <ul>
                    {(course.objectives || []).map((obj, i) => (
                      <li key={i}>{obj}</li>
                    ))}
                  </ul>
                </div>
                <div className="takeaways-box">
                  <div className="takeaways-header">
                    <Award size={16} />
                    <strong>TARGET KOMPETENSI LULUSAN</strong>
                  </div>
                  <ul>
                    {(course.competencies || []).map((comp, i) => (
                      <li key={i}>{comp}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div
                style={{
                  background: "#090e14",
                  border: "1px solid #1c2734",
                  borderRadius: "6px",
                  padding: "18px",
                }}
              >
                <h3 style={{ marginTop: 0, fontSize: "16px" }}>
                  Struktur Silabus ({course.modules.length} Modul • {totalLessonsCount} Pelajaran)
                </h3>
                {course.modules.map((mod, mIdx) => (
                  <div key={mod.id} style={{ marginBottom: "14px" }}>
                    <strong style={{ color: "var(--cyan)" }}>
                      Modul {mIdx + 1}: {mod.title}
                    </strong>
                    <p style={{ fontSize: "12px", color: "#94a3b8", margin: "2px 0 8px" }}>
                      {mod.description}
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px" }}>
                      {mod.lessons.map((les) => (
                        <li key={les.id} style={{ marginBottom: "4px" }}>
                          <strong>{les.title}</strong> ({les.duration} • {les.type})
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            currentLesson && (
              <div
                style={{
                  background: "#090e14",
                  border: "1px solid #1c2734",
                  borderRadius: "6px",
                  padding: "24px",
                }}
              >
                <div style={{ marginBottom: "16px" }}>
                  <span style={{ fontSize: "11px", color: "var(--cyan)", fontWeight: 700 }}>
                    MODUL {selectedModuleIndex + 1} • PELAJARAN {selectedLessonIndex + 1} (
                    {currentLesson.duration})
                  </span>
                  <h2 style={{ fontSize: "24px", margin: "6px 0 8px" }}>
                    {currentLesson.title}
                  </h2>
                  <p style={{ color: "#94a3b8", margin: 0 }}>{currentLesson.summary}</p>
                </div>

                {currentLesson.videoUrl && (
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "#111923",
                      border: "1px solid #1c2734",
                      borderRadius: "6px",
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <Video size={16} style={{ color: "var(--cyan)" }} />
                    <span>Video Embed: {currentLesson.videoUrl}</span>
                  </div>
                )}

                {currentLesson.learningObjectives &&
                  currentLesson.learningObjectives.length > 0 && (
                    <div className="takeaways-box" style={{ marginBottom: "18px" }}>
                      <div className="takeaways-header">
                        <CheckCircle2 size={16} />
                        <strong>TUJUAN PEMBELAJARAN MATERI INI</strong>
                      </div>
                      <ul>
                        {currentLesson.learningObjectives.map((obj, idx) => (
                          <li key={idx}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div className="lesson-article">
                  {currentLesson.content.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>

                {currentLesson.visualDiagram && (
                  <EducationalVisualDiagram type={currentLesson.visualDiagram} />
                )}

                {(currentLesson.applicationExample || currentLesson.caseStudy) && (
                  <div className="takeaways-box" style={{ marginTop: "18px" }}>
                    {currentLesson.applicationExample && (
                      <div style={{ marginBottom: "12px" }}>
                        <div className="takeaways-header">
                          <Sparkles size={16} />
                          <strong>CONTOH PENERAPAN PRAKTIS</strong>
                        </div>
                        <p style={{ margin: 0 }}>{currentLesson.applicationExample}</p>
                      </div>
                    )}
                    {currentLesson.caseStudy && (
                      <div>
                        <div className="takeaways-header">
                          <Award size={16} />
                          <strong>STUDI KASUS ANALISIS PASAR</strong>
                        </div>
                        <p style={{ margin: 0 }}>{currentLesson.caseStudy}</p>
                      </div>
                    )}
                  </div>
                )}

                {currentLesson.practicalSteps && currentLesson.practicalSteps.length > 0 && (
                  <div className="takeaways-box" style={{ marginTop: "18px" }}>
                    <div className="takeaways-header">
                      <Check size={16} />
                      <strong>LANGKAH PRAKTIK TERUKUR</strong>
                    </div>
                    <ol style={{ margin: 0, paddingLeft: "20px" }}>
                      {currentLesson.practicalSteps.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {currentLesson.keyTakeaways && currentLesson.keyTakeaways.length > 0 && (
                  <div className="takeaways-box" style={{ marginTop: "18px" }}>
                    <div className="takeaways-header">
                      <Sparkles size={16} />
                      <strong>RINGKASAN &amp; POIN KUNCI MATERI</strong>
                    </div>
                    <ul>
                      {currentLesson.keyTakeaways.map((k, idx) => (
                        <li key={idx}>{k}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentLesson.quiz && currentLesson.quiz.length > 0 && (
                  <div
                    style={{
                      marginTop: "22px",
                      padding: "16px",
                      background: "#0d131b",
                      border: "1px solid #1c2734",
                      borderRadius: "6px",
                    }}
                  >
                    <h4 style={{ marginTop: 0 }}>
                      Pratinjau Kuis ({currentLesson.quiz.length} Pertanyaan)
                    </h4>
                    {currentLesson.quiz.map((q, qIdx) => (
                      <div key={q.id} style={{ marginBottom: "12px", fontSize: "13px" }}>
                        <strong>
                          {qIdx + 1}. {q.question}
                        </strong>
                        <ul style={{ margin: "6px 0 0", paddingLeft: "20px" }}>
                          {q.options.map((opt, oIdx) => (
                            <li
                              key={oIdx}
                              style={{
                                color:
                                  q.correctAnswer === oIdx ? "#6ce0b0" : "#94a3b8",
                              }}
                            >
                              {opt} {q.correctAnswer === oIdx ? " (Kunci Jawaban ✓)" : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

