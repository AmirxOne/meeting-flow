import { Prisma, type Meeting, type MeetingSeries } from "@prisma/client";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import {
  assertTransition,
  DEFAULT_POLICIES,
  evaluateApprovalNeed,
  type PolicyValues,
} from "./state-machine";
import { coerceReminderOffsets } from "@/lib/reminder-offsets";
import { findRoomConflicts, findUserConflicts } from "./conflict.service";
import { assertRoomNotExcludedOutsideTx, assertRoomNotExcluded } from "./room-exclusion.service";
import { notificationService } from "./notification.service";
import { scheduleReminders } from "./reminder.service";
import {
  canRespondToMeeting,
  isParticipantResponse,
} from "./participant-response.service";
import { generateCheckinCode } from "./guest-checkin.service";
import { calendarSyncBestEffort } from "./calendar-sync.service";
import { expandOccurrences, type RecurrenceRule, type SeriesEditScope } from "@/lib/recurrence";
import {
  filterSeriesTargets,
  shiftOccurrence,
  slotsOverlapSameRoom,
} from "@/lib/series-edit";
import { formatJalali } from "@/lib/jalali";
import { maskPrivateConflictTitle, type PrivacyViewer } from "./privacy";
import {
  WAITLIST_OFFERED,
  WAITLIST_WAITING,
  bumpExpiredToBack,
  isOfferExpired,
  isWaitlistStatus,
  offerWaitlistAfterVacate,
  waitlistMeta,
} from "./waitlist.service";
import { assertHolidayBooking } from "./holiday.service";
import { parseHolidayBookingMode } from "@/lib/holiday";

export interface CreateMeetingInput {
  title: string;
  description?: string;
  orgId: string;
  branchId: string;
  roomId?: string;
  organizerId: string;
  createdById?: string | null;
  waitlistIfBusy?: boolean;
  waitlistQueuedAt?: Date;
  startAt: Date;
  endAt: Date;
  meetingType?: string;
  priority?: string;
  isPrivate?: boolean;
  videoProvider?: string | null;
  videoUrl?: string | null;
  participantIds?: string[];
  guests?: {
    name: string;
    company?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }[];
  seriesId?: string;
  originalStartAt?: Date;
}

export interface CreateSeriesInput extends CreateMeetingInput {
  recurrence: RecurrenceRule;
}

export async function getOrgPolicies(orgId: string): Promise<PolicyValues> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { policies: true },
  });
  if (!org) return DEFAULT_POLICIES;
  const merged: PolicyValues = { ...DEFAULT_POLICIES };
  for (const p of org.policies) {
    if (p.key in merged) {
      if (p.key === "defaultReminderOffsets") {
        merged.defaultReminderOffsets = coerceReminderOffsets(
          p.value,
          DEFAULT_POLICIES.defaultReminderOffsets,
        );
      } else if (p.key === "holidayBooking") {
        merged.holidayBooking = parseHolidayBookingMode(p.value);
      } else {
        (merged as unknown as Record<string, unknown>)[p.key] = p.value;
      }
    }
  }
  return merged;
}

async function getMeetingInOrg(meetingId: string, orgId: string) {
  const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, orgId } });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
  return meeting;
}

async function assertCreateTenant(input: CreateMeetingInput) {
  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, orgId: input.orgId },
  });
  if (!branch) throw new HttpError(404, "شعبه یافت نشد", "NOT_FOUND");
  if (input.roomId) {
    const room = await prisma.meetingRoom.findFirst({
      where: { id: input.roomId, orgId: input.orgId },
    });
    if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
  }
  const people = [...new Set([input.organizerId, ...(input.participantIds ?? [])])];
  const count = await prisma.user.count({
    where: { id: { in: people }, orgId: input.orgId },
  });
  if (count !== people.length) {
    throw new HttpError(400, "یکی از کاربران متعلق به این سازمان نیست", "CROSS_TENANT");
  }
}

async function assertRoomFree(
  roomId: string,
  start: Date,
  end: Date,
  excludeMeetingId?: string,
) {
  const conflicts = await findRoomConflicts(roomId, start, end, excludeMeetingId);
  if (conflicts.length > 0) {
    throw new HttpError(
      409,
      `اتاق در این بازه آزاد نیست (${conflicts[0].meetingTitle})`,
      "ROOM_CONFLICT",
    );
  }
  await assertRoomNotExcludedOutsideTx(roomId, start, end);
}

/**
 * Create meeting inside a SERIALIZABLE transaction with an advisory-xact lock
 * on the room row. Two concurrent bookings of the same room serialize here;
 * the loser re-checks conflicts and fails with 409.
 */
export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  const durationMin = (input.endAt.getTime() - input.startAt.getTime()) / 60000;
  if (durationMin < 10) {
    throw new HttpError(400, "مدت جلسه کمتر از ۱۰ دقیقه است", "TOO_SHORT");
  }

  const policies = await getOrgPolicies(input.orgId);
  if (durationMin < policies.minDurationMin) {
    throw new HttpError(400, `حداقل مدت جلسه ${policies.minDurationMin} دقیقه است`, "TOO_SHORT");
  }
  if (durationMin > policies.maxDurationMin) {
    throw new HttpError(400, `حداکثر مدت جلسه ${policies.maxDurationMin} دقیقه است`, "TOO_LONG");
  }

  await assertCreateTenant(input);
  const holiday = await assertHolidayBooking(input.orgId, input.startAt, input.endAt);
  const room = input.roomId
    ? await prisma.meetingRoom.findFirst({ where: { id: input.roomId, orgId: input.orgId } })
    : null;
  if (input.roomId && !room) throw new HttpError(404, "اتاق یافت نشد", "ROOM_NOT_FOUND");
  if (room) {
    if (durationMin < room.minDurationMin || durationMin > room.maxDurationMin) {
      throw new HttpError(400, `مدت مجاز این اتاق بین ${room.minDurationMin} و ${room.maxDurationMin} دقیقه است`, "ROOM_DURATION");
    }
    if (room.capacity < (input.participantIds?.length ?? 0) + 1) {
      throw new HttpError(400, "ظرفیت اتاق کافی نیست", "ROOM_CAPACITY");
    }
  }

  const needsApproval = evaluateApprovalNeed(policies, {
    hasExternalGuest: (input.guests?.length ?? 0) > 0,
    isVipRoom: room?.isVip ?? false,
    durationMin,
    meetingType: input.meetingType ?? "INTERNAL",
    isOrgHoliday: holiday.requiresApproval,
  });

  return prisma.$transaction(
    async (tx) => {
      if (room) {
        await tx.$executeRaw`SELECT id FROM "MeetingRoom" WHERE id = ${room.id} FOR UPDATE`;
        try {
          await assertRoomFreeTx(tx, room.id, input.startAt, input.endAt);
        } catch (e) {
          if (e instanceof HttpError && e.code === "ROOM_CONFLICT") {
            if (input.waitlistIfBusy) {
              const queuedAt = new Date();
              return insertOccurrenceTx(
                tx,
                { ...input, waitlistQueuedAt: queuedAt },
                { status: WAITLIST_WAITING, needsApproval: false },
              );
            }
            const waitlistCount = await tx.meeting.count({
              where: {
                orgId: input.orgId,
                roomId: room.id,
                status: { in: [WAITLIST_WAITING, WAITLIST_OFFERED] },
                startAt: { lt: input.endAt },
                endAt: { gt: input.startAt },
              },
            });
            throw new HttpError(409, e.message, "ROOM_CONFLICT", {
              canWaitlist: true,
              waitlistCount,
            });
          }
          throw e;
        }
      }

      const meeting = await insertOccurrenceTx(tx, input, {
        status: needsApproval ? "PENDING_APPROVAL" : "CONFIRMED",
        needsApproval,
      });

      return meeting;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
    .then(async (meeting) => {
      if (meeting.status === WAITLIST_WAITING) {
        const meta = await waitlistMeta(meeting);
        await notificationService.waitlistJoined(meeting, meta?.position ?? 1);
        return meeting;
      }
      await scheduleReminders(meeting);
      await notificationService.meetingCreated(meeting, input.createdById ?? input.organizerId);
      void calendarSyncBestEffort("create", meeting);
      return meeting;
    })
    .catch((e) => {
      if (e instanceof HttpError) throw e;
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === "P2034" || e.meta?.code === "40001")
      ) {
        throw new HttpError(409, "تداخل همزمانی در رزرو اتاق — دوباره تلاش کنید", "RETRY");
      }
      throw e;
    });
}

async function insertOccurrenceTx(
  tx: Prisma.TransactionClient,
  input: CreateMeetingInput,
  opts: { status: string; needsApproval: boolean },
): Promise<Meeting> {
  const meeting = await tx.meeting.create({
    data: {
      orgId: input.orgId,
      title: input.title,
      description: input.description,
      organizerId: input.organizerId,
      createdById: input.createdById ?? null,
      waitlistQueuedAt: input.waitlistQueuedAt ?? null,
      branchId: input.branchId,
      roomId: input.roomId,
      startAt: input.startAt,
      endAt: input.endAt,
      meetingType: input.meetingType ?? "INTERNAL",
      priority: input.priority ?? "NORMAL",
      isPrivate: input.isPrivate ?? false,
      videoProvider: input.videoProvider ?? null,
      videoUrl: input.videoUrl ?? null,
      status: opts.status,
      seriesId: input.seriesId,
      originalStartAt: input.originalStartAt ?? input.startAt,
    },
  });

  await tx.meetingParticipant.create({
    data: {
      meetingId: meeting.id,
      userId: input.organizerId,
      role: "ORGANIZER",
      responseStatus: "ACCEPTED",
    },
  });

  for (const uid of new Set(input.participantIds ?? [])) {
    if (uid === input.organizerId) continue;
    await tx.meetingParticipant.create({
      data: { meetingId: meeting.id, userId: uid, responseStatus: "PENDING" },
    });
  }

  for (const g of input.guests ?? []) {
    const checkinCode = await generateCheckinCode();
    await tx.meetingGuest.create({
      data: { meetingId: meeting.id, ...g, checkinCode },
    });
  }

  await tx.meetingEvent.create({
    data: {
      meetingId: meeting.id,
      type: "CREATED",
      actorId: input.createdById ?? input.organizerId,
      data: {
        needsApproval: opts.needsApproval,
        ...(opts.status === WAITLIST_WAITING ? { waitlist: true } : {}),
        ...(input.createdById && input.createdById !== input.organizerId
          ? { onBehalfOf: input.organizerId, createdById: input.createdById }
          : {}),
      },
    },
  });

  if (opts.needsApproval) {
    await tx.meetingApproval.create({
      data: { meetingId: meeting.id, action: "REQUESTED", step: 1 },
    });
  }

  return meeting;
}

function mapTxConflict(e: unknown): never {
  if (e instanceof HttpError) throw e;
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2034" || e.meta?.code === "40001")
  ) {
    throw new HttpError(409, "تداخل همزمانی در رزرو اتاق — دوباره تلاش کنید", "RETRY");
  }
  throw e;
}

export interface CreatedSeries {
  meeting: Meeting;
  series: MeetingSeries;
  meetings: Meeting[];
}

/** Expand a recurrence rule and book every occurrence in one SERIALIZABLE tx. */
export async function createMeetingSeries(input: CreateSeriesInput): Promise<CreatedSeries> {
  if (input.waitlistIfBusy) {
    throw new HttpError(400, "لیست انتظار برای جلسه تکراری پشتیبانی نمی‌شود", "WAITLIST_SERIES");
  }
  const durationMin = (input.endAt.getTime() - input.startAt.getTime()) / 60000;
  if (durationMin < 10) {
    throw new HttpError(400, "مدت جلسه کمتر از ۱۰ دقیقه است", "TOO_SHORT");
  }

  const policies = await getOrgPolicies(input.orgId);
  if (durationMin < policies.minDurationMin) {
    throw new HttpError(400, `حداقل مدت جلسه ${policies.minDurationMin} دقیقه است`, "TOO_SHORT");
  }
  if (durationMin > policies.maxDurationMin) {
    throw new HttpError(400, `حداکثر مدت جلسه ${policies.maxDurationMin} دقیقه است`, "TOO_LONG");
  }

  await assertCreateTenant(input);
  const room = input.roomId
    ? await prisma.meetingRoom.findFirst({ where: { id: input.roomId, orgId: input.orgId } })
    : null;
  if (input.roomId && !room) throw new HttpError(404, "اتاق یافت نشد", "ROOM_NOT_FOUND");
  if (room) {
    if (durationMin < room.minDurationMin || durationMin > room.maxDurationMin) {
      throw new HttpError(400, `مدت مجاز این اتاق بین ${room.minDurationMin} و ${room.maxDurationMin} دقیقه است`, "ROOM_DURATION");
    }
    if (room.capacity < (input.participantIds?.length ?? 0) + 1) {
      throw new HttpError(400, "ظرفیت اتاق کافی نیست", "ROOM_CAPACITY");
    }
  }

  const starts = expandOccurrences(input.startAt, input.recurrence);
  if (starts.length === 0) {
    throw new HttpError(400, "هیچ نوبتی از این تکرار ساخته نشد", "EMPTY_SERIES");
  }
  const durationMs = input.endAt.getTime() - input.startAt.getTime();
  let holidayApproval = false;
  for (const start of starts) {
    const holiday = await assertHolidayBooking(
      input.orgId,
      start,
      new Date(start.getTime() + durationMs),
    );
    if (holiday.requiresApproval) holidayApproval = true;
  }

  const needsApproval = evaluateApprovalNeed(policies, {
    hasExternalGuest: (input.guests?.length ?? 0) > 0,
    isVipRoom: room?.isVip ?? false,
    durationMin,
    meetingType: input.meetingType ?? "INTERNAL",
    isOrgHoliday: holidayApproval,
  });
  const status = needsApproval ? "PENDING_APPROVAL" : "CONFIRMED";

  return prisma.$transaction(
    async (tx) => {
      if (room) {
        await tx.$executeRaw`SELECT id FROM "MeetingRoom" WHERE id = ${room.id} FOR UPDATE`;
        for (const start of starts) {
          const end = new Date(start.getTime() + durationMs);
          try {
            await assertRoomFreeTx(tx, room.id, start, end);
          } catch (e) {
            if (e instanceof HttpError && e.code === "ROOM_CONFLICT") {
              throw new HttpError(
                409,
                `اتاق در ${formatJalali(start, { withTime: true, monthName: true })} آزاد نیست`,
                "ROOM_CONFLICT",
              );
            }
            throw e;
          }
        }
      }

      const series = await tx.meetingSeries.create({
        data: {
          orgId: input.orgId,
          organizerId: input.organizerId,
          branchId: input.branchId,
          roomId: input.roomId,
          title: input.title,
          description: input.description,
          meetingType: input.meetingType ?? "INTERNAL",
          priority: input.priority ?? "NORMAL",
          isPrivate: input.isPrivate ?? false,
          videoProvider: input.videoProvider ?? null,
          videoUrl: input.videoUrl ?? null,
          freq: input.recurrence.freq,
          interval: input.recurrence.interval,
          byWeekday: input.recurrence.byWeekday ?? [],
          until: input.recurrence.until,
          count: input.recurrence.count,
          durationMin: Math.round(durationMin),
          dtstart: input.startAt,
        },
      });

      const meetings: Meeting[] = [];
      for (const start of starts) {
        const end = new Date(start.getTime() + durationMs);
        const meeting = await insertOccurrenceTx(
          tx,
          { ...input, startAt: start, endAt: end, seriesId: series.id, originalStartAt: start },
          { status, needsApproval },
        );
        meetings.push(meeting);
      }
      return { series, meetings };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
    .then(async ({ series, meetings }) => {
      for (const m of meetings) {
        await scheduleReminders(m);
        void calendarSyncBestEffort("create", m);
      }
      await notificationService.meetingCreated(meetings[0], input.createdById ?? input.organizerId, {
        occurrenceCount: meetings.length,
      });
      return { meeting: meetings[0], series, meetings };
    })
    .catch(mapTxConflict);
}

async function assertRoomFreeTx(
  tx: Prisma.TransactionClient,
  roomId: string,
  start: Date,
  end: Date,
  excludeMeetingId?: string | string[],
) {
  const excludeIds = !excludeMeetingId
    ? []
    : Array.isArray(excludeMeetingId)
      ? excludeMeetingId
      : [excludeMeetingId];
  const rows = await tx.meeting.count({
    where: {
      roomId,
      status: { in: ["PENDING_APPROVAL", "APPROVED", "CONFIRMED", "RESCHEDULED", "IN_PROGRESS"] },
      startAt: { lt: end },
      endAt: { gt: start },
      ...(excludeIds.length === 1
        ? { id: { not: excludeIds[0] } }
        : excludeIds.length > 1
          ? { id: { notIn: excludeIds } }
          : {}),
    },
  });
  if (rows > 0) {
    throw new HttpError(409, "اتاق در این بازه آزاد نیست", "ROOM_CONFLICT");
  }
  await assertRoomNotExcluded(tx, roomId, start, end);
}

export interface TransitionContext {
  actorId: string;
  orgId: string;
  actorPermissions?: string[];
}

export async function startMeeting(meetingId: string, ctx: TransitionContext) {
  return transition(meetingId, "IN_PROGRESS", ctx, async (tx, m) => {
    await tx.meetingParticipant.updateMany({
      where: { meetingId: m.id, responseStatus: "ACCEPTED" },
      data: { joinedAt: new Date() },
    });
  });
}

export async function endMeeting(
  meetingId: string,
  ctx: TransitionContext,
  opts: { noShow?: boolean } = {},
) {
  return transition(
    meetingId,
    opts.noShow ? "NO_SHOW" : "COMPLETED",
    ctx,
    async (tx, m) => {
      await tx.meetingParticipant.updateMany({
        where: { meetingId: m.id, joinedAt: { not: null } },
        data: { leftAt: new Date() },
      });
    },
  );
}

export async function extendMeeting(
  meetingId: string,
  minutes: number,
  ctx: TransitionContext,
): Promise<Meeting> {
  if (![15, 30, 60].includes(minutes)) {
    throw new HttpError(400, "مدت تمدید مجاز نیست", "BAD_EXTEND");
  }
  const meeting = await getMeetingInOrg(meetingId, ctx.orgId);
  if (!["IN_PROGRESS", "CONFIRMED"].includes(meeting.status)) {
    throw new HttpError(400, "فقط جلسه در حال برگزاری یا قطعی قابل تمدید است", "BAD_STATE");
  }
  const newEnd = new Date(meeting.endAt.getTime() + minutes * 60000);

  return prisma.$transaction(
    async (tx) => {
      if (meeting.roomId) {
        await tx.$executeRaw`SELECT id FROM "MeetingRoom" WHERE id = ${meeting.roomId} FOR UPDATE`;
        await assertRoomFreeTx(tx, meeting.roomId, meeting.endAt, newEnd, meeting.id);
      }
      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: { endAt: newEnd },
      });
      await tx.meetingEvent.create({
        data: {
          meetingId,
          type: "EXTENDED",
          actorId: ctx.actorId,
          data: { minutes, from: meeting.endAt.toISOString(), to: newEnd.toISOString() },
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ).then(async (m) => {
    await notificationService.meetingExtended(m, ctx.actorId);
    return m;
  });
}

export async function rescheduleMeeting(
  meetingId: string,
  input: {
    startAt?: Date;
    endAt?: Date;
    roomId?: string;
    reason?: string;
    scope?: SeriesEditScope;
  },
  ctx: TransitionContext,
): Promise<Meeting> {
  const meeting = await getMeetingInOrg(meetingId, ctx.orgId);
  if (["COMPLETED", "NO_SHOW", "CANCELLED", "REJECTED"].includes(meeting.status)) {
    throw new HttpError(400, "این جلسه قابل زمان‌بندی مجدد نیست", "BAD_STATE");
  }
  if (isWaitlistStatus(meeting.status)) {
    throw new HttpError(400, "جلسهٔ لیست انتظار را نمی‌توان زمان‌بندی مجدد کرد", "WAITLIST");
  }

  const start = input.startAt ?? meeting.startAt;
  const end = input.endAt ?? new Date(start.getTime() + (meeting.endAt.getTime() - meeting.startAt.getTime()));
  const roomId = input.roomId ?? meeting.roomId;
  const scope: SeriesEditScope = input.scope ?? "THIS";
  const old = { startAt: meeting.startAt, endAt: meeting.endAt, roomId: meeting.roomId };

  const targets =
    meeting.seriesId && scope !== "THIS"
      ? await loadSeriesTargets(meeting, scope)
      : [meeting];

  if (targets.length === 0) {
    throw new HttpError(400, "نوبت قابل ویرایشی در این سری یافت نشد", "BAD_STATE");
  }

  const deltaMs = start.getTime() - meeting.startAt.getTime();
  const durationMs = end.getTime() - start.getTime();
  const planned = targets.map((t) => {
    const shifted = shiftOccurrence(t.startAt, t.endAt, deltaMs, durationMs);
    return { meeting: t, ...shifted, roomId: input.roomId ?? t.roomId };
  });
  if (slotsOverlapSameRoom(planned)) {
    throw new HttpError(409, "نوبت‌های این سری بعد از تغییر با هم تداخل دارند", "ROOM_CONFLICT");
  }

  for (const p of planned) {
    await assertHolidayBooking(ctx.orgId, p.startAt, p.endAt);
  }

  const excludeIds = planned.map((p) => p.meeting.id);

  return prisma.$transaction(
    async (tx) => {
      const roomIds = [...new Set(planned.map((p) => p.roomId).filter((id): id is string => !!id))];
      for (const rid of roomIds) {
        await tx.$executeRaw`SELECT id FROM "MeetingRoom" WHERE id = ${rid} FOR UPDATE`;
      }
      for (const p of planned) {
        if (p.roomId) {
          try {
            await assertRoomFreeTx(tx, p.roomId, p.startAt, p.endAt, excludeIds);
          } catch (e) {
            if (e instanceof HttpError && e.code === "ROOM_CONFLICT") {
              throw new HttpError(
                409,
                `اتاق در ${formatJalali(p.startAt, { withTime: true, monthName: true })} آزاد نیست`,
                "ROOM_CONFLICT",
              );
            }
            throw e;
          }
        }
        await tx.meeting.update({
          where: { id: p.meeting.id },
          data: {
            startAt: p.startAt,
            endAt: p.endAt,
            roomId: p.roomId,
            status: p.meeting.status === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "RESCHEDULED",
            isException: scope === "THIS" && !!meeting.seriesId ? true : p.meeting.isException,
          },
        });
        await tx.meetingEvent.create({
          data: {
            meetingId: p.meeting.id,
            type: "RESCHEDULED",
            actorId: ctx.actorId,
            data: {
              from: {
                startAt: p.meeting.startAt.toISOString(),
                endAt: p.meeting.endAt.toISOString(),
                roomId: p.meeting.roomId,
              },
              to: { startAt: p.startAt.toISOString(), endAt: p.endAt.toISOString(), roomId: p.roomId },
              reason: input.reason,
              scope,
            },
          },
        });
      }
      return tx.meeting.findUniqueOrThrow({ where: { id: meetingId } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ).then(async (m) => {
    for (const p of planned) {
      await scheduleReminders({ ...p.meeting, startAt: p.startAt, endAt: p.endAt, roomId: p.roomId });
      void calendarSyncBestEffort("update", { ...p.meeting, startAt: p.startAt, endAt: p.endAt, roomId: p.roomId });
    }
    await notificationService.meetingRescheduled(m, ctx.actorId, old, { count: planned.length });
    for (const p of planned) {
      void offerWaitlistAfterVacate({
        orgId: ctx.orgId,
        roomId: p.meeting.roomId,
        startAt: p.meeting.startAt,
        endAt: p.meeting.endAt,
      }).catch((err) => console.error("[waitlist]", err));
    }
    return m;
  }).catch(mapTxConflict);
}

async function loadSeriesTargets(meeting: Meeting, scope: SeriesEditScope): Promise<Meeting[]> {
  if (!meeting.seriesId) return [meeting];
  const siblings = await prisma.meeting.findMany({
    where: { seriesId: meeting.seriesId, orgId: meeting.orgId },
  });
  return filterSeriesTargets(siblings, scope, meeting);
}

export async function cancelMeeting(
  meetingId: string,
  input: { reason: string; note?: string; scope?: SeriesEditScope },
  ctx: TransitionContext,
): Promise<Meeting> {
  const meeting = await getMeetingInOrg(meetingId, ctx.orgId);

  const scope: SeriesEditScope = input.scope ?? "THIS";
  const targets =
    meeting.seriesId && scope !== "THIS"
      ? await loadSeriesTargets(meeting, scope)
      : [meeting];

  if (targets.length === 0) {
    throw new HttpError(400, "نوبت قابل لغوی در این سری یافت نشد", "BAD_STATE");
  }

  for (const t of targets) {
    assertTransition(t.status, "CANCELLED");
  }

  const ids = targets.map((t) => t.id);
  await prisma.meeting.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "CANCELLED",
      cancelReason: input.reason,
      cancelNote: input.note,
    },
  });
  await prisma.meetingEvent.createMany({
    data: ids.map((id) => ({
      meetingId: id,
      type: "CANCELLED",
      actorId: ctx.actorId,
      data: { reason: input.reason, note: input.note, scope },
    })),
  });
  await prisma.meetingReminder.updateMany({
    where: { meetingId: { in: ids }, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  const updated = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  await notificationService.meetingCancelled(updated, ctx.actorId, input.reason, { count: ids.length });
  for (const t of targets) {
    void calendarSyncBestEffort("cancel", { ...t, status: "CANCELLED" });
    void offerWaitlistAfterVacate({
      orgId: ctx.orgId,
      roomId: t.roomId,
      startAt: t.startAt,
      endAt: t.endAt,
    }).catch((err) => console.error("[waitlist]", err));
  }
  return updated;
}

export async function changeRoom(
  meetingId: string,
  roomId: string,
  ctx: TransitionContext,
): Promise<Meeting> {
  const meeting = await getMeetingInOrg(meetingId, ctx.orgId);
  if (["COMPLETED", "NO_SHOW", "CANCELLED"].includes(meeting.status)) {
    throw new HttpError(400, "این جلسه قابل تغییر اتاق نیست", "BAD_STATE");
  }
  if (isWaitlistStatus(meeting.status)) {
    throw new HttpError(400, "جلسهٔ لیست انتظار را نمی‌توان تغییر اتاق داد", "WAITLIST");
  }
  const room = await prisma.meetingRoom.findFirst({
    where: { id: roomId, orgId: ctx.orgId, isActive: true },
  });
  if (!room) throw new HttpError(404, "اتاق فعال یافت نشد", "ROOM_NOT_FOUND");

  const oldRoomId = meeting.roomId;

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM "MeetingRoom" WHERE id = ${roomId} FOR UPDATE`;
      await assertRoomFreeTx(tx, roomId, meeting.startAt, meeting.endAt, meeting.id);
      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: { roomId },
      });
      await tx.meetingEvent.create({
        data: {
          meetingId,
          type: "ROOM_CHANGED",
          actorId: ctx.actorId,
          data: { from: oldRoomId, to: roomId },
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ).then(async (m) => {
    await notificationService.roomChanged(m, ctx.actorId, room.name);
    void offerWaitlistAfterVacate({
      orgId: ctx.orgId,
      roomId: oldRoomId,
      startAt: meeting.startAt,
      endAt: meeting.endAt,
    }).catch((err) => console.error("[waitlist]", err));
    return m;
  });
}

async function transition(
  meetingId: string,
  to: string,
  ctx: TransitionContext,
  extra?: (tx: Prisma.TransactionClient, m: Meeting) => Promise<void>,
): Promise<Meeting> {
  const meeting = await getMeetingInOrg(meetingId, ctx.orgId);
  assertTransition(meeting.status, to);

  const updated = await prisma.$transaction(async (tx) => {
    if (extra) await extra(tx, meeting);
    return tx.meeting.update({ where: { id: meetingId }, data: { status: to } });
  });
  await prisma.meetingEvent.create({
    data: {
      meetingId,
      type: to === "IN_PROGRESS" ? "STARTED" : to === "COMPLETED" ? "ENDED" : to,
      actorId: ctx.actorId,
    },
  });
  if (to === "IN_PROGRESS") await notificationService.meetingStarted(updated, ctx.actorId);
  return updated;
}

export async function approveMeeting(meetingId: string, ctx: TransitionContext & { reason?: string }) {
  const meeting = await getMeetingInOrg(meetingId, ctx.orgId);
  if (meeting.status !== "PENDING_APPROVAL") {
    throw new HttpError(400, "این جلسه در انتظار تأیید نیست", "BAD_STATE");
  }
  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "APPROVED" },
  });
  await prisma.meetingApproval.create({
    data: { meetingId, actorId: ctx.actorId, action: "APPROVED", reason: ctx.reason },
  });
  await prisma.meetingEvent.create({
    data: { meetingId, type: "APPROVED", actorId: ctx.actorId },
  });
  // auto-confirm after approval
  const confirmed = await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "CONFIRMED" },
  });
  await scheduleReminders(confirmed);
  await notificationService.meetingApproved(confirmed, ctx.actorId);
  return confirmed;
}

export async function rejectMeeting(meetingId: string, ctx: TransitionContext & { reason: string }) {
  const meeting = await getMeetingInOrg(meetingId, ctx.orgId);
  if (meeting.status !== "PENDING_APPROVAL") {
    throw new HttpError(400, "این جلسه در انتظار تأیید نیست", "BAD_STATE");
  }
  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "REJECTED", cancelReason: ctx.reason },
  });
  await prisma.meetingApproval.create({
    data: { meetingId, actorId: ctx.actorId, action: "REJECTED", reason: ctx.reason },
  });
  await prisma.meetingEvent.create({
    data: { meetingId, type: "REJECTED", actorId: ctx.actorId, data: { reason: ctx.reason } },
  });
  await prisma.meetingReminder.updateMany({
    where: { meetingId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  await notificationService.meetingRejected(updated, ctx.actorId, ctx.reason);
  return updated;
}

export async function addParticipant(
  meetingId: string,
  userId: string,
  ctx: TransitionContext,
  opts: { required?: boolean } = {},
) {
  const meeting = await getMeetingInOrg(meetingId, ctx.orgId);
  if (["COMPLETED", "NO_SHOW", "CANCELLED", "REJECTED"].includes(meeting.status)) {
    throw new HttpError(400, "نمی‌توان به این جلسه فرد اضافه کرد", "BAD_STATE");
  }
  const member = await prisma.user.findFirst({ where: { id: userId, orgId: ctx.orgId } });
  if (!member) throw new HttpError(404, "کاربر یافت نشد", "NOT_FOUND");
  const existing = await prisma.meetingParticipant.findUnique({
    where: { meetingId_userId: { meetingId, userId } },
  });
  if (existing) throw new HttpError(409, "این فرد قبلاً اضافه شده است", "DUPLICATE");

  const p = await prisma.meetingParticipant.create({
    data: { meetingId, userId, required: opts.required ?? true, responseStatus: "PENDING" },
  });
  await prisma.meetingEvent.create({
    data: { meetingId, type: "PARTICIPANT_ADDED", actorId: ctx.actorId, data: { userId } },
  });
  await notificationService.participantAdded(meeting, userId, ctx.actorId);
  return p;
}

export async function removeParticipant(
  meetingId: string,
  userId: string,
  ctx: TransitionContext,
) {
  const meeting = await getMeetingInOrg(meetingId, ctx.orgId);
  if (meeting.organizerId === userId) {
    throw new HttpError(400, "برگزارکننده قابل حذف نیست", "BAD_REQUEST");
  }
  await prisma.meetingParticipant.deleteMany({ where: { meetingId, userId } });
  await prisma.meetingEvent.create({
    data: { meetingId, type: "PARTICIPANT_REMOVED", actorId: ctx.actorId, data: { userId } },
  });
  return { removed: true };
}

export async function respondToMeeting(
  meetingId: string,
  responseStatus: "ACCEPTED" | "DECLINED" | "TENTATIVE",
  ctx: TransitionContext,
  targetUserId?: string,
) {
  if (!isParticipantResponse(responseStatus)) {
    throw new HttpError(400, "وضعیت پاسخ نامعتبر است", "VALIDATION_ERROR");
  }

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, orgId: ctx.orgId },
    include: { organizer: { select: { fullName: true } } },
  });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
  if (!canRespondToMeeting(meeting.status)) {
    throw new HttpError(400, "به این جلسه دیگر نمی‌توان پاسخ داد", "BAD_STATE");
  }

  const userId = targetUserId ?? ctx.actorId;
  const isOrganizer = meeting.organizerId === ctx.actorId;
  const isSelf = userId === ctx.actorId;

  if (!isSelf && !isOrganizer) {
    throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
  }

  const participant = await prisma.meetingParticipant.findUnique({
    where: { meetingId_userId: { meetingId, userId } },
    include: { user: { select: { fullName: true } } },
  });
  if (!participant) {
    throw new HttpError(
      isOrganizer && !isSelf ? 404 : 403,
      isOrganizer && !isSelf ? "مشارکت‌کننده یافت نشد" : "شما در این جلسه دعوت نشده‌اید",
      isOrganizer && !isSelf ? "NOT_FOUND" : "FORBIDDEN",
    );
  }
  if (participant.role === "ORGANIZER") {
    throw new HttpError(400, "برگزارکننده نیازی به پاسخ ندارد", "BAD_REQUEST");
  }

  const updated = await prisma.meetingParticipant.update({
    where: { id: participant.id },
    data: {
      responseStatus,
      ...(responseStatus === "ACCEPTED" ? {} : { joinedAt: null }),
    },
  });

  await prisma.meetingEvent.create({
    data: {
      meetingId,
      type: "PARTICIPANT_RESPONDED",
      actorId: ctx.actorId,
      data: { userId, responseStatus, forUserId: userId },
    },
  });

  await notificationService.participantResponded(
    meeting,
    userId,
    ctx.actorId,
    responseStatus,
    participant.user.fullName,
  );

  return updated;
}

/** Conflict pre-check for UI (warnings, does not throw). */
export async function checkConflicts(input: {
  roomId?: string;
  participantIds: string[];
  organizerId: string;
  startAt: Date;
  endAt: Date;
  excludeMeetingId?: string;
  orgId?: string;
  viewer?: PrivacyViewer;
}) {
  const roomConflicts = input.roomId
    ? await findRoomConflicts(input.roomId, input.startAt, input.endAt, input.excludeMeetingId)
    : [];
  const userConflicts = await findUserConflicts(
    [...new Set([input.organizerId, ...input.participantIds])],
    input.startAt,
    input.endAt,
    input.excludeMeetingId,
    input.orgId,
  );
  const viewer = input.viewer ?? { id: input.organizerId };
  const mask = (title: string, isPrivate: boolean, organizerId: string) =>
    maskPrivateConflictTitle(title, isPrivate, organizerId, viewer);
  return {
    hard: roomConflicts.map((c) => ({
      ...c,
      meetingTitle: mask(c.meetingTitle, c.isPrivate, c.organizerId),
    })),
    soft: userConflicts.map((c) => ({
      ...c,
      meetingTitle: mask(c.meetingTitle, c.isPrivate, c.organizerId),
    })),
  };
}

export async function claimWaitlistMeeting(
  meetingId: string,
  ctx: TransitionContext,
): Promise<Meeting> {
  const meeting = await getMeetingInOrg(meetingId, ctx.orgId);
  if (meeting.organizerId !== ctx.actorId && meeting.createdById !== ctx.actorId) {
    throw new HttpError(403, "فقط برگزارکننده می‌تواند نوبت را قطعی کند", "FORBIDDEN");
  }
  if (meeting.status !== WAITLIST_OFFERED) {
    throw new HttpError(400, "این جلسه پیشنهاد فعال لیست انتظار ندارد", "BAD_STATE");
  }
  if (isOfferExpired(meeting.waitlistOfferExpiresAt, new Date())) {
    throw new HttpError(400, "مهلت قطعی کردن تمام شده است", "OFFER_EXPIRED");
  }
  if (!meeting.roomId) {
    throw new HttpError(400, "اتاق مشخص نیست", "NO_ROOM");
  }

  const durationMin = (meeting.endAt.getTime() - meeting.startAt.getTime()) / 60000;
  const policies = await getOrgPolicies(meeting.orgId);
  const room = await prisma.meetingRoom.findFirst({
    where: { id: meeting.roomId, orgId: ctx.orgId },
  });
  if (!room) throw new HttpError(404, "اتاق یافت نشد", "ROOM_NOT_FOUND");
  const guestCount = await prisma.meetingGuest.count({ where: { meetingId } });
  const holiday = await assertHolidayBooking(meeting.orgId, meeting.startAt, meeting.endAt);
  const needsApproval = evaluateApprovalNeed(policies, {
    hasExternalGuest: guestCount > 0,
    isVipRoom: room.isVip,
    durationMin,
    meetingType: meeting.meetingType,
    isOrgHoliday: holiday.requiresApproval,
  });
  const nextStatus = needsApproval ? "PENDING_APPROVAL" : "CONFIRMED";
  assertTransition(meeting.status, nextStatus);

  const updated = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM "MeetingRoom" WHERE id = ${room.id} FOR UPDATE`;
      await assertRoomFreeTx(tx, room.id, meeting.startAt, meeting.endAt, meeting.id);
      const row = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          status: nextStatus,
          waitlistOfferedAt: null,
          waitlistOfferExpiresAt: null,
        },
      });
      await tx.meetingEvent.create({
        data: {
          meetingId,
          type: "WAITLIST_CLAIMED",
          actorId: ctx.actorId,
          data: { status: nextStatus },
        },
      });
        if (needsApproval) {
          await tx.meetingApproval.create({
            data: { meetingId, action: "REQUESTED", step: 1 },
          });
        }
        return row;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ).catch(mapTxConflict);

  await scheduleReminders(updated);
  await notificationService.meetingCreated(updated, ctx.actorId);
  void calendarSyncBestEffort("create", updated);
  return updated;
}

export async function declineWaitlistOffer(
  meetingId: string,
  ctx: TransitionContext,
): Promise<Meeting> {
  const meeting = await getMeetingInOrg(meetingId, ctx.orgId);
  if (meeting.organizerId !== ctx.actorId && meeting.createdById !== ctx.actorId) {
    throw new HttpError(403, "فقط برگزارکننده می‌تواند پیشنهاد را رد کند", "FORBIDDEN");
  }
  if (meeting.status !== WAITLIST_OFFERED) {
    throw new HttpError(400, "پیشنهاد فعالی نیست", "BAD_STATE");
  }
  const now = new Date();
  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: WAITLIST_WAITING,
      waitlistQueuedAt: bumpExpiredToBack(meeting.waitlistQueuedAt ?? now, now),
      waitlistOfferedAt: null,
      waitlistOfferExpiresAt: null,
    },
  });
  await prisma.meetingEvent.create({
    data: { meetingId, type: "WAITLIST_DECLINED", actorId: ctx.actorId },
  });
  void offerWaitlistAfterVacate({
    orgId: ctx.orgId,
    roomId: meeting.roomId,
    startAt: meeting.startAt,
    endAt: meeting.endAt,
  }).catch((err) => console.error("[waitlist]", err));
  return updated;
}
