/** Auth mode and LDAP settings from environment. */

export type AuthMode = "local" | "ldap";

export interface LdapConfig {
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  userFilter: string;
  tlsRejectUnauthorized: boolean;
}

/** Parse AUTH_MODE. Defaults to local. */
export function parseAuthMode(raw?: string): AuthMode {
  const value = (raw ?? process.env.AUTH_MODE ?? "local").trim().toLowerCase();
  if (value === "ldap") return "ldap";
  return "local";
}

/** Whether LDAP login is enabled. */
export function isLdapAuthEnabled(): boolean {
  return parseAuthMode() === "ldap";
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
