import { describe, it, expect } from "vitest";
import { exclusionOverlapsBooking } from "@/server/services/room-exclusion.service";
import { intervalsOverlap } from "@/server/services/conflict.service";

describe("exclusionOverlapsBooking", () => {
  const d = (min: number) => new Date(Date.UTC(2026, 7, 26, 10, 0, 0) + min * 60000);

  it("detects overlap between exclusion and booking", () => {
    expect(exclusionOverlapsBooking(d(0), d(120), d(30), d(90))).toBe(true);
    expect(exclusionOverlapsBooking(d(0), d(60), d(60), d(120))).toBe(false);
    expect(exclusionOverlapsBooking(d(0), d(180), d(60), d(120))).toBe(true);
  });

  it("matches conflict.service intervalsOverlap semantics", () => {
    const aStart = d(0);
    const aEnd = d(60);
    const bStart = d(30);
    const bEnd = d(90);
    expect(exclusionOverlapsBooking(aStart, aEnd, bStart, bEnd)).toBe(
      intervalsOverlap(aStart, aEnd, bStart, bEnd),
    );
  });
});
