import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";
import { verifyPassword, createToken, COOKIE_NAME, sanitizeUser, shouldUseSecureCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email dan kata sandi wajib diisi." },
        { status: 400 }
      );
    }

    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Email atau kata sandi tidak sesuai." },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Email atau kata sandi tidak sesuai." },
        { status: 401 }
      );
    }

    const token = createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const res = NextResponse.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: shouldUseSecureCookie(),
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (error: unknown) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat memproses login." },
      { status: 500 }
    );
  }
}
