import { NextRequest } from "next/server";
import { requireUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { cancelSchema } from "@/lib/validations";
import { cancelMeeting } from "@/server/services/meeting.service";
import { prisma } from "@/server/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = cancelSchema.parse(body);

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");

    const isOwner = meeting.organizerId === user.id;
    if (!isOwner && !can(user, "meeting:cancel")) {
      throw new HttpError(403, "فقط برگزارکننده یا مدیر می‌تواند لغو کند", "FORBIDDEN");
    }

    const cancelled = await cancelMeeting(id, input, { actorId: user.id });
    await audit({
      actorId: user.id, action: "MEETING_CANCEL", entity: "Meeting", entityId: id,
      newValue: { status: "CANCELLED", reason: input.reason }, ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ meeting: cancelled });
  } catch (e) {
    return handleError(e);
  }
}
