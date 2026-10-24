import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Compass,
  Layers3,
  LineChart,
  MoveUpRight,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const deskCandles: [number, number, number, number, boolean][] = [
  [25, 140, 30, 20, false],
  [50, 150, 25, 18, false],
  [75, 135, 35, 25, true],
  [100, 120, 28, 22, true],
  [125, 105, 32, 20, true],
  [150, 115, 22, 24, false],
  [175, 128, 28, 26, false],
  [200, 145, 15, 45, true],
  [225, 130, 30, 22, true],
  [250, 110, 35, 25, true],
  [275, 95, 30, 20, true],
  [300, 75, 38, 24, true],
  [325, 88, 25, 22, false],
  [350, 95, 28, 20, false],
  [375, 78, 35, 25, true],
  [400, 60, 35, 20, true],
  [425, 48, 30, 18, true],
  [450, 55, 24, 22, false],
  [475, 42, 32, 19, true],
  [500, 30, 28, 16, true],
];

export default function AnalisaPage() {
  return (
    <main>
      <Navbar />

      {/* Header */}
      <section className="analisa-hero wrap">
        <div className="eyebrow">
          <span className="eyebrow-line" /> MARKET DESK
          <span className="eyebrow-muted">ANALISIS TEKNIKAL &amp; SKENARIO STRUKTUR</span>
        </div>
        <h1>
          Gold (XAUUSD) in Context.<br />
          <em>Bukan Ramalan. Ini Skenario Probabilitas.</em>
        </h1>
        <p className="hero-description">
          Memetakan bias dominan, area likuiditas penting, kondisi konfirmasi, dan level pembatalan (invalidation) sebelum menyusun rencana eksekusi.
        </p>
      </section>

      {/* Main Analysis Grid */}
      <section className="analisa-desk wrap">
        {/* Left: Chart & Structure */}
        <div className="desk-chart-card">
          <div className="desk-chart-topline">
            <div>
              <span className="inst-badge">XAU / USD · GOLD</span>
              <h3>Higher Timeframe Bias: Bullish Continuation</h3>
            </div>
            <div className="bias-indicator bullish">
              <TrendingUp size={16} /> BIAS: BULLISH
            </div>
          </div>

          {/* Detailed SVG Candlestick Chart */}
          <div className="desk-svg-container">
            <svg
              className="chart-svg desk-chart-svg"
              viewBox="0 0 520 220"
              role="img"
              aria-label="Chart Analisis Struktur XAUUSD"
            >
              {[30, 75, 120, 165, 205].map((y) => (
                <line key={y} x1="0" y1={y} x2="520" y2={y} className="chart-grid" />
              ))}
              {deskCandles.map(([x, y, h, wick, up], i) => (
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

              {/* Resistance Zone */}
              <rect x="0" y="25" width="520" height="18" fill="#41d9ef" opacity="0.08" />
              <line x1="0" y1="35" x2="520" y2="35" stroke="#41d9ef" strokeDasharray="3 3" />
              <text x="15" y="30" fill="#41d9ef" fontSize="9" fontFamily="monospace">
                TARGET SUPPLY / EXPANSION HIGH (2,760.00)
              </text>

              {/* Support Rejection Zone */}
              <rect x="0" y="135" width="520" height="22" fill="#53d9bf" opacity="0.08" />
              <line x1="0" y1="145" x2="520" y2="145" stroke="#53d9bf" strokeDasharray="3 3" />
              <text x="15" y="152" fill="#53d9bf" fontSize="9" fontFamily="monospace">
                DEMAND REACTION ZONE / HIGHER LOW (2,680.00)
              </text>
            </svg>
          </div>

          <div className="desk-chart-meta-bar">
            <span>TIMEFRAME: H4 / D1</span>
            <span>STRUKTUR: HIGHER HIGH - HIGHER LOW</span>
            <span>DATA: CONCEPTUAL CASE STUDY</span>
          </div>
        </div>

        {/* Right: Skenario & Framework */}
        <div className="desk-framework-card">
          <div className="framework-box-header">
            <span>ANALYSIS FRAMEWORK</span>
            <small>EDISI KAJIAN MINGGUAN</small>
          </div>

          <div className="scenario-item primary">
            <div className="sc-header">
              <span className="sc-badge primary">SKENARIO A (PRIMARY)</span>
              <strong>Pullback &amp; Bullish Continuation</strong>
            </div>
            <p>
              Selama harga mampu mempertahankan demand zone 2,680.00 – 2,695.00 pada penutupan candle H4, bias utama tetap mencari konfirmasi rejection untuk menguji kembali area 2,740.00 – 2,760.00.
            </p>
          </div>

          <div className="scenario-item secondary">
            <div className="sc-header">
              <span className="sc-badge danger">SKENARIO B (INVALIDASI)</span>
              <strong>Break of Structure ke Bawah</strong>
            </div>
            <p>
              Jika candle H4 ditutup mantap (full body) di bawah level 2,670.00, skenario bullish dibatalkan (invalidated). Waspadai pergeseran tren ke fase koreksi lebih dalam menuju 2,630.00.
            </p>
          </div>

          <div className="key-levels-table">
            <div className="table-header">
              <span>LEVEL</span>
              <span>AREA HARGA</span>
              <span>SIGNIFIKANSI</span>
            </div>
            <div className="table-row">
              <span className="tag-level resistance">Resistance</span>
              <strong>2,750.00 – 2,760.00</strong>
              <small>Area pasokan likuiditas utama</small>
            </div>
            <div className="table-row">
              <span className="tag-level support">Demand Zone</span>
              <strong>2,680.00 – 2,695.00</strong>
              <small>Area pengujian Higher Low</small>
            </div>
            <div className="table-row">
              <span className="tag-level invalidation">Invalidasi</span>
              <strong>&lt; 2,670.00</strong>
              <small>Level pembatalan ide bullish</small>
            </div>
          </div>

          <div className="desk-disclaimer-box">
            <ShieldAlert size={16} />
            <span>
              Catatan: Analisa ini bertujuan melatih cara berpikir skenario terstruktur. Jangan pernah mengambil posisi tanpa batas risiko terukur (stop loss).
            </span>
          </div>
        </div>
      </section>

      {/* Academy Callout */}
      <section className="analisa-cta-section wrap">
        <div className="analisa-cta-card">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" /> INGIN BISA MEMETAKAN SENDIRI?
            </div>
            <h2>Pelajari Kelas Spesialisasi XAUUSD di Academy</h2>
            <p>
              Pahami korelasi dollar, jam volatilitas, dan cara membaca jejak likuiditas institusional di pasar emas secara mandiri.
            </p>
          </div>
          <Link href="/belajar/xauusd-market-analysis" className="button button-primary">
            Buka Kelas XAUUSD <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
