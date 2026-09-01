import { randomBytes } from "node:crypto";

/** Sentinel stored (encrypted) when the user connected in mock mode — not a real Google token. */
export const MOCK_CALENDAR_REFRESH = "mock";

export const GOOGLE_OAUTH_STATE_COOKIE = "mh_gcal_oauth";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function googleOAuthAppConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim(),
  );
}

/** Real Google consent only when the app credentials are set and the provider is google. */
export function shouldUseRealGoogleOAuth(): boolean {
  const kind = (process.env.CALENDAR_PROVIDER ?? "mock").trim().toLowerCase();
  return kind === "google" && googleOAuthAppConfigured();
}

export function googleOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/calendar/google/callback`;
}

export function newOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export function buildGoogleOAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenJson {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeGoogleAuthorizationCode(
  code: string,
  redirectUri: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ accessToken: string; refreshToken: string }> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth app is not configured");
  }

  const res = await fetchFn("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as GoogleTokenJson;
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "token exchange failed");
  }
  if (!data.refresh_token) {
    throw new Error("no_refresh_token");
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export async function fetchGoogleAccountEmail(
  accessToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  const res = await fetchFn("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email?.trim() || null;
}
