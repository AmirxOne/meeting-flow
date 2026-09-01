import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { getTwoFactorStatus } from "@/server/services/two-factor.service";

export const dynamic = "force-dynamic";

/** GET /api/auth/2fa — current user's TOTP status (no secret). */
export async function GET() {
  try {
    const user = await requireUser();
    const status = await getTwoFactorStatus(user.id);
    return ok(status);
  } catch (e) {
    return handleError(e);
  }
}
