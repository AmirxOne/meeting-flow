import { describe, expect, it } from "vitest";
import { canShowMeetingRsvp } from "@/lib/meeting-period";

describe("canShowMeetingRsvp", () => {
  it("shows for invitees on open meetings", () => {
    expect(canShowMeetingRsvp("PENDING", "CONFIRMED")).toBe(true);
    expect(canShowMeetingRsvp("ACCEPTED", "PENDING_APPROVAL")).toBe(true);
  });

  it("hides for organizers (null) and closed meetings", () => {
    expect(canShowMeetingRsvp(null, "CONFIRMED")).toBe(false);
    expect(canShowMeetingRsvp("PENDING", "COMPLETED")).toBe(false);
    expect(canShowMeetingRsvp("PENDING", "CANCELLED")).toBe(false);
    expect(canShowMeetingRsvp("PENDING", "REJECTED")).toBe(false);
    expect(canShowMeetingRsvp("PENDING", "NO_SHOW")).toBe(false);
    expect(canShowMeetingRsvp("PENDING", "WAITLISTED")).toBe(false);
    expect(canShowMeetingRsvp("PENDING", "WAITLIST_OFFERED")).toBe(false);
  });
});
