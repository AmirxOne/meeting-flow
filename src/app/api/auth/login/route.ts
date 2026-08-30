import { NextRequest } from "next/server";
import { loginSchema } from "@/lib/validations";
import { SESSION_COOKIE, destroySession } from "@/server/auth/session";
import { authenticateLogin } from "@/server/auth/login.service";
import { buildLoginResponse, buildLogoutResponse } from "@/server/auth/login-response";
import { fail, handleError } from "@/server/http";
import { getLoginRateLimiter } from "@/server/rate-limit/login-rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (await getLoginRateLimiter().isLimited(ip)) {
      return fail(429, "تلاش بیش از حد — بعداً تلاش کنید", "RATE_LIMITED");
    }

    const body = await req.json().catch(() => ({}));
    const input = loginSchema.parse(body);

    const user = await authenticateLogin(input.email, input.password);
    return buildLoginResponse(user);
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
    return buildLogoutResponse();
  } catch (e) {
    return handleError(e);
  }
}
