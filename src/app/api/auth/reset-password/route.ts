import { NextRequest } from "next/server";
import { completePasswordResetSchema } from "@/lib/validations";
import { ok, fail, handleError, audit } from "@/server/http";
import { completePasswordReset } from "@/server/services/password-reset.service";
import { getLoginRateLimiter } from "@/server/rate-limit/login-rate-limit";

export const dynamic = "force-dynamic";

/** POST /api/auth/reset-password — consume one-time token/code and set a new password. */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (await getLoginRateLimiter().isLimited(`reset:${ip}`)) {
      return fail(429, "تلاش بیش از حد — بعداً تلاش کنید", "RATE_LIMITED");
    }

    const input = completePasswordResetSchema.parse(await req.json().catch(() => ({})));
    await completePasswordReset({
      token: input.token,
      identifier: input.identifier,
      code: input.code,
      newPassword: input.password,
    });
    await audit({
      actorId: null,
      action: "PASSWORD_RESET",
      entity: "User",
      entityId: input.token ? "token" : "code",
      ip,
    });
    return ok({ reset: true });
  } catch (e) {
    return handleError(e);
  }
}
