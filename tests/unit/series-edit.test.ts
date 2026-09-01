import { describe, expect, it } from "vitest";
import {
  filterSeriesTargets,
  isBulkEditableStatus,
  shiftOccurrence,
  slotsOverlapSameRoom,
} from "@/lib/series-edit";

function occ(
  id: string,
  status: string,
  startMs: number,
  originalMs?: number,
) {
  return {
    id,
    status,
    startAt: new Date(startMs),
    originalStartAt: originalMs != null ? new Date(originalMs) : new Date(startMs),
  };
}

const t0 = Date.UTC(2030, 5, 1, 6, 30);
const day = 86400000;
const a = occ("a", "CONFIRMED", t0);
const b = occ("b", "CONFIRMED", t0 + day);
const c = occ("c", "CONFIRMED", t0 + 2 * day);
const done = occ("d", "COMPLETED", t0 + 3 * day);
const live = occ("e", "IN_PROGRESS", t0 - day);

describe("filterSeriesTargets", () => {
  const all = [a, b, c, done, live];

  it("THIS returns only the pivot", () => {
    expect(filterSeriesTargets(all, "THIS", b).map((m) => m.id)).toEqual(["b"]);
  });

  it("FOLLOWING returns pivot and later editable instances", () => {
    expect(filterSeriesTargets(all, "FOLLOWING", b).map((m) => m.id)).toEqual(["b", "c"]);
  });

  it("ALL skips completed and in-progress", () => {
    expect(filterSeriesTargets(all, "ALL", b).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
});

describe("isBulkEditableStatus", () => {
  it("rejects terminal and in-progress", () => {
    expect(isBulkEditableStatus("CONFIRMED")).toBe(true);
    expect(isBulkEditableStatus("RESCHEDULED")).toBe(true);
    expect(isBulkEditableStatus("CANCELLED")).toBe(false);
    expect(isBulkEditableStatus("IN_PROGRESS")).toBe(false);
  });
});

describe("shiftOccurrence", () => {
  it("applies delta and new duration", () => {
    const start = new Date(t0);
    const end = new Date(t0 + 30 * 60000);
    const next = shiftOccurrence(start, end, 3600000, 45 * 60000);
    expect(next.startAt.getTime()).toBe(t0 + 3600000);
    expect(next.endAt.getTime()).toBe(t0 + 3600000 + 45 * 60000);
  });
});

describe("slotsOverlapSameRoom", () => {
  it("detects overlap on the same room", () => {
    expect(
      slotsOverlapSameRoom([
        { startAt: new Date(t0), endAt: new Date(t0 + 3600000), roomId: "r1" },
        { startAt: new Date(t0 + 1800000), endAt: new Date(t0 + 5400000), roomId: "r1" },
      ]),
    ).toBe(true);
  });

  it("allows same time in different rooms", () => {
    expect(
      slotsOverlapSameRoom([
        { startAt: new Date(t0), endAt: new Date(t0 + 3600000), roomId: "r1" },
        { startAt: new Date(t0), endAt: new Date(t0 + 3600000), roomId: "r2" },
      ]),
    ).toBe(false);
  });
});
