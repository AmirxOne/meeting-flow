import { describe, expect, it } from "vitest";
import { maskPrivateMeeting, maskPrivateConflictTitle } from "@/server/services/privacy";

describe("maskPrivateMeeting", () => {
  const meeting = {
    isPrivate: true,
    organizerId: "ali",
    title: "کمیته بودجه",
    description: "محرمانه",
    series: { id: "s1", title: "کمیته بودجه" },
    participants: [{ userId: "ali" }],
  };

  it("leaves organizer content intact", () => {
    const out = maskPrivateMeeting(meeting, { id: "ali" });
    expect(out.title).toBe("کمیته بودجه");
    expect(out.isMasked).toBeUndefined();
  });

  it("masks title and nested series title for outsiders", () => {
    const out = maskPrivateMeeting(meeting, { id: "admin" });
    expect(out.isMasked).toBe(true);
    expect(out.title).toBe("جلسه محرمانه");
    expect(out.series?.title).toBe("جلسه محرمانه");
  });

  it("does not mask for super admin", () => {
    const out = maskPrivateMeeting(meeting, { id: "x", isSuperAdmin: true });
    expect(out.title).toBe("کمیته بودجه");
  });

  it("strips minutes for outsiders", () => {
    const withMinutes = {
      ...meeting,
      minutes: { body: "متن محرمانه", decisions: [{ text: "تصمیم سری" }] },
    };
    const out = maskPrivateMeeting(withMinutes, { id: "admin" });
    expect(out.isMasked).toBe(true);
    expect(out.minutes).toBeUndefined();
  });

  it("strips video link for outsiders", () => {
    const withVideo = {
      ...meeting,
      videoUrl: "https://meet.google.com/abc-defg-hij",
      videoProvider: "GOOGLE_MEET",
    };
    const out = maskPrivateMeeting(withVideo, { id: "admin" });
    expect(out.videoUrl).toBeUndefined();
    expect(out.videoProvider).toBeUndefined();
  });

  it("does not mask for the person who booked on behalf (createdBy)", () => {
    const out = maskPrivateMeeting(
      { ...meeting, createdById: "sara", participants: [{ userId: "ali" }] },
      { id: "sara" },
    );
    expect(out.title).toBe("کمیته بودجه");
    expect(out.isMasked).toBeUndefined();
  });

  it("still masks a manager's other private meeting for a mere delegate", () => {
    const out = maskPrivateMeeting(meeting, { id: "sara" });
    expect(out.isMasked).toBe(true);
    expect(out.title).toBe("جلسه محرمانه");
  });
});

describe("maskPrivateConflictTitle", () => {
  it("hides private titles from a delegate who is not the organizer", () => {
    expect(
      maskPrivateConflictTitle("کمیته بودجه", true, "admin", { id: "ali" }),
    ).toBe("جلسه محرمانه");
  });

  it("keeps the title for the organizer", () => {
    expect(
      maskPrivateConflictTitle("کمیته بودجه", true, "admin", { id: "admin" }),
    ).toBe("کمیته بودجه");
  });
});
