import { Prisma, type Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import {
  assertTransition,
  DEFAULT_POLICIES,
  evaluateApprovalNeed,
  type PolicyValues,
} from "./state-machine";
import { findRoomConflicts, findUserConflicts } from "./conflict.service";
import { assertRoomNotExcludedOutsideTx, assertRoomNotExcluded } from "./room-exclusion.service";
import { notificationService } from "./notification.service";
import { scheduleReminders } from "./reminder.service";
import {
  canRespondToMeeting,
  isParticipantResponse,
} from "./participant-response.service";
import { generateCheckinCode } from "./guest-checkin.service";

export interface CreateMeetingInput {
  title: string;
  description?: string;
  branchId: string;
  roomId?: string;
  organizerId: string;
  startAt: Date;
  endAt: Date;
  meetingType?: string;
  priority?: string;
  isPrivate?: boolean;
  participantIds?: string[];
  guests?: {
    name: string;
    company?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }[];
}

export async function getOrgPolicies(): Promise<PolicyValues> {
  const org = await prisma.organization.findFirst({
    include: { policies: true },
  });
  if (!org) return DEFAULT_POLICIES;
  const merged: PolicyValues = { ...DEFAULT_POLICIES };
  for (const p of org.policies) {
    if (p.key in merged) {
      (merged as unknown as Record<string, unknown>)[p.key] = p.value;
    }
  }
  return merged;
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

  const policies = await getOrgPolicies();
  if (durationMin < policies.minDurationMin) {
    throw new HttpError(400, `حداقل مدت جلسه ${policies.minDurationMin} دقیقه است`, "TOO_SHORT");
  }
  if (durationMin > policies.maxDurationMin) {
    throw new HttpError(400, `حداکثر مدت جلسه ${policies.maxDurationMin} دقیقه است`, "TOO_LONG");
  }

  const room = input.roomId
    ? await prisma.meetingRoom.findUnique({ where: { id: input.roomId } })
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
  });

  return prisma.$transaction(
    async (tx) => {
      if (room) {
        // lock room row for the duration of the tx
        await tx.$executeRaw`SELECT id FROM "MeetingRoom" WHERE id = ${room.id} FOR UPDATE`;
        await assertRoomFreeTx(tx, room.id, input.startAt, input.endAt);
      }

      const meeting = await tx.meeting.create({
        data: {
          title: input.title,
          description: input.description,
          organizerId: input.organizerId,
          branchId: input.branchId,
          roomId: input.roomId,
          startAt: input.startAt,
          endAt: input.endAt,
          meetingType: input.meetingType ?? "INTERNAL",
          priority: input.priority ?? "NORMAL",
          isPrivate: input.isPrivate ?? false,
          status: needsApproval ? "PENDING_APPROVAL" : "CONFIRMED",
        },
      });

      // organizer as participant
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
          actorId: input.organizerId,
          data: { needsApproval },
        },
      });

      if (needsApproval) {
        await tx.meetingApproval.create({
          data: { meetingId: meeting.id, action: "REQUESTED", step: 1 },
        });
      }

      return meeting;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
    .then(async (meeting) => {
      // side effects (outside tx)
      await scheduleReminders(meeting);
      await notificationService.meetingCreated(meeting, input.organizerId);
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

async function assertRoomFreeTx(
  tx: Prisma.TransactionClient,
  roomId: string,
  start: Date,
  end: Date,
  excludeMeetingId?: string,
) {
  const rows = await tx.meeting.count({
    where: {
      roomId,
      status: { in: ["PENDING_APPROVAL", "APPROVED", "CONFIRMED", "RESCHEDULED", "IN_PROGRESS"] },
      startAt: { lt: end },
      endAt: { gt: start },
      ...(excludeMeetingId ? { id: { not: excludeMeetingId } } : {}),
    },
  });
  if (rows > 0) {
    throw new HttpError(409, "اتاق در این بازه آزاد نیست", "ROOM_CONFLICT");
  }
  await assertRoomNotExcluded(tx, roomId, start, end);
}

export interface TransitionContext {
  actorId: string;
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
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
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
  },
  ctx: TransitionContext,
): Promise<Meeting> {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
  if (["COMPLETED", "NO_SHOW", "CANCELLED", "REJECTED"].includes(meeting.status)) {
    throw new HttpError(400, "این جلسه قابل زمان‌بندی مجدد نیست", "BAD_STATE");
  }

  const start = input.startAt ?? meeting.startAt;
  const end = input.endAt ?? new Date(start.getTime() + (meeting.endAt.getTime() - meeting.startAt.getTime()));
  const roomId = input.roomId ?? meeting.roomId;

  const old = { startAt: meeting.startAt, endAt: meeting.endAt, roomId: meeting.roomId };

  return prisma.$transaction(
    async (tx) => {
      if (roomId) {
        await tx.$executeRaw`SELECT id FROM "MeetingRoom" WHERE id = ${roomId} FOR UPDATE`;
        await assertRoomFreeTx(tx, roomId, start, end, meeting.id);
      }
      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          startAt: start,
          endAt: end,
          roomId,
          status: meeting.status === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "RESCHEDULED",
        },
      });
      await tx.meetingEvent.create({
        data: {
          meetingId,
          type: "RESCHEDULED",
          actorId: ctx.actorId,
          data: {
            from: { startAt: old.startAt.toISOString(), endAt: old.endAt.toISOString(), roomId: old.roomId },
            to: { startAt: start.toISOString(), endAt: end.toISOString(), roomId },
            reason: input.reason,
          },
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ).then(async (m) => {
    await scheduleReminders(m);
    await notificationService.meetingRescheduled(m, ctx.actorId, old);
    return m;
  });
}

export async function cancelMeeting(
  meetingId: string,
  input: { reason: string; note?: string },
  ctx: TransitionContext,
): Promise<Meeting> {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
  assertTransition(meeting.status, "CANCELLED");

  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: "CANCELLED",
      cancelReason: input.reason,
      cancelNote: input.note,
    },
  });
  await prisma.meetingEvent.create({
    data: {
      meetingId,
      type: "CANCELLED",
      actorId: ctx.actorId,
      data: { reason: input.reason, note: input.note },
    },
  });
  await prisma.meetingReminder.updateMany({
    where: { meetingId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  await notificationService.meetingCancelled(updated, ctx.actorId, input.reason);
  return updated;
}

export async function changeRoom(
  meetingId: string,
  roomId: string,
  ctx: TransitionContext,
): Promise<Meeting> {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
  if (["COMPLETED", "NO_SHOW", "CANCELLED"].includes(meeting.status)) {
    throw new HttpError(400, "این جلسه قابل تغییر اتاق نیست", "BAD_STATE");
  }
  const room = await prisma.meetingRoom.findUnique({ where: { id: roomId } });
  if (!room || !room.isActive) throw new HttpError(404, "اتاق فعال یافت نشد", "ROOM_NOT_FOUND");

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
    return m;
  });
}

async function transition(
  meetingId: string,
  to: string,
  ctx: TransitionContext,
  extra?: (tx: Prisma.TransactionClient, m: Meeting) => Promise<void>,
): Promise<Meeting> {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
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
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
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
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
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
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
  if (["COMPLETED", "NO_SHOW", "CANCELLED", "REJECTED"].includes(meeting.status)) {
    throw new HttpError(400, "نمی‌توان به این جلسه فرد اضافه کرد", "BAD_STATE");
  }
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
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
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

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
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
}) {
  const roomConflicts = input.roomId
    ? await findRoomConflicts(input.roomId, input.startAt, input.endAt, input.excludeMeetingId)
    : [];
  const userConflicts = await findUserConflicts(
    [...new Set([input.organizerId, ...input.participantIds])],
    input.startAt,
    input.endAt,
    input.excludeMeetingId,
  );
  return { hard: roomConflicts, soft: userConflicts };
}
