import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { maskPrivateMeeting, type PrivacyViewer } from "./privacy";
import { listInvolvedCalendarConnections } from "./calendar-connection.service";
import {
  createCalendarProviderForConnection,
  type CalendarEventPayload,
  type CalendarProvider,
} from "./calendar-provider";
import { formatAgendaPlain, mergeDescriptionWithAgenda } from "@/lib/agenda";
import { mergeTextWithVideoLink } from "@/lib/video-link";

function calendarStatus(meeting: Meeting): CalendarEventPayload["status"] {
  if (meeting.status === "CANCELLED" || meeting.status === "REJECTED") return "cancelled";
  if (meeting.status === "PENDING_APPROVAL") return "tentative";
  return "confirmed";
}

/**
 * Build provider payload from meeting + related rows.
 * When a viewer is passed, private meetings are masked via privacy.ts;
 * outsiders get `null` so the event is not written to their calendar.
 */
export async function buildCalendarPayload(
  meeting: Meeting,
  viewer?: PrivacyViewer,
): Promise<CalendarEventPayload | null> {
  const [room, participants, guests, agendaRows] = await Promise.all([
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
    prisma.meetingAgendaItem.findMany({
      where: { meetingId: meeting.id },
      select: {
        title: true,
        durationMin: true,
        owner: { select: { fullName: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  let title = meeting.title;
  let description = meeting.description;
  let attendeeEmails = [
    ...participants.map((p) => p.user.email).filter(Boolean),
    ...guests.map((g) => g.email).filter((e): e is string => !!e),
  ];

  if (viewer) {
    const masked = maskPrivateMeeting(
      {
        isPrivate: meeting.isPrivate,
        organizerId: meeting.organizerId,
        title: meeting.title,
        description: meeting.description,
        participants: participants.map((p) => ({ userId: p.userId })),
      },
      viewer,
    );
    if (masked.isMasked) return null;
    title = masked.title;
    description = (masked.description as string | null | undefined) ?? null;
    if (meeting.isPrivate) {
      attendeeEmails = [];
    }
  }

  const agendaPlain = formatAgendaPlain(
    agendaRows.map((it) => ({
      title: it.title,
      durationMin: it.durationMin,
      ownerName: it.owner?.fullName ?? null,
    })),
  );
  description = mergeTextWithVideoLink(
    mergeDescriptionWithAgenda(description, agendaPlain),
    meeting.videoProvider,
    meeting.videoUrl,
  );

  const location = room ? `${room.name} — ${room.branch.name}` : undefined;

  return {
    meetingId: meeting.id,
    title,
    description,
    startAt: meeting.startAt,
    endAt: meeting.endAt,
    location,
    attendeeEmails: [...new Set(attendeeEmails)],
    status: calendarStatus(meeting),
  };
}

async function upsertSyncRecord(
  meetingId: string,
  userId: string,
  provider: string,
  externalEventId: string,
) {
  await prisma.meetingCalendarSync.upsert({
    where: { meetingId_userId_provider: { meetingId, userId, provider } },
    create: { meetingId, userId, provider, externalEventId },
    update: { externalEventId, lastSyncedAt: new Date(), lastError: null },
  });
}

async function recordSyncError(
  meetingId: string,
  userId: string,
  provider: string,
  error: unknown,
) {
  const message = String(error).slice(0, 300);
  await prisma.meetingCalendarSync.upsert({
    where: { meetingId_userId_provider: { meetingId, userId, provider } },
    create: {
      meetingId,
      userId,
      provider,
      externalEventId: "",
      lastError: message,
    },
    update: { lastError: message, lastSyncedAt: new Date() },
  });
}

export async function syncMeetingCalendarCreate(
  meeting: Meeting,
  provider: CalendarProvider,
  userId: string = meeting.organizerId,
): Promise<void> {
  const payload = await buildCalendarPayload(meeting, { id: userId });
  if (!payload) return;
  const { externalEventId } = await provider.createEvent(payload);
  await upsertSyncRecord(meeting.id, userId, provider.name, externalEventId);
}

export async function syncMeetingCalendarUpdate(
  meeting: Meeting,
  provider: CalendarProvider,
  userId: string = meeting.organizerId,
): Promise<void> {
  const payload = await buildCalendarPayload(meeting, { id: userId });
  if (!payload) return;

  const existing = await prisma.meetingCalendarSync.findUnique({
    where: {
      meetingId_userId_provider: {
        meetingId: meeting.id,
        userId,
        provider: provider.name,
      },
    },
  });

  if (!existing?.externalEventId) {
    const { externalEventId } = await provider.createEvent(payload);
    await upsertSyncRecord(meeting.id, userId, provider.name, externalEventId);
    return;
  }

  await provider.updateEvent(existing.externalEventId, payload);
  await upsertSyncRecord(meeting.id, userId, provider.name, existing.externalEventId);
}

export async function syncMeetingCalendarCancel(
  meeting: Meeting,
  provider: CalendarProvider,
  userId: string = meeting.organizerId,
): Promise<void> {
  const existing = await prisma.meetingCalendarSync.findUnique({
    where: {
      meetingId_userId_provider: {
        meetingId: meeting.id,
        userId,
        provider: provider.name,
      },
    },
  });
  if (!existing?.externalEventId) return;

  await provider.cancelEvent(existing.externalEventId);
  await prisma.meetingCalendarSync.update({
    where: {
      meetingId_userId_provider: {
        meetingId: meeting.id,
        userId,
        provider: provider.name,
      },
    },
    data: { lastSyncedAt: new Date(), lastError: null },
  });
}

/**
 * Best-effort wrapper — never throws.
 * Users without a calendar connection are skipped; the meeting still saves.
 */
export async function calendarSyncBestEffort(
  action: "create" | "update" | "cancel",
  meeting: Meeting,
): Promise<void> {
  let connections: Awaited<ReturnType<typeof listInvolvedCalendarConnections>> = [];
  try {
    connections = await listInvolvedCalendarConnections(meeting);
  } catch (e) {
    console.error(`[calendar-sync] list connections failed for meeting ${meeting.id}:`, e);
    return;
  }
  if (connections.length === 0) return;

  for (const conn of connections) {
    try {
      const provider = createCalendarProviderForConnection(conn);
      if (!provider) continue;
      if (action === "create") await syncMeetingCalendarCreate(meeting, provider, conn.userId);
      else if (action === "update") await syncMeetingCalendarUpdate(meeting, provider, conn.userId);
      else await syncMeetingCalendarCancel(meeting, provider, conn.userId);
    } catch (e) {
      console.error(
        `[calendar-sync] ${action} failed for meeting ${meeting.id} user ${conn.userId}:`,
        e,
      );
      try {
        await recordSyncError(meeting.id, conn.userId, conn.provider, e);
      } catch {
        /* ignore secondary persistence errors */
      }
    }
  }
}
