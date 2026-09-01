import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { audit } from "@/server/http";
import { publicOrigin } from "@/server/services/ics-feed.service";
import { upsertCalendarConnection } from "@/server/services/calendar-connection.service";
import {
  OUTLOOK_OAUTH_STATE_COOKIE,
  exchangeOutlookAuthorizationCode,
  fetchOutlookAccountEmail,
  outlookOAuthCallbackUrl,
} from "@/server/services/outlook-calendar-oauth";

export const dynamic = "force-dynamic";

function fail(origin: string) {
  const res = NextResponse.redirect(`${origin}/profile?outlook=error`);
  res.cookies.set(OUTLOOK_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

function succeed(origin: string) {
  const res = NextResponse.redirect(`${origin}/profile?outlook=connected`);
  res.cookies.set(OUTLOOK_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

/** GET /api/calendar/outlook/callback — OAuth redirect from Microsoft. */
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
  const cookieState = req.cookies.get(OUTLOOK_OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail(origin);
  }

  try {
    const redirectUri = outlookOAuthCallbackUrl(origin);
    const tokens = await exchangeOutlookAuthorizationCode(code, redirectUri);
    const accountEmail = await fetchOutlookAccountEmail(tokens.accessToken);
    await upsertCalendarConnection({
      userId: user.id,
      provider: "outlook",
      refreshToken: tokens.refreshToken,
      accountEmail,
      calendarId: "calendar",
    });
    await audit({
      actorId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      newValue: { outlookCalendar: "connected" },
      ip: req.headers.get("x-forwarded-for"),
    });
    return succeed(origin);
  } catch (e) {
    console.error("[outlook-oauth] callback failed", e);
    return fail(origin);
  }
}
