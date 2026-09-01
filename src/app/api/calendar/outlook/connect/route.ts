import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { audit } from "@/server/http";
import { publicOrigin } from "@/server/services/ics-feed.service";
import { connectMockOutlook } from "@/server/services/calendar-connection.service";
import {
  OUTLOOK_OAUTH_STATE_COOKIE,
  buildOutlookOAuthUrl,
  newOutlookOAuthState,
  outlookOAuthCallbackUrl,
  shouldUseRealOutlookOAuth,
} from "@/server/services/outlook-calendar-oauth";

export const dynamic = "force-dynamic";

function toLogin(origin: string) {
  return NextResponse.redirect(`${origin}/login?next=/profile`);
}

/** GET /api/calendar/outlook/connect — start Microsoft OAuth, or mock-connect in local/dev. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const user = await getSessionUser();
  if (!user) return toLogin(origin);

  if (!shouldUseRealOutlookOAuth()) {
    await connectMockOutlook(user.id, user.email);
    await audit({
      actorId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      newValue: { outlookCalendar: "connected-mock" },
      ip: req.headers.get("x-forwarded-for"),
    });
    return NextResponse.redirect(`${origin}/profile?outlook=connected`);
  }

  const state = newOutlookOAuthState();
  const url = buildOutlookOAuthUrl({
    clientId: process.env.OUTLOOK_CLIENT_ID!.trim(),
    redirectUri: outlookOAuthCallbackUrl(origin),
    state,
  });
  const res = NextResponse.redirect(url);
  res.cookies.set(OUTLOOK_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
