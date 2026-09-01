import { randomBytes } from "node:crypto";

export const OUTLOOK_OAUTH_STATE_COOKIE = "mh_outlook_oauth";

export const OUTLOOK_CALENDAR_SCOPES = [
  "offline_access",
  "Calendars.ReadWrite",
  "User.Read",
].join(" ");

export function outlookTenant(): string {
  return process.env.OUTLOOK_TENANT?.trim() || "common";
}

export function outlookOAuthAppConfigured(): boolean {
  return Boolean(
    process.env.OUTLOOK_CLIENT_ID?.trim() && process.env.OUTLOOK_CLIENT_SECRET?.trim(),
  );
}

/** Real Microsoft consent when app credentials are set — independent of Google. */
export function shouldUseRealOutlookOAuth(): boolean {
  return outlookOAuthAppConfigured();
}

export function outlookOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/calendar/outlook/callback`;
}

export function newOutlookOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export function buildOutlookOAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  tenant?: string;
}): string {
  const tenant = opts.tenant?.trim() || outlookTenant();
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: OUTLOOK_CALENDAR_SCOPES,
    state: opts.state,
  });
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${params.toString()}`;
}

export function outlookTokenUrl(tenant = outlookTenant()): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}

interface OutlookTokenJson {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeOutlookAuthorizationCode(
  code: string,
  redirectUri: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ accessToken: string; refreshToken: string }> {
  const clientId = process.env.OUTLOOK_CLIENT_ID?.trim();
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Outlook OAuth app is not configured");
  }

  const res = await fetchFn(outlookTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: OUTLOOK_CALENDAR_SCOPES,
    }),
  });
  const data = (await res.json()) as OutlookTokenJson;
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "token exchange failed");
  }
  if (!data.refresh_token) {
    throw new Error("no_refresh_token");
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export async function fetchOutlookAccountEmail(
  accessToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  const res = await fetchFn("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return data.mail?.trim() || data.userPrincipalName?.trim() || null;
}
