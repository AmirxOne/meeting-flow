import { describe, expect, it } from "vitest";
import { fillHourlyHistogram } from "@/lib/report-histogram";

describe("fillHourlyHistogram", () => {
  it("fills empty office hours with zeros", () => {
    const rows = fillHourlyHistogram(new Map());
    expect(rows[0]).toEqual({ hour: 8, count: 0 });
    expect(rows.at(-1)).toEqual({ hour: 20, count: 0 });
    expect(rows).toHaveLength(13);
  });

  it("keeps known counts and pads gaps", () => {
    const rows = fillHourlyHistogram(new Map([[10, 4], [16, 9]]));
    expect(rows.find((r) => r.hour === 10)?.count).toBe(4);
    expect(rows.find((r) => r.hour === 16)?.count).toBe(9);
    expect(rows.find((r) => r.hour === 12)?.count).toBe(0);
    expect(rows).toHaveLength(13);
  });

  it("extends the window when a meeting starts outside office hours", () => {
    const rows = fillHourlyHistogram(new Map([[1, 2], [10, 1]]));
    expect(rows[0]).toEqual({ hour: 1, count: 2 });
    expect(rows.find((r) => r.hour === 8)?.count).toBe(0);
  });
});
