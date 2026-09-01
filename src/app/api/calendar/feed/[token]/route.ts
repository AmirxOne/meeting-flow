import { NextRequest } from "next/server";
import { HttpError } from "@/server/auth/session";
import { handleError } from "@/server/http";
import {
  buildOwnMeetingsIcs,
  findUserByFeedToken,
  icsResponse,
  publicOrigin,
} from "@/server/services/ics-feed.service";

export const dynamic = "force-dynamic";

/** GET /api/calendar/feed/:token — public personal ICS (Outlook/Google subscribe). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const owner = await findUserByFeedToken(token);
    if (!owner) {
      throw new HttpError(404, "لینک تقویم نامعتبر یا باطل شده است", "FEED_NOT_FOUND");
    }
    const ics = await buildOwnMeetingsIcs(owner.id, {
      origin: publicOrigin(req),
      calendarName: `جلسات ${owner.fullName}`,
    });
    return icsResponse(ics, "mehrsa-calendar.ics", "inline");
  } catch (e) {
    return handleError(e);
  }
}
