import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { getSessionUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { guestCheckinSchema } from "@/lib/validations";
import { checkInGuest } from "@/server/services/guest-checkin.service";

/** POST /api/meetings/:id/guests/:guestId/checkin — guest self-checkin or organizer manual. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  try {
    const { id, guestId } = await params;
    const body = guestCheckinSchema.parse(await req.json().catch(() => ({})));
    const user = await getSessionUser();

    let manual = false;
    if (user) {
      const meeting = await prisma.meeting.findFirst({
        where: { id, orgId: user.orgId },
        select: { organizerId: true },
      });
      if (
        meeting &&
        (meeting.organizerId === user.id ||
          can(user, "meeting:manage-guests") ||
          can(user, "meeting:add-participant"))
      ) {
        manual = true;
      }
    }

    if (!manual && !body.code && !body.meetingCode) {
      throw new HttpError(400, "کد ورود یا meetingCode الزامی است", "BAD_REQUEST");
    }

    const result = await checkInGuest({
      meetingId: id,
      guestId,
      checkinCode: body.code,
      meetingCode: body.meetingCode,
      manual,
      actorId: user?.id,
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({
      guest: result.guest,
      alreadyCheckedIn: result.alreadyCheckedIn,
    });
  } catch (e) {
    return handleError(e);
  }
}
