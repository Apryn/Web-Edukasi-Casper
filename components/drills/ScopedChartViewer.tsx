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
    <div className={`drill-viewer-wrap ${className}`}>
      {/* ── Top Header Toolbar ────────────────────────────────────── */}
      <div className="drill-viewer-topbar">
        {/* Left: Provenance & Mode Badge */}
        <div className="drill-viewer-provenance">
          <span className="drill-badge-inst">
            <Crosshair className="h-3.5 w-3.5" />
            {provenance?.instrument || "HISTORICAL DRILL"}
          </span>
          {provenance?.timeframe && (
            <span className="drill-timeframe-tag">
              {provenance.timeframe}
            </span>
          )}
          {readOnly ? (
            <span className="drill-status-readonly">
              <Lock style={{ width: 12, height: 12, display: "inline-block", marginRight: 4 }} /> READ-ONLY
            </span>
          ) : (
            <span className="drill-status-live">
              <span className="live-dot" />
              INTERACTIVE
            </span>
          )}
          {showSolutionOverlay && (
            <span className="drill-status-solution">
              <Eye style={{ width: 12, height: 12, display: "inline-block", marginRight: 4 }} /> SOLUSI AKTIF
            </span>
          )}
        </div>

        {/* Right: Pan/Zoom Controls */}
        <div className="drill-zoom-bar">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={transform.zoom <= 1.0}
            aria-label="Perkecil chart zoom"
            className="drill-btn-icon"
          >
            <ZoomOut style={{ width: 14, height: 14 }} />
          </button>
          <span
            className="drill-zoom-val"
            aria-live="polite"
          >
            {Math.round(transform.zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={transform.zoom >= 3.0}
            aria-label="Perbesar chart zoom"
            className="drill-btn-icon"
          >
            <ZoomIn style={{ width: 14, height: 14 }} />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            disabled={transform.zoom === 1.0 && transform.panX === 0 && transform.panY === 0}
            aria-label="Reset zoom chart ke 1.0x"
            title="Reset ke 100% dan pusatkan"
            className="drill-btn-reset"
          >
            <RotateCcw style={{ width: 12, height: 12 }} />
            <span>1.0x</span>
          </button>
        </div>
      </div>

      {/* ── Level Selection Toolbar (Interactive Mode Only) ──────── */}
      {!readOnly && (
        <div className="drill-tools-bar">
          <div className="drill-tools-group">
            <span className="drill-tools-label">
              Klik Chart Untuk Pasang:
            </span>
            <div style={{ display: "flex", gap: 6 }} role="radiogroup" aria-label="Alat Level Penempatan">
              <button
                type="button"
                onClick={() => setActiveTool("ENTRY")}
                aria-checked={currentActiveTool === "ENTRY"}
                role="radio"
                className={`drill-tool-btn entry ${currentActiveTool === "ENTRY" ? "active" : ""}`}
              >
                <span className="drill-dot-entry" />
                Entry
              </button>
              <button
                type="button"
                onClick={() => setActiveTool("INVALIDATION")}
                aria-checked={currentActiveTool === "INVALIDATION"}
                role="radio"
                className={`drill-tool-btn sl ${currentActiveTool === "INVALIDATION" ? "active" : ""}`}
              >
                <span className="drill-dot-sl" />
                Stop-Loss
              </button>
              <button
                type="button"
                onClick={() => setActiveTool("TARGET")}
                aria-checked={currentActiveTool === "TARGET"}
                role="radio"
                className={`drill-tool-btn tp ${currentActiveTool === "TARGET" ? "active" : ""}`}
              >
                <span className="drill-dot-tp" />
                Target (TP)
              </button>
            </div>
          </div>

          <div className="drill-tools-hint">
            <Info style={{ width: 13, height: 13, color: "var(--cyan)" }} />
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
        className="drill-canvas-viewport"
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
          <div className="drill-level-overlay">
            {/* 1. Entry Line (Cyan) */}
            {levels.entry != null && (
              <div
                style={{ top: `${levels.entry.normalizedY * 100}%` }}
                className="drill-level-row"
              >
                <div className="drill-level-line-wrap">
                  <div className="drill-level-line entry" />
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
                    className={`drill-level-handle entry ${readOnly ? "readonly" : ""}`}
                  >
                    {!readOnly && <ArrowUpDown style={{ width: 11, height: 11 }} />}
                    <span>ENTRY:</span>
                    <span>
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
                className="drill-level-row"
              >
                <div className="drill-level-line-wrap">
                  <div className="drill-level-line sl" />
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
                    className={`drill-level-handle sl ${readOnly ? "readonly" : ""}`}
                  >
                    {!readOnly && <ArrowUpDown style={{ width: 11, height: 11 }} />}
                    <span>STOP-LOSS:</span>
                    <span>
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
                className="drill-level-row"
              >
                <div className="drill-level-line-wrap">
                  <div className="drill-level-line tp" />
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
                    className={`drill-level-handle tp ${readOnly ? "readonly" : ""}`}
                  >
                    {!readOnly && <ArrowUpDown style={{ width: 11, height: 11 }} />}
                    <span>TARGET:</span>
                    <span>
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
                  className="drill-crosshair-h"
                />
                {/* Vertical guide line */}
                <div
                  style={{ left: `${crosshair.stageX}px` }}
                  className="drill-crosshair-v"
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
            className="drill-price-pill"
            aria-live="polite"
          >
            {formatPrice(crosshair.price, priceBounds.decimals)}
          </div>
        )}

        {/* Price Bounds Indicator at Edge */}
        <div className="drill-bounds-indicator">
          <span>MAX: {formatPrice(priceBounds.maxPrice, priceBounds.decimals)}</span>
          <span>MIN: {formatPrice(priceBounds.minPrice, priceBounds.decimals)}</span>
        </div>
      </div>

      {/* ── Bottom Provenance Metadata Footnote ──────────────────── */}
      {provenance && (
        <div className="drill-viewer-footnote">
          <div className="drill-footnote-meta">
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
