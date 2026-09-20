import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, fail, handleError, audit } from "@/server/http";
import { createMeeting, createMeetingSeries } from "@/server/services/meeting.service";

export const dynamic = "force-dynamic";

const scheduleSchema = z.object({
  /// required for ONSITE requests; OFFSITE (at another org) needs no room
  branchId: z.string().optional(),
  roomId: z.string().optional(),
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
    // room check is done per-venue below (OFFSITE skips it)

    const request = await prisma.meetingRequest.findUnique({
      where: { id },
      include: { requester: true },
    });
    if (!request) return fail(404, "درخواست یافت نشد", "NOT_FOUND");
    if (request.status !== "OPEN")
      return fail(409, "این درخواست قبلاً پردازش شده است", "ALREADY_HANDLED");
    // Guest requests CAN be scheduled now: the admin becomes the organizer and
    // the guest is attached as an external guest of the meeting.

    const offsite = request.venue === "OFFSITE";
    const shared = {
      title: request.title,
      description: [
        request.description ?? undefined,
        offsite
          ? "📍 محل جلسه: " + (request.offsiteOrg ?? "بیرون از شرکت") + (request.offsiteNote ? " — " + request.offsiteNote : "")
          : undefined,
      ]
        .filter(Boolean)
        .join("\n\n") || undefined,
      orgId: request.orgId,
      // offsite: no room/branch — the meeting happens at the other organization
      ...(offsite ? {} : { branchId: input.branchId!, roomId: input.roomId! }),
      organizerId: request.requesterId ?? user.id,
      isPrivate: request.isPrivate,
      meetingType: offsite ? "EXTERNAL" : input.meetingType,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      participantIds: Array.from(
        new Set<string>([...request.participantIds, ...(request.requesterId ? [user.id] : [])]),
      ).filter((x) => x !== request.requesterId),
      guests: Array.isArray(request.guests)
        ? (request.guests as { name: string; company?: string; phone?: string }[])
        : request.guestName
          ? [{ name: request.guestName, company: request.guestCompany ?? undefined, phone: request.guestPhone ?? undefined }]
          : [],
    };
    // requested recurrence → create a SERIES of meetings
    const rec = (request.recReq as { freq?: string; count?: number } | null) ?? null;
    if (rec && rec.freq) {
      const created = await createMeetingSeries({
        ...shared,
        recurrence: { freq: rec.freq as "DAILY" | "WEEKLY" | "MONTHLY", interval: 1, count: rec.count },
      });
      await prisma.meetingRequest.update({
        where: { id },
        data: { status: "SCHEDULED", meetingId: created.meeting.id },
      });
      await audit({
        actorId: user.id,
        action: "meeting-request.schedule",
        entity: "MeetingRequest",
        entityId: id,
        newValue: { meetingId: created.meeting.id, series: true, occurrences: created.meetings.length },
      });
      return ok(
        { meeting: created.meeting, series: created.series, occurrenceCount: created.meetings.length, request: { ...request, status: "SCHEDULED", meetingId: created.meeting.id } },
        201,
      );
    }

    const meeting = await createMeeting(shared);

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
