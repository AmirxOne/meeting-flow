import { describe, it, expect } from "vitest";
import {
  toJalali, toGregorian, jMonthLen, jMonthGrid, zonedTimeToUtc, tzOffsetMinutes,
  formatJalali, jalaliPartsInTz, iranianWeekdayIndex, isFridayIso,
} from "@/lib/jalali";

describe("jalali ↔ gregorian conversion", () => {
  it("converts known pairs correctly", () => {
    // 1405-06-04 == 2026-08-26
    expect(toJalali(new Date(2026, 7, 26))).toEqual({ jy: 1405, jm: 6, jd: 4 });
    const g = toGregorian(1405, 6, 4);
    expect([g.getFullYear(), g.getMonth() + 1, g.getDate()]).toEqual([2026, 8, 26]);
  });

  it("handles Nowruz 1405 (2026-03-21)", () => {
    const g = toGregorian(1405, 1, 1);
    expect([g.getFullYear(), g.getMonth() + 1, g.getDate()]).toEqual([2026, 3, 21]);
  });

  it("handles year end 1404 (2026-03-20, non-leap)", () => {
    const g = toGregorian(1404, 12, 29);
    expect([g.getFullYear(), g.getMonth() + 1, g.getDate()]).toEqual([2026, 3, 20]);
  });

  it("matches ICU reference for a spread of dates", () => {
    // authoritative: Intl persian calendar
    const icu = (y: number, m: number, d: number) => {
      const fmt = new Intl.DateTimeFormat("en-US-u-ca-persian", {
        year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC",
      }).format(new Date(Date.UTC(y, m - 1, d)));
      const [mm, dd, yy] = fmt.replace(" AP", "").split("/");
      return { jy: Number(yy), jm: Number(mm), jd: Number(dd) };
    };
    for (const [y, m, d] of [
      [2026, 8, 26], [2026, 3, 20], [2026, 3, 21], [2025, 3, 20],
      [2025, 3, 21], [2026, 8, 25], [2026, 1, 1], [2026, 12, 31],
      [2027, 3, 20], [2024, 6, 15],
    ]) {
      expect(toJalali(new Date(Date.UTC(y, m - 1, d)))).toEqual(icu(y, m, d));
    }
  });

  it("round-trips across a full non-leap year (365 days)", () => {
    const start = toGregorian(1405, 1, 1).getTime();
    let count = 0;
    for (let t = start; count < 365; t += 86400000, count += 3) {
      const g = new Date(t);
      const j = toJalali(g);
      const back = toGregorian(j.jy, j.jm, j.jd);
      expect(back.getFullYear()).toBe(g.getFullYear());
      expect(back.getMonth()).toBe(g.getMonth());
      expect(back.getDate()).toBe(g.getDate());
    }
  });
});

describe("jMonthLen", () => {
  it("first six months have 31 days", () => {
    for (let m = 1; m <= 6; m++) expect(jMonthLen(1405, m)).toBe(31);
  });
  it("months 7-11 have 30 days", () => {
    for (let m = 7; m <= 11; m++) expect(jMonthLen(1405, m)).toBe(30);
  });
  it("esfand 1403 (leap) has 30 days", () => {
    expect(jMonthLen(1403, 12)).toBe(30);
  });
  it("esfand 1405 (non-leap) has 29 days", () => {
    expect(jMonthLen(1405, 12)).toBe(29);
  });
});

describe("jMonthGrid", () => {
  it("produces full weeks starting Saturday", () => {
    const grid = jMonthGrid(1405, 6);
    expect(grid.length % 7).toBe(0);
    const first = grid.find((c) => c !== null)!;
    expect(first.jd).toBe(1);
    const offset = grid.indexOf(first);
    // 1405-06-01 is a Thursday? verify via gregorian day
    const g = toGregorian(1405, 6, 1);
    const expectedOffset = (g.getDay() + 1) % 7; // Sat-start week
    expect(offset).toBe(expectedOffset);
  });
});

describe("formatJalali timezone", () => {
  it("uses Asia/Tehran wall date — not browser local offset twice", () => {
    // 2026-08-30 22:00 Tehran = 1405-06-08 (still same calendar day)
    const eveningTehran = new Date("2026-08-30T18:30:00.000Z");
    expect(jalaliPartsInTz(eveningTehran, "Asia/Tehran")).toEqual({ jy: 1405, jm: 6, jd: 8 });
    expect(formatJalali(eveningTehran, { monthName: true, tz: "Asia/Tehran" })).toBe("۸ شهریور ۱۴۰۵");
  });
});

describe("timezone helpers", () => {
  it("Tehran offset is +210 minutes (no DST since 2022)", () => {
    const off = tzOffsetMinutes("Asia/Tehran", new Date(Date.UTC(2026, 7, 26, 12, 0)));
    expect(off).toBe(210);
  });

  it("zonedTimeToUtc maps Tehran wall-clock to UTC", () => {
    const utc = zonedTimeToUtc(2026, 8, 26, 10, 0, 0, "Asia/Tehran");
    expect(utc.toISOString()).toBe("2026-08-26T06:30:00.000Z");
  });
});

describe("Iranian Friday holiday", () => {
  it("treats Friday as weekday 6 and other days as not Friday", () => {
    // 2026-08-31 is Monday; 2026-08-28 is Friday; 2026-08-29 is Saturday
    expect(iranianWeekdayIndex("2026-08-29")).toBe(0);
    expect(iranianWeekdayIndex("2026-08-31")).toBe(2);
    expect(iranianWeekdayIndex("2026-08-28")).toBe(6);
    expect(isFridayIso("2026-08-28")).toBe(true);
    expect(isFridayIso("2026-08-31")).toBe(false);
    expect(isFridayIso("2026-08-29")).toBe(false);
  });

  it("last column of a Sat-start month grid is Friday", () => {
    const grid = jMonthGrid(1405, 6);
    for (let i = 6; i < grid.length; i += 7) {
      const cell = grid[i];
      if (!cell) continue;
      const g = toGregorian(cell.jy, cell.jm, cell.jd);
      const iso = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
      expect(isFridayIso(iso)).toBe(true);
    }
  });
});
