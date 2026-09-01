import { NextRequest } from "next/server";
import { ok, handleError } from "@/server/http";
import { getGuestByCheckinCode, checkInGuest, wayfindingFromGuest } from "@/server/services/guest-checkin.service";

export const dynamic = "force-dynamic";

/** GET /api/checkin/:code — public lookup for guest check-in page. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const guest = await getGuestByCheckinCode(code);
    return ok({
      guest: {
        id: guest.id,
        name: guest.name,
        company: guest.company,
        arrivedAt: guest.arrivedAt,
        checkinCode: guest.checkinCode,
      },
      meeting: {
        id: guest.meeting.id,
        title: guest.meeting.title,
        startAt: guest.meeting.startAt,
        endAt: guest.meeting.endAt,
        status: guest.meeting.status,
        branchName: guest.meeting.branch.name,
        roomName: guest.meeting.room?.name ?? null,
      },
      wayfinding: wayfindingFromGuest(guest),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/checkin/:code — public self check-in by code (no login). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const guest = await getGuestByCheckinCode(code);
    const result = await checkInGuest({
      meetingId: guest.meetingId,
      guestId: guest.id,
      checkinCode: code,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({
      guest: {
        id: result.guest.id,
        name: guest.name,
        arrivedAt: result.guest.arrivedAt,
      },
      alreadyCheckedIn: result.alreadyCheckedIn,
    });
  } catch (e) {
    return handleError(e);
  }
}
