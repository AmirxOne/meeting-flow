import { NextRequest } from "next/server";
import { requireUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { startMeeting } from "@/server/services/meeting.service";
import { prisma } from "@/server/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await prisma.meeting.findFirst({ where: { id, orgId: user.orgId } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
    if (meeting.organizerId !== user.id && !can(user, "meeting:start")) {
      throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    }
    const updated = await startMeeting(id, { actorId: user.id, orgId: user.orgId });
    await audit({ actorId: user.id, action: "MEETING_START", entity: "Meeting", entityId: id, newValue: { status: "IN_PROGRESS" } });
    return ok({ meeting: updated });
  } catch (e) {
    return handleError(e);
  }
}
