import { describe, expect, it } from "vitest";
import {
  assignTimelineColumns,
  busiestHour,
  dayHourRange,
  groupByStartHour,
  hourDensity,
  layoutDayBlocks,
  nowLineTop,
  TIMELINE_DEFAULT_END,
  TIMELINE_DEFAULT_START,
  TIMELINE_MIN_BLOCK_PX,
  TIMELINE_PX_PER_HOUR,
} from "@/lib/calendar-timeline";

describe("dayHourRange", () => {
  it("defaults to office hours when empty", () => {
    expect(dayHourRange([])).toEqual({
      startHour: TIMELINE_DEFAULT_START,
      endHour: TIMELINE_DEFAULT_END,
    });
  });

  it("expands to cover early and late meetings", () => {
    expect(dayHourRange([{ startMin: 7 * 60, endMin: 9 * 60 }]).startHour).toBe(7);
    expect(dayHourRange([{ startMin: 19 * 60 + 30, endMin: 21 * 60 }]).endHour).toBe(21);
  });

  it("does not stretch the grid just because now is outside office hours", () => {
    expect(dayHourRange([])).toEqual({
      startHour: TIMELINE_DEFAULT_START,
      endHour: TIMELINE_DEFAULT_END,
    });
  });
});

describe("assignTimelineColumns", () => {
  it("keeps sequential meetings on one column", () => {
    const cols = assignTimelineColumns([
      { id: "a", startMin: 8 * 60, endMin: 9 * 60 },
      { id: "b", startMin: 9 * 60, endMin: 10 * 60 },
    ]);
    expect(cols.get("a")).toEqual({ col: 0, cols: 1 });
    expect(cols.get("b")).toEqual({ col: 0, cols: 1 });
  });

  it("splits overlapping meetings into columns", () => {
    const cols = assignTimelineColumns([
      { id: "a", startMin: 8 * 60, endMin: 10 * 60 },
      { id: "b", startMin: 9 * 60, endMin: 11 * 60 },
    ]);
    expect(cols.get("a")?.cols).toBe(2);
    expect(cols.get("b")?.cols).toBe(2);
    expect(cols.get("a")?.col).not.toBe(cols.get("b")?.col);
  });

  it("reuses a free column after an overlap ends", () => {
    const cols = assignTimelineColumns([
      { id: "a", startMin: 8 * 60, endMin: 10 * 60 },
      { id: "b", startMin: 9 * 60, endMin: 11 * 60 },
      { id: "c", startMin: 10 * 60, endMin: 12 * 60 },
    ]);
    expect(cols.get("a")?.col).toBe(cols.get("c")?.col);
    expect(cols.get("b")?.cols).toBe(2);
  });
});

describe("layoutDayBlocks", () => {
  it("positions a 1-hour block from 09:00 when the grid starts at 08:00", () => {
    const [block] = layoutDayBlocks(
      [{ id: "m", startMin: 9 * 60, endMin: 10 * 60 }],
      8,
    );
    expect(block.top).toBe(TIMELINE_PX_PER_HOUR);
    expect(block.height).toBe(TIMELINE_PX_PER_HOUR - 3);
  });

  it("enforces a minimum height for short meetings", () => {
    const [block] = layoutDayBlocks(
      [{ id: "m", startMin: 9 * 60, endMin: 9 * 60 + 10 }],
      8,
    );
    expect(block.height).toBe(TIMELINE_MIN_BLOCK_PX);
  });
});

describe("groupByStartHour", () => {
  it("clusters meetings by start hour and keeps start order", () => {
    const groups = groupByStartHour([
      { id: "b", startMin: 10 * 60 + 30, endMin: 11 * 60 },
      { id: "a", startMin: 8 * 60, endMin: 9 * 60 },
      { id: "c", startMin: 10 * 60, endMin: 10 * 60 + 20 },
    ]);
    expect(groups.map((g) => g.hour)).toEqual([8, 10]);
    expect(groups[1].ids).toEqual(["c", "b"]);
  });
});

describe("hourDensity + busiestHour", () => {
  it("counts starts inside the office window", () => {
    const dens = hourDensity(
      [
        { id: "a", startMin: 8 * 60, endMin: 9 * 60 },
        { id: "b", startMin: 8 * 60 + 15, endMin: 9 * 60 },
        { id: "c", startMin: 14 * 60, endMin: 15 * 60 },
      ],
      8,
      16,
    );
    expect(dens.find((d) => d.hour === 8)?.count).toBe(2);
    expect(dens.find((d) => d.hour === 9)?.count).toBe(0);
    expect(dens.find((d) => d.hour === 14)?.count).toBe(1);
  });

  it("picks the busiest hour", () => {
    expect(
      busiestHour([
        { hour: 8, ids: ["a"] },
        { hour: 10, ids: ["b", "c", "d"] },
      ]),
    ).toEqual({ hour: 10, count: 3 });
  });
});

describe("nowLineTop", () => {
  it("places 10:30 at 2.5 hours from an 08:00 origin", () => {
    expect(nowLineTop(10 * 60 + 30, 8, 20)).toBe(2.5 * TIMELINE_PX_PER_HOUR);
  });

  it("hides the line outside the visible range", () => {
    expect(nowLineTop(6 * 60, 8, 20)).toBeNull();
  });
});
