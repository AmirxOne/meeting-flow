import { describe, it, expect } from "vitest";
import {
  canActorSetResponse,
  canRespondToMeeting,
  isParticipantResponse,
  responseStatusLabel,
} from "@/server/services/participant-response.service";

describe("participant response rules", () => {
  it("accepts valid RSVP statuses", () => {
    expect(isParticipantResponse("ACCEPTED")).toBe(true);
    expect(isParticipantResponse("DECLINED")).toBe(true);
    expect(isParticipantResponse("TENTATIVE")).toBe(true);
    expect(isParticipantResponse("PENDING")).toBe(false);
    expect(isParticipantResponse("MAYBE")).toBe(false);
  });

  it("blocks RSVP on closed meetings", () => {
    expect(canRespondToMeeting("CONFIRMED")).toBe(true);
    expect(canRespondToMeeting("PENDING_APPROVAL")).toBe(true);
    expect(canRespondToMeeting("COMPLETED")).toBe(false);
    expect(canRespondToMeeting("CANCELLED")).toBe(false);
    expect(canRespondToMeeting("REJECTED")).toBe(false);
    expect(canRespondToMeeting("WAITLISTED")).toBe(false);
    expect(canRespondToMeeting("WAITLIST_OFFERED")).toBe(false);
  });

  it("allows self or organizer to set response", () => {
    expect(canActorSetResponse("u1", "u1", "org")).toBe(true);
    expect(canActorSetResponse("org", "u1", "org")).toBe(true);
    expect(canActorSetResponse("other", "u1", "org")).toBe(false);
  });

  it("maps response labels to Persian", () => {
    expect(responseStatusLabel("ACCEPTED")).toBe("قبول");
    expect(responseStatusLabel("TENTATIVE")).toBe("مرددد");
  });
});
