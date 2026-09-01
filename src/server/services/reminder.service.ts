import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { notificationService } from "./notification.service";
import { getSmsProvider, formatSmsError, type SmsSendMeta } from "./sms-provider";
import { getEmailProvider, formatEmailError } from "./email-provider";
import { loadAgendaPlain } from "./agenda.service";
import { formatVideoInviteLine } from "@/lib/video-link";
import { reminderEmailTemplate } from "@/lib/email-templates";
import { getOrgPolicies } from "./meeting.service";
import { reminderPushPayload, sendWebPushToUser } from "./web-push.service";
import {
  MEETING_END_GRACE_MS,
  resolveStaleMeetingStatus,
  STALE_MEETING_STATUSES,
} from "./meeting-lifecycle";
import {
  isNotifChannelEnabled,
  parseOrgNotifChannels,
  parseStoredNotifPrefs,
  type NotifChannel,
} from "@/lib/notification-prefs";
import { reportError } from "@/server/report-error";

export type ReminderChannel = NotifChannel;
export const parseReminderChannels = parseOrgNotifChannels;

export function buildReminderRows(input: {
  meetingId: string;
  startAt: Date;
  offsets: number[];
  userIds: string[];
  users: { id: string; phone: string | null; email: string }[];
  channels: ReminderChannel[];
  now?: Date;
}): {
  meetingId: string;
  userId: string;
  remindAt: Date;
  offsetMin: number;
  channel: string;
}[] {
  const now = input.now ?? new Date();
  const userMap = new Map(input.users.map((u) => [u.id, u]));
  const channelSet = new Set(input.channels);
  const rows: {
    meetingId: string;
    userId: string;
    remindAt: Date;
    offsetMin: number;
    channel: string;
  }[] = [];

  for (const offset of input.offsets) {
    const remindAt = new Date(input.startAt.getTime() - offset * 60000);
    if (remindAt <= now) continue;
    for (const userId of input.userIds) {
      const u = userMap.get(userId);
      if (channelSet.has("IN_APP")) {
        rows.push({
          meetingId: input.meetingId,
          userId,
          remindAt,
          offsetMin: offset,
          channel: "IN_APP",
        });
      }
      if (channelSet.has("SMS") && u?.phone) {
        rows.push({
          meetingId: input.meetingId,
          userId,
          remindAt,
          offsetMin: offset,
          channel: "SMS",
        });
      }
      if (channelSet.has("EMAIL") && u?.email) {
        rows.push({
          meetingId: input.meetingId,
          userId,
          remindAt,
          offsetMin: offset,
          channel: "EMAIL",
        });
      }
      if (channelSet.has("PUSH")) {
        rows.push({
          meetingId: input.meetingId,
          userId,
          remindAt,
          offsetMin: offset,
          channel: "PUSH",
        });
      }
    }
  }
  return rows;
}

/** (Re)schedule reminders for a meeting based on org policy offsets and REMINDER_CHANNELS. */
export async function scheduleReminders(meeting: Meeting) {
  await prisma.meetingReminder.updateMany({
    where: { meetingId: meeting.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"].includes(meeting.status)) return;

  const policies = await getOrgPolicies(meeting.orgId);
  const channels = parseReminderChannels();
  const people = await prisma.meetingParticipant.findMany({
    where: { meetingId: meeting.id },
    select: { userId: true },
  });
  const userIds = [...new Set([meeting.organizerId, ...people.map((p) => p.userId)])];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, phone: true, email: true },
  });

  const rows = buildReminderRows({
    meetingId: meeting.id,
    startAt: meeting.startAt,
    offsets: policies.defaultReminderOffsets,
    userIds,
    users,
    channels,
  });

  if (rows.length) await prisma.meetingReminder.createMany({ data: rows });
}

/** Worker tick: send due reminders. Returns sent count. */
export async function processDueReminders(): Promise<number> {
  const due = await prisma.meetingReminder.findMany({
    where: { status: "PENDING", remindAt: { lte: new Date() } },
    include: { meeting: true, user: true },
    take: 100,
  });
  const orgChannels = parseReminderChannels();
  let sent = 0;
  for (const r of due) {
    try {
      const prefs = parseStoredNotifPrefs(r.user?.notificationPrefs);
      if (
        !isNotifChannelEnabled({
          prefs,
          event: "reminder",
          channel: r.channel,
          orgChannels,
          hasPhone: !!r.user?.phone,
          hasEmail: !!r.user?.email,
        })
      ) {
        await prisma.meetingReminder.update({
          where: { id: r.id },
          data: { status: "SENT", sentAt: new Date(), lastError: null },
        });
        sent += 1;
        continue;
      }
      if (r.channel === "IN_APP" && r.userId) {
        await notificationService.meetingReminder(r.meeting, r.userId, r.offsetMin);
      }
      const phone = r.user?.phone;
      if (r.channel === "SMS" && phone) {
        const text = `یادآوری جلسه «${r.meeting.title}» — ${r.offsetMin} دقیقه دیگر`;
        const meta: SmsSendMeta = {
          token: String(r.offsetMin),
          token2: r.meeting.title.slice(0, 80),
        };
        await getSmsProvider().send(phone, text, meta);
      }
      const email = r.user?.email;
      if (r.channel === "EMAIL" && email) {
        const agendaPlain = await loadAgendaPlain(r.meetingId);
        const videoLine = r.meeting.videoUrl
          ? formatVideoInviteLine(r.meeting.videoProvider, r.meeting.videoUrl)
          : null;
        const tpl = reminderEmailTemplate({
          title: r.meeting.title,
          agendaPlain,
          offsetMin: r.offsetMin,
          videoLine,
          meetingId: r.meeting.id,
        });
        await getEmailProvider().send(email, tpl.subject, tpl.text, tpl.html);
      }
      if (r.channel === "PUSH") {
        await sendWebPushToUser(
          r.userId,
          reminderPushPayload(r.meeting.title, r.offsetMin, r.meeting.id),
        );
      }
      await prisma.meetingReminder.update({
        where: { id: r.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });
      sent += 1;
    } catch (e) {
      reportError(e, {
        tags: { source: "reminder", channel: r.channel },
        extra: { reminderId: r.id, meetingId: r.meetingId },
      });
      const lastError =
        r.channel === "EMAIL" ? formatEmailError(e) : formatSmsError(e);
      await prisma.meetingReminder.update({
        where: { id: r.id },
        data: { status: "PENDING", lastError },
      });
    }
  }
  return sent;
}

/** Worker tick: auto-mark no-shows & auto-complete stale meetings. */
export async function processMeetingLifecycle(): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - MEETING_END_GRACE_MS);

  const stale = await prisma.meeting.findMany({
    where: {
      status: { in: [...STALE_MEETING_STATUSES] },
      endAt: { lt: cutoff },
    },
    select: {
      id: true,
      status: true,
      events: { where: { type: "STARTED" }, take: 1, select: { id: true } },
    },
    take: 100,
  });

  let closed = 0;
  for (const m of stale) {
    const next = resolveStaleMeetingStatus({
      status: m.status,
      hasStartedEvent: m.events.length > 0,
    });
    if (!next) continue;

    await prisma.$transaction(async (tx) => {
      await tx.meeting.update({ where: { id: m.id }, data: { status: next } });
      await tx.meetingEvent.create({
        data: {
          meetingId: m.id,
          type: next,
          data: {
            auto: true,
            reason: next === "NO_SHOW" ? "AUTO_NO_SHOW" : "AUTO_COMPLETE",
          },
        },
      });
    });
    closed += 1;
  }
  return closed;
}
