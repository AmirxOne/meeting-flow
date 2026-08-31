import { describe, expect, it } from "vitest";
import { calendarEventTone, newMeetingHref } from "@/lib/calendar-event";

describe("calendarEventTone", () => {
  it("marks in-progress meetings in red", () => {
    expect(calendarEventTone("IN_PROGRESS").dot).toBe("bg-red-500");
  });

  it("marks pending approval in amber", () => {
    expect(calendarEventTone("PENDING_APPROVAL").rail).toBe("bg-amber-500");
  });

  it("dims cancelled meetings", () => {
    expect(calendarEventTone("CANCELLED").chip).toContain("line-through");
  });

  it("uses ink for confirmed / default", () => {
    expect(calendarEventTone("CONFIRMED").block).toBe("bg-ink text-white");
    expect(calendarEventTone("APPROVED").rail).toBe("bg-ink");
  });
});

describe("newMeetingHref", () => {
  it("builds a calendar handoff URL", () => {
    expect(newMeetingHref("2026-08-31", 10)).toBe(
      "/meetings/new?from=calendar&date=2026-08-31&hour=10",
    );
  });

  it("omits hour when not provided", () => {
    expect(newMeetingHref("2026-08-31")).toBe("/meetings/new?from=calendar&date=2026-08-31");
  });
});
