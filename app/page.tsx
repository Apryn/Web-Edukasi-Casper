import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { coursesData } from "@/lib/courses-data";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  GraduationCap,
  Layers3,
  MoveUpRight,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

const candles: [number, number, number, number, boolean][] = [
  [14, 61, 22, 42, true], [28, 49, 31, 28, true], [42, 40, 26, 44, false],
  [56, 47, 35, 30, true], [70, 35, 30, 26, true], [84, 43, 28, 35, false],
  [98, 32, 31, 25, true], [112, 25, 27, 33, true], [126, 33, 24, 28, false],
  [140, 24, 29, 20, true], [154, 18, 27, 23, true], [168, 27, 24, 30, false],
  [182, 31, 31, 24, true], [196, 25, 23, 29, false], [210, 19, 31, 21, true],
  [224, 23, 27, 19, true], [238, 18, 24, 24, false], [252, 16, 31, 19, true],
  [266, 20, 26, 18, true], [280, 13, 30, 20, false], [294, 11, 27, 15, true],
];

function MarketChart() {
  return (
    <svg className="chart-svg" viewBox="0 0 320 145" role="img" aria-label="Ilustrasi candlestick market, bukan data real-time">
      {[20, 48, 76, 104, 132].map((y) => (
        <line key={y} x1="0" y1={y} x2="320" y2={y} className="chart-grid" />
      ))}
      {candles.map(([x, y, h, wick, up], i) => (
        <g key={i}>
          <line x1={x} y1={Math.max(5, Number(y) - 8)} x2={x} y2={Number(y) + Number(wick)} className={up ? "wick up" : "wick down"} />
          <rect x={Number(x) - 3} y={y} width="6" height={h} rx="1" className={up ? "candle up" : "candle down"} />
        </g>
      ))}
      <path d="M0 111 C40 104 55 91 82 91 S121 64 148 73 S187 56 210 62 S260 31 320 27" className="chart-line" />
      <circle cx="320" cy="27" r="3.5" className="chart-dot" />
    </svg>
  );
}

export default function Home() {
  const featuredCourses = coursesData.slice(0, 3);

  return (
    <main>
      <Navbar />

      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> MARKET NOTES &amp; ACADEMY <span className="eyebrow-muted">VOL. 01 — THE PROCESS</span></div>
          <h1>Read the market.<br /><em>Not the noise.</em></h1>
          <p className="hero-description">
            Platform edukasi trading terstruktur dan analisa market independen. Bangun proses berpikir, pahami likuiditas institusi, dan latih disiplin eksekusi tanpa ilusi profit kilat.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/belajar">Mulai Belajar di Academy <ArrowRight size={16} /></Link>
            <Link className="text-link" href="/analisa">Lihat Analisa Market <ArrowUpRight size={15} /></Link>
          </div>
          <div className="hero-footnote"><ShieldCheck size={15} /> Edukasi berbasis proses teruji. Bukan sinyal instan.</div>
        </div>

        <div className="hero-visual">
          <div className="visual-topline"><span>FIG. 01 / PRICE IN MOTION</span><span>XAUUSD · CONCEPT</span></div>
          <div className="chart-frame">
            <div className="chart-meta"><div><span className="meta-label">INSTRUMENT</span><strong>Gold <small>/ US Dollar</small></strong></div><div className="chart-timeframe">H4 <ChevronRight size={13} /> D1</div></div>
            <MarketChart />
            <div className="chart-axis"><span>MARKET STRUCTURE</span><span>ILLUSTRATIVE VISUAL</span></div>
          </div>
          <div className="visual-caption"><span className="caption-mark">↗</span><span>Observe the structure.<br /><b>Respect the uncertainty.</b></span><span className="caption-index">01—03</span></div>
          <div className="hero-watermark">SC</div>
        </div>
      </section>

      <div className="ticker" aria-label="Prinsip Signal Casper">
        <div className="ticker-inner">
          {["CONTEXT BEFORE ENTRY", "PROCESS OVER PREDICTION", "RISK BEFORE REWARD", "DISCIPLINE IS A PRACTICE"].map((item) => (
            <span key={item}>{item}<i>✳</i></span>
          ))}
        </div>
      </div>

      {/* Academy Feature Section */}
      <section className="learning-section" id="belajar">
        <div className="wrap">
          <div className="section-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> 01 / SIGNAL CASPER ACADEMY</div>
              <h2>Kelas Trading Terstruktur.</h2>
            </div>
            <Link className="text-link section-more" href="/belajar">Jelajahi Semua 9 Kelas <ArrowRight size={15} /></Link>
          </div>

          <div className="article-grid">
            {featuredCourses.map((course) => (
              <article className="article-card" key={course.id}>
                <div className="article-top"><span>{course.number} / ACADEMY</span><span className="article-icon"><GraduationCap size={17} /></span></div>
                <div className="article-category">{course.category.toUpperCase()}</div>
                <h3>{course.title}</h3>
                <p>{course.overview}</p>
                <div className="article-bottom">
                  <span><Clock3 size={13} /> {course.duration} · {course.totalLessons} Pelajaran</span>
                  <Link href={`/belajar/${course.slug}`} aria-label={`Pelajari ${course.title}`}><ArrowUpRight size={17} /></Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Market Desk Feature */}
      <section className="section wrap" id="analisa">
        <div className="section-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> 02 / MARKET DESK</div><h2>See the bigger picture.</h2></div>
          <p className="section-intro">Analisa bukan ramalan. Ini adalah cara menyusun skenario, mengenali level penting, dan memahami apa yang bisa membatalkan sebuah ide.</p>
        </div>
        <div className="market-feature">
          <div className="market-feature-main">
            <div className="feature-kicker"><span className="feature-number">DESK—01</span><span className="tag">MARKET OUTLOOK</span><span className="feature-date">XAUUSD</span></div>
            <div className="feature-title-row"><div><div className="instrument-label">INSTRUMENT / XAUUSD</div><h3>Gold, in context.</h3></div><div className="feature-symbol"><ChartNoAxesCombined size={25} /></div></div>
            <p>Analisis struktur harga emas, area reaksi supply/demand, dan skenario konfirmasi sebelum mengambil keputusan entri.</p>
            <Link href="/analisa" className="feature-link">Buka Analisa Lengkap <ArrowUpRight size={16} /></Link>
          </div>
          <div className="market-feature-side">
            <div className="side-heading"><span>ANALYSIS FRAMEWORK</span><span>01—04</span></div>
            <div className="framework-row"><span className="framework-num">01</span><div><b>Market bias</b><small>Konteks dan struktur dominan</small></div><Compass size={17} /></div>
            <div className="framework-row"><span className="framework-num">02</span><div><b>Key levels</b><small>Area reaksi yang perlu diamati</small></div><Layers3 size={17} /></div>
            <div className="framework-row"><span className="framework-num">03</span><div><b>Scenario planning</b><small>Kondisi konfirmasi dan invalidasi</small></div><MoveUpRight size={17} /></div>
            <div className="framework-row"><span className="framework-num">04</span><div><b>Risk awareness</b><small>Risiko sebelum peluang</small></div><ShieldCheck size={17} /></div>
            <div className="side-disclaimer">Pemetaan probabilitas teknikal terstruktur. Edukasi proses.</div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="tools-section wrap" id="tools">
        <div className="tools-intro">
          <div className="eyebrow"><span className="eyebrow-line" /> 03 / TRADER WORKBENCH</div>
          <h2>Less guessing.<br /><em>More process.</em></h2>
          <p>Perangkat sederhana untuk membantu menyusun rencana, mencatat keputusan, dan mengevaluasi proses trading.</p>
          <Link className="text-link" href="/dashboard">Buka Student Dashboard <ArrowRight size={15} /></Link>
        </div>
        <div className="tools-list">
          <div className="tool-row"><div className="tool-icon"><Wrench size={19} /></div><div><span>TOOL / 001</span><h3>Risk calculator</h3><p>Hitung lot size proporsional dari batas toleransi kerugian nominal.</p></div><span className="tool-status">PLANNED</span><ArrowUpRight className="tool-arrow" size={17} /></div>
          <div className="tool-row"><div className="tool-icon"><Layers3 size={19} /></div><div><span>TOOL / 002</span><h3>Trading journal</h3><p>Catat alasan, proses, dan evaluasi transaksi berkala.</p></div><span className="tool-status">PLANNED</span><ArrowUpRight className="tool-arrow" size={17} /></div>
          <div className="tool-row"><div className="tool-icon"><ChartNoAxesCombined size={19} /></div><div><span>TOOL / 003</span><h3>Performance review</h3><p>Pelajari pola dari catatan trading sendiri.</p></div><span className="tool-status">PLANNED</span><ArrowUpRight className="tool-arrow" size={17} /></div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="manifesto" id="tentang">
        <div className="wrap manifesto-inner">
          <div className="manifesto-mark"><Image src="/signal-casper.png" alt="" width={90} height={105} /></div>
          <div className="manifesto-copy"><div className="eyebrow"><span className="eyebrow-line" /> OUR POINT OF VIEW</div><h2>Market will do<br />what it does.</h2><p>Tugas kita bukan mengendalikan market. Tugas kita adalah menyiapkan proses yang masuk akal, memahami risiko, dan tetap disiplin ketika keadaan berubah.</p></div>
          <div className="manifesto-note"><Sparkles size={18} /><span>Clarity is a competitive advantage.</span><small>SIGNAL CASPER / PRINCIPLE 001</small></div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
