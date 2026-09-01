import { tzOffsetMinutes } from "./jalali";

export const ICS_PROD_ID = "-//Mehrsa//MeetingHub//FA";
export const ICS_TZID = "Asia/Tehran";

export type IcsEventStatus = "CONFIRMED" | "TENTATIVE" | "CANCELLED";

export interface IcsAttendee {
  name?: string;
  email: string;
}

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: Date;
  endAt: Date;
  createdAt: Date;
  updatedAt: Date;
  status: IcsEventStatus;
  organizer?: IcsAttendee;
  attendees?: IcsAttendee[];
  url?: string;
}

export interface IcsCalendarInput {
  events: IcsEvent[];
  calendarName?: string;
  tz?: string;
  now?: Date;
}

/** RFC 5545 TEXT value escaping. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\n");
}

/** Fold a content line at 75 octets; continuations start with a space. */
export function foldIcsLine(line: string, limit = 75): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let bytes = encoder.encode(line);
  if (bytes.length <= limit) return line;
  const parts: string[] = [];
  let first = true;
  while (bytes.length > 0) {
    const max = first ? limit : limit - 1;
    let cut = Math.min(max, bytes.length);
    while (cut > 0 && cut < bytes.length && (bytes[cut] & 0xc0) === 0x80) {
      cut -= 1;
    }
    if (cut === 0) cut = Math.min(max, bytes.length);
    const chunk = decoder.decode(bytes.slice(0, cut));
    parts.push(first ? chunk : ` ${chunk}`);
    bytes = bytes.slice(cut);
    first = false;
  }
  return parts.join("\r\n");
}

export function formatIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Floating local date-time in `tz` (no Z suffix — pair with TZID). */
export function formatIcsLocal(date: Date, tz = ICS_TZID): string {
  const off = tzOffsetMinutes(tz, date);
  const local = new Date(date.getTime() + off * 60000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}${p(local.getUTCMonth() + 1)}${p(local.getUTCDate())}T${p(local.getUTCHours())}${p(local.getUTCMinutes())}${p(local.getUTCSeconds())}`;
}

export function meetingStatusToIcs(status: string): IcsEventStatus {
  if (status === "CANCELLED" || status === "REJECTED") return "CANCELLED";
  if (status === "PENDING_APPROVAL") return "TENTATIVE";
  return "CONFIRMED";
}

function crlf(lines: string[]): string {
  return `${lines.map((l) => foldIcsLine(l)).join("\r\n")}\r\n`;
}

/** Iran has used a fixed UTC+03:30 offset (no DST) since 2022. */
export function buildVTimezone(tz = ICS_TZID): string {
  return crlf([
    "BEGIN:VTIMEZONE",
    `TZID:${tz}`,
    `X-LIC-LOCATION:${tz}`,
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0330",
    "TZOFFSETTO:+0330",
    "TZNAME:IRST",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
  ]);
}

function cnAttr(person: IcsAttendee): string {
  const cn = person.name ? `;CN=${escapeIcsText(person.name)}` : "";
  return `${cn}:mailto:${person.email}`;
}

export function buildVEvent(event: IcsEvent, tz = ICS_TZID): string {
  const seq = Math.max(
    0,
    Math.floor((event.updatedAt.getTime() - event.createdAt.getTime()) / 1000),
  );
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsUtc(event.updatedAt)}`,
    `DTSTART;TZID=${tz}:${formatIcsLocal(event.startAt, tz)}`,
    `DTEND;TZID=${tz}:${formatIcsLocal(event.endAt, tz)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `STATUS:${event.status}`,
    `SEQUENCE:${seq}`,
    `CREATED:${formatIcsUtc(event.createdAt)}`,
    `LAST-MODIFIED:${formatIcsUtc(event.updatedAt)}`,
    `TRANSP:${event.status === "CANCELLED" ? "TRANSPARENT" : "OPAQUE"}`,
  ];
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }
  if (event.organizer?.email) {
    lines.push(`ORGANIZER${cnAttr(event.organizer)}`);
  }
  for (const a of event.attendees ?? []) {
    if (!a.email) continue;
    lines.push(`ATTENDEE${cnAttr(a)}`);
  }
  lines.push("END:VEVENT");
  return crlf(lines);
}

export function buildIcsCalendar(input: IcsCalendarInput): string {
  const tz = input.tz ?? ICS_TZID;
  const name = input.calendarName ?? "جلسات مهرسا";
  const header = crlf([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${ICS_PROD_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(name)}`,
    `X-WR-TIMEZONE:${tz}`,
  ]);
  const events = input.events.map((e) => buildVEvent(e, tz)).join("");
  return `${header}${buildVTimezone(tz)}${events}END:VCALENDAR\r\n`;
}
