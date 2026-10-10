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
      // همه‌ی ردیف‌های مرتبط fetch می‌شوند تا مرتب‌سازی عملیاتی چیزی را «بیرون» نگذارد
      take: 1000,
    });

    // مرتب‌سازی عملیاتی: درخواست‌های در انتظار تأیید اول (جدیدترین) —
    // تا ثبتِ درخواستِ تازه در میانه‌ی لیست «گم» نشود؛ سپس بقیه به‌ترتیب زمان
    const ACTION_ORDER: Record<string, number> = {
      PENDING_APPROVAL: 0,
      WAITLISTED: 1,
      WAITLIST_OFFERED: 1,
    };
    // برای جلسات عادی: نزدیک‌ترین به «الان» اول — گذشته‌ها به انتهای لیست می‌روند
    const now = Date.now();
    const distance = (t: number) => (t >= now ? t - now : now - t + Number.MAX_SAFE_INTEGER / 2);
    const withSort = meetings.map((m) => ({ m, rank: ACTION_ORDER[m.status] ?? 2 }));
    withSort.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.rank === 0) return b.m.createdAt.getTime() - a.m.createdAt.getTime(); // جدیدترین درخواست اول
      // آینده: نزدیک‌ترین اول؛ گذشته: تازه‌ترین گذشته اول (هر دو دور از ان = انتهای لیست)
      return distance(a.m.startAt.getTime()) - distance(b.m.startAt.getTime());
    });
    const sortedAll = withSort.map((x) => x.m);
    // صفحه‌بندی: ۵۰ جلسه در هر صفحه — کل شمارش قبل از برش
    const PAGE_SIZE = 50;
    const total = sortedAll.length;
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const sorted = sortedAll.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const viewer = { id: user.id, isSuperAdmin: !!user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN") || can(user, "meeting:view-all") };
    const masked = sorted.map((m) => {
      const mine = m.participants.find((p) => p.userId === user.id && p.role !== "ORGANIZER");
      const { participants, ...rest } = maskPrivateMeeting(m, viewer);
      return {
        ...rest,
        myResponseStatus: mine?.responseStatus ?? null,
        participants: participants.map((p) => ({ userId: p.userId })),
      };
    });
return ok({ meetings: masked, total, page, pageSize: PAGE_SIZE });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const input = meetingCreateSchema.parse(body);
    if (!can(user, "meeting:create")) {
      // carve-out: an appointed delegate may create ON BEHALF of their
      // principal (who holds meeting:create) — the delegate flow predates
      // the request-only model for employees.
      const onBehalf = input.organizerId && input.organizerId !== user.id;
      let delegateOk = false;
      if (onBehalf) {
        const [meId, principalId] = await Promise.resolve([user.id, input.organizerId]);
        const rows = await prisma.delegate.findMany({
          where: { delegateId: meId, managerId: principalId },
          select: { id: true },
        });
        delegateOk = rows.length > 0;
      }
      if (!delegateOk) {
        return Response.json(
          { ok: false, error: { message: "دسترسی لازم را ندارید", code: "FORBIDDEN" } },
          { status: 403 },
        );
      }
    }
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
