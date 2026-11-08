"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CourseEditorWorkspace from "./CourseEditorWorkspace";
import type { Course, CoursePublicationStatus } from "@/lib/types";
import type { AdminStudentIntelligenceReport } from "@/lib/admin-student-intelligence";
import {
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  Users,
  Trophy,
  Database,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Edit3,
  RotateCcw,
  Crown,
  UserPlus,
  Search,
  Key,
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalCourses: number;
  totalManagedCourses?: number;
  totalQuizSubmissions: number;
  databaseStatus: string;
  backupCount: number;
  lastBackupTime: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

interface AdminSubmission {
  id: string;
  user_id: string;
  course_slug: string;
  lesson_id: string;
  score: number;
  created_at: string;
}

interface AdminAuditLog {
  id: string;
  admin_email: string;
  action: string;
  target_course_slug: string;
  summary: string;
  created_at: string;
}

type EnrichedAdminCourse = Course & {
  enrolledUsersCount?: number;
  quizSubmissionsCount?: number;
  modulesCount?: number;
  quizQuestionsCount?: number;
};

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<{
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<
    "stats" | "courses" | "users" | "quizzes" | "intelligence"
  >("courses");

  // Admin Data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [courses, setCourses] = useState<EnrichedAdminCourse[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [intelligence, setIntelligence] =
    useState<AdminStudentIntelligenceReport | null>(null);

  // Course Editor State
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | CoursePublicationStatus>("all");

  // Form State for creating course
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newCategory, setNewCategory] = useState("Trading Foundation");
  const [newLevel, setNewLevel] = useState("Beginner");
  const [newDuration, setNewDuration] = useState("2 Jam");
  const [newStatus, setNewStatus] = useState<CoursePublicationStatus>("published");
  const [newOverview, setNewOverview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadAdminData = async () => {
    try {
      const [res, intelRes] = await Promise.all([
        fetch("/api/admin/overview"),
        fetch("/api/admin/journal-intelligence"),
      ]);
      if (!res.ok) {
        setIsAuthorized(false);
        return;
      }
      const data = await res.json();
      setIsAuthorized(true);
      setStats(data.stats);
      setUsers(data.users || []);
      setSubmissions(data.recentSubmissions || []);
      setCourses(data.courses || []);
      setAuditLogs(data.auditLogs || []);
      if (intelRes.ok) {
        const intelData = await intelRes.json();
        setIntelligence(intelData.intelligence || intelData || null);
      }
    } catch {
      setIsAuthorized(false);
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          if (data.user.role === "ADMIN") {
            setIsAuthorized(true);
            loadAdminData();
          } else {
            setIsAuthorized(false);
          }
        } else {
          setIsAuthorized(false);
        }
      })
      .catch(() => setIsAuthorized(false));
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMsg(null);

    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          subtitle: newSubtitle,
          category: newCategory,
          level: newLevel,
          duration: newDuration,
          status: newStatus,
          overview: newOverview,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat kelas.");
      }

      setFormMsg({
        type: "success",
        text: `Kelas "${newTitle}" berhasil dibuat! Anda dapat langsung mengelola modul, pelajaran, dan kuisnya.`,
      });
      setNewTitle("");
      setNewSubtitle("");
      setNewOverview("");
      setShowCreateForm(false);
      await loadAdminData();
      if (data.course?.id) {
        setEditingCourseId(data.course.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      setFormMsg({ type: "error", text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeCourseStatus = async (
    courseId: string,
    status: CoursePublicationStatus
  ) => {
    try {
      const res = await fetch("/api/admin/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-status",
          courseId,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah status kelas.");
      }
      await loadAdminData();
    } catch (err: unknown) {
      setFormMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mengubah status.",
      });
    }
  };

  const handleReorderCourse = async (courseId: string, direction: "up" | "down") => {
    try {
      const res = await fetch("/api/admin/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          courseId,
          direction,
        }),
      });
      if (res.ok) {
        await loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetBaseline = async (courseId: string) => {
    try {
      const res = await fetch("/api/admin/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset-baseline",
          courseId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mereset kelas ke default.");
      }
      setFormMsg({
        type: "success",
        text: `Kelas berhasil dikembalikan ke kurikulum bawaan pabrik (Factory Default).`,
      });
      setEditingCourseId(null);
      await loadAdminData();
    } catch (err: unknown) {
      setFormMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mereset kelas.",
      });
    }
  };

  const handleDeleteCustomCourse = async (c: EnrichedAdminCourse) => {
    const hasStudents = (c.enrolledUsersCount || 0) > 0;
    const msg = hasStudents
      ? `Kelas "${c.title}" memiliki ${c.enrolledUsersCount} siswa terdaftar. Disarankan mengubah status menjadi Archived agar progres tetap tersimpan.\n\nApakah Anda yakin tetap ingin menghapus kelas kustom ini secara paksa?`
      : `Hapus kelas kustom "${c.title}"?`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch(
        `/api/admin/courses?id=${encodeURIComponent(c.id)}&force=${hasStudents ? "true" : "false"}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus kelas.");
      }
      setFormMsg({ type: "success", text: `Kelas "${c.title}" berhasil dihapus.` });
      await loadAdminData();
    } catch (err: unknown) {
      setFormMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menghapus kelas.",
      });
    }
  };

  // User Management State & Handlers
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("MENTOR");
  const [userSearch, setUserSearch] = useState("");
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [userActionMsg, setUserActionMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingUser(true);
    setUserActionMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat pengguna baru.");
      }
      setUserActionMsg({
        type: "success",
        text: `Akun "${newUserEmail}" berhasil dibuat sebagai ${newUserRole}!`,
      });
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setShowAddUserForm(false);
      await loadAdminData();
    } catch (err: unknown) {
      setUserActionMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan.",
      });
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleChangeUserRole = async (userId: string, targetEmail: string, role: string) => {
    setUserActionMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah peran pengguna.");
      }
      setUserActionMsg({
        type: "success",
        text: `Peran akun "${targetEmail}" berhasil diubah menjadi ${role}!`,
      });
      await loadAdminData();
    } catch (err: unknown) {
      setUserActionMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mengubah peran.",
      });
    }
  };

  const handleDeleteUser = async (userId: string, targetEmail: string) => {
    if (!confirm(`Hapus akun pengguna "${targetEmail}" beserta seluruh data progresnya?`)) {
      return;
    }
    setUserActionMsg(null);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus pengguna.");
      }
      setUserActionMsg({
        type: "success",
        text: `Akun "${targetEmail}" berhasil dihapus.`,
      });
      await loadAdminData();
    } catch (err: unknown) {
      setUserActionMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menghapus akun.",
      });
    }
  };

  if (isAuthorized === false) {
    return (
      <main>
        <Navbar />
        <div
          className="wrap"
          style={{ padding: "80px 0", textAlign: "center", minHeight: "60vh" }}
        >
          <ShieldAlert size={56} style={{ color: "#ef4444", margin: "0 auto 18px" }} />
          <h2 style={{ fontSize: "24px", marginBottom: "10px" }}>
            Akses Terbatas: Administrator Only
          </h2>
          <p
            style={{
              color: "#94a3b8",
              maxWidth: "480px",
              margin: "0 auto 24px",
              fontSize: "14px",
            }}
          >
            Halaman ini membutuhkan hak akses peran Administrator. Pastikan Anda telah login
            dengan akun admin yang memiliki otorisasi penuh di server.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <Link href="/login" className="button button-primary">
              Login Akun Admin <ArrowRight size={15} />
            </Link>
            <Link
              href="/dashboard"
              className="button"
              style={{ border: "1px solid #283745", color: "#94a3b8" }}
            >
              Buka Dashboard Siswa
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  const editingCourse = editingCourseId
    ? courses.find((c) => c.id === editingCourseId) || null
    : null;

  const filteredCourses = courses.filter((c) => {
    if (statusFilter === "all") return true;
    return (c.status || "published") === statusFilter;
  });

  return (
    <main>
      <Navbar />

      <section className="admin-wrap wrap">
        {/* Header */}
        <div className="admin-header">
          <div>
            <div className="eyebrow" style={{ marginBottom: "6px" }}>
              <span className="eyebrow-line" /> SIGNAL CASPER ACADEMY
              <span className="eyebrow-muted">ADMINISTRATION PORTAL &amp; COURSE EDITOR</span>
            </div>
            <h1>Panel Kontrol Administrator &amp; Kurikulum</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {currentUser?.email === "apriyanriyan23@gmail.com" ? (
              <span
                className="admin-badge-role"
                style={{
                  background: "linear-gradient(135deg, #2b1f09 0%, #3d2a0a 100%)",
                  borderColor: "#eab308",
                  color: "#fde047",
                  padding: "4px 10px",
                }}
              >
                <Crown
                  size={12}
                  style={{ display: "inline", marginRight: "5px", color: "#facc15" }}
                />
                Master Admin: {currentUser?.name || "Apriyan"} ({currentUser?.email})
              </span>
            ) : (
              <span className="admin-badge-role">
                <ShieldCheck size={12} style={{ display: "inline", marginRight: "4px" }} />
                Role: {currentUser?.role || "ADMIN"} ({currentUser?.email})
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <small>
                <Users size={12} style={{ display: "inline", marginRight: "4px" }} /> Total
                Pengguna
              </small>
              <strong>{stats.totalUsers}</strong>
            </div>
            <div className="admin-stat-card">
              <small>
                <BookOpen size={12} style={{ display: "inline", marginRight: "4px" }} /> Kelas
                Aktif / Total
              </small>
              <strong>
                {stats.totalCourses} / {stats.totalManagedCourses ?? courses.length}
              </strong>
            </div>
            <div className="admin-stat-card">
              <small>
                <Trophy size={12} style={{ display: "inline", marginRight: "4px" }} /> Evaluasi
                Kuis Dikerjakan
              </small>
              <strong>{stats.totalQuizSubmissions}</strong>
            </div>
            <div className="admin-stat-card">
              <small>
                <Database size={12} style={{ display: "inline", marginRight: "4px" }} /> Status
                Database JSON
              </small>
              <strong
                style={{
                  fontSize: "18px",
                  color: "var(--cyan)",
                  textTransform: "uppercase",
                }}
              >
                {stats.databaseStatus} ({stats.backupCount} Backups)
              </strong>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === "courses" ? "active" : ""}`}
            onClick={() => setActiveTab("courses")}
          >
            Course Editor &amp; Kurikulum ({courses.length})
          </button>
          <button
            className={`admin-tab ${activeTab === "stats" ? "active" : ""}`}
            onClick={() => {
              setEditingCourseId(null);
              setActiveTab("stats");
            }}
          >
            Kesehatan DB &amp; Audit Log ({auditLogs.length})
          </button>
          <button
            className={`admin-tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => {
              setEditingCourseId(null);
              setActiveTab("users");
            }}
          >
            Manajemen Pengguna &amp; Mentor ({users.length})
          </button>
          <button
            className={`admin-tab ${activeTab === "quizzes" ? "active" : ""}`}
            onClick={() => {
              setEditingCourseId(null);
              setActiveTab("quizzes");
            }}
          >
            Riwayat Evaluasi Kuis ({submissions.length})
          </button>
          <button
            className={`admin-tab ${activeTab === "intelligence" ? "active" : ""}`}
            onClick={() => {
              setEditingCourseId(null);
              setActiveTab("intelligence");
            }}
          >
            Student Intelligence &amp; Jurnal Kohort
          </button>
        </div>

        {/* TAB 1: Stats, System Health & Audit Logs */}
        {activeTab === "stats" && (
          <div>
            <div
              style={{
                background: "#0d131b",
                border: "1px solid #1c2734",
                padding: "24px",
                borderRadius: "6px",
                marginBottom: "24px",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Database size={18} style={{ color: "var(--cyan)" }} /> Parameter Keamanan
                Database &amp; Penyimpanan Kurikulum
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  lineHeight: "1.9",
                  fontSize: "13px",
                  color: "#94a3b8",
                }}
              >
                <li>
                  Penyimpanan: <strong>JSON File Database</strong> (Atomic write + fsync) di{" "}
                  <code>data/academy.json</code>.
                </li>
                <li>
                  Arsitektur Kurikulum:{" "}
                  <strong>Hybrid Copy-on-Write Override + Canonical Baseline Fallback</strong>{" "}
                  untuk 9 kelas utama (C1–C9) dan kelas kustom.
                </li>
                <li>
                  Mekanisme Perlindungan Korupsi: Karantina otomatis ke{" "}
                  <code>academy.corrupt.*.json</code> jika berkas cacat.
                </li>
                <li>
                  Rolling Backup: Menyimpan hingga 7 snapshot rotasi otomatis di{" "}
                  <code>data/backups/</code>.
                </li>
                <li>
                  Otorisasi: Seluruh endpoint mutasi admin diverifikasi kriptografis di server
                  (Zero Client-Side Trust).
                </li>
              </ul>
            </div>

            <div
              style={{
                background: "#0d131b",
                border: "1px solid #1c2734",
                padding: "24px",
                borderRadius: "6px",
              }}
            >
              <h3 style={{ fontSize: "16px", marginTop: 0, marginBottom: "14px" }}>
                Riwayat Audit Perubahan Kurikulum Admin
              </h3>
              {auditLogs.length === 0 ? (
                <div style={{ color: "#788a9c", fontSize: "13px" }}>
                  Belum ada aktivitas perubahan kurikulum yang tercatat pada sesi ini.
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Admin</th>
                      <th>Aksi</th>
                      <th>Kelas</th>
                      <th>Ringkasan Perubahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontSize: "12px" }}>
                          {new Date(log.created_at).toLocaleString("id-ID")}
                        </td>
                        <td>{log.admin_email}</td>
                        <td>
                          <code>{log.action}</code>
                        </td>
                        <td>
                          <code>{log.target_course_slug}</code>
                        </td>
                        <td>{log.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Courses Management & Full Course Editor Workspace */}
        {activeTab === "courses" && (
          <div>
            {editingCourse ? (
              <CourseEditorWorkspace
                key={editingCourse.id}
                initialCourse={editingCourse}
                onClose={() => setEditingCourseId(null)}
                onSaved={async () => {
                  await loadAdminData();
                }}
                onResetBaseline={handleResetBaseline}
              />
            ) : (
              <div>
                {formMsg && (
                  <div
                    className={
                      formMsg.type === "success"
                        ? "quiz-eval-banner passed"
                        : "auth-error-alert"
                    }
                    style={{ marginBottom: "16px" }}
                  >
                    {formMsg.type === "success" ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <span>{formMsg.text}</span>
                  </div>
                )}

                {/* Toolbar: Filter Status & Toggle Create Course */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {(["all", "published", "draft", "archived"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`admin-btn ${
                          statusFilter === st ? "admin-btn-primary" : ""
                        }`}
                      >
                        {st === "all"
                          ? `Semua Kelas (${courses.length})`
                          : st === "published"
                            ? `Published (${
                                courses.filter((c) => (c.status || "published") === "published")
                                  .length
                              })`
                            : st === "draft"
                              ? `Draft (${courses.filter((c) => c.status === "draft").length})`
                              : `Archived (${
                                  courses.filter((c) => c.status === "archived").length
                                })`}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCreateForm((v) => !v)}
                    className="admin-btn admin-btn-primary"
                    style={{ padding: "9px 16px" }}
                  >
                    <Plus size={15} />{" "}
                    {showCreateForm ? "Tutup Form Kelas Baru" : "Buat Kelas Baru"}
                  </button>
                </div>

                {/* Form Create Course */}
                {showCreateForm && (
                  <form onSubmit={handleCreateCourse} className="admin-form">
                    <h3
                      style={{
                        fontSize: "18px",
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Plus size={18} style={{ color: "var(--cyan)" }} /> Tambah Kelas
                      Pembelajaran Baru
                    </h3>

                    <div className="admin-form-row">
                      <div className="admin-input-group">
                        <label>Judul Kelas *</label>
                        <input
                          type="text"
                          required
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="Contoh: SMC & Liquidity Concept"
                          className="admin-input"
                        />
                      </div>
                      <div className="admin-input-group">
                        <label>Sub-Judul</label>
                        <input
                          type="text"
                          value={newSubtitle}
                          onChange={(e) => setNewSubtitle(e.target.value)}
                          placeholder="Membongkar cara kerja smart money"
                          className="admin-input"
                        />
                      </div>
                    </div>

                    <div
                      className="admin-form-row"
                      style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}
                    >
                      <div className="admin-input-group">
                        <label>Kategori</label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
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
                          value={newLevel}
                          onChange={(e) => setNewLevel(e.target.value)}
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
                          value={newDuration}
                          onChange={(e) => setNewDuration(e.target.value)}
                          placeholder="misal 3 Jam"
                          className="admin-input"
                        />
                      </div>
                      <div className="admin-input-group">
                        <label>Status Awal</label>
                        <select
                          value={newStatus}
                          onChange={(e) =>
                            setNewStatus(e.target.value as CoursePublicationStatus)
                          }
                          className="admin-input"
                        >
                          <option value="published">Published (Langsung Tampil)</option>
                          <option value="draft">Draft (Simpan Dulu)</option>
                        </select>
                      </div>
                    </div>

                    <div className="admin-input-group">
                      <label>Deskripsi &amp; Overview Kelas</label>
                      <textarea
                        value={newOverview}
                        onChange={(e) => setNewOverview(e.target.value)}
                        placeholder="Jelaskan secara ringkas kompetensi yang akan dicapai oleh siswa..."
                        className="admin-textarea"
                      />
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="admin-btn admin-btn-primary"
                        style={{ padding: "10px 20px" }}
                      >
                        {isSubmitting ? "Menyimpan Kelas..." : "Buat & Buka Course Editor"}{" "}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </form>
                )}

                {/* Courses Table */}
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: "80px" }}>Urutan</th>
                      <th>Kode &amp; Judul Kelas</th>
                      <th>Sumber &amp; Kategori</th>
                      <th>Struktur Materi</th>
                      <th>Status Publikasi</th>
                      <th>Aksi Kurikulum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.map((c, idx) => (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono, monospace)",
                                fontSize: "12px",
                                color: "#94a3b8",
                                minWidth: "20px",
                              }}
                            >
                              #{c.order ?? idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleReorderCourse(c.id, "up")}
                              disabled={idx === 0}
                              className="admin-btn"
                              style={{ padding: "3px 5px" }}
                              title="Geser urutan naik"
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReorderCourse(c.id, "down")}
                              disabled={idx === filteredCourses.length - 1}
                              className="admin-btn"
                              style={{ padding: "3px 5px" }}
                              title="Geser urutan turun"
                            >
                              <ArrowDown size={11} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <code>{c.number}</code>
                            <strong>{c.title}</strong>
                          </div>
                          <div style={{ fontSize: "11px", color: "#788a9c", marginTop: "2px" }}>
                            {c.subtitle} • <code>/{c.slug}</code>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <span className="course-level-badge">{c.level}</span>
                            {c.isStaticBaseline ? (
                              <span
                                className="badge-role"
                                style={{
                                  background: c.isOverridden ? "#2e1a47" : "#112233",
                                  color: c.isOverridden ? "#d8b4fe" : "#7dd3fc",
                                }}
                              >
                                {c.isOverridden ? "Inti (Diedit)" : "Inti (Default)"}
                              </span>
                            ) : (
                              <span
                                className="badge-role"
                                style={{ background: "#0e2920", color: "#86efac" }}
                              >
                                Kelas Kustom
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                            {c.category}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: "12px", fontWeight: 600 }}>
                            {c.modulesCount ?? c.modules?.length ?? 0} Modul • {c.totalLessons}{" "}
                            Pelajaran
                          </div>
                          <div style={{ fontSize: "11px", color: "#788a9c" }}>
                            {c.quizQuestionsCount ?? 0} Soal Kuis •{" "}
                            {c.enrolledUsersCount ?? 0} Siswa
                          </div>
                        </td>
                        <td>
                          <select
                            value={c.status || "published"}
                            onChange={(e) =>
                              handleChangeCourseStatus(
                                c.id,
                                e.target.value as CoursePublicationStatus
                              )
                            }
                            className="admin-input"
                            style={{
                              width: "auto",
                              padding: "5px 8px",
                              fontSize: "11px",
                              borderColor:
                                c.status === "draft"
                                  ? "#a16207"
                                  : c.status === "archived"
                                    ? "#475569"
                                    : "#15803d",
                            }}
                            aria-label={`Status publikasi ${c.title}`}
                          >
                            <option value="published">Published (Aktif)</option>
                            <option value="draft">Draft</option>
                            <option value="archived">Archived</option>
                          </select>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => setEditingCourseId(c.id)}
                              className="admin-btn admin-btn-primary"
                              title="Edit modul, pelajaran, konten, diagram, dan kuis"
                            >
                              <Edit3 size={13} /> Edit Kurikulum
                            </button>
                            <Link href={`/belajar/${c.slug}`} className="admin-btn">
                              Lihat
                            </Link>
                            {c.isStaticBaseline && c.isOverridden && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Kembalikan "${c.title}" ke kurikulum bawaan pabrik (Factory Default)?`
                                    )
                                  ) {
                                    handleResetBaseline(c.id);
                                  }
                                }}
                                className="admin-btn"
                                style={{ borderColor: "#f59e0b", color: "#fbbf24" }}
                                title="Reset ke kurikulum bawaan pabrik"
                              >
                                <RotateCcw size={13} />
                              </button>
                            )}
                            {!c.isStaticBaseline && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomCourse(c)}
                                className="admin-btn admin-btn-danger"
                                title="Hapus kelas kustom"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Users & Mentors Management */}
        {activeTab === "users" && (
          <div>
            {userActionMsg && (
              <div
                className={
                  userActionMsg.type === "success"
                    ? "quiz-eval-banner passed"
                    : "auth-error-alert"
                }
                style={{ marginBottom: "16px" }}
              >
                {userActionMsg.type === "success" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
                <span>{userActionMsg.text}</span>
              </div>
            )}

            {/* Toolbar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div style={{ position: "relative", minWidth: "260px" }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                />
                <input
                  type="text"
                  placeholder="Cari nama atau email pengguna..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="admin-input"
                  style={{ paddingLeft: "34px", width: "100%", fontSize: "12px" }}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAddUserForm((v) => !v)}
                className="admin-btn admin-btn-primary"
                style={{ padding: "8px 16px" }}
              >
                <UserPlus size={15} />{" "}
                {showAddUserForm ? "Tutup Form Tambah" : "Tambah Mentor / Admin Baru"}
              </button>
            </div>

            {/* Add User Form */}
            {showAddUserForm && (
              <form onSubmit={handleCreateUser} className="admin-form">
                <h3
                  style={{
                    fontSize: "16px",
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <UserPlus size={16} style={{ color: "var(--cyan)" }} /> Daftarkan Akun Pengguna
                  / Mentor Baru
                </h3>

                <div className="admin-form-row">
                  <div className="admin-input-group">
                    <label>Nama Lengkap *</label>
                    <input
                      type="text"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Contoh: Riyan Mentor XAUUSD"
                      className="admin-input"
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="mentor@signalcasper.com"
                      className="admin-input"
                    />
                  </div>
                </div>

                <div className="admin-form-row">
                  <div className="admin-input-group">
                    <label>Kata Sandi Awal * (Min 6 Karakter)</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="••••••••"
                      className="admin-input"
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Hak Akses / Peran Akun</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="admin-input"
                    >
                      <option value="MENTOR">MENTOR (Mentor / Instruktur Kelas)</option>
                      <option value="ADMIN">ADMIN (Administrator Penuh)</option>
                      <option value="USER">USER (Siswa Reguler)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmittingUser}
                    className="admin-btn admin-btn-primary"
                    style={{ padding: "9px 18px" }}
                  >
                    {isSubmittingUser ? "Menyimpan Akun..." : "Buat Akun Sekarang"}
                  </button>
                </div>
              </form>
            )}

            {/* Users Table */}
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pengguna (Nama &amp; Email)</th>
                  <th>Peran Saat Ini</th>
                  <th>Ubah Hak Akses</th>
                  <th>ID Pengguna</th>
                  <th>Tanggal Bergabung</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter((u) => {
                    const q = userSearch.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
                    );
                  })
                  .map((u) => {
                    const isMaster =
                      u.email.toLowerCase() === "apriyanriyan23@gmail.com";
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong>{u.name}</strong>
                            {isMaster && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  padding: "2px 6px",
                                  borderRadius: "3px",
                                  background: "#3d2a0a",
                                  color: "#fde047",
                                  border: "1px solid #ca8a04",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                }}
                              >
                                <Crown size={10} /> MASTER
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "11px", color: "#788a9c", marginTop: "2px" }}>
                            {u.email}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge-role ${
                              u.role === "ADMIN"
                                ? "admin"
                                : u.role === "MENTOR"
                                  ? ""
                                  : ""
                            }`}
                            style={
                              u.role === "MENTOR"
                                ? { background: "#0e2920", color: "#86efac", border: "1px solid #14532d" }
                                : u.role === "ADMIN"
                                  ? { background: "#2e1a47", color: "#d8b4fe", border: "1px solid #6b21a8" }
                                  : { background: "#1e293b", color: "#94a3b8" }
                            }
                          >
                            {u.role}
                          </span>
                        </td>
                        <td>
                          {isMaster ? (
                            <span style={{ fontSize: "11px", color: "#788a9c", fontStyle: "italic" }}>
                              Master Admin (Terkunci)
                            </span>
                          ) : (
                            <select
                              value={u.role}
                              onChange={(e) => handleChangeUserRole(u.id, u.email, e.target.value)}
                              className="admin-input"
                              style={{
                                width: "auto",
                                padding: "4px 8px",
                                fontSize: "11px",
                                borderColor:
                                  u.role === "ADMIN"
                                    ? "#6b21a8"
                                    : u.role === "MENTOR"
                                      ? "#14532d"
                                      : "#253545",
                              }}
                              aria-label={`Ubah peran untuk ${u.email}`}
                            >
                              <option value="USER">USER (Siswa)</option>
                              <option value="MENTOR">MENTOR (Mentor / Instruktur)</option>
                              <option value="ADMIN">ADMIN (Administrator)</option>
                            </select>
                          )}
                        </td>
                        <td>
                          <code style={{ fontSize: "10px" }}>{u.id.slice(0, 13)}...</code>
                        </td>
                        <td style={{ fontSize: "12px", color: "#94a3b8" }}>
                          {new Date(u.created_at).toLocaleDateString("id-ID")}
                        </td>
                        <td>
                          {!isMaster && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              className="admin-btn admin-btn-danger"
                              title="Hapus akun pengguna"
                              style={{ padding: "4px 8px" }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: Quiz Submissions */}
        {activeTab === "quizzes" && (
          <div>
            {submissions.length === 0 ? (
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "#8292a2",
                  background: "#0d131b",
                  border: "1px solid #1c2734",
                }}
              >
                Belum ada evaluasi kuis yang dikerjakan oleh siswa.
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Kelas</th>
                    <th>ID Materi</th>
                    <th>Skor Kuis</th>
                    <th>Status</th>
                    <th>Waktu Pengerjaan</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => {
                    const isPass = s.score >= 70;
                    return (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.course_slug}</strong>
                        </td>
                        <td>
                          <code>{s.lesson_id}</code>
                        </td>
                        <td>
                          <strong style={{ fontSize: "14px" }}>{s.score}%</strong>
                        </td>
                        <td>
                          <span
                            className="badge-role"
                            style={{
                              background: isPass ? "#0e2920" : "#2e1317",
                              color: isPass ? "#86efac" : "#fca5a5",
                              border: `1px solid ${isPass ? "#14532d" : "#7f1d1d"}`,
                            }}
                          >
                            {isPass ? "Lulus ✓" : "Perlu Ulang"}
                          </span>
                        </td>
                        <td>{new Date(s.created_at).toLocaleString("id-ID")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 5: Admin Student Intelligence (Anonymized Aggregate Only) */}
        {activeTab === "intelligence" && (
          <div className="admin-intelligence-panel">
            <div className="journal-privacy-explainer" style={{ marginBottom: "22px" }}>
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
                    style={{ display: "inline", marginRight: "6px", verticalAlign: "-2px" }}
                  />
                  PRIVACY GUARANTEE: {intelligence?.privacyGuarantee || "STRICT_ANONYMIZED_AGGREGATE_ONLY"}
                </strong>
                <span className="journal-status-pill">
                  STATUS KOHORT: {intelligence?.cohortRepresentativenessStatus || "EMPTY_COHORT"}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                {intelligence?.cohortDisclaimer ||
                  "Laporan ini hanya menampilkan statistik edukasi agregat anonim. Tidak ada nominal P/L pribadi, saldo akun, maupun catatan trade siswa yang diekspos ke Administrator."}
              </p>
            </div>

            {intelligence ? (
              <div className="journal-section-stack">
                {/* Cohort Adoption & Completeness Grid */}
                <div className="admin-stats-grid">
                  <div className="admin-stat-card">
                    <small>Adopsi Jurnal Siswa</small>
                    <strong>
                      {intelligence.population.studentsWithJournalCount} /{" "}
                      {intelligence.population.totalRegisteredStudents}
                    </strong>
                    <div style={{ fontSize: "11px", color: "#7f91a3", marginTop: "4px" }}>
                      Adoption Rate: {intelligence.population.journalAdoptionRate.toFixed(1)}% (Aktif:{" "}
                      {intelligence.population.activeJournalingStudentsCount})
                    </div>
                  </div>

                  <div className="admin-stat-card">
                    <small>Total Trade Kohort</small>
                    <strong>{intelligence.journalActivity.totalTradesAcrossCohort}</strong>
                    <div style={{ fontSize: "11px", color: "#7f91a3", marginTop: "4px" }}>
                      Closed: {intelligence.journalActivity.totalClosedTradesAcrossCohort} · Open:{" "}
                      {intelligence.journalActivity.totalOpenTradesAcrossCohort}
                    </div>
                  </div>

                  <div className="admin-stat-card">
                    <small>Kelengkapan Jurnal &amp; Risiko</small>
                    <strong>
                      {intelligence.journalActivity.journalCompletenessRate.toFixed(1)}%
                    </strong>
                    <div style={{ fontSize: "11px", color: "#7f91a3", marginTop: "4px" }}>
                      Adopsi Planned Risk (1R):{" "}
                      {intelligence.journalActivity.riskManagementAdoptionRate.toFixed(1)}%
                    </div>
                  </div>

                  <div className="admin-stat-card">
                    <small>Status Consent Mentor</small>
                    <strong>{intelligence.consentOverview.activeConsentsCount} Aktif</strong>
                    <div style={{ fontSize: "11px", color: "#7f91a3", marginTop: "4px" }}>
                      Analytics-Only: {intelligence.consentOverview.analyticsOnlyScopeCount} · Full:{" "}
                      {intelligence.consentOverview.fullJournalScopeCount} · Dicabut:{" "}
                      {intelligence.consentOverview.revokedOrExpiredConsentsCount}
                    </div>
                  </div>
                </div>

                {/* Distribution Cards Row */}
                <div className="journal-intel-two-col">
                  <div className="journal-panel">
                    <h4>Distribusi Tipe Akun Siswa</h4>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Tipe Akun</th>
                          <th>Jumlah Akun</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>PROP FIRM</td>
                          <td>
                            <strong>{intelligence.accountTypeDistribution.PROP_FIRM}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td>LIVE</td>
                          <td>
                            <strong>{intelligence.accountTypeDistribution.LIVE}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td>DEMO</td>
                          <td>
                            <strong>{intelligence.accountTypeDistribution.DEMO}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td>PAPER</td>
                          <td>
                            <strong>{intelligence.accountTypeDistribution.PAPER}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="journal-panel">
                    <h4>Distribusi Sample Confidence Siswa</h4>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Kategori Sampel</th>
                          <th>Jumlah Siswa</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>SUFFICIENT (≥ 30 Closed Trades)</td>
                          <td>
                            <strong style={{ color: "var(--green)" }}>
                              {intelligence.sampleStatusDistribution.SUFFICIENT}
                            </strong>
                          </td>
                        </tr>
                        <tr>
                          <td>INSUFFICIENT (&lt; 30 Closed Trades)</td>
                          <td>
                            <strong style={{ color: "#fde047" }}>
                              {intelligence.sampleStatusDistribution.INSUFFICIENT}
                            </strong>
                          </td>
                        </tr>
                        <tr>
                          <td>NO_DATA (0 Closed Trades)</td>
                          <td>
                            <strong>{intelligence.sampleStatusDistribution.NO_DATA}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Execution Mistakes & Top Emotions */}
                <div className="journal-intel-two-col">
                  <div className="journal-panel">
                    <h4>Top Kesalahan Eksekusi Kohort (Kurikulum Target)</h4>
                    {intelligence.behavioralInsights.topMistakes.length > 0 ? (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Kesalahan Eksekusi</th>
                            <th>Frekuensi</th>
                            <th>Porsi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {intelligence.behavioralInsights.topMistakes.map((m) => (
                            <tr key={m.mistake}>
                              <td>
                                <strong>{m.label}</strong>
                              </td>
                              <td>{m.count} Trade</td>
                              <td>{m.percentage.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="journal-empty-inline">
                        Belum ada data kesalahan eksekusi yang tercatat.
                      </div>
                    )}
                  </div>

                  <div className="journal-panel">
                    <h4>Distribusi Psikologi &amp; Emosi Kohort</h4>
                    {intelligence.behavioralInsights.topEmotions.length > 0 ? (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Kondisi Emosi</th>
                            <th>Frekuensi</th>
                            <th>Porsi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {intelligence.behavioralInsights.topEmotions.map((em) => (
                            <tr key={em.emotion}>
                              <td>
                                <strong>{em.label}</strong>
                              </td>
                              <td>{em.count} Trade</td>
                              <td>{em.percentage.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="journal-empty-inline">
                        Belum ada data psikologi/emosi yang tercatat.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="journal-empty-inline">
                Memuat laporan agregat Student Intelligence...
              </div>
            )}
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
