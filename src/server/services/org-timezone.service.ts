import { prisma } from "@/server/db";

export const DEFAULT_ORG_TIMEZONE = "Asia/Tehran";

const CACHE_TTL_MS = 60_000;

let cached: { timezone: string; expiresAt: number } | null = null;

/** Organization timezone from DB with short in-memory cache. */
export async function getOrgTimezone(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.timezone;
  }

  const org = await prisma.organization.findFirst({
    select: { timezone: true },
  });

  const timezone = org?.timezone?.trim() || DEFAULT_ORG_TIMEZONE;
  cached = { timezone, expiresAt: Date.now() + CACHE_TTL_MS };
  return timezone;
}

/** Invalidate cache after admin updates organization settings. */
export function clearOrgTimezoneCache(): void {
  cached = null;
}

/** Sync read of last cached timezone — falls back to default. */
export function getCachedOrgTimezone(): string {
  return cached?.timezone ?? DEFAULT_ORG_TIMEZONE;
}
