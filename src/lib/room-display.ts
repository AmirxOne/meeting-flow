/** Door-tablet occupancy: current / next meeting, always-mask private titles. */

export const DISPLAY_BLOCKING_STATUSES = [
  "PENDING_APPROVAL",
  "APPROVED",
  "CONFIRMED",
  "RESCHEDULED",
  "IN_PROGRESS",
] as const;

export const PRIVATE_DISPLAY_TITLE = "جلسه محرمانه";

export type DisplayOccupancy = "AVAILABLE" | "OCCUPIED" | "DISABLED";

export interface DisplayMeetingInput {
  id: string;
  title: string;
  isPrivate: boolean;
  startAt: Date | string;
  endAt: Date | string;
  status: string;
  organizerName?: string | null;
}

export interface PublicDisplaySlot {
  title: string;
  startAt: string;
  endAt: string;
  isPrivate: boolean;
  isMasked: boolean;
  organizerName: string | null;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function pickCurrentAndNext(meetings: DisplayMeetingInput[], now: Date) {
  const blocking = new Set<string>(DISPLAY_BLOCKING_STATUSES);
  const active = meetings
    .filter((m) => blocking.has(m.status))
    .map((m) => ({
      ...m,
      startAt: asDate(m.startAt),
      endAt: asDate(m.endAt),
    }))
    .filter((m) => !Number.isNaN(m.startAt.getTime()) && m.endAt > m.startAt)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const current = active.find((m) => m.startAt <= now && m.endAt > now) ?? null;
  const next = active.find((m) => m.startAt > now) ?? null;
  const occupancy: DisplayOccupancy = current ? "OCCUPIED" : "AVAILABLE";
  return { current, next, occupancy };
}

export function toPublicDisplaySlot(meeting: DisplayMeetingInput | null): PublicDisplaySlot | null {
  if (!meeting) return null;
  const startAt = asDate(meeting.startAt).toISOString();
  const endAt = asDate(meeting.endAt).toISOString();
  if (meeting.isPrivate) {
    return {
      title: PRIVATE_DISPLAY_TITLE,
      startAt,
      endAt,
      isPrivate: true,
      isMasked: true,
      organizerName: null,
    };
  }
  return {
    title: meeting.title,
    startAt,
    endAt,
    isPrivate: false,
    isMasked: false,
    organizerName: meeting.organizerName ?? null,
  };
}

export function occupancyForRoom(opts: {
  isActive: boolean;
  occupancy: DisplayOccupancy;
}): DisplayOccupancy {
  if (!opts.isActive) return "DISABLED";
  return opts.occupancy;
}

export function roomDisplayPath(roomId: string, token?: string): string {
  const base = `/rooms/${encodeURIComponent(roomId)}/display`;
  return token ? `${base}?t=${encodeURIComponent(token)}` : base;
}

export function normalizeDisplayCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^0-9A-F]/g, "");
}
