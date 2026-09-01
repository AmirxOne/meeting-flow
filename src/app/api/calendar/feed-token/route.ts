import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import {
  calendarFeedUrls,
  getCalendarFeedStatus,
  publicOrigin,
  revokeCalendarFeedToken,
  rotateCalendarFeedToken,
} from "@/server/services/ics-feed.service";

export const dynamic = "force-dynamic";

/** GET /api/calendar/feed-token — whether this user has an active subscribe token. */
export async function GET() {
  try {
    const user = await requireUser();
    const status = await getCalendarFeedStatus(user.id);
    return ok(status);
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/calendar/feed-token — create or rotate the personal subscribe token. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { token, createdAt } = await rotateCalendarFeedToken(user.id);
    const urls = calendarFeedUrls(publicOrigin(req), token);
    await audit({
      actorId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      newValue: { calendarFeed: "rotated" },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ ...urls, token, createdAt, enabled: true });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/calendar/feed-token — revoke the personal subscribe token. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    await revokeCalendarFeedToken(user.id);
    await audit({
      actorId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      newValue: { calendarFeed: "revoked" },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ enabled: false });
  } catch (e) {
    return handleError(e);
  }
}
