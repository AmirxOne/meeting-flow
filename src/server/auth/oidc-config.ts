import { createHash, randomBytes } from "node:crypto";
import { parseGroupRoleMap, type GroupRoleMap } from "./oidc-groups";

export const SSO_STATE_COOKIE = "mh_sso_state";
export const SSO_NONCE_COOKIE = "mh_sso_nonce";
export const SSO_VERIFIER_COOKIE = "mh_sso_verifier";
export const SSO_COOKIE_MAX_AGE = 600;

export const DEFAULT_SSO_BUTTON_LABEL = "ورود با حساب سازمانی";

export interface OidcRuntimeConfig {
  tenant: string;
  clientId: string;
  clientSecret: string;
  issuer: string;
  authorizeUrl: string;
  tokenUrl: string;
  graphMeUrl: string;
  graphMemberOfUrl: string;
  scopes: string;
  buttonLabel: string;
  groupRoleMap: GroupRoleMap;
}

export function oidcCredentialsConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.OIDC_CLIENT_ID?.trim() && env.OIDC_CLIENT_SECRET?.trim());
}

export function azureTenant(env: Record<string, string | undefined> = process.env): string {
  return env.OIDC_TENANT?.trim() || "organizations";
}

export function resolveOidcConfig(
  env: Record<string, string | undefined> = process.env,
): OidcRuntimeConfig {
  const clientId = env.OIDC_CLIENT_ID?.trim();
  const clientSecret = env.OIDC_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("OIDC_CLIENT_ID and OIDC_CLIENT_SECRET are required for SSO");
  }

  const tenant = azureTenant(env);
  const issuer =
    env.OIDC_ISSUER?.trim() || `https://login.microsoftonline.com/${tenant}/v2.0`;
  const authorizeUrl =
    env.OIDC_AUTHORIZE_URL?.trim() ||
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`;
  const tokenUrl =
    env.OIDC_TOKEN_URL?.trim() ||
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;

  return {
    tenant,
    clientId,
    clientSecret,
    issuer,
    authorizeUrl,
    tokenUrl,
    graphMeUrl: "https://graph.microsoft.com/v1.0/me",
    graphMemberOfUrl: "https://graph.microsoft.com/v1.0/me/memberOf",
    scopes: env.OIDC_SCOPES?.trim() || "openid profile email User.Read",
    buttonLabel: env.OIDC_BUTTON_LABEL?.trim() || DEFAULT_SSO_BUTTON_LABEL,
    groupRoleMap: parseGroupRoleMap(env.OIDC_GROUP_ROLE_MAP),
  };
}

export function ssoCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/auth/sso/callback`;
}

export function newOidcState(): string {
  return randomBytes(24).toString("hex");
}

export function newPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function ssoCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SSO_COOKIE_MAX_AGE,
  };
}

export function buildAzureAuthorizeUrl(opts: {
  authorizeUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  scopes: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: opts.scopes,
    state: opts.state,
    nonce: opts.nonce,
    prompt: "select_account",
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${opts.authorizeUrl}?${params.toString()}`;
}
