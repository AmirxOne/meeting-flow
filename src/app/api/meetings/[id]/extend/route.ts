import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { extendSchema } from "@/lib/validations";
import { extendMeeting } from "@/server/services/meeting.service";
import { prisma } from "@/server/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = extendSchema.parse(await req.json().catch(() => ({})));

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");

    const isOwner = meeting.organizerId === user.id;
    const isParticipant = meeting.organizerId === user.id;
    if (!isOwner && !isParticipant) {
      // allow any participant? spec says live management — organizer/room manager
      throw new HttpError(403, "فقط برگزارکننده می‌تواند تمدید کند", "FORBIDDEN");
    }

    const updated = await extendMeeting(id, input.minutes, { actorId: user.id });
    await audit({
      actorId: user.id, action: "MEETING_EXTEND", entity: "Meeting", entityId: id,
      newValue: { endAt: updated.endAt }, ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ meeting: updated });
  } catch (e) {
    return handleError(e);
  }
}
