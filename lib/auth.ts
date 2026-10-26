import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserById, type DbUser } from "./db.ts";

const DEFAULT_SECRET = "casper-academy-secret-2026-production-v1";
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const COOKIE_NAME = "sc_auth_token";

if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || JWT_SECRET === DEFAULT_SECRET)) {
  console.warn(
    "[SECURITY WARNING] JWT_SECRET belum diset di environment variables. Disarankan menambahkan JWT_SECRET yang kuat di file .env server produksi."
  );
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

export function isAdmin(user: DbUser | SafeUser | null | undefined): boolean {
  return user?.role === "ADMIN";
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
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

export { COOKIE_NAME };
