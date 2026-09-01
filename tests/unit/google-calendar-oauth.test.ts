import { describe, expect, it } from "vitest";
import {
  GOOGLE_CALENDAR_SCOPES,
  buildGoogleOAuthUrl,
  googleOAuthCallbackUrl,
  shouldUseRealGoogleOAuth,
} from "@/server/services/google-calendar-oauth";

describe("buildGoogleOAuthUrl", () => {
  it("requests offline calendar.events access with consent prompt", () => {
    const url = new URL(
      buildGoogleOAuthUrl({
        clientId: "cid.apps.googleusercontent.com",
        redirectUri: "http://localhost:3100/api/calendar/google/callback",
        state: "abc123",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("cid.apps.googleusercontent.com");
    expect(url.searchParams.get("redirect_uri")).toContain("/api/calendar/google/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("abc123");
    expect(url.searchParams.get("scope")).toContain("calendar.events");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_CALENDAR_SCOPES);
  });
});

describe("googleOAuthCallbackUrl", () => {
  it("appends the callback path", () => {
    expect(googleOAuthCallbackUrl("http://localhost:3100")).toBe(
      "http://localhost:3100/api/calendar/google/callback",
    );
  });
});

describe("shouldUseRealGoogleOAuth", () => {
  it("is false without app credentials (E2E mock path)", () => {
    const prevProvider = process.env.CALENDAR_PROVIDER;
    const prevId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    process.env.CALENDAR_PROVIDER = "mock";
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    expect(shouldUseRealGoogleOAuth()).toBe(false);
    process.env.CALENDAR_PROVIDER = prevProvider;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = prevId;
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = prevSecret;
  });
});
