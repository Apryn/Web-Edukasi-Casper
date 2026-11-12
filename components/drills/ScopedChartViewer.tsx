"use client";

/**
 * SIGNAL CASPER ACADEMY — SPRINT 5
 * Interactive Scoped Chart Viewer Component (Task 5.3)
 *
 * Implements static image rendering (PNG/WebP only), canvas pan & zoom (1.0x - 3.0x),
 * interactive crosshair tracking with floating price pill, normalized level placement
 * (Entry, Invalidation/SL, Target/TP), and strict read-only lock mode.
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Image from "next/image";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
  ShieldAlert,
  Lock,
  ArrowUpDown,
  Eye,
  Info,
} from "lucide-react";
import type { ChartPriceBounds } from "@/lib/drill-types";
import {
  validateChartAssetUrl,
  clamp01,
  clampZoom,
  clampPanOffset,
  normalizedYToPrice,
  viewportToPointerStage,
  formatPrice,
  type DrillLevels,
  type ViewportTransform,
  type Point2D,
} from "@/lib/chart-coordinates";

export type ActivePlacementTool = "ENTRY" | "INVALIDATION" | "TARGET" | null;

export interface ScopedChartViewerProps {
  chartAssetUrl: string;
  priceBounds: ChartPriceBounds;
  provenance?: {
    instrument?: string;
    timeframe?: string;
    dataPeriod?: string;
    dataSource?: string;
    classification?: string;
  };
  levels?: DrillLevels;
  onLevelsChange?: (levels: DrillLevels) => void;
  readOnly?: boolean;
  activePlacementTool?: ActivePlacementTool;
  onActivePlacementToolChange?: (tool: ActivePlacementTool) => void;
  className?: string;
  solutionOverlayUrl?: string | null;
  showSolutionOverlay?: boolean;
}

export default function ScopedChartViewer({
  chartAssetUrl,
  priceBounds,
  provenance,
  levels = {},
  onLevelsChange,
  readOnly = false,
  activePlacementTool: externalActiveTool,
  onActivePlacementToolChange,
  className = "",
  solutionOverlayUrl,
  showSolutionOverlay = false,
}: ScopedChartViewerProps) {
  // ── Asset Security Validation ──────────────────────────────────
  const assetValidation = useMemo(
    () => validateChartAssetUrl(chartAssetUrl),
    [chartAssetUrl]
  );

  const solutionValidation = useMemo(
    () => (solutionOverlayUrl ? validateChartAssetUrl(solutionOverlayUrl) : null),
    [solutionOverlayUrl]
  );

  // ── Local State ────────────────────────────────────────────────
  const [transform, setTransform] = useState<ViewportTransform>({
    zoom: 1.0,
    panX: 0,
    panY: 0,
  });

  const [internalActiveTool, setInternalActiveTool] =
    useState<ActivePlacementTool>("ENTRY");

  // Controlled vs uncontrolled active placement tool
  const currentActiveTool =
    externalActiveTool !== undefined ? externalActiveTool : internalActiveTool;

  const setActiveTool = useCallback(
    (tool: ActivePlacementTool) => {
      if (readOnly) return;
      if (onActivePlacementToolChange) {
        onActivePlacementToolChange(tool);
      } else {
        setInternalActiveTool(tool);
      }
    },
    [readOnly, onActivePlacementToolChange]
  );

  // Crosshair state
  const [crosshair, setCrosshair] = useState<{
    visible: boolean;
    stageX: number;
    stageY: number;
    normalizedY: number;
    price: number;
  }>({
    visible: false,
    stageX: 0,
    stageY: 0,
    normalizedY: 0,
    price: priceBounds?.maxPrice || 0,
  });

  // Drag interaction states (Pan vs Level Drag)
  const [isPanning, setIsPanning] = useState(false);
  const [draggedLevelKey, setDraggedLevelKey] = useState<
    "entry" | "invalidation" | "target" | null
  >(null);

  const panStartRef = useRef<{ pointer: Point2D; initialPan: Point2D }>({
    pointer: { x: 0, y: 0 },
    initialPan: { x: 0, y: 0 },
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Stage dimensions (tracked via ResizeObserver or container)
  const [stageDimensions, setStageDimensions] = useState({
    width: 800,
    height: 500,
  });

  // Track container dimensions on mount and resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageDimensions({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Level Mutation Helper ──────────────────────────────────────
  const updateLevel = useCallback(
    (key: "entry" | "invalidation" | "target", normY: number) => {
      if (readOnly || !onLevelsChange) return;

      const clampedY = clamp01(normY);
      const price = normalizedYToPrice(clampedY, priceBounds);

      const nextLevels: DrillLevels = {
        ...levels,
        [key]: {
          normalizedY: clampedY,
          price,
        },
      };

      onLevelsChange(nextLevels);
    },
    [readOnly, onLevelsChange, levels, priceBounds]
  );

  // ── Pan & Zoom Handlers ─────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    setTransform((prev) => {
      const nextZoom = clampZoom(prev.zoom + 0.25);
      const clampedPan = clampPanOffset({
        pan: { x: prev.panX, y: prev.panY },
        zoom: nextZoom,
        containerDimensions: stageDimensions,
        stageDimensions,
      });
      return { zoom: nextZoom, panX: clampedPan.x, panY: clampedPan.y };
    });
  }, [stageDimensions]);

  const handleZoomOut = useCallback(() => {
    setTransform((prev) => {
      const nextZoom = clampZoom(prev.zoom - 0.25);
      const clampedPan = clampPanOffset({
        pan: { x: prev.panX, y: prev.panY },
        zoom: nextZoom,
        containerDimensions: stageDimensions,
        stageDimensions,
      });
      return { zoom: nextZoom, panX: clampedPan.x, panY: clampedPan.y };
    });
  }, [stageDimensions]);

  const handleResetZoom = useCallback(() => {
    setTransform({ zoom: 1.0, panX: 0, panY: 0 });
  }, []);

  // Wheel zoom
  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;

      setTransform((prev) => {
        const nextZoom = clampZoom(prev.zoom + zoomFactor);
        const clampedPan = clampPanOffset({
          pan: { x: prev.panX, y: prev.panY },
          zoom: nextZoom,
          containerDimensions: stageDimensions,
          stageDimensions,
        });
        return { zoom: nextZoom, panX: clampedPan.x, panY: clampedPan.y };
      });
    },
    [stageDimensions]
  );

  // ── Pointer Tracking & Crosshair ────────────────────────────────
  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      // Panning active
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.pointer.x;
        const dy = e.clientY - panStartRef.current.pointer.y;

        const nextPan = {
          x: panStartRef.current.initialPan.x + dx,
          y: panStartRef.current.initialPan.y + dy,
        };

        const clamped = clampPanOffset({
          pan: nextPan,
          zoom: transform.zoom,
          containerDimensions: stageDimensions,
          stageDimensions,
        });

        setTransform((prev) => ({
          ...prev,
          panX: clamped.x,
          panY: clamped.y,
        }));
        return;
      }

      // Level dragging active
      if (draggedLevelKey && !readOnly) {
        const stagePos = viewportToPointerStage({
          clientX: e.clientX,
          clientY: e.clientY,
          containerRect: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          },
          stageDimensions,
          transform,
        });

        updateLevel(draggedLevelKey, stagePos.normalizedY);
        return;
      }

      // Normal crosshair update
      const stagePos = viewportToPointerStage({
        clientX: e.clientX,
        clientY: e.clientY,
        containerRect: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
        stageDimensions,
        transform,
      });

      if (stagePos.isInside) {
        const currentPrice = normalizedYToPrice(
          stagePos.normalizedY,
          priceBounds
        );
        setCrosshair({
          visible: true,
          stageX: Math.round(stagePos.stageX),
          stageY: Math.round(stagePos.stageY),
          normalizedY: stagePos.normalizedY,
          price: currentPrice,
        });
      } else {
        setCrosshair((prev) => ({ ...prev, visible: false }));
      }
    },
    [
      isPanning,
      draggedLevelKey,
      readOnly,
      transform,
      stageDimensions,
      priceBounds,
      updateLevel,
    ]
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // If user clicked directly on a level drag handle, don't initiate viewport pan
      if ((e.target as HTMLElement).dataset?.handle) {
        return;
      }

      // Secondary click or middle click or space-bar or default left-drag:
      // When shift key is pressed or pan tool active, prioritize panning
      if (e.button === 1 || e.shiftKey || transform.zoom > 1.0) {
        setIsPanning(true);
        panStartRef.current = {
          pointer: { x: e.clientX, y: e.clientY },
          initialPan: { x: transform.panX, y: transform.panY },
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [transform]
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isPanning) {
        setIsPanning(false);
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}
      }
      if (draggedLevelKey) {
        setDraggedLevelKey(null);
      }
    },
    [isPanning, draggedLevelKey]
  );

  const handlePointerLeave = useCallback(() => {
    if (!isPanning && !draggedLevelKey) {
      setCrosshair((prev) => ({ ...prev, visible: false }));
    }
  }, [isPanning, draggedLevelKey]);

  // Click on chart to place currently active tool level
  const handleChartClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly || !currentActiveTool || isPanning || draggedLevelKey) {
        return;
      }
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const stagePos = viewportToPointerStage({
        clientX: e.clientX,
        clientY: e.clientY,
        containerRect: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
        stageDimensions,
        transform,
      });

      if (!stagePos.isInside) return;

      if (currentActiveTool === "ENTRY") {
        updateLevel("entry", stagePos.normalizedY);
      } else if (currentActiveTool === "INVALIDATION") {
        updateLevel("invalidation", stagePos.normalizedY);
      } else if (currentActiveTool === "TARGET") {
        updateLevel("target", stagePos.normalizedY);
      }
    },
    [
      readOnly,
      currentActiveTool,
      isPanning,
      draggedLevelKey,
      stageDimensions,
      transform,
      updateLevel,
    ]
  );

  // Keyboard accessibility for level lines
  const handleLevelKeyDown = useCallback(
    (
      e: ReactKeyboardEvent<HTMLDivElement>,
      key: "entry" | "invalidation" | "target"
    ) => {
      if (readOnly) return;
      const currentLevel = levels[key];
      if (!currentLevel) return;

      const step = e.shiftKey ? 0.02 : 0.005; // 2% vs 0.5%
      let nextY = currentLevel.normalizedY;

      if (e.key === "ArrowUp") {
        // Up means higher price -> lower Y in inverted coordinates
        nextY = clamp01(currentLevel.normalizedY - step);
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        // Down means lower price -> higher Y in inverted coordinates
        nextY = clamp01(currentLevel.normalizedY + step);
        e.preventDefault();
      }

      if (nextY !== currentLevel.normalizedY) {
        updateLevel(key, nextY);
      }
    },
    [readOnly, levels, updateLevel]
  );

  // ── Security Check Fallback ────────────────────────────────────
  if (!assetValidation.valid) {
    return (
      <div
        className={`chart-frame rounded-none border border-rose-500/30 bg-[#0d1217] p-8 text-center ${className}`}
        role="alert"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="font-['Manrope'] text-lg font-semibold text-rose-400">
          Format Aset Chart Ditolak
        </h3>
        <p className="mx-auto mt-2 max-w-md text-xs text-[#87939f]">
          {assetValidation.error ||
            "Sistem hanya menerima gambar statis PNG dan WebP demi proteksi keamanan (Anti-XSS)."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`chart-frame group relative flex flex-col border border-[#28323c] bg-[#10151b] ${className}`}
    >
      {/* ── Top Header Toolbar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#28323c] bg-[#131a21] px-4 py-2.5">
        {/* Left: Provenance & Mode Badge */}
        <div className="flex items-center gap-2.5 font-['DM_Mono'] text-[10px] text-[#87939f]">
          <span className="flex items-center gap-1.5 font-semibold text-[#41d9ef]">
            <Crosshair className="h-3.5 w-3.5" />
            {provenance?.instrument || "HISTORICAL DRILL"}
          </span>
          {provenance?.timeframe && (
            <span className="rounded border border-[#28323c] bg-[#090c10] px-1.5 py-0.5 text-[#a3f1fa]">
              {provenance.timeframe}
            </span>
          )}
          {readOnly ? (
            <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">
              <Lock className="h-3 w-3" /> READ-ONLY
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[#6ce0b0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6ce0b0]" />
              INTERACTIVE
            </span>
          )}
          {showSolutionOverlay && (
            <span className="inline-flex items-center gap-1 rounded border border-[#53d9bf]/40 bg-[#53d9bf]/10 px-2 py-0.5 text-[#53d9bf]">
              <Eye className="h-3 w-3" /> SOLUSI AKTIF
            </span>
          )}
        </div>

        {/* Right: Pan/Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={transform.zoom <= 1.0}
            aria-label="Perkecil chart zoom"
            className="flex h-7 w-7 items-center justify-center border border-[#28323c] bg-[#090c10] text-[#cbd5e1] transition hover:border-[#41d9ef] hover:text-[#41d9ef] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span
            className="min-w-[42px] text-center font-['DM_Mono'] text-[10px] text-[#87939f]"
            aria-live="polite"
          >
            {Math.round(transform.zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={transform.zoom >= 3.0}
            aria-label="Perbesar chart zoom"
            className="flex h-7 w-7 items-center justify-center border border-[#28323c] bg-[#090c10] text-[#cbd5e1] transition hover:border-[#41d9ef] hover:text-[#41d9ef] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            disabled={transform.zoom === 1.0 && transform.panX === 0 && transform.panY === 0}
            aria-label="Reset zoom chart ke 1.0x"
            title="Reset ke 100% dan pusatkan"
            className="flex h-7 items-center gap-1 border border-[#28323c] bg-[#090c10] px-2 font-['DM_Mono'] text-[10px] text-[#cbd5e1] transition hover:border-[#41d9ef] hover:text-[#41d9ef] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" />
            <span>1.0x</span>
          </button>
        </div>
      </div>

      {/* ── Level Selection Toolbar (Interactive Mode Only) ──────── */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#28323c] bg-[#0d1217] px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="font-['DM_Mono'] text-[10px] uppercase text-[#6f7d88]">
              Klik Chart Untuk Pasang:
            </span>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Alat Level Penempatan">
              <button
                type="button"
                onClick={() => setActiveTool("ENTRY")}
                aria-checked={currentActiveTool === "ENTRY"}
                role="radio"
                className={`flex items-center gap-1.5 border px-2.5 py-1 font-['DM_Mono'] text-[10px] transition ${
                  currentActiveTool === "ENTRY"
                    ? "border-[#41d9ef] bg-[#41d9ef]/15 text-[#41d9ef]"
                    : "border-[#28323c] bg-[#10151b] text-[#87939f] hover:border-[#384857] hover:text-[#eef2f5]"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#41d9ef]" />
                Entry
              </button>
              <button
                type="button"
                onClick={() => setActiveTool("INVALIDATION")}
                aria-checked={currentActiveTool === "INVALIDATION"}
                role="radio"
                className={`flex items-center gap-1.5 border px-2.5 py-1 font-['DM_Mono'] text-[10px] transition ${
                  currentActiveTool === "INVALIDATION"
                    ? "border-[#f43f5e] bg-[#f43f5e]/15 text-[#f43f5e]"
                    : "border-[#28323c] bg-[#10151b] text-[#87939f] hover:border-[#384857] hover:text-[#eef2f5]"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#f43f5e]" />
                Stop-Loss
              </button>
              <button
                type="button"
                onClick={() => setActiveTool("TARGET")}
                aria-checked={currentActiveTool === "TARGET"}
                role="radio"
                className={`flex items-center gap-1.5 border px-2.5 py-1 font-['DM_Mono'] text-[10px] transition ${
                  currentActiveTool === "TARGET"
                    ? "border-[#53d9bf] bg-[#53d9bf]/15 text-[#53d9bf]"
                    : "border-[#28323c] bg-[#10151b] text-[#87939f] hover:border-[#384857] hover:text-[#eef2f5]"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#53d9bf]" />
                Target (TP)
              </button>
            </div>
          </div>

          <div className="hidden items-center gap-1.5 text-[10px] text-[#6f7d88] md:flex">
            <Info className="h-3 w-3 text-[#41d9ef]" />
            <span>Geser garis atau klik chart untuk mengatur harga</span>
          </div>
        </div>
      )}

      {/* ── Main Chart Canvas Container ───────────────────────────── */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onClick={handleChartClick}
        style={{
          touchAction: "none",
          cursor: isPanning
            ? "grabbing"
            : readOnly
            ? "default"
            : "crosshair",
        }}
        className="viewer-viewport relative h-[360px] w-full select-none overflow-hidden bg-[#090c10] sm:h-[440px] md:h-[500px]"
        tabIndex={0}
        aria-label="Interactive Chart Viewer Canvas"
      >
        {/* Transform Stage Layer (Zoom & Pan) */}
        <div
          ref={stageRef}
          className="chart-stage absolute inset-0 will-change-transform"
          style={{
            transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
            transformOrigin: "0 0",
            width: stageDimensions.width,
            height: stageDimensions.height,
          }}
        >
          {/* Base Clean Chart Image (PNG/WebP only) */}
          <Image
            src={chartAssetUrl}
            alt="Historical Market Chart Drill"
            fill
            sizes="100vw"
            priority
            unoptimized
            draggable={false}
            className="pointer-events-none select-none object-contain"
          />

          {/* Solution Overlay Layer (When active and valid) */}
          {showSolutionOverlay &&
            solutionValidation &&
            solutionValidation.valid &&
            solutionOverlayUrl && (
              <Image
                src={solutionOverlayUrl}
                alt="Instructor Solution Overlay"
                fill
                sizes="100vw"
                unoptimized
                draggable={false}
                className="pointer-events-none absolute inset-0 select-none object-contain opacity-85 transition-opacity"
              />
            )}

          {/* ── Level Lines Layer (Pixel-Locked with Image Underneath) ── */}
          <div className="chart-levels-overlay absolute inset-0 pointer-events-none">
            {/* 1. Entry Line (Cyan) */}
            {levels.entry != null && (
              <div
                style={{ top: `${levels.entry.normalizedY * 100}%` }}
                className="absolute left-0 right-0 z-10 -translate-y-1/2"
              >
                <div className="relative flex items-center">
                  <div className="h-[2px] w-full border-t-2 border-dashed border-[#41d9ef] shadow-[0_0_8px_rgba(65,217,239,0.4)]" />
                  <div
                    tabIndex={readOnly ? -1 : 0}
                    role="slider"
                    aria-label="Entry Price Level"
                    aria-valuemin={priceBounds.minPrice}
                    aria-valuemax={priceBounds.maxPrice}
                    aria-valuenow={levels.entry.price}
                    onKeyDown={(e) => handleLevelKeyDown(e, "entry")}
                    onPointerDown={(e) => {
                      if (readOnly) return;
                      e.stopPropagation();
                      setDraggedLevelKey("entry");
                    }}
                    data-handle="entry"
                    className={`absolute left-3 flex items-center gap-1.5 rounded-none border border-[#41d9ef] bg-[#090c10] px-2 py-0.5 font-['DM_Mono'] text-[10px] font-semibold text-[#41d9ef] shadow-lg ${
                      readOnly
                        ? "pointer-events-none opacity-90"
                        : "pointer-events-auto cursor-ns-resize hover:bg-[#41d9ef]/20 focus:outline-none focus:ring-1 focus:ring-[#41d9ef]"
                    }`}
                  >
                    {!readOnly && <ArrowUpDown className="h-2.5 w-2.5" />}
                    <span>ENTRY:</span>
                    <span className="font-bold">
                      {formatPrice(levels.entry.price, priceBounds.decimals)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Invalidation Line (Stop-Loss / Red) */}
            {levels.invalidation != null && (
              <div
                style={{ top: `${levels.invalidation.normalizedY * 100}%` }}
                className="absolute left-0 right-0 z-10 -translate-y-1/2"
              >
                <div className="relative flex items-center">
                  <div className="h-[2px] w-full border-t-2 border-dashed border-[#f43f5e] shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                  <div
                    tabIndex={readOnly ? -1 : 0}
                    role="slider"
                    aria-label="Stop Loss Invalidation Price Level"
                    aria-valuemin={priceBounds.minPrice}
                    aria-valuemax={priceBounds.maxPrice}
                    aria-valuenow={levels.invalidation.price}
                    onKeyDown={(e) => handleLevelKeyDown(e, "invalidation")}
                    onPointerDown={(e) => {
                      if (readOnly) return;
                      e.stopPropagation();
                      setDraggedLevelKey("invalidation");
                    }}
                    data-handle="invalidation"
                    className={`absolute left-3 flex items-center gap-1.5 rounded-none border border-[#f43f5e] bg-[#090c10] px-2 py-0.5 font-['DM_Mono'] text-[10px] font-semibold text-[#f43f5e] shadow-lg ${
                      readOnly
                        ? "pointer-events-none opacity-90"
                        : "pointer-events-auto cursor-ns-resize hover:bg-[#f43f5e]/20 focus:outline-none focus:ring-1 focus:ring-[#f43f5e]"
                    }`}
                  >
                    {!readOnly && <ArrowUpDown className="h-2.5 w-2.5" />}
                    <span>STOP-LOSS:</span>
                    <span className="font-bold">
                      {formatPrice(levels.invalidation.price, priceBounds.decimals)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Target Line (Take-Profit / Emerald) */}
            {levels.target != null && (
              <div
                style={{ top: `${levels.target.normalizedY * 100}%` }}
                className="absolute left-0 right-0 z-10 -translate-y-1/2"
              >
                <div className="relative flex items-center">
                  <div className="h-[2px] w-full border-t-2 border-dashed border-[#53d9bf] shadow-[0_0_8px_rgba(83,217,191,0.4)]" />
                  <div
                    tabIndex={readOnly ? -1 : 0}
                    role="slider"
                    aria-label="Target Take Profit Price Level"
                    aria-valuemin={priceBounds.minPrice}
                    aria-valuemax={priceBounds.maxPrice}
                    aria-valuenow={levels.target.price}
                    onKeyDown={(e) => handleLevelKeyDown(e, "target")}
                    onPointerDown={(e) => {
                      if (readOnly) return;
                      e.stopPropagation();
                      setDraggedLevelKey("target");
                    }}
                    data-handle="target"
                    className={`absolute left-3 flex items-center gap-1.5 rounded-none border border-[#53d9bf] bg-[#090c10] px-2 py-0.5 font-['DM_Mono'] text-[10px] font-semibold text-[#53d9bf] shadow-lg ${
                      readOnly
                        ? "pointer-events-none opacity-90"
                        : "pointer-events-auto cursor-ns-resize hover:bg-[#53d9bf]/20 focus:outline-none focus:ring-1 focus:ring-[#53d9bf]"
                    }`}
                  >
                    {!readOnly && <ArrowUpDown className="h-2.5 w-2.5" />}
                    <span>TARGET:</span>
                    <span className="font-bold">
                      {formatPrice(levels.target.price, priceBounds.decimals)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Crosshair Guidelines (Inside Stage) ────────────────── */}
            {crosshair.visible && !isPanning && (
              <>
                {/* Horizontal guide line */}
                <div
                  style={{ top: `${crosshair.stageY}px` }}
                  className="pointer-events-none absolute left-0 right-0 z-20 h-[1px] border-t border-dashed border-[#41d9ef]/50"
                />
                {/* Vertical guide line */}
                <div
                  style={{ left: `${crosshair.stageX}px` }}
                  className="pointer-events-none absolute bottom-0 top-0 z-20 w-[1px] border-l border-dashed border-[#41d9ef]/50"
                />
              </>
            )}
          </div>
        </div>

        {/* ── Floating Price Pill on Right Axis ─────────────────────── */}
        {crosshair.visible && !isPanning && (
          <div
            style={{
              top: `${transform.panY + crosshair.stageY * transform.zoom}px`,
            }}
            className="pointer-events-none absolute right-2 z-30 -translate-y-1/2 border border-[#41d9ef] bg-[#061116] px-2 py-1 font-['DM_Mono'] text-[11px] font-bold text-[#41d9ef] shadow-xl"
            aria-live="polite"
          >
            {formatPrice(crosshair.price, priceBounds.decimals)}
          </div>
        )}

        {/* Price Bounds Indicator at Edge */}
        <div className="pointer-events-none absolute bottom-2 right-2 z-20 flex flex-col items-end gap-1 font-['DM_Mono'] text-[9px] text-[#6f7d88]">
          <span>MAX: {formatPrice(priceBounds.maxPrice, priceBounds.decimals)}</span>
          <span>MIN: {formatPrice(priceBounds.minPrice, priceBounds.decimals)}</span>
        </div>
      </div>

      {/* ── Bottom Provenance Metadata Footnote ──────────────────── */}
      {provenance && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#28323c] bg-[#0e141a] px-4 py-2 font-['DM_Mono'] text-[9px] text-[#6f7d88]">
          <div className="flex items-center gap-3">
            <span>SUMBER: {provenance.dataSource || "Institutional Curated Feed"}</span>
            <span>PERIODE: {provenance.dataPeriod || "Historical Sample"}</span>
          </div>
          <div>
            <span>KLASIFIKASI: {provenance.classification || "HISTORICAL_MARKET"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
