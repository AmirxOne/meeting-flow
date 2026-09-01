import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { pushSubscribeSchema, pushUnsubscribeSchema } from "@/lib/validations";
import {
  deletePushSubscriptions,
  listPushStatus,
  savePushSubscription,
} from "@/server/services/web-push.service";

export const dynamic = "force-dynamic";

/** GET /api/push — VAPID public key + whether this user has a subscription. */
export async function GET() {
  try {
    const user = await requireUser();
    return ok(await listPushStatus(user.id));
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/push — save a browser PushSubscription (opt-in). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = pushSubscribeSchema.parse(await req.json().catch(() => ({})));
    await savePushSubscription({
      userId: user.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: req.headers.get("user-agent"),
    });
    await audit({
      actorId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      newValue: { webPush: "subscribed" },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ subscribed: true });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/push — remove this device or all devices. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = pushUnsubscribeSchema.parse(await req.json().catch(() => ({})));
    await deletePushSubscriptions(user.id, input.endpoint);
    await audit({
      actorId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      newValue: { webPush: "unsubscribed" },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ subscribed: false });
  } catch (e) {
    return handleError(e);
  }
}
