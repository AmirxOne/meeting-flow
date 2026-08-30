import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { participantRespondSchema } from "@/lib/validations";
import { respondToMeeting } from "@/server/services/meeting.service";

export const dynamic = "force-dynamic";

/** POST /api/meetings/:id/participants/respond — RSVP by invitee or organizer. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = participantRespondSchema.parse(await req.json().catch(() => ({})));

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");

    const participant = await respondToMeeting(
      id,
      input.responseStatus,
      { actorId: user.id },
      input.userId,
    );

    await audit({
      actorId: user.id,
      action: "PARTICIPANT_RESPOND",
      entity: "Meeting",
      entityId: id,
      newValue: { userId: participant.userId, responseStatus: input.responseStatus },
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ participant });
  } catch (e) {
    return handleError(e);
  }
}
