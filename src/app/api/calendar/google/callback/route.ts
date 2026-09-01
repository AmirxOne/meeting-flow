import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { audit } from "@/server/http";
import { publicOrigin } from "@/server/services/ics-feed.service";
import { upsertCalendarConnection } from "@/server/services/calendar-connection.service";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  exchangeGoogleAuthorizationCode,
  fetchGoogleAccountEmail,
  googleOAuthCallbackUrl,
} from "@/server/services/google-calendar-oauth";

export const dynamic = "force-dynamic";

function fail(origin: string) {
  const res = NextResponse.redirect(`${origin}/profile?google=error`);
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

function ok(origin: string) {
  const res = NextResponse.redirect(`${origin}/profile?google=connected`);
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

/** GET /api/calendar/google/callback — OAuth redirect from Google. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?next=/profile`);
  }

  const error = req.nextUrl.searchParams.get("error");
  if (error) return fail(origin);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail(origin);
  }

  try {
    const redirectUri = googleOAuthCallbackUrl(origin);
    const tokens = await exchangeGoogleAuthorizationCode(code, redirectUri);
    const accountEmail = await fetchGoogleAccountEmail(tokens.accessToken);
    await upsertCalendarConnection({
      userId: user.id,
      provider: "google",
      refreshToken: tokens.refreshToken,
      accountEmail,
    });
    await audit({
      actorId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      newValue: { googleCalendar: "connected" },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok(origin);
  } catch (e) {
    console.error("[google-oauth] callback failed", e);
    return fail(origin);
  }
}
