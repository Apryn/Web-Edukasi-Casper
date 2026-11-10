# SIGNAL CASPER ACADEMY — SPRINT 5
# UI/UX & INTERACTION SPECIFICATION

**Title:** Practical Drill & Pre-Session Checklist User Experience  
**Sprint:** Sprint 5  
**Document Version:** 1.0.0  
**Status:** PLANNING ONLY — NO IMPLEMENTATION  
**Date:** November 10, 2026  

---

## 1. DESIGN SYSTEM & VISUAL HARMONY

The Practical Drill Engine adheres strictly to the existing Casper dark editorial aesthetic:
- **Background**: Deep void slate (`#0b0f17`, `#111827`)
- **Card Background**: Elevated dark container (`#161e2e`, border `#1f293d`)
- **Primary Accent**: Casper Cyan (`#41d9ef`) for active states, crosshairs, and primary actions.
- **Secondary Accent**: Emerald Mint (`#53d9bf`) for winning/passing confirmations and demand zones.
- **Warning / Invalidation**: Amber/Rose (`#f43f5e`, `#f59e0b`) for stop-loss levels and supply zones.

---

## 2. STUDENT DRILL WORKSPACE (`/belajar/drill/[id]`)

### 2.1 Screen Architecture & Two-Column Layout (Desktop $\ge 1024\text{px}$)
```
┌───────────────────────────────────────────────┬───────────────────────────────────────────────┐
│ LEFT COLUMN: INTERACTIVE CHART CASE           │ RIGHT COLUMN: DECISION & EXECUTION CONSOLE    │
├───────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ [Topline: XAUUSD · H1 · Provenance Verified]  │ [Step 1: Bias Selection]                      │
│                                               │  (•) Bullish   ( ) Bearish   ( ) Neutral      │
│ [Zoom Controls: (+) (-) (Reset) (Crosshair)]  │                                               │
│                                               │ [Execution Stance]                            │
│ ┌───────────────────────────────────────────┐ │  [✓ Take Position]   [  NO-TRADE Stance]      │
│ │                                           │ │                                               │
│ │   [ INTERACTIVE SVG / CANVAS CHART ]      │ │ [Step 2: Price Levels]                        │
│ │                                           │ │  Entry Price:        [ 2666.80 ]              │
│ │   - Pan via drag                          │ │  Stop-Loss (SL):     [ 2670.20 ]              │
│ │   - Zoom via scroll / pinch               │ │  Take-Profit (TP):   [ 2655.00 ]              │
│ │   - Crosshair price readout               │ │  Implied R:R:        1 : 3.47  (Valid ≥ 1:2)  │
│ │                                           │ │                                               │
│ └───────────────────────────────────────────┘ │ [Step 3: Setup Confirmations]                 │
│                                               │  [x] Liquidity Sweep   [x] FVG Tap            │
│ [Context Bar: Asian Session High Sweep Case]  │                                               │
│                                               │ [Step 4: Rationale & Thesis]                  │
│                                               │  [ Textarea: Rationale details...           ] │
│                                               │                                               │
│                                               │ [ BUTTON: Submit Drill Decision ]             │
└───────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

### 2.2 Interactive Chart Behavior
1. **Pan & Drag**: Students can click-and-drag across the chart area. Handled via standard Pointer Events (`onPointerDown`, `onPointerMove`, `onPointerUp`).
2. **Zoom In/Out**: Zoom level ranges between $1.0\times$ and $3.0\times$. Zoom can be controlled via top-bar buttons (`+`, `-`, `Reset`) or wheel pinch.
3. **Crosshair & Price Probe**: Hovering displays coordinate crosshairs with a floating price badge on the Y-axis, allowing students to read price levels directly before typing them into input fields.
4. **Zero Horizontal Window Scroll**: The chart viewer is strictly contained inside a container with `overflow: hidden; max-width: 100%;`.

---

## 3. DRILL EVALUATION DEBRIEF EXPERIENCE

Upon submission, the right-hand console transitions smoothly into the **Evaluation Debrief**:
1. **Header Banner**:
   - Passed ($\ge 70\%$): Glowing emerald badge with `"Evaluasi Praktik: LULUS (92%)"` and animated checkmark.
   - Failed ($< 70\%$): Amber badge with `"Perlu Latihan Ulang (58%)"` and specific guidance to retry.
2. **Rubric Scorecard Table**:
   - Displays each of the 5 criteria: Weight, Points Earned, and expand/collapse detailed explanation.
3. **Solution Overlay Toggle**:
   - The left-hand chart view activates a toggle button: `"Tampilkan Solusi Institusional"`.
   - Activating overlays the instructor's annotated zones (Entry FVG, Invalidation wick line, Target liquidity pool).

---

## 4. RESPONSIVE MATRIX & VIEWPORT RULES

| Viewport | Screen Width | Layout Pattern | Chart Interaction Rule |
| :--- | :--- | :--- | :--- |
| **Desktop Ultra** | $1440\text{px}$ | 2 Columns ($60\%$ Chart, $40\%$ Console) | Full wheel zoom + crosshair active |
| **Tablet** | $768\text{px}$ | Stacked Vertical (Chart top $420\text{px}$, Console bottom) | Touch drag + explicit Zoom buttons |
| **Mobile Standard** | $390\text{px}$ | Single column stacked | Pinch-to-zoom + bottom sticky submit bar |
| **Mobile Compact** | $360\text{px}$ | Single column compact | Touch pan container with `touch-action: none` |

*Zero Window Overflow Rule*: Like Sprint 4, all tables and inputs must enforce:
```css
.drill-workspace-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}
.drill-chart-container {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  position: relative;
}
```

---

## 5. UI STATES (LOADING, EMPTY, ERROR, RETRY)

1. **Loading State**: Shimmer skeleton with pulse effect over chart container and input console.
2. **Empty / No Drills Available**: Informative empty state card with icon `Compass` and CTA: *"Belum ada studi kasus terbuka pada modul ini. Selesaikan materi pembelajaran terlebih dahulu."*
3. **Error State (Network/Validation)**: Non-blocking toast notification with retry button. In case of invalid inputs (e.g. SL is above entry for a long trade), the input displays red border with helper text: *"Stop-Loss untuk posisi Buy harus berada di bawah harga Entry."*
4. **Retry Flow**: Clear `"Coba Lagi Studi Kasus"` button allowing the student to reset fields while retaining past attempt history in an expander below.

