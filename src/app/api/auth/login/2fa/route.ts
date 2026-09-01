import { NextRequest } from "next/server";
import { twoFactorLoginSchema } from "@/lib/validations";
import { getAuthenticatedUser } from "@/server/auth/login.service";
import { buildLoginResponse } from "@/server/auth/login-response";
import { fail, handleError } from "@/server/http";
import { getLoginRateLimiter } from "@/server/rate-limit/login-rate-limit";
import { completeTwoFactorLogin } from "@/server/services/two-factor.service";

export const dynamic = "force-dynamic";

/** POST /api/auth/login/2fa — complete login after password/LDAP with TOTP or recovery code. */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (await getLoginRateLimiter().isLimited(`2fa:${ip}`)) {
      return fail(429, "تلاش بیش از حد — بعداً تلاش کنید", "RATE_LIMITED");
    }

    const input = twoFactorLoginSchema.parse(await req.json().catch(() => ({})));
    const { userId } = await completeTwoFactorLogin({
      challengeToken: input.challengeToken,
      code: input.code,
      recoveryCode: input.recoveryCode,
    });
    const user = await getAuthenticatedUser(userId);
    return buildLoginResponse(user);
  } catch (e) {
    return handleError(e);
  }
}
