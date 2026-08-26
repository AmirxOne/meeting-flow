import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { endMeeting } from "@/server/services/meeting.service";
import { prisma } from "@/server/db";

const schema = z.object({ noShow: z.boolean().default(false) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = schema.parse(await req.json().catch(() => ({})));
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
    if (meeting.organizerId !== user.id && !can(user, "meeting:end")) {
      throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    }
    const updated = await endMeeting(id, { actorId: user.id }, { noShow: input.noShow });
    await audit({ actorId: user.id, action: "MEETING_END", entity: "Meeting", entityId: id, newValue: { status: updated.status } });
    return ok({ meeting: updated });
  } catch (e) {
    return handleError(e);
  }
}
