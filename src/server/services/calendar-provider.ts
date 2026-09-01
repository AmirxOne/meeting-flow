/** Pluggable calendar providers — mock (dev) or Google Calendar (per-user OAuth). */

import { openSecret } from "@/server/crypto/secret-box";
import { MOCK_CALENDAR_REFRESH } from "./google-calendar-oauth";

export type CalendarProviderKind = "mock" | "google" | "outlook";

export interface CalendarEventPayload {
  meetingId: string;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  location?: string;
  attendeeEmails?: string[];
  /** tentative when meeting awaits approval */
  status?: "confirmed" | "tentative" | "cancelled";
}

export interface CalendarProvider {
  readonly name: string;
  createEvent(payload: CalendarEventPayload): Promise<{ externalEventId: string }>;
  updateEvent(externalEventId: string, payload: CalendarEventPayload): Promise<void>;
  cancelEvent(externalEventId: string): Promise<void>;
}

export interface CalendarProviderConfig {
  provider?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRefreshToken?: string;
  googleCalendarId?: string;
  outlookClientId?: string;
  outlookClientSecret?: string;
  outlookRefreshToken?: string;
  outlookTenant?: string;
  outlookCalendarId?: string;
  timezone?: string;
  fetchFn?: typeof fetch;
}

export interface CalendarConnectionInput {
  userId: string;
  provider: string;
  refreshTokenEnc: string;
  calendarId: string;
}

/** Parse CALENDAR_PROVIDER env. Unknown values fall back to mock. */
export function parseCalendarProviderKind(raw?: string): CalendarProviderKind {
  const value = (raw ?? process.env.CALENDAR_PROVIDER ?? "mock").trim().toLowerCase();
  if (value === "google") return "google";
  if (value === "outlook") return "outlook";
  return "mock";
}

export function calendarTimezone(config: CalendarProviderConfig = {}): string {
  return (
    config.timezone?.trim() ||
    process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() ||
    process.env.DISPLAY_TIMEZONE?.trim() ||
    "Asia/Tehran"
  );
}

/**
 * Map a Mehrsa meeting payload to Google Calendar API v3 event body.
 * Private/masked titles are applied by the caller before this mapping.
 */
export function toGoogleEventBody(payload: CalendarEventPayload, timezone: string) {
  const status =
    payload.status === "cancelled"
      ? "cancelled"
      : payload.status === "tentative"
        ? "tentative"
        : "confirmed";

  return {
    summary: payload.title,
    description: payload.description ?? undefined,
    location: payload.location,
    start: { dateTime: payload.startAt.toISOString(), timeZone: timezone },
    end: { dateTime: payload.endAt.toISOString(), timeZone: timezone },
    status,
    attendees: payload.attendeeEmails?.length
      ? payload.attendeeEmails.map((email) => ({ email }))
      : undefined,
  };
}

export class MockCalendarProvider implements CalendarProvider {
  readonly name: string;

  constructor(
    private readonly userId?: string,
    name: string = "mock",
  ) {
    this.name = name;
  }

  async createEvent(payload: CalendarEventPayload): Promise<{ externalEventId: string }> {
    const id = this.userId
      ? `${this.name}-${this.userId}-${payload.meetingId}`
      : `${this.name}-${payload.meetingId}`;
    console.log(
      `[calendar:${this.name}] create ${id} :: ${payload.title} @ ${payload.startAt.toISOString()}`,
    );
    return { externalEventId: id };
  }

  async updateEvent(externalEventId: string, payload: CalendarEventPayload): Promise<void> {
    console.log(
      `[calendar:${this.name}] update ${externalEventId} :: ${payload.title} @ ${payload.startAt.toISOString()}`,
    );
  }

  async cancelEvent(externalEventId: string): Promise<void> {
    console.log(`[calendar:${this.name}] cancel ${externalEventId}`);
  }
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/** Google Calendar API v3 via a per-user OAuth refresh token. */
export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = "google";

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string,
    private readonly calendarId: string,
    private readonly timezone: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async accessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: "refresh_token",
    });
    const res = await this.fetchFn("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as GoogleTokenResponse;
    if (!res.ok || !data.access_token) {
      throw new Error(
        `Google OAuth token error: ${data.error_description ?? data.error ?? res.status}`,
      );
    }
    return data.access_token;
  }

  async createEvent(payload: CalendarEventPayload): Promise<{ externalEventId: string }> {
    const token = await this.accessToken();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events`;
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toGoogleEventBody(payload, this.timezone)),
    });
    const data = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !data.id) {
      throw new Error(`Google Calendar create failed: ${data.error?.message ?? res.status}`);
    }
    return { externalEventId: data.id };
  }

  async updateEvent(externalEventId: string, payload: CalendarEventPayload): Promise<void> {
    const token = await this.accessToken();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(externalEventId)}`;
    const res = await this.fetchFn(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toGoogleEventBody(payload, this.timezone)),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: { message?: string } };
      throw new Error(`Google Calendar update failed: ${data.error?.message ?? res.status}`);
    }
  }

  async cancelEvent(externalEventId: string): Promise<void> {
    const token = await this.accessToken();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(externalEventId)}`;
    const res = await this.fetchFn(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(`Google Calendar cancel failed: ${data.error?.message ?? res.status}`);
    }
  }
}

/** Local wall time in `timeZone` as Graph `dateTime` (no offset). */
export function toGraphDateTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const g = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}`;
}

/**
 * Map a Mehrsa meeting payload to Microsoft Graph event body.
 * Private/masked titles are applied by the caller before this mapping.
 */
export function toOutlookEventBody(payload: CalendarEventPayload, timezone: string) {
  const showAs =
    payload.status === "cancelled"
      ? "free"
      : payload.status === "tentative"
        ? "tentative"
        : "busy";

  return {
    subject: payload.title,
    body: payload.description
      ? { contentType: "text" as const, content: payload.description }
      : undefined,
    location: payload.location ? { displayName: payload.location } : undefined,
    start: { dateTime: toGraphDateTime(payload.startAt, timezone), timeZone: timezone },
    end: { dateTime: toGraphDateTime(payload.endAt, timezone), timeZone: timezone },
    showAs,
    isCancelled: payload.status === "cancelled",
    attendees: payload.attendeeEmails?.length
      ? payload.attendeeEmails.map((address) => ({
          emailAddress: { address },
          type: "required" as const,
        }))
      : undefined,
  };
}

function outlookEventsUrl(calendarId: string): string {
  if (!calendarId || calendarId === "primary" || calendarId === "calendar") {
    return "https://graph.microsoft.com/v1.0/me/events";
  }
  return `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events`;
}

interface OutlookTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/** Microsoft Graph calendar via a per-user OAuth refresh token. */
export class OutlookCalendarProvider implements CalendarProvider {
  readonly name = "outlook";

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string,
    private readonly calendarId: string,
    private readonly timezone: string,
    private readonly tenant: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async accessToken(): Promise<string> {
    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(this.tenant)}/oauth2/v2.0/token`;
    const res = await this.fetchFn(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
        scope: "offline_access Calendars.ReadWrite User.Read",
      }),
    });
    const data = (await res.json()) as OutlookTokenResponse;
    if (!res.ok || !data.access_token) {
      throw new Error(
        `Outlook OAuth token error: ${data.error_description ?? data.error ?? res.status}`,
      );
    }
    return data.access_token;
  }

  async createEvent(payload: CalendarEventPayload): Promise<{ externalEventId: string }> {
    const token = await this.accessToken();
    const res = await this.fetchFn(outlookEventsUrl(this.calendarId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toOutlookEventBody(payload, this.timezone)),
    });
    const data = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !data.id) {
      throw new Error(`Outlook create failed: ${data.error?.message ?? res.status}`);
    }
    return { externalEventId: data.id };
  }

  async updateEvent(externalEventId: string, payload: CalendarEventPayload): Promise<void> {
    const token = await this.accessToken();
    const url = `${outlookEventsUrl(this.calendarId)}/${encodeURIComponent(externalEventId)}`;
    const res = await this.fetchFn(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toOutlookEventBody(payload, this.timezone)),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: { message?: string } };
      throw new Error(`Outlook update failed: ${data.error?.message ?? res.status}`);
    }
  }

  async cancelEvent(externalEventId: string): Promise<void> {
    const token = await this.accessToken();
    const url = `${outlookEventsUrl(this.calendarId)}/${encodeURIComponent(externalEventId)}`;
    const res = await this.fetchFn(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(`Outlook cancel failed: ${data.error?.message ?? res.status}`);
    }
  }
}

/**
 * Factory — reads env unless config overrides are passed (tests).
 * Missing Google credentials fall back to mock so meeting create never throws.
 * Per-user refresh tokens live in the DB; do not read a global env refresh token.
 */
export function createCalendarProvider(config: CalendarProviderConfig = {}): CalendarProvider {
  const kind = parseCalendarProviderKind(config.provider);

  if (kind === "google") {
    const clientId =
      config.googleClientId?.trim() || process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
    const clientSecret =
      config.googleClientSecret?.trim() || process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
    const refreshToken = config.googleRefreshToken?.trim();
    const calendarId =
      config.googleCalendarId?.trim() ||
      process.env.GOOGLE_CALENDAR_ID?.trim() ||
      "primary";

    if (!clientId || !clientSecret || !refreshToken) {
      return new MockCalendarProvider();
    }

    return new GoogleCalendarProvider(
      clientId,
      clientSecret,
      refreshToken,
      calendarId,
      calendarTimezone(config),
      config.fetchFn ?? fetch,
    );
  }

  if (kind === "outlook") {
    const clientId =
      config.outlookClientId?.trim() || process.env.OUTLOOK_CLIENT_ID?.trim();
    const clientSecret =
      config.outlookClientSecret?.trim() || process.env.OUTLOOK_CLIENT_SECRET?.trim();
    const refreshToken = config.outlookRefreshToken?.trim();
    const calendarId =
      config.outlookCalendarId?.trim() ||
      process.env.OUTLOOK_CALENDAR_ID?.trim() ||
      "calendar";
    const tenant = config.outlookTenant?.trim() || process.env.OUTLOOK_TENANT?.trim() || "common";

    if (!clientId || !clientSecret || !refreshToken) {
      return new MockCalendarProvider(undefined, "outlook");
    }

    return new OutlookCalendarProvider(
      clientId,
      clientSecret,
      refreshToken,
      calendarId,
      calendarTimezone(config),
      tenant,
      config.fetchFn ?? fetch,
    );
  }

  return new MockCalendarProvider();
}

/** Build a provider for one user's stored connection, or null if it cannot be used. */
export function createCalendarProviderForConnection(
  conn: CalendarConnectionInput,
  config: CalendarProviderConfig = {},
): CalendarProvider | null {
  if (conn.provider === "mock") {
    return new MockCalendarProvider(conn.userId);
  }

  let refresh: string;
  try {
    refresh = openSecret(conn.refreshTokenEnc);
  } catch {
    return null;
  }

  if (!refresh || refresh === MOCK_CALENDAR_REFRESH) {
    const name = conn.provider === "outlook" ? "outlook" : "mock";
    return new MockCalendarProvider(conn.userId, name);
  }

  if (conn.provider === "outlook") {
    const clientId =
      config.outlookClientId?.trim() || process.env.OUTLOOK_CLIENT_ID?.trim();
    const clientSecret =
      config.outlookClientSecret?.trim() || process.env.OUTLOOK_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return null;
    }
    const tenant = config.outlookTenant?.trim() || process.env.OUTLOOK_TENANT?.trim() || "common";
    return new OutlookCalendarProvider(
      clientId,
      clientSecret,
      refresh,
      conn.calendarId?.trim() || "calendar",
      calendarTimezone(config),
      tenant,
      config.fetchFn ?? fetch,
    );
  }

  const clientId =
    config.googleClientId?.trim() || process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret =
    config.googleClientSecret?.trim() || process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }

  return new GoogleCalendarProvider(
    clientId,
    clientSecret,
    refresh,
    conn.calendarId?.trim() || "primary",
    calendarTimezone(config),
    config.fetchFn ?? fetch,
  );
}
