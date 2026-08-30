import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { notificationService, smsProvider, emailProvider } from "./notification.service";
import { getOrgPolicies } from "./meeting.service";

export type ReminderChannel = "IN_APP" | "SMS" | "EMAIL";

const VALID_CHANNELS: ReminderChannel[] = ["IN_APP", "SMS", "EMAIL"];

/** Parse REMINDER_CHANNELS env (comma-separated). Default: IN_APP only. */
export function parseReminderChannels(raw?: string): ReminderChannel[] {
  const source = raw ?? process.env.REMINDER_CHANNELS;
  if (!source?.trim()) return ["IN_APP"];
  const parsed = source
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((c): c is ReminderChannel => VALID_CHANNELS.includes(c as ReminderChannel));
  return parsed.length ? [...new Set(parsed)] : ["IN_APP"];
}

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

  const policies = await getOrgPolicies();
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
  let sent = 0;
  for (const r of due) {
    try {
      if (r.channel === "IN_APP" && r.userId) {
        await notificationService.meetingReminder(r.meeting, r.userId, r.offsetMin);
      }
      const phone = r.user?.phone;
      if (r.channel === "SMS" && phone) {
        await smsProvider.send(
          phone,
          `یادآوری جلسه «${r.meeting.title}» — ${r.offsetMin} دقیقه دیگر`,
        );
      }
      const email = r.user?.email;
      if (r.channel === "EMAIL" && email) {
        await emailProvider.send(email, `یادآوری جلسه: ${r.meeting.title}`, "یادآوری جلسه");
      }
      await prisma.meetingReminder.update({
        where: { id: r.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      sent += 1;
    } catch (e) {
      await prisma.meetingReminder.update({
        where: { id: r.id },
        data: { status: "PENDING", lastError: String(e).slice(0, 300) },
      });
    }
  }
  return sent;
}

/** Worker tick: auto-mark no-shows (started but never ended) & auto-complete. */
export async function processMeetingLifecycle(): Promise<number> {
  const now = new Date();
  const stale = await prisma.meeting.updateMany({
    where: { status: "IN_PROGRESS", endAt: { lt: new Date(now.getTime() - 60 * 60000) } },
    data: { status: "COMPLETED" },
  });
  return stale.count;
}
