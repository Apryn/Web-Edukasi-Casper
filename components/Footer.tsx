import Link from "next/link";
import Image from "next/image";
import { CircleHelp } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer wrap" id="kontak">
      <div className="footer-main">
        <Link className="brand footer-brand" href="/">
          <Image
            src="/signal-casper.png"
            alt="Signal Casper"
            width={45}
            height={52}
            className="brand-mark"
          />
          <span className="brand-name">
            SIGNAL <b>CASPER</b>
            <small>ACADEMY &amp; MARKET INTELLIGENCE</small>
          </span>
        </Link>
        <p>
          Platform belajar trading mandiri dan analisa market terstruktur. Dibangun untuk membantu trader memahami proses dan risiko secara objektif.
        </p>
      </div>

      <div className="footer-links">
        <div>
          <span>ACADEMY</span>
          <Link href="/belajar">Katalog Kelas</Link>
          <Link href="/dashboard">Dashboard Siswa</Link>
          <Link href="/belajar/trading-fundamentals">Trading Fundamentals</Link>
          <Link href="/belajar/xauusd-market-analysis">Spesialisasi XAUUSD</Link>
        </div>
        <div>
          <span>RESOURCES</span>
          <Link href="/analisa">Analisa Market Desk</Link>
          <Link href="/#tools">Trader Workbench</Link>
          <Link href="/login">Portal Siswa</Link>
        </div>
        <div>
          <span>LEGAL</span>
          <Link href="/#disclaimer">Risk Disclaimer</Link>
          <Link href="/#tentang">Prinsip &amp; Manifesto</Link>
        </div>
      </div>

      <div className="footer-bottom" id="disclaimer">
        <span>&copy; 2026 SIGNAL CASPER ACADEMY. ALL RIGHTS RESERVED.</span>
        <span>
          <CircleHelp size={13} /> Trading instrumen derivatif memiliki risiko kerugian modal. Materi disajikan murni untuk edukasi, bukan ajakan transaksi atau nasihat finansial.
        </span>
      </div>
    </footer>
  );
}
