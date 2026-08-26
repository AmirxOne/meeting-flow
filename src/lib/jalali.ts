// Jalali (Solar Hijri) calendar utilities built on Node's ICU Persian calendar.
// ICU implements the official astronomical Iranian calendar — the same source
// of truth as Intl/ecma references. Conversions are exact for all supported
// ICU dates (1900-2100+). A small per-year memo avoids repeated Intl calls.

export interface JDate {
  jy: number;
  jm: number;
  jd: number;
}

const PERSIAN_FMT = "en-US-u-ca-persian";

function icuJalali(date: Date): JDate {
  const parts = new Intl.DateTimeFormat(PERSIAN_FMT, {
    year: "numeric", month: "numeric", day: "numeric",
    timeZone: "UTC",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { jy: get("year"), jm: get("month"), jd: get("day") };
}

function icuGregorian(jy: number, jm: number, jd: number): Date {
  // binary-search the UTC instant whose Persian date equals the target.
  // Jalali year jy spans Nowruz (jy+621)-03-20/21 … Esfand end (jy+622)-03-19/20,
  // so the search window must cover BOTH gregorian years.
  let lo = Date.UTC(jy + 620, 2, 15);
  let hi = Date.UTC(jy + 623, 2, 15);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const j = icuJalali(new Date(mid));
    const cmp = j.jy * 10000 + j.jm * 100 + j.jd;
    const target = jy * 10000 + jm * 100 + jd;
    if (cmp < target) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo);
}

// ── public API ─────────────────────────────────────────────

export function toJalali(date: Date): JDate {
  // use LOCAL date parts (not UTC) — callers pass local-time Dates
  const local = new Date(
    date.getFullYear(), date.getMonth(), date.getDate(),
    12, 0, 0,
  );
  return icuJalali(new Date(Date.UTC(
    local.getFullYear(), local.getMonth(), local.getDate(), 12, 0, 0,
  )));
}

export function toGregorian(jy: number, jm: number, jd: number): Date {
  const utc = icuGregorian(jy, jm, jd);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

export function isJalaliLeap(jy: number): boolean {
  return jMonthLen(jy, 12) === 30;
}

const monthLenCache = new Map<number, number>();

export function jMonthLen(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const cached = monthLenCache.get(jy);
  if (cached !== undefined) return cached;
  // Esfand 30 of jy (if leap) falls on (jy+622)-03-20 or -03-21 in the
  // gregorian calendar; probe both.
  const gy = jy + 622;
  for (const day of [20, 21]) {
    const j = icuJalali(new Date(Date.UTC(gy, 2, day)));
    if (j.jy === jy && j.jm === 12 && j.jd === 30) {
      monthLenCache.set(jy, 30);
      return 30;
    }
  }
  const len = 29;
  monthLenCache.set(jy, len);
  return len;
}

export function jalaliToday(tz = "Asia/Tehran"): JDate {
  return toJalali(nowInTz(tz));
}

export function jMonthGrid(jy: number, jm: number): (JDate | null)[] {
  const len = jMonthLen(jy, jm);
  const first = toGregorian(jy, jm, 1);
  const offset = (first.getDay() + 1) % 7; // week starts Saturday
  const cells: (JDate | null)[] = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= len; d += 1) cells.push({ jy, jm, jd: d });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const J_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export const J_WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

// ── time zone helpers ─────────────────────────────────────────

export function nowInTz(tz = "Asia/Tehran"): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
}

export function tzOffsetMinutes(tz: string, date = new Date()): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, number>>(
    (acc, p) => {
      if (p.type !== "literal") acc[p.type] = Number(p.value);
      return acc;
    },
    {} as Record<string, number>,
  );
  const asUTC = Date.UTC(
    parts.year, parts.month - 1, parts.day,
    parts.hour % 24, parts.minute, parts.second,
  );
  return (asUTC - date.getTime()) / 60000;
}

export function zonedTimeToUtc(
  y: number, m: number, d: number,
  h = 0, min = 0, s = 0, tz = "Asia/Tehran",
): Date {
  const guess = Date.UTC(y, m - 1, d, h, min, s);
  const off1 = tzOffsetMinutes(tz, new Date(guess));
  const off2 = tzOffsetMinutes(tz, new Date(guess - off1 * 60000));
  const off = (off1 + off2) / 2;
  return new Date(guess - off * 60000);
}

export function jalaliToUtc(
  jy: number, jm: number, jd: number,
  h = 0, min = 0, tz = "Asia/Tehran",
): Date {
  const g = toGregorian(jy, jm, jd);
  return zonedTimeToUtc(g.getFullYear(), g.getMonth() + 1, g.getDate(), h, min, 0, tz);
}

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
function toFaDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function formatJalali(
  date: Date,
  opts: { withTime?: boolean; monthName?: boolean; tz?: string } = {},
): string {
  const tz = opts.tz ?? "Asia/Tehran";
  const local = new Date(date.getTime() + tzOffsetMinutes(tz, date) * 60000);
  const { jy, jm, jd } = toJalali(local);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  const datePart = opts.monthName
    ? `${jd} ${J_MONTHS[jm - 1]} ${jy}`
    : `${jy}/${pad(jm)}/${pad(jd)}`;
  if (!opts.withTime) return toFaDigits(datePart);
  return toFaDigits(`${datePart} — ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`);
}
