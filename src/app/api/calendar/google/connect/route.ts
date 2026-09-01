import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { audit } from "@/server/http";
import { publicOrigin } from "@/server/services/ics-feed.service";
import { connectMockCalendar } from "@/server/services/calendar-connection.service";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  buildGoogleOAuthUrl,
  googleOAuthCallbackUrl,
  newOAuthState,
  shouldUseRealGoogleOAuth,
} from "@/server/services/google-calendar-oauth";

export const dynamic = "force-dynamic";

function toLogin(origin: string) {
  return NextResponse.redirect(`${origin}/login?next=/profile`);
}

/** GET /api/calendar/google/connect — start OAuth, or mock-connect in local/dev. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const user = await getSessionUser();
  if (!user) return toLogin(origin);

  if (!shouldUseRealGoogleOAuth()) {
    await connectMockCalendar(user.id, user.email);
    await audit({
      actorId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      newValue: { googleCalendar: "connected-mock" },
      ip: req.headers.get("x-forwarded-for"),
    });
    return NextResponse.redirect(`${origin}/profile?google=connected`);
  }

  const state = newOAuthState();
  const url = buildGoogleOAuthUrl({
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID!.trim(),
    redirectUri: googleOAuthCallbackUrl(origin),
    state,
  });
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
