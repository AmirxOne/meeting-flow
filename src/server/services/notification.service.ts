// Notification service — in-app notifications persisted in DB, plus pluggable
// SMS/Email provider ports. Dev uses mock providers (logged); production
// adapters can be dropped in via env without touching call sites.

import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { createEmailProvider, type EmailProvider } from "./email-provider";
import { createSmsProvider, type SmsProvider } from "./sms-provider";
import { getOrgTimezone } from "./org-timezone.service";
import { formatDateTimeInTz } from "@/lib/timezone";

export type { EmailProvider } from "./email-provider";
export type { SmsProvider } from "./sms-provider";

export const smsProvider: SmsProvider = createSmsProvider();
export const emailProvider: EmailProvider = createEmailProvider();

export type NotificationType =
  | "MEETING_CREATED"
  | "MEETING_APPROVED"
  | "MEETING_REJECTED"
  | "MEETING_CANCELLED"
  | "MEETING_RESCHEDULED"
  | "ROOM_CHANGED"
  | "PARTICIPANT_ADDED"
  | "PARTICIPANT_RESPONDED"
  | "MEETING_REMINDER"
  | "MEETING_STARTED"
  | "MEETING_EXTENDED";

async function faDateTime(d: Date): Promise<string> {
  const tz = await getOrgTimezone();
  return formatDateTimeInTz(d, tz);
}

async function notifyUsers(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  const uniq = [...new Set(userIds)].filter(Boolean);
  if (uniq.length === 0) return;
  await prisma.notification.createMany({
    data: uniq.map((userId) => ({
      userId,
      type,
      title,
      body,
      data: data as object | undefined,
    })),
  });
}

async function meetingPeople(meetingId: string, includeOrganizer = true): Promise<string[]> {
  const parts = await prisma.meetingParticipant.findMany({
    where: { meetingId },
    select: { userId: true },
  });
  const m = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { organizerId: true },
  });
  const ids = parts.map((p) => p.userId);
  if (includeOrganizer && m) ids.push(m.organizerId);
  return ids;
}

export const notificationService = {
  async meetingCreated(meeting: Meeting, actorId: string) {
    const others = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    await notifyUsers(
      others,
      "MEETING_CREATED",
      `جلسه «${meeting.title}» ایجاد شد`,
      `${await faDateTime(meeting.startAt)} تا ${await faDateTime(meeting.endAt)}`,
      { meetingId: meeting.id },
    );
    if (meeting.status === "PENDING_APPROVAL") {
      const operators = await prisma.user.findMany({
        where: {
          isActive: true,
          roles: { some: { role: { key: { in: ["ADMIN", "MEETING_OPERATOR", "SUPER_ADMIN"] } } } },
        },
        select: { id: true },
      });
      await notifyUsers(
        operators.map((o) => o.id),
        "MEETING_CREATED",
        `درخواست جلسه «${meeting.title}» در انتظار تأیید`,
        `${await faDateTime(meeting.startAt)}`,
        { meetingId: meeting.id, pendingApproval: true },
      );
    }
  },

  async meetingApproved(meeting: Meeting, actorId: string) {
    const people = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    await notifyUsers(
      people,
      "MEETING_APPROVED",
      `جلسه «${meeting.title}» تأیید شد`,
      `${await faDateTime(meeting.startAt)}`,
      { meetingId: meeting.id },
    );
  },

  async meetingRejected(meeting: Meeting, actorId: string, reason: string) {
    const people = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    await notifyUsers(
      people,
      "MEETING_REJECTED",
      `جلسه «${meeting.title}» رد شد`,
      `دلیل: ${reason}`,
      { meetingId: meeting.id },
    );
  },

  async meetingCancelled(meeting: Meeting, actorId: string, reason: string) {
    const people = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    await notifyUsers(
      people,
      "MEETING_CANCELLED",
      `جلسه «${meeting.title}» لغو شد`,
      `دلیل: ${reason}`,
      { meetingId: meeting.id },
    );
  },

  async meetingRescheduled(
    meeting: Meeting,
    actorId: string,
    old: { startAt: Date; endAt: Date; roomId: string | null },
  ) {
    const people = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    await notifyUsers(
      people,
      "MEETING_RESCHEDULED",
      `زمان جلسه «${meeting.title}» تغییر کرد`,
      `${await faDateTime(old.startAt)} ← ${await faDateTime(meeting.startAt)}`,
      { meetingId: meeting.id },
    );
  },

  async roomChanged(meeting: Meeting, actorId: string, newRoomName: string) {
    const people = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    await notifyUsers(
      people,
      "ROOM_CHANGED",
      `اتاق جلسه «${meeting.title}» تغییر کرد`,
      `اتاق جدید: ${newRoomName}`,
      { meetingId: meeting.id },
    );
  },

  async participantAdded(meeting: Meeting, userId: string, actorId: string) {
    await notifyUsers(
      [userId],
      "PARTICIPANT_ADDED",
      `به جلسه «${meeting.title}» دعوت شدید`,
      `${await faDateTime(meeting.startAt)}`,
      { meetingId: meeting.id },
    );
  },

  async participantResponded(
    meeting: Meeting,
    participantUserId: string,
    actorId: string,
    responseStatus: string,
    participantName: string,
  ) {
    if (participantUserId !== actorId) return;
    const labels: Record<string, string> = {
      ACCEPTED: "پذیرفت",
      DECLINED: "رد کرد",
      TENTATIVE: "مردد است",
    };
    await notifyUsers(
      [meeting.organizerId],
      "PARTICIPANT_RESPONDED",
      `${participantName} به دعوت «${meeting.title}» پاسخ داد`,
      labels[responseStatus] ?? responseStatus,
      { meetingId: meeting.id, userId: participantUserId, responseStatus },
    );
  },

  async meetingStarted(meeting: Meeting, actorId: string) {
    const people = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    await notifyUsers(
      people,
      "MEETING_STARTED",
      `جلسه «${meeting.title}» شروع شد`,
      await faDateTime(meeting.startAt),
      { meetingId: meeting.id },
    );
  },

  async meetingExtended(meeting: Meeting, actorId: string) {
    const people = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    await notifyUsers(
      people,
      "MEETING_EXTENDED",
      `جلسه «${meeting.title}» تمدید شد`,
      `تا ${await faDateTime(meeting.endAt)}`,
      { meetingId: meeting.id },
    );
  },

  async meetingReminder(meeting: Meeting, userId: string, offsetMin: number) {
    await notifyUsers(
      [userId],
      "MEETING_REMINDER",
      `یادآوری: جلسه «${meeting.title}»`,
      offsetMin > 0 ? `${offsetMin} دقیقه دیگر آغاز می‌شود` : "جلسه در حال شروع",
      { meetingId: meeting.id },
    );
    // SMS/Email fan-out for reminders is handled by the worker (channel aware)
  },
};
