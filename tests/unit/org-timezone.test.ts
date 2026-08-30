import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  formatClockInTz,
  formatDateTimeInTz,
  formatJalaliDayMonthInTz,
  minutesOfDayInTz,
  startOfDayUtcInTz,
} from "@/lib/timezone";
import {
  clearOrgTimezoneCache,
  DEFAULT_ORG_TIMEZONE,
  getOrgTimezone,
} from "@/server/services/org-timezone.service";

vi.mock("@/server/db", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/server/db";

const findFirst = vi.mocked(prisma.organization.findFirst);

describe("org timezone lib helpers", () => {
  // 2026-08-26 06:30 UTC = 10:00 Tehran / 06:30 UTC wall clock
  const instant = new Date("2026-08-26T06:30:00.000Z");

  it("formatClockInTz uses Asia/Tehran (+03:30)", () => {
    expect(formatClockInTz(instant, "Asia/Tehran")).toBe("۱۰:۰۰");
  });

  it("formatClockInTz uses UTC", () => {
    expect(formatClockInTz(instant, "UTC")).toBe("۰۶:۳۰");
  });

  it("formatDateTimeInTz respects timezone", () => {
    expect(formatDateTimeInTz(instant, "Asia/Tehran")).toBe("۲۰۲۶-۰۸-۲۶ ۱۰:۰۰");
    expect(formatDateTimeInTz(instant, "UTC")).toBe("۲۰۲۶-۰۸-۲۶ ۰۶:۳۰");
  });

  it("formatJalaliDayMonthInTz uses org calendar day", () => {
    expect(formatJalaliDayMonthInTz(instant, "Asia/Tehran")).toBe("۴/۶");
    expect(formatJalaliDayMonthInTz(instant, "UTC")).toBe("۴/۶");
  });

  it("minutesOfDayInTz returns local minutes since midnight", () => {
    expect(minutesOfDayInTz(instant, "Asia/Tehran")).toBe(10 * 60);
    expect(minutesOfDayInTz(instant, "UTC")).toBe(6 * 60 + 30);
  });

  it("startOfDayUtcInTz maps local midnight to UTC", () => {
    const tehranMidnight = startOfDayUtcInTz(instant, "Asia/Tehran");
    expect(tehranMidnight.toISOString()).toBe("2026-08-25T20:30:00.000Z");

    const utcMidnight = startOfDayUtcInTz(instant, "UTC");
    expect(utcMidnight.toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });
});

describe("getOrgTimezone", () => {
  beforeEach(() => {
    clearOrgTimezoneCache();
    findFirst.mockReset();
  });

  it("returns Asia/Tehran when org is missing", async () => {
    findFirst.mockResolvedValue(null);
    await expect(getOrgTimezone()).resolves.toBe(DEFAULT_ORG_TIMEZONE);
  });

  it("returns org timezone from DB", async () => {
    findFirst.mockResolvedValue({ timezone: "UTC" } as never);
    await expect(getOrgTimezone()).resolves.toBe("UTC");
  });

  it("falls back to default for blank timezone", async () => {
    findFirst.mockResolvedValue({ timezone: "  " } as never);
    await expect(getOrgTimezone()).resolves.toBe(DEFAULT_ORG_TIMEZONE);
  });

  it("caches result within TTL", async () => {
    findFirst.mockResolvedValue({ timezone: "Europe/Istanbul" } as never);
    await getOrgTimezone();
    await getOrgTimezone();
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
