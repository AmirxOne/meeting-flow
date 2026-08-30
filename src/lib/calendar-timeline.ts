/** Day-view timeline layout — minutes from midnight, no Date math. */

export const TIMELINE_PX_PER_HOUR = 72;
export const TIMELINE_DEFAULT_START = 8;
export const TIMELINE_DEFAULT_END = 20;
export const TIMELINE_MIN_BLOCK_PX = 28;

export type TimelineInterval = {
  id: string;
  startMin: number;
  endMin: number;
};

export type TimelineBlock = {
  id: string;
  top: number;
  height: number;
  col: number;
  cols: number;
};

function clampDayMinutes(min: number): number {
  return Math.max(0, Math.min(24 * 60, min));
}

/** Inclusive visual range; expands only to cover meetings, not the clock. */
export function dayHourRange(
  items: Pick<TimelineInterval, "startMin" | "endMin">[],
): { startHour: number; endHour: number } {
  let start = TIMELINE_DEFAULT_START * 60;
  let end = TIMELINE_DEFAULT_END * 60;
  for (const item of items) {
    start = Math.min(start, item.startMin);
    end = Math.max(end, item.endMin);
  }
  const startHour = Math.max(0, Math.floor(start / 60));
  const endHour = Math.min(24, Math.max(startHour + 1, Math.ceil(end / 60)));
  return { startHour, endHour };
}

export function assignTimelineColumns(
  items: TimelineInterval[],
): Map<string, { col: number; cols: number }> {
  const result = new Map<string, { col: number; cols: number }>();
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  let cluster: TimelineInterval[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    const cols = new Map<string, number>();
    for (const item of cluster) {
      let col = colEnds.findIndex((end) => end <= item.startMin);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(item.endMin);
      } else {
        colEnds[col] = item.endMin;
      }
      cols.set(item.id, col);
    }
    const total = Math.max(1, colEnds.length);
    for (const item of cluster) {
      result.set(item.id, { col: cols.get(item.id) ?? 0, cols: total });
    }
    cluster = [];
  };

  for (const item of sorted) {
    if (cluster.length && item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return result;
}

export function layoutDayBlocks(
  items: TimelineInterval[],
  startHour: number,
  pxPerHour = TIMELINE_PX_PER_HOUR,
): TimelineBlock[] {
  const cols = assignTimelineColumns(items);
  const origin = startHour * 60;
  return items.map((item) => {
    const start = clampDayMinutes(item.startMin);
    const rawEnd = item.endMin <= item.startMin ? item.startMin + 15 : item.endMin;
    const end = clampDayMinutes(rawEnd);
    const top = ((start - origin) / 60) * pxPerHour;
    const height = Math.max(TIMELINE_MIN_BLOCK_PX, ((end - start) / 60) * pxPerHour - 3);
    const place = cols.get(item.id) ?? { col: 0, cols: 1 };
    return { id: item.id, top, height, col: place.col, cols: place.cols };
  });
}

/** Pixel offset of "now" from the top of the hour grid, or null if outside. */
export function nowLineTop(
  nowMin: number,
  startHour: number,
  endHour: number,
  pxPerHour = TIMELINE_PX_PER_HOUR,
): number | null {
  if (nowMin < startHour * 60 || nowMin > endHour * 60) return null;
  return ((nowMin - startHour * 60) / 60) * pxPerHour;
}

export function minutesOfDayFromTehranParts(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

export const HOUR_PREVIEW = 4;

export function groupByStartHour(items: TimelineInterval[]): { hour: number; ids: string[] }[] {
  const map = new Map<number, string[]>();
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  for (const item of sorted) {
    const hour = Math.floor(clampDayMinutes(item.startMin) / 60);
    const list = map.get(hour) ?? [];
    list.push(item.id);
    map.set(hour, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, ids]) => ({ hour, ids }));
}

export function hourDensity(
  items: TimelineInterval[],
  startHour = TIMELINE_DEFAULT_START,
  endHour = TIMELINE_DEFAULT_END,
): { hour: number; count: number }[] {
  const slots = Array.from({ length: Math.max(0, endHour - startHour) }, (_, i) => ({
    hour: startHour + i,
    count: 0,
  }));
  for (const item of items) {
    const hour = Math.floor(clampDayMinutes(item.startMin) / 60);
    const slot = slots.find((s) => s.hour === hour);
    if (slot) slot.count += 1;
  }
  return slots;
}

export function busiestHour(
  groups: { hour: number; ids: string[] }[],
): { hour: number; count: number } | null {
  if (!groups.length) return null;
  return groups.reduce<{ hour: number; count: number } | null>((best, g) => {
    const count = g.ids.length;
    if (!best || count > best.count) return { hour: g.hour, count };
    return best;
  }, null);
}

export function dayPeriod(hour: number): "dawn" | "morning" | "afternoon" | "evening" {
  if (hour < 6) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export const DAY_PERIOD_FA: Record<ReturnType<typeof dayPeriod>, string> = {
  dawn: "بامداد",
  morning: "صبح",
  afternoon: "بعدازظهر",
  evening: "عصر",
};
