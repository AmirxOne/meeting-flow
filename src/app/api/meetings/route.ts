import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { maskPrivateMeeting, meetingAccessOr } from "@/server/services/privacy";
import { requireUser, can } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { meetingCreateSchema } from "@/lib/validations";
import { validateVideoLink } from "@/lib/video-link";
import { createMeeting, createMeetingSeries } from "@/server/services/meeting.service";
import { resolveOrganizerId } from "@/server/services/delegate.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const status = sp.get("status");
    const branchId = sp.get("branchId");
    const roomId = sp.get("roomId");
    const q = sp.get("q");
    const scope = sp.get("scope"); // mine | all

    const seeAll = can(user, "meeting:view-all") && scope !== "mine";

    const meetings = await prisma.meeting.findMany({
      where: {
        orgId: user.orgId,
        ...(seeAll
          ? {}
          : {
              OR: meetingAccessOr(user.id).OR,
            }),
        ...(from && to
          ? { startAt: { gte: new Date(from), lte: new Date(to) } }
          : {}),
        ...(status
          ? status === "WAITLISTED"
            ? { status: { in: ["WAITLISTED", "WAITLIST_OFFERED"] } }
            : { status }
          : { status: { not: "DRAFT" } }),
        ...(branchId ? { branchId } : {}),
        ...(roomId ? { roomId } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      include: {
        organizer: { select: { id: true, fullName: true, avatarUrl: true } },
        room: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        participants: { select: { userId: true, role: true, responseStatus: true } },
        _count: { select: { participants: true, guests: true } },
      },
      orderBy: { startAt: "asc" },
      take: Math.min(Number(sp.get("limit") ?? 200), 500),
    });
    const viewer = { id: user.id, isSuperAdmin: !!user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN") };
    const masked = meetings.map((m) => {
      const mine = m.participants.find((p) => p.userId === user.id && p.role !== "ORGANIZER");
      const { participants, ...rest } = maskPrivateMeeting(m, viewer);
      return {
        ...rest,
        myResponseStatus: mine?.responseStatus ?? null,
        participants: participants.map((p) => ({ userId: p.userId })),
      };
    });
    return ok({ meetings: masked });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!can(user, "meeting:create")) {
      return Response.json(
        { ok: false, error: { message: "دسترسی لازم را ندارید", code: "FORBIDDEN" } },
        { status: 403 },
      );
    }
    const body = await req.json();
    const input = meetingCreateSchema.parse(body);
    const video = validateVideoLink(input.videoProvider ?? null, input.videoUrl ?? null);
    const videoFields = video.ok ? video.value : { videoProvider: null, videoUrl: null };
    const organizerId = await resolveOrganizerId(user.orgId, user.id, input.organizerId);
    const createdById = organizerId !== user.id ? user.id : null;
    const shared = {
      title: input.title,
      description: input.description,
      orgId: user.orgId,
      branchId: input.branchId,
      roomId: input.roomId ?? undefined,
      organizerId,
      createdById,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      meetingType: input.meetingType,
      priority: input.priority,
      isPrivate: input.isPrivate,
      videoProvider: videoFields.videoProvider,
      videoUrl: videoFields.videoUrl,
      participantIds: input.participantIds,
      waitlistIfBusy: input.waitlistIfBusy,
      guests: input.guests
        .filter((g) => g.name)
        .map((g) => ({
          name: g.name,
          company: g.company || undefined,
          phone: g.phone || undefined,
          email: g.email || undefined,
          notes: g.notes || undefined,
        })),
    };

    if (input.recurrence) {
      const created = await createMeetingSeries({
        ...shared,
        recurrence: {
          freq: input.recurrence.freq,
          interval: input.recurrence.interval,
          byWeekday: input.recurrence.byWeekday,
          until: input.recurrence.until ? new Date(input.recurrence.until) : undefined,
          count: input.recurrence.count,
        },
      });
      await audit({
        actorId: user.id,
        action: "CREATE",
        entity: "MeetingSeries",
        entityId: created.series.id,
        newValue: {
          title: created.series.title,
          freq: created.series.freq,
          occurrenceCount: created.meetings.length,
          organizerId,
          createdById: user.id,
          ...(createdById ? { onBehalfOf: organizerId } : {}),
        },
        ip: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      });
      return ok(
        {
          meeting: created.meeting,
          series: created.series,
          occurrenceCount: created.meetings.length,
        },
        201,
      );
    }

    const meeting = await createMeeting(shared);

    await audit({
      actorId: user.id,
      action: "CREATE",
      entity: "Meeting",
      entityId: meeting.id,
      newValue: {
        title: meeting.title,
        startAt: meeting.startAt,
        roomId: meeting.roomId,
        organizerId,
        createdById: user.id,
        ...(createdById ? { onBehalfOf: organizerId } : {}),
      },
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    return ok({ meeting }, 201);
  } catch (e) {
    return handleError(e);
  }
}
