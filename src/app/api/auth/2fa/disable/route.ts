import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { twoFactorDisableSchema } from "@/lib/validations";
import { ok, handleError, audit } from "@/server/http";
import { disableTwoFactor } from "@/server/services/two-factor.service";

export const dynamic = "force-dynamic";

/** POST /api/auth/2fa/disable — turn off TOTP (does not wipe sessions). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = twoFactorDisableSchema.parse(await req.json().catch(() => ({})));
    await disableTwoFactor(user.id, input);

    await audit({
      actorId: user.id,
      action: "DISABLE_2FA",
      entity: "User",
      entityId: user.id,
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ enabled: false });
  } catch (e) {
    return handleError(e);
  }
}
