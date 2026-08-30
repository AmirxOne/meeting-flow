import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  createCalendarProvider,
  type CalendarEventPayload,
  type CalendarProvider,
} from "./calendar-provider";

function calendarStatus(meeting: Meeting): CalendarEventPayload["status"] {
  if (meeting.status === "CANCELLED" || meeting.status === "REJECTED") return "cancelled";
  if (meeting.status === "PENDING_APPROVAL") return "tentative";
  return "confirmed";
}

/** Build provider payload from meeting + related rows. */
export async function buildCalendarPayload(meeting: Meeting): Promise<CalendarEventPayload> {
  const [room, participants, guests] = await Promise.all([
    meeting.roomId
      ? prisma.meetingRoom.findUnique({
          where: { id: meeting.roomId },
          include: { branch: { select: { name: true } } },
        })
      : Promise.resolve(null),
    prisma.meetingParticipant.findMany({
      where: { meetingId: meeting.id },
      include: { user: { select: { email: true } } },
    }),
    prisma.meetingGuest.findMany({
      where: { meetingId: meeting.id },
      select: { email: true },
    }),
  ]);

  const location = room
    ? `${room.name} — ${room.branch.name}`
    : undefined;

  const attendeeEmails = [
    ...participants.map((p) => p.user.email).filter(Boolean),
    ...guests.map((g) => g.email).filter((e): e is string => !!e),
  ];

  return {
    meetingId: meeting.id,
    title: meeting.title,
    description: meeting.description,
    startAt: meeting.startAt,
    endAt: meeting.endAt,
    location,
    attendeeEmails: [...new Set(attendeeEmails)],
    status: calendarStatus(meeting),
  };
}

async function upsertSyncRecord(
  meetingId: string,
  provider: string,
  externalEventId: string,
) {
  await prisma.meetingCalendarSync.upsert({
    where: { meetingId_provider: { meetingId, provider } },
    create: { meetingId, provider, externalEventId },
    update: { externalEventId, lastSyncedAt: new Date(), lastError: null },
  });
}

async function recordSyncError(meetingId: string, provider: string, error: unknown) {
  const message = String(error).slice(0, 300);
  await prisma.meetingCalendarSync.upsert({
    where: { meetingId_provider: { meetingId, provider } },
    create: {
      meetingId,
      provider,
      externalEventId: "",
      lastError: message,
    },
    update: { lastError: message, lastSyncedAt: new Date() },
  });
}

export async function syncMeetingCalendarCreate(
  meeting: Meeting,
  provider: CalendarProvider = createCalendarProvider(),
): Promise<void> {
  const payload = await buildCalendarPayload(meeting);
  const { externalEventId } = await provider.createEvent(payload);
  await upsertSyncRecord(meeting.id, provider.name, externalEventId);
}

export async function syncMeetingCalendarUpdate(
  meeting: Meeting,
  provider: CalendarProvider = createCalendarProvider(),
): Promise<void> {
  const existing = await prisma.meetingCalendarSync.findUnique({
    where: { meetingId_provider: { meetingId: meeting.id, provider: provider.name } },
  });

  const payload = await buildCalendarPayload(meeting);

  if (!existing?.externalEventId) {
    const { externalEventId } = await provider.createEvent(payload);
    await upsertSyncRecord(meeting.id, provider.name, externalEventId);
    return;
  }

  await provider.updateEvent(existing.externalEventId, payload);
  await upsertSyncRecord(meeting.id, provider.name, existing.externalEventId);
}

export async function syncMeetingCalendarCancel(
  meeting: Meeting,
  provider: CalendarProvider = createCalendarProvider(),
): Promise<void> {
  const existing = await prisma.meetingCalendarSync.findUnique({
    where: { meetingId_provider: { meetingId: meeting.id, provider: provider.name } },
  });
  if (!existing?.externalEventId) return;

  await provider.cancelEvent(existing.externalEventId);
  await prisma.meetingCalendarSync.update({
    where: { meetingId_provider: { meetingId: meeting.id, provider: provider.name } },
    data: { lastSyncedAt: new Date(), lastError: null },
  });
}

/** Best-effort wrapper — never throws; logs errors. */
export async function calendarSyncBestEffort(
  action: "create" | "update" | "cancel",
  meeting: Meeting,
): Promise<void> {
  try {
    if (action === "create") await syncMeetingCalendarCreate(meeting);
    else if (action === "update") await syncMeetingCalendarUpdate(meeting);
    else await syncMeetingCalendarCancel(meeting);
  } catch (e) {
    console.error(`[calendar-sync] ${action} failed for meeting ${meeting.id}:`, e);
    try {
      const provider = createCalendarProvider();
      await recordSyncError(meeting.id, provider.name, e);
    } catch {
      /* ignore secondary persistence errors */
    }
  }
}
