/**
 * Map IdP groups / app roles to Mehrsa role keys.
 * Pure helpers — unit-tested, no DB.
 */

export type GroupRoleMap = Record<string, string>;

const FALLBACK_ROLE = "EMPLOYEE";

/** Parse `guid:ADMIN,HR Managers:BRANCH_MANAGER` or a JSON object. */
export function parseGroupRoleMap(raw?: string | null): GroupRoleMap {
  if (!raw?.trim()) return {};
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as unknown;
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
      const out: GroupRoleMap = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (!k.trim() || typeof v !== "string" || !v.trim()) continue;
        out[k.trim()] = v.trim();
      }
      return out;
    } catch {
      return {};
    }
  }

  const out: GroupRoleMap = {};
  for (const part of trimmed.split(",")) {
    const piece = part.trim();
    if (!piece) continue;
    const colon = piece.lastIndexOf(":");
    if (colon <= 0 || colon === piece.length - 1) continue;
    const group = piece.slice(0, colon).trim();
    const role = piece.slice(colon + 1).trim();
    if (group && role) out[group] = role;
  }
  return out;
}

export function normalizeGroupRoleMap(map: GroupRoleMap): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(map)) {
    const group = k.trim().toLowerCase();
    const role = v.trim();
    if (group && role) out.set(group, role);
  }
  return out;
}

/**
 * Collect directory group ids / names from an OIDC id_token (or Graph payload).
 * Azure: `groups` (object ids), `roles` (app roles). Graph memberOf: `{id, displayName}`.
 */
export function collectOidcGroupIds(claims: Record<string, unknown>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    const v = value.trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };

  const walk = (value: unknown) => {
    if (typeof value === "string") {
      push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value && typeof value === "object") {
      const rec = value as Record<string, unknown>;
      if (typeof rec.id === "string") push(rec.id);
      if (typeof rec.displayName === "string") push(rec.displayName);
    }
  };

  walk(claims.groups);
  walk(claims.roles);
  walk(claims.value); // Graph `{ value: [...] }`
  return out;
}

/**
 * Map IdP groups to Mehrsa role keys.
 * Unknown groups are ignored. If nothing matches, return `fallback` (default EMPLOYEE)
 * unless `fallback` is null — then return [].
 */
export function mapDirectoryGroupsToRoleKeys(opts: {
  groups: string[];
  mapping: GroupRoleMap;
  fallback?: string | null;
}): string[] {
  const table = normalizeGroupRoleMap(opts.mapping);
  const roles = new Set<string>();
  for (const group of opts.groups) {
    const role = table.get(group.trim().toLowerCase());
    if (role) roles.add(role);
  }
  if (roles.size > 0) return [...roles];
  if (opts.fallback === null) return [];
  return [opts.fallback ?? FALLBACK_ROLE];
}

export function rowsToGroupRoleMap(rows: Array<{ group: string; roleKey: string }>): GroupRoleMap {
  const out: GroupRoleMap = {};
  for (const row of rows) {
    const group = row.group.trim();
    const roleKey = row.roleKey.trim();
    if (group && roleKey) out[group] = roleKey;
  }
  return out;
}

export function groupRoleMapToRows(map: GroupRoleMap): Array<{ group: string; roleKey: string }> {
  return Object.entries(map)
    .filter(([g, r]) => g.trim() && r.trim())
    .map(([group, roleKey]) => ({ group, roleKey }));
}
