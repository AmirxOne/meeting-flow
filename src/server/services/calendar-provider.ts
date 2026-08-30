/** Pluggable calendar providers — mock (dev) or Google Calendar (OAuth refresh token). */

export type CalendarProviderKind = "mock" | "google";

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
  timezone?: string;
  fetchFn?: typeof fetch;
}

/** Parse CALENDAR_PROVIDER env. Unknown values fall back to mock. */
export function parseCalendarProviderKind(raw?: string): CalendarProviderKind {
  const value = (raw ?? process.env.CALENDAR_PROVIDER ?? "mock").trim().toLowerCase();
  if (value === "google") return "google";
  return "mock";
}

class MockCalendarProvider implements CalendarProvider {
  readonly name = "mock";

  async createEvent(payload: CalendarEventPayload): Promise<{ externalEventId: string }> {
    const id = `mock-${payload.meetingId}`;
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

/** Google Calendar API v3 via OAuth refresh token (no UI — env only). */
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

  private toGoogleBody(payload: CalendarEventPayload) {
    return {
      summary: payload.title,
      description: payload.description ?? undefined,
      location: payload.location,
      start: { dateTime: payload.startAt.toISOString(), timeZone: this.timezone },
      end: { dateTime: payload.endAt.toISOString(), timeZone: this.timezone },
      status: payload.status === "cancelled" ? "cancelled" : undefined,
      ...(payload.status === "tentative" ? { transparency: "opaque" } : {}),
      attendees: payload.attendeeEmails?.map((email) => ({ email })),
    };
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
      body: JSON.stringify(this.toGoogleBody(payload)),
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
      body: JSON.stringify(this.toGoogleBody(payload)),
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

/** Factory — reads env unless config overrides are passed (tests). */
export function createCalendarProvider(config: CalendarProviderConfig = {}): CalendarProvider {
  const kind = parseCalendarProviderKind(config.provider);

  if (kind === "google") {
    const clientId =
      config.googleClientId?.trim() || process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
    const clientSecret =
      config.googleClientSecret?.trim() || process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
    const refreshToken =
      config.googleRefreshToken?.trim() || process.env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim();
    const calendarId =
      config.googleCalendarId?.trim() ||
      process.env.GOOGLE_CALENDAR_ID?.trim() ||
      "primary";
    const timezone =
      config.timezone?.trim() ||
      process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() ||
      process.env.DISPLAY_TIMEZONE?.trim() ||
      "Asia/Tehran";

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        "GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, and GOOGLE_CALENDAR_REFRESH_TOKEN are required when CALENDAR_PROVIDER=google",
      );
    }

    return new GoogleCalendarProvider(
      clientId,
      clientSecret,
      refreshToken,
      calendarId,
      timezone,
      config.fetchFn ?? fetch,
    );
  }

  return new MockCalendarProvider();
}
