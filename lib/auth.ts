import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { findUserById, DbUser } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "casper-academy-secret-2026-production-v1";
const COOKIE_NAME = "sc_auth_token";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
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
  } catch (e) {
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
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    }
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload?.userId) return null;

    return findUserById(payload.userId);
  } catch (e) {
    return null;
  }
}

export { COOKIE_NAME };
