import { describe, expect, it } from "vitest";
import { meetingCreateSchema, videoLinkSchema } from "@/lib/validations";
import {
  formatVideoInviteLine,
  mergeTextWithVideoLink,
  parseHttpUrl,
  validateVideoLink,
  videoUrlMatchesProvider,
} from "@/lib/video-link";

const BASE = {
  title: "جلسه تیم",
  branchId: "branch-niavaran",
  startAt: "2030-06-01T06:30:00.000Z",
  endAt: "2030-06-01T07:00:00.000Z",
  participantIds: [],
};

describe("parseHttpUrl", () => {
  it("accepts http and https", () => {
    expect(parseHttpUrl("https://meet.google.com/abc-defg-hij")?.hostname).toBe("meet.google.com");
    expect(parseHttpUrl("http://example.com/room")?.protocol).toBe("http:");
  });

  it("rejects javascript, data, and relative", () => {
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("data:text/html,hi")).toBeNull();
    expect(parseHttpUrl("/join")).toBeNull();
    expect(parseHttpUrl("not a url")).toBeNull();
  });
});

describe("validateVideoLink", () => {
  it("allows omitting the link entirely", () => {
    expect(validateVideoLink(null, null)).toEqual({
      ok: true,
      value: { videoProvider: null, videoUrl: null },
    });
    expect(validateVideoLink("", "   ")).toEqual({
      ok: true,
      value: { videoProvider: null, videoUrl: null },
    });
  });

  it("requires a URL when a provider is chosen", () => {
    const r = validateVideoLink("ZOOM", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("لینک ویدئو");
  });

  it("accepts Google Meet, Teams, Zoom, and custom https", () => {
    expect(validateVideoLink("GOOGLE_MEET", "https://meet.google.com/abc-defg-hij").ok).toBe(true);
    expect(validateVideoLink("TEAMS", "https://teams.microsoft.com/l/meetup-join/19%3ameeting").ok).toBe(true);
    expect(validateVideoLink("ZOOM", "https://us02web.zoom.us/j/123456789").ok).toBe(true);
    expect(validateVideoLink("CUSTOM", "https://example.com/room/42").ok).toBe(true);
  });

  it("rejects a URL that does not match the provider host", () => {
    const r = validateVideoLink("ZOOM", "https://meet.google.com/abc");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("زوم");
  });

  it("defaults missing provider to custom when URL is valid", () => {
    const r = validateVideoLink(null, "https://example.com/call");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.videoProvider).toBe("CUSTOM");
      expect(r.value.videoUrl).toBe("https://example.com/call");
    }
  });
});

describe("videoUrlMatchesProvider", () => {
  it("matches zoom.us subdomains", () => {
    expect(videoUrlMatchesProvider(new URL("https://zoom.us/j/1"), "ZOOM")).toBe(true);
    expect(videoUrlMatchesProvider(new URL("https://company.zoom.us/j/1"), "ZOOM")).toBe(true);
  });
});

describe("meetingCreateSchema video fields", () => {
  it("still accepts a payload without video fields", () => {
    const parsed = meetingCreateSchema.parse({ ...BASE, meetingType: "INTERNAL" });
    expect(parsed.videoUrl ?? null).toBeNull();
    expect(parsed.videoProvider ?? null).toBeNull();
  });

  it("accepts an ONLINE meeting without a link", () => {
    const parsed = meetingCreateSchema.parse({ ...BASE, meetingType: "ONLINE" });
    expect(parsed.meetingType).toBe("ONLINE");
    expect(parsed.videoUrl ?? null).toBeNull();
  });

  it("accepts a valid Zoom link", () => {
    const parsed = meetingCreateSchema.parse({
      ...BASE,
      meetingType: "ONLINE",
      videoProvider: "ZOOM",
      videoUrl: "https://us05web.zoom.us/j/999",
    });
    expect(parsed.videoProvider).toBe("ZOOM");
    expect(parsed.videoUrl).toContain("zoom.us");
  });

  it("rejects an invalid URL", () => {
    const r = meetingCreateSchema.safeParse({
      ...BASE,
      videoProvider: "CUSTOM",
      videoUrl: "ftp://files.example/meet",
    });
    expect(r.success).toBe(false);
  });

  it("rejects javascript URLs", () => {
    const r = meetingCreateSchema.safeParse({
      ...BASE,
      videoUrl: "javascript:alert(1)",
    });
    expect(r.success).toBe(false);
  });

  it("treats empty videoUrl as absent", () => {
    const parsed = meetingCreateSchema.parse({ ...BASE, videoUrl: "  ", videoProvider: null });
    expect(parsed.videoUrl).toBeNull();
  });
});

describe("videoLinkSchema", () => {
  it("clears both fields when empty", () => {
    const parsed = videoLinkSchema.parse({ videoProvider: null, videoUrl: "" });
    expect(parsed.videoUrl).toBeNull();
  });
});

describe("formatVideoInviteLine", () => {
  it("puts the Persian provider name and URL in invite text", () => {
    const line = formatVideoInviteLine("GOOGLE_MEET", "https://meet.google.com/abc");
    expect(line).toContain("گوگل میت");
    expect(line).toContain("https://meet.google.com/abc");
  });

  it("appends to existing body text", () => {
    const merged = mergeTextWithVideoLink(
      "۱۴۰۵/۰۱/۰۱",
      "ZOOM",
      "https://zoom.us/j/1",
    );
    expect(merged).toContain("۱۴۰۵/۰۱/۰۱");
    expect(merged).toContain("زوم");
  });
});
