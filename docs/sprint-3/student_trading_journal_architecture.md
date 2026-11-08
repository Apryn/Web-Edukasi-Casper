# SIGNAL CASPER ACADEMY — SPRINT 3 — ARCHITECTURE SPECIFICATION (REFINED v2.1.1)
# STUDENT TRADING JOURNAL & PERFORMANCE TRACKING SYSTEM

**Document Version**: 2.1.1 (Final Technical Correction & Implementation Readiness Specification)  
**Status**: SUBMITTED FOR PRODUCT OWNER REVIEW & APPROVAL  
**Author**: Principal Software Architect, Database Architect, Financial Calculation Engineer & Application Security Architect  
**Project**: Signal Casper Academy (`d:\Developer\Web-Edukasi-Casper-main`)  
**Target Milestone**: Sprint 3 (Milestone: Self-Evaluation & Institutional Trading Journal)

---

## Document Revision Changelog

| Version | Date | Author | Summary of Changes from Previous Version |
|:---|:---|:---|:---|
| **1.0.0** | 2026-11-05 | Principal Architect | Initial draft covering basic 4-module concept and flat-file ideas. |
| **2.0.0** | 2026-11-05 | Senior Full-Stack Architect | Added partitioned JSON, multi-account concept, image upload pipeline, and privacy consent. |
| **2.1.0** | 2026-11-05 | Architecture & Security Board | Mutex queue concept, directory fsync, financial engine equations, image re-encoding, and audit store. |
| **2.1.1** | 2026-11-05 | Architecture & Security Board | **Critical Technical Corrections & Refinements:**<br>1. **Storage & Mutex Queue**: Corrected `UserPartitionLock` cleanup logic to compare against the exact stored `nextTail` Promise instance; guaranteed queue continuation on rejection using `.catch().then()`; explicitly documented single-process Node.js runtime boundary and prohibited uncoordinated multi-process clustering without distributed locking; separated Linux/POSIX directory `fsync` from Windows NTFS `renameSync` transactional semantics; defined crash recovery states (pre-rename vs post-rename); enforced strict `RECOVERY_REQUIRED` state (HTTP 503 + incident ID) without empty partition overwrites.<br>2. **Financial Engine**: Removed `VERIFIED_BROKER` status from initial release; established explicit single non-overlapping fee scheme ($\text{Net P/L} = \text{Gross P/L} - \text{commission} + \text{swap} - \text{otherFees}$); defined average net loss $\overline{L}_{\text{net}}$ as positive magnitude ($\overline{L}_{\text{net}} > 0$) with cost deducted once in Expectancy; replaced floating-point math with currency minor-unit integer/decimal-string arithmetic with per-currency decimal scales ($D_{\text{curr}}$); added Modified Dietz/Time-Weighted cashflow-adjusted MDD with numerical proof; decoupled metadata statuses (`dataQuality`, `sampleStatus`, `calculationStatus`); clarified $N \ge 20$ as an operational heuristic policy rather than statistical proof.<br>3. **Security & Upload**: Mandated streaming chunk byte-counter abortion (hard limit 5MB) regardless of `Content-Length`; added image dimension limits (max 3840x2160, max 8.3MP) to prevent decompression memory exhaustion; candidly clarified that WebP re-encoding strips metadata and malicious binary structures but does not mathematically eliminate all LSB pixel steganography; enforced upload quota tracking inside user mutex.<br>4. **Audit, Wipe & Data Lifecycle**: Clarified audit log append-only as application-enforced rather than hardware WORM; formalized 6-state wipe lifecycle with persistent `.tombstone` preventing stale backup rehydration; refined balance terminology (`realizedBalance`, `unrealizedPnl`, `equity`, `freeMargin`); enforced HTTP 422 on archived account mutations; strictly blocked multi-currency aggregations without verified exchange rates. |

---

## 1. Executive Summary

Signal Casper Academy is expanding from an institutional technical analysis Learning Management System (LMS) into a unified **Educational & Performance Self-Evaluation Platform**.

While mastery of technical concepts (Market Structure, Liquidity Sweeps, Fair Value Gaps, Order Blocks, and Risk-to-Reward optimization taught in Courses C1–C9) represents the cognitive foundation of trading, sustained profitability requires structured execution documentation, psychological regulation, and empirical performance analytics.

The **Student Trading Journal & Performance Tracking System** provides a secure, privacy-centric, mathematically rigorous analytical environment that allows students to:
1. Document trade setups with execution parameters, rationale, and multi-timeframe chart screenshots.
2. Track rule compliance, cognitive discipline, and recurring execution mistakes.
3. Compute mathematically verified performance metrics (Win Rate, Profit Factor, Expectancy, Maximum Drawdown, R-multiples) without misleading financial fabrications.
4. Manage multiple trading accounts with strict currency isolation.
5. Conduct structured Daily, Weekly, and Monthly reviews.
6. Grant explicit, auditable, and revocable consent to Academy Mentors for guided diagnostics.

### Core Philosophy & Boundary Constraints
- **Educational Self-Evaluation Only**: This platform is an analytical and introspective journal, **NOT** an automated execution bot, a broker mirror, a copy-trading service, or a trading signal generator.
- **Explicit Quality Tagging**: All analytics are explicitly labelled with data quality indicators (`CALCULATED_STANDARD`, `SELF_REPORTED_MANUAL`, or `ESTIMATED_INCOMPLETE_FEES`). Calculations are descriptive statistics based on entered parameters, not independently audited broker statements.
- **Privacy by Default (Zero Administrative Backdoors)**: Student journals are strictly confidential. Mentors, Admins, and Master Admins have **NO automatic access** to private student journals without explicit, auditable, grantee-specific, and revocable student consent.
- **Evidence-Based Insights**: Analytics require minimum statistical sample sizes ($N \ge 20$) before generating observations. Spurious causation (e.g. claiming a specific emotion "caused" a loss) is strictly avoided.

---

## 2. Existing System Audit & Architectural Context

```
+-----------------------------------------------------------------------------------+
|                        EXISTING APPLICATION ARCHITECTURE                          |
+-----------------------------------------------------------------------------------+
|  Runtime Environment:  Node.js v22.17.0 / Next.js 15.5.28 (App Router)            |
|  Server Engine:        Custom HTTP server.js (Reverse-proxy safe, IP hardening)   |
|  Deployment Model:     Single Node.js Process (Standalone or PM2 fork mode)       |
|  Authentication:       JWT in HTTP-only Cookie (`sc_auth_token`), bcrypt hashing  |
|  Access Control:       Role-based: USER (Student), MENTOR, ADMIN, MASTER_ADMIN    |
|  Database Engine:      Zero-dependency JSON flat-file storage (`lib/db.ts`)       |
|  Current DB File:      `data/academy.json` (users, course_progress, submissions)   |
|  Cache Mechanism:      Memory cache with mtimeMs + size-byte validation           |
|  Write Protocol:       Atomic tempfile write with `fsyncSync` + `renameSync`      |
|  Rate Limiting:        In-memory sliding window (`lib/rate-limit.ts`)             |
|  Design System:        Dark Cyber-Fintech (DM Sans, DM Mono, Cinzel, Lucide)     |
+-----------------------------------------------------------------------------------+
```

### Key Audit Findings & Architectural Impact:

1. **Next.js 15 App Router Conventions**:
   - Current routes use Next.js 15 App Router (`app/api/auth/*`, `app/api/admin/*`, `app/api/courses/*`, `app/api/progress/*`).
   - Server-side authentication relies on `getSessionUser(req)` from `lib/auth.ts`, extracting the JWT from request headers or `next/headers` cookies.
   - All Journal APIs will follow standard RESTful methods (`GET`, `POST`, `PUT`, `DELETE`), return standardized JSON payloads `{ success: true, data: ... }` or `{ error: string }`, and enforce strict HTTP status codes (`401`, `403`, `404`, `409`, `410`, `413`, `422`, `429`, `500`, `503`).

2. **Role Hierarchy & Privacy Boundary**:
   - Roles currently defined: `USER` (Students), `MENTOR` (Instructors), `ADMIN` (Curriculum & System Managers), `MASTER_ADMIN` (`apriyanriyan23@gmail.com`).
   - `auth.ts` provides `isAdmin(user)` and `isMentorOrAdmin(user)`.
   - **Crucial Architectural Principle**: Status as `ADMIN` or `MASTER_ADMIN` does **NOT** grant implicit rights to view private student journals. An independent permission gate (`StudentConsent`) must govern access.

3. **Database Engine & Monolithic Storage Limits**:
   - `lib/db.ts` currently stores all entities in a single `data/academy.json` file.
   - Storing high-volume trading journals inside `academy.json` would cause write latency, inflated backups, and write contention.
   - **Architecture**: The Journal System adopts **Partitioned Per-User Storage** (`data/journals/u_[userId].json`).

4. **Upload Infrastructure**:
   - Currently, no upload infrastructure exists; `public/` contains only static logo assets.
   - **Architecture**: Dedicated file upload handler using native `req.formData()`. Store validated image binaries on disk inside `data/uploads/journals/[userId]/[tradeId]/`, protected by an authenticated streaming proxy `/api/journal/attachments/[attachmentId]`.

5. **Design System & Styling**:
   - Aesthetic: Institutional Dark Cyber-Fintech.
   - Theme variables in `app/globals.css`:
     - Background: Deep void `#04070a`, secondary card `#080c10`, panel surface `#0d131b`, border `#162434` / `#243547`.
     - Accents: Institutional Cyan `#38bdf8`, Profit Emerald `#22c55e`, Loss Crimson `#f43f5e`, Warning Amber `#f59e0b`, Royal Purple `#a855f7`.
     - Fonts: `DM Sans` (UI Prose), `DM Mono` (Financial Tabular Data, Prices, P/L, Lot Sizes), `Cinzel` (Headings & Badges).

---

## 3. Storage Architecture & Concurrency Control

To achieve zero impact on the existing LMS and eliminate write contention between different users, the journal storage engine uses **Per-User File Partitioning** with an **In-Memory Mutex Queue**, **Atomic Writes**, and **Crash Recovery**.

```
d:\Developer\Web-Edukasi-Casper-main\data\
│
├── academy.json                  # Core LMS (Users, Course Progress, Quiz Submissions, Custom Courses)
├── backups\                      # Automated rotating snapshots
│   └── journals\                 # Per-user journal backup snapshots
│
├── journals\                     # Partitioned Journal Records (Isolated by User)
│   ├── index.json                # Derived directory index (Rebuildable from partitions)
│   ├── audit\                    # Dedicated Journal Audit Log Store (Application Append-Only)
│   │   └── journal_audit_[YYYY-MM].jsonl
│   ├── corrupted\                # Quarantined malformed partitions
│   │   └── u_[userId].corrupt.[timestamp].json
│   ├── u_[userId_A].json         # Private Journal Data for Student A (SSOT)
│   ├── u_[userId_B].json         # Private Journal Data for Student B (SSOT)
│   ├── u_[userId_C].tombstone    # Persistent Tombstone for Wiped Accounts
│   └── ...
│
└── uploads\
    └── journals\                 # Binary Chart Screenshot Attachments (WebP encoded)
        └── [userId]\
            └── [tradeId]\
                ├── pre_[attachmentId].webp
                └── post_[attachmentId].webp
```

### A. Per-User Mutation Queue (In-Memory Mutex Engine)

To prevent interleaved disk writes from concurrent HTTP requests for the same user, all read-modify-write operations must pass through an asynchronous per-user mutex lock.

```typescript
export class UserPartitionLock {
  // Map stores the current active tail Promise for each user
  private tails = new Map<string, Promise<unknown>>();

  /**
   * Enqueues a task sequentially behind any pending operations for the given userId.
   * Guarantees that previous task rejections do NOT block subsequent queued tasks.
   * Cleans up the Map entry when the queue becomes idle.
   */
  async acquire<T>(userId: string, task: () => Promise<T>): Promise<T> {
    const prevTail = this.tails.get(userId) || Promise.resolve();

    // Create the next tail promise that will execute after prevTail settles
    const nextTail = (async () => {
      // Absorb preceding failure to ensure queue continuation
      await prevTail.catch(() => {});
      return await task();
    })();

    // Register nextTail in the map as the current tail
    this.tails.set(userId, nextTail);

    // Cleanup: When nextTail completes, remove entry ONLY IF no newer task has updated the tail
    nextTail.finally(() => {
      if (this.tails.get(userId) === nextTail) {
        this.tails.delete(userId);
      }
    });

    return await nextTail;
  }
}
```

#### Runtime Boundary & Multi-Process Concurrency Limitation
> [!IMPORTANT]
> **Single-Process Constraint**: The in-memory mutex (`UserPartitionLock`) operates strictly within a single Node.js runtime process (the standard `server.js` standalone process or a single PM2 fork).  
> **Clustering Prohibition**: Multi-process clustering (e.g. `pm2 start -i max`) or multi-instance load balancing without distributed locks is **strictly prohibited** under this file architecture, as memory-space locks do not span across OS process boundaries. If multi-process clustering is required in future infrastructure milestones, an OS-level advisory file lock (`proper-lockfile`), distributed Redis mutex, or database engine migration (SQLite WAL / PostgreSQL) must be implemented.

### B. Single Source of Truth (SSOT) & Rebuildable Derived Index
- **Partition as SSOT**: Each user's partition file `u_[userId].json` is the sole authoritative Single Source of Truth for that user's accounts, trades, reviews, and consent.
- **Derived Index (`index.json`)**: Contains lightweight lookup metadata (account count, trade count, active consent flag). If `index.json` is deleted or corrupted, it can be regenerated at any time by scanning `data/journals/u_*.json`.

### C. Atomic Write Protocol & Cross-OS Durability
Every disk write to `u_[userId].json` follows a strict atomic sequence:
1. Verify schema and increment partition `version`.
2. Serialize JSON string with formatting.
3. Open temporary file in the same directory (`data/journals/.tmp.[pid].[timestamp].[rand].json`).
4. Write buffer to temporary file.
5. Call `fs.fsyncSync(fd)` on the temporary file to flush physical disk controller caches.
6. Close temporary file descriptor.
7. Atomic Replace: `fs.renameSync(tempPath, finalPartitionPath)`.
8. **OS-Specific Durability Handling**:
   - **Linux / POSIX**: Call `fs.openSync('data/journals', 'r')` and execute `fs.fsyncSync(dirFd)` to commit the directory entry rename to the filesystem journal, then close `dirFd`.
   - **Windows / NTFS**: Windows does not support `fsync` on directory handles (`EISDIR` / `EPERM`). Windows NTFS guarantees transactional file renaming via Win32 `SetFileInformationByHandle` (`FileRenameInfoEx` with `FILE_RENAME_REPLACE_IF_EXISTS`). On Windows, directory `fsync` is bypassed.
9. Update memory cache: `lastKnownMtimeMs` and `lastKnownSizeBytes`.

### D. Optimistic Concurrency Control
- All update operations accept an optional `expectedVersion`.
- Version validation is executed **inside the mutex lock** against the partition's currently loaded `version`.
- If `partition.version !== expectedVersion`, the service throws a `ConcurrencyConflictError` (`HTTP 409 Conflict`), preventing lost updates between multiple browser tabs.

### E. Crash Recovery States & `RECOVERY_REQUIRED`
- **Pre-Rename Crash**: A process crash prior to `renameSync` leaves an unlinked temporary file `.tmp.*`. The existing `u_[userId].json` remains completely intact and valid. A startup sweep purges dangling `.tmp.*` files older than 5 minutes.
- **Post-Rename Crash**: A process crash after `renameSync` leaves the new partition file fully committed.
- **Corrupted Partition Handling**: If a partition file fails JSON parsing or schema validation:
  1. The malformed file is quarantined to `data/journals/corrupted/u_[userId].corrupt.[timestamp].json`.
  2. The service attempts to locate the latest valid snapshot in `data/backups/journals/u_[userId].[timestamp].json`.
  3. If a valid backup is verified, it is restored and a `WARN` event is logged.
  4. **Strict Safety Gate**: If **NO valid backup exists**, the service **MUST NOT** silently overwrite with an empty partition. The partition state is marked `"RECOVERY_REQUIRED"`, returning `HTTP 503 Service Unavailable` with a dedicated incident ID, preserving all raw bits for administrative inspection.

---

## 4. Multi-Account Support & Balance Lifecycle

### A. Terminology & Balance Derivation
Trading accounts track financial state with explicit mathematical definitions:
- **`initialBalance`**: Baseline starting capital configured by the student.
- **`realizedBalance`**: The cash and closed-trade equity of the account:
  $$\text{realizedBalance} = \text{initialBalance} + \sum_{t \in \text{Closed Trades}} \text{netPnl}_t + \sum \text{Deposits} - \sum \text{Withdrawals}$$
- **`unrealizedPnl`**: Sum of mark-to-market floating profit/loss for all currently `OPEN` trades.
- **`equity`**: Net liquidating value:
  $$\text{equity} = \text{realizedBalance} + \text{unrealizedPnl}$$
- **`freeMargin`**: Available balance for new positions ($\text{equity} - \text{usedMargin}$).

```typescript
export type AccountType = "DEMO" | "LIVE" | "PROP_FIRM" | "PAPER";

export interface CashTransaction {
  id: string;                         // UUID
  accountId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;                     // Stored as positive minor units (cents)
  transactionDate: string;            // ISO 8601
  notes?: string;
  createdAt: string;
}

export interface TradingAccount {
  id: string;                         // UUID (e.g. "acc-8f1a2b...")
  userId: string;                     // Owner
  accountName: string;                // e.g. "FTMO $100K Challenge"
  brokerLabel?: string;               // e.g. "IC Markets", "MetaTrader 5"
  accountCurrency: string;            // ISO 4217: "USD", "IDR", "EUR", "GBP", "JPY"
  currencyDecimals: number;           // e.g. USD=2, IDR=0, JPY=0, BHD=3
  accountType: AccountType;
  initialBalance: number;             // Minor units or float clamped to currencyDecimals
  realizedBalance: number;            // Derived running realized balance
  equity: number;                     // realizedBalance + unrealizedPnl
  isArchived: boolean;                // Soft delete
  createdAt: string;                  // ISO 8601
  updatedAt: string;                  // ISO 8601
}
```

### B. Lifecycle & Archive Rules
- **Archived Accounts**: Existing historical trades remain readable for retrospective review. Creating new trades or updating trades on an archived account is rejected with `HTTP 422 Unprocessable Entity`.
- **Historical Trade Mutations**: Editing a historical closed trade's P/L recalculates the account's derived balance and invalidates cached analytics.
- **Account Deletion**: Only allowed if total trades linked to the account is zero. Accounts with trade history can only be archived.
- **Multi-Currency Isolation**: Accounts with different currencies (e.g. USD and IDR) **MUST NEVER** be summed into a single aggregate balance without an authorized exchange rate feed. In Sprint 3, cross-currency portfolio aggregation is rejected with `calculationStatus: "BLOCKED_MULTI_CURRENCY"`.

---

## 5. Financial Calculation Engine Specification

### A. Sign & Polarity Conventions
A single, unambiguous non-overlapping fee scheme governs all trade calculations:

| Metric Parameter | Data Type | Sign / Polarity Rule | Description |
|:---|:---:|:---:|:---|
| `entryPrice`, `exitPrice` | Positive Decimal | $> 0$ | Execution prices. |
| `positionSize` | Positive Decimal | $> 0$ | Lot or contract volume. |
| `grossPnl` | Decimal | Positive = Profit ($> 0$)<br>Negative = Loss ($< 0$) | Realized P/L prior to transaction costs. |
| `commission` | Positive Decimal | $\ge 0$ | Broker execution commission (always positive magnitude). |
| `swap` | Signed Decimal | Positive = Credit / Earning ($> 0$)<br>Negative = Financing Debit ($< 0$) | Overnight rollover financing. |
| `otherFees` | Positive Decimal | $\ge 0$ | Regulatory or platform charges. |
| `netPnl` | Decimal | $\text{Gross P/L} - \text{commission} + \text{swap} - \text{otherFees}$ | Final realized bottom-line return. |

### B. Arithmetic Precision & Decimal Representation Strategy
To prevent IEEE 754 binary floating-point errors (such as `0.1 + 0.2 = 0.30000000000000004`):
1. **Currency Minor-Units / Decimal Scale**: Every currency defines an explicit decimal scale $D_{\text{curr}}$:
   - `USD`, `EUR`, `GBP`, `AUD`, `CAD`, `SGD`, `CHF`: $D_{\text{curr}} = 2$
   - `IDR`, `JPY`: $D_{\text{curr}} = 0$
   - `BHD`, `KWD`: $D_{\text{curr}} = 3$
2. **Precision Rounding Helper**:
   Financial calculations use exact decimal rounding:
   ```typescript
   export function roundToCurrency(amount: number, currency: string = "USD"): number {
     const decimals = getCurrencyDecimals(currency);
     const factor = Math.pow(10, decimals);
     return Math.round((amount + Number.EPSILON) * factor) / factor;
   }
   ```
3. **Price Precision**:
   - Standard Forex: 5 decimal places (`pip = 0.0001`, `pipette = 0.00001`).
   - JPY Pairs: 3 decimal places (`pip = 0.01`, `pipette = 0.001`).
   - XAUUSD / Gold: 2 decimal places (`tick = 0.01`).
   - Crypto: up to 8 decimal places.
4. **Instrument Specifications & Manual Fallback**:
   Instruments have broker-configurable specifications (contract size, tick size, tick value). For exotic pairs or when specifications are unavailable, the student must manually enter realized P/L, which is tagged `SELF_REPORTED_MANUAL`.

### C. Exact Mathematical Formulas

#### 1. Realized Net P/L
$$\text{Net P/L} = \text{roundToCurrency}(\text{Gross P/L} - \text{commission} + \text{swap} - \text{otherFees}, \text{currency})$$

#### 2. Win Rate ($WR$), Loss Rate ($LR$) & Breakeven Rate ($BR$)
- **Population**: Evaluates only closed trades ($N_{\text{closed}}$). Open and cancelled trades are excluded.
- **Zero Closed Trades**: If $N_{\text{closed}} == 0$, $WR = \text{null}$ (UI renders `"N/A"`), NOT $0.0\%$.
- **Formulas**:
  $$WR = \left( \frac{N_{\text{win}}}{N_{\text{closed}}} \right) \times 100$$
  $$LR = \left( \frac{N_{\text{loss}}}{N_{\text{closed}}} \right) \times 100$$
  $$BR = \left( \frac{N_{\text{breakeven}}}{N_{\text{closed}}} \right) \times 100$$
  *(Where $N_{\text{win}}$ has $\text{netPnl} > 0$, $N_{\text{loss}}$ has $\text{netPnl} < 0$, and $N_{\text{breakeven}}$ has $\text{netPnl} == 0$)*.

#### 3. Average Net Win ($\overline{W}_{\text{net}}$) & Average Net Loss ($\overline{L}_{\text{net}}$)
$$\overline{W}_{\text{net}} = \frac{\sum_{i \in \text{Wins}} \text{netPnl}_i}{N_{\text{win}}} \quad (\text{if } N_{\text{win}} == 0 \to \text{null})$$
$$\overline{L}_{\text{net}} = \frac{\sum_{j \in \text{Losses}} |\text{netPnl}_j|}{N_{\text{loss}}} \quad (\text{if } N_{\text{loss}} == 0 \to \text{null})$$
*(Note: $\overline{L}_{\text{net}}$ is explicitly defined as a positive magnitude $> 0$)*.

#### 4. Profit Factor ($PF$)
$$PF = \frac{\sum_{i \in \text{Wins}} \text{grossPnl}_i}{\sum_{j \in \text{Losses}} |\text{grossPnl}_j|}$$
- **Zero Losses Guardrail**: If Gross Loss $== 0$ and Gross Profit $> 0$, return `calculationStatus: "ZERO_LOSSES"` and $PF = \text{null}$ (UI renders `"Undefined (Zero Losses)"`). Never assign arbitrary finite numbers like 99.9.
- If Gross Loss $== 0$ and Gross Profit $== 0$, return $PF = 0.00$.

#### 5. Mathematical Expectancy ($E$)
Because $\overline{W}_{\text{net}}$ and $\overline{L}_{\text{net}}$ are computed from Net P/L, transaction costs are deducted once:
$$E_{\$} = \left( \frac{WR}{100} \times \overline{W}_{\text{net}} \right) - \left( \frac{LR}{100} \times \overline{L}_{\text{net}} \right)$$
$$E_R = \frac{\sum_{k=1}^{N_{\text{valid\_risk}}} \text{Realized R}_k}{N_{\text{valid\_risk}}}$$

#### 6. Maximum Peak-to-Trough Drawdown ($MDD$) with Cashflow Policy
To ensure that deposits do not mask a drawdown and withdrawals do not artificially trigger one, the engine tracks a cashflow-adjusted equity index:

1. Trades and cashflows are ordered chronologically by `timestamp` ASC.
2. At each event $t$:
   $$\text{Equity}_t = \text{Equity}_{t-1} + \text{netPnl}_t + \text{Deposit}_t - \text{Withdrawal}_t$$
3. Peak equity is adjusted for net capital inflows:
   $$\text{Peak}_t = \max(\text{Peak}_{t-1} + \text{Deposit}_t - \text{Withdrawal}_t, \text{Equity}_t)$$
   $$DD_{\$, t} = \max(0, \text{Peak}_t - \text{Equity}_t)$$
   $$DD_{\%, t} = \begin{cases} 0 & \text{if } \text{Peak}_t \le 0 \\ \left( \frac{DD_{\$, t}}{\text{Peak}_t} \right) \times 100 & \text{if } \text{Peak}_t > 0 \end{cases}$$
4. **Negative Equity Guardrail**: If $\text{Equity}_t \le 0$, $DD_{\%, t}$ is clamped to $100.0\%$, and the account status is tagged `ACCOUNT_DEPLETED`.
5. $MDD_{\$} = \max_t(DD_{\$, t})$, $MDD_{\%} = \max_t(DD_{\%, t})$.

**Numerical Proof Example**:
- Starting Balance: \$10,000. Peak = \$10,000.
- Trade 1: Loss -\$1,000. Equity = \$9,000. Drawdown = \$1,000 (10%).
- Cashflow: Deposit +\$5,000. Equity = \$14,000. Adjusted Peak = \$10,000 + \$5,000 = \$15,000.  
  Drawdown remains: \$15,000 - \$14,000 = \$1,000 (6.67%). The deposit does **not** reset or hide the \$1,000 trading loss.
- Trade 2: Win +\$2,000. Equity = \$16,000. New Peak = \$16,000. Drawdown = \$0.

---

## 6. Image Storage & Screenshot Upload Engine

```
+-----------------------------------------------------------------------------------------+
|                              IMAGE STORAGE ARCHITECTURE                                 |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|   1. Stream Byte Limiter (Pre-Stream & Streaming Guard)                                 |
|      ├── Check `Content-Length`: If > 5MB, immediately reject HTTP 413                  |
|      └── Stream Chunk Counter: Accumulate bytes read; if > 5MB, destroy stream & 413    |
|                                                                                         |
|   2. Upload Request (POST /api/journal/attachments)                                     |
|      ├── Max 2 Primary Screenshots per trade: PRE_ENTRY and POST_EXIT                   |
|      ├── Quota Check: Sum(user uploads) + size <= 150MB (checked inside user mutex)     |
|      └── Multipart payload with `file`, `tradeId`, `type`                               |
|                                                                                         |
|   3. Multi-Stage Validation Pipeline                                                    |
|      ├── Stage A: Ownership Check (Verify `tradeId` belongs to caller's `userId`)       |
|      ├── Stage B: Extension Check (.jpg, .jpeg, .png, .webp only)                       |
|      ├── Stage C: Magic-Byte Header Check (Verify binary magic numbers)                 |
|      ├── Stage D: Dimension & Bomb Guard (Max 3840x2160, Max 8.3 Megapixels)            |
|      └── Stage E: Re-Encoding Pipeline (Decode to raw pixels & re-encode clean WebP)    |
|                                                                                         |
|   4. Secure Storage Pipeline                                                            |
|      ├── Directory: `data/uploads/journals/[userId]/[tradeId]/`                         |
|      ├── Sanitized Filename: `[type]_[uuid].webp` (Extension strictly matches encoding) |
|      └── Stored outside public web root; zero direct unauthenticated HTTP access        |
|                                                                                         |
|   5. Streaming Delivery Proxy (GET /api/journal/attachments/[attachmentId])             |
|      ├── Verification Gate: Caller is Owner OR Caller is Grantee with ACTIVE consent    |
|      ├── Headers: `Cache-Control: private, no-store, must-revalidate`                   |
|      └── Reject all unauthorized requests with HTTP 403 Forbidden                       |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

### A. Memory Protection & Decompression Bomb Guard
- **Streaming Abortion**: Regardless of whether `Content-Length` is present or spoofed, the multipart parser streams chunks through a byte counter. If accumulated bytes exceed 5,242,880 bytes (5MB), the connection is destroyed immediately (`req.destroy()`) and returns `HTTP 413 Payload Too Large`.
- **Dimension Check**: Prior to full bitmap memory decompression, image headers are inspected to verify dimensions $\le 3840 \times 2160$ and total pixels $\le 8,294,400$. Images exceeding limits are rejected immediately to protect against image decompression bombs.

### B. Re-Encoding Reality & Steganography Boundaries
- Incoming image buffers are decoded to raw pixel arrays and re-encoded to WebP format with metadata stripping.
- **Steganography Boundary**: Re-encoding strips EXIF metadata, ICC profiles, trailing binary payloads, and script polyglots. However, the system candidly documents that re-encoding does **not** provide a mathematical guarantee against advanced least-significant-bit (LSB) pixel-level steganography.
- **Upload Quota**: Enforced at 150MB total per user. Current cumulative disk usage is validated and updated **inside the user mutex** to eliminate concurrency race conditions.

---

## 7. Privacy, Consent & Mentorship Security Architecture

### A. Explicit Grantee Consent Model
Consent is granted to a specific mentor or the verified mentor pool:

```typescript
export interface StudentConsent {
  id: string;                         // UUID
  studentId: string;                  // Student granting permission
  granteeId: string;                  // Specific Mentor user ID OR "ALL_ACADEMY_MENTORS"
  granteeName: string;                // Display name of mentor
  scope: "FULL_JOURNAL" | "ANALYTICS_ONLY";
  grantedAt: string;                  // ISO 8601
  expiresAt: string;                  // ISO 8601 (Max 90 days from grant)
  isRevoked: boolean;
  revokedAt?: string;
}
```

### B. Access Gatekeeper Logic
```typescript
export function verifyMentorJournalAccess(
  mentorUser: SafeUser | DbUser,
  consent: StudentConsent | null | undefined
): { allowed: boolean; status: number; error?: string } {
  if (!consent || consent.isRevoked) {
    return { allowed: false, status: 403, error: "Akses ditolak: Izin peninjauan jurnal tidak aktif atau telah dicabut." };
  }
  if (new Date() > new Date(consent.expiresAt)) {
    return { allowed: false, status: 403, error: "Akses ditolak: Masa berlaku izin peninjauan telah kedaluwarsa." };
  }
  if (consent.granteeId !== "ALL_ACADEMY_MENTORS" && consent.granteeId !== mentorUser.id) {
    return { allowed: false, status: 403, error: "Akses ditolak: Anda bukan mentor yang ditunjuk oleh siswa." };
  }
  return { allowed: true, status: 200 };
}
```

### C. Dedicated Journal Audit Storage (`data/journals/audit/`)
To prevent journal activity from bloating core `academy.json`:
- Audit logs are stored in monthly JSON Lines files:
  `data/journals/audit/journal_audit_[YYYY-MM].jsonl`.
- Structure:
  ```json
  {"id":"aud-99182","timestamp":"2026-11-05T09:40:00.000Z","actorId":"mentor-uuid","actorRole":"MENTOR","action":"MENTOR_JOURNAL_INSPECT","studentId":"student-uuid","scope":"FULL_JOURNAL","ipHash":"sha256-hash"}
  ```
- **Audit Store Reality**: Append-only behavior is an **application-enforced policy** (opened with flag `'a'`). It is not a hardware-enforced WORM or OS-immutable file.
- **Privacy Minimization**: Audit logs store only operational metadata (actor, student, timestamp, action). Personal trade notes, setups, and screenshot paths are strictly excluded.

### D. Permanent Wipe Protocol & Tombstone Lifecycle
When a student initiates permanent account wipe (`POST /api/journal/danger-zone/wipe`):
1. State Machine:
   `ACTIVE` $\longrightarrow$ `WIPE_INITIATED` $\longrightarrow$ `ATTACHMENTS_PURGED` $\longrightarrow$ `PARTITION_PURGED` $\longrightarrow$ `BACKUPS_PURGED` $\longrightarrow$ `TOMBSTONE_COMMITTED`.
2. Verifies student password confirmation.
3. Unlinks all attachments in `data/uploads/journals/[userId]/`.
4. Removes partition file `data/journals/u_[userId].json`.
5. Unlinks historical snapshots `data/backups/journals/u_[userId].*.json`.
6. Commits persistent tombstone file `data/journals/u_[userId].tombstone` containing `{ userId, wipedAt, reason: "STUDENT_REQUESTED_PERMANENT_WIPE" }`.
7. **Tombstone Enforcement**: If a tombstone exists, all future attempts to rehydrate or restore backups for this `userId` are rejected with `HTTP 410 Gone`.

---

## 8. Analytics Data Quality Classification

Every metric returned by the API or rendered in the UI contains explicit classification metadata:

```typescript
export interface MetricEnvelope<T> {
  value: T;
  dataQuality: "CALCULATED_STANDARD" | "SELF_REPORTED_MANUAL" | "ESTIMATED_INCOMPLETE_FEES";
  sampleStatus: "SUFFICIENT" | "INSUFFICIENT" | "NO_DATA";
  calculationStatus: "VALID" | "ZERO_LOSSES" | "ZERO_DIVISOR" | "BLOCKED_MULTI_CURRENCY";
  disclaimer: string;
}
```

- **Disclaimer String**: *"Descriptive calculations based on student self-reported trade entries, not independent broker-audited records."*
- **Operational Sample Heuristic ($N \ge 20$)**: If closed trades $N < 20$, `sampleStatus = "INSUFFICIENT"`. Correlational insights between emotions and P/L are suppressed until $N \ge 20$. This threshold is strictly an **operational heuristic policy** to prevent premature conclusions, not a mathematical claim of statistical significance.

---

## 9. API Architecture Specification

```
+-----------------------------------------------------------------------------------------+
|                               API ROUTE DIRECTORY                                       |
+-----------------------------------------------------------------------------------------+
|  STUDENT JOURNAL & ACCOUNT ENDPOINTS                                                    |
|  ├── GET     /api/journal/accounts            # List student's trading accounts         |
|  ├── POST    /api/journal/accounts            # Create trading account                  |
|  ├── PATCH   /api/journal/accounts/[id]       # Update / archive trading account        |
|  ├── GET     /api/journal/trades              # Filtered list of trades (pagination)    |
|  ├── POST    /api/journal/trades              # Log new trade                           |
|  ├── GET     /api/journal/trades/[id]         # Trade detail with attachments           |
|  ├── PUT     /api/journal/trades/[id]         # Update trade entry                      |
|  ├── DELETE  /api/journal/trades/[id]         # Delete trade entry                      |
|  ├── POST    /api/journal/attachments        # Upload screenshot (multipart, max 5MB)  |
|  ├── GET     /api/journal/attachments/[id]   # Stream authorized screenshot (no-store) |
|  ├── GET     /api/journal/analytics           # Computed performance metrics            |
|  ├── GET     /api/journal/calendar            # Daily aggregated P/L calendar heatmap   |
|  ├── GET/POST /api/journal/reviews            # Daily, weekly, monthly review routines  |
|  ├── GET/POST /api/journal/strategies         # Custom strategy playbook                |
|  ├── GET/POST /api/journal/consent            # Manage mentor access consent            |
|  ├── GET     /api/journal/export              # Export complete journal (JSON / CSV)    |
|  └── POST    /api/journal/danger-zone/wipe    # Permanent account wipe (Password gate)  |
|                                                                                         |
|  ADMIN & MENTOR INTELLIGENCE (Consent-Protected)                                        |
|  ├── GET     /api/admin/journal/overview      # Anonymized aggregate platform stats     |
|  ├── GET     /api/admin/journal/students      # List students with active consent       |
|  ├── GET     /api/admin/journal/inspect/[uid] # Inspect consented student journal       |
|  └── GET     /api/admin/journal/audit-logs    # Audit trail of mentor journal views     |
+-----------------------------------------------------------------------------------------+
```

---

## 10. Acceptance Criteria (Definition of Done)

Sprint 3 will be considered complete and ready for production only when:
- [ ] Students can create, edit, archive, and switch multiple trading accounts with strict currency isolation.
- [ ] Trades record execution parameters, setup tags, and psychological conditions.
- [ ] Screenshot upload supports JPEG, PNG, and WebP (up to 5MB stream limit) with dimension limits, magic-byte validation, and private streaming (`Cache-Control: private, no-store`).
- [ ] Financial calculations adhere to asset specifications; manual realized input is supported for exotic instruments.
- [ ] Mathematical calculations for Win Rate, Profit Factor, Expectancy, and Max Drawdown handle zero denominators safely without `NaN` or misleading finite values.
- [ ] Open trades and cancelled orders are strictly excluded from closed performance metrics.
- [ ] Monthly calendar heatmap visualizes daily net P/L with correct timezone mapping (`Asia/Jakarta` default).
- [ ] Student journals are strictly private by default; mentors and admins cannot view student records without active consent.
- [ ] Every consented mentor access generates an immutable audit record in `data/journals/audit/`.
- [ ] 1-click consent revocation immediately blocks any subsequent mentor access.
- [ ] Automated integration test suites pass 100%.
- [ ] Production build (`npm run build`) completes cleanly with zero errors.

---
*End of Architecture Specification v2.1.1.*
