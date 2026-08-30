import { describe, expect, it } from "vitest";
import {
  canTransition,
  assertTransition,
} from "@/server/services/state-machine";
import {
  isPastEndGrace,
  resolveStaleMeetingStatus,
  MEETING_END_GRACE_MS,
} from "@/server/services/meeting-lifecycle";

describe("meeting state machine — NO_SHOW", () => {
  it("allows IN_PROGRESS → NO_SHOW", () => {
    expect(canTransition("IN_PROGRESS", "NO_SHOW")).toBe(true);
  });

  it("allows IN_PROGRESS → COMPLETED", () => {
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("does not allow COMPLETED → NO_SHOW", () => {
    expect(canTransition("COMPLETED", "NO_SHOW")).toBe(false);
  });

  it("assertTransition allows IN_PROGRESS → NO_SHOW", () => {
    expect(() => assertTransition("IN_PROGRESS", "NO_SHOW")).not.toThrow();
  });
});

describe("meeting lifecycle auto-close", () => {
  const endAt = new Date("2030-06-01T10:00:00.000Z");

  it("isPastEndGrace respects grace window", () => {
    expect(isPastEndGrace(endAt, new Date("2030-06-01T10:10:00.000Z"))).toBe(false);
    expect(
      isPastEndGrace(endAt, new Date(endAt.getTime() + MEETING_END_GRACE_MS + 1)),
    ).toBe(true);
  });

  it("CONFIRMED without STARTED → NO_SHOW", () => {
    expect(resolveStaleMeetingStatus({ status: "CONFIRMED", hasStartedEvent: false })).toBe(
      "NO_SHOW",
    );
  });

  it("RESCHEDULED without STARTED → NO_SHOW", () => {
    expect(resolveStaleMeetingStatus({ status: "RESCHEDULED", hasStartedEvent: false })).toBe(
      "NO_SHOW",
    );
  });

  it("IN_PROGRESS with STARTED → COMPLETED", () => {
    expect(resolveStaleMeetingStatus({ status: "IN_PROGRESS", hasStartedEvent: true })).toBe(
      "COMPLETED",
    );
  });

  it("IN_PROGRESS without STARTED → NO_SHOW", () => {
    expect(resolveStaleMeetingStatus({ status: "IN_PROGRESS", hasStartedEvent: false })).toBe(
      "NO_SHOW",
    );
  });

  it("ignores terminal statuses", () => {
    expect(resolveStaleMeetingStatus({ status: "CANCELLED", hasStartedEvent: false })).toBeNull();
  });
});
