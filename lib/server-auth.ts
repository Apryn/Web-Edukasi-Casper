import crypto from "node:crypto";
import { findUserByEmail, createUser } from "./db";
import {
  verifyPassword,
  hashPassword,
  createToken,
  sanitizeUser,
  MASTER_ADMIN_EMAILS,
  type SafeUser,
} from "./auth";
import {
  getClientIpFromRequest,
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  resetLoginRateLimit,
  consumeRegisterRateLimit,
} from "./rate-limit";

// Precomputed valid bcrypt cost-10 hash used when email is not found to prevent timing enumeration
const DUMMY_BCRYPT_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export interface AuthActionResult {
  ok: boolean;
  status: number;
  headers?: Record<string, string>;
  error?: string;
  retryAfterSeconds?: number;
  token?: string;
  user?: SafeUser;
}

export async function processLoginRequest(
  req: Request,
  body: unknown
): Promise<AuthActionResult> {
  const clientIp = getClientIpFromRequest(req);

  // 1. Check whether IP is currently rate-limited (5 failed attempts within 15m -> 15m block)
  const limitStatus = checkLoginRateLimit(clientIp);
  if (!limitStatus.allowed) {
    return {
      ok: false,
      status: 429,
      headers: {
        "Retry-After": String(limitStatus.retryAfterSeconds),
      },
      error:
        "Terlalu banyak percobaan login yang gagal. Silakan coba lagi setelah beberapa saat.",
      retryAfterSeconds: limitStatus.retryAfterSeconds,
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    recordFailedLoginAttempt(clientIp);
    return {
      ok: false,
      status: 400,
      error: "Email dan kata sandi wajib diisi.",
    };
  }

  const { email, password } = body as { email?: unknown; password?: unknown };

  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim()
  ) {
    recordFailedLoginAttempt(clientIp);
    return {
      ok: false,
      status: 400,
      error: "Email dan kata sandi wajib diisi.",
    };
  }

  const user = findUserByEmail(email.trim());

  // Always run bcrypt comparison even if user does not exist to prevent timing enumeration
  const targetHash = user ? user.password_hash : DUMMY_BCRYPT_HASH;
  const isMatch = await verifyPassword(password, targetHash);

  if (!user || !isMatch) {
    recordFailedLoginAttempt(clientIp);
    // Identical generic message whether email exists or not
    return {
      ok: false,
      status: 401,
      error: "Email atau kata sandi tidak sesuai.",
    };
  }

  // Successful login resets the failed-attempt counter for this IP
  resetLoginRateLimit(clientIp);

  const token = createToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    ok: true,
    status: 200,
    token,
    user: sanitizeUser(user),
  };
}

export async function processRegisterRequest(
  req: Request,
  body: unknown
): Promise<AuthActionResult> {
  const clientIp = getClientIpFromRequest(req);

  // 1. Enforce max 5 registration attempts per 15 minutes per IP
  const regLimit = consumeRegisterRateLimit(clientIp);
  if (!regLimit.allowed) {
    return {
      ok: false,
      status: 429,
      headers: {
        "Retry-After": String(regLimit.retryAfterSeconds),
      },
      error:
        "Terlalu banyak percobaan pendaftaran akun. Silakan coba lagi setelah beberapa saat.",
      retryAfterSeconds: regLimit.retryAfterSeconds,
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      status: 400,
      error: "Nama, email, dan kata sandi wajib diisi.",
    };
  }

  const { email, password, name } = body as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
  };

  if (!email || !password || !name) {
    return {
      ok: false,
      status: 400,
      error: "Nama, email, dan kata sandi wajib diisi.",
    };
  }

  if (typeof email !== "string" || !email.includes("@")) {
    return {
      ok: false,
      status: 400,
      error: "Format email tidak valid.",
    };
  }

  if (typeof password !== "string" || password.length < 6) {
    return {
      ok: false,
      status: 400,
      error: "Kata sandi minimal 6 karakter.",
    };
  }

  const existing = findUserByEmail(email);
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: "Email sudah terdaftar. Silakan login.",
    };
  }

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();

  const isMaster = MASTER_ADMIN_EMAILS.has(email.toLowerCase().trim());
  const initialRole = isMaster ? "ADMIN" : "USER";

  const user = createUser({
    id,
    email,
    name: String(name).slice(0, 80),
    passwordHash,
    role: initialRole,
  });

  const token = createToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    ok: true,
    status: 200,
    token,
    user: sanitizeUser(user),
  };
}

