"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowUpRight, GraduationCap, LayoutDashboard, LineChart, Menu, X } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string; role?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <div className="topline">
        <span>INDEPENDENT TRADING EDUCATION &amp; MARKET INTELLIGENCE</span>
        <span className="topline-right">
          <span className="live-dot" /> SC ACADEMY v1.0 <span className="topline-index">SC / 2026</span>
        </span>
      </div>

      <header className="nav wrap">
        <Link className="brand" href="/" aria-label="Signal Casper Home">
          <Image
            src="/signal-casper.png"
            alt="Signal Casper"
            width={48}
            height={55}
            priority
            className="brand-mark"
          />
          <span className="brand-name">
            SIGNAL <b>CASPER</b>
            <small>ACADEMY &amp; DESK</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Navigasi utama">
          <Link href="/analisa" className={isActive("/analisa") ? "nav-active" : ""}>
            Analisa Market
          </Link>
          <Link href="/belajar" className={isActive("/belajar") ? "nav-active" : ""}>
            Katalog Kelas
          </Link>
          <Link href="/dashboard" className={isActive("/dashboard") ? "nav-active" : ""}>
            Dashboard
          </Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" className={isActive("/admin") ? "nav-active" : ""} style={{ color: "var(--cyan)" }}>
              Admin Panel
            </Link>
          )}
          <Link href="/#tools">Tools</Link>
        </nav>

        <div className="nav-right-actions">
          {user ? (
            <Link href="/dashboard" className="nav-secondary-link" style={{ color: "var(--cyan)" }}>
              {user.name?.split(" ")[0] || "Akun Saya"}
            </Link>
          ) : (
            <Link href="/login" className="nav-secondary-link">
              Masuk
            </Link>
          )}
          <Link className="nav-cta" href="/belajar">
            Mulai Belajar <ArrowUpRight size={15} />
          </Link>
        </div>

        <button
          className="mobile-menu"
          aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {mobileOpen && (
        <div className="mobile-drawer">
          <Link href="/" onClick={() => setMobileOpen(false)}>Home</Link>
          <Link href="/analisa" onClick={() => setMobileOpen(false)}>Analisa Market</Link>
          <Link href="/belajar" onClick={() => setMobileOpen(false)}>Katalog Kelas</Link>
          <Link href="/dashboard" onClick={() => setMobileOpen(false)}>Dashboard Belajar</Link>
          <Link href="/login" onClick={() => setMobileOpen(false)}>Masuk Akun</Link>
          <Link href="/register" className="mobile-drawer-cta" onClick={() => setMobileOpen(false)}>Daftar Sekarang</Link>
        </div>
      )}
    </>
  );
}
