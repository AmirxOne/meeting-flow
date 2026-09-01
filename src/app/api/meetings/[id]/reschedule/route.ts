import { NextRequest } from "next/server";
import { requireUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { rescheduleSchema } from "@/lib/validations";
import { rescheduleMeeting } from "@/server/services/meeting.service";
import { prisma } from "@/server/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = rescheduleSchema.parse(body);

    const meeting = await prisma.meeting.findFirst({ where: { id, orgId: user.orgId } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");

    const isOwner = meeting.organizerId === user.id;
    if (!isOwner && !can(user, "meeting:reschedule")) {
      throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    }

    const updated = await rescheduleMeeting(
      id,
      {
        startAt: input.startAt ? new Date(input.startAt) : undefined,
        endAt: input.endAt ? new Date(input.endAt) : undefined,
        roomId: input.roomId,
        reason: input.reason,
        scope: input.scope,
      },
      { actorId: user.id, orgId: user.orgId },
    );
    await audit({
      actorId: user.id, action: "MEETING_RESCHEDULE", entity: "Meeting", entityId: id,
      oldValue: { startAt: meeting.startAt, endAt: meeting.endAt, roomId: meeting.roomId },
      newValue: { startAt: updated.startAt, endAt: updated.endAt, roomId: updated.roomId },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ meeting: updated });
  } catch (e) {
    return handleError(e);
  }
}
