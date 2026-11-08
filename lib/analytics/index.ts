/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * PERFORMANCE ANALYTICS ENGINE (PAE) — PUBLIC BARREL EXPORTS
 *
 * Exposes pure analytical kernels, deterministic sequence models, and domain types:
 * - Core Metrics (Task 3.2 & 3.2.1): Win Rates, Profit Factor, Expectancy, R-Multiple
 * - Drawdown Engine (Task 3.3): Deterministic Trajectory, Peak-to-Trough, Epochs, Tri-State Capital
 * - Time-Series Engine (Task 3.3): Calendar Buckets, IANA Timezones, Sparse & Dense Series
 */

export * from "./analytics-types";
export * from "./core-metrics";
export * from "./drawdown-metrics";
export * from "./time-series-metrics";
export * from "./dimensional-slicer";
export * from "./analytics-orchestrator";


