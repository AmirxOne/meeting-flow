import { prisma } from "@/server/db";

export const DEFAULT_ORG_TIMEZONE = "Asia/Tehran";

const CACHE_TTL_MS = 60_000;

const cached = new Map<string, { timezone: string; expiresAt: number }>();

/** Organization timezone from DB with short in-memory cache. */
export async function getOrgTimezone(orgId?: string): Promise<string> {
  const key = orgId ?? "_default";
  const hit = cached.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.timezone;
  }

  const org = orgId
    ? await prisma.organization.findUnique({
        where: { id: orgId },
        select: { timezone: true },
      })
    : await prisma.organization.findFirst({
        select: { timezone: true },
      });

  const timezone = org?.timezone?.trim() || DEFAULT_ORG_TIMEZONE;
  cached.set(key, { timezone, expiresAt: Date.now() + CACHE_TTL_MS });
  return timezone;
}

/** Invalidate cache after admin updates organization settings. */
export function clearOrgTimezoneCache(): void {
  cached.clear();
}

/** Sync read of last cached timezone — falls back to default. */
export function getCachedOrgTimezone(): string {
  for (const v of cached.values()) {
    if (v.expiresAt > Date.now()) return v.timezone;
  }
  return DEFAULT_ORG_TIMEZONE;
}
