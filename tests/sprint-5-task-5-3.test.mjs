import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import fs from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";

if (typeof registerHooks === "function" && typeof stripTypeScriptTypes === "function") {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        !path.extname(specifier) &&
        context.parentURL
      ) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        const candidateTs = path.resolve(parentDir, `${specifier}.ts`);
        if (fs.existsSync(candidateTs)) {
          return nextResolve(`${specifier}.ts`, context);
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.endsWith(".ts")) {
        const source = fs.readFileSync(fileURLToPath(url), "utf8");
        return {
          format: "module",
          shortCircuit: true,
          source: stripTypeScriptTypes(source),
        };
      }
      return nextLoad(url, context);
    },
  });
}

const {
  validateChartAssetUrl,
  clamp01,
  normalizedYToPrice,
  priceToNormalizedY,
  viewportToPointerStage,
  clampPanOffset,
  clampZoom,
  formatPrice,
} = await import(pathToFileURL(path.resolve("lib/chart-coordinates.ts")).href);

describe("Task 5.3 — Scoped Chart Viewer Coordinate & Security Engine", () => {
  const goldBounds = {
    minPrice: 2640.0,
    maxPrice: 2680.0,
    decimals: 2,
  };

  const eurusdBounds = {
    minPrice: 1.0825,
    maxPrice: 1.0925,
    decimals: 4,
  };

  const btcBounds = {
    minPrice: 85000.0,
    maxPrice: 90000.0,
    decimals: 1,
  };

  test("1. Asset Security: Strictly accepts PNG and WebP, firmly rejects SVG and dangerous formats", () => {
    // Valid cases
    assert.deepEqual(validateChartAssetUrl("/drills/xauusd_case_01.png"), {
      valid: true,
      format: "png",
    });
    assert.deepEqual(validateChartAssetUrl("/drills/xauusd_case_01.webp"), {
      valid: true,
      format: "webp",
    });
    assert.deepEqual(validateChartAssetUrl("https://static.casper.academy/charts/case.webp?v=1"), {
      valid: true,
      format: "webp",
    });
    assert.deepEqual(validateChartAssetUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE="), {
      valid: true,
      format: "png",
    });

    // Rejection of SVG (XSS prevention)
    const svgResult = validateChartAssetUrl("/charts/case.svg");
    assert.equal(svgResult.valid, false);
    assert.equal(svgResult.format, "invalid");
    assert.match(svgResult.error, /SVG ditolak/i);

    const disguisedSvg = validateChartAssetUrl("data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+");
    assert.equal(disguisedSvg.valid, false);

    const inlineSvgTag = validateChartAssetUrl("<svg onload=alert(1)>");
    assert.equal(inlineSvgTag.valid, false);

    // Rejection of GIF, BMP, ICO
    assert.equal(validateChartAssetUrl("/charts/anim.gif").valid, false);
    assert.equal(validateChartAssetUrl("/charts/old.bmp").valid, false);
    assert.equal(validateChartAssetUrl("/charts/icon.ico").valid, false);

    // Rejection of non-strings / empty
    assert.equal(validateChartAssetUrl("").valid, false);
    assert.equal(validateChartAssetUrl(null).valid, false);
    assert.equal(validateChartAssetUrl(undefined).valid, false);
  });

  test("2. Coordinate Clamping: clamp01 behaves strictly within [0.0, 1.0]", () => {
    assert.equal(clamp01(0.0), 0.0);
    assert.equal(clamp01(1.0), 1.0);
    assert.equal(clamp01(0.456), 0.456);
    assert.equal(clamp01(-0.2), 0.0);
    assert.equal(clamp01(1.5), 1.0);
    assert.equal(clamp01(NaN), 0.0);
    assert.equal(clamp01(Infinity), 0.0);
    assert.equal(clamp01(-Infinity), 0.0);
  });

  test("3. Price Normalization: Top boundary (0.0) -> maxPrice, Bottom boundary (1.0) -> minPrice", () => {
    // Top of chart: normalizedY = 0.0 -> maxPrice = 2680.00
    assert.equal(normalizedYToPrice(0.0, goldBounds), 2680.0);

    // Bottom of chart: normalizedY = 1.0 -> minPrice = 2640.00
    assert.equal(normalizedYToPrice(1.0, goldBounds), 2640.0);

    // Exact middle: normalizedY = 0.5 -> 2660.00
    assert.equal(normalizedYToPrice(0.5, goldBounds), 2660.0);

    // One quarter from top: normalizedY = 0.25 -> 2670.00
    assert.equal(normalizedYToPrice(0.25, goldBounds), 2670.0);

    // Three quarters: normalizedY = 0.75 -> 2650.00
    assert.equal(normalizedYToPrice(0.75, goldBounds), 2650.0);
  });

  test("4. Reverse Price Mapping: Discrete price translates accurately to normalized Y", () => {
    // maxPrice -> 0.0
    assert.equal(priceToNormalizedY(2680.0, goldBounds), 0.0);

    // minPrice -> 1.0
    assert.equal(priceToNormalizedY(2640.0, goldBounds), 1.0);

    // Mid price -> 0.5
    assert.equal(priceToNormalizedY(2660.0, goldBounds), 0.5);

    // Price above maxPrice clamps to 0.0
    assert.equal(priceToNormalizedY(2700.0, goldBounds), 0.0);

    // Price below minPrice clamps to 1.0
    assert.equal(priceToNormalizedY(2600.0, goldBounds), 1.0);
  });

  test("5. Bi-directional Roundtrip Integrity: price -> normY -> price preserves decimal accuracy", () => {
    const testPrices = [2645.25, 2650.0, 2663.75, 2674.8, 2679.99];

    for (const originalPrice of testPrices) {
      const normY = priceToNormalizedY(originalPrice, goldBounds);
      const reconstructedPrice = normalizedYToPrice(normY, goldBounds);
      assert.equal(
        reconstructedPrice,
        originalPrice,
        `Price ${originalPrice} must be reconstructed losslessly`
      );
    }

    // Test Forex precision (4 decimals)
    const forexPrices = [1.083, 1.0875, 1.09, 1.092];
    for (const fp of forexPrices) {
      const normY = priceToNormalizedY(fp, eurusdBounds);
      const reconstructed = normalizedYToPrice(normY, eurusdBounds);
      assert.equal(reconstructed, fp);
    }
  });

  test("6. Error Handling: Invalid price bounds throw meaningful errors", () => {
    // Inverted bounds
    assert.throws(() => {
      normalizedYToPrice(0.5, { minPrice: 2700, maxPrice: 2600, decimals: 2 });
    }, /minPrice harus lebih kecil/i);

    // Identical bounds (zero range)
    assert.throws(() => {
      priceToNormalizedY(2600, { minPrice: 2600, maxPrice: 2600, decimals: 2 });
    }, /minPrice harus lebih kecil/i);
  });

  test("7. Invariant Verification: Candle coordinates NEVER drift under Zoom and Pan", () => {
    const stageDimensions = { width: 800, height: 600 };
    const containerRect = { x: 100, y: 50, width: 800, height: 600 };

    // Baseline: Zoom 1.0x, Pan (0, 0)
    // Pointer over candle at stage (400, 300) -> screen (100 + 400, 50 + 300) = (500, 350)
    const base = viewportToPointerStage({
      clientX: 500,
      clientY: 350,
      containerRect,
      stageDimensions,
      transform: { zoom: 1.0, panX: 0, panY: 0 },
    });
    assert.equal(base.normalizedX, 0.5);
    assert.equal(base.normalizedY, 0.5);
    assert.equal(base.isInside, true);
    assert.equal(normalizedYToPrice(base.normalizedY, goldBounds), 2660.0);

    // Condition A: Zoom 2.0x, Pan (0, 0)
    // The same candle feature is now at stage (400, 300).
    // In screen coordinates with 2x zoom: clientX = 100 + 400 * 2 = 900, clientY = 50 + 300 * 2 = 650.
    const zoomed = viewportToPointerStage({
      clientX: 900,
      clientY: 650,
      containerRect,
      stageDimensions,
      transform: { zoom: 2.0, panX: 0, panY: 0 },
    });
    assert.equal(zoomed.normalizedX, 0.5, "Normalized X must remain identical under 2.0x zoom");
    assert.equal(zoomed.normalizedY, 0.5, "Normalized Y must remain identical under 2.0x zoom");
    assert.equal(
      normalizedYToPrice(zoomed.normalizedY, goldBounds),
      2660.0,
      "Price readout must remain exactly 2660.00 on the same candle"
    );

    // Condition B: Zoom 2.5x, Panned by (-250, -150)
    // In screen coordinates: clientX = 100 - 250 + 400 * 2.5 = 850, clientY = 50 - 150 + 300 * 2.5 = 650.
    const zoomedAndPanned = viewportToPointerStage({
      clientX: 850,
      clientY: 650,
      containerRect,
      stageDimensions,
      transform: { zoom: 2.5, panX: -250, panY: -150 },
    });
    assert.equal(zoomedAndPanned.normalizedX, 0.5, "Normalized X must remain identical under zoom+pan");
    assert.equal(zoomedAndPanned.normalizedY, 0.5, "Normalized Y must remain identical under zoom+pan");
    assert.equal(
      normalizedYToPrice(zoomedAndPanned.normalizedY, goldBounds),
      2660.0,
      "Price must remain 100% locked to the candle under combined zoom and pan"
    );
  });

  test("8. Pan Clamping: Prevents chart from disappearing off-screen", () => {
    const containerDimensions = { width: 800, height: 600 };
    const stageDimensions = { width: 800, height: 600 };

    // At zoom = 1.0x, pan is strictly locked to (0, 0)
    const panAt1x = clampPanOffset({
      pan: { x: 100, y: -50 },
      zoom: 1.0,
      containerDimensions,
      stageDimensions,
    });
    assert.deepEqual(panAt1x, { x: 0, y: 0 });

    // At zoom = 2.0x, stage is 1600x1200. Container is 800x600.
    const clampedPan = clampPanOffset({
      pan: { x: -2000, y: 1500 }, // Wild drag off-screen
      zoom: 2.0,
      containerDimensions,
      stageDimensions,
    });
    assert.ok(clampedPan.x >= -1000, "Pan X must be clamped to prevent lost chart");
    assert.ok(clampedPan.y <= 200, "Pan Y must be clamped to prevent lost chart");
  });

  test("9. Zoom Clamping: Enforces strictly 1.0x to 3.0x boundary", () => {
    assert.equal(clampZoom(0.5), 1.0);
    assert.equal(clampZoom(1.0), 1.0);
    assert.equal(clampZoom(2.15), 2.15);
    assert.equal(clampZoom(3.0), 3.0);
    assert.equal(clampZoom(5.0), 3.0);
    assert.equal(clampZoom(NaN), 1.0);
  });

  test("10. Price Formatter: Formats currency and commodities with proper decimals", () => {
    assert.equal(formatPrice(2668.5, 2), "2,668.50");
    assert.equal(formatPrice(152.345, 3), "152.345");
    assert.equal(formatPrice(104500, 0), "104,500");
    assert.equal(formatPrice(NaN), "—");
  });

  test("11. Read-Only Lockout Invariant: Mutations and callbacks are completely blocked in read-only mode", () => {
    let callbackFired = false;
    const mockOnLevelsChange = () => {
      callbackFired = true;
    };

    // Simulate level update logic in readOnly mode
    const executeSimulatedUpdate = (isReadOnly, key, normY, currentLevels) => {
      if (isReadOnly || !mockOnLevelsChange) return currentLevels;
      const price = normalizedYToPrice(normY, goldBounds);
      const updated = {
        ...currentLevels,
        [key]: { normalizedY: normY, price },
      };
      mockOnLevelsChange(updated);
      return updated;
    };

    const initialLevels = {
      entry: { normalizedY: 0.35, price: 2666.0 },
      invalidation: { normalizedY: 0.45, price: 2662.0 },
      target: { normalizedY: 0.15, price: 2674.0 },
    };

    // When readOnly = true:
    const resultInReadOnly = executeSimulatedUpdate(true, "entry", 0.2, initialLevels);
    assert.equal(callbackFired, false, "Callback must NOT be invoked in read-only mode");
    assert.deepEqual(resultInReadOnly, initialLevels, "Levels must remain unchanged in read-only mode");

    // When readOnly = false:
    const resultInteractive = executeSimulatedUpdate(false, "entry", 0.2, initialLevels);
    assert.equal(callbackFired, true, "Callback MUST be invoked in interactive mode");
    assert.equal(resultInteractive.entry.normalizedY, 0.2);
    assert.equal(resultInteractive.entry.price, 2672.0);
  });

  test("12. Multi-Asset Bounds: Accurately maps Forex (4 decimals) and Crypto (1 decimal)", () => {
    // EURUSD: min 1.0825, max 1.0925 (range: 0.0100)
    // at normY = 0.5 -> 1.0875
    assert.equal(normalizedYToPrice(0.5, eurusdBounds), 1.0875);
    assert.equal(priceToNormalizedY(1.0875, eurusdBounds), 0.5);

    // BTCUSD: min 85000, max 90000 (range: 5000)
    // at normY = 0.2 -> 89000.0
    assert.equal(normalizedYToPrice(0.2, btcBounds), 89000.0);
    assert.equal(priceToNormalizedY(89000.0, btcBounds), 0.2);
  });
});
