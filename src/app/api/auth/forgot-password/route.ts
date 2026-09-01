import { NextRequest } from "next/server";
import { forgotPasswordSchema } from "@/lib/validations";
import { ok, fail, handleError, audit } from "@/server/http";
import { publicOrigin } from "@/server/services/ics-feed.service";
import { requestPasswordReset } from "@/server/services/password-reset.service";
import { getLoginRateLimiter } from "@/server/rate-limit/login-rate-limit";

export const dynamic = "force-dynamic";

/** POST /api/auth/forgot-password — email a one-time reset link/code. */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const limiter = getLoginRateLimiter();
    if (await limiter.isLimited(`forgot:${ip}`)) {
      return fail(429, "تلاش بیش از حد — بعداً تلاش کنید", "RATE_LIMITED");
    }

    const input = forgotPasswordSchema.parse(await req.json().catch(() => ({})));
    if (await limiter.isLimited(`forgot-id:${input.identifier.toLowerCase()}`)) {
      return fail(429, "تلاش بیش از حد — بعداً تلاش کنید", "RATE_LIMITED");
    }

    const result = await requestPasswordReset(input.identifier, publicOrigin(req));
    await audit({
      actorId: null,
      action: "PASSWORD_RESET_REQUEST",
      entity: "User",
      entityId: input.identifier.slice(0, 80),
      ip,
    });
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
