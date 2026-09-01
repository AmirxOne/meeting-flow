export interface WayfindingSource {
  branchName: string;
  branchDirections: string | null;
  branchHasMap: boolean;
  roomName: string | null;
  floorName: string | null;
  floorNumber: number | null;
  floorDirections: string | null;
  floorHasMap: boolean;
}

export interface WayfindingDto {
  branchName: string;
  roomName: string | null;
  floorName: string | null;
  floorNumber: number | null;
  directions: string | null;
  hasMap: boolean;
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim() ?? "";
  return t.length > 0 ? t : null;
}

/** Floor directions/map win over branch when the meeting has a floor. */
export function buildWayfinding(src: WayfindingSource): WayfindingDto {
  return {
    branchName: src.branchName,
    roomName: src.roomName,
    floorName: src.floorName,
    floorNumber: src.floorNumber,
    directions: trimOrNull(src.floorDirections) ?? trimOrNull(src.branchDirections),
    hasMap: src.floorHasMap || src.branchHasMap,
  };
}

export function preferFloorMapKey(src: {
  floorKey: string | null | undefined;
  branchKey: string | null | undefined;
}): { storageKey: string; source: "floor" | "branch" } | null {
  if (src.floorKey) return { storageKey: src.floorKey, source: "floor" };
  if (src.branchKey) return { storageKey: src.branchKey, source: "branch" };
  return null;
}
