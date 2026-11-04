import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserById, type DbUser } from "./db.ts";

const DEV_FALLBACK_SECRET = "casper-academy-dev-only-secret-local";
const FORBIDDEN_PRODUCTION_SECRETS = new Set([
  "casper-academy-secret-2026-production-v1",
  DEV_FALLBACK_SECRET,
]);
const COOKIE_NAME = "sc_auth_token";

export const MASTER_ADMIN_EMAILS = new Set<string>([
  "apryn@casper.com",
  "apriyanriyan23@gmail.com",
]);

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32 || FORBIDDEN_PRODUCTION_SECRETS.has(secret)) {
      throw new Error(
        "[CRITICAL SECURITY] JWT_SECRET wajib tersedia di environment production (minimal 32 karakter) dan dilarang menggunakan fallback secret."
      );
    }
    return secret;
  }
  return secret || DEV_FALLBACK_SECRET;
}

export function shouldUseSecureCookie(): boolean {
  if (process.env.NODE_ENV === "production") {
    return process.env.COOKIE_SECURE !== "false";
  }
  return process.env.COOKIE_SECURE === "true";
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}

export function sanitizeUser(user: DbUser): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export function isMasterAdmin(user: DbUser | SafeUser | null | undefined): boolean {
  if (!user?.email) return false;
  return MASTER_ADMIN_EMAILS.has(user.email.toLowerCase().trim()) || user.role === "MASTER_ADMIN";
}

export function isAdmin(user: DbUser | SafeUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || user.role === "MASTER_ADMIN" || isMasterAdmin(user);
}

export function isMentorOrAdmin(user: DbUser | SafeUser | null | undefined): boolean {
  if (!user) return false;
  return (
    user.role === "ADMIN" ||
    user.role === "MENTOR" ||
    user.role === "MASTER_ADMIN" ||
    isMasterAdmin(user)
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(payload: TokenPayload): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
}

export async function getSessionUser(req?: Request): Promise<DbUser | null> {
  try {
    let token: string | undefined;
    if (req) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }
    if (!token) {
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        token = cookieStore.get(COOKIE_NAME)?.value;
      } catch {
        token = undefined;
      }
    }
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload?.userId) return null;

    return findUserById(payload.userId);
  } catch {
    return null;
  }
}

export { COOKIE_NAME, type DbUser };
