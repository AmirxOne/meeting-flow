import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { changeRoom } from "@/server/services/meeting.service";
import { prisma } from "@/server/db";

const schema = z.object({ roomId: z.string().min(1, "اتاق را انتخاب کنید") });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = schema.parse(await req.json().catch(() => ({})));

    const meeting = await prisma.meeting.findFirst({ where: { id, orgId: user.orgId } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");

    const isOwner = meeting.organizerId === user.id;
    if (!isOwner && !can(user, "meeting:change-room")) {
      throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    }

    const oldRoomId = meeting.roomId;
    const updated = await changeRoom(id, input.roomId, { actorId: user.id, orgId: user.orgId });
    await audit({
      actorId: user.id, action: "MEETING_ROOM_CHANGE", entity: "Meeting", entityId: id,
      oldValue: { roomId: oldRoomId }, newValue: { roomId: input.roomId },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ meeting: updated });
  } catch (e) {
    return handleError(e);
  }
}
