import { faNum, faStr } from "./fa";
import { jalaliPartsInTz, tzOffsetMinutes } from "./jalali";
import { isoDateInTz, startOfDayUtcFromIso } from "./index";

export const DEFAULT_ORG_TIMEZONE = "Asia/Tehran";

/** HH:mm in org timezone with Persian digits. */
export function formatClockInTz(date: Date, tz: string): string {
  const off = tzOffsetMinutes(tz, date);
  const local = new Date(date.getTime() + off * 60000);
  const h = String(local.getUTCHours()).padStart(2, "0");
  const m = String(local.getUTCMinutes()).padStart(2, "0");
  return faStr(`${h}:${m}`);
}

/** HH:mm:ss in org timezone with Persian digits — door displays. */
export function formatClockWithSecondsInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: tz,
  }).formatToParts(date);
  const num = (type: string) =>
    String(parts.find((p) => p.type === type)?.value ?? "0").padStart(2, "0");
  return faStr(`${num("hour")}:${num("minute")}:${num("second")}`);
}

/** jD/jM in org timezone with Persian digits. */
export function formatJalaliDayMonthInTz(instant: Date, tz: string): string {
  const j = jalaliPartsInTz(instant, tz);
  return `${faNum(j.jd)}/${faNum(j.jm)}`;
}

/** Notification-style datetime: local ISO slice with Persian digits. */
export function formatDateTimeInTz(date: Date, tz: string): string {
  const off = tzOffsetMinutes(tz, date);
  const local = new Date(date.getTime() + off * 60000);
  const iso = local.toISOString().slice(0, 16).replace("T", " ");
  return faStr(iso);
}

/** Minutes since local midnight in timezone. */
export function minutesOfDayInTz(d: Date, tz: string): number {
  const off = tzOffsetMinutes(tz, d);
  const local = new Date(d.getTime() + off * 60000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** UTC instant for local midnight of the given instant in timezone. */
export function startOfDayUtcInTz(instant: Date, tz: string): Date {
  const iso = isoDateInTz(instant, tz);
  return startOfDayUtcFromIso(iso, tz);
}

/** Next local calendar day start in timezone. */
export function addLocalDaysUtc(dayStartUtc: Date, days: number, tz: string): Date {
  return startOfDayUtcInTz(new Date(dayStartUtc.getTime() + days * 86400000), tz);
}
