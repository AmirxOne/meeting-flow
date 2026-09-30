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
    // در حال برگزاری: آبی info — نه قرمز که حس منفی/خطر می‌دهد
    return {
      chip: "bg-blue-50 text-blue-700",
      block: "bg-blue-500 text-white",
      rail: "bg-blue-500",
      dot: "bg-blue-500",
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
    // لغو/رد شده: خاکستری با خط‌خوردگی + حاشیه قرمز — با «برگزار شده» اشتباه نشود
    return {
      chip: "bg-paper-deep text-ink-faint line-through",
      block: "bg-paper-deep text-ink-faint line-through",
      rail: "bg-red-300",
      dot: "bg-red-300",
    };
  }
  if (status === "COMPLETED") {
    // برگزار شده: تیک سبز — جلسه‌ی باخت‌ونجات‌یافته
    return {
      chip: "bg-emerald-50 text-emerald-700",
      block: "bg-emerald-100 text-emerald-800",
      rail: "bg-emerald-500",
      dot: "bg-emerald-500",
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
