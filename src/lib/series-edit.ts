import type { SeriesEditScope } from "./recurrence";

export const SERIES_TERMINAL_STATUSES = [
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
  "REJECTED",
] as const;

/** Bulk THIS/FOLLOWING/ALL never touches in-progress or finished instances. */
export const SERIES_BULK_SKIP_STATUSES = [
  ...SERIES_TERMINAL_STATUSES,
  "IN_PROGRESS",
] as const;

export interface SeriesOccurrenceRef {
  id: string;
  status: string;
  startAt: Date;
  originalStartAt: Date | null;
}

export function occurrencePivotMs(m: {
  originalStartAt: Date | null;
  startAt: Date;
}): number {
  return (m.originalStartAt ?? m.startAt).getTime();
}

export function isBulkEditableStatus(status: string): boolean {
  return !(SERIES_BULK_SKIP_STATUSES as readonly string[]).includes(status);
}

export function filterSeriesTargets<T extends SeriesOccurrenceRef>(
  meetings: T[],
  scope: SeriesEditScope,
  pivot: SeriesOccurrenceRef,
): T[] {
  if (scope === "THIS") {
    return meetings.filter((m) => m.id === pivot.id);
  }
  const pivotMs = occurrencePivotMs(pivot);
  return meetings.filter((m) => {
    if (!isBulkEditableStatus(m.status)) return false;
    if (scope === "ALL") return true;
    return occurrencePivotMs(m) >= pivotMs;
  });
}

export function shiftOccurrence(
  startAt: Date,
  endAt: Date,
  deltaMs: number,
  durationMs: number,
): { startAt: Date; endAt: Date } {
  const start = new Date(startAt.getTime() + deltaMs);
  return { startAt: start, endAt: new Date(start.getTime() + durationMs) };
}

export function slotsOverlapSameRoom(
  slots: { startAt: Date; endAt: Date; roomId: string | null }[],
): boolean {
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      if (!slots[i].roomId || slots[i].roomId !== slots[j].roomId) continue;
      if (slots[i].startAt < slots[j].endAt && slots[j].startAt < slots[i].endAt) {
        return true;
      }
    }
  }
  return false;
}
