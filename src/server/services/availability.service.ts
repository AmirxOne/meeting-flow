import { prisma } from "@/server/db";
import {
  startOfDayUtcInTz,
  addLocalDaysUtc,
} from "@/lib/timezone";
import { isoDateInTz } from "@/lib";
import { getOrgTimezone } from "./org-timezone.service";
import { getHolidayBookingMode, listHolidays } from "./holiday.service";
import {
  BLOCKING_STATUSES,
  subtractBusy,
  candidateSlots,
  type Interval,
} from "./conflict.service";

export interface SlotSuggestion {
  start: Date;
  end: Date;
  availableRooms: {
    id: string;
    name: string;
    capacity: number;
    equipment: string[];
  }[];
  conflicts: {
    userId: string;
    userName: string;
    meetingTitle: string;
  }[];
}

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function parseHHMM(s: string | null | undefined, fallback: number): number {
  if (!s) return fallback;
  const m = s.match(HHMM);
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

export interface FindSlotsInput {
  orgId: string;
  branchId: string;
  participantIds: string[];
  organizerId: string;
  durationMin: number;
  from: Date; // window start (UTC instant)
  to: Date; // window end (UTC instant)
  minCapacity?: number;
  requiredEquipment?: string[];
  excludeMeetingId?: string;
  stepMin?: number;
  maxSlots?: number;
}

/**
 * Free Slot Finder — finds common availability of all participants AND
 * at least one bookable room, across the [from, to] window.
 */
export async function findAvailableSlots(
  input: FindSlotsInput,
): Promise<SlotSuggestion[]> {
  const {
    branchId, organizerId, durationMin, from, to,
    minCapacity = 1, requiredEquipment = [], excludeMeetingId,
    stepMin = 15, maxSlots = 6,
  } = input;

  const peopleIds = [...new Set([organizerId, ...input.participantIds])];
  const tz = await getOrgTimezone(input.orgId);
  const [holidayMode, holidays] = await Promise.all([
    getHolidayBookingMode(input.orgId),
    listHolidays(input.orgId),
  ]);
  const blockedHolidayDays = new Set(
    holidayMode === "BLOCK" ? holidays.map((h) => h.dateIso) : [],
  );

  // 1) rooms in branch with capacity & equipment
  const rooms = await prisma.meetingRoom.findMany({
    where: {
      orgId: input.orgId,
      branchId,
      isActive: true,
      capacity: { gte: Math.max(1, minCapacity) },
      ...(requiredEquipment.length
        ? { equipment: { some: { equipment: { in: requiredEquipment } } } }
        : {}),
    },
    include: { equipment: true },
  });
  if (rooms.length === 0) return [];

  // 2) busy intervals per room
  const roomMeetings = await prisma.meeting.findMany({
    where: {
      roomId: { in: rooms.map((r) => r.id) },
      status: { in: BLOCKING_STATUSES as unknown as string[] },
      startAt: { lt: to },
      endAt: { gt: from },
      ...(excludeMeetingId ? { id: { not: excludeMeetingId } } : {}),
    },
    select: { roomId: true, startAt: true, endAt: true },
  });
  // room exclusions (maintenance)
  const exclusions = await prisma.roomExclusion.findMany({
    where: { roomId: { in: rooms.map((r) => r.id) }, startAt: { lt: to }, endAt: { gt: from } },
    select: { roomId: true, startAt: true, endAt: true },
  });

  const roomBusy = new Map<string, Interval[]>();
  for (const r of rooms) roomBusy.set(r.id, []);
  for (const m of roomMeetings) roomBusy.get(m.roomId!)?.push({ start: m.startAt, end: m.endAt });
  for (const e of exclusions) roomBusy.get(e.roomId)?.push({ start: e.startAt, end: e.endAt });

  // 3) people busy
  const peopleBusy: Interval[] = [];
  const parts = await prisma.meetingParticipant.findMany({
    where: {
      userId: { in: peopleIds },
      meeting: {
        orgId: input.orgId,
        status: { in: BLOCKING_STATUSES as unknown as string[] },
        startAt: { lt: to },
        endAt: { gt: from },
        ...(excludeMeetingId ? { id: { not: excludeMeetingId } } : {}),
      },
    },
    select: { meeting: { select: { startAt: true, endAt: true } } },
  });
  for (const p of parts) peopleBusy.push({ start: p.meeting.startAt, end: p.meeting.endAt });
  const orgs = await prisma.meeting.findMany({
    where: {
      orgId: input.orgId,
      organizerId: { in: peopleIds },
      status: { in: BLOCKING_STATUSES as unknown as string[] },
      startAt: { lt: to },
      endAt: { gt: from },
      ...(excludeMeetingId ? { id: { not: excludeMeetingId } } : {}),
    },
    select: { startAt: true, endAt: true },
  });
  for (const o of orgs) peopleBusy.push({ start: o.startAt, end: o.endAt });

  // 4) walk day-by-day, per room opening hours (org timezone)
  const suggestions: SlotSuggestion[] = [];
  let day = startOfDayUtcInTz(from, tz);
  const lastDay = to;

  while (day < lastDay && suggestions.length < maxSlots) {
    const dayStart = day;
    const dayEnd = addLocalDaysUtc(day, 1, tz);
    if (blockedHolidayDays.has(isoDateInTz(dayStart, tz))) {
      day = dayEnd;
      continue;
    }

    // people free intervals this day
    const peopleFree = subtractBusy(dayStart, dayEnd, peopleBusy);

    for (const room of rooms) {
      const openMin = parseHHMM(room.openTime, 8 * 60);
      const closeMin = parseHHMM(room.closeTime, 20 * 60);
      const openAt = new Date(dayStart.getTime() + openMin * 60000);
      const closeAt = new Date(dayStart.getTime() + closeMin * 60000);

      const busy = roomBusy.get(room.id) ?? [];
      const roomFree = subtractBusy(openAt, closeAt, busy);

      // intersect room free with people free
      for (const pf of peopleFree) {
        for (const rf of roomFree) {
          const s = pf.start > rf.start ? pf.start : rf.start;
          const e = pf.end < rf.end ? pf.end : rf.end;
          if (e <= s) continue;
          const slots = candidateSlots([{ start: s, end: e }], durationMin, stepMin, 2);
          for (const slot of slots) {
            if (suggestions.length >= maxSlots) break;
            // skip slots already suggested (same time)
            if (suggestions.some((x) => x.start.getTime() === slot.start.getTime())) continue;
            suggestions.push({
              start: slot.start,
              end: slot.end,
              availableRooms: [
                {
                  id: room.id,
                  name: room.name,
                  capacity: room.capacity,
                  equipment: room.equipment.map((e2) => e2.equipment),
                },
              ],
              conflicts: [],
            });
          }
          if (suggestions.length >= maxSlots) break;
        }
        if (suggestions.length >= maxSlots) break;
      }
      if (suggestions.length >= maxSlots) break;
    }
    day = addLocalDaysUtc(day, 1, tz);
  }

  // merge rooms per identical slot start
  const merged = new Map<number, SlotSuggestion>();
  for (const s of suggestions) {
    const key = s.start.getTime();
    const existing = merged.get(key);
    if (existing) {
      const ids = new Set(existing.availableRooms.map((r) => r.id));
      for (const r of s.availableRooms) if (!ids.has(r.id)) existing.availableRooms.push(r);
    } else {
      merged.set(key, { ...s, availableRooms: [...s.availableRooms] });
    }
  }

  return [...merged.values()]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, maxSlots);
}

/** Quick meeting: nearest free slot from now for given people, any room in branch. */
export async function findQuickSlot(input: Omit<FindSlotsInput, "from" | "to">) {
  const now = new Date(Date.now() + 5 * 60000); // 5-min buffer
  const to = new Date(now.getTime() + 8 * 24 * 3600000); // 8 days ahead
  const slots = await findAvailableSlots({ ...input, from: now, to });
  return slots[0] ?? null;
}
