/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * PERFORMANCE ANALYTICS ENGINE — TASK 3.2
 * Core Metrics Domain Types & Result Contracts
 */

import type { DataQualityTag } from "../journal-types";

export type AnalyticsSampleStatus =
  | "SUFFICIENT"
  | "LIMITED"
  | "INSUFFICIENT"
  | "NO_DATA";

export type CalculationStatus =
  | "VALID"
  | "NO_DATA"
  | "ZERO_LOSSES"
  | "ZERO_PROFIT"
  | "ALL_BREAKEVEN"
  | "NO_RISK_DATA"
  | "BLOCKED_MULTI_CURRENCY";

export interface MetricEnvelope<T> {
  value: T;
  dataQuality: DataQualityTag;
  sampleStatus: AnalyticsSampleStatus;
  calculationStatus: CalculationStatus;
  disclaimer: string;
}

export interface WinRateResult {
  totalClosedTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRateAll: number | null; // (winning / total) * 100
  winRateDecisive: number | null; // (winning / (winning + losing)) * 100
  breakevenRate: number | null; // (breakeven / total) * 100
  calculationStatus: CalculationStatus;
}

export interface AvgWinLossResult {
  winningTrades: number;
  losingTrades: number;
  averageWin: number | null; // Strictly positive major units
  averageLossMagnitude: number | null; // Strictly positive magnitude in major units
  signedAverageLoss: number | null; // Negative or 0 major units
  winLossRatio: number | null; // averageWin / averageLossMagnitude
  calculationStatus: CalculationStatus;
}

export interface ProfitFactorResult {
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  calculationStatus: CalculationStatus;
}

export interface ExpectancyResult {
  totalNetPnl: number;
  totalClosedTrades: number;
  expectancy: number | null; // Per trade major units
  expectancyFormula1: number | null; // Direct aggregate mean: TotalNetPnl / N
  expectancyFormula2: number | null; // Component model: (Pw * AvgWin) - (Pl * AvgLoss)
  isFormulasReconciled: boolean;
  calculationStatus: CalculationStatus;
}

export interface RMultipleResult {
  totalTradesRecorded: number;
  rEligibleTradesCount: number; // Only trades where plannedRiskAmount > 0
  excludedTradesCount: number; // Trades where plannedRiskAmount is missing, null, or <= 0
  totalR: number | null;
  averageR: number | null;
  medianR: number | null;
  expectancyR: number | null;
  winRateR: number | null;
  avgWinR: number | null;
  avgLossMagnitudeR: number | null;
  calculationStatus: CalculationStatus;
}

export interface CoreMetricsSummary {
  currency: string;
  currencyDecimals: number;
  totalClosedTrades: number;
  totalNetPnl: number;
  grossProfit: number;
  grossLoss: number;
  winRates: WinRateResult;
  avgWinLoss: AvgWinLossResult;
  profitFactor: ProfitFactorResult;
  expectancy: ExpectancyResult;
  rMultiple: RMultipleResult;
  sampleStatus: AnalyticsSampleStatus;
  dataQualityDistribution: {
    calculatedStandard: number;
    selfReportedManual: number;
    estimatedIncompleteFees: number;
  };
  sampleDisclaimer: string;
}
