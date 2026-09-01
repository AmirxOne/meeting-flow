// Notification service — in-app notifications persisted in DB, plus pluggable
// SMS/Email provider ports. Dev uses mock providers (logged); production
// adapters can be dropped in via env without touching call sites.

import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { getEmailProvider, type EmailProvider } from "./email-provider";
import { getSmsProvider, type SmsProvider } from "./sms-provider";
import { getOrgTimezone } from "./org-timezone.service";
import { formatDateTimeInTz } from "@/lib/timezone";
import { faNum } from "@/lib/fa";
import { formatVideoInviteLine } from "@/lib/video-link";
import { invitePushPayload, sendWebPushToUsers } from "./web-push.service";
import {
  inviteEmailTemplate,
  minutesEmailTemplate,
} from "@/lib/email-templates";
import {
  filterIdsForChannel,
  parseOrgNotifChannels,
  parseStoredNotifPrefs,
  type NotifEvent,
  type NotifPrefMatrix,
} from "@/lib/notification-prefs";

export type { EmailProvider } from "./email-provider";
export type { SmsProvider } from "./sms-provider";

export const smsProvider: SmsProvider = {
  get name() {
    return getSmsProvider().name;
  },
  send(to, text, meta) {
    return getSmsProvider().send(to, text, meta);
  },
};
export const emailProvider: EmailProvider = {
  get name() {
    return getEmailProvider().name;
  },
  send(to, subject, body, html) {
    return getEmailProvider().send(to, subject, body, html);
  },
};

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
  | "MEETING_EXTENDED"
  | "MINUTES_PUBLISHED"
  | "WAITLIST_JOINED"
  | "WAITLIST_OFFERED"
  | "WAITLIST_EXPIRED";

async function faDateTime(d: Date): Promise<string> {
  const tz = await getOrgTimezone();
  return formatDateTimeInTz(d, tz);
}

async function tryExternal(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[notif:${label}]`, e);
  }
}

async function notifyUsers(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  kind: NotifEvent | "always" = "always",
) {
  const uniq = [...new Set(userIds)].filter(Boolean);
  if (uniq.length === 0) return;

  const orgId = (data?.orgId as string | undefined) ?? undefined;
  const payload = {
    type,
    title,
    body,
    data: data as object | undefined,
    orgId,
  };

  if (kind === "always") {
    await prisma.notification.createMany({
      data: uniq.map((userId) => ({ userId, ...payload })),
    });
    return;
  }

  const orgChannels = parseOrgNotifChannels();
  const users = await prisma.user.findMany({
    where: { id: { in: uniq } },
    select: { id: true, phone: true, email: true, notificationPrefs: true },
  });
  const prefsByUser = new Map<string, NotifPrefMatrix>(
    users.map((u) => [u.id, parseStoredNotifPrefs(u.notificationPrefs)]),
  );
  const filterOpts = { prefsByUser, event: kind, orgChannels };

  const inAppIds = filterIdsForChannel(users, { ...filterOpts, channel: "IN_APP" });
  if (inAppIds.length) {
    await prisma.notification.createMany({
      data: inAppIds.map((userId) => ({ userId, ...payload })),
    });
  }

  // SMS / email / push for reminders are sent by the worker (channel rows).
  if (kind === "reminder") return;

  const byId = new Map(users.map((u) => [u.id, u]));
  const smsIds = filterIdsForChannel(users, { ...filterOpts, channel: "SMS" });
  for (const id of smsIds) {
    const phone = byId.get(id)?.phone;
    if (!phone) continue;
    await tryExternal("sms", () => smsProvider.send(phone, `${title}\n${body}`.slice(0, 300)));
  }

  const emailIds = filterIdsForChannel(users, { ...filterOpts, channel: "EMAIL" });
  const meetingId = typeof data?.meetingId === "string" ? data.meetingId : undefined;
  for (const id of emailIds) {
    const email = byId.get(id)?.email;
    if (!email) continue;
    const tpl =
      kind === "invite" || kind === "reschedule"
        ? inviteEmailTemplate({ heading: title, when: body, meetingId })
        : { subject: title, text: body, html: undefined as string | undefined };
    await tryExternal("email", () =>
      emailProvider.send(email, tpl.subject, tpl.text, tpl.html),
    );
  }

  const pushIds = filterIdsForChannel(users, { ...filterOpts, channel: "PUSH" });
  if (pushIds.length) {
    await sendWebPushToUsers(pushIds, invitePushPayload(title, body, meetingId ?? ""));
  }
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

async function meetingInviteBody(meeting: Meeting): Promise<string> {
  const when = `${await faDateTime(meeting.startAt)} تا ${await faDateTime(meeting.endAt)}`;
  if (!meeting.videoUrl) return when;
  return `${when}\n${formatVideoInviteLine(meeting.videoProvider, meeting.videoUrl)}`;
}

export const notificationService = {
  async meetingCreated(meeting: Meeting, actorId: string, opts?: { occurrenceCount?: number }) {
    const others = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    const n = opts?.occurrenceCount ?? 1;
    await notifyUsers(
      others,
      "MEETING_CREATED",
      n > 1
        ? `سری جلسه «${meeting.title}» با ${faNum(n)} نوبت ایجاد شد`
        : `جلسه «${meeting.title}» ایجاد شد`,
      `${await meetingInviteBody(meeting)}`,
      { meetingId: meeting.id, occurrenceCount: n },
      "invite",
    );
    if (meeting.status === "PENDING_APPROVAL") {
      const operators = await prisma.user.findMany({
        where: {
          isActive: true,
          orgId: meeting.orgId,
          roles: { some: { role: { key: { in: ["ADMIN", "MEETING_OPERATOR"] } } } },
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

  async meetingCancelled(meeting: Meeting, actorId: string, reason: string, opts?: { count?: number }) {
    const people = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    const n = opts?.count ?? 1;
    await notifyUsers(
      people,
      "MEETING_CANCELLED",
      n > 1
        ? `${faNum(n)} نوبت از سری «${meeting.title}» لغو شد`
        : `جلسه «${meeting.title}» لغو شد`,
      `دلیل: ${reason}`,
      { meetingId: meeting.id, occurrenceCount: n },
    );
  },

  async meetingRescheduled(
    meeting: Meeting,
    actorId: string,
    old: { startAt: Date; endAt: Date; roomId: string | null },
    opts?: { count?: number },
  ) {
    const people = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    const n = opts?.count ?? 1;
    await notifyUsers(
      people,
      "MEETING_RESCHEDULED",
      n > 1
        ? `زمان ${faNum(n)} نوبت از سری «${meeting.title}» تغییر کرد`
        : `زمان جلسه «${meeting.title}» تغییر کرد`,
      `${await faDateTime(old.startAt)} ← ${await faDateTime(meeting.startAt)}`,
      { meetingId: meeting.id, occurrenceCount: n },
      "reschedule",
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
    const body = await meetingInviteBody(meeting);
    await notifyUsers(
      [userId],
      "PARTICIPANT_ADDED",
      `به جلسه «${meeting.title}» دعوت شدید`,
      body,
      { meetingId: meeting.id },
      "invite",
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

  async minutesPublished(meeting: Pick<Meeting, "id" | "title">, actorId: string) {
    const people = (await meetingPeople(meeting.id)).filter((id) => id !== actorId);
    await notifyUsers(
      people,
      "MINUTES_PUBLISHED",
      "صورتجلسه ثبت شد",
      `جلسه «${meeting.title}»`,
      { meetingId: meeting.id },
    );
    if (!parseOrgNotifChannels().includes("EMAIL") || people.length === 0) return;
    const recipients = await prisma.user.findMany({
      where: { id: { in: people } },
      select: { email: true },
    });
    const tpl = minutesEmailTemplate({ title: meeting.title, meetingId: meeting.id });
    for (const u of recipients) {
      if (!u.email) continue;
      await tryExternal("email", () =>
        emailProvider.send(u.email, tpl.subject, tpl.text, tpl.html),
      );
    }
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
      offsetMin > 0 ? `${faNum(offsetMin)} دقیقه دیگر آغاز می‌شود` : "جلسه در حال شروع",
      { meetingId: meeting.id },
      "reminder",
    );
    // SMS/Email/Push fan-out for reminders is handled by the worker (channel aware)
  },

  async waitlistJoined(meeting: Meeting, position: number) {
    await notifyUsers(
      [meeting.organizerId],
      "WAITLIST_JOINED",
      `در لیست انتظار «${meeting.title}» ثبت شدید`,
      `نفر ${faNum(position)} صف. تا وقتی قطعی نکنید اتاق قفل نمی‌شود.`,
      { meetingId: meeting.id, position },
      "always",
    );
  },

  async waitlistOffered(meeting: Meeting, expiresAt: Date) {
    await notifyUsers(
      [meeting.organizerId],
      "WAITLIST_OFFERED",
      `اتاق جلسه «${meeting.title}» آزاد شد`,
      `تا ${await faDateTime(expiresAt)} قطعی کنید؛ بعد از آن نوبت نفر بعد است.`,
      { meetingId: meeting.id, offerExpiresAt: expiresAt.toISOString() },
      "always",
    );
  },

  async waitlistExpired(meeting: { id: string; organizerId: string; title: string }) {
    await notifyUsers(
      [meeting.organizerId],
      "WAITLIST_EXPIRED",
      `مهلت قطعی کردن «${meeting.title}» تمام شد`,
      "نوبت به نفر بعد رسید. اگر اتاق دوباره آزاد شود دوباره خبر می‌دهیم.",
      { meetingId: meeting.id },
      "always",
    );
  },
};
