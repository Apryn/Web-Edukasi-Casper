import fs from "node:fs";
import path from "node:path";
import net from "node:net";

export type RateLimitScope = "login" | "register";

export interface RateLimitEntry {
  count: number;
  windowStartMs: number;
  blockedUntilMs: number | null;
  updatedAtMs: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  count: number;
  blockedUntilMs: number | null;
}

interface RateLimitStoreFile {
  version: 1;
  updatedAt: string;
  entries: Record<string, RateLimitEntry>;
}

export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const REGISTER_MAX_ATTEMPTS = 5;
export const REGISTER_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const REGISTER_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const MAX_TRACKED_KEYS = 5000;

let clockFn: () => number = () => Date.now();
let customStorePath: string | null = null;
let storeLoaded = false;
const memoryEntries = new Map<string, RateLimitEntry>();

function getStoreFilePath(): string {
  if (customStorePath) return customStorePath;
  return path.join(process.cwd(), "data", "rate-limits.json");
}

function nowMs(): number {
  return clockFn();
}

/**
 * Load persisted rate limit state from `data/rate-limits.json` once on startup.
 * Completely isolated from `data/academy.json` so rate-limit I/O never touches
 * or risks corrupting the main application database.
 */
function ensureStoreLoaded(): void {
  if (storeLoaded) return;
  storeLoaded = true;

  const filePath = getStoreFilePath();
  try {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as Partial<RateLimitStoreFile>;
    if (!parsed || typeof parsed !== "object" || !parsed.entries || typeof parsed.entries !== "object") {
      return;
    }

    const currentNow = nowMs();
    for (const [key, entry] of Object.entries(parsed.entries)) {
      if (
        entry &&
        typeof entry === "object" &&
        typeof entry.count === "number" &&
        typeof entry.windowStartMs === "number"
      ) {
        const blockedUntilMs =
          typeof entry.blockedUntilMs === "number" ? entry.blockedUntilMs : null;
        const updatedAtMs =
          typeof entry.updatedAtMs === "number" ? entry.updatedAtMs : entry.windowStartMs;

        const isExpiredWindow = currentNow - entry.windowStartMs >= LOGIN_WINDOW_MS;
        const isExpiredBlock = !blockedUntilMs || currentNow >= blockedUntilMs;
        if (isExpiredWindow && isExpiredBlock) {
          continue;
        }

        memoryEntries.set(key, {
          count: entry.count,
          windowStartMs: entry.windowStartMs,
          blockedUntilMs,
          updatedAtMs,
        });
      }
    }
  } catch {
    // Fail-safe: if rate-limits.json is unreadable, start with clean in-memory state
  }
}

function pruneExpiredEntries(currentNow: number): void {
  for (const [key, entry] of memoryEntries.entries()) {
    const windowMs = key.startsWith("register:") ? REGISTER_WINDOW_MS : LOGIN_WINDOW_MS;
    const blockExpired = !entry.blockedUntilMs || currentNow >= entry.blockedUntilMs;
    const windowExpired = currentNow - entry.windowStartMs >= windowMs;

    if (blockExpired && windowExpired) {
      memoryEntries.delete(key);
    }
  }

  // Enforce upper bound on tracked keys to prevent memory/disk exhaustion under DDoS
  if (memoryEntries.size > MAX_TRACKED_KEYS) {
    const sortedByOldest = Array.from(memoryEntries.entries()).sort(
      (a, b) => a[1].updatedAtMs - b[1].updatedAtMs
    );
    const excess = memoryEntries.size - MAX_TRACKED_KEYS;
    for (let i = 0; i < excess; i++) {
      memoryEntries.delete(sortedByOldest[i][0]);
    }
  }
}

function persistStoreToDisk(currentNow: number): void {
  const filePath = getStoreFilePath();
  const dirPath = path.dirname(filePath);
  const tempPath = `${filePath}.${process.pid}.tmp`;

  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const serializedEntries: Record<string, RateLimitEntry> = {};
    for (const [key, value] of memoryEntries.entries()) {
      serializedEntries[key] = value;
    }

    const payload: RateLimitStoreFile = {
      version: 1,
      updatedAt: new Date(currentNow).toISOString(),
      entries: serializedEntries,
    };

    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tempPath, filePath);
  } catch {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * Normalizes an IP address (strips IPv6-mapped IPv4 prefix `::ffff:`, normalizes `::1` to `127.0.0.1`,
 * and validates with `net.isIP`).
 */
export function normalizeIpAddress(rawIp: string | null | undefined): string | null {
  if (!rawIp || typeof rawIp !== "string") return null;
  let candidate = rawIp.trim();
  if (!candidate || candidate.length > 100) return null;

  // Strip IPv6 zone index if present (e.g. fe80::1%lo0)
  const zoneIdx = candidate.indexOf("%");
  if (zoneIdx !== -1) {
    candidate = candidate.slice(0, zoneIdx);
  }

  if (candidate.toLowerCase().startsWith("::ffff:")) {
    const mappedIpv4 = candidate.slice(7);
    if (net.isIP(mappedIpv4) === 4) {
      candidate = mappedIpv4;
    }
  }

  // Strip port if an IPv4:port string was passed
  if (candidate.includes(".") && candidate.includes(":")) {
    const lastColon = candidate.lastIndexOf(":");
    const hostPart = candidate.slice(0, lastColon);
    if (net.isIP(hostPart) === 4) {
      candidate = hostPart;
    }
  }

  if (candidate === "::1") {
    return "127.0.0.1";
  }

  const ipVersion = net.isIP(candidate);
  if (ipVersion === 4 || ipVersion === 6) {
    return candidate.toLowerCase();
  }

  return null;
}

/**
 * Safely extracts the client IP from an incoming Request, tailored to the project's
 * Nginx reverse-proxy architecture:
 * 1. If `server.js` verified a direct (non-loopback) socket connection, `x-casper-socket-ip`
 *    is used and spoofed forwarding headers from the client are ignored.
 * 2. When behind the local Nginx reverse proxy:
 *    - Prefer `x-real-ip` (which Nginx overwrites with `$remote_addr`).
 *    - Otherwise, if `x-forwarded-for` is present, take the RIGHTMOST valid IP
 *      (appended by the local Nginx `$proxy_add_x_forwarded_for`), never the leftmost
 *      client-supplied value which is trivially spoofable.
 * 3. Falls back to `"127.0.0.1"` in local/test environments when no IP headers exist.
 */
export function getClientIpFromRequest(req: Request): string {
  // 1. Verified socket header from server.js when connection is NOT from local proxy
  const directSocketIp = normalizeIpAddress(req.headers.get("x-casper-direct-ip"));
  if (directSocketIp) {
    return directSocketIp;
  }

  // 2. Nginx `proxy_set_header X-Real-IP $remote_addr;`
  const realIp = normalizeIpAddress(req.headers.get("x-real-ip"));
  if (realIp) {
    return realIp;
  }

  // 3. Nginx `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
  // Read from right to left so a client sending `X-Forwarded-For: fake_ip` cannot spoof their IP.
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const validIp = normalizeIpAddress(parts[i]);
      if (validIp) {
        return validIp;
      }
    }
  }

  return "127.0.0.1";
}

function buildKey(scope: RateLimitScope, clientIp: string): string {
  const safeIp = normalizeIpAddress(clientIp) || "127.0.0.1";
  return `${scope}:${safeIp}`;
}

/**
 * Checks whether a login request from `clientIp` is currently blocked.
 * Does NOT increment the failure counter yet (login only counts failed attempts,
 * unless the IP is already blocked).
 */
export function checkLoginRateLimit(clientIp: string): RateLimitCheckResult {
  ensureStoreLoaded();
  const currentNow = nowMs();
  pruneExpiredEntries(currentNow);

  const key = buildKey("login", clientIp);
  const existing = memoryEntries.get(key);

  if (!existing) {
    return {
      allowed: true,
      remaining: LOGIN_MAX_FAILED_ATTEMPTS,
      retryAfterSeconds: 0,
      count: 0,
      blockedUntilMs: null,
    };
  }

  // If currently blocked and block has not expired
  if (existing.blockedUntilMs && currentNow < existing.blockedUntilMs) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.blockedUntilMs - currentNow) / 1000)
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      count: existing.count,
      blockedUntilMs: existing.blockedUntilMs,
    };
  }

  // If previous block or window has expired, reset entry
  if (
    (existing.blockedUntilMs && currentNow >= existing.blockedUntilMs) ||
    currentNow - existing.windowStartMs >= LOGIN_WINDOW_MS
  ) {
    memoryEntries.delete(key);
    persistStoreToDisk(currentNow);
    return {
      allowed: true,
      remaining: LOGIN_MAX_FAILED_ATTEMPTS,
      retryAfterSeconds: 0,
      count: 0,
      blockedUntilMs: null,
    };
  }

  const remaining = Math.max(0, LOGIN_MAX_FAILED_ATTEMPTS - existing.count);
  return {
    allowed: remaining > 0,
    remaining,
    retryAfterSeconds: 0,
    count: existing.count,
    blockedUntilMs: null,
  };
}

/**
 * Records a failed login attempt for `clientIp`.
 * Upon reaching 5 failed attempts within 15 minutes, the IP is temporarily blocked for 15 minutes.
 */
export function recordFailedLoginAttempt(clientIp: string): RateLimitCheckResult {
  ensureStoreLoaded();
  const currentNow = nowMs();
  pruneExpiredEntries(currentNow);

  const key = buildKey("login", clientIp);
  let entry = memoryEntries.get(key);

  if (
    !entry ||
    (entry.blockedUntilMs && currentNow >= entry.blockedUntilMs) ||
    currentNow - entry.windowStartMs >= LOGIN_WINDOW_MS
  ) {
    entry = {
      count: 0,
      windowStartMs: currentNow,
      blockedUntilMs: null,
      updatedAtMs: currentNow,
    };
  }

  entry.count += 1;
  entry.updatedAtMs = currentNow;

  if (entry.count >= LOGIN_MAX_FAILED_ATTEMPTS) {
    entry.blockedUntilMs = currentNow + LOGIN_BLOCK_DURATION_MS;
  }

  memoryEntries.set(key, entry);
  persistStoreToDisk(currentNow);

  const remaining = Math.max(0, LOGIN_MAX_FAILED_ATTEMPTS - entry.count);
  const retryAfterSeconds =
    entry.blockedUntilMs && entry.blockedUntilMs > currentNow
      ? Math.max(1, Math.ceil((entry.blockedUntilMs - currentNow) / 1000))
      : 0;

  return {
    allowed: entry.blockedUntilMs === null,
    remaining,
    retryAfterSeconds,
    count: entry.count,
    blockedUntilMs: entry.blockedUntilMs,
  };
}

/**
 * Resets the failed login counter for `clientIp` after a successful login.
 */
export function resetLoginRateLimit(clientIp: string): void {
  ensureStoreLoaded();
  const currentNow = nowMs();
  const key = buildKey("login", clientIp);
  if (memoryEntries.has(key)) {
    memoryEntries.delete(key);
    persistStoreToDisk(currentNow);
  }
}

/**
 * Consumes a registration attempt for `clientIp` (max 5 attempts per 15 minutes per IP).
 * If already at 5 attempts within the active 15-minute window (or currently blocked),
 * returns `allowed: false` with `retryAfterSeconds`.
 */
export function consumeRegisterRateLimit(clientIp: string): RateLimitCheckResult {
  ensureStoreLoaded();
  const currentNow = nowMs();
  pruneExpiredEntries(currentNow);

  const key = buildKey("register", clientIp);
  let entry = memoryEntries.get(key);

  // If currently blocked, reject immediately
  if (entry && entry.blockedUntilMs && currentNow < entry.blockedUntilMs) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((entry.blockedUntilMs - currentNow) / 1000)
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      count: entry.count,
      blockedUntilMs: entry.blockedUntilMs,
    };
  }

  // If no entry or window/block expired, start a fresh window
  if (
    !entry ||
    (entry.blockedUntilMs && currentNow >= entry.blockedUntilMs) ||
    currentNow - entry.windowStartMs >= REGISTER_WINDOW_MS
  ) {
    entry = {
      count: 0,
      windowStartMs: currentNow,
      blockedUntilMs: null,
      updatedAtMs: currentNow,
    };
  }

  // If 5 attempts have already been made in this 15-minute window, block for 15 minutes
  if (entry.count >= REGISTER_MAX_ATTEMPTS) {
    entry.blockedUntilMs = currentNow + REGISTER_BLOCK_DURATION_MS;
    entry.updatedAtMs = currentNow;
    memoryEntries.set(key, entry);
    persistStoreToDisk(currentNow);

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((entry.blockedUntilMs - currentNow) / 1000)
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      count: entry.count,
      blockedUntilMs: entry.blockedUntilMs,
    };
  }

  entry.count += 1;
  entry.updatedAtMs = currentNow;
  memoryEntries.set(key, entry);
  persistStoreToDisk(currentNow);

  const remaining = Math.max(0, REGISTER_MAX_ATTEMPTS - entry.count);
  return {
    allowed: true,
    remaining,
    retryAfterSeconds: 0,
    count: entry.count,
    blockedUntilMs: null,
  };
}

// ============================================================================
// Deterministic Test Helpers (Used only in automated test suites)
// ============================================================================

export function setRateLimitClockForTest(customClock: (() => number) | null): void {
  clockFn = customClock || (() => Date.now());
}

export function configureRateLimitStoreForTest(options?: {
  filePath?: string | null;
  resetMemory?: boolean;
}): void {
  if (options?.filePath !== undefined) {
    customStorePath = options.filePath;
    storeLoaded = false;
  }
  if (options?.resetMemory) {
    memoryEntries.clear();
    storeLoaded = false;
  }
}

export function resetRateLimitAllForTest(): void {
  memoryEntries.clear();
  const filePath = getStoreFilePath();
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore
  }
}

