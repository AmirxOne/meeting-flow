import { describe, expect, it } from "vitest";
import {
  buildIcsCalendar,
  buildVEvent,
  escapeIcsText,
  foldIcsLine,
  formatIcsLocal,
  formatIcsUtc,
  meetingStatusToIcs,
} from "@/lib/ics";

const start = new Date("2030-06-01T06:30:00.000Z"); // 10:00 Asia/Tehran
const end = new Date("2030-06-01T07:30:00.000Z");
const created = new Date("2030-05-01T08:00:00.000Z");
const updated = new Date("2030-05-02T08:00:00.000Z");

const baseEvent = {
  uid: "meet-1@mehrsa",
  title: "استندآپ تیم",
  description: "خط اول\nخط دوم; ویرگول, بک‌اسلش \\",
  location: "اتاق الف — نیاوران",
  startAt: start,
  endAt: end,
  createdAt: created,
  updatedAt: updated,
  status: "CONFIRMED" as const,
  organizer: { name: "علی رضایی", email: "ali@example.com" },
  attendees: [{ name: "سارا", email: "sara@example.com" }],
  url: "http://localhost:3100/meetings/meet-1",
};

describe("ICS helpers", () => {
  it("formats UTC instants with a Z suffix", () => {
    expect(formatIcsUtc(start)).toBe("20300601T063000Z");
  });

  it("formats Tehran local time without Z (UTC+03:30)", () => {
    expect(formatIcsLocal(start, "Asia/Tehran")).toBe("20300601T100000");
    expect(formatIcsLocal(end, "Asia/Tehran")).toBe("20300601T110000");
  });

  it("escapes TEXT specials", () => {
    expect(escapeIcsText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
  });

  it("folds lines longer than 75 octets with a leading space", () => {
    const long = `SUMMARY:${"آ".repeat(80)}`;
    const folded = foldIcsLine(long);
    expect(folded).toContain("\r\n ");
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
  });

  it("maps meeting status to ICS STATUS", () => {
    expect(meetingStatusToIcs("CONFIRMED")).toBe("CONFIRMED");
    expect(meetingStatusToIcs("PENDING_APPROVAL")).toBe("TENTATIVE");
    expect(meetingStatusToIcs("CANCELLED")).toBe("CANCELLED");
    expect(meetingStatusToIcs("REJECTED")).toBe("CANCELLED");
  });
});

describe("buildVEvent", () => {
  it("emits VEVENT with TZID Asia/Tehran", () => {
    const vevent = buildVEvent(baseEvent);
    expect(vevent).toContain("BEGIN:VEVENT");
    expect(vevent).toContain("DTSTART;TZID=Asia/Tehran:20300601T100000");
    expect(vevent).toContain("DTEND;TZID=Asia/Tehran:20300601T110000");
    expect(vevent).toContain("SUMMARY:استندآپ تیم");
    expect(vevent).toContain("STATUS:CONFIRMED");
    expect(vevent).toContain("ORGANIZER;CN=علی رضایی:mailto:ali@example.com");
    expect(vevent).toContain("ATTENDEE;CN=سارا:mailto:sara@example.com");
    expect(vevent).toContain("END:VEVENT");
  });

  it("marks cancelled events with STATUS:CANCELLED and TRANSPARENT", () => {
    const vevent = buildVEvent({ ...baseEvent, status: "CANCELLED" });
    expect(vevent).toContain("STATUS:CANCELLED");
    expect(vevent).toContain("TRANSP:TRANSPARENT");
  });
});

describe("buildIcsCalendar", () => {
  it("wraps events in a VCALENDAR with Tehran VTIMEZONE", () => {
    const ics = buildIcsCalendar({
      events: [baseEvent, { ...baseEvent, uid: "meet-2@mehrsa", status: "CANCELLED", title: "لغو شده" }],
      calendarName: "جلسات من",
    });
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("TZID:Asia/Tehran");
    expect(ics).toContain("TZOFFSETTO:+0330");
    expect(ics).toContain("UID:meet-1@mehrsa");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("\r\n");
  });
});
