import { tzOffsetMinutes } from "./jalali";

export * from "./fa";
export * from "./jalali";
export { tzOffsetMinutes } from "./jalali";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ISO date (YYYY-MM-DD) of a Date in a timezone — no library. */
export function isoDateInTz(date: Date, tz = "Asia/Tehran"): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(date);
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

export function startOfDayUtcFromIso(iso: string, tz = "Asia/Tehran"): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Tehran has no DST since 2022; fixed +03:30. Use offset probing anyway.
  const off = tzOffsetMinutes(tz, new Date(guess));
  return new Date(guess - off * 60000);
}

export function endOfDayUtcFromIso(iso: string, tz = "Asia/Tehran"): Date {
  const start = startOfDayUtcFromIso(iso, tz);
  return new Date(start.getTime() + 24 * 3600000 - 1);
}

// Interval overlap: [aStart,aEnd) vs [bStart,bEnd)
export function intervalsOverlap(
  aStart: Date, aEnd: Date, bStart: Date, bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export const MEETING_STATUSES = [
  "DRAFT", "PENDING_APPROVAL", "APPROVED", "CONFIRMED", "REJECTED",
  "CANCELLED", "RESCHEDULED", "IN_PROGRESS", "COMPLETED", "NO_SHOW",
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_TYPES = [
  "INTERNAL", "EXTERNAL", "ONE_ON_ONE", "GROUP", "INTERVIEW", "CLIENT", "QUICK",
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type MeetingPriority = (typeof MEETING_PRIORITIES)[number];

export const RESPONSE_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "TENTATIVE"] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export const EQUIPMENT_LIST = [
  "PROJECTOR", "TV", "WHITEBOARD", "VIDEO_CONFERENCE", "AUDIO_SYSTEM", "MICROPHONE",
] as const;
export type Equipment = (typeof EQUIPMENT_LIST)[number];

export const EQUIPMENT_FA: Record<string, string> = {
  PROJECTOR: "پروژکتور",
  TV: "تلویزیون",
  WHITEBOARD: "وایت‌برد",
  VIDEO_CONFERENCE: "ویدئو کنفرانس",
  AUDIO_SYSTEM: "سیستم صوتی",
  MICROPHONE: "میکروفون",
};

export const STATUS_FA: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  PENDING_APPROVAL: "در انتظار تأیید",
  APPROVED: "تأیید شده",
  CONFIRMED: "قطعی شده",
  REJECTED: "رد شده",
  CANCELLED: "لغو شده",
  RESCHEDULED: "زمان‌بندی مجدد",
  IN_PROGRESS: "در حال برگزاری",
  COMPLETED: "پایان یافته",
  NO_SHOW: "غیبت",
};

export const TYPE_FA: Record<string, string> = {
  INTERNAL: "داخلی",
  EXTERNAL: "خارجی",
  ONE_ON_ONE: "تک‌به‌تک",
  GROUP: "گروهی",
  INTERVIEW: "مصاحبه",
  CLIENT: "مشتری",
  QUICK: "سریع",
};

export const PRIORITY_FA: Record<string, string> = {
  LOW: "کم", NORMAL: "عادی", HIGH: "زیاد", URGENT: "فوری",
};

export const RESPONSE_FA: Record<string, string> = {
  PENDING: "در انتظار پاسخ",
  ACCEPTED: "قبول",
  DECLINED: "رد",
  TENTATIVE: "مرددد",
};

export const CANCEL_REASONS = [
  "CLIENT_CANCELLED", "MANAGER_UNAVAILABLE", "ROOM_UNAVAILABLE",
  "DUPLICATE_MEETING", "PERSONAL_REASON", "OTHER",
] as const;

export const CANCEL_REASON_FA: Record<string, string> = {
  CLIENT_CANCELLED: "مشتری لغو کرد",
  MANAGER_UNAVAILABLE: "مدیر در دسترس نبود",
  ROOM_UNAVAILABLE: "اتاق در دسترس نبود",
  DUPLICATE_MEETING: "جلسه تکراری",
  PERSONAL_REASON: "دلیل شخصی",
  OTHER: "سایر",
};
