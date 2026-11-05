/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * STUDENT TRADING JOURNAL & PERFORMANCE TRACKING
 * Domain Types & Schemas Specification (v2.1.1)
 */

// ── Enums & Literal Unions ───────────────────────────────────────

export type AccountType = "DEMO" | "LIVE" | "PROP_FIRM" | "PAPER";

export type TradeDirection = "LONG" | "SHORT";

export type TradeStatus = "OPEN" | "CLOSED" | "CANCELLED";

export type TradeOutcome = "WIN" | "LOSS" | "BREAKEVEN";

export type EmotionState =
  | "CONFIDENT"
  | "NEUTRAL"
  | "ANXIOUS"
  | "FOMO"
  | "REVENGE"
  | "DISCIPLINED"
  | "TIRED";

export type ExecutionMistake =
  | "CHASING"
  | "OVERLEVERAGING"
  | "EARLY_EXIT"
  | "WIDENING_SL"
  | "NO_PLAN"
  | "REVENGE_TRADING"
  | "FOMO_ENTRY"
  | "NONE";

export type MarketSession = "ASIA" | "LONDON" | "NEW_YORK" | "LONDON_NY_OVERLAP";

export type TimeFrame = "M1" | "M5" | "M15" | "H1" | "H4" | "D1" | "W1";

export type AttachmentType = "PRE_ENTRY" | "POST_EXIT";

export type DataQualityTag =
  | "CALCULATED_STANDARD"
  | "SELF_REPORTED_MANUAL"
  | "ESTIMATED_INCOMPLETE_FEES";

export type SampleStatus = "SUFFICIENT" | "INSUFFICIENT" | "NO_DATA";

export type CalculationStatus =
  | "VALID"
  | "ZERO_LOSSES"
  | "ZERO_DIVISOR"
  | "BLOCKED_MULTI_CURRENCY";

export type ReviewType = "DAILY" | "WEEKLY" | "MONTHLY";

export type ConsentScope = "FULL_JOURNAL" | "ANALYTICS_ONLY";

// ── Currency Configuration Dictionary ────────────────────────────

export const CURRENCY_DECIMALS_MAP: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  AUD: 2,
  CAD: 2,
  SGD: 2,
  CHF: 2,
  JPY: 0,
  IDR: 0,
  BHD: 3,
  KWD: 3,
};

export function getCurrencyDecimals(currency: string): number {
  const upper = (currency || "USD").toUpperCase();
  return CURRENCY_DECIMALS_MAP[upper] ?? 2;
}

// ── Core Domain Interfaces ───────────────────────────────────────

export interface TradeAttachment {
  id: string; // UUID
  type: AttachmentType;
  filename: string;
  filepath: string; // Relative to data/uploads/journals/[userId]/[tradeId]/
  mimeType: "image/webp";
  fileSizeBytes: number;
  dimensions: {
    width: number;
    height: number;
  };
  uploadedAt: string; // ISO 8601
}

export interface CashTransaction {
  id: string; // UUID
  accountId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number; // Stored as positive number (minor units or decimal float)
  transactionDate: string; // ISO 8601
  notes?: string;
  createdAt: string; // ISO 8601
}

export interface TradingAccount {
  id: string; // UUID (e.g. "acc-8f1a2b...")
  userId: string; // Owner
  accountName: string; // e.g. "FTMO $100K Challenge"
  brokerLabel?: string; // e.g. "IC Markets", "MetaTrader 5"
  accountCurrency: string; // ISO 4217: "USD", "IDR", "EUR", "GBP", "JPY"
  currencyDecimals: number; // e.g. USD=2, IDR=0, JPY=0, BHD=3
  accountType: AccountType;
  initialBalance: number; // Baseline starting balance
  realizedBalance: number; // Derived running balance
  equity: number; // realizedBalance + unrealizedPnl
  freeMargin?: number; // Optional equity minus margin
  isArchived: boolean; // Soft delete
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface TradeRecord {
  id: string; // UUID
  userId: string;
  accountId: string;
  pair: string; // e.g. "EURUSD", "XAUUSD", "BTCUSD"
  direction: TradeDirection;
  status: TradeStatus;
  entryDate: string; // ISO 8601
  exitDate?: string; // ISO 8601
  timeframe: TimeFrame;
  session: MarketSession;
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit?: number;
  positionSize: number; // Lot or contract volume (> 0)
  plannedRiskAmount?: number; // Stored positive currency value
  grossPnl?: number; // Realized gross P/L (> 0 win, < 0 loss)
  commission?: number; // Broker execution fee (>= 0)
  swap?: number; // Overnight financing (> 0 credit, < 0 debit)
  otherFees?: number; // Regulatory charges (>= 0)
  netPnl?: number; // grossPnl - commission + swap - otherFees
  realizedR?: number; // Multiple of initial risk
  outcome?: TradeOutcome;
  strategyId?: string;
  setupTags: string[];
  entryChecklist: Record<string, boolean>;
  emotion: EmotionState;
  mistake: ExecutionMistake;
  notes?: string;
  attachments: TradeAttachment[];
  dataQuality: DataQualityTag;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface PeriodicReview {
  id: string; // UUID
  userId: string;
  type: ReviewType;
  periodDate: string; // YYYY-MM-DD or YYYY-WW or YYYY-MM
  rating: number; // 1 to 5 scale
  wentWell: string;
  mistakesIdentified: string;
  actionItems: string;
  disciplineScore: number; // 1 to 10 scale
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CustomStrategy {
  id: string; // UUID
  userId: string;
  name: string;
  description: string;
  rules: string[];
  isArchived: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface StudentConsent {
  id: string; // UUID
  studentId: string; // Student granting permission
  granteeId: string; // Specific Mentor user ID OR "ALL_ACADEMY_MENTORS"
  granteeName: string; // Display name of mentor
  scope: ConsentScope;
  grantedAt: string; // ISO 8601
  expiresAt: string; // ISO 8601 (Max 90 days from grant)
  isRevoked: boolean;
  revokedAt?: string; // ISO 8601
}

// ── Partition Single Source of Truth (SSOT) ──────────────────────

export interface UserJournalPartition {
  schemaVersion: number; // Current version: 1
  userId: string;
  version: number; // Concurrency version counter
  accounts: TradingAccount[];
  cashTransactions: CashTransaction[];
  trades: TradeRecord[];
  reviews: PeriodicReview[];
  strategies: CustomStrategy[];
  consent: StudentConsent | null;
  totalAttachmentBytes: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ── Derived Index & Audit Logging ────────────────────────────────

export interface JournalIndexEntry {
  userId: string;
  accountCount: number;
  tradeCount: number;
  hasActiveConsent: boolean;
  totalAttachmentBytes: number;
  lastUpdated: string;
}

export interface JournalIndexSchema {
  version: number;
  generatedAt: string;
  users: Record<string, JournalIndexEntry>;
}

export interface JournalAuditRecord {
  id: string;
  timestamp: string; // ISO 8601
  actorId: string;
  actorRole: string;
  action: string; // e.g. "MENTOR_JOURNAL_INSPECT", "CONSENT_REVOKE"
  studentId: string;
  scope?: ConsentScope;
  ipHash?: string;
}

// ── Metric Envelope & Analytics Interfaces ───────────────────────

export interface MetricEnvelope<T> {
  value: T;
  dataQuality: DataQualityTag;
  sampleStatus: SampleStatus;
  calculationStatus: CalculationStatus;
  disclaimer: string;
}

// ── Storage Custom Errors ────────────────────────────────────────

export class JournalStorageError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "JournalStorageError";
    this.statusCode = statusCode;
  }
}

export class ConcurrencyConflictError extends JournalStorageError {
  constructor(message = "Concurrency conflict: Partition version mismatch.") {
    super(message, 409);
    this.name = "ConcurrencyConflictError";
  }
}

export class PartitionCorruptedError extends JournalStorageError {
  incidentId: string;
  constructor(
    message = "Partition corrupted and no valid backup available.",
    incidentId: string = `INC-${Date.now()}`
  ) {
    super(`RECOVERY_REQUIRED [${incidentId}]: ${message}`, 503);
    this.name = "PartitionCorruptedError";
    this.incidentId = incidentId;
  }
}

export class AccountTombstonedError extends JournalStorageError {
  constructor(message = "Account partition was permanently wiped (tombstoned).") {
    super(message, 410);
    this.name = "AccountTombstonedError";
  }
}

export class InvalidUserIdError extends JournalStorageError {
  constructor(message = "Invalid or malicious userId specified.") {
    super(message, 400);
    this.name = "InvalidUserIdError";
  }
}

