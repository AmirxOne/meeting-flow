export type CalendarEventTone = {
  chip: string;
  block: string;
  rail: string;
  dot: string;
};

const DONE = new Set(["CANCELLED", "REJECTED", "NO_SHOW"]);

/** Shared status colors for month chips, week blocks, and the day panel. */
export function calendarEventTone(status: string): CalendarEventTone {
  if (status === "IN_PROGRESS") {
    return {
      chip: "bg-red-100 text-red-700",
      block: "bg-red-500 text-white",
      rail: "bg-red-500",
      dot: "bg-red-500",
    };
  }
  if (status === "PENDING_APPROVAL") {
    return {
      chip: "bg-amber-50 text-amber-800",
      block: "bg-amber-500 text-white",
      rail: "bg-amber-500",
      dot: "bg-amber-500",
    };
  }
  if (DONE.has(status)) {
    return {
      chip: "bg-paper-deep text-ink-faint line-through",
      block: "bg-paper-deep text-ink-faint line-through",
      rail: "bg-ink-faint",
      dot: "bg-ink-faint",
    };
  }
  if (status === "COMPLETED") {
    return {
      chip: "bg-paper-soft text-ink-soft",
      block: "bg-ink/45 text-white",
      rail: "bg-ink-faint",
      dot: "bg-ink-faint",
    };
  }
  return {
    chip: "bg-ink/[0.07] text-ink",
    block: "bg-ink text-white",
    rail: "bg-ink",
    dot: "bg-ink",
  };
}

export function newMeetingHref(dateIso: string, hour?: number): string {
  const q = new URLSearchParams({ from: "calendar", date: dateIso });
  if (hour != null && Number.isFinite(hour)) q.set("hour", String(hour));
  return `/meetings/new?${q.toString()}`;
}
