/**
 * SIGNAL CASPER ACADEMY — SPRINT 3
 * STUDENT TRADING JOURNAL & PERFORMANCE TRACKING
 * Trading Account & Journal Core Service Layer (v2.1.1)
 *
 * Implements:
 * - Trading account lifecycle (create, get, update, archive, restore)
 * - Trade journal CRUD (create, get, update, close, cancel, delete)
 * - Cash transactions (deposit, withdrawal)
 * - Strict financial data integrity & decimal precision
 * - Distinct balance derivation (initialBalance, cashBalance, realizedPnl, realizedBalance, equity)
 * - Concurrency protection via UserPartitionLock storage mutation
 * - Complete ownership isolation (user-scoped queries and mutations)
 */

import crypto from "node:crypto";
import type {
  TradingAccount,
  TradeRecord,
  CashTransaction,
  AccountType,
  TradeDirection,
  TradeStatus,
  TradeOutcome,
  TimeFrame,
  MarketSession,
  EmotionState,
  ExecutionMistake,
  DataQualityTag,
  UserJournalPartition,
} from "./journal-types";
import {
  getCurrencyDecimals,
  ConcurrencyConflictError,
  PartitionCorruptedError,
  AccountTombstonedError,
} from "./journal-types";

export {
  ConcurrencyConflictError,
  PartitionCorruptedError,
  AccountTombstonedError,
};
import type { WritePartitionOptions } from "./journal-storage";
import {
  mutateUserPartition,
  readUserPartitionLocked,
} from "./journal-storage";

// ── Custom Service Domain Errors ─────────────────────────────────

export class JournalServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "JournalServiceError";
    this.statusCode = statusCode;
  }
}

export class JournalValidationError extends JournalServiceError {
  constructor(message: string) {
    super(message, 422);
    this.name = "JournalValidationError";
  }
}

export class JournalNotFoundError extends JournalServiceError {
  constructor(message = "Requested journal resource was not found.") {
    super(message, 404);
    this.name = "JournalNotFoundError";
  }
}

export class JournalForbiddenError extends JournalServiceError {
  constructor(message = "Access to the requested journal entity is forbidden.") {
    super(message, 403);
    this.name = "JournalForbiddenError";
  }
}

// ── Precision Arithmetic & Integer Minor-Unit Engine ─────────────

/**
 * Maximum safe IEEE-754 integer precision boundary (2^53 - 1 = 9,007,199,254,740,991).
 */
export const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Calculates the maximum safe financial major amount for a given decimal scale
 * before IEEE-754 mantissa precision loss occurs upon conversion.
 */
export function getMaxSafeFinancialAmount(decimals: number): number {
  const factor = BigInt(10) ** BigInt(decimals);
  return Number(MAX_SAFE_INTEGER_BIGINT / factor);
}

/**
 * Converts a financial major amount (e.g. 10.50 USD) to integer minor units (e.g. 1050n cents)
 * using string/exponential parsing to prevent IEEE-754 binary floating-point representation jitter.
 * Performs symmetric half-up rounding at the sub-minor boundary and strictly validates safe limits.
 */
export function toMinorUnits(amount: number, decimals: number): bigint {
  if (typeof amount !== "number" || !Number.isFinite(amount) || isNaN(amount)) {
    throw new JournalValidationError(`Invalid financial numerical value: ${amount}`);
  }
  const abs = Math.abs(amount);
  const maxSafe = getMaxSafeFinancialAmount(decimals);
  if (abs > maxSafe) {
    throw new JournalValidationError(
      `Financial amount (${amount}) exceeds safe precision limit (${maxSafe}) for currency with ${decimals} decimals.`
    );
  }

  const sign = amount < 0 ? BigInt(-1) : BigInt(1);
  const str = abs.toString();
  let roundedInt: number;

  if (str.includes("e") || str.includes("E")) {
    if (abs < 1e-6) {
      return BigInt(0);
    }
    roundedInt = Math.round(abs * Math.pow(10, decimals));
  } else {
    roundedInt = Math.round(Number(abs + "e" + decimals));
  }

  return sign * BigInt(roundedInt);
}

/**
 * Converts integer minor units back to floating major currency units.
 * Strictly guarantees that minor units outside IEEE-754 safe integer bounds
 * throw an explicit error rather than silently losing least-significant digits.
 * Neutralizes negative zero (-0) to positive zero (0).
 */
export function toMajorUnits(minor: bigint, decimals: number): number {
  if (minor === BigInt(0)) return 0;
  const absMinor = minor < BigInt(0) ? -minor : minor;

  if (absMinor > MAX_SAFE_INTEGER_BIGINT) {
    throw new JournalValidationError(
      `Financial minor units (${minor.toString()}) exceed safe integer precision limit (${Number.MAX_SAFE_INTEGER}). Aggregated balance cannot be safely represented.`
    );
  }

  const sign = minor < BigInt(0) ? -1 : 1;
  if (decimals === 0) {
    const raw = sign * Number(absMinor);
    return raw === 0 ? 0 : raw;
  }

  const factor = BigInt(10) ** BigInt(decimals);
  const intPart = absMinor / factor;
  const fracPart = (absMinor % factor).toString().padStart(decimals, "0");
  const result = sign * Number(intPart.toString() + "." + fracPart);
  return result === 0 ? 0 : result;
}

/**
 * Calculates exact Net P/L using minor-unit arithmetic:
 * Net P/L = Gross P/L - commission + swap - otherFees
 */
export function calculateExactNetPnl(
  grossPnl: number,
  commission: number,
  swap: number,
  otherFees: number,
  decimals: number
): number {
  const g = toMinorUnits(grossPnl, decimals);
  const c = toMinorUnits(Math.abs(commission), decimals);
  const s = toMinorUnits(swap, decimals);
  const o = toMinorUnits(Math.abs(otherFees), decimals);
  const netMinor = g - c + s - o;
  return toMajorUnits(netMinor, decimals);
}

/**
 * Rounds a numerical value to a specified number of decimal places via integer minor units.
 */
export function roundToDecimals(value: number, decimals: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || isNaN(value)) return 0;
  return toMajorUnits(toMinorUnits(value, decimals), decimals);
}

/**
 * Rounds a financial amount according to the currency's decimal precision.
 */
export function roundCurrencyAmount(amount: number, currency: string): number {
  const decimals = getCurrencyDecimals(currency);
  return roundToDecimals(amount, decimals);
}

// ── Distinct Balance Derivation ───────────────────────────────────

export interface AccountBalanceSummary {
  accountId: string;
  currency: string;
  currencyDecimals: number;
  initialBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  cashBalance: number; // initialBalance + totalDeposits - totalWithdrawals
  realizedPnl: number; // sum of closed trades netPnl
  realizedBalance: number; // cashBalance + realizedPnl
  unrealizedPnl: number | null; // null if open trades exist without live broker feed; 0 if no open trades
  equity: number | null; // null if open trades exist without live market feed; equals realizedBalance when openTradesCount === 0
  equityDefinition: string; // Explains whether equity includes floating open trades or reflects settled baseline
  closedTradesCount: number;
  openTradesCount: number;
}

/**
 * Computes distinct financial balances for a trading account:
 * - initialBalance: Baseline capital configured by student
 * - cashBalance: initialBalance + sum(deposits) - sum(withdrawals)
 * - realizedPnl: sum of netPnl for all CLOSED trades
 * - realizedBalance: cashBalance + realizedPnl
 * - equity: realizedBalance + unrealizedPnl (when all positions closed; null if open trades exist without live broker feed)
 */
export function calculateAccountBalances(
  account: TradingAccount,
  cashTransactions: CashTransaction[],
  trades: TradeRecord[]
): AccountBalanceSummary {
  const currency = account.accountCurrency;
  const decimals = account.currencyDecimals;

  const relevantCash = cashTransactions.filter(
    (c) => c.accountId === account.id
  );
  const relevantTrades = trades.filter((t) => t.accountId === account.id);

  // Exact BigInt minor-unit aggregation: zero floating-point accumulation drift
  let totalDepositsMinor = BigInt(0);
  let totalWithdrawalsMinor = BigInt(0);
  for (const ctx of relevantCash) {
    if (ctx.type === "DEPOSIT") {
      totalDepositsMinor += toMinorUnits(ctx.amount, decimals);
    } else if (ctx.type === "WITHDRAWAL") {
      totalWithdrawalsMinor += toMinorUnits(ctx.amount, decimals);
    }
  }

  let realizedPnlMinor = BigInt(0);
  let closedTradesCount = 0;
  let openTradesCount = 0;

  for (const tr of relevantTrades) {
    if (tr.status === "CLOSED" && typeof tr.netPnl === "number") {
      realizedPnlMinor += toMinorUnits(tr.netPnl, decimals);
      closedTradesCount++;
    } else if (tr.status === "OPEN") {
      openTradesCount++;
    }
  }

  const initialBalanceMinor = toMinorUnits(account.initialBalance, decimals);
  const cashBalanceMinor =
    initialBalanceMinor + totalDepositsMinor - totalWithdrawalsMinor;
  const realizedBalanceMinor = cashBalanceMinor + realizedPnlMinor;

  const initialBalance = toMajorUnits(initialBalanceMinor, decimals);
  const totalDeposits = toMajorUnits(totalDepositsMinor, decimals);
  const totalWithdrawals = toMajorUnits(totalWithdrawalsMinor, decimals);
  const cashBalance = toMajorUnits(cashBalanceMinor, decimals);
  const realizedPnl = toMajorUnits(realizedPnlMinor, decimals);
  const realizedBalance = toMajorUnits(realizedBalanceMinor, decimals);

  // Open position policy: offline journal does not possess live broker streaming feeds.
  // When open trades exist, unrealized P/L is unknown (null) and equity is null.
  // When all positions are closed, unrealized P/L is exactly 0 and equity equals realized balance.
  let unrealizedPnl: number | null = null;
  let equity: number | null = null;
  let equityDefinition: string;

  if (openTradesCount === 0) {
    unrealizedPnl = 0;
    equity = realizedBalance;
    equityDefinition =
      "All positions are closed. Equity equals settled realized balance.";
  } else {
    unrealizedPnl = null;
    equity = null;
    equityDefinition = `Unrealized P/L is unavailable because offline journal does not connect to live market feeds. Equity cannot be computed for ${openTradesCount} open position(s). Settled realized balance is ${realizedBalance} ${currency}.`;
  }

  return {
    accountId: account.id,
    currency,
    currencyDecimals: decimals,
    initialBalance,
    totalDeposits,
    totalWithdrawals,
    cashBalance,
    realizedPnl,
    realizedBalance,
    unrealizedPnl,
    equity,
    equityDefinition,
    closedTradesCount,
    openTradesCount,
  };
}

function updateAccountBalancesInPartition(
  partition: UserJournalPartition,
  accountId: string
): void {
  const accIndex = partition.accounts.findIndex((a) => a.id === accountId);
  if (accIndex === -1) return;

  const summary = calculateAccountBalances(
    partition.accounts[accIndex],
    partition.cashTransactions,
    partition.trades
  );

  partition.accounts[accIndex] = {
    ...partition.accounts[accIndex],
    realizedBalance: summary.realizedBalance,
    // On the persistent TradingAccount schema, store settled baseline when open floating quotes are unavailable
    equity: summary.equity !== null ? summary.equity : summary.realizedBalance,
    updatedAt: new Date().toISOString(),
  };
}

// ── Trading Account Service ───────────────────────────────────────

export interface CreateTradingAccountInput {
  accountName: string;
  brokerLabel?: string;
  accountCurrency: string; // e.g. "USD", "IDR", "EUR"
  accountType: AccountType;
  initialBalance: number;
}

export interface UpdateTradingAccountInput {
  accountName?: string;
  brokerLabel?: string;
  accountCurrency?: string;
  accountType?: AccountType;
  initialBalance?: number;
}

/**
 * Creates a new trading account for the specified user.
 */
export async function createTradingAccount(
  userId: string,
  input: CreateTradingAccountInput,
  options?: WritePartitionOptions
): Promise<TradingAccount> {
  if (!input.accountName || input.accountName.trim().length === 0) {
    throw new JournalValidationError("Account name is required.");
  }
  if (input.accountName.trim().length > 100) {
    throw new JournalValidationError("Account name cannot exceed 100 characters.");
  }
  if (!input.accountCurrency || input.accountCurrency.trim().length === 0) {
    throw new JournalValidationError("Account currency is required.");
  }
  if (typeof input.initialBalance !== "number" || isNaN(input.initialBalance)) {
    throw new JournalValidationError("Initial balance must be a valid number.");
  }
  if (input.initialBalance < 0) {
    throw new JournalValidationError("Initial balance cannot be negative.");
  }

  const validAccountTypes: AccountType[] = ["DEMO", "LIVE", "PROP_FIRM", "PAPER"];
  if (!validAccountTypes.includes(input.accountType)) {
    throw new JournalValidationError(
      `Invalid account type: "${input.accountType}". Allowed: ${validAccountTypes.join(", ")}`
    );
  }

  const currency = input.accountCurrency.trim().toUpperCase();
  const decimals = getCurrencyDecimals(currency);
  const roundedInitial = roundToDecimals(input.initialBalance, decimals);
  const now = new Date().toISOString();

  const accountId = `acc-${crypto.randomUUID()}`;

  const newAccount: TradingAccount = {
    id: accountId,
    userId,
    accountName: input.accountName.trim(),
    brokerLabel: input.brokerLabel?.trim() || undefined,
    accountCurrency: currency,
    currencyDecimals: decimals,
    accountType: input.accountType,
    initialBalance: roundedInitial,
    realizedBalance: roundedInitial,
    equity: roundedInitial,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  return await mutateUserPartition(
    userId,
    (partition) => {
      // Check for duplicate active account name
      const duplicate = partition.accounts.some(
        (a) =>
          !a.isArchived &&
          a.accountName.toLowerCase() === newAccount.accountName.toLowerCase()
      );
      if (duplicate) {
        throw new JournalValidationError(
          `An active account with name "${newAccount.accountName}" already exists.`
        );
      }

      return {
        result: newAccount,
        updatedPartition: {
          ...partition,
          accounts: [...partition.accounts, newAccount],
        },
      };
    },
    options
  );
}

/**
 * Retrieves all trading accounts for the specified user.
 */
export async function getTradingAccounts(
  userId: string,
  options?: { includeArchived?: boolean }
): Promise<TradingAccount[]> {
  const partition = await readUserPartitionLocked(userId);
  let accounts = partition.accounts;
  if (!options?.includeArchived) {
    accounts = accounts.filter((a) => !a.isArchived);
  }

  // Recalculate derived running balances dynamically
  return accounts.map((acc) => {
    const summary = calculateAccountBalances(
      acc,
      partition.cashTransactions,
      partition.trades
    );
    return {
      ...acc,
      realizedBalance: summary.realizedBalance,
      equity: summary.equity !== null ? summary.equity : summary.realizedBalance,
    };
  });
}

/**
 * Retrieves a single trading account by ID.
 */
export async function getTradingAccountById(
  userId: string,
  accountId: string
): Promise<TradingAccount> {
  const partition = await readUserPartitionLocked(userId);
  const account = partition.accounts.find((a) => a.id === accountId);
  if (!account) {
    throw new JournalNotFoundError(`Trading account "${accountId}" was not found.`);
  }

  const summary = calculateAccountBalances(
    account,
    partition.cashTransactions,
    partition.trades
  );
  return {
    ...account,
    realizedBalance: summary.realizedBalance,
    equity: summary.equity !== null ? summary.equity : summary.realizedBalance,
  };
}

/**
 * Updates metadata of an existing trading account.
 */
export async function updateTradingAccount(
  userId: string,
  accountId: string,
  input: UpdateTradingAccountInput,
  options?: WritePartitionOptions
): Promise<TradingAccount> {
  return await mutateUserPartition(
    userId,
    (partition) => {
      const accIndex = partition.accounts.findIndex((a) => a.id === accountId);
      if (accIndex === -1) {
        throw new JournalNotFoundError(
          `Trading account "${accountId}" was not found.`
        );
      }

      const existing = partition.accounts[accIndex];

      if (existing.isArchived) {
        throw new JournalValidationError(
          "Archived account cannot be modified. Restore the account first."
        );
      }

      // Currency change business rule
      if (
        input.accountCurrency &&
        input.accountCurrency.trim().toUpperCase() !== existing.accountCurrency
      ) {
        const hasTrades = partition.trades.some((t) => t.accountId === accountId);
        const hasCash = partition.cashTransactions.some(
          (c) => c.accountId === accountId
        );
        if (hasTrades || hasCash) {
          throw new JournalValidationError(
            "Account currency cannot be modified after trades or cash transactions have been recorded."
          );
        }
      }

      if (input.accountName !== undefined) {
        if (!input.accountName || input.accountName.trim().length === 0) {
          throw new JournalValidationError("Account name cannot be empty.");
        }
      }

      if (input.initialBalance !== undefined) {
        if (typeof input.initialBalance !== "number" || isNaN(input.initialBalance)) {
          throw new JournalValidationError("Initial balance must be a valid number.");
        }
        if (input.initialBalance < 0) {
          throw new JournalValidationError("Initial balance cannot be negative.");
        }
      }

      const currency = input.accountCurrency
        ? input.accountCurrency.trim().toUpperCase()
        : existing.accountCurrency;
      const decimals = getCurrencyDecimals(currency);

      const updatedAccount: TradingAccount = {
        ...existing,
        accountName:
          input.accountName !== undefined
            ? input.accountName.trim()
            : existing.accountName,
        brokerLabel:
          input.brokerLabel !== undefined
            ? input.brokerLabel.trim() || undefined
            : existing.brokerLabel,
        accountCurrency: currency,
        currencyDecimals: decimals,
        accountType: input.accountType || existing.accountType,
        initialBalance:
          input.initialBalance !== undefined
            ? roundToDecimals(input.initialBalance, decimals)
            : existing.initialBalance,
        updatedAt: new Date().toISOString(),
      };

      const updatedAccounts = [...partition.accounts];
      updatedAccounts[accIndex] = updatedAccount;

      const updatedPartition: UserJournalPartition = {
        ...partition,
        accounts: updatedAccounts,
      };

      updateAccountBalancesInPartition(updatedPartition, accountId);

      return {
        result: updatedPartition.accounts[accIndex],
        updatedPartition,
      };
    },
    options
  );
}

/**
 * Archives a trading account (soft-delete).
 * Archived accounts are read-only and reject new trades or cash transactions.
 */
export async function archiveTradingAccount(
  userId: string,
  accountId: string,
  options?: WritePartitionOptions
): Promise<TradingAccount> {
  return await mutateUserPartition(
    userId,
    (partition) => {
      const accIndex = partition.accounts.findIndex((a) => a.id === accountId);
      if (accIndex === -1) {
        throw new JournalNotFoundError(
          `Trading account "${accountId}" was not found.`
        );
      }

      const existing = partition.accounts[accIndex];
      if (existing.isArchived) {
        return { result: existing };
      }

      const updatedAccount: TradingAccount = {
        ...existing,
        isArchived: true,
        updatedAt: new Date().toISOString(),
      };

      const updatedAccounts = [...partition.accounts];
      updatedAccounts[accIndex] = updatedAccount;

      return {
        result: updatedAccount,
        updatedPartition: {
          ...partition,
          accounts: updatedAccounts,
        },
      };
    },
    options
  );
}

/**
 * Restores an archived trading account.
 */
export async function restoreTradingAccount(
  userId: string,
  accountId: string,
  options?: WritePartitionOptions
): Promise<TradingAccount> {
  return await mutateUserPartition(
    userId,
    (partition) => {
      const accIndex = partition.accounts.findIndex((a) => a.id === accountId);
      if (accIndex === -1) {
        throw new JournalNotFoundError(
          `Trading account "${accountId}" was not found.`
        );
      }

      const existing = partition.accounts[accIndex];
      if (!existing.isArchived) {
        return { result: existing };
      }

      const updatedAccount: TradingAccount = {
        ...existing,
        isArchived: false,
        updatedAt: new Date().toISOString(),
      };

      const updatedAccounts = [...partition.accounts];
      updatedAccounts[accIndex] = updatedAccount;

      return {
        result: updatedAccount,
        updatedPartition: {
          ...partition,
          accounts: updatedAccounts,
        },
      };
    },
    options
  );
}

// ── Trade Journal Service ─────────────────────────────────────────

export interface CreateTradeInput {
  accountId: string;
  pair: string; // e.g. "EURUSD", "XAUUSD"
  direction: "BUY" | "SELL" | TradeDirection;
  status?: TradeStatus;
  entryDate: string; // ISO 8601
  exitDate?: string; // ISO 8601
  timeframe: TimeFrame;
  session: MarketSession;
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit?: number;
  positionSize: number; // Lot or contract volume (> 0)
  plannedRiskAmount?: number;
  grossPnl?: number;
  commission?: number;
  swap?: number;
  otherFees?: number;
  strategyId?: string;
  setupTags?: string[];
  entryChecklist?: Record<string, boolean>;
  emotion?: EmotionState;
  mistake?: ExecutionMistake;
  notes?: string;
  dataQuality?: DataQualityTag;
}

export interface UpdateTradeInput {
  pair?: string;
  direction?: "BUY" | "SELL" | TradeDirection;
  timeframe?: TimeFrame;
  session?: MarketSession;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  positionSize?: number;
  plannedRiskAmount?: number;
  grossPnl?: number;
  commission?: number;
  swap?: number;
  otherFees?: number;
  strategyId?: string;
  setupTags?: string[];
  entryChecklist?: Record<string, boolean>;
  emotion?: EmotionState;
  mistake?: ExecutionMistake;
  notes?: string;
  dataQuality?: DataQualityTag;
}

export interface CloseTradeInput {
  exitPrice: number;
  exitDate: string; // ISO 8601
  grossPnl: number; // Positive = win, negative = loss
  commission?: number; // >= 0
  swap?: number; // signed float
  otherFees?: number; // >= 0
  emotion?: EmotionState;
  mistake?: ExecutionMistake;
  notes?: string;
  dataQuality?: DataQualityTag;
}

export interface TradeFilterOptions {
  accountId?: string;
  status?: TradeStatus;
  direction?: TradeDirection;
  pair?: string;
  outcome?: TradeOutcome;
  strategyId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Normalizes buy/sell terminology into standard LONG/SHORT direction.
 */
function normalizeDirection(dir: string): TradeDirection {
  const upper = (dir || "").toUpperCase();
  if (upper === "BUY" || upper === "LONG") return "LONG";
  if (upper === "SELL" || upper === "SHORT") return "SHORT";
  throw new JournalValidationError(
    `Invalid direction: "${dir}". Allowed: LONG, SHORT, BUY, SELL.`
  );
}

/**
 * Validates ISO 8601 timestamp string.
 */
function assertValidTimestamp(isoString: string, fieldName: string): void {
  if (!isoString || typeof isoString !== "string") {
    throw new JournalValidationError(`${fieldName} must be a valid date string.`);
  }
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    throw new JournalValidationError(
      `${fieldName} is not a valid ISO 8601 date: "${isoString}".`
    );
  }
}

/**
 * Creates a new trade record in the user's journal.
 */
export async function createTrade(
  userId: string,
  input: CreateTradeInput,
  options?: WritePartitionOptions
): Promise<TradeRecord> {
  if (!input.accountId) {
    throw new JournalValidationError("Trade must specify an accountId.");
  }
  if (!input.pair || input.pair.trim().length === 0) {
    throw new JournalValidationError("Currency pair/instrument is required.");
  }

  const direction = normalizeDirection(input.direction);
  assertValidTimestamp(input.entryDate, "entryDate");

  if (typeof input.entryPrice !== "number" || input.entryPrice <= 0) {
    throw new JournalValidationError("entryPrice must be a positive number.");
  }
  if (typeof input.stopLoss !== "number" || input.stopLoss <= 0) {
    throw new JournalValidationError("stopLoss must be a positive number.");
  }
  if (typeof input.positionSize !== "number" || input.positionSize <= 0) {
    throw new JournalValidationError("positionSize must be a positive number.");
  }
  if (input.plannedRiskAmount !== undefined && input.plannedRiskAmount !== null) {
    if (
      typeof input.plannedRiskAmount !== "number" ||
      !Number.isFinite(input.plannedRiskAmount) ||
      input.plannedRiskAmount < 0
    ) {
      throw new JournalValidationError("plannedRiskAmount cannot be negative.");
    }
  }

  const status: TradeStatus = input.status || "OPEN";
  const now = new Date().toISOString();
  const tradeId = `trd-${crypto.randomUUID()}`;

  return await mutateUserPartition(
    userId,
    (partition) => {
      // Verify account ownership and active status
      const account = partition.accounts.find((a) => a.id === input.accountId);
      if (!account) {
        throw new JournalNotFoundError(
          `Trading account "${input.accountId}" was not found.`
        );
      }
      if (account.isArchived) {
        throw new JournalValidationError(
          `Cannot create trade: Trading account "${account.accountName}" is archived.`
        );
      }

      const decimals = account.currencyDecimals;

      let netPnl: number | undefined = undefined;
      let outcome: TradeOutcome | undefined = undefined;
      let grossPnl = input.grossPnl;
      let commission = input.commission !== undefined ? Math.abs(input.commission) : 0;
      let swap = input.swap !== undefined ? input.swap : 0;
      let otherFees = input.otherFees !== undefined ? Math.abs(input.otherFees) : 0;

      // Closed trade validation rules
      if (status === "CLOSED") {
        if (!input.exitDate) {
          throw new JournalValidationError("Closed trade must specify an exitDate.");
        }
        assertValidTimestamp(input.exitDate, "exitDate");

        if (new Date(input.exitDate) < new Date(input.entryDate)) {
          throw new JournalValidationError(
            "exitDate cannot be earlier than entryDate."
          );
        }
        if (typeof input.exitPrice !== "number" || input.exitPrice <= 0) {
          throw new JournalValidationError("Closed trade must specify a positive exitPrice.");
        }
        if (typeof grossPnl !== "number" || isNaN(grossPnl)) {
          throw new JournalValidationError("Closed trade must specify grossPnl.");
        }

        grossPnl = roundToDecimals(grossPnl, decimals);
        commission = roundToDecimals(commission, decimals);
        swap = roundToDecimals(swap, decimals);
        otherFees = roundToDecimals(otherFees, decimals);

        // Single non-overlapping fee scheme
        netPnl = calculateExactNetPnl(
          grossPnl,
          commission,
          swap,
          otherFees,
          decimals
        );
        outcome = netPnl > 0 ? "WIN" : netPnl < 0 ? "LOSS" : "BREAKEVEN";
      } else if (status === "OPEN") {
        // Open trade cannot have closed outcomes or realized/mark-to-market P/L
        outcome = undefined;
        netPnl = undefined;
        grossPnl = undefined;
        commission = 0;
        swap = 0;
        otherFees = 0;
      } else if (status === "CANCELLED") {
        outcome = undefined;
        netPnl = 0;
        grossPnl = 0;
      }

      // Prohibit unverified broker claim
      if ((input.dataQuality as unknown as string) === "VERIFIED_BROKER") {
        throw new JournalValidationError(
          "VERIFIED_BROKER data quality tag is not permitted for manual journal entries."
        );
      }
      const dataQuality: DataQualityTag =
        input.dataQuality === "ESTIMATED_INCOMPLETE_FEES"
          ? "ESTIMATED_INCOMPLETE_FEES"
          : "SELF_REPORTED_MANUAL";

      const newTrade: TradeRecord = {
        id: tradeId,
        userId,
        accountId: input.accountId,
        pair: input.pair.trim().toUpperCase(),
        direction,
        status,
        entryDate: input.entryDate,
        exitDate: status === "CLOSED" ? input.exitDate : undefined,
        timeframe: input.timeframe,
        session: input.session,
        entryPrice: input.entryPrice,
        exitPrice: status === "CLOSED" ? input.exitPrice : undefined,
        stopLoss: input.stopLoss,
        takeProfit: input.takeProfit,
        positionSize: input.positionSize,
        plannedRiskAmount:
          input.plannedRiskAmount !== undefined && input.plannedRiskAmount !== null
            ? roundToDecimals(input.plannedRiskAmount, decimals)
            : undefined,
        grossPnl,
        commission,
        swap,
        otherFees,
        netPnl,
        outcome,
        strategyId: input.strategyId,
        setupTags: Array.isArray(input.setupTags) ? input.setupTags : [],
        entryChecklist: input.entryChecklist || {},
        emotion: input.emotion || "NEUTRAL",
        mistake: input.mistake || "NONE",
        notes: input.notes,
        attachments: [],
        dataQuality,
        createdAt: now,
        updatedAt: now,
      };

      const updatedPartition: UserJournalPartition = {
        ...partition,
        trades: [...partition.trades, newTrade],
      };

      // Re-derive running account balances
      updateAccountBalancesInPartition(updatedPartition, input.accountId);

      return {
        result: newTrade,
        updatedPartition,
      };
    },
    options
  );
}

/**
 * Retrieves trades matching filter criteria.
 */
export async function getTrades(
  userId: string,
  filter?: TradeFilterOptions
): Promise<TradeRecord[]> {
  const partition = await readUserPartitionLocked(userId);
  let trades = partition.trades;

  if (filter?.accountId) {
    trades = trades.filter((t) => t.accountId === filter.accountId);
  }
  if (filter?.status) {
    trades = trades.filter((t) => t.status === filter.status);
  }
  if (filter?.direction) {
    trades = trades.filter((t) => t.direction === filter.direction);
  }
  if (filter?.pair) {
    trades = trades.filter(
      (t) => t.pair.toLowerCase() === filter.pair!.toLowerCase()
    );
  }
  if (filter?.outcome) {
    trades = trades.filter((t) => t.outcome === filter.outcome);
  }
  if (filter?.strategyId) {
    trades = trades.filter((t) => t.strategyId === filter.strategyId);
  }
  if (filter?.startDate) {
    const start = new Date(filter.startDate).getTime();
    trades = trades.filter((t) => new Date(t.entryDate).getTime() >= start);
  }
  if (filter?.endDate) {
    const end = new Date(filter.endDate).getTime();
    trades = trades.filter((t) => new Date(t.entryDate).getTime() <= end);
  }

  // Sort chronological descending by entryDate
  return trades.sort(
    (a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
  );
}

/**
 * Retrieves a single trade record by ID.
 */
export async function getTradeById(
  userId: string,
  tradeId: string
): Promise<TradeRecord> {
  const partition = await readUserPartitionLocked(userId);
  const trade = partition.trades.find((t) => t.id === tradeId);
  if (!trade) {
    throw new JournalNotFoundError(`Trade record "${tradeId}" was not found.`);
  }
  return trade;
}

/**
 * Updates an existing trade entry.
 */
export async function updateTrade(
  userId: string,
  tradeId: string,
  input: UpdateTradeInput,
  options?: WritePartitionOptions
): Promise<TradeRecord> {
  return await mutateUserPartition(
    userId,
    (partition) => {
      const trIndex = partition.trades.findIndex((t) => t.id === tradeId);
      if (trIndex === -1) {
        throw new JournalNotFoundError(`Trade record "${tradeId}" was not found.`);
      }

      const existing = partition.trades[trIndex];
      const account = partition.accounts.find((a) => a.id === existing.accountId);
      if (!account) {
        throw new JournalNotFoundError(
          `Trading account "${existing.accountId}" was not found.`
        );
      }
      if (account.isArchived) {
        throw new JournalValidationError(
          "Cannot modify trade belonging to an archived account."
        );
      }

      const decimals = account.currencyDecimals;

      let grossPnl =
        input.grossPnl !== undefined ? input.grossPnl : existing.grossPnl;
      let commission =
        input.commission !== undefined
          ? Math.abs(input.commission)
          : existing.commission || 0;
      let swap = input.swap !== undefined ? input.swap : existing.swap || 0;
      let otherFees =
        input.otherFees !== undefined
          ? Math.abs(input.otherFees)
          : existing.otherFees || 0;

      let netPnl = existing.netPnl;
      let outcome = existing.outcome;

      if (existing.status === "CLOSED" && typeof grossPnl === "number") {
        grossPnl = roundToDecimals(grossPnl, decimals);
        commission = roundToDecimals(commission, decimals);
        swap = roundToDecimals(swap, decimals);
        otherFees = roundToDecimals(otherFees, decimals);

        netPnl = calculateExactNetPnl(
          grossPnl,
          commission,
          swap,
          otherFees,
          decimals
        );
        outcome = netPnl > 0 ? "WIN" : netPnl < 0 ? "LOSS" : "BREAKEVEN";
      } else if (existing.status === "OPEN") {
        // Open trade cannot have floating P/L or outcome recorded in offline journal
        grossPnl = undefined;
        netPnl = undefined;
        outcome = undefined;
      }

      if ((input.dataQuality as unknown as string) === "VERIFIED_BROKER") {
        throw new JournalValidationError(
          "VERIFIED_BROKER data quality tag is not permitted for manual journal entries."
        );
      }
      const dataQuality = input.dataQuality || existing.dataQuality;

      if (input.plannedRiskAmount !== undefined && input.plannedRiskAmount !== null) {
        if (
          typeof input.plannedRiskAmount !== "number" ||
          !Number.isFinite(input.plannedRiskAmount) ||
          input.plannedRiskAmount < 0
        ) {
          throw new JournalValidationError("plannedRiskAmount cannot be negative.");
        }
      }

      const updatedTrade: TradeRecord = {
        ...existing,
        pair: input.pair ? input.pair.trim().toUpperCase() : existing.pair,
        direction: input.direction
          ? normalizeDirection(input.direction)
          : existing.direction,
        timeframe: input.timeframe || existing.timeframe,
        session: input.session || existing.session,
        entryPrice:
          input.entryPrice !== undefined ? input.entryPrice : existing.entryPrice,
        stopLoss:
          input.stopLoss !== undefined ? input.stopLoss : existing.stopLoss,
        takeProfit:
          input.takeProfit !== undefined
            ? input.takeProfit
            : existing.takeProfit,
        positionSize:
          input.positionSize !== undefined
            ? input.positionSize
            : existing.positionSize,
        plannedRiskAmount:
          input.plannedRiskAmount !== undefined
            ? input.plannedRiskAmount === null
              ? undefined
              : roundToDecimals(input.plannedRiskAmount, decimals)
            : existing.plannedRiskAmount,
        grossPnl,
        commission,
        swap,
        otherFees,
        netPnl,
        outcome,
        dataQuality,
        strategyId:
          input.strategyId !== undefined
            ? input.strategyId
            : existing.strategyId,
        setupTags: input.setupTags || existing.setupTags,
        entryChecklist: input.entryChecklist || existing.entryChecklist,
        emotion: input.emotion || existing.emotion,
        mistake: input.mistake || existing.mistake,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        updatedAt: new Date().toISOString(),
      };

      const updatedTrades = [...partition.trades];
      updatedTrades[trIndex] = updatedTrade;

      const updatedPartition: UserJournalPartition = {
        ...partition,
        trades: updatedTrades,
      };

      updateAccountBalancesInPartition(updatedPartition, existing.accountId);

      return {
        result: updatedTrade,
        updatedPartition,
      };
    },
    options
  );
}

/**
 * Closes an OPEN trade record, verifying execution parameters and computing realized P/L.
 */
export async function closeTrade(
  userId: string,
  tradeId: string,
  input: CloseTradeInput,
  options?: WritePartitionOptions
): Promise<TradeRecord> {
  assertValidTimestamp(input.exitDate, "exitDate");

  if (typeof input.exitPrice !== "number" || input.exitPrice <= 0) {
    throw new JournalValidationError("exitPrice must be a positive number.");
  }
  if (typeof input.grossPnl !== "number" || isNaN(input.grossPnl)) {
    throw new JournalValidationError("grossPnl must be a valid number.");
  }

  return await mutateUserPartition(
    userId,
    (partition) => {
      const trIndex = partition.trades.findIndex((t) => t.id === tradeId);
      if (trIndex === -1) {
        throw new JournalNotFoundError(`Trade record "${tradeId}" was not found.`);
      }

      const existing = partition.trades[trIndex];

      if (existing.status === "CLOSED") {
        throw new JournalValidationError(
          `Trade "${tradeId}" is already closed. Use updateTrade to amend details.`
        );
      }
      if (existing.status === "CANCELLED") {
        throw new JournalValidationError(
          `Cannot close trade "${tradeId}": Trade was cancelled.`
        );
      }

      if (new Date(input.exitDate) < new Date(existing.entryDate)) {
        throw new JournalValidationError(
          "exitDate cannot be earlier than entryDate."
        );
      }

      const account = partition.accounts.find((a) => a.id === existing.accountId);
      if (!account) {
        throw new JournalNotFoundError(
          `Trading account "${existing.accountId}" was not found.`
        );
      }
      if (account.isArchived) {
        throw new JournalValidationError(
          "Cannot close trade on an archived account."
        );
      }

      const decimals = account.currencyDecimals;
      const grossPnl = roundToDecimals(input.grossPnl, decimals);
      const commission =
        input.commission !== undefined
          ? roundToDecimals(Math.abs(input.commission), decimals)
          : existing.commission || 0;
      const swap =
        input.swap !== undefined
          ? roundToDecimals(input.swap, decimals)
          : existing.swap || 0;
      const otherFees =
        input.otherFees !== undefined
          ? roundToDecimals(Math.abs(input.otherFees), decimals)
          : existing.otherFees || 0;

      // Single fee deduction
      const netPnl = calculateExactNetPnl(
        grossPnl,
        commission,
        swap,
        otherFees,
        decimals
      );
      const outcome: TradeOutcome =
        netPnl > 0 ? "WIN" : netPnl < 0 ? "LOSS" : "BREAKEVEN";

      if ((input.dataQuality as unknown as string) === "VERIFIED_BROKER") {
        throw new JournalValidationError(
          "VERIFIED_BROKER data quality tag is not permitted for manual journal entries."
        );
      }

      const closedTrade: TradeRecord = {
        ...existing,
        status: "CLOSED",
        exitPrice: input.exitPrice,
        exitDate: input.exitDate,
        grossPnl,
        commission,
        swap,
        otherFees,
        netPnl,
        outcome,
        emotion: input.emotion || existing.emotion,
        mistake: input.mistake || existing.mistake,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        dataQuality:
          input.dataQuality === "ESTIMATED_INCOMPLETE_FEES"
            ? "ESTIMATED_INCOMPLETE_FEES"
            : "SELF_REPORTED_MANUAL",
        updatedAt: new Date().toISOString(),
      };

      const updatedTrades = [...partition.trades];
      updatedTrades[trIndex] = closedTrade;

      const updatedPartition: UserJournalPartition = {
        ...partition,
        trades: updatedTrades,
      };

      updateAccountBalancesInPartition(updatedPartition, existing.accountId);

      return {
        result: closedTrade,
        updatedPartition,
      };
    },
    options
  );
}

/**
 * Cancels an OPEN trade record.
 */
export async function cancelTrade(
  userId: string,
  tradeId: string,
  options?: WritePartitionOptions
): Promise<TradeRecord> {
  return await mutateUserPartition(
    userId,
    (partition) => {
      const trIndex = partition.trades.findIndex((t) => t.id === tradeId);
      if (trIndex === -1) {
        throw new JournalNotFoundError(`Trade record "${tradeId}" was not found.`);
      }

      const existing = partition.trades[trIndex];
      const account = partition.accounts.find((a) => a.id === existing.accountId);
      if (account && account.isArchived) {
        throw new JournalValidationError(
          "Cannot cancel trade belonging to an archived account."
        );
      }
      if (existing.status === "CLOSED") {
        throw new JournalValidationError("Cannot cancel an already closed trade.");
      }
      if (existing.status === "CANCELLED") {
        return { result: existing };
      }

      const cancelledTrade: TradeRecord = {
        ...existing,
        status: "CANCELLED",
        grossPnl: 0,
        netPnl: 0,
        outcome: undefined,
        updatedAt: new Date().toISOString(),
      };

      const updatedTrades = [...partition.trades];
      updatedTrades[trIndex] = cancelledTrade;

      const updatedPartition: UserJournalPartition = {
        ...partition,
        trades: updatedTrades,
      };

      updateAccountBalancesInPartition(updatedPartition, existing.accountId);

      return {
        result: cancelledTrade,
        updatedPartition,
      };
    },
    options
  );
}

/**
 * Permanently deletes a trade record.
 */
export async function deleteTrade(
  userId: string,
  tradeId: string,
  options?: WritePartitionOptions
): Promise<{ deleted: boolean; tradeId: string }> {
  return await mutateUserPartition(
    userId,
    (partition) => {
      const trIndex = partition.trades.findIndex((t) => t.id === tradeId);
      if (trIndex === -1) {
        throw new JournalNotFoundError(`Trade record "${tradeId}" was not found.`);
      }

      const existing = partition.trades[trIndex];
      const account = partition.accounts.find((a) => a.id === existing.accountId);
      if (account && account.isArchived) {
        throw new JournalValidationError(
          "Cannot delete trade belonging to an archived account."
        );
      }
      const accountId = existing.accountId;

      const updatedTrades = partition.trades.filter((t) => t.id !== tradeId);

      const updatedPartition: UserJournalPartition = {
        ...partition,
        trades: updatedTrades,
      };

      updateAccountBalancesInPartition(updatedPartition, accountId);

      return {
        result: { deleted: true, tradeId },
        updatedPartition,
      };
    },
    options
  );
}

// ── Cash Transaction Service ──────────────────────────────────────

export interface CreateCashTransactionInput {
  accountId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  transactionDate?: string;
  notes?: string;
}

export interface UpdateCashTransactionInput {
  amount?: number;
  transactionDate?: string;
  notes?: string;
}

/**
 * Logs a cash deposit or withdrawal on a trading account.
 */
export async function createCashTransaction(
  userId: string,
  input: CreateCashTransactionInput,
  options?: WritePartitionOptions
): Promise<CashTransaction> {
  if (!input.accountId) {
    throw new JournalValidationError("Cash transaction must specify an accountId.");
  }
  if (input.type !== "DEPOSIT" && input.type !== "WITHDRAWAL") {
    throw new JournalValidationError(
      `Invalid transaction type: "${input.type}". Must be DEPOSIT or WITHDRAWAL.`
    );
  }
  if (typeof input.amount !== "number" || isNaN(input.amount)) {
    throw new JournalValidationError("Transaction amount must be a valid number.");
  }
  if (input.amount <= 0) {
    throw new JournalValidationError("Transaction amount must be greater than zero.");
  }

  const transactionDate = input.transactionDate || new Date().toISOString();
  assertValidTimestamp(transactionDate, "transactionDate");

  const transactionId = `ctx-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  return await mutateUserPartition(
    userId,
    (partition) => {
      const account = partition.accounts.find((a) => a.id === input.accountId);
      if (!account) {
        throw new JournalNotFoundError(
          `Trading account "${input.accountId}" was not found.`
        );
      }
      if (account.isArchived) {
        throw new JournalValidationError(
          `Cannot record cash transaction: Account "${account.accountName}" is archived.`
        );
      }

      const decimals = account.currencyDecimals;
      const roundedAmount = roundToDecimals(input.amount, decimals);

      const newTransaction: CashTransaction = {
        id: transactionId,
        accountId: input.accountId,
        type: input.type,
        amount: roundedAmount,
        transactionDate,
        notes: input.notes?.trim() || undefined,
        createdAt: now,
      };

      const updatedPartition: UserJournalPartition = {
        ...partition,
        cashTransactions: [...partition.cashTransactions, newTransaction],
      };

      updateAccountBalancesInPartition(updatedPartition, input.accountId);

      return {
        result: newTransaction,
        updatedPartition,
      };
    },
    options
  );
}

/**
 * Retrieves cash transactions filtered by account ID.
 */
export async function getCashTransactions(
  userId: string,
  filter?: { accountId?: string }
): Promise<CashTransaction[]> {
  const partition = await readUserPartitionLocked(userId);
  let transactions = partition.cashTransactions;
  if (filter?.accountId) {
    transactions = transactions.filter((c) => c.accountId === filter.accountId);
  }
  return transactions.sort(
    (a, b) =>
      new Date(b.transactionDate).getTime() -
      new Date(a.transactionDate).getTime()
  );
}

/**
 * Updates an existing cash transaction.
 */
export async function updateCashTransaction(
  userId: string,
  transactionId: string,
  input: UpdateCashTransactionInput,
  options?: WritePartitionOptions
): Promise<CashTransaction> {
  return await mutateUserPartition(
    userId,
    (partition) => {
      const ctxIndex = partition.cashTransactions.findIndex(
        (c) => c.id === transactionId
      );
      if (ctxIndex === -1) {
        throw new JournalNotFoundError(
          `Cash transaction "${transactionId}" was not found.`
        );
      }

      const existing = partition.cashTransactions[ctxIndex];
      const account = partition.accounts.find((a) => a.id === existing.accountId);
      if (!account) {
        throw new JournalNotFoundError(
          `Trading account "${existing.accountId}" was not found.`
        );
      }
      if (account.isArchived) {
        throw new JournalValidationError(
          "Cannot modify cash transaction on an archived account."
        );
      }

      if (input.amount !== undefined) {
        if (typeof input.amount !== "number" || input.amount <= 0) {
          throw new JournalValidationError(
            "Transaction amount must be greater than zero."
          );
        }
      }

      if (input.transactionDate) {
        assertValidTimestamp(input.transactionDate, "transactionDate");
      }

      const decimals = account.currencyDecimals;
      const updatedTransaction: CashTransaction = {
        ...existing,
        amount:
          input.amount !== undefined
            ? roundToDecimals(input.amount, decimals)
            : existing.amount,
        transactionDate: input.transactionDate || existing.transactionDate,
        notes: input.notes !== undefined ? input.notes.trim() : existing.notes,
      };

      const updatedCash = [...partition.cashTransactions];
      updatedCash[ctxIndex] = updatedTransaction;

      const updatedPartition: UserJournalPartition = {
        ...partition,
        cashTransactions: updatedCash,
      };

      updateAccountBalancesInPartition(updatedPartition, existing.accountId);

      return {
        result: updatedTransaction,
        updatedPartition,
      };
    },
    options
  );
}

/**
 * Permanently deletes a cash transaction.
 */
export async function deleteCashTransaction(
  userId: string,
  transactionId: string,
  options?: WritePartitionOptions
): Promise<{ deleted: boolean; transactionId: string }> {
  return await mutateUserPartition(
    userId,
    (partition) => {
      const ctxIndex = partition.cashTransactions.findIndex(
        (c) => c.id === transactionId
      );
      if (ctxIndex === -1) {
        throw new JournalNotFoundError(
          `Cash transaction "${transactionId}" was not found.`
        );
      }

      const existing = partition.cashTransactions[ctxIndex];
      const account = partition.accounts.find((a) => a.id === existing.accountId);
      if (account && account.isArchived) {
        throw new JournalValidationError(
          "Cannot delete cash transaction belonging to an archived account."
        );
      }
      const accountId = existing.accountId;

      const updatedCash = partition.cashTransactions.filter(
        (c) => c.id !== transactionId
      );

      const updatedPartition: UserJournalPartition = {
        ...partition,
        cashTransactions: updatedCash,
      };

      updateAccountBalancesInPartition(updatedPartition, accountId);

      return {
        result: { deleted: true, transactionId },
        updatedPartition,
      };
    },
    options
  );
}
