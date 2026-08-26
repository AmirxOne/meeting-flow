import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { participantAddSchema } from "@/lib/validations";
import { addParticipant, removeParticipant } from "@/server/services/meeting.service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const participants = await prisma.meetingParticipant.findMany({
      where: { meetingId: id },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true, jobTitle: true } } },
      orderBy: { createdAt: "asc" },
    });
    return ok({ participants });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = participantAddSchema.parse(await req.json().catch(() => ({})));

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
    if (meeting.organizerId !== user.id && !can(user, "meeting:add-participant")) {
      throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    }

    const p = await addParticipant(id, input.userId, { actorId: user.id }, { required: input.required });
    await audit({ actorId: user.id, action: "PARTICIPANT_ADD", entity: "Meeting", entityId: id, newValue: { userId: input.userId } });
    return ok({ participant: p }, 201);
  } catch (e) {
    return handleError(e);
  }
}

const deleteSchema = z.object({ userId: z.string().min(1) });

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = deleteSchema.parse(await req.json().catch(() => ({})));

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
    if (meeting.organizerId !== user.id && !can(user, "meeting:remove-participant")) {
      throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    }

    await removeParticipant(id, input.userId, { actorId: user.id });
    await audit({ actorId: user.id, action: "PARTICIPANT_REMOVE", entity: "Meeting", entityId: id, oldValue: { userId: input.userId } });
    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
