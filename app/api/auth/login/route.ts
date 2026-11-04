import { NextResponse } from "next/server";
import { COOKIE_NAME, shouldUseSecureCookie } from "@/lib/auth";
import { processLoginRequest } from "@/lib/server-auth";
import { getClientIpFromRequest, checkLoginRateLimit, recordFailedLoginAttempt } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Pre-check rate limit before parsing JSON body
    const clientIp = getClientIpFromRequest(req);
    const preCheck = checkLoginRateLimit(clientIp);
    if (!preCheck.allowed) {
      return NextResponse.json(
        {
          error:
            "Terlalu banyak percobaan login yang gagal. Silakan coba lagi setelah beberapa saat.",
          retryAfterSeconds: preCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(preCheck.retryAfterSeconds) },
        }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      recordFailedLoginAttempt(clientIp);
      return NextResponse.json(
        { error: "Payload request tidak valid." },
        { status: 400 }
      );
    }

    const result = await processLoginRequest(req, body);

    if (!result.ok || !result.token || !result.user) {
      return NextResponse.json(
        {
          error: result.error || "Email atau kata sandi tidak sesuai.",
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
