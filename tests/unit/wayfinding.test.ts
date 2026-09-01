import { describe, expect, it } from "vitest";
import { buildWayfinding, preferFloorMapKey } from "@/lib/wayfinding";

describe("buildWayfinding", () => {
  const base = {
    branchName: "شعبه نیاوران",
    branchDirections: "از لابی آسانسور راست",
    branchHasMap: true,
    roomName: "اتاق جلسه آریا" as string | null,
    floorName: "طبقه اول" as string | null,
    floorNumber: 1 as number | null,
    floorDirections: null as string | null,
    floorHasMap: false,
  };

  it("uses branch directions when the floor has none", () => {
    expect(buildWayfinding(base)).toEqual({
      branchName: "شعبه نیاوران",
      roomName: "اتاق جلسه آریا",
      floorName: "طبقه اول",
      floorNumber: 1,
      directions: "از لابی آسانسور راست",
      hasMap: true,
    });
  });

  it("prefers floor directions over branch", () => {
    expect(buildWayfinding({ ...base, floorDirections: "  سمت چپ راهرو  " }).directions).toBe(
      "سمت چپ راهرو",
    );
  });

  it("hasMap if either floor or branch has a map", () => {
    expect(buildWayfinding({ ...base, branchHasMap: false, floorHasMap: true }).hasMap).toBe(true);
    expect(buildWayfinding({ ...base, branchHasMap: false, floorHasMap: false }).hasMap).toBe(false);
  });

  it("allows missing room and floor", () => {
    const dto = buildWayfinding({
      ...base,
      roomName: null,
      floorName: null,
      floorNumber: null,
      floorHasMap: false,
    });
    expect(dto.roomName).toBeNull();
    expect(dto.floorName).toBeNull();
    expect(dto.branchName).toBe("شعبه نیاوران");
  });
});

describe("preferFloorMapKey", () => {
  it("picks floor map before branch map", () => {
    expect(preferFloorMapKey({ floorKey: "maps/floor/a.png", branchKey: "maps/branch/b.png" })).toEqual({
      storageKey: "maps/floor/a.png",
      source: "floor",
    });
  });

  it("falls back to branch then none", () => {
    expect(preferFloorMapKey({ floorKey: null, branchKey: "maps/branch/b.png" })?.source).toBe("branch");
    expect(preferFloorMapKey({ floorKey: null, branchKey: null })).toBeNull();
  });
});
