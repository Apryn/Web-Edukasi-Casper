"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { setAuthenticatedSessionUser } from "@/lib/progress";
import { AlertCircle, ArrowLeft, ArrowRight, Lock, Mail, ShieldCheck, User } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal mendaftarkan akun.");
        setLoading(false);
        return;
      }

      if (data.user) {
        setAuthenticatedSessionUser(data.user);
      }

      router.push("/dashboard");
    } catch {
      setErrorMsg("Tidak dapat terhubung ke server database.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-topline">
        <Link href="/" className="auth-back">
          <ArrowLeft size={15} /> Kembali ke Beranda
        </Link>
        <span className="auth-tag">SIGNAL CASPER ACADEMY</span>
      </div>

      <div className="auth-card">
        <div className="auth-brand">
          <Image
            src="/signal-casper.png"
            alt="Signal Casper"
            width={52}
            height={60}
            className="brand-mark"
          />
          <h2>Mulai Perjalanan Trading Anda</h2>
          <p>Daftar akun gratis untuk mencatat progres kelas, mengerjakan kuis, dan menyimpan catatan belajar di database server.</p>
        </div>

        {errorMsg && (
          <div className="auth-error-alert">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Nama Lengkap</label>
            <div className="input-field">
              <User size={16} />
              <input
                id="name"
                type="text"
                required
                placeholder="Nama Anda"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-field">
              <Mail size={16} />
              <input
                id="email"
                type="email"
                required
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Kata Sandi</label>
            <div className="input-field">
              <Lock size={16} />
              <input
                id="password"
                type="password"
                required
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="button button-primary auth-submit-btn" disabled={loading}>
            {loading ? "Mendaftarkan..." : "Daftar & Mulai Belajar"} <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-footer-text">
          <span>Sudah memiliki akun?</span>{" "}
          <Link href="/login" className="auth-switch-link">
            Masuk Sekarang
          </Link>
        </div>

        <div className="auth-security-notice">
          <ShieldCheck size={14} />
          <span>Komitmen kami: Edukasi berbasis proses, tanpa klaim profit palsu.</span>
        </div>
      </div>
    </div>
  );
}
