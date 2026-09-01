import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { handleError } from "@/server/http";
import {
  buildOwnMeetingsIcs,
  icsResponse,
  publicOrigin,
} from "@/server/services/ics-feed.service";

export const dynamic = "force-dynamic";

/** GET /api/calendar/ics — download the signed-in user's meetings as .ics */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
    const to = sp.get("to") ? new Date(sp.get("to")!) : undefined;
    const ics = await buildOwnMeetingsIcs(user.id, {
      from,
      to,
      origin: publicOrigin(req),
      calendarName: `جلسات ${user.fullName}`,
    });
    return icsResponse(ics, "mehrsa-calendar.ics", "attachment");
  } catch (e) {
    return handleError(e);
  }
}
