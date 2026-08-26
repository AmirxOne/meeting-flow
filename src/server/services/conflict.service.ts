import { prisma } from "@/server/db";
import type { Meeting } from "@prisma/client";

// Active statuses that occupy a room / a person's calendar
export const BLOCKING_STATUSES = [
  "PENDING_APPROVAL",
  "APPROVED",
  "CONFIRMED",
  "RESCHEDULED",
  "IN_PROGRESS",
] as const;

export interface Interval {
  start: Date;
  end: Date;
}

export interface HardConflict {
  kind: "ROOM";
  roomId: string;
  roomName: string;
  meetingId: string;
  meetingTitle: string;
  startAt: Date;
  endAt: Date;
}

export interface SoftConflict {
  kind: "USER" | "ORGANIZER";
  userId: string;
  userName: string;
  meetingId: string;
  meetingTitle: string;
  startAt: Date;
  endAt: Date;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function intervalsOverlap(
  aStart: Date, aEnd: Date, bStart: Date, bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function findRoomConflicts(
  roomId: string,
  start: Date,
  end: Date,
  excludeMeetingId?: string,
): Promise<HardConflict[]> {
  const meetings = await prisma.meeting.findMany({
    where: {
      roomId,
      status: { in: BLOCKING_STATUSES as unknown as string[] },
      AND: [
        { startAt: { lt: end } },
        { endAt: { gt: start } },
        ...(excludeMeetingId ? [{ id: { not: excludeMeetingId } }] : []),
      ],
    },
    include: { room: true },
  });
  return meetings.map((m) => ({
    kind: "ROOM" as const,
    roomId,
    roomName: m.room?.name ?? "",
    meetingId: m.id,
    meetingTitle: m.title,
    startAt: m.startAt,
    endAt: m.endAt,
  }));
}

export async function findUserConflicts(
  userIds: string[],
  start: Date,
  end: Date,
  excludeMeetingId?: string,
): Promise<SoftConflict[]> {
  if (userIds.length === 0) return [];
  const participations = await prisma.meetingParticipant.findMany({
    where: {
      userId: { in: userIds },
      meeting: {
        status: { in: BLOCKING_STATUSES as unknown as string[] },
        startAt: { lt: end },
        endAt: { gt: start },
        ...(excludeMeetingId ? { id: { not: excludeMeetingId } } : {}),
      },
    },
    include: { user: true, meeting: true },
  });
  // also organizer conflicts
  const organized = await prisma.meeting.findMany({
    where: {
      organizerId: { in: userIds },
      status: { in: BLOCKING_STATUSES as unknown as string[] },
      startAt: { lt: end },
      endAt: { gt: start },
      ...(excludeMeetingId ? { id: { not: excludeMeetingId } } : {}),
    },
    include: { organizer: true },
  });

  const byUser = new Map<string, SoftConflict>();
  for (const p of participations) {
    byUser.set(p.userId, {
      kind: "USER",
      userId: p.userId,
      userName: p.user.fullName,
      meetingId: p.meetingId,
      meetingTitle: p.meeting.title,
      startAt: p.meeting.startAt,
      endAt: p.meeting.endAt,
    });
  }
  for (const m of organized) {
    if (!byUser.has(m.organizerId)) {
      byUser.set(m.organizerId, {
        kind: "ORGANIZER",
        userId: m.organizerId,
        userName: m.organizer.fullName,
        meetingId: m.id,
        meetingTitle: m.title,
        startAt: m.startAt,
        endAt: m.endAt,
      });
    }
  }
  return [...byUser.values()];
}

/** Merge intervals and subtract busy from a window → free intervals. */
export function subtractBusy(
  windowStart: Date,
  windowEnd: Date,
  busy: Interval[],
): Interval[] {
  const sorted = [...busy]
    .filter((b) => b.end > windowStart && b.start < windowEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const free: Interval[] = [];
  let cursor = new Date(windowStart);
  for (const b of sorted) {
    if (b.start > cursor) {
      free.push({ start: cursor, end: b.start < windowEnd ? b.start : windowEnd });
    }
    if (b.end > cursor) cursor = b.end;
    if (cursor >= windowEnd) break;
  }
  if (cursor < windowEnd) free.push({ start: cursor, end: windowEnd });
  return free;
}

export function slotFits(slot: Interval, durationMin: number): boolean {
  return slot.end.getTime() - slot.start.getTime() >= durationMin * 60000;
}

/** Cut free intervals into aligned candidate slots of durationMin. */
export function candidateSlots(
  free: Interval[],
  durationMin: number,
  stepMin = 15,
  maxPerInterval = 4,
): Interval[] {
  const slots: Interval[] = [];
  const durMs = durationMin * 60000;
  const stepMs = stepMin * 60000;
  for (const f of free) {
    let t = f.start.getTime();
    let count = 0;
    while (t + durMs <= f.end.getTime() && count < maxPerInterval) {
      slots.push({ start: new Date(t), end: new Date(t + durMs) });
      t += stepMs;
      count += 1;
    }
  }
  return slots;
}

export type MeetingWithRelations = Meeting & {
  room?: { id: string; name: string } | null;
};
