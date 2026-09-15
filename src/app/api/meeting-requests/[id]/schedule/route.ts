import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, fail, handleError, audit } from "@/server/http";
import { createMeeting } from "@/server/services/meeting.service";

export const dynamic = "force-dynamic";

const scheduleSchema = z.object({
  branchId: z.string().min(1),
  roomId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  meetingType: z.enum(["INTERNAL", "EXTERNAL", "CROSS_TEAM"]).default("INTERNAL"),
});

function canSchedule(user: { isSuperAdmin?: boolean; roleKeys: string[] }) {
  return (
    !!user.isSuperAdmin ||
    user.roleKeys.some((r) => ["SUPER_ADMIN", "ADMIN", "MEETING_OPERATOR"].includes(r))
  );
}

/**
 * POST /api/meeting-requests/[id]/schedule — admin fixes the meeting:
 * creates a real Meeting from the request, invites everyone, closes the request.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (!canSchedule(user)) {
      return fail(403, "فقط مدیر یا اپراتور می‌تواند جلسه را هماهنگ کند", "FORBIDDEN");
    }
    const { id } = await params;
    const input = scheduleSchema.parse(await req.json().catch(() => ({})));

    const request = await prisma.meetingRequest.findUnique({
      where: { id },
      include: { requester: true },
    });
    if (!request) return fail(404, "درخواست یافت نشد", "NOT_FOUND");
    if (request.status !== "OPEN")
      return fail(409, "این درخواست قبلاً پردازش شده است", "ALREADY_HANDLED");
    // Guest requests CAN be scheduled now: the admin becomes the organizer and
    // the guest is attached as an external guest of the meeting.

    const meeting = await createMeeting({
      title: request.title,
      description: request.description ?? undefined,
      orgId: request.orgId,
      branchId: input.branchId,
      roomId: input.roomId,
      organizerId: request.requesterId ?? user.id,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      meetingType: input.meetingType,
      participantIds: Array.from(
        new Set<string>([...request.participantIds, ...(request.requesterId ? [user.id] : [])]),
      ).filter((x) => x !== request.requesterId),
      guests: Array.isArray(request.guests)
        ? (request.guests as { name: string; company?: string; phone?: string }[])
        : request.guestName
          ? [{ name: request.guestName, company: request.guestCompany ?? undefined, phone: request.guestPhone ?? undefined }]
          : [],
    });

    await prisma.meetingRequest.update({
      where: { id },
      data: { status: "SCHEDULED", meetingId: meeting.id },
    });
    await audit({
      actorId: user.id,
      action: "meeting-request.schedule",
      entity: "MeetingRequest",
      entityId: id,
      newValue: { meetingId: meeting.id },
    });
    return ok({ meeting, request: { ...request, status: "SCHEDULED", meetingId: meeting.id } });
  } catch (e) {
    return handleError(e);
  }
}
