"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
  Layers,
  Sparkles,
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalCourses: number;
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

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<{ id?: string; name?: string; email?: string; role?: string } | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"stats" | "courses" | "users" | "quizzes">("stats");

  // Admin Data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Form State for creating course
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newCategory, setNewCategory] = useState("Trading Foundation");
  const [newLevel, setNewLevel] = useState("Beginner");
  const [newDuration, setNewDuration] = useState("2 Jam");
  const [newOverview, setNewOverview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadAdminData = async () => {
    try {
      const res = await fetch("/api/admin/overview");
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
    } catch {
      setIsAuthorized(false);
    }
  };

  useEffect(() => {
    // Check me
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
          overview: newOverview,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat kelas.");
      }

      setFormMsg({ type: "success", text: `Kelas "${newTitle}" berhasil dibuat dan dipublikasikan!` });
      setNewTitle("");
      setNewSubtitle("");
      setNewOverview("");
      loadAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      setFormMsg({ type: "error", text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomCourse = async (id: string) => {
    if (!confirm("Hapus kelas kustom ini?")) return;
    try {
      await fetch(`/api/admin/courses?id=${id}`, { method: "DELETE" });
      loadAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  if (isAuthorized === false) {
    return (
      <main>
        <Navbar />
        <div className="wrap" style={{ padding: "80px 0", textAlign: "center", minHeight: "60vh" }}>
          <ShieldAlert size={56} style={{ color: "#ef4444", margin: "0 auto 18px" }} />
          <h2 style={{ fontSize: "24px", marginBottom: "10px" }}>Akses Terbatas: Administrator Only</h2>
          <p style={{ color: "#94a3b8", maxWidth: "480px", margin: "0 auto 24px", fontSize: "14px" }}>
            Halaman ini membutuhkan hak akses peran Administrator. Pastikan Anda telah login dengan akun admin yang memiliki otorisasi penuh di server.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <Link href="/login" className="button button-primary">
              Login Akun Admin <ArrowRight size={15} />
            </Link>
            <Link href="/dashboard" className="button" style={{ border: "1px solid #283745", color: "#94a3b8" }}>
              Buka Dashboard Siswa
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main>
      <Navbar />

      <section className="admin-wrap wrap">
        {/* Header */}
        <div className="admin-header">
          <div>
            <div className="eyebrow" style={{ marginBottom: "6px" }}>
              <span className="eyebrow-line" /> SIGNAL CASPER ACADEMY
              <span className="eyebrow-muted">ADMINISTRATION PORTAL</span>
            </div>
            <h1>Panel Kontrol Administrator</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="admin-badge-role">
              <ShieldCheck size={12} style={{ display: "inline", marginRight: "4px" }} />
              Role: {currentUser?.role || "ADMIN"} ({currentUser?.email})
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <small><Users size={12} style={{ display: "inline", marginRight: "4px" }} /> Total Pengguna</small>
              <strong>{stats.totalUsers}</strong>
            </div>
            <div className="admin-stat-card">
              <small><BookOpen size={12} style={{ display: "inline", marginRight: "4px" }} /> Total Kelas Aktif</small>
              <strong>{stats.totalCourses}</strong>
            </div>
            <div className="admin-stat-card">
              <small><Trophy size={12} style={{ display: "inline", marginRight: "4px" }} /> Evaluasi Kuis Dikerjakan</small>
              <strong>{stats.totalQuizSubmissions}</strong>
            </div>
            <div className="admin-stat-card">
              <small><Database size={12} style={{ display: "inline", marginRight: "4px" }} /> Status Database JSON</small>
              <strong style={{ fontSize: "18px", color: "var(--cyan)", textTransform: "uppercase" }}>
                {stats.databaseStatus} ({stats.backupCount} Backups)
              </strong>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === "stats" ? "active" : ""}`}
            onClick={() => setActiveTab("stats")}
          >
            Ringkasan &amp; Kesehatan DB
          </button>
          <button
            className={`admin-tab ${activeTab === "courses" ? "active" : ""}`}
            onClick={() => setActiveTab("courses")}
          >
            Manajemen Kelas ({courses.length})
          </button>
          <button
            className={`admin-tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            Daftar Siswa Terdaftar ({users.length})
          </button>
          <button
            className={`admin-tab ${activeTab === "quizzes" ? "active" : ""}`}
            onClick={() => setActiveTab("quizzes")}
          >
            Riwayat Evaluasi Kuis ({submissions.length})
          </button>
        </div>

        {/* TAB 1: Stats & System Health */}
        {activeTab === "stats" && (
          <div>
            <div style={{ background: "#0d131b", border: "1px solid #1c2734", padding: "24px", borderRadius: "6px", marginBottom: "24px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Database size={18} style={{ color: "var(--cyan)" }} /> Parameter Keamanan Database Server
              </h3>
              <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: "1.9", fontSize: "13px", color: "#94a3b8" }}>
                <li>Penyimpanan: <strong>JSON File Database</strong> (Atomic write + fsync) di <code>data/academy.json</code>.</li>
                <li>Mekanisme Perlindungan Korupsi: Karantina otomatis ke <code>academy.corrupt.*.json</code> jika berkas cacat.</li>
                <li>Rolling Backup: Menyimpan hingga 7 snapshot rotasi otomatis di <code>data/backups/</code>.</li>
                <li>Eksekusi Server: Single instance PM2 (Mode Fork) terlindungi dari konflik multi-proses.</li>
                <li>Otorisasi: Seluruh endpoint mutasi admin diverifikasi kriptografis di server (Zero Client-Side Trust).</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 2: Courses Management */}
        {activeTab === "courses" && (
          <div>
            {/* Form Create Course */}
            <form onSubmit={handleCreateCourse} className="admin-form">
              <h3 style={{ fontSize: "18px", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Plus size={18} style={{ color: "var(--cyan)" }} /> Tambah Kelas Pembelajaran Baru
              </h3>

              {formMsg && (
                <div className={formMsg.type === "success" ? "quiz-eval-banner passed" : "auth-error-alert"}>
                  {formMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{formMsg.text}</span>
                </div>
              )}

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

              <div className="admin-form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
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

              <div>
                <button type="submit" disabled={isSubmitting} className="admin-btn admin-btn-primary" style={{ padding: "10px 20px" }}>
                  {isSubmitting ? "Menyimpan Kelas..." : "Publikasikan Kelas"} <ArrowRight size={15} />
                </button>
              </div>
            </form>

            {/* Courses Table */}
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Judul Kelas</th>
                  <th>Kategori</th>
                  <th>Tingkat</th>
                  <th>Materi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td><code>{c.number}</code></td>
                    <td>
                      <strong>{c.title}</strong>
                      <div style={{ fontSize: "11px", color: "#788a9c" }}>{c.subtitle}</div>
                    </td>
                    <td>{c.category}</td>
                    <td><span className="course-level-badge">{c.level}</span></td>
                    <td>{c.totalLessons} Pelajaran</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Link href={`/belajar/${c.slug}`} className="admin-btn">
                          Lihat
                        </Link>
                        {c.id.startsWith("custom-") && (
                          <button
                            onClick={() => handleDeleteCustomCourse(c.id)}
                            className="admin-btn admin-btn-danger"
                            title="Hapus kelas custom"
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

        {/* TAB 3: Users List */}
        {activeTab === "users" && (
          <div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nama Siswa</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>ID Pengguna</th>
                  <th>Tanggal Bergabung</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge-role ${u.role === "ADMIN" ? "admin" : ""}`}>
                        {u.role}
                      </span>
                    </td>
                    <td><code style={{ fontSize: "10px" }}>{u.id.slice(0, 13)}...</code></td>
                    <td>{new Date(u.created_at).toLocaleDateString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: Quiz Submissions */}
        {activeTab === "quizzes" && (
          <div>
            {submissions.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#8292a2", background: "#0d131b", border: "1px solid #1c2734" }}>
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
                        <td><strong>{s.course_slug}</strong></td>
                        <td><code>{s.lesson_id}</code></td>
                        <td><strong style={{ fontSize: "14px" }}>{s.score}%</strong></td>
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
      </section>

      <Footer />
    </main>
  );
}
