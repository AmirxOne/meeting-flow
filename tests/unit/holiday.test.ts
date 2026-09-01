import { describe, it, expect } from "vitest";
import {
  calendarDatesSpanned,
  holidayBlocksBooking,
  holidayHitsForRange,
  holidayRequiresApproval,
  parseHolidayBookingMode,
} from "@/lib/holiday";
import { evaluateApprovalNeed, DEFAULT_POLICIES } from "@/server/services/state-machine";

describe("parseHolidayBookingMode", () => {
  it("defaults to BLOCK", () => {
    expect(parseHolidayBookingMode(undefined)).toBe("BLOCK");
    expect(parseHolidayBookingMode("nope")).toBe("BLOCK");
  });

  it("accepts REQUIRE_APPROVAL", () => {
    expect(parseHolidayBookingMode("REQUIRE_APPROVAL")).toBe("REQUIRE_APPROVAL");
    expect(parseHolidayBookingMode("BLOCK")).toBe("BLOCK");
  });
});

describe("calendarDatesSpanned", () => {
  const tz = "Asia/Tehran";

  it("returns one day for an afternoon meeting", () => {
    const start = new Date("2030-03-20T12:30:00.000Z"); // 16:00 Tehran
    const end = new Date("2030-03-20T13:30:00.000Z");
    expect(calendarDatesSpanned(start, end, tz)).toEqual(["2030-03-20"]);
  });

  it("includes both local dates when the slot crosses midnight", () => {
    const start = new Date("2030-03-20T20:00:00.000Z"); // 23:30 Tehran
    const end = new Date("2030-03-20T21:00:00.000Z"); // 00:30 next day
    expect(calendarDatesSpanned(start, end, tz)).toEqual(["2030-03-20", "2030-03-21"]);
  });
});

describe("holiday booking policy", () => {
  const holidays = [
    { dateIso: "2030-03-21", name: "نوروز" },
    { dateIso: "2030-03-22", name: "روز طبیعت" },
  ];

  it("hits a holiday that overlaps the meeting window", () => {
    const start = new Date("2030-03-21T06:30:00.000Z");
    const end = new Date("2030-03-21T07:30:00.000Z");
    const hits = holidayHitsForRange(holidays, start, end, "Asia/Tehran");
    expect(hits.map((h) => h.name)).toEqual(["نوروز"]);
  });

  it("BLOCK forbids booking on a holiday", () => {
    expect(holidayBlocksBooking("BLOCK", 1)).toBe(true);
    expect(holidayBlocksBooking("BLOCK", 0)).toBe(false);
    expect(holidayBlocksBooking("REQUIRE_APPROVAL", 1)).toBe(false);
  });

  it("REQUIRE_APPROVAL does not block but flags approval", () => {
    expect(holidayRequiresApproval("REQUIRE_APPROVAL", 1)).toBe(true);
    expect(holidayRequiresApproval("BLOCK", 1)).toBe(false);
  });
});

describe("evaluateApprovalNeed on org holiday", () => {
  it("internal meeting on holiday needs approval when policy is REQUIRE_APPROVAL", () => {
    expect(
      evaluateApprovalNeed(
        { ...DEFAULT_POLICIES, holidayBooking: "REQUIRE_APPROVAL" },
        {
          hasExternalGuest: false,
          isVipRoom: false,
          durationMin: 30,
          meetingType: "INTERNAL",
          isOrgHoliday: true,
        },
      ),
    ).toBe(true);
  });

  it("internal meeting without holiday still auto-approves", () => {
    expect(
      evaluateApprovalNeed(DEFAULT_POLICIES, {
        hasExternalGuest: false,
        isVipRoom: false,
        durationMin: 30,
        meetingType: "INTERNAL",
        isOrgHoliday: false,
      }),
    ).toBe(false);
  });
});
