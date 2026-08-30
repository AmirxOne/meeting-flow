import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { changePasswordSchema } from "@/lib/validations";
import { changeOwnPassword } from "@/server/services/profile.service";

export const dynamic = "force-dynamic";

/** POST /api/auth/change-password — self-service password change. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = changePasswordSchema.parse(await req.json().catch(() => ({})));
    await changeOwnPassword(user.id, input.currentPassword, input.newPassword);

    await audit({
      actorId: user.id,
      action: "CHANGE_PASSWORD",
      entity: "User",
      entityId: user.id,
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ changed: true });
  } catch (e) {
    return handleError(e);
  }
}
