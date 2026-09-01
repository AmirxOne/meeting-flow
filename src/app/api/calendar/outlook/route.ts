import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import {
  disconnectCalendar,
  getUserCalendarStatus,
} from "@/server/services/calendar-connection.service";
import { shouldUseRealOutlookOAuth } from "@/server/services/outlook-calendar-oauth";

export const dynamic = "force-dynamic";

/** GET /api/calendar/outlook — connection status for the signed-in user. */
export async function GET() {
  try {
    const user = await requireUser();
    const status = await getUserCalendarStatus(user.id, shouldUseRealOutlookOAuth(), "outlook");
    return ok({
      connected: status.connected,
      provider: status.provider,
      accountEmail: status.accountEmail,
      connectedAt: status.connectedAt,
      configured: status.configured,
    });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/calendar/outlook — disconnect Outlook. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    await disconnectCalendar(user.id, ["outlook"]);
    await audit({
      actorId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      newValue: { outlookCalendar: "disconnected" },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ connected: false });
  } catch (e) {
    return handleError(e);
  }
}
