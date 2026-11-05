# SIGNAL CASPER ACADEMY — SPRINT 3 — IMPLEMENTATION PLAN (REFINED v2.1.1)
# STUDENT TRADING JOURNAL & PERFORMANCE TRACKING

**Document Version**: 2.1.1 (Final Technical Correction & Implementation Readiness Specification)  
**Parent Architecture**: [student_trading_journal_architecture.md](./student_trading_journal_architecture.md)  
**Status**: SUBMITTED FOR PRODUCT OWNER REVIEW & APPROVAL  
**Scope**: 10 Independently Testable Engineering Tasks

---

## Document Revision Changelog

| Version | Date | Author | Summary of Changes from Previous Version |
|:---|:---|:---|:---|
| **1.0.0** | 2026-11-05 | Principal Architect | Initial draft covering basic 8-task breakdown. |
| **2.0.0** | 2026-11-05 | Senior Full-Stack Architect | Expanded roadmap to 10 prioritized tasks with partitioned storage and consent gate. |
| **2.1.0** | 2026-11-05 | Architecture & Security Board | Mutex queue tests, directory fsync, financial edge cases, and release readiness formatting. |
| **2.1.1** | 2026-11-05 | Architecture & Security Board | **Critical Implementation Readiness Alignments:**<br>1. **Task 1 (Storage)**: Updated `UserPartitionLock` tests to verify cleanup comparing against stored `nextTail` Promise; added test for Promise continuation on error; added test for OS durability (Linux directory `fsync` vs Windows NTFS `renameSync`); formalized `RECOVERY_REQUIRED` test; documented single-process Node.js runtime constraint.<br>2. **Task 2 (Accounts & Balance Lifecycle)**: Added explicit balance derivation tests (`realizedBalance`, `equity`, `freeMargin`); added deposit and withdrawal cash transaction tests; enforced `HTTP 422` on archived account mutations; added per-currency decimal scale dictionary.<br>3. **Task 3 (APIs)**: Confirmed strict separation of export (`GET /api/journal/export`) and wipe (`POST /api/journal/danger-zone/wipe`).<br>4. **Task 4 (Media & Upload)**: Explicitly mandated that streaming endpoint strictly enforces **OWNER-ONLY** access until Task 8 Consent Gate is introduced; added streaming chunk counter test (abort > 5MB); added dimension/decompression bomb limit tests (max 3840x2160, 8.3MP); added quota validation inside user mutex; noted steganography boundary.<br>5. **Task 6 (Analytics Engine)**: Removed `VERIFIED_BROKER` status; added tests for single non-overlapping fee scheme ($\text{Net P/L} = \text{Gross P/L} - \text{commission} + \text{swap} - \text{otherFees}$); added tests for $\overline{L}_{\text{net}} > 0$ and single cost deduction in expectancy; added tests for cashflow-adjusted MDD; verified decoupled metadata envelope (`dataQuality`, `sampleStatus`, `calculationStatus`); documented $N \ge 20$ as an operational heuristic.<br>6. **Task 8 (Consent & Wipe)**: Added grantee specificity tests, 1-click immediate revocation tests, application append-only audit trail validation, and 6-state wipe lifecycle with persistent `.tombstone` preventing stale backup rehydration.<br>7. **Task 10 (Release Readiness Review)**: Formatted strictly as Final QA & Release Readiness Review (strictly NO VPS deployment); listed all test suites from Tasks 1–9 including `journal-calendar.test.mjs` and existing core LMS regression suites. |

---

## 1. Overview & Phasing Strategy

This implementation plan breaks down the development of the **Student Trading Journal & Performance Tracking System** into **10 prioritized, independently verifiable engineering tasks**.

To maintain engineering integrity, prevent regressions in the core LMS (Courses C1–C9, Classroom, Quiz Evaluation, and Admin Course Editor), and enforce strict security boundaries, each task adheres to the following principles:
- **Strict Isolation**: Core database `data/academy.json` is never altered. Journal data uses dedicated per-user partition files (`data/journals/u_[userId].json`) and media folders (`data/uploads/journals/`).
- **Independent Testability**: Each task concludes with an automated test suite verifying its specific domain logic before moving to the next task.
- **Fail-Safe Rollback**: A global feature flag `ENABLE_TRADING_JOURNAL` allows disabling the feature instantly without impacting the LMS.

```
+-------------------------------------------------------------------------------------------------+
|                                 10-TASK IMPLEMENTATION ROADMAP                                  |
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|   1. Storage & Database Architecture   ──> 2. Trading Account & Journal Core                    |
|                                                              │                                  |
|   4. Screenshot Upload & Streaming     <── 3. Secure CRUD APIs                                  |
|            │                                                                                    |
|            ▼                                                                                    |
|   5. Student Journal Interface         ──> 6. Analytics Engine & Drawdown Calculation           |
|                                                              │                                  |
|   8. Consent & Mentor Access Gate      <── 7. Reviews, Calendar & Strategy Playbook             |
|            │                                                                                    |
|            ▼                                                                                    |
|   9. Admin Aggregate Intelligence      ──> 10. Final QA & Release Readiness Review              |
|                                                                                                 |
+-------------------------------------------------------------------------------------------------+
```

---

## 2. Detailed Task Breakdown

---

### Task 1 — Storage & Database Architecture Layer

#### Objective
Build the underlying storage abstraction for user trading journals using partitioned JSON storage (`data/journals/u_[userId].json`), incorporating an in-memory per-user mutex lock, atomic tempfile write with `fsyncSync`, rollback handling, version checking, and crash recovery.

#### Files to Create / Modify
- **Create**: `lib/journal-storage.ts` (Storage engine: per-user mutex queue, atomic writes, schema validation, quarantine, backup snapshotting, and cleanup).
- **Create**: `lib/journal-types.ts` (Core TypeScript domain interfaces: `TradingAccount`, `TradeRecord`, `UserJournalPartition`, etc.).

#### Security & Validation Rules
- Partition files must reside strictly in `data/journals/u_[userId].json`. Path traversal on `userId` (e.g. `../`) must be rejected.
- Temporary files must use a unique process-specific filename: `u_[userId].tmp.[pid].[timestamp].[rand].json`.
- Failed writes must immediately unlink the temporary file and leave the existing partition intact.
- Corrupted JSON files must be automatically quarantined to `data/journals/corrupted/u_[userId].corrupt.[timestamp].json` and restored from the latest valid backup. If no valid backup exists, mark state as `RECOVERY_REQUIRED` (never silently overwrite with empty partition).
- In-memory mutex operates within a single Node.js runtime process; multi-process clustering without distributed locking is prohibited.

#### Dependencies
- None (Foundation task).

#### Independent Test Plan (`tests/journal-storage.test.mjs`)
1. **Creation & Schema**: Verify automatic directory creation and initialization of an empty partition.
2. **Concurrency & Mutex Queue**: Fire 10 simultaneous asynchronous writes to the same `userId` and assert 0 lost updates.
3. **Queue Continuation**: Verify that an operation throwing an error does not break or hang subsequent tasks in the Promise chain.
4. **Queue Map Cleanup**: Verify that when a user queue finishes and becomes idle, its entry is purged from the `Map` by comparing the exact `nextTail` reference.
5. **Optimistic Concurrency**: Update with `expectedVersion`; assert `HTTP 409 Conflict` when version does not match loaded state.
6. **User Isolation**: Verify Student A mutations never touch or lock Student B's partition.
7. **Atomic Rollback**: Simulate disk write failure and verify existing partition remains 100% valid.
8. **Recovery without Valid Backup**: Simulate corrupted partition with no backups; assert `RECOVERY_REQUIRED` error and raw file quarantine.
9. **Schema Migration**: Load a partition with `schemaVersion: 0`; assert engine applies migration to version 1 cleanly.
10. **OS Durability Handling**: Verify platform check separates POSIX directory `fsync` from Windows NTFS `renameSync`.

#### Acceptance Criteria
- [ ] Partition reads execute with high speed and zero blocking.
- [ ] Concurrent writes to the same partition are strictly serialized via the in-memory Promise queue.
- [ ] Dangling `.tmp` files are cleaned up on startup.
- [ ] 100% passing tests in `tests/journal-storage.test.mjs`.

---

### Task 2 — Trading Account & Journal Core Service

#### Objective
Implement the domain service functions for managing multiple student trading accounts (with strict currency metadata and cash transactions) and core trade records (creation, update, soft/hard deletion, and query filters).

#### Files to Create / Modify
- **Create**: `lib/journal-service.ts` (Pure business logic: Account CRUD, Cash transactions, Trade CRUD, Multi-account queries, Status transitions).

#### Security & Validation Rules
- All domain operations must acquire the `UserPartitionLock` for the user before reading or writing.
- Trades must belong to an existing active account owned by the caller.
- Archived accounts are read-only; new trade creation or edits on archived accounts are rejected with `HTTP 422 Unprocessable Entity`.
- Deleting an account is allowed only if trade count is 0; accounts with trades can only be archived.
- Every currency defines an explicit decimal scale $D_{\text{curr}}$ (USD=2, IDR=0, JPY=0, BHD=3).
- Cash transactions (deposits and withdrawals) update `realizedBalance` and `equity` deterministically.

#### Dependencies
- Task 1 (Storage Architecture).

#### Independent Test Plan (`tests/journal-service.test.mjs`)
1. **Account Lifecycle**: Create account, update broker label, archive account; verify archived account rejects new trade with HTTP 422.
2. **Balance Derivation**: Create account with \$10,000 initial balance; add \$2,000 deposit; execute closed trade with \$500 net profit; assert `realizedBalance` is \$12,500.
3. **Trade Lifecycle**: Create trade with valid parameters, update trade notes, delete trade; verify partition updates.
4. **Multi-Account Isolation**: Verify queries filtered by `accountId` return only trades for that specific account.
5. **Currency Decimals**: Verify IDR amounts store integer units ($D_{\text{curr}}=0$) and USD amounts store 2 decimal places ($D_{\text{curr}}=2$).

#### Acceptance Criteria
- [ ] Account and trade domain logic fully covered by unit tests.
- [ ] Trade mutations update derived account balance accurately.
- [ ] 100% passing tests in `tests/journal-service.test.mjs`.

---

### Task 3 — Secure RESTful CRUD APIs & IDOR Prevention

#### Objective
Build the Next.js 15 App Router API endpoints for accounts, trades, reviews, playbook, data export, and account wipe, enforcing strict authentication, IDOR ownership verification, and standardized JSON responses.

#### Files to Create / Modify
- **Create**: `app/api/journal/accounts/route.ts` (GET, POST).
- **Create**: `app/api/journal/accounts/[id]/route.ts` (PATCH, DELETE).
- **Create**: `app/api/journal/accounts/[id]/transactions/route.ts` (POST - deposits/withdrawals).
- **Create**: `app/api/journal/trades/route.ts` (GET, POST).
- **Create**: `app/api/journal/trades/[id]/route.ts` (GET, PUT, DELETE).
- **Create**: `app/api/journal/export/route.ts` (GET - JSON/CSV export).
- **Create**: `app/api/journal/danger-zone/wipe/route.ts` (POST - permanent wipe).

#### Security & Validation Rules
- Authenticate via `getSessionUser(req)` from `lib/auth.ts`. Unauthenticated calls return `HTTP 401 Unauthorized`.
- **Anti-IDOR**: Check that the requested entity (`accountId`, `tradeId`) is owned by the session user. Cross-user access returns `HTTP 403 Forbidden` or `HTTP 404 Not Found`.
- Input validation: reject invalid prices, negative lot sizes, or future execution dates with `HTTP 422 Unprocessable Entity`.
- Wipe endpoint requires password verification, unlinks files and backups, and writes persistent `.tombstone`.

#### Dependencies
- Task 2 (Journal Core Service).

#### Independent Test Plan (`tests/journal-api.test.mjs`)
1. **Unauthenticated Block**: Verify all endpoints return HTTP 401 when no session cookie is provided.
2. **Anti-IDOR Ownership Guard**: Student A attempts to read or mutate Student B's trade; assert HTTP 403 / HTTP 404.
3. **Payload Validation**: Submit negative lot size or invalid date; assert HTTP 422 with descriptive error message.
4. **Export Endpoint**: Call `GET /api/journal/export`; assert valid JSON payload containing accounts and trades.
5. **Permanent Wipe & Tombstone**: Call `POST /api/journal/danger-zone/wipe` with valid password; assert partition deleted and `.tombstone` created.

#### Acceptance Criteria
- [ ] All endpoints return structured responses `{ success: true, data }` or `{ error: string }`.
- [ ] Anti-IDOR security fully verified.
- [ ] 100% passing tests in `tests/journal-api.test.mjs`.

---

### Task 4 — Screenshot Upload, Image Processing & Streaming Proxy Layer

#### Objective
Build the image upload and streaming delivery proxy for trade chart screenshots, incorporating stream chunk byte counters, dimension verification, WebP re-encoding, quota tracking inside user mutex, and strict owner-only streaming proxy access.

#### Files to Create / Modify
- **Create**: `lib/journal-media.ts` (Image validation, dimension checking, WebP re-encoding, and streaming proxy).
- **Create**: `app/api/journal/attachments/route.ts` (POST - multipart file upload).
- **Create**: `app/api/journal/attachments/[id]/route.ts` (GET - authenticated streaming delivery).

#### Security & Validation Rules
- **OWNER-ONLY STREAMING ACCESS**: In Task 4, the streaming endpoint (`GET /api/journal/attachments/[id]`) strictly enforces that **ONLY the owning student** can stream the screenshot. Access by other users (including mentors and admins) is unconditionally rejected with `HTTP 403 Forbidden` until the Task 8 Consent Gate is implemented.
- **Stream Abortion Guard**: Multipart parser accumulates bytes via a chunk counter. If accumulated bytes exceed 5MB ($5,242,880$ bytes), immediately abort connection (`req.destroy()`) and return `HTTP 413 Payload Too Large`.
- **Dimension & Bomb Limit**: Max dimensions $3840 \times 2160$ (4K UHD), max total area $8,294,400$ pixels. Images exceeding limits are rejected prior to full bitmap decompression.
- **Re-Encoding**: Decoded into raw pixels and re-encoded to WebP format. File format exploits, script polyglots, and EXIF metadata are stripped. The system candidly acknowledges that re-encoding does not mathematically eliminate all LSB pixel steganography.
- **Quota Tracking inside Mutex**: User quota (150MB max) is checked and incremented inside `UserPartitionLock`.
- **Streaming Headers**: `Cache-Control: private, no-store, must-revalidate`, `Content-Type: image/webp`.

#### Dependencies
- Task 3 (CRUD APIs).

#### Independent Test Plan (`tests/journal-upload.test.mjs`)
1. **Owner-Only Enforcement**: Student A uploads screenshot; Student B attempts to stream via `GET /api/journal/attachments/[id]`; assert HTTP 403 Forbidden.
2. **Stream Byte Abortion**: Stream a payload exceeding 5MB; assert stream is aborted and HTTP 413 returned.
3. **Dimension Limit**: Upload a crafted image with dimensions $4000 \times 4000$; assert HTTP 422 rejection.
4. **WebP Conversion**: Upload valid JPEG/PNG; assert output file on disk is valid WebP binary with zero EXIF tags.
5. **Storage Quota Concurrency**: Fire parallel uploads that would exceed 150MB; assert mutex serializes and rejects over-quota uploads with HTTP 413.
6. **Streaming Cache Headers**: Verify response headers include `Cache-Control: private, no-store, must-revalidate`.

#### Acceptance Criteria
- [ ] Screenshots stored outside public root in `data/uploads/journals/[userId]/[tradeId]/`.
- [ ] Only owner can stream screenshots (owner-only access enforced).
- [ ] 100% passing tests in `tests/journal-upload.test.mjs`.

---

### Task 5 — Student Journal Frontend & Trade Documentation Interface

#### Objective
Build the responsive, Dark Cyber-Fintech student journal interface, including multi-account switcher, trade table with filtering/sorting, trade entry modal with multi-timeframe screenshot preview, and responsive mobile drawer.

#### Files to Create / Modify
- **Create**: `app/jurnal/page.tsx` (Main journal dashboard & account switcher).
- **Create**: `app/jurnal/TradeModal.tsx` (Trade entry & editing dialog).
- **Create**: `app/jurnal/TradeDetailDrawer.tsx` (Detailed trade inspection drawer).
- **Create**: `app/jurnal/AccountModal.tsx` (Account creation & management dialog).
- **Create**: `app/jurnal/TradeFilters.tsx` (Filtering by pair, direction, strategy, outcome).
- **Modify**: `components/Navbar.tsx` (Add "Jurnal" navigation link with active indicator).

#### UI/UX & Responsive Guidelines
- Follow Casper Dark Cyber-Fintech design system (`#04070a` void, `#080c10` card, `#38bdf8` cyan, `#22c55e` profit, `#f43f5e` loss).
- Numerical values, prices, lots, and P/L rendered in `font-mono` (`DM Mono`).
- Responsive: full table view on desktop; card list with swipeable actions on mobile ($\le 768\text{px}$).

#### Dependencies
- Task 3 (CRUD APIs), Task 4 (Screenshot Upload).

#### Independent Test Plan (`Manual UI & Playwright`)
1. **Account Switcher**: Create two accounts; switch between them; verify trade table updates instantly.
2. **Trade Logging**: Log trade with screenshot; verify thumbnail preview and successful table update.
3. **Mobile Layout**: Test viewport at 390px (iPhone); verify drawer and controls fit with zero horizontal scroll.

#### Acceptance Criteria
- [ ] Journal page loads seamlessly for authenticated users.
- [ ] Responsive across desktop, tablet, and mobile.
- [ ] Visual styling adheres strictly to Casper design tokens.

---

### Task 6 — Financial Calculation Engine & Analytics Core

#### Objective
Implement the pure financial calculation engine that computes performance metrics (Net P/L, Win Rate, Profit Factor, Expectancy, and Cashflow-adjusted Drawdown) with explicit data quality tagging, minor-unit rounding, and zero-loss edge case handling.

#### Files to Create / Modify
- **Create**: `lib/journal-analytics.ts` (Pure financial calculation functions, envelope packaging, and heuristics).
- **Create**: `app/api/journal/analytics/route.ts` (GET - analytics endpoint with date and account filters).
- **Create**: `app/jurnal/AnalyticsView.tsx` (Visual metrics dashboard: Win Rate gauge, Expectancy, MDD curve).

#### Security & Mathematical Rules
- **No Fabricated Data**: If closed trades $N == 0$, Win Rate is `null` (rendered as `"N/A"`), NOT $0.0\%$.
- **Zero Losses**: If Gross Loss $== 0$ and Gross Profit $> 0$, Profit Factor is `null` with `calculationStatus: "ZERO_LOSSES"`.
- **Single Cost Deduction**: $\overline{L}_{\text{net}}$ is defined as a positive magnitude ($> 0$), and Expectancy $E_{\$} = (WR \times \overline{W}_{\text{net}}) - (LR \times \overline{L}_{\text{net}})$.
- **Cashflow-Adjusted MDD**: Deposits increase peak equity to prevent masking past losses; withdrawals decrease equity without triggering false drawdowns.
- **Negative Equity**: If equity drops $\le 0$, percentage drawdown is clamped to $100.0\%$ and tagged `ACCOUNT_DEPLETED`.
- **Data Quality Tagging**: Every metric is packaged in `MetricEnvelope` with `dataQuality` (`CALCULATED_STANDARD` | `SELF_REPORTED_MANUAL` | `ESTIMATED_INCOMPLETE_FEES`), `sampleStatus` (`SUFFICIENT` | `INSUFFICIENT` | `NO_DATA`), and `calculationStatus` (`VALID` | `ZERO_LOSSES` | `ZERO_DIVISOR` | `BLOCKED_MULTI_CURRENCY`).
- **Sample Heuristic**: $N \ge 20$ is an operational heuristic policy, not a claim of statistical significance.

#### Dependencies
- Task 2 (Journal Core Service).

#### Independent Test Plan (`tests/journal-analytics.test.mjs`)
1. **Zero Trades**: Calculate metrics with 0 closed trades; assert Win Rate is `null` and `sampleStatus = "NO_DATA"`.
2. **Zero Losses**: Calculate metrics with 5 wins and 0 losses; assert Profit Factor is `null` and `calculationStatus = "ZERO_LOSSES"`.
3. **Single Fee Deduction**: Verify Expectancy formula deducts commissions and swap exactly once.
4. **Cashflow-Adjusted Drawdown**: Test sequence (Start \$10k, Loss \$1k, Deposit \$5k, Win \$2k); assert deposit does not reset drawdown percentage incorrectly.
5. **Negative Equity Clamp**: Simulate losses exceeding initial balance; verify MDD is clamped to 100% with `ACCOUNT_DEPLETED`.
6. **Multi-Currency Blocking**: Attempt analytics across combined accounts with USD and IDR; assert `calculationStatus: "BLOCKED_MULTI_CURRENCY"`.

#### Acceptance Criteria
- [ ] Financial calculations 100% mathematically sound.
- [ ] All edge cases handled without `NaN` or unhandled exceptions.
- [ ] 100% passing tests in `tests/journal-analytics.test.mjs`.

---

### Task 7 — Trading Calendar, Review Routines & Strategy Playbook

#### Objective
Build the daily/monthly aggregated P/L calendar heatmap, structured review routines (Daily, Weekly, Monthly), and custom strategy playbook tagging system.

#### Files to Create / Modify
- **Create**: `lib/journal-calendar.ts` (Date aggregation, timezone mapping to `Asia/Jakarta`, review persistence).
- **Create**: `app/api/journal/calendar/route.ts` (GET - aggregated day cells with P/L, volume, and win count).
- **Create**: `app/api/journal/reviews/route.ts` (GET, POST - structured periodic reviews).
- **Create**: `app/api/journal/strategies/route.ts` (GET, POST - custom setup playbook).
- **Create**: `app/jurnal/CalendarView.tsx` (Interactive monthly calendar heatmap).
- **Create**: `app/jurnal/ReviewsView.tsx` (Review checklists and introspective prompts).

#### Security & Validation Rules
- All timestamps mapped using user-configured timezone (default `Asia/Jakarta`).
- Aggregation computes realized Net P/L only for closed trades on that calendar date.
- Strategies can be archived but never break historical trade references.

#### Dependencies
- Task 5 (Journal Frontend), Task 6 (Analytics Engine).

#### Independent Test Plan (`tests/journal-calendar.test.mjs`)
1. **Calendar Aggregation**: Log 3 trades on the same day (2 wins, 1 loss); verify calendar returns exact net sum and trade count for that day.
2. **Timezone Conversion**: Verify trades logged at 23:30 UTC appear on the correct localized date in `Asia/Jakarta` (06:30 WIB next day).
3. **Review Persistence**: Save weekly review; verify saved in partition and retrieved accurately.
4. **Strategy Playbook**: Create strategy, associate with trade, archive strategy; verify trade still displays strategy name.

#### Acceptance Criteria
- [ ] Calendar renders days with color intensity based on P/L magnitude.
- [ ] Clicking a calendar day displays list of trades executed on that date.
- [ ] 100% passing tests in `tests/journal-calendar.test.mjs`.

---

### Task 8 — Student Privacy Consent Protocol & Mentor Access Gate

#### Objective
Implement an explicit, grantee-specific, revocable student consent protocol that strictly controls mentor access, ensures zero unauthorized inspection, and generates immutable audit records in a dedicated audit log store.

#### Files to Create / Modify
- **Create**: `lib/journal-consent.ts` (Consent verification, expiration checker, audit logging helper).
- **Create**: `app/api/journal/consent/route.ts` (GET, POST - manage consent status).
- **Create**: `app/jurnal/privasi/page.tsx` (Student consent control center, mentor permissions, data export / account wipe).
- **Modify**: `app/api/journal/attachments/[id]/route.ts` (Update streaming proxy: permit mentor streaming ONLY when valid active consent exists for caller).

#### Security & Validation Rules
- **Explicit Role Boundary**: Mentors, Admins, and Master Admins have **NO access** without active student consent.
- Consent requires specific `granteeId` (mentor user ID or `"ALL_ACADEMY_MENTORS"`).
- Consent expiration: Default 30 days (max 90 days), checked on every request via `new Date() > new Date(expiresAt)`.
- 1-Click Revocation: Immediately sets `isRevoked = true`, blocking any active mentor session on the next request.
- Every consented access generates an audit record in `data/journals/audit/journal_audit_[YYYY-MM].jsonl`.
- Permanent Wipe State Machine: `ACTIVE` $\to$ `WIPE_INITIATED` $\to$ `ATTACHMENTS_PURGED` $\to$ `PARTITION_PURGED` $\to$ `BACKUPS_PURGED` $\to$ `TOMBSTONE_COMMITTED`. Restoration of wiped accounts is rejected with `HTTP 410 Gone`.

#### Dependencies
- Task 2 (Journal Core Service), Task 4 (Screenshot Upload).

#### Independent Test Plan (`tests/journal-consent.test.mjs`)
1. **Default State**: Verify student consent defaults to inactive.
2. **Grantee Specificity**: Student grants consent to Mentor A; assert Mentor B is rejected with HTTP 403.
3. **Immediate Revocation**: Student revokes consent; verify Mentor A is immediately blocked with HTTP 403 on subsequent request.
4. **Expiration Enforcement**: Set `expiresAt` to a past timestamp; verify mentor is blocked with HTTP 403.
5. **Dedicated Audit Logging**: Verify each consented mentor view appends an immutable record to `data/journals/audit/journal_audit_[YYYY-MM].jsonl`.
6. **Tombstone Enforcement**: Attempt to restore a wiped account with an active tombstone; assert HTTP 410 Gone.

#### Acceptance Criteria
- [ ] Zero unauthorized access by mentors or admins.
- [ ] 1-click revocation takes effect instantly.
- [ ] 100% passing tests in `tests/journal-consent.test.mjs`.

---

### Task 9 — Admin & Mentor Student Intelligence Portal

#### Objective
Build Tab 4 ("Jurnal & Evaluasi Siswa") inside the `/admin` portal, providing anonymized macro platform statistics, a consented student diagnostic inspector, and an audit trail of mentor view actions.

#### Files to Create / Modify
- **Create**: `app/api/admin/journal/overview/route.ts` (Anonymized macro analytics).
- **Create**: `app/api/admin/journal/students/route.ts` (List students with active consent).
- **Create**: `app/api/admin/journal/inspect/[studentId]/route.ts` (Consent-gated diagnostic inspector).
- **Create**: `app/admin/JournalIntelligenceTab.tsx` (Tab 4 component in `/admin`).
- **Modify**: `app/admin/page.tsx` (Mount Tab 4 in the existing Admin navigation).

#### Security & Validation Rules
- Endpoints require `isMentorOrAdmin(user)`. Regular students rejected with HTTP 403.
- Macro overview returns only aggregate data with all personal student identities scrubbed.
- Diagnostic inspection strictly enforces the Task 8 consent gate.

#### Dependencies
- Task 8 (Consent Protocol).

#### Independent Test Plan (`tests/admin-journal.test.mjs`)
1. **Admin Authorization**: Regular student calling `/api/admin/journal/overview` is rejected with HTTP 403.
2. **Macro Analytics**: Verify macro overview returns aggregated numbers without leaking student names or emails.
3. **Consent List**: Verify only students with active consent appear in the consented inspection table.
4. **Inspection Gate**: Attempt to inspect student without consent; verify HTTP 403. Inspect student with consent; verify HTTP 200 and audit record created in `data/journals/audit/`.

#### Acceptance Criteria
- [ ] Macro analytics display platform-wide trade volume, average win rate, and top execution mistakes.
- [ ] Mentors can diagnose trade setups for consenting students.
- [ ] 100% passing tests in `tests/admin-journal.test.mjs`.

---

### Task 10 — Final QA & Release Readiness Review

#### Objective
Conduct a full functional, security, mathematical, and regression audit of the entire Sprint 3 implementation across desktop and mobile devices. **STRICT RULE: This task verifies release readiness and does NOT execute deployment to the VPS.**

#### Tasks & Verification Deliverables
1. **Full Automated Test Suite Execution (All Tasks 1–9)**:
   - `tests/db.test.mjs` (LMS Database & Concurrency).
   - `tests/rate-limit.test.mjs` (Anti-Bruteforce & Auth).
   - `tests/academy.test.mjs` (Curriculum C1-C9 & Admin Course Editor).
   - `tests/qa-sprint2-task3-3.test.mjs` (Sprint 2 Deep QA Suite).
   - `tests/journal-storage.test.mjs` (Task 1: Partitioned Storage & Mutex Lock).
   - `tests/journal-service.test.mjs` (Task 2: Account & Trade Core).
   - `tests/journal-api.test.mjs` (Task 3: RESTful APIs & Anti-IDOR).
   - `tests/journal-upload.test.mjs` (Task 4: Magic-byte Uploads & Owner Streaming).
   - `tests/journal-analytics.test.mjs` (Task 6: Financial Calculations & Edge Cases).
   - `tests/journal-calendar.test.mjs` (Task 7: Reviews & Calendar Heatmap).
   - `tests/journal-consent.test.mjs` (Task 8: Privacy Consent & 1-Click Revocation).
   - `tests/admin-journal.test.mjs` (Task 9: Mentor Intelligence & Audit Logs).
2. **TypeScript Strict Check**: `npx tsc --noEmit` exits with 0 errors.
3. **ESLint Static Analysis**: `npm run lint` exits with 0 errors.
4. **Next.js Production Build**: `npm run build` exits with code 0 (all pages compiled and static routes generated).
5. **Physical Database Integrity Verification**: Verify `data/academy.json` is completely clean and untouched.
6. **Deliverable QA Report**: Create `docs/sprint-3/student_trading_journal_qa_report.md`.

#### Acceptance Criteria
- [ ] All 12 test suites pass (100% pass rate).
- [ ] Production build succeeds without warnings.
- [ ] Core LMS database `data/academy.json` unmodified.
- [ ] System verified release-ready for Product Owner sign-off.

---

## 3. Dependency Graph

```
Task 1 (Storage Architecture)
       │
       ▼
Task 2 (Account & Journal Core)
       │
       ▼
Task 3 (Secure CRUD APIs) ───────┐
       │                         │
       ▼                         ▼
Task 4 (Screenshot Upload)  Task 6 (Analytics Engine)
       │                         │
       ▼                         ▼
Task 5 (Student UI)         Task 7 (Calendar & Reviews)
       │                         │
       └───────────┬─────────────┘
                   ▼
Task 8 (Consent & Privacy Gate)
       │
       ▼
Task 9 (Admin & Mentor Intelligence)
       │
       ▼
Task 10 (Final QA & Release Readiness Review)
```

---

## 4. Rollback and Disaster Recovery Plan

1. **Feature Flag Kill-Switch**:
   Environment variable `ENABLE_TRADING_JOURNAL=false` instantly hides `/jurnal` and `/api/journal/*` routes, returning a maintenance response without affecting any LMS classroom or course features.
2. **Zero Core Database Impact**:
   Because journal data resides strictly in `data/journals/` and `data/uploads/journals/`, any partition error cannot corrupt `data/academy.json`.
3. **User Partition Restoration**:
   If a specific student partition is damaged, it can be restored independently from `data/backups/journals/u_[userId].[timestamp].json` without downtime for other students.
4. **Persistent Tombstone Protection**:
   Wiped student accounts cannot be accidentally rehydrated from stale backups due to the persistent `.tombstone` marker.

---
*End of Implementation Plan v2.1.1.*
