import { describe, expect, it } from "vitest";
import {
  describeRecurrence,
  expandOccurrences,
  MAX_OCCURRENCES,
} from "@/lib/recurrence";
import { iranianWeekdayIndex, zonedTimeToUtc } from "@/lib/jalali";

const TZ = "Asia/Tehran";

describe("expandOccurrences", () => {
  it("expands daily interval 1 for a count", () => {
    const start = zonedTimeToUtc(2030, 6, 1, 10, 0, 0, TZ);
    const occ = expandOccurrences(start, { freq: "DAILY", interval: 1, count: 3 }, TZ);
    expect(occ).toHaveLength(3);
    expect(occ[0].getTime()).toBe(start.getTime());
    expect(occ[1].getTime() - occ[0].getTime()).toBe(86400000);
    expect(occ[2].getTime() - occ[0].getTime()).toBe(2 * 86400000);
  });

  it("respects daily interval 2", () => {
    const start = zonedTimeToUtc(2030, 6, 1, 10, 0, 0, TZ);
    const occ = expandOccurrences(start, { freq: "DAILY", interval: 2, count: 3 }, TZ);
    expect(occ).toHaveLength(3);
    expect(occ[1].getTime() - occ[0].getTime()).toBe(2 * 86400000);
  });

  it("expands weekly on selected Iranian weekdays (Sat–Wed)", () => {
    const start = zonedTimeToUtc(2030, 6, 1, 10, 0, 0, TZ); // 2030-06-01
    const startIso = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(start);
    const startWd = iranianWeekdayIndex(startIso);
    const byWeekday = [0, 1, 2, 3, 4]; // Sat–Wed
    const occ = expandOccurrences(
      start,
      { freq: "WEEKLY", interval: 1, byWeekday, count: 5 },
      TZ,
    );
    expect(occ).toHaveLength(5);
    expect(occ[0].getTime()).toBe(start.getTime());
    for (const d of occ) {
      const iso = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      }).format(d);
      const wd = iranianWeekdayIndex(iso);
      expect(byWeekday).toContain(wd);
      expect(wd).toBeGreaterThanOrEqual(startWd === 0 ? 0 : 0);
    }
  });

  it("skips weekdays before dtstart in the first week", () => {
    let start = zonedTimeToUtc(2030, 6, 1, 10, 0, 0, TZ);
    for (let d = 1; d <= 10; d += 1) {
      start = zonedTimeToUtc(2030, 6, d, 10, 0, 0, TZ);
      const iso = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      }).format(start);
      if (iranianWeekdayIndex(iso) === 4) break; // Wednesday
    }
    const occ = expandOccurrences(
      start,
      { freq: "WEEKLY", interval: 1, byWeekday: [0, 4], count: 4 },
      TZ,
    );
    expect(occ).toHaveLength(4);
    expect(occ[0].getTime()).toBe(start.getTime());
    expect(occ[1].getTime()).toBeGreaterThan(start.getTime() + 2 * 86400000);
  });

  it("applies weekly interval 2 (every other week)", () => {
    const start = zonedTimeToUtc(2030, 6, 1, 10, 0, 0, TZ);
    const occ = expandOccurrences(
      start,
      { freq: "WEEKLY", interval: 2, count: 3 },
      TZ,
    );
    expect(occ).toHaveLength(3);
    expect(occ[1].getTime() - occ[0].getTime()).toBe(14 * 86400000);
  });

  it("repeats monthly on the Jalali day-of-month", () => {
    const start = zonedTimeToUtc(2030, 3, 21, 10, 0, 0, TZ); // around Farvardin 1
    const occ = expandOccurrences(start, { freq: "MONTHLY", interval: 1, count: 3 }, TZ);
    expect(occ).toHaveLength(3);
    expect(occ[0].getTime()).toBe(start.getTime());
    expect(occ[1].getTime()).toBeGreaterThan(occ[0].getTime() + 27 * 86400000);
    expect(occ[1].getTime()).toBeLessThan(occ[0].getTime() + 32 * 86400000);
  });

  it("stops at until even if count would be larger", () => {
    const start = zonedTimeToUtc(2030, 6, 1, 10, 0, 0, TZ);
    const until = new Date(start.getTime() + 2 * 86400000);
    const occ = expandOccurrences(start, { freq: "DAILY", interval: 1, count: 10, until }, TZ);
    expect(occ).toHaveLength(3); // day 0, 1, 2
  });

  it("caps at MAX_OCCURRENCES", () => {
    const start = zonedTimeToUtc(2030, 6, 1, 10, 0, 0, TZ);
    const occ = expandOccurrences(start, { freq: "DAILY", interval: 1, count: 999 }, TZ);
    expect(occ).toHaveLength(MAX_OCCURRENCES);
  });

  it("defaults weekly weekday to dtstart when byWeekday omitted", () => {
    const start = zonedTimeToUtc(2030, 6, 2, 10, 0, 0, TZ);
    const occ = expandOccurrences(start, { freq: "WEEKLY", interval: 1, count: 3 }, TZ);
    expect(occ).toHaveLength(3);
    expect(occ[1].getTime() - occ[0].getTime()).toBe(7 * 86400000);
  });
});

describe("describeRecurrence", () => {
  it("describes weekly Sat–Wed in Persian", () => {
    expect(describeRecurrence({ freq: "WEEKLY", interval: 1, byWeekday: [0, 1, 2, 3, 4] })).toContain("شنبه");
    expect(describeRecurrence({ freq: "WEEKLY", interval: 1, byWeekday: [0, 1, 2, 3, 4] })).toContain("چهارشنبه");
  });
});
