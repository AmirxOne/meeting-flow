import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { loginSchema } from "@/lib/validations";
import { SESSION_COOKIE, createSession, destroySession } from "@/server/auth/session";
import { ok, fail, handleError } from "@/server/http";
import { getLoginRateLimiter } from "@/server/rate-limit/login-rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (await getLoginRateLimiter().isLimited(ip)) {
      return fail(429, "تلاش بیش از حد — بعداً تلاش کنید", "RATE_LIMITED");
    }

    const body = await req.json().catch(() => ({}));
    const input = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !user.isActive) {
      return fail(401, "ایمیل یا رمز عبور اشتباه است", "BAD_CREDENTIALS");
    }

    const { compare } = await import("bcryptjs");
    const valid = await compare(input.password, user.passwordHash);
    if (!valid) {
      return fail(401, "ایمیل یا رمز عبور اشتباه است", "BAD_CREDENTIALS");
    }

    const token = await createSession(user.id);
    const res = ok({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        jobTitle: user.jobTitle,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Number(process.env.SESSION_TTL_HOURS ?? 72) * 3600,
    });
    return res;
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE() {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await destroySession(token);
    const res = NextResponse.json({ ok: true, data: { loggedOut: true } });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return handleError(e);
  }
}
