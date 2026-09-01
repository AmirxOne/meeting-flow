import { requireUser } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { startTwoFactorSetup } from "@/server/services/two-factor.service";

export const dynamic = "force-dynamic";

/** POST /api/auth/2fa/setup — generate a pending TOTP secret + QR (not yet enabled). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const setup = await startTwoFactorSetup({ id: user.id, email: user.email });
    await audit({
      actorId: user.id,
      action: "SETUP_2FA",
      entity: "User",
      entityId: user.id,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok(setup);
  } catch (e) {
    return handleError(e);
  }
}
