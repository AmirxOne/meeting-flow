/** Auth mode and LDAP settings from environment. */

export type AuthMethod = "local" | "ldap" | "sso";
export type AuthMode = AuthMethod;

const AUTH_METHODS = new Set<AuthMethod>(["local", "ldap", "sso"]);

export interface LdapConfig {
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  userFilter: string;
  tlsRejectUnauthorized: boolean;
}

/** Parse AUTH_MODE as a set. Supports `local`, `ldap`, `sso`, and combinations like `local,sso` or `local+sso`. */
export function parseAuthMethods(raw?: string): Set<AuthMethod> {
  const value = (raw ?? process.env.AUTH_MODE ?? "local").trim().toLowerCase();
  if (!value) return new Set<AuthMethod>(["local"]);
  const methods = new Set<AuthMethod>();
  for (const part of value.split(/[,+\s|]+/)) {
    const token = part.trim();
    if (AUTH_METHODS.has(token as AuthMethod)) methods.add(token as AuthMethod);
  }
  if (methods.size === 0) methods.add("local");
  return methods;
}

/**
 * Primary password-path mode for callers that still expect a single value.
 * `local,sso` → local; `ldap,sso` → ldap; `sso` → sso.
 */
export function parseAuthMode(raw?: string): AuthMode {
  const methods = parseAuthMethods(raw);
  if (methods.has("ldap")) return "ldap";
  if (methods.has("local")) return "local";
  if (methods.has("sso")) return "sso";
  return "local";
}

export function isLdapAuthEnabled(raw?: string): boolean {
  return parseAuthMethods(raw).has("ldap");
}

export function isLocalAuthEnabled(raw?: string): boolean {
  return parseAuthMethods(raw).has("local");
}

/** AUTH_MODE includes sso — credentials/policy still required to show the button. */
export function isSsoMethodEnabled(raw?: string): boolean {
  return parseAuthMethods(raw).has("sso");
}

/** Password / LDAP bind form is available. */
export function isPasswordLoginEnabled(raw?: string): boolean {
  const methods = parseAuthMethods(raw);
  return methods.has("local") || methods.has("ldap");
}

/** LDAP connection settings — throws if required vars missing when mode is ldap. */
export function resolveLdapConfig(
  env: Record<string, string | undefined> = process.env,
): LdapConfig {
  const url = env.LDAP_URL?.trim();
  const baseDn = env.LDAP_BASE_DN?.trim();
  const bindDn = env.LDAP_BIND_DN?.trim();
  const bindPassword = env.LDAP_BIND_PASSWORD ?? "";

  if (!url || !baseDn || !bindDn) {
    throw new Error("LDAP_URL, LDAP_BASE_DN, and LDAP_BIND_DN are required when AUTH_MODE=ldap");
  }

  const userFilter =
    env.LDAP_USER_FILTER?.trim() || "(mail={{email}})";

  const tlsRejectUnauthorized =
    env.LDAP_TLS_REJECT_UNAUTHORIZED?.trim().toLowerCase() !== "false";

  return { url, baseDn, bindDn, bindPassword, userFilter, tlsRejectUnauthorized };
}

/** Escape value for LDAP filter interpolation. */
export function escapeLdapFilter(value: string): string {
  return value.replace(/[\0()*\\]/g, (ch) => {
    const hex = ch.charCodeAt(0).toString(16).padStart(2, "0");
    return `\\${hex}`;
  });
}

/** Build search filter from template with {{email}} placeholder. */
export function buildLdapUserFilter(template: string, email: string): string {
  return template.replace(/\{\{email\}\}/g, escapeLdapFilter(email.toLowerCase()));
}
