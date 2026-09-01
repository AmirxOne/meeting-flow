import { NextRequest, NextResponse } from "next/server";
import { isSsoLoginEnabled } from "@/server/auth/sso-settings.service";
import {
  SSO_NONCE_COOKIE,
  SSO_STATE_COOKIE,
  SSO_VERIFIER_COOKIE,
  buildAzureAuthorizeUrl,
  newOidcState,
  newPkce,
  oidcCredentialsConfigured,
  resolveOidcConfig,
  ssoCallbackUrl,
  ssoCookieOptions,
} from "@/server/auth/oidc-config";
import { publicOrigin } from "@/server/services/ics-feed.service";

export const dynamic = "force-dynamic";

function loginError(origin: string, code: string) {
  return NextResponse.redirect(`${origin}/login?sso=error&code=${encodeURIComponent(code)}`);
}

/** GET /api/auth/sso/login — start Entra ID / OIDC authorization. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  if (!(await isSsoLoginEnabled()) || !oidcCredentialsConfigured()) {
    return loginError(origin, "not_configured");
  }

  let cfg;
  try {
    cfg = resolveOidcConfig();
  } catch {
    return loginError(origin, "not_configured");
  }

  const state = newOidcState();
  const nonce = newOidcState();
  const pkce = newPkce();
  const url = buildAzureAuthorizeUrl({
    authorizeUrl: cfg.authorizeUrl,
    clientId: cfg.clientId,
    redirectUri: ssoCallbackUrl(origin),
    state,
    nonce,
    scopes: cfg.scopes,
    codeChallenge: pkce.challenge,
  });

  const res = NextResponse.redirect(url);
  const cookies = ssoCookieOptions();
  res.cookies.set(SSO_STATE_COOKIE, state, cookies);
  res.cookies.set(SSO_NONCE_COOKIE, nonce, cookies);
  res.cookies.set(SSO_VERIFIER_COOKIE, pkce.verifier, cookies);
  return res;
}
