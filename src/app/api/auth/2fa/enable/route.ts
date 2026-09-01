import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { requireUser, SESSION_COOKIE } from "@/server/auth/session";
import { totpCodeSchema } from "@/lib/validations";
import { ok, handleError, audit } from "@/server/http";
import { enableTwoFactor } from "@/server/services/two-factor.service";

export const dynamic = "force-dynamic";

/** POST /api/auth/2fa/enable — confirm TOTP, persist recovery codes, drop other sessions. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = totpCodeSchema.parse(await req.json().catch(() => ({})));
    const store = await cookies();
    const keepSession = store.get(SESSION_COOKIE)?.value;
    const { recoveryCodes } = await enableTwoFactor(user.id, input.code, keepSession);

    await audit({
      actorId: user.id,
      action: "ENABLE_2FA",
      entity: "User",
      entityId: user.id,
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ enabled: true, recoveryCodes });
  } catch (e) {
    return handleError(e);
  }
}
