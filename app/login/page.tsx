"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { setAuthenticatedSessionUser } from "@/lib/progress";
import { ArrowLeft, ArrowRight, Lock, Mail, ShieldCheck, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal masuk. Periksa email dan kata sandi Anda.");
        setLoading(false);
        return;
      }

      // Isolate progress storage for this user and clear any previous account cache
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
          <h2>Selamat Datang Kembali</h2>
          <p>Masuk untuk melanjutkan riwayat modul dan kuis trading Anda.</p>
        </div>

        {errorMsg && (
          <div className="auth-error-alert">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Terdaftar</label>
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
            <div className="form-label-row">
              <label htmlFor="password">Kata Sandi</label>
              <a href="#" className="forgot-pass-link">Lupa sandi?</a>
            </div>
            <div className="input-field">
              <Lock size={16} />
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="button button-primary auth-submit-btn" disabled={loading}>
            {loading ? "Memverifikasi..." : "Masuk ke Dashboard"} <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-footer-text">
          <span>Belum memiliki akun?</span>{" "}
          <Link href="/register" className="auth-switch-link">
            Daftar Akun Gratis
          </Link>
        </div>

        <div className="auth-security-notice">
          <ShieldCheck size={14} />
          <span>Database server terenkripsi. Progres tersimpan aman.</span>
        </div>
      </div>
    </div>
  );
}
