import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseCalendarProviderKind,
  createCalendarProvider,
  GoogleCalendarProvider,
  type CalendarProvider,
} from "@/server/services/calendar-provider";

describe("parseCalendarProviderKind", () => {
  it("defaults to mock", () => {
    expect(parseCalendarProviderKind(undefined)).toBe("mock");
    expect(parseCalendarProviderKind("")).toBe("mock");
  });

  it("recognizes google", () => {
    expect(parseCalendarProviderKind("google")).toBe("google");
    expect(parseCalendarProviderKind("GOOGLE")).toBe("google");
  });

  it("falls back for unknown", () => {
    expect(parseCalendarProviderKind("outlook")).toBe("mock");
  });
});

describe("createCalendarProvider", () => {
  it("returns mock by default", () => {
    expect(createCalendarProvider({ provider: "mock" }).name).toBe("mock");
  });

  it("requires Google OAuth env for google", () => {
    expect(() => createCalendarProvider({ provider: "google" })).toThrow(/GOOGLE_CALENDAR/);
  });

  it("creates google provider with credentials", () => {
    const p = createCalendarProvider({
      provider: "google",
      googleClientId: "cid",
      googleClientSecret: "secret",
      googleRefreshToken: "refresh",
      googleCalendarId: "primary",
    });
    expect(p.name).toBe("google");
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

  it("obtains token and creates calendar event", async () => {
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
    });

    expect(externalEventId).toBe("google-event-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, createInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((createInit.headers as Record<string, string>).Authorization).toMatch(/^Bearer /);
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
