import { endOfDayUtcFromIso, isoDateInTz, startOfDayUtcFromIso } from "@/lib/index";
import { iranianWeekdayIndex } from "@/lib/jalali";

export type MeetingPeriod = "today" | "week";

/** Shift a calendar ISO date (YYYY-MM-DD) by whole days. */
export function addIsoDateDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Iranian week (Saturday–Friday) containing `iso`. */
export function iranianWeekBoundsIso(iso: string): { start: string; end: string } {
  const wd = iranianWeekdayIndex(iso);
  return { start: addIsoDateDays(iso, -wd), end: addIsoDateDays(iso, 6 - wd) };
}

/** UTC instants for «امروز» or «این هفته» in the org timezone. */
export function meetingPeriodRange(
  period: MeetingPeriod,
  now = new Date(),
  tz = "Asia/Tehran",
): { from: string; to: string } {
  const todayIso = isoDateInTz(now, tz);
  if (period === "today") {
    return {
      from: startOfDayUtcFromIso(todayIso, tz).toISOString(),
      to: endOfDayUtcFromIso(todayIso, tz).toISOString(),
    };
  }
  const { start, end } = iranianWeekBoundsIso(todayIso);
  return {
    from: startOfDayUtcFromIso(start, tz).toISOString(),
    to: endOfDayUtcFromIso(end, tz).toISOString(),
  };
}

const RSVP_CLOSED = new Set([
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
  "NO_SHOW",
  "WAITLISTED",
  "WAITLIST_OFFERED",
]);

/** Invitee (non-null myResponseStatus) may RSVP while the meeting is still open. */
export function canShowMeetingRsvp(
  myResponseStatus: string | null | undefined,
  meetingStatus: string,
): boolean {
  return !!myResponseStatus && !RSVP_CLOSED.has(meetingStatus);
}
