import { describe, expect, it } from "vitest";
import {
  bookingMatchesQuery,
  reserveMeetingHref,
  suggestRoomId,
  type AvailabilityBookingDraft,
} from "@/lib/availability-booking";

describe("availability booking handoff", () => {
  const draft: AvailabilityBookingDraft = {
    branchId: "branch-niavaran",
    startAt: "2030-06-01T06:30:00.000Z",
    endAt: "2030-06-01T07:00:00.000Z",
    durationMin: 30,
    people: [{ ref: "dir:p1", name: "علی", kind: "INTERNAL" as const }],
    availableRooms: [
      { id: "r1", name: "A", capacity: 4 },
      { id: "r2", name: "B", capacity: 10 },
    ],
    roomId: "r1",
  };

  it("reserveMeetingHref encodes query params", () => {
    const href = reserveMeetingHref(draft);
    expect(href).toContain("from=availability");
    expect(href).toContain("branchId=branch-niavaran");
    expect(href).toContain("durationMin=30");
    expect(href).toContain("roomId=r1");
  });

  it("bookingMatchesQuery validates URL against draft", () => {
    const q = new URLSearchParams(hrefQuery(draft));
    expect(
      bookingMatchesQuery(draft, {
        branchId: q.get("branchId"),
        startAt: q.get("startAt"),
        endAt: q.get("endAt"),
        durationMin: q.get("durationMin"),
      }),
    ).toBe(true);
    expect(
      bookingMatchesQuery(draft, {
        branchId: "other",
        startAt: q.get("startAt"),
        endAt: q.get("endAt"),
        durationMin: q.get("durationMin"),
      }),
    ).toBe(false);
  });

  it("suggestRoomId picks closest capacity", () => {
    expect(suggestRoomId(draft.availableRooms, 3)).toBe("r1");
    expect(suggestRoomId(draft.availableRooms, 9)).toBe("r2");
  });
});

function hrefQuery(d: AvailabilityBookingDraft): string {
  return reserveMeetingHref(d).split("?")[1] ?? "";
}
