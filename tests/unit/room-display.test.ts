import { describe, expect, it } from "vitest";
import {
  occupancyForRoom,
  pickCurrentAndNext,
  PRIVATE_DISPLAY_TITLE,
  toPublicDisplaySlot,
  normalizeDisplayCode,
  roomDisplayPath,
} from "@/lib/room-display";

const now = new Date("2026-09-01T08:00:00.000Z");

const current = {
  id: "m1",
  title: "کمیته بودجه محرمانه",
  isPrivate: true,
  startAt: new Date("2026-09-01T07:30:00.000Z"),
  endAt: new Date("2026-09-01T09:00:00.000Z"),
  status: "CONFIRMED",
  organizerName: "علی رضایی",
};

const upcoming = {
  id: "m2",
  title: "هم‌اندیشی فروش",
  isPrivate: false,
  startAt: new Date("2026-09-01T10:00:00.000Z"),
  endAt: new Date("2026-09-01T11:00:00.000Z"),
  status: "CONFIRMED",
  organizerName: "سارا احمدی",
};

describe("pickCurrentAndNext", () => {
  it("picks the overlapping meeting as current and the later as next", () => {
    const out = pickCurrentAndNext([upcoming, current], now);
    expect(out.occupancy).toBe("OCCUPIED");
    expect(out.current?.id).toBe("m1");
    expect(out.next?.id).toBe("m2");
  });

  it("ignores cancelled / completed statuses", () => {
    const out = pickCurrentAndNext(
      [{ ...current, status: "CANCELLED" }, { ...upcoming, status: "COMPLETED" }],
      now,
    );
    expect(out.occupancy).toBe("AVAILABLE");
    expect(out.current).toBeNull();
    expect(out.next).toBeNull();
  });

  it("treats endAt as exclusive", () => {
    const ending = { ...current, id: "end", endAt: now, isPrivate: false, title: "پایان" };
    const out = pickCurrentAndNext([ending], now);
    expect(out.current).toBeNull();
    expect(out.occupancy).toBe("AVAILABLE");
  });
});

describe("toPublicDisplaySlot", () => {
  it("always masks private titles and strips organizer", () => {
    const slot = toPublicDisplaySlot(current);
    expect(slot?.title).toBe(PRIVATE_DISPLAY_TITLE);
    expect(slot?.isMasked).toBe(true);
    expect(slot?.organizerName).toBeNull();
    expect(JSON.stringify(slot)).not.toContain("کمیته بودجه");
    expect(JSON.stringify(slot)).not.toContain("علی رضایی");
  });

  it("keeps public titles", () => {
    const slot = toPublicDisplaySlot(upcoming);
    expect(slot?.title).toBe("هم‌اندیشی فروش");
    expect(slot?.isMasked).toBe(false);
    expect(slot?.organizerName).toBe("سارا احمدی");
  });
});

describe("occupancyForRoom", () => {
  it("disables inactive rooms even when a meeting is on", () => {
    expect(occupancyForRoom({ isActive: false, occupancy: "OCCUPIED" })).toBe("DISABLED");
    expect(occupancyForRoom({ isActive: true, occupancy: "AVAILABLE" })).toBe("AVAILABLE");
  });
});

describe("display helpers", () => {
  it("normalizes room codes and builds kiosk paths", () => {
    expect(normalizeDisplayCode(" ab-12cd ")).toBe("AB12CD");
    expect(roomDisplayPath("room-a", "tok")).toBe("/rooms/room-a/display?t=tok");
  });
});
