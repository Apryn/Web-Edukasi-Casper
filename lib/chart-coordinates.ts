/**
 * SIGNAL CASPER ACADEMY — SPRINT 5
 * Scoped Chart Coordinates & Price Mapping Engine
 *
 * Provides pure, deterministic coordinate normalization, price interpolation,
 * viewport-to-stage inverse transformations, and asset security validation.
 */

import type { ChartPriceBounds } from "./drill-types";

export interface Point2D {
  x: number;
  y: number;
}

export interface RectDimensions {
  width: number;
  height: number;
}

export interface BoundingBox extends Point2D, RectDimensions {}

export interface ChartLevelState {
  normalizedY: number; // 0.0 (top / maxPrice) to 1.0 (bottom / minPrice)
  price: number;
}

export interface DrillLevels {
  entry?: ChartLevelState | null;
  invalidation?: ChartLevelState | null;
  target?: ChartLevelState | null;
}

// ── Asset Security Validation ──────────────────────────────────────
/**
 * Strict validation of chart image asset URLs.
 * Strictly permits PNG and WebP only.
 * Rejects SVG, GIF, BMP, TIFF, data URIs containing SVG, and non-string inputs.
 */
export function validateChartAssetUrl(rawUrl: unknown): {
  valid: boolean;
  format: "png" | "webp" | "invalid";
  error?: string;
} {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return {
      valid: false,
      format: "invalid",
      error: "URL aset chart wajib berupa teks valid.",
    };
  }

  const url = rawUrl.trim().toLowerCase();

  // Explicit SVG rejection (XSS vulnerability prevention)
  if (
    url.includes(".svg") ||
    url.includes("image/svg") ||
    url.startsWith("data:image/svg+xml") ||
    url.includes("<svg")
  ) {
    return {
      valid: false,
      format: "invalid",
      error: "Format SVG ditolak demi keamanan (XSS protection). Hanya PNG dan WebP yang diizinkan.",
    };
  }

  // Reject GIF, BMP, ICO
  if (url.includes(".gif") || url.includes(".bmp") || url.includes(".ico")) {
    return {
      valid: false,
      format: "invalid",
      error: "Format gambar tidak didukung. Hanya PNG dan WebP yang diizinkan.",
    };
  }

  // Check for allowed extensions or valid data URI
  const isWebp =
    url.endsWith(".webp") ||
    url.includes(".webp?") ||
    url.startsWith("data:image/webp;base64,");

  const isPng =
    url.endsWith(".png") ||
    url.includes(".png?") ||
    url.startsWith("data:image/png;base64,");

  if (isWebp) {
    return { valid: true, format: "webp" };
  }

  if (isPng) {
    return { valid: true, format: "png" };
  }

  // Reject unrecognized formats
  return {
    valid: false,
    format: "invalid",
    error: "Aset chart harus berekstensi .png atau .webp.",
  };
}

// ── Price & Coordinate Normalization ──────────────────────────────

/**
 * Clamps a number strictly within [0.0, 1.0].
 */
export function clamp01(val: number): number {
  if (!Number.isFinite(val)) return 0;
  if (val <= 0) return 0;
  if (val >= 1) return 1;
  return val;
}

/**
 * Converts a normalized Y coordinate (0.0 at top / maxPrice, 1.0 at bottom / minPrice)
 * to a discrete financial price based on the chart's price bounds.
 */
export function normalizedYToPrice(
  normalizedY: number,
  bounds: ChartPriceBounds
): number {
  if (!bounds || typeof bounds.minPrice !== "number" || typeof bounds.maxPrice !== "number") {
    throw new Error("ChartPriceBounds tidak valid.");
  }
  if (bounds.minPrice >= bounds.maxPrice) {
    throw new Error("minPrice harus lebih kecil dari maxPrice.");
  }

  const clampedY = clamp01(normalizedY);
  const priceRange = bounds.maxPrice - bounds.minPrice;
  // Inverted financial Y axis: y=0 is maxPrice, y=1 is minPrice
  const rawPrice = bounds.maxPrice - clampedY * priceRange;

  const decimals = Math.max(0, Math.min(6, bounds.decimals ?? 2));
  const factor = 10 ** decimals;
  return Math.round(rawPrice * factor) / factor;
}

/**
 * Converts a discrete financial price into a normalized Y coordinate [0.0, 1.0].
 */
export function priceToNormalizedY(
  price: number,
  bounds: ChartPriceBounds
): number {
  if (!bounds || typeof bounds.minPrice !== "number" || typeof bounds.maxPrice !== "number") {
    throw new Error("ChartPriceBounds tidak valid.");
  }
  if (bounds.minPrice >= bounds.maxPrice) {
    throw new Error("minPrice harus lebih kecil dari maxPrice.");
  }

  const priceRange = bounds.maxPrice - bounds.minPrice;
  const rawY = (bounds.maxPrice - price) / priceRange;
  const roundedY = Math.round(rawY * 1_000_000) / 1_000_000;
  return clamp01(roundedY);
}

// ── Transform & Inverse Coordinate Calculations ───────────────────

export interface ViewportTransform {
  zoom: number; // 1.0 to 3.0
  panX: number; // in pixels
  panY: number; // in pixels
}

/**
 * Maps a pointer event's viewport/client coordinates into stage coordinates
 * taking into account zoom (scale) and pan offset with transformOrigin = "0 0".
 *
 * Formula:
 *   stageX = (clientX - containerLeft - panX) / zoom
 *   stageY = (clientY - containerTop - panY) / zoom
 */
export function viewportToPointerStage(params: {
  clientX: number;
  clientY: number;
  containerRect: BoundingBox;
  stageDimensions: RectDimensions;
  transform: ViewportTransform;
}): {
  stageX: number;
  stageY: number;
  normalizedX: number;
  normalizedY: number;
  isInside: boolean;
} {
  const { clientX, clientY, containerRect, stageDimensions, transform } = params;
  const { zoom, panX, panY } = transform;

  if (zoom <= 0) {
    throw new Error("Zoom level harus lebih besar dari 0.");
  }
  if (stageDimensions.width <= 0 || stageDimensions.height <= 0) {
    return {
      stageX: 0,
      stageY: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
    };
  }

  // Pointer position relative to container
  const relX = clientX - containerRect.x;
  const relY = clientY - containerRect.y;

  // Inverse affine transform (origin 0 0)
  const stageX = (relX - panX) / zoom;
  const stageY = (relY - panY) / zoom;

  const normalizedX = clamp01(stageX / stageDimensions.width);
  const normalizedY = clamp01(stageY / stageDimensions.height);

  const isInside =
    stageX >= 0 &&
    stageX <= stageDimensions.width &&
    stageY >= 0 &&
    stageY <= stageDimensions.height;

  return {
    stageX,
    stageY,
    normalizedX,
    normalizedY,
    isInside,
  };
}

/**
 * Clamps pan offsets so the chart can never be dragged permanently out of the visible viewport.
 * At zoom = 1.0, pan is locked to (0, 0).
 * At zoom > 1.0, pan is bounded by the difference between scaled stage and container.
 */
export function clampPanOffset(params: {
  pan: Point2D;
  zoom: number;
  containerDimensions: RectDimensions;
  stageDimensions: RectDimensions;
}): Point2D {
  const { pan, zoom, containerDimensions, stageDimensions } = params;

  if (zoom <= 1.0) {
    return { x: 0, y: 0 };
  }

  const scaledWidth = stageDimensions.width * zoom;
  const scaledHeight = stageDimensions.height * zoom;

  // Maximum allowed pan shifts
  const maxPanX = 0;
  const minPanX = Math.min(0, containerDimensions.width - scaledWidth);

  const maxPanY = 0;
  const minPanY = Math.min(0, containerDimensions.height - scaledHeight);

  // Buffer so edge margin can be inspected (25% extra tolerance)
  const bufferX = containerDimensions.width * 0.25;
  const bufferY = containerDimensions.height * 0.25;

  const clampedX = Math.max(minPanX - bufferX, Math.min(maxPanX + bufferX, pan.x));
  const clampedY = Math.max(minPanY - bufferY, Math.min(maxPanY + bufferY, pan.y));

  return {
    x: Math.round(clampedX),
    y: Math.round(clampedY),
  };
}

/**
 * Clamps zoom strictly within [minZoom, maxZoom] (default [1.0, 3.0]).
 */
export function clampZoom(zoom: number, minZoom = 1.0, maxZoom = 3.0): number {
  if (!Number.isFinite(zoom)) return 1.0;
  const clamped = Math.max(minZoom, Math.min(maxZoom, zoom));
  return Math.round(clamped * 100) / 100;
}

/**
 * Formats a currency/commodity price with comma separation and exact decimal precision.
 */
export function formatPrice(price: number, decimals = 2): string {
  if (!Number.isFinite(price)) return "—";
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
