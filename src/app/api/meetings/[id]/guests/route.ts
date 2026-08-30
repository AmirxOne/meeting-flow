import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { guestAddSchema } from "@/lib/validations";
import { generateCheckinCode } from "@/server/services/guest-checkin.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = guestAddSchema.parse(await req.json().catch(() => ({})));

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
    if (meeting.organizerId !== user.id && !can(user, "meeting:add-participant")) {
      throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    }
    if (["COMPLETED", "NO_SHOW", "CANCELLED", "REJECTED"].includes(meeting.status)) {
      throw new HttpError(400, "نمی‌توان به این جلسه مهمان اضافه کرد", "BAD_STATE");
    }

    const checkinCode = await generateCheckinCode();

    const guest = await prisma.meetingGuest.create({
      data: {
        meetingId: id,
        name: input.name,
        company: input.company || null,
        phone: input.phone || null,
        email: input.email || null,
        notes: input.notes || null,
        checkinCode,
      },
    });
    await prisma.meetingEvent.create({
      data: { meetingId: id, type: "GUEST_ADDED", actorId: user.id, data: { name: input.name } },
    });
    await audit({
      actorId: user.id, action: "GUEST_ADD", entity: "MeetingGuest", entityId: guest.id,
      newValue: { name: input.name },
    });
    return ok({ guest }, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { guestId?: string };
    if (!body.guestId) throw new HttpError(400, "guestId الزامی است", "BAD_REQUEST");

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
    if (meeting.organizerId !== user.id && !can(user, "meeting:add-participant")) {
      throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    }

    await prisma.meetingGuest.deleteMany({ where: { id: body.guestId, meetingId: id } });
    await prisma.meetingEvent.create({
      data: { meetingId: id, type: "GUEST_REMOVED", actorId: user.id, data: { guestId: body.guestId } },
    });
    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
