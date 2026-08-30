import { describe, expect, it } from "vitest";
import { meetingCreateSchema } from "@/lib/validations";
import {
  MEETING_TYPES,
  TYPE_FA,
  isAutoApproveMeetingType,
  isSoloMeetingType,
} from "@/lib";

describe("solo and online meeting types", () => {
  it("includes SOLO and ONLINE in the catalog", () => {
    expect(MEETING_TYPES).toContain("SOLO");
    expect(MEETING_TYPES).toContain("ONLINE");
    expect(TYPE_FA.SOLO).toBe("رزرو تکی");
    expect(TYPE_FA.ONLINE).toBe("جلسه آنلاین");
  });

  it("treats SOLO and ONLINE as invite-less types", () => {
    expect(isSoloMeetingType("SOLO")).toBe(true);
    expect(isSoloMeetingType("ONLINE")).toBe(true);
    expect(isSoloMeetingType("INTERNAL")).toBe(false);
    expect(isSoloMeetingType("ONE_ON_ONE")).toBe(false);
  });

  it("auto-approves internal, solo and online", () => {
    expect(isAutoApproveMeetingType("INTERNAL")).toBe(true);
    expect(isAutoApproveMeetingType("SOLO")).toBe(true);
    expect(isAutoApproveMeetingType("ONLINE")).toBe(true);
    expect(isAutoApproveMeetingType("CLIENT")).toBe(false);
  });

  it("accepts SOLO and ONLINE on create payload", () => {
    const base = {
      title: "رزرو اتاق",
      branchId: "branch-niavaran",
      startAt: "2030-06-01T06:30:00.000Z",
      endAt: "2030-06-01T07:00:00.000Z",
      participantIds: [],
    };
    expect(meetingCreateSchema.parse({ ...base, meetingType: "SOLO" }).meetingType).toBe("SOLO");
    expect(meetingCreateSchema.parse({ ...base, meetingType: "ONLINE" }).meetingType).toBe("ONLINE");
  });
});
