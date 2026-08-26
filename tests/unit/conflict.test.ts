import { describe, it, expect } from "vitest";
import { subtractBusy, candidateSlots, intervalsOverlap } from "@/server/services/conflict.service";

describe("interval overlap", () => {
  const d = (min: number) => new Date(Date.UTC(2026, 7, 26, 10, 0, 0) + min * 60000);

  it("detects overlapping ranges", () => {
    expect(intervalsOverlap(d(0), d(60), d(30), d(90))).toBe(true);
    expect(intervalsOverlap(d(0), d(60), d(60), d(120))).toBe(false); // touching = no overlap
    expect(intervalsOverlap(d(0), d(60), d(120), d(180))).toBe(false);
    expect(intervalsOverlap(d(0), d(180), d(60), d(120))).toBe(true); // contained
  });
});

describe("subtractBusy", () => {
  const base = Date.UTC(2026, 7, 26, 8, 0, 0); // 08:00
  const t = (min: number) => new Date(base + min * 60000);

  it("returns whole window when no busy", () => {
    const free = subtractBusy(t(0), t(120), []);
    expect(free).toHaveLength(1);
    expect(free[0].start.getTime()).toBe(t(0).getTime());
    expect(free[0].end.getTime()).toBe(t(120).getTime());
  });

  it("splits around a middle busy block", () => {
    const free = subtractBusy(t(0), t(120), [{ start: t(30), end: t(60) }]);
    expect(free).toHaveLength(2);
    expect(free[0]).toEqual({ start: t(0), end: t(30) });
    expect(free[1]).toEqual({ start: t(60), end: t(120) });
  });

  it("merces adjacent busy blocks", () => {
    const free = subtractBusy(t(0), t(120), [
      { start: t(0), end: t(30) },
      { start: t(30), end: t(60) },
    ]);
    expect(free).toHaveLength(1);
    expect(free[0].start.getTime()).toBe(t(60).getTime());
  });

  it("clamps busy blocks outside window", () => {
    const free = subtractBusy(t(30), t(90), [{ start: t(0), end: t(120) }]);
    expect(free).toHaveLength(0);
  });

  it("handles out-of-order busy list", () => {
    const free = subtractBusy(t(0), t(120), [
      { start: t(60), end: t(90) },
      { start: t(0), end: t(30) },
    ]);
    expect(free).toHaveLength(2);
    expect(free[0].start.getTime()).toBe(t(30).getTime());
    expect(free[0].end.getTime()).toBe(t(60).getTime());
    expect(free[1].start.getTime()).toBe(t(90).getTime());
    expect(free[1].end.getTime()).toBe(t(120).getTime());
  });
});

describe("candidateSlots", () => {
  const base = Date.UTC(2026, 7, 26, 9, 0, 0);
  const t = (min: number) => new Date(base + min * 60000);

  it("cuts aligned slots of requested duration", () => {
    const slots = candidateSlots([{ start: t(0), end: t(90) }], 30, 30, 10);
    expect(slots).toHaveLength(3);
    expect(slots[0].start.getTime()).toBe(t(0).getTime());
    expect(slots[2].start.getTime()).toBe(t(60).getTime());
  });

  it("does not produce partial slots", () => {
    const slots = candidateSlots([{ start: t(0), end: t(70) }], 30, 30, 10);
    expect(slots).toHaveLength(2); // 9:00-9:30, 9:30-10:00 (10:00-10:10 doesn't fit)
  });
});
