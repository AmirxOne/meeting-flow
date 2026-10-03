export type CalendarEventTone = {
  chip: string;
  block: string;
  rail: string;
  dot: string;
};

const DONE = new Set(["CANCELLED", "REJECTED", "NO_SHOW"]);

/**
 * Shared status colors for month chips, week blocks, and the day panel.
 * همه‌ی ویوها (ماه/هفته/روز) از یک خانواده‌ی رنگ برای هر وضعیت استفاده می‌کنند:
 *   chip  = همان رنگ توپر block — ویوی ماه (چیپ کوچک)
 *   block = رنگ توپر -500 با متن سفید — ویوی هفته و روز
 * یک جلسه در همه‌ی ویوها دقیقاً یک رنگ دارد
 *   rail/dot = همان رنگ توپر — پنل روز و نقطه‌های موبایل
 */
export function calendarEventTone(status: string): CalendarEventTone {
  if (status === "IN_PROGRESS") {
    // در حال برگزاری: آبی info — نه قرمز که حس منفی/خطر می‌دهد
    return {
      chip: "bg-blue-500 text-white",
      block: "bg-blue-500 text-white",
      rail: "bg-blue-500",
      dot: "bg-blue-500",
    };
  }
  if (status === "PENDING_APPROVAL") {
    return {
      chip: "bg-amber-500 text-white",
      block: "bg-amber-500 text-white",
      rail: "bg-amber-500",
      dot: "bg-amber-500",
    };
  }
  if (DONE.has(status)) {
    // لغو/رد/غیبت: خاکستری خط‌خورده — با «برگزار شده» اشتباه نشود
    return {
      chip: "bg-ink/25 text-ink-soft line-through",
      block: "bg-ink/25 text-ink-soft line-through",
      rail: "bg-ink/25",
      dot: "bg-ink/30",
    };
  }
  if (status === "COMPLETED") {
    // برگزار شده: تیک سبز
    return {
      chip: "bg-emerald-500 text-white",
      block: "bg-emerald-500 text-white",
      rail: "bg-emerald-500",
      dot: "bg-emerald-500",
    };
  }
  // تأییدشده (عادی): مشکی
  return {
    chip: "bg-ink text-white font-medium",
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

/** Legend entries derived from calendarEventTone — single source of truth. */
export const CALENDAR_LEGEND: { status: string; label: string }[] = [
  { status: "CONFIRMED", label: "تأییدشده (عادی)" },
  { status: "IN_PROGRESS", label: "در حال برگزاری" },
  { status: "PENDING_APPROVAL", label: "در انتظار تأیید" },
  { status: "COMPLETED", label: "برگزار شده" },
  { status: "CANCELLED", label: "لغو / غیبت" },
];
