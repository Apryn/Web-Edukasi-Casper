import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { findUserByEmail, createUser } from "@/lib/db";
import { hashPassword, createToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Nama, email, dan kata sandi wajib diisi." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Kata sandi minimal 6 karakter." },
        { status: 400 }
      );
    }

    // Check duplicate
    const existing = findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan login." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const id = crypto.randomUUID();

    const user = createUser({
      id,
      email,
      name,
      passwordHash,
      role: "USER",
    });

    const token = createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const res = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return res;
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat mendaftarkan akun." },
      { status: 500 }
    );
  }
}
