import { NextRequest, NextResponse } from "next/server";
import { HttpError } from "@/server/auth/session";
import { handleError, audit } from "@/server/http";
import { publicOrigin } from "@/server/services/ics-feed.service";
import { redirectWithSession } from "@/server/auth/login-response";
import {
  SSO_NONCE_COOKIE,
  SSO_STATE_COOKIE,
  SSO_VERIFIER_COOKIE,
  oidcCredentialsConfigured,
  resolveOidcConfig,
  ssoCallbackUrl,
} from "@/server/auth/oidc-config";
import {
  buildOidcProfileFromToken,
  enrichProfileFromGraph,
  exchangeOidcAuthorizationCode,
} from "@/server/auth/oidc-client";
import { findOrProvisionSsoUser } from "@/server/auth/sso-user.service";
import { isSsoLoginEnabled, resolveSsoGroupRoleMap } from "@/server/auth/sso-settings.service";
import { prisma } from "@/server/db";
import { ORG_COOKIE, SAMPLE_ORG_ID } from "@/lib/org-slug";
import {
  createTwoFactorChallenge,
  userHasTwoFactor,
} from "@/server/services/two-factor.service";

export const dynamic = "force-dynamic";

function clearSsoCookies(res: NextResponse) {
  const gone = { httpOnly: true, path: "/", maxAge: 0 };
  res.cookies.set(SSO_STATE_COOKIE, "", gone);
  res.cookies.set(SSO_NONCE_COOKIE, "", gone);
  res.cookies.set(SSO_VERIFIER_COOKIE, "", gone);
}

function loginError(origin: string, code: string) {
  const res = NextResponse.redirect(`${origin}/login?sso=error&code=${encodeURIComponent(code)}`);
  clearSsoCookies(res);
  return res;
}

/** GET /api/auth/sso/callback — complete OIDC login, provision user, set session. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  try {
    if (!(await isSsoLoginEnabled()) || !oidcCredentialsConfigured()) {
      return loginError(origin, "not_configured");
    }

    const denied = req.nextUrl.searchParams.get("error");
    if (denied) {
      return loginError(origin, denied === "access_denied" ? "access_denied" : "token_failed");
    }

    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const expectedState = req.cookies.get(SSO_STATE_COOKIE)?.value;
    const nonce = req.cookies.get(SSO_NONCE_COOKIE)?.value;
    const verifier = req.cookies.get(SSO_VERIFIER_COOKIE)?.value;
    if (!code || !state || !expectedState || state !== expectedState || !nonce || !verifier) {
      return loginError(origin, "state_mismatch");
    }

    const cfg = resolveOidcConfig();
    const tokens = await exchangeOidcAuthorizationCode({
      code,
      redirectUri: ssoCallbackUrl(origin),
      codeVerifier: verifier,
    });
    let profile = buildOidcProfileFromToken(tokens.idToken, nonce, cfg.clientId);
    profile = await enrichProfileFromGraph(tokens.accessToken, profile);
    if (!profile.email.includes("@")) {
      return loginError(origin, "missing_email");
    }

    const slug = req.cookies.get(ORG_COOKIE)?.value;
    let provisionOrgId = SAMPLE_ORG_ID;
    if (slug) {
      const org = await prisma.organization.findUnique({
        where: { slug: slug.toLowerCase() },
        select: { id: true },
      });
      if (org) provisionOrgId = org.id;
    }
    const groupRoleMap = await resolveSsoGroupRoleMap(provisionOrgId);
    const user = await findOrProvisionSsoUser(profile, groupRoleMap, provisionOrgId);

    await audit({
      actorId: user.id,
      action: "LOGIN_SSO",
      entity: "User",
      entityId: user.id,
      newValue: { email: user.email, provider: "oidc" },
      ip: req.headers.get("x-forwarded-for"),
    });

    if (await userHasTwoFactor(user.id)) {
      const challengeToken = await createTwoFactorChallenge(user.id);
      const res = NextResponse.redirect(
        `${origin}/login?challenge=${encodeURIComponent(challengeToken)}`,
      );
      clearSsoCookies(res);
      return res;
    }

    const res = await redirectWithSession(user.id, `${origin}/dashboard`);
    clearSsoCookies(res);
    return res;
  } catch (e) {
    if (e instanceof HttpError && e.code === "ACCOUNT_DISABLED") {
      return loginError(origin, "account_disabled");
    }
    if (e instanceof HttpError) return handleError(e);
    console.error("[sso]", e);
    return loginError(origin, "token_failed");
  }
}
