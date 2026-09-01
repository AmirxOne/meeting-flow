import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseCalendarProviderKind,
  createCalendarProvider,
  createCalendarProviderForConnection,
  GoogleCalendarProvider,
  toGoogleEventBody,
} from "@/server/services/calendar-provider";
import { sealSecret } from "@/server/crypto/secret-box";
import { MOCK_CALENDAR_REFRESH } from "@/server/services/google-calendar-oauth";

describe("parseCalendarProviderKind", () => {
  it("defaults to mock", () => {
    expect(parseCalendarProviderKind(undefined)).toBe("mock");
    expect(parseCalendarProviderKind("")).toBe("mock");
  });

  it("recognizes google", () => {
    expect(parseCalendarProviderKind("google")).toBe("google");
    expect(parseCalendarProviderKind("GOOGLE")).toBe("google");
  });

  it("recognizes outlook", () => {
    expect(parseCalendarProviderKind("outlook")).toBe("outlook");
    expect(parseCalendarProviderKind("OUTLOOK")).toBe("outlook");
  });

  it("falls back for unknown", () => {
    expect(parseCalendarProviderKind("exchange")).toBe("mock");
  });
});

describe("toGoogleEventBody", () => {
  const startAt = new Date("2030-06-01T10:00:00.000Z");
  const endAt = new Date("2030-06-01T11:30:00.000Z");

  it("maps title, Tehran TZ, attendees, and confirmed status", () => {
    const body = toGoogleEventBody(
      {
        meetingId: "m1",
        title: "جلسه فروش",
        description: "دستور جلسه",
        startAt,
        endAt,
        location: "اتاق A — ونک",
        attendeeEmails: ["ali@example.com", "sara@example.com"],
        status: "confirmed",
      },
      "Asia/Tehran",
    );
    expect(body.summary).toBe("جلسه فروش");
    expect(body.description).toBe("دستور جلسه");
    expect(body.location).toBe("اتاق A — ونک");
    expect(body.start).toEqual({ dateTime: startAt.toISOString(), timeZone: "Asia/Tehran" });
    expect(body.end).toEqual({ dateTime: endAt.toISOString(), timeZone: "Asia/Tehran" });
    expect(body.status).toBe("confirmed");
    expect(body.attendees).toEqual([
      { email: "ali@example.com" },
      { email: "sara@example.com" },
    ]);
  });

  it("maps pending approval to tentative", () => {
    const body = toGoogleEventBody(
      { meetingId: "m1", title: "در انتظار", startAt, endAt, status: "tentative" },
      "Asia/Tehran",
    );
    expect(body.status).toBe("tentative");
  });

  it("maps cancelled meetings", () => {
    const body = toGoogleEventBody(
      { meetingId: "m1", title: "لغو", startAt, endAt, status: "cancelled" },
      "UTC",
    );
    expect(body.status).toBe("cancelled");
    expect(body.start.timeZone).toBe("UTC");
  });

  it("omits attendees when the list is empty (private / masked)", () => {
    const body = toGoogleEventBody(
      { meetingId: "m1", title: "جلسه محرمانه", startAt, endAt, attendeeEmails: [] },
      "Asia/Tehran",
    );
    expect(body.attendees).toBeUndefined();
  });
});

describe("createCalendarProvider", () => {
  it("returns mock by default", () => {
    expect(createCalendarProvider({ provider: "mock" }).name).toBe("mock");
  });

  it("falls back to mock when Google credentials are missing (does not throw)", () => {
    expect(createCalendarProvider({ provider: "google" }).name).toBe("mock");
  });

  it("creates google provider with per-user refresh token", () => {
    const p = createCalendarProvider({
      provider: "google",
      googleClientId: "cid",
      googleClientSecret: "secret",
      googleRefreshToken: "refresh",
      googleCalendarId: "primary",
    });
    expect(p.name).toBe("google");
  });

  it("creates outlook provider with per-user refresh token", () => {
    const p = createCalendarProvider({
      provider: "outlook",
      outlookClientId: "cid",
      outlookClientSecret: "secret",
      outlookRefreshToken: "refresh",
    });
    expect(p.name).toBe("outlook");
  });

  it("falls back to mock outlook when Graph credentials are missing", () => {
    expect(createCalendarProvider({ provider: "outlook" }).name).toBe("outlook");
  });
});

describe("createCalendarProviderForConnection", () => {
  it("uses mock provider for mock connections", () => {
    const p = createCalendarProviderForConnection({
      userId: "u1",
      provider: "mock",
      refreshTokenEnc: sealSecret(MOCK_CALENDAR_REFRESH),
      calendarId: "primary",
    });
    expect(p?.name).toBe("mock");
  });

  it("returns null for a corrupted encrypted token", () => {
    const p = createCalendarProviderForConnection({
      userId: "u1",
      provider: "google",
      refreshTokenEnc: "not-valid",
      calendarId: "primary",
    });
    expect(p).toBeNull();
  });

  it("uses mock provider named outlook for mock Outlook connections", () => {
    const p = createCalendarProviderForConnection({
      userId: "u1",
      provider: "outlook",
      refreshTokenEnc: sealSecret(MOCK_CALENDAR_REFRESH),
      calendarId: "calendar",
    });
    expect(p?.name).toBe("outlook");
  });

  it("returns null when Outlook app credentials are missing for a real token", () => {
    const prevId = process.env.OUTLOOK_CLIENT_ID;
    const prevSecret = process.env.OUTLOOK_CLIENT_SECRET;
    delete process.env.OUTLOOK_CLIENT_ID;
    delete process.env.OUTLOOK_CLIENT_SECRET;
    const p = createCalendarProviderForConnection({
      userId: "u1",
      provider: "outlook",
      refreshTokenEnc: sealSecret("real-refresh"),
      calendarId: "calendar",
    });
    expect(p).toBeNull();
    process.env.OUTLOOK_CLIENT_ID = prevId;
    process.env.OUTLOOK_CLIENT_SECRET = prevSecret;
  });

  it("returns null when Google app credentials are missing for a real token", () => {
    const prevId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const p = createCalendarProviderForConnection({
      userId: "u1",
      provider: "google",
      refreshTokenEnc: sealSecret("real-refresh"),
      calendarId: "primary",
    });
    expect(p).toBeNull();
    process.env.GOOGLE_CALENDAR_CLIENT_ID = prevId;
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = prevSecret;
  });
});

describe("MockCalendarProvider via factory", () => {
  it("create/update/cancel without throwing", async () => {
    const p = createCalendarProvider({ provider: "mock" });
    const start = new Date("2030-01-01T10:00:00Z");
    const end = new Date("2030-01-01T11:00:00Z");
    const { externalEventId } = await p.createEvent({
      meetingId: "m1",
      title: "جلسه",
      startAt: start,
      endAt: end,
    });
    expect(externalEventId).toBe("mock-m1");
    await p.updateEvent(externalEventId, {
      meetingId: "m1",
      title: "جلسه ۲",
      startAt: start,
      endAt: end,
    });
    await p.cancelEvent(externalEventId);
  });
});

describe("GoogleCalendarProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("obtains token and creates calendar event with mapped body", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "tok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "google-event-1" }),
      });

    const provider = new GoogleCalendarProvider(
      "cid",
      "secret",
      "refresh",
      "primary",
      "Asia/Tehran",
      fetchMock,
    );

    const { externalEventId } = await provider.createEvent({
      meetingId: "m1",
      title: "Test",
      startAt: new Date("2030-06-01T10:00:00Z"),
      endAt: new Date("2030-06-01T11:00:00Z"),
      status: "confirmed",
    });

    expect(externalEventId).toBe("google-event-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, createInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((createInit.headers as Record<string, string>).Authorization).toMatch(/^Bearer /);
    const body = JSON.parse(createInit.body as string);
    expect(body.summary).toBe("Test");
    expect(body.start.timeZone).toBe("Asia/Tehran");
    expect(body.status).toBe("confirmed");
  });

  it("cancels event via DELETE", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "tok" }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204 });

    const provider = new GoogleCalendarProvider(
      "cid",
      "secret",
      "refresh",
      "primary",
      "UTC",
      fetchMock,
    );

    await provider.cancelEvent("evt-1");
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(deleteInit.method).toBe("DELETE");
    expect(deleteUrl).toContain("/events/evt-1");
  });
});
