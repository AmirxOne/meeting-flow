import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  OutlookCalendarProvider,
  createCalendarProvider,
  toGraphDateTime,
  toOutlookEventBody,
} from "@/server/services/calendar-provider";
import {
  OUTLOOK_CALENDAR_SCOPES,
  buildOutlookOAuthUrl,
  outlookOAuthCallbackUrl,
  shouldUseRealOutlookOAuth,
} from "@/server/services/outlook-calendar-oauth";

const startAt = new Date("2030-06-01T10:00:00.000Z");
const endAt = new Date("2030-06-01T11:30:00.000Z");

describe("toOutlookEventBody", () => {
  it("maps title, Tehran TZ, attendees, and busy showAs", () => {
    const body = toOutlookEventBody(
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
    expect(body.subject).toBe("جلسه فروش");
    expect(body.body).toEqual({ contentType: "text", content: "دستور جلسه" });
    expect(body.location).toEqual({ displayName: "اتاق A — ونک" });
    expect(body.start.timeZone).toBe("Asia/Tehran");
    expect(body.end.timeZone).toBe("Asia/Tehran");
    expect(body.start.dateTime).toBe(toGraphDateTime(startAt, "Asia/Tehran"));
    expect(body.start.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(body.showAs).toBe("busy");
    expect(body.isCancelled).toBe(false);
    expect(body.attendees).toEqual([
      { emailAddress: { address: "ali@example.com" }, type: "required" },
      { emailAddress: { address: "sara@example.com" }, type: "required" },
    ]);
  });

  it("maps pending approval to tentative", () => {
    const body = toOutlookEventBody(
      { meetingId: "m1", title: "در انتظار", startAt, endAt, status: "tentative" },
      "Asia/Tehran",
    );
    expect(body.showAs).toBe("tentative");
    expect(body.isCancelled).toBe(false);
  });

  it("maps cancelled meetings", () => {
    const body = toOutlookEventBody(
      { meetingId: "m1", title: "لغو", startAt, endAt, status: "cancelled" },
      "UTC",
    );
    expect(body.showAs).toBe("free");
    expect(body.isCancelled).toBe(true);
    expect(body.start.timeZone).toBe("UTC");
  });

  it("omits attendees for a masked private meeting", () => {
    const body = toOutlookEventBody(
      { meetingId: "m1", title: "جلسه محرمانه", startAt, endAt, attendeeEmails: [] },
      "Asia/Tehran",
    );
    expect(body.subject).toBe("جلسه محرمانه");
    expect(body.attendees).toBeUndefined();
  });
});

describe("buildOutlookOAuthUrl", () => {
  it("requests Calendars.ReadWrite with offline_access", () => {
    const url = new URL(
      buildOutlookOAuthUrl({
        clientId: "app-id",
        redirectUri: "http://localhost:3100/api/calendar/outlook/callback",
        state: "xyz",
        tenant: "common",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("app-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("xyz");
    expect(url.searchParams.get("scope")).toBe(OUTLOOK_CALENDAR_SCOPES);
    expect(url.searchParams.get("scope")).toContain("Calendars.ReadWrite");
    expect(url.searchParams.get("scope")).toContain("offline_access");
  });
});

describe("outlookOAuthCallbackUrl", () => {
  it("appends the callback path", () => {
    expect(outlookOAuthCallbackUrl("http://localhost:3100")).toBe(
      "http://localhost:3100/api/calendar/outlook/callback",
    );
  });
});

describe("shouldUseRealOutlookOAuth", () => {
  it("is false without app credentials (mock connect path)", () => {
    const prevId = process.env.OUTLOOK_CLIENT_ID;
    const prevSecret = process.env.OUTLOOK_CLIENT_SECRET;
    delete process.env.OUTLOOK_CLIENT_ID;
    delete process.env.OUTLOOK_CLIENT_SECRET;
    expect(shouldUseRealOutlookOAuth()).toBe(false);
    process.env.OUTLOOK_CLIENT_ID = prevId;
    process.env.OUTLOOK_CLIENT_SECRET = prevSecret;
  });
});

describe("OutlookCalendarProvider (mocked Graph)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("refreshes token and POSTs a Graph event", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "graph-tok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "AAMkAG-outlook-1" }),
      });

    const provider = new OutlookCalendarProvider(
      "cid",
      "secret",
      "refresh",
      "calendar",
      "Asia/Tehran",
      "common",
      fetchMock,
    );

    const { externalEventId } = await provider.createEvent({
      meetingId: "m1",
      title: "جلسه",
      startAt,
      endAt,
      status: "confirmed",
      attendeeEmails: ["ali@example.com"],
    });

    expect(externalEventId).toBe("AAMkAG-outlook-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toContain("login.microsoftonline.com/common/oauth2/v2.0/token");
    expect(tokenInit.method).toBe("POST");

    const [eventUrl, eventInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(eventUrl).toBe("https://graph.microsoft.com/v1.0/me/events");
    expect(eventInit.method).toBe("POST");
    expect((eventInit.headers as Record<string, string>).Authorization).toBe("Bearer graph-tok");
    const body = JSON.parse(eventInit.body as string);
    expect(body.subject).toBe("جلسه");
    expect(body.showAs).toBe("busy");
    expect(body.start.timeZone).toBe("Asia/Tehran");
    expect(body.attendees[0].emailAddress.address).toBe("ali@example.com");
  });

  it("PATCHes an existing Graph event", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "graph-tok" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "evt-1" }) });

    const provider = new OutlookCalendarProvider(
      "cid",
      "secret",
      "refresh",
      "calendar",
      "UTC",
      "common",
      fetchMock,
    );

    await provider.updateEvent("evt-1", {
      meetingId: "m1",
      title: "جلسه ۲",
      startAt,
      endAt,
      status: "tentative",
    });

    const [patchUrl, patchInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(patchInit.method).toBe("PATCH");
    expect(patchUrl).toContain("/me/events/evt-1");
    const body = JSON.parse(patchInit.body as string);
    expect(body.subject).toBe("جلسه ۲");
    expect(body.showAs).toBe("tentative");
  });

  it("cancels via DELETE and ignores 404", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "graph-tok" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });

    const provider = new OutlookCalendarProvider(
      "cid",
      "secret",
      "refresh",
      "calendar",
      "UTC",
      "common",
      fetchMock,
    );

    await expect(provider.cancelEvent("gone")).resolves.toBeUndefined();
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(deleteInit.method).toBe("DELETE");
    expect(deleteUrl).toContain("/me/events/gone");
  });
});

describe("createCalendarProvider outlook factory", () => {
  it("mock outlook create/update/cancel without Graph", async () => {
    const p = createCalendarProvider({ provider: "outlook" });
    expect(p.name).toBe("outlook");
    const { externalEventId } = await p.createEvent({
      meetingId: "m1",
      title: "جلسه",
      startAt,
      endAt,
    });
    expect(externalEventId).toBe("outlook-m1");
    await p.updateEvent(externalEventId, { meetingId: "m1", title: "۲", startAt, endAt });
    await p.cancelEvent(externalEventId);
  });
});
