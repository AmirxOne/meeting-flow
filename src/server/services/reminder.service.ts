import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { notificationService, smsProvider, emailProvider } from "./notification.service";
import { getOrgPolicies } from "./meeting.service";

/** (Re)schedule in-app reminders for a meeting based on org policy offsets. */
export async function scheduleReminders(meeting: Meeting) {
  await prisma.meetingReminder.updateMany({
    where: { meetingId: meeting.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"].includes(meeting.status)) return;

  const policies = await getOrgPolicies();
  const people = await prisma.meetingParticipant.findMany({
    where: { meetingId: meeting.id },
    select: { userId: true },
  });
  const userIds = [...new Set([meeting.organizerId, ...people.map((p) => p.userId)])];

  const rows: {
    meetingId: string;
    userId: string;
    remindAt: Date;
    offsetMin: number;
    channel: string;
  }[] = [];
  for (const offset of policies.defaultReminderOffsets) {
    const remindAt = new Date(meeting.startAt.getTime() - offset * 60000);
    if (remindAt <= new Date()) continue;
    for (const userId of userIds) {
      rows.push({
        meetingId: meeting.id,
        userId,
        remindAt,
        offsetMin: offset,
        channel: "IN_APP",
      });
    }
  }
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
      if (r.userId) await notificationService.meetingReminder(r.meeting, r.userId, r.offsetMin);
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
  // meetings that ended long ago but still IN_PROGRESS → COMPLETE them
  const stale = await prisma.meeting.updateMany({
    where: { status: "IN_PROGRESS", endAt: { lt: new Date(now.getTime() - 60 * 60000) } },
    data: { status: "COMPLETED" },
  });
  return stale.count;
}
