import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import {
  DEFAULT_SSO_BUTTON_LABEL,
  azureTenant,
  oidcCredentialsConfigured,
  resolveOidcConfig,
} from "./oidc-config";
import { isSsoMethodEnabled } from "./auth-config";
import {
  groupRoleMapToRows,
  parseGroupRoleMap,
  rowsToGroupRoleMap,
  type GroupRoleMap,
} from "./oidc-groups";

const KEY_ENABLED = "ssoEnabled";
const KEY_LABEL = "ssoButtonLabel";
const KEY_MAP = "ssoGroupRoleMap";

export interface SsoPolicy {
  enabled: boolean;
  buttonLabel: string;
  groupRoleMap: GroupRoleMap;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return fallback;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asMap(value: unknown): GroupRoleMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: GroupRoleMap = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k.trim() && typeof v === "string" && v.trim()) out[k.trim()] = v.trim();
  }
  return out;
}

export async function loadSsoPolicy(orgId?: string): Promise<SsoPolicy> {
  const envLabel = process.env.OIDC_BUTTON_LABEL?.trim() || DEFAULT_SSO_BUTTON_LABEL;
  const envMap = parseGroupRoleMap(process.env.OIDC_GROUP_ROLE_MAP);
  const org = orgId
    ? await prisma.organization.findUnique({
        where: { id: orgId },
        include: { policies: { where: { key: { in: [KEY_ENABLED, KEY_LABEL, KEY_MAP] } } } },
      })
    : await prisma.organization.findFirst({
        include: { policies: { where: { key: { in: [KEY_ENABLED, KEY_LABEL, KEY_MAP] } } } },
      });
  const byKey = new Map((org?.policies ?? []).map((p) => [p.key, p.value]));
  const hasMapRow = byKey.has(KEY_MAP);
  const policyMap = asMap(byKey.get(KEY_MAP));
  return {
    enabled: asBoolean(byKey.get(KEY_ENABLED), true),
    buttonLabel: asString(byKey.get(KEY_LABEL)) ?? envLabel,
    groupRoleMap: hasMapRow ? policyMap : envMap,
  };
}

export async function isSsoLoginEnabled(orgId?: string): Promise<boolean> {
  if (!isSsoMethodEnabled()) return false;
  if (!oidcCredentialsConfigured()) return false;
  const policy = await loadSsoPolicy(orgId);
  return policy.enabled;
}

export async function resolveSsoGroupRoleMap(orgId?: string): Promise<GroupRoleMap> {
  const policy = await loadSsoPolicy(orgId);
  return policy.groupRoleMap;
}

async function upsertPolicy(orgId: string, key: string, value: unknown, actorId: string) {
  const json = value as Prisma.InputJsonValue;
  await prisma.meetingPolicy.upsert({
    where: { orgId_key: { orgId, key } },
    update: { value: json, updatedBy: actorId },
    create: { orgId, key, value: json, updatedBy: actorId },
  });
}

export async function updateSsoPolicy(
  actorId: string,
  input: { enabled?: boolean; buttonLabel?: string; groupRoleMap?: Array<{ group: string; roleKey: string }> },
  orgId?: string,
): Promise<SsoPolicy> {
  const org = orgId
    ? await prisma.organization.findUnique({ where: { id: orgId } })
    : await prisma.organization.findFirst();
  if (!org) {
    return loadSsoPolicy(orgId);
  }
  if (input.enabled !== undefined) {
    await upsertPolicy(org.id, KEY_ENABLED, input.enabled, actorId);
  }
  if (input.buttonLabel !== undefined) {
    await upsertPolicy(org.id, KEY_LABEL, input.buttonLabel, actorId);
  }
  if (input.groupRoleMap !== undefined) {
    await upsertPolicy(org.id, KEY_MAP, rowsToGroupRoleMap(input.groupRoleMap), actorId);
  }
  return loadSsoPolicy(org.id);
}

export async function getSsoAdminStatus(origin: string, orgId?: string) {
  const configured = oidcCredentialsConfigured();
  let tenant: string | null = null;
  let clientIdHint: string | null = null;
  let issuer: string | null = null;
  let envMap: GroupRoleMap = {};
  if (configured) {
    try {
      const cfg = resolveOidcConfig();
      tenant = cfg.tenant;
      clientIdHint = `${cfg.clientId.slice(0, 6)}…${cfg.clientId.slice(-4)}`;
      issuer = cfg.issuer;
      envMap = cfg.groupRoleMap;
    } catch {
      tenant = azureTenant();
    }
  }
  const policy = await loadSsoPolicy(orgId);
  const roles = await prisma.role.findMany({
    select: { key: true, name: true },
    orderBy: { name: "asc" },
  });
  return {
    authModeHasSso: isSsoMethodEnabled(),
    credentialsConfigured: configured,
    tenant,
    clientIdHint,
    issuer,
    callbackUrl: `${origin.replace(/\/$/, "")}/api/auth/sso/callback`,
    enabled: policy.enabled,
    buttonLabel: policy.buttonLabel,
    groupRoleMap: groupRoleMapToRows(policy.groupRoleMap),
    envMapCount: Object.keys(envMap).length,
    roles,
    loginEnabled: isSsoMethodEnabled() && configured && policy.enabled,
  };
}
