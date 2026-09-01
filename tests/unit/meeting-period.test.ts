import { describe, expect, it } from "vitest";
import {
  addIsoDateDays,
  iranianWeekBoundsIso,
  meetingPeriodRange,
} from "@/lib/meeting-period";

describe("addIsoDateDays", () => {
  it("shifts calendar dates across month bounds", () => {
    expect(addIsoDateDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addIsoDateDays("2026-08-31", -2)).toBe("2026-08-29");
  });
});

describe("iranianWeekBoundsIso", () => {
  it("starts Saturday and ends Friday", () => {
    // Monday 2026-08-31 → Sat 29 … Fri Sep 4
    expect(iranianWeekBoundsIso("2026-08-31")).toEqual({
      start: "2026-08-29",
      end: "2026-09-04",
    });
  });

  it("keeps Saturday as the start of its own week", () => {
    expect(iranianWeekBoundsIso("2026-08-29")).toEqual({
      start: "2026-08-29",
      end: "2026-09-04",
    });
  });
});

describe("meetingPeriodRange", () => {
  const tz = "Asia/Tehran";
  // 2026-08-31 12:00 Tehran = 08:30 UTC
  const noonTehran = new Date("2026-08-31T08:30:00.000Z");

  it("today is local midnight … end of day", () => {
    const r = meetingPeriodRange("today", noonTehran, tz);
    expect(r.from).toBe("2026-08-30T20:30:00.000Z");
    expect(r.to).toBe("2026-08-31T20:29:59.999Z");
  });

  it("week is Saturday 00:00 … Friday 23:59:59.999 local", () => {
    const r = meetingPeriodRange("week", noonTehran, tz);
    expect(r.from).toBe("2026-08-28T20:30:00.000Z");
    expect(r.to).toBe("2026-09-04T20:29:59.999Z");
  });
});
