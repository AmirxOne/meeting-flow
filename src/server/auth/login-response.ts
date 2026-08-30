import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSession } from "@/server/auth/session";
import { ok } from "@/server/http";
import type { AuthenticatedUser } from "@/server/auth/login.service";

/** Attach session cookie to a login success response. */
export async function buildLoginResponse(user: AuthenticatedUser) {
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
}

export function buildLogoutResponse() {
  const res = NextResponse.json({ ok: true, data: { loggedOut: true } });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
