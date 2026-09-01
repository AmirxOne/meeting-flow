import { resolveOidcConfig } from "./oidc-config";
import { collectOidcGroupIds } from "./oidc-groups";

export interface OidcTokenSet {
  accessToken: string;
  idToken: string;
}

export interface OidcProfile {
  email: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  groups: string[];
}

interface TokenJson {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length < 2) throw new Error("invalid jwt");
  const pad = parts[1].length % 4 === 0 ? "" : "=".repeat(4 - (parts[1].length % 4));
  const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
  const payload = JSON.parse(json) as unknown;
  if (!payload || typeof payload !== "object") throw new Error("invalid jwt payload");
  return payload as Record<string, unknown>;
}

export function assertIdTokenClaims(
  claims: Record<string, unknown>,
  opts: { clientId: string; nonce: string; nowMs?: number },
): void {
  const now = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  if (claims.aud !== opts.clientId && !(Array.isArray(claims.aud) && claims.aud.includes(opts.clientId))) {
    throw new Error("id_token audience mismatch");
  }
  if (claims.nonce !== opts.nonce) {
    throw new Error("id_token nonce mismatch");
  }
  if (typeof claims.exp === "number" && claims.exp <= now) {
    throw new Error("id_token expired");
  }
  const iss = typeof claims.iss === "string" ? claims.iss : "";
  if (!iss.includes("login.microsoftonline.com") && !iss.includes("sts.windows.net")) {
    throw new Error("id_token issuer mismatch");
  }
}

export function profileFromIdToken(claims: Record<string, unknown>): Omit<OidcProfile, "groups"> {
  const emailRaw =
    (typeof claims.email === "string" && claims.email) ||
    (typeof claims.preferred_username === "string" && claims.preferred_username) ||
    (typeof claims.upn === "string" && claims.upn) ||
    "";
  const email = emailRaw.trim().toLowerCase();
  const fullName =
    (typeof claims.name === "string" && claims.name.trim()) ||
    [claims.given_name, claims.family_name]
      .filter((p) => typeof p === "string" && p.trim())
      .join(" ") ||
    email.split("@")[0] ||
    "کاربر سازمانی";
  return {
    email,
    fullName,
    jobTitle: typeof claims.jobTitle === "string" ? claims.jobTitle : null,
    department: typeof claims.department === "string" ? claims.department : null,
  };
}

export async function exchangeOidcAuthorizationCode(opts: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  fetchFn?: typeof fetch;
}): Promise<OidcTokenSet> {
  const cfg = resolveOidcConfig();
  const fetchFn = opts.fetchFn ?? fetch;
  const res = await fetchFn(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code: opts.code,
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
      code_verifier: opts.codeVerifier,
    }),
  });
  const data = (await res.json()) as TokenJson;
  if (!res.ok || !data.access_token || !data.id_token) {
    throw new Error(data.error_description ?? data.error ?? "token exchange failed");
  }
  return { accessToken: data.access_token, idToken: data.id_token };
}

export async function enrichProfileFromGraph(
  accessToken: string,
  base: OidcProfile,
  fetchFn: typeof fetch = fetch,
): Promise<OidcProfile> {
  let next = { ...base };
  try {
    const meRes = await fetchFn(
      "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName,jobTitle,department,givenName,surname",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (meRes.ok) {
      const me = (await meRes.json()) as Record<string, unknown>;
      const mail =
        (typeof me.mail === "string" && me.mail) ||
        (typeof me.userPrincipalName === "string" && me.userPrincipalName) ||
        "";
      if (!next.email && mail.includes("@")) next.email = mail.trim().toLowerCase();
      if (typeof me.displayName === "string" && me.displayName.trim()) next.fullName = me.displayName.trim();
      if (typeof me.jobTitle === "string" && me.jobTitle.trim()) next.jobTitle = me.jobTitle.trim();
      if (typeof me.department === "string" && me.department.trim()) next.department = me.department.trim();
    }
  } catch {
    /* claims-only is enough */
  }

  try {
    const gRes = await fetchFn(
      "https://graph.microsoft.com/v1.0/me/memberOf?$select=id,displayName",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (gRes.ok) {
      const body = (await gRes.json()) as Record<string, unknown>;
      const extra = collectOidcGroupIds(body);
      const seen = new Set(next.groups.map((g) => g.toLowerCase()));
      for (const g of extra) {
        if (!seen.has(g.toLowerCase())) {
          seen.add(g.toLowerCase());
          next.groups.push(g);
        }
      }
    }
  } catch {
    /* optional */
  }

  return next;
}

export function buildOidcProfileFromToken(idToken: string, nonce: string, clientId: string): OidcProfile {
  const claims = decodeJwtPayload(idToken);
  assertIdTokenClaims(claims, { clientId, nonce });
  const base = profileFromIdToken(claims);
  return {
    ...base,
    groups: collectOidcGroupIds(claims),
  };
}
