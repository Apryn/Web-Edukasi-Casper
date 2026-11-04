"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Course, Lesson, QuizSubmissionReview, VisualDiagramType } from "@/lib/types";
import {
  toggleLessonComplete,
  calculateCoursePercentage,
  applyServerCourseProgress,
  initializeClassroomCourseProgress,
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
  RotateCcw,
  Sparkles,
  Trophy,
  Video,
  X,
  AlertCircle,
} from "lucide-react";

export function EducationalVisualDiagram({ type }: { type: VisualDiagramType }) {
  switch (type) {
    case "liquidity-orderbook":
      return (
        <div className="chart-study-box">
          <div className="chart-study-header">
            <div>
              <span className="study-tag">DIAGRAM EDUKATIF — MEKANISME LELANG</span>
              <h4>Kedalaman Order Book (Limit Pasif vs Market Agresif)</h4>
            </div>
            <div className="study-badge-row">
              <span className="timeframe-badge">ORDER FLOW</span>
            </div>
          </div>
          <div className="study-svg-wrap">
            <svg className="study-svg" viewBox="0 0 520 175" role="img" aria-label="Diagram Order Book dan Likuiditas">
              <rect x="20" y="20" width="215" height="60" rx="6" fill="rgba(239,68,68,0.12)" stroke="#ef4444" strokeWidth="1.2" />
              <text x="32" y="42" fill="#fca5a5" fontSize="10" fontWeight="bold" fontFamily="monospace">ASK / OFFER (LIMIT SELL PASIF)</text>
              <text x="32" y="58" fill="#e2e8f0" fontSize="9" fontFamily="monospace">2652.00 — 450 Lot Menunggu</text>
              <text x="32" y="71" fill="#e2e8f0" fontSize="9" fontFamily="monospace">2651.50 — 280 Lot Menunggu</text>

              <rect x="20" y="95" width="215" height="60" rx="6" fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth="1.2" />
              <text x="32" y="117" fill="#6ee7b7" fontSize="10" fontWeight="bold" fontFamily="monospace">BID (LIMIT BUY PASIF)</text>
              <text x="32" y="133" fill="#e2e8f0" fontSize="9" fontFamily="monospace">2651.00 — 310 Lot Menunggu</text>
              <text x="32" y="146" fill="#e2e8f0" fontSize="9" fontFamily="monospace">2650.50 — 520 Lot Menunggu</text>

              <line x1="238" y1="87" x2="295" y2="87" stroke="#41d9ef" strokeDasharray="4 3" strokeWidth="1.5" />
              <rect x="295" y="38" width="205" height="98" rx="6" fill="rgba(65,217,239,0.1)" stroke="#41d9ef" strokeWidth="1.2" />
              <text x="308" y="60" fill="#41d9ef" fontSize="10" fontWeight="bold" fontFamily="monospace">EKSEKUSI &amp; PERGESERAN HARGA</text>
              <text x="308" y="79" fill="#e2e8f0" fontSize="9" fontFamily="monospace">1. Spread = Selisih Ask &amp; Bid</text>
              <text x="308" y="96" fill="#e2e8f0" fontSize="9" fontFamily="monospace">2. Market Buy menghabisi Ask</text>
              <text x="308" y="113" fill="#e2e8f0" fontSize="9" fontFamily="monospace">3. Harga naik mencari Ask baru</text>
              <text x="308" y="128" fill="#94a3b8" fontSize="8" fontFamily="monospace">*Slippage terjadi saat likuiditas tipis</text>
            </svg>
          </div>
          <p className="study-desc">
            Ilustrasi konseptual: Limit Order menyediakan likuiditas di buku order, sedangkan Market Order mengonsumsi likuiditas dan menggerakkan harga.
          </p>
        </div>
      );
    case "candlestick-anatomy":
      return (
        <div className="chart-study-box">
          <div className="chart-study-header">
            <div>
              <span className="study-tag">DIAGRAM EDUKATIF — ANATOMI CANDLESTICK</span>
              <h4>Struktur OHLC, Momentum Body, dan Penolakan Sumbu (Wick Rejection)</h4>
            </div>
            <div className="study-badge-row">
              <span className="timeframe-badge">PRICE ACTION</span>
            </div>
          </div>
          <div className="study-svg-wrap">
            <svg className="study-svg" viewBox="0 0 520 175" role="img" aria-label="Anatomi OHLC Candlestick">
              {/* Bullish Impulsive Candle */}
              <line x1="90" y1="25" x2="90" y2="145" stroke="#10b981" strokeWidth="2" />
              <rect x="74" y="42" width="32" height="82" rx="2" fill="#10b981" />
              <text x="115" y="32" fill="#94a3b8" fontSize="9" fontFamily="monospace">High (Titik Tertinggi)</text>
              <text x="115" y="48" fill="#6ee7b7" fontSize="9" fontWeight="bold" fontFamily="monospace">Close (Penutupan Bullish)</text>
              <text x="115" y="86" fill="#e2e8f0" fontSize="9" fontFamily="monospace">Body Tebal = Dominasi Beli</text>
              <text x="115" y="124" fill="#6ee7b7" fontSize="9" fontWeight="bold" fontFamily="monospace">Open (Pembukaan)</text>
              <text x="115" y="145" fill="#94a3b8" fontSize="9" fontFamily="monospace">Low (Titik Terendah)</text>

              {/* Bullish Rejection Pinbar */}
              <line x1="340" y1="35" x2="340" y2="152" stroke="#41d9ef" strokeWidth="2" />
              <rect x="324" y="44" width="32" height="24" rx="2" fill="#41d9ef" />
              <text x="366" y="58" fill="#41d9ef" fontSize="9" fontWeight="bold" fontFamily="monospace">Body Kecil di Atas</text>
              <text x="366" y="108" fill="#e2e8f0" fontSize="9" fontFamily="monospace">Lower Wick Panjang (≥2x Body)</text>
              <text x="366" y="124" fill="#94a3b8" fontSize="8" fontFamily="monospace">= Penolakan Jual &amp; Serapan Beli</text>
              <line x1="295" y1="128" x2="495" y2="128" stroke="#f59e0b" strokeDasharray="4 4" strokeWidth="1.2" />
              <text x="298" y="143" fill="#fcd34d" fontSize="8" fontFamily="monospace">Zona Support / Liquidity Sweep</text>
            </svg>
          </div>
          <p className="study-desc">
            Perbandingan antara candle impulsif (momentum penuh) dan candle penolakan (rejection wick) pada zona likuiditas kunci.
          </p>
        </div>
      );
    case "market-structure-bos-choch":
      return (
        <div className="chart-study-box">
          <div className="chart-study-header">
            <div>
              <span className="study-tag">DIAGRAM EDUKATIF — MARKET STRUCTURE</span>
              <h4>Skema Siklus HH-HL, Break of Structure (BOS), dan Change of Character (CHoCH)</h4>
            </div>
            <div className="study-badge-row">
              <span className="timeframe-badge">STRUCTURE MAP</span>
            </div>
          </div>
          <div className="study-svg-wrap">
            <svg className="study-svg" viewBox="0 0 520 175" role="img" aria-label="Diagram BOS dan CHoCH">
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                points="25,145 85,90 130,120 205,55 255,95 330,28"
              />
              <polyline
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                points="330,28 395,122 435,82 495,150"
              />
              {/* BOS lines */}
              <line x1="85" y1="90" x2="175" y2="90" stroke="#41d9ef" strokeDasharray="3 3" strokeWidth="1.2" />
              <text x="115" y="83" fill="#41d9ef" fontSize="9" fontWeight="bold" fontFamily="monospace">BOS (Bullish)</text>

              <line x1="205" y1="55" x2="305" y2="55" stroke="#41d9ef" strokeDasharray="3 3" strokeWidth="1.2" />
              <text x="235" y="48" fill="#41d9ef" fontSize="9" fontWeight="bold" fontFamily="monospace">BOS (Bullish)</text>

              {/* CHoCH line */}
              <line x1="255" y1="95" x2="405" y2="95" stroke="#f59e0b" strokeDasharray="4 3" strokeWidth="1.5" />
              <text x="285" y="110" fill="#fcd34d" fontSize="9" fontWeight="bold" fontFamily="monospace">CHoCH (Patah HL Valid)</text>

              <text x="75" y="80" fill="#e2e8f0" fontSize="9" fontFamily="monospace">HH1</text>
              <text x="122" y="135" fill="#e2e8f0" fontSize="9" fontFamily="monospace">HL1</text>
              <text x="195" y="45" fill="#e2e8f0" fontSize="9" fontFamily="monospace">HH2</text>
              <text x="245" y="110" fill="#e2e8f0" fontSize="9" fontFamily="monospace">HL2</text>
              <text x="320" y="20" fill="#6ee7b7" fontSize="9" fontWeight="bold" fontFamily="monospace">HH3</text>
              <text x="428" y="74" fill="#fca5a5" fontSize="9" fontWeight="bold" fontFamily="monospace">LH1 (Entry Pullback)</text>
            </svg>
          </div>
          <p className="study-desc">
            BOS mengonfirmasi kelanjutan tren searah, sedangkan CHoCH terjadi ketika Swing HL/LH terakhir yang menghasilkan ekstrem baru ditembus dengan penutupan body candle.
          </p>
        </div>
      );
    case "snr-zones-sbr-rbs":
      return (
        <div className="chart-study-box">
          <div className="chart-study-header">
            <div>
              <span className="study-tag">DIAGRAM EDUKATIF — ZONA REAKSI &amp; FLIP</span>
              <h4>Zona Support/Resistance &amp; Mekanisme Resistance Become Support (RBS)</h4>
            </div>
            <div className="study-badge-row">
              <span className="timeframe-badge">S&amp;R DYNAMICS</span>
            </div>
          </div>
          <div className="study-svg-wrap">
            <svg className="study-svg" viewBox="0 0 520 175" role="img" aria-label="Diagram Zona RBS dan SBR">
              <rect x="25" y="75" width="470" height="24" fill="rgba(65,217,239,0.16)" stroke="#41d9ef" strokeDasharray="4 3" strokeWidth="1.2" />
              <text x="35" y="91" fill="#41d9ef" fontSize="9" fontWeight="bold" fontFamily="monospace">ZONA KONSENTRASI LIKUIDITAS (AREA, BUKAN GARIS TUNGGAL)</text>
              <polyline
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="2.2"
                points="35,145 105,85 155,135 225,82 265,120 335,35 395,84 475,25"
              />
              <circle cx="105" cy="85" r="4" fill="#ef4444" />
              <text x="72" y="68" fill="#fca5a5" fontSize="8" fontFamily="monospace">Rejection 1 (Resistance)</text>
              <circle cx="225" cy="82" r="4" fill="#ef4444" />
              <text x="195" y="68" fill="#fca5a5" fontSize="8" fontFamily="monospace">Rejection 2</text>
              <circle cx="395" cy="84" r="5" fill="#10b981" />
              <text x="355" y="114" fill="#6ee7b7" fontSize="9" fontWeight="bold" fontFamily="monospace">Retest Valid (RBS Flip)</text>
            </svg>
          </div>
          <p className="study-desc">
            Saat zona Resistance ditembus secara impulsif (Breakout), zona tersebut bertransformasi menjadi pijakan permintaan baru (Resistance Become Support / RBS) saat harga melakukan koreksi.
          </p>
        </div>
      );
    case "confluence-workflow":
      return (
        <div className="chart-study-box">
          <div className="chart-study-header">
            <div>
              <span className="study-tag">DIAGRAM EDUKATIF — WORKFLOW SISTEMATIS</span>
              <h4>Alur Kerja 4-Filter Konfluensi Top-Down Sebelum Eksekusi</h4>
            </div>
            <div className="study-badge-row">
              <span className="timeframe-badge">SYSTEM WORKFLOW</span>
            </div>
          </div>
          <div className="study-svg-wrap">
            <svg className="study-svg" viewBox="0 0 520 175" role="img" aria-label="Diagram Alur Kerja Konfluensi">
              <rect x="18" y="45" width="108" height="80" rx="6" fill="rgba(15,23,42,0.9)" stroke="#41d9ef" strokeWidth="1.3" />
              <text x="28" y="68" fill="#41d9ef" fontSize="9" fontWeight="bold" fontFamily="monospace">1. HTF BIAS</text>
              <text x="28" y="86" fill="#e2e8f0" fontSize="8" fontFamily="monospace">D1 / H4 Trend</text>
              <text x="28" y="100" fill="#94a3b8" fontSize="8" fontFamily="monospace">Struktur HH/HL</text>

              <rect x="144" y="45" width="108" height="80" rx="6" fill="rgba(15,23,42,0.9)" stroke="#41d9ef" strokeWidth="1.3" />
              <text x="154" y="68" fill="#41d9ef" fontSize="9" fontWeight="bold" fontFamily="monospace">2. ZONA KUNCI</text>
              <text x="154" y="86" fill="#e2e8f0" fontSize="8" fontFamily="monospace">H1 S&amp;R / Demand</text>
              <text x="154" y="100" fill="#94a3b8" fontSize="8" fontFamily="monospace">Area Diskon/Prem</text>

              <rect x="270" y="45" width="108" height="80" rx="6" fill="rgba(15,23,42,0.9)" stroke="#41d9ef" strokeWidth="1.3" />
              <text x="280" y="68" fill="#41d9ef" fontSize="9" fontWeight="bold" fontFamily="monospace">3. TRIGGER LTF</text>
              <text x="280" y="86" fill="#e2e8f0" fontSize="8" fontFamily="monospace">M15 CHoCH /</text>
              <text x="280" y="100" fill="#94a3b8" fontSize="8" fontFamily="monospace">Rejection Candle</text>

              <rect x="396" y="45" width="108" height="80" rx="6" fill="rgba(16,185,129,0.16)" stroke="#10b981" strokeWidth="1.5" />
              <text x="406" y="68" fill="#6ee7b7" fontSize="9" fontWeight="bold" fontFamily="monospace">4. EKSEKUSI</text>
              <text x="406" y="86" fill="#e2e8f0" fontSize="8" fontFamily="monospace">SL Terukur &amp;</text>
              <text x="406" y="100" fill="#6ee7b7" fontSize="8" fontFamily="monospace">RRR Minimal 1:2</text>
            </svg>
          </div>
          <p className="study-desc">
            Setiap tahapan berfungsi sebagai gerbang penyaring. Jika salah satu syarat tidak terpenuhi, keputusan wajib adalah tidak membuka posisi (No-Trade).
          </p>
        </div>
      );
    case "xauusd-macro-session":
      return (
        <div className="chart-study-box">
          <div className="chart-study-header">
            <div>
              <span className="study-tag">DIAGRAM EDUKATIF — DINAMIKA XAUUSD</span>
              <h4>Matriks Korelasi Makro (DXY &amp; Real Yield) serta Siklus Volatilitas Sesi</h4>
            </div>
            <div className="study-badge-row">
              <span className="timeframe-badge">GOLD SPECIALIST</span>
            </div>
          </div>
          <div className="study-svg-wrap">
            <svg className="study-svg" viewBox="0 0 520 175" role="img" aria-label="Diagram Korelasi Makro XAUUSD">
              <rect x="20" y="25" width="225" height="125" rx="6" fill="rgba(245,158,11,0.1)" stroke="#f59e0b" strokeWidth="1.3" />
              <text x="32" y="47" fill="#fcd34d" fontSize="10" fontWeight="bold" fontFamily="monospace">PENGGERAK FUNDAMENTAL EMAS</text>
              <text x="32" y="68" fill="#e2e8f0" fontSize="9" fontFamily="monospace">• US Real Yield ↑  ➔ Tekanan XAUUSD ↓</text>
              <text x="32" y="86" fill="#e2e8f0" fontSize="9" fontFamily="monospace">• DXY Menguat ↑    ➔ Tekanan XAUUSD ↓</text>
              <text x="32" y="104" fill="#e2e8f0" fontSize="9" fontFamily="monospace">• Geopolitik Krisis➔ Safe Haven XAU ↑</text>
              <text x="32" y="122" fill="#94a3b8" fontSize="8" fontFamily="monospace">Rilis Kritis: CPI, NFP, FOMC Rate</text>

              <rect x="265" y="25" width="235" height="125" rx="6" fill="rgba(65,217,239,0.1)" stroke="#41d9ef" strokeWidth="1.3" />
              <text x="277" y="47" fill="#41d9ef" fontSize="10" fontWeight="bold" fontFamily="monospace">PROFIL SESI HARIAN (WIB)</text>
              <text x="277" y="68" fill="#e2e8f0" fontSize="9" fontFamily="monospace">• Asia (06-13)   : Akumulasi Range</text>
              <text x="277" y="86" fill="#e2e8f0" fontSize="9" fontFamily="monospace">• London (14-18) : Sweep &amp; Ekspansi Awal</text>
              <text x="277" y="104" fill="#6ee7b7" fontSize="9" fontWeight="bold" fontFamily="monospace">• Overlap (19-23): Puncak Likuiditas NY</text>
              <text x="277" y="122" fill="#94a3b8" fontSize="8" fontFamily="monospace">Kontrak: 1.00 Lot = $10 per $1.00 gerak</text>
            </svg>
          </div>
          <p className="study-desc">
            Kombinasi pembacaan imbal hasil riil AS (US Real Yields), indeks DXY, dan pemilihan jam eksekusi pada overlap London–New York.
          </p>
        </div>
      );
    case "position-sizing-rrr":
      return (
        <div className="chart-study-box">
          <div className="chart-study-header">
            <div>
              <span className="study-tag">DIAGRAM EDUKATIF — MATEMATIKA RISIKO</span>
              <h4>Kalkulasi Position Sizing &amp; Asimetri Risk-to-Reward (RRR 1:2)</h4>
            </div>
            <div className="study-badge-row">
              <span className="timeframe-badge">RISK ENGINE</span>
            </div>
          </div>
          <div className="study-svg-wrap">
            <svg className="study-svg" viewBox="0 0 520 175" role="img" aria-label="Diagram Position Sizing dan Risk Reward">
              <rect x="20" y="25" width="235" height="125" rx="6" fill="rgba(15,23,42,0.9)" stroke="#41d9ef" strokeWidth="1.3" />
              <text x="32" y="47" fill="#41d9ef" fontSize="10" fontWeight="bold" fontFamily="monospace">RUMUS BAKU LOT SIZING</text>
              <text x="32" y="70" fill="#e2e8f0" fontSize="9" fontFamily="monospace">Risiko ($) = Modal × %Risiko</text>
              <text x="32" y="90" fill="#6ee7b7" fontSize="9" fontWeight="bold" fontFamily="monospace">Lot = Risiko ($) / (SL Pips × Nilai/Pip)</text>
              <text x="32" y="114" fill="#94a3b8" fontSize="8" fontFamily="monospace">Contoh: Modal $5,000 | Risiko 1% ($50)</text>
              <text x="32" y="128" fill="#94a3b8" fontSize="8" fontFamily="monospace">SL 25 Pips ($10/pip) ➔ Lot = 50 / 250 = 0.20</text>

              <rect x="275" y="25" width="225" height="80" rx="6" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="1.3" />
              <text x="288" y="55" fill="#6ee7b7" fontSize="10" fontWeight="bold" fontFamily="monospace">TARGET TAKE PROFIT (+2R = +$100)</text>
              <text x="288" y="75" fill="#e2e8f0" fontSize="8" fontFamily="monospace">Jarak 50 Pips (2× Jarak Stop Loss)</text>

              <rect x="275" y="108" width="225" height="42" rx="6" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.3" />
              <text x="288" y="132" fill="#fca5a5" fontSize="10" fontWeight="bold" fontFamily="monospace">BATAS STOP LOSS (-1R = -$50)</text>
            </svg>
          </div>
          <p className="study-desc">
            Dengan RRR 1:2, win rate 40% (4 menang × +2R = +8R dikurangi 6 kalah × -1R = -6R) tetap menghasilkan ekspektasi bersih positif (+2R per 10 transaksi).
          </p>
        </div>
      );
    case "psychology-cycle":
      return (
        <div className="chart-study-box">
          <div className="chart-study-header">
            <div>
              <span className="study-tag">DIAGRAM EDUKATIF — REGULASI EMOSI</span>
              <h4>Siklus Spiral Emosi (Tilt) vs Protokol Intervensi Disiplin</h4>
            </div>
            <div className="study-badge-row">
              <span className="timeframe-badge">MINDSET PROTOCOL</span>
            </div>
          </div>
          <div className="study-svg-wrap">
            <svg className="study-svg" viewBox="0 0 520 175" role="img" aria-label="Diagram Siklus Psikologi Trading">
              <rect x="20" y="25" width="225" height="125" rx="6" fill="rgba(239,68,68,0.12)" stroke="#ef4444" strokeWidth="1.3" />
              <text x="32" y="47" fill="#fca5a5" fontSize="10" fontWeight="bold" fontFamily="monospace">SIKLUS DESTRUKTIF (TANPA ATURAN)</text>
              <text x="32" y="68" fill="#e2e8f0" fontSize="9" fontFamily="monospace">1. Impuls FOMO / Mengejar Candle</text>
              <text x="32" y="86" fill="#e2e8f0" fontSize="9" fontFamily="monospace">2. Floating Loss &amp; Geser Stop Loss</text>
              <text x="32" y="104" fill="#e2e8f0" fontSize="9" fontFamily="monospace">3. Loss Besar ➔ Emosi Balas Dendam</text>
              <text x="32" y="122" fill="#fca5a5" fontSize="9" fontWeight="bold" fontFamily="monospace">4. Overlot &amp; Drawdown Parah</text>

              <rect x="265" y="25" width="235" height="125" rx="6" fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth="1.3" />
              <text x="277" y="47" fill="#6ee7b7" fontSize="10" fontWeight="bold" fontFamily="monospace">PROTOKOL DISIPLIN PROFESIONAL</text>
              <text x="277" y="68" fill="#e2e8f0" fontSize="9" fontFamily="monospace">1. Audit Checklist Pra-Transaksi</text>
              <text x="277" y="86" fill="#e2e8f0" fontSize="9" fontFamily="monospace">2. Terima Risiko -1R Sebelum Entry</text>
              <text x="277" y="104" fill="#e2e8f0" fontSize="9" fontFamily="monospace">3. Circuit Breaker (Stop saat -2R/hari)</text>
              <text x="277" y="122" fill="#6ee7b7" fontSize="9" fontWeight="bold" fontFamily="monospace">4. Evaluasi Jurnal Secara Objektif</text>
            </svg>
          </div>
          <p className="study-desc">
            Memutus rantai FOMO dan Revenge Trading dengan aturan berhenti otomatis (Daily Loss Circuit Breaker) serta berpikir dalam kerangka sampel 20–50 transaksi.
          </p>
        </div>
      );
    case "journal-expectancy":
      return (
        <div className="chart-study-box">
          <div className="chart-study-header">
            <div>
              <span className="study-tag">DIAGRAM EDUKATIF — AUDIT PERFORMA</span>
              <h4>Matriks Evaluasi Kepatuhan Proses &amp; Rumus Expectancy</h4>
            </div>
            <div className="study-badge-row">
              <span className="timeframe-badge">JOURNAL ANALYTICS</span>
            </div>
          </div>
          <div className="study-svg-wrap">
            <svg className="study-svg" viewBox="0 0 520 175" role="img" aria-label="Diagram Jurnal dan Expectancy">
              <rect x="20" y="22" width="230" height="62" rx="5" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="1.2" />
              <text x="30" y="42" fill="#6ee7b7" fontSize="9" fontWeight="bold" fontFamily="monospace">PATUH SOP + HASIL PROFIT</text>
              <text x="30" y="58" fill="#e2e8f0" fontSize="8" fontFamily="monospace">Good Win: Pertahankan &amp; Replikasi</text>

              <rect x="265" y="22" width="235" height="62" rx="5" fill="rgba(65,217,239,0.15)" stroke="#41d9ef" strokeWidth="1.2" />
              <text x="275" y="42" fill="#41d9ef" fontSize="9" fontWeight="bold" fontFamily="monospace">PATUH SOP + HASIL STOP LOSS</text>
              <text x="275" y="58" fill="#e2e8f0" fontSize="8" fontFamily="monospace">Good Loss: Biaya Bisnis Wajar (-1R)</text>

              <rect x="20" y="94" width="230" height="62" rx="5" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" strokeWidth="1.2" />
              <text x="30" y="114" fill="#fcd34d" fontSize="9" fontWeight="bold" fontFamily="monospace">LANGGAR SOP + HASIL PROFIT</text>
              <text x="30" y="130" fill="#e2e8f0" fontSize="8" fontFamily="monospace">Bad Win: Ilusi Berbahaya (Wajib Koreksi)</text>

              <rect x="265" y="94" width="235" height="62" rx="5" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.2" />
              <text x="275" y="114" fill="#fca5a5" fontSize="9" fontWeight="bold" fontFamily="monospace">LANGGAR SOP + HASIL LOSS</text>
              <text x="275" y="130" fill="#e2e8f0" fontSize="8" fontFamily="monospace">Bad Loss: Sumber Kebocoran Modal Utama</text>
            </svg>
          </div>
          <p className="study-desc">
            Jurnal profesional memisahkan kualitas eksekusi proses dari hasil satu transaksi acak, serta mengukur Expectancy = (Win% × Avg Win) − (Loss% × Avg Loss).
          </p>
        </div>
      );
  }
}

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
  const [progressLoadError, setProgressLoadError] = useState<string | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Server-side Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizEvaluation, setQuizEvaluation] = useState<QuizEvalState | null>(null);

  const loadClassroomProgress = useCallback(async () => {
    setIsLoadingProgress(true);
    setProgressLoadError(null);
    const result = await initializeClassroomCourseProgress(
      course.slug,
      allLessons[0]?.lesson.id
    );
    setCompletedIds(result.completedLessonIds);
    if (result.status === "error" && result.error) {
      setProgressLoadError(result.error);
    }
    setIsLoadingProgress(false);
  }, [course.slug, allLessons]);

  useEffect(() => {
    let active = true;

    async function initClassroomProgress() {
      setIsLoadingProgress(true);
      setProgressLoadError(null);
      const result = await initializeClassroomCourseProgress(
        course.slug,
        allLessons[0]?.lesson.id
      );
      if (!active) return;
      setCompletedIds(result.completedLessonIds);
      if (result.status === "error" && result.error) {
        setProgressLoadError(result.error);
      }
      setIsLoadingProgress(false);
    }

    initClassroomProgress();

    // If param changes, update current lesson
    if (lessonIdFromParam && allLessons.some((item) => item.lesson.id === lessonIdFromParam)) {
      setCurrentLessonId(lessonIdFromParam);
    }

    return () => {
      active = false;
    };
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
  const actualLessonCount = allLessons.length;
  const validCompletedCount = completedIds.filter((id) =>
    allLessons.some((item) => item.lesson.id === id)
  ).length;
  const progressPercent = calculateCoursePercentage(actualLessonCount, validCompletedCount);
  const isCourseFullyCompleted =
    actualLessonCount > 0 && validCompletedCount >= actualLessonCount && progressPercent === 100;

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

      // Sync localStorage & React state with server updatedProgress
      if (data.updatedProgress) {
        const synced = applyServerCourseProgress(
          course.slug,
          data.updatedProgress,
          currentLesson.id
        );
        setCompletedIds(synced.completedLessonIds);
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
            {progressLoadError && (
              <div className="auth-error-alert" role="alert" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <AlertCircle size={16} />
                  <span>{progressLoadError}</span>
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  style={{ padding: "6px 12px", fontSize: "11px" }}
                  onClick={loadClassroomProgress}
                  disabled={isLoadingProgress}
                >
                  <RotateCcw size={13} /> {isLoadingProgress ? "Memuat..." : "Coba Lagi"}
                </button>
              </div>
            )}

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

            {/* Learning Objectives if available */}
            {currentLesson?.learningObjectives && currentLesson.learningObjectives.length > 0 && (
              <div className="takeaways-box" style={{ marginBottom: "24px", borderColor: "rgba(65,217,239,0.3)" }}>
                <div className="takeaways-header">
                  <CheckCircle2 size={17} />
                  <strong>TUJUAN PEMBELAJARAN MATERI INI</strong>
                </div>
                <ul>
                  {currentLesson.learningObjectives.map((obj, idx) => (
                    <li key={idx}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reading Content (Deep Conceptual Explanation & Structured Blocks) */}
            <div className="lesson-article">
              {currentLesson?.contentBlocks && currentLesson.contentBlocks.length > 0 ? (
                currentLesson.contentBlocks.map((block, bIdx) => {
                  if (block.type === "heading") {
                    return block.level === 3 ? (
                      <h3
                        key={block.id || bIdx}
                        style={{
                          fontSize: "18px",
                          fontWeight: 700,
                          color: "#f8fafc",
                          marginTop: "22px",
                          marginBottom: "10px",
                        }}
                      >
                        {block.text}
                      </h3>
                    ) : (
                      <h2
                        key={block.id || bIdx}
                        style={{
                          fontSize: "21px",
                          fontWeight: 700,
                          color: "var(--cyan)",
                          marginTop: "26px",
                          marginBottom: "12px",
                        }}
                      >
                        {block.text}
                      </h2>
                    );
                  }
                  if (block.type === "list") {
                    const ListTag = block.style === "ordered" ? "ol" : "ul";
                    return (
                      <ListTag
                        key={block.id || bIdx}
                        style={{
                          paddingLeft: "22px",
                          marginBottom: "18px",
                          display: "grid",
                          gap: "8px",
                          lineHeight: 1.7,
                        }}
                      >
                        {(block.items || []).map((item, iIdx) => (
                          <li key={iIdx}>{item}</li>
                        ))}
                      </ListTag>
                    );
                  }
                  if (block.type === "callout") {
                    const variantColors = {
                      info: {
                        border: "rgba(65, 217, 239, 0.4)",
                        bg: "rgba(65, 217, 239, 0.08)",
                        title: "#41d9ef",
                      },
                      tip: {
                        border: "rgba(108, 224, 176, 0.4)",
                        bg: "rgba(108, 224, 176, 0.08)",
                        title: "#6ce0b0",
                      },
                      warning: {
                        border: "rgba(251, 191, 36, 0.45)",
                        bg: "rgba(251, 191, 36, 0.08)",
                        title: "#fbbf24",
                      },
                    };
                    const vc = variantColors[block.variant || "info"];
                    return (
                      <div
                        key={block.id || bIdx}
                        style={{
                          borderLeft: `3px solid ${vc.border}`,
                          background: vc.bg,
                          padding: "14px 18px",
                          borderRadius: "4px",
                          marginBottom: "18px",
                        }}
                      >
                        {block.caption && (
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: vc.title,
                              marginBottom: "6px",
                            }}
                          >
                            {block.caption}
                          </div>
                        )}
                        <p style={{ margin: 0 }}>{block.text}</p>
                      </div>
                    );
                  }
                  if (block.type === "image" && block.imageUrl) {
                    return (
                      <figure
                        key={block.id || bIdx}
                        style={{
                          margin: "20px 0",
                          background: "#0b1118",
                          border: "1px solid #1c2734",
                          borderRadius: "6px",
                          padding: "12px",
                          textAlign: "center",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={block.imageUrl}
                          alt={block.imageAlt || block.caption || "Ilustrasi materi"}
                          style={{
                            maxWidth: "100%",
                            height: "auto",
                            borderRadius: "4px",
                            display: "block",
                            margin: "0 auto",
                          }}
                        />
                        {block.caption && (
                          <figcaption
                            style={{
                              marginTop: "8px",
                              fontSize: "12px",
                              color: "#94a3b8",
                            }}
                          >
                            {block.caption}
                          </figcaption>
                        )}
                      </figure>
                    );
                  }
                  return <p key={block.id || bIdx}>{block.text}</p>;
                })
              ) : (
                currentLesson?.content.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))
              )}
            </div>

            {/* Educational Schematic Visual Diagram if available */}
            {currentLesson?.visualDiagram && (
              <EducationalVisualDiagram type={currentLesson.visualDiagram} />
            )}

            {/* Application Example & Structured Case Study */}
            {(currentLesson?.applicationExample || currentLesson?.caseStudy) && (
              <div className="takeaways-box" style={{ marginTop: "24px", marginBottom: "24px" }}>
                {currentLesson.applicationExample && (
                  <div style={{ marginBottom: currentLesson.caseStudy ? "18px" : "0" }}>
                    <div className="takeaways-header" style={{ marginBottom: "8px" }}>
                      <Sparkles size={16} />
                      <strong>CONTOH PENERAPAN PRAKTIS</strong>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.7, color: "var(--muted-strong, #cbd5e1)" }}>
                      {currentLesson.applicationExample}
                    </p>
                  </div>
                )}
                {currentLesson.caseStudy && (
                  <div>
                    <div className="takeaways-header" style={{ marginBottom: "8px" }}>
                      <Award size={16} />
                      <strong>STUDI KASUS ANALISIS PASAR</strong>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.7, color: "var(--muted-strong, #cbd5e1)" }}>
                      {currentLesson.caseStudy}
                    </p>
                  </div>
                )}
              </div>
            )}

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

            {/* Practical Steps if available */}
            {currentLesson?.practicalSteps && currentLesson.practicalSteps.length > 0 && (
              <div className="takeaways-box" style={{ marginTop: "20px" }}>
                <div className="takeaways-header">
                  <Check size={17} />
                  <strong>LANGKAH PRAKTIK TERUKUR</strong>
                </div>
                <ol style={{ paddingLeft: "20px", margin: 0, display: "grid", gap: "8px" }}>
                  {currentLesson.practicalSteps.map((step, idx) => (
                    <li key={idx} style={{ lineHeight: 1.65 }}>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Common Mistakes if available */}
            {currentLesson?.commonMistakes && currentLesson.commonMistakes.length > 0 && (
              <div
                className="takeaways-box"
                style={{
                  marginTop: "20px",
                  borderColor: "rgba(239,68,68,0.35)",
                  background: "rgba(127,29,29,0.12)",
                }}
              >
                <div className="takeaways-header" style={{ color: "#fca5a5" }}>
                  <AlertCircle size={17} />
                  <strong>KESALAHAN UMUM YANG WAJIB DIHINDARI</strong>
                </div>
                <ul>
                  {currentLesson.commonMistakes.map((mistake, idx) => (
                    <li key={idx}>{mistake}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Takeaways / Lesson Summary */}
            {currentLesson?.keyTakeaways && (
              <div className="takeaways-box" style={{ marginTop: "20px" }}>
                <div className="takeaways-header">
                  <Sparkles size={17} />
                  <strong>RINGKASAN &amp; POIN KUNCI MATERI</strong>
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
                    <h3>
                      {currentLesson.type !== "quiz"
                        ? "Kuis Latihan Pemahaman Materi"
                        : currentItem && currentItem.moduleIndex >= course.modules.length - 1
                          ? "Final Assessment Kelulusan Kelas"
                          : "Evaluasi Modul"}
                    </h3>
                    <p>
                      {currentLesson.type !== "quiz"
                        ? "Latihan mandiri untuk menguji pemahaman materi ini. Jawaban dinilai di server dan hasil latihan tidak membatalkan status selesai materi Anda."
                        : currentItem && currentItem.moduleIndex >= course.modules.length - 1
                          ? "Pilih jawaban untuk setiap pertanyaan. Final assessment kelulusan kelas dinilai secara langsung di server dengan batas kelulusan 70%."
                          : "Pilih jawaban untuk setiap pertanyaan. Evaluasi modul dinilai secara langsung di server dengan batas kelulusan 70%."}
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
                            <CheckCircle2 size={18} />{" "}
                            {currentLesson.type !== "quiz"
                              ? "Jawaban Latihan Tepat!"
                              : "Selamat, Anda Lulus Evaluasi!"}
                          </>
                        ) : (
                          <>
                            <AlertCircle size={18} />{" "}
                            {currentLesson.type !== "quiz"
                              ? "Latihan Pemahaman Perlu Ditinjau Kembali"
                              : "Belum Memenuhi Kriteria Kelulusan"}
                          </>
                        )}
                      </div>
                      <small style={{ display: "block", marginTop: "4px" }}>
                        {currentLesson.type !== "quiz" ? (
                          quizEvaluation.passed ? (
                            "Skor latihan Anda tercatat di server dan status selesai materi tetap terjaga."
                          ) : (
                            "Status selesai materi bacaan Anda tetap aman. Silakan tinjau pembahasan di bawah atau ulangi latihan."
                          )
                        ) : (
                          <>
                            Batas kelulusan minimum: {quizEvaluation.passingScore}%.{" "}
                            {quizEvaluation.passed
                              ? "Progres evaluasi otomatis tercatat selesai."
                              : "Silakan pelajari kembali materi di atas dan ulangi evaluasi."}
                          </>
                        )}
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

            {/* Course Summary & References on last lesson or when course completed */}
            {(!nextLesson || isCourseFullyCompleted) &&
              (course.courseSummary?.length || course.references?.length) && (
                <div className="takeaways-box" style={{ marginTop: "24px", marginBottom: "24px" }}>
                  {course.courseSummary && course.courseSummary.length > 0 && (
                    <div style={{ marginBottom: course.references?.length ? "18px" : "0" }}>
                      <div className="takeaways-header">
                        <Award size={17} />
                        <strong>RINGKASAN KOMPREHENSIF KELAS ({course.number})</strong>
                      </div>
                      <ul>
                        {course.courseSummary.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {course.references && course.references.length > 0 && (
                    <div>
                      <div className="takeaways-header">
                        <LayoutList size={17} />
                        <strong>REFERENSI &amp; LITERATUR BELAJAR</strong>
                      </div>
                      <ul>
                        {course.references.map((ref, idx) => (
                          <li key={idx}>{ref}</li>
                        ))}
                      </ul>
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
