import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { notificationPrefsPatchSchema } from "@/lib/validations";
import {
  getNotificationPrefsForUser,
  patchNotificationPrefsForUser,
} from "@/server/services/notification-prefs.service";

export const dynamic = "force-dynamic";

/** GET /api/notifications/preferences — resolved channel matrix for the current user. */
export async function GET() {
  try {
    const user = await requireUser();
    return ok(await getNotificationPrefsForUser(user.id));
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/notifications/preferences — merge per-event channel opt-outs. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const patch = notificationPrefsPatchSchema.parse(await req.json().catch(() => ({})));
    const data = await patchNotificationPrefsForUser(user.id, patch);
    await audit({
      actorId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      newValue: { notificationPrefs: patch },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}
