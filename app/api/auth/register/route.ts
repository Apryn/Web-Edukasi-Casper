import { NextResponse } from "next/server";
import { COOKIE_NAME, shouldUseSecureCookie } from "@/lib/auth";
import { processRegisterRequest } from "@/lib/server-auth";
import { getClientIpFromRequest, consumeRegisterRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      const clientIp = getClientIpFromRequest(req);
      const regLimit = consumeRegisterRateLimit(clientIp);
      if (!regLimit.allowed) {
        return NextResponse.json(
          {
            error:
              "Terlalu banyak percobaan pendaftaran akun. Silakan coba lagi setelah beberapa saat.",
            retryAfterSeconds: regLimit.retryAfterSeconds,
          },
          {
            status: 429,
            headers: { "Retry-After": String(regLimit.retryAfterSeconds) },
          }
        );
      }
      return NextResponse.json(
        { error: "Payload request tidak valid." },
        { status: 400 }
      );
    }

    const result = await processRegisterRequest(req, body);

    if (!result.ok || !result.token || !result.user) {
      return NextResponse.json(
        {
          error: result.error || "Gagal mendaftarkan akun.",
          ...(result.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: result.retryAfterSeconds }
            : {}),
        },
        {
          status: result.status,
          headers: result.headers,
        }
      );
    }

    const res = NextResponse.json({
      success: true,
      token: result.token,
      user: result.user,
    });

    res.cookies.set(COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: shouldUseSecureCookie(),
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return res;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("sudah terdaftar")) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan login." },
        { status: 409 }
      );
    }
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat mendaftarkan akun." },
      { status: 500 }
    );
  }
}
