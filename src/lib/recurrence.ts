import {
  iranianWeekdayIndex,
  jalaliPartsInTz,
  jalaliToUtc,
  jMonthLen,
  zonedTimeToUtc,
  type JDate,
} from "./jalali";
import { minutesOfDayInTz } from "./timezone";

export const RECURRENCE_FREQS = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number];

export const RECURRENCE_FREQ_FA: Record<RecurrenceFreq, string> = {
  DAILY: "روزانه",
  WEEKLY: "هفتگی",
  MONTHLY: "ماهانه",
};

export const SERIES_SCOPES = ["THIS", "FOLLOWING", "ALL"] as const;
export type SeriesEditScope = (typeof SERIES_SCOPES)[number];

export const SERIES_SCOPE_FA: Record<SeriesEditScope, string> = {
  THIS: "فقط این جلسه",
  FOLLOWING: "این و جلسه‌های بعدی",
  ALL: "همهٔ جلسه‌های این سری",
};

/** Cap generated instances so a booking cannot lock a room for years. */
export const MAX_OCCURRENCES = 52;

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number;
  /** Iranian weekdays: Saturday=0 … Friday=6. Required for WEEKLY. */
  byWeekday?: number[];
  until?: Date;
  count?: number;
}

function clampInterval(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(12, Math.floor(n));
}

function isoDateInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function instantOnIso(iso: string, minutesOfDay: number, tz: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const h = Math.floor(minutesOfDay / 60);
  const min = minutesOfDay % 60;
  return zonedTimeToUtc(y, m, d, h, min, 0, tz);
}

function addJalaliMonths(j: JDate, months: number): JDate {
  const idx = j.jy * 12 + (j.jm - 1) + months;
  const jy = Math.floor(idx / 12);
  const jm = (idx % 12) + 1;
  return { jy, jm, jd: Math.min(j.jd, jMonthLen(jy, jm)) };
}

function defaultUntil(dtstart: Date, freq: RecurrenceFreq): Date {
  const ms =
    freq === "MONTHLY" ? 180 * 86400000 : freq === "WEEKLY" ? 56 * 86400000 : 14 * 86400000;
  return new Date(dtstart.getTime() + ms);
}

/**
 * Expand a recurrence rule into occurrence start instants (inclusive of dtstart).
 * Calendar days are those of `tz` (Asia/Tehran). Weekly days use the Iranian week
 * (Saturday first). Monthly repeats the Jalali day-of-month, clamped to month length.
 */
export function expandOccurrences(
  dtstart: Date,
  rule: RecurrenceRule,
  tz = "Asia/Tehran",
): Date[] {
  const interval = clampInterval(rule.interval);
  const max = Math.min(rule.count ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const until = rule.until ?? (rule.count ? undefined : defaultUntil(dtstart, rule.freq));
  const mins = minutesOfDayInTz(dtstart, tz);
  const starts: Date[] = [];

  const pushIf = (start: Date) => {
    if (start.getTime() + 1000 < dtstart.getTime()) return;
    if (until && start.getTime() > until.getTime()) return;
    if (starts.length >= max) return;
    starts.push(start);
  };

  if (rule.freq === "DAILY") {
    const startIso = isoDateInTz(dtstart, tz);
    for (let i = 0; starts.length < max; i += 1) {
      const iso = addDaysIso(startIso, i * interval);
      const start = instantOnIso(iso, mins, tz);
      if (until && start.getTime() > until.getTime()) break;
      pushIf(start);
      if (i > MAX_OCCURRENCES * interval + 2) break;
    }
    return starts;
  }

  if (rule.freq === "MONTHLY") {
    const origin = jalaliPartsInTz(dtstart, tz);
    for (let i = 0; starts.length < max; i += 1) {
      const j = addJalaliMonths(origin, i * interval);
      const start = jalaliToUtc(j.jy, j.jm, j.jd, Math.floor(mins / 60), mins % 60, tz);
      if (until && start.getTime() > until.getTime()) break;
      pushIf(start);
      if (i > MAX_OCCURRENCES + 2) break;
    }
    return starts;
  }

  // WEEKLY
  const wanted = new Set(
    (rule.byWeekday?.length ? rule.byWeekday : [iranianWeekdayIndex(isoDateInTz(dtstart, tz))])
      .map((d) => ((d % 7) + 7) % 7),
  );
  const startIso = isoDateInTz(dtstart, tz);
  const startWd = iranianWeekdayIndex(startIso);
  const weekOriginIso = addDaysIso(startIso, -startWd);
  const weekOriginMs = Date.parse(`${weekOriginIso}T12:00:00Z`);

  for (let day = 0; starts.length < max; day += 1) {
    const iso = addDaysIso(startIso, day);
    const start = instantOnIso(iso, mins, tz);
    if (until && start.getTime() > until.getTime() && day > 0) break;
    if (day > MAX_OCCURRENCES * 7 * interval + 14) break;
    const wd = iranianWeekdayIndex(iso);
    if (!wanted.has(wd)) continue;
    const weekIndex = Math.round((Date.parse(`${iso}T12:00:00Z`) - weekOriginMs) / 86400000 / 7);
    if (weekIndex % interval !== 0) continue;
    pushIf(start);
  }
  return starts;
}

export function describeRecurrence(rule: RecurrenceRule): string {
  const n = clampInterval(rule.interval);
  if (rule.freq === "DAILY") {
    return n === 1 ? "هر روز" : `هر ${n} روز`;
  }
  if (rule.freq === "MONTHLY") {
    return n === 1 ? "هر ماه" : `هر ${n} ماه`;
  }
  const days = [...new Set(rule.byWeekday ?? [])]
    .sort((a, b) => a - b)
    .map((d) => ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"][d])
    .filter(Boolean);
  const dayPart = days.length ? days.join("، ") : "همان روز هفته";
  return n === 1 ? `هر هفته · ${dayPart}` : `هر ${n} هفته · ${dayPart}`;
}
