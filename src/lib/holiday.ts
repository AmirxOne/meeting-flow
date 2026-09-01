import { isoDateInTz } from "./index";
import { addIsoDateDays } from "./meeting-period";

export const HOLIDAY_BOOKING_MODES = ["BLOCK", "REQUIRE_APPROVAL"] as const;
export type HolidayBookingMode = (typeof HOLIDAY_BOOKING_MODES)[number];

export const DEFAULT_HOLIDAY_BOOKING: HolidayBookingMode = "BLOCK";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value);
}

export function parseHolidayBookingMode(value: unknown): HolidayBookingMode {
  if (value === "REQUIRE_APPROVAL" || value === "BLOCK") return value;
  return DEFAULT_HOLIDAY_BOOKING;
}

/** Inclusive org-local calendar dates touched by [start, end). */
export function calendarDatesSpanned(start: Date, end: Date, tz: string): string[] {
  const first = isoDateInTz(start, tz);
  const lastInstant = new Date(Math.max(start.getTime(), end.getTime() - 1));
  const last = isoDateInTz(lastInstant, tz);
  const dates = [first];
  let cur = first;
  while (cur < last) {
    cur = addIsoDateDays(cur, 1);
    dates.push(cur);
  }
  return dates;
}

export function holidayHitsForRange<T extends { dateIso: string }>(
  holidays: T[],
  start: Date,
  end: Date,
  tz: string,
): T[] {
  const days = new Set(calendarDatesSpanned(start, end, tz));
  return holidays.filter((h) => days.has(h.dateIso));
}

export function holidayBlocksBooking(mode: HolidayBookingMode, hitCount: number): boolean {
  return mode === "BLOCK" && hitCount > 0;
}

export function holidayRequiresApproval(mode: HolidayBookingMode, hitCount: number): boolean {
  return mode === "REQUIRE_APPROVAL" && hitCount > 0;
}
