import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import {
  PERMISSION_KEYS,
  type PermissionKey,
} from "@/server/auth/permissions";
import {
  ORG_COOKIE,
  ORG_SLUG_HEADER,
  SAMPLE_ORG_ID,
  SAMPLE_ORG_SLUG,
  requestedOrgSlug,
} from "@/lib/org-slug";

export const SESSION_COOKIE = "mh_session";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  /** Active tenant for data queries (resolved; platform admin may switch via slug). */
  orgId: string;
  orgSlug: string;
  /** DB `isSuperAdmin` — platform operator, not an org ADMIN. */
  isPlatformAdmin: boolean;
  isSuperAdmin: boolean;
  branchId: string | null;
  permissions: Set<string>;
  roleKeys: string[];
}

export function hashToken(token: string): string {
  return createHash("sha256")
    .update(`${token}:${process.env.SESSION_SECRET ?? "dev"}`)
    .digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string, orgId?: string | null): Promise<string> {
  const hdrs = await headers();
  const token = newSessionToken();
  const ttlHours = Number(process.env.SESSION_TTL_HOURS ?? 72);
  const expiresAt = new Date(Date.now() + ttlHours * 3600000);
  await prisma.session.create({
    data: {
      token: hashToken(token),
      userId,
      orgId: orgId ?? undefined,
      expiresAt,
      ip: hdrs.get("x-forwarded-for") ?? undefined,
      userAgent: hdrs.get("user-agent")?.slice(0, 250) ?? undefined,
    },
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token: hashToken(token) } });
}

/** Drop other devices' sessions. Used when 2FA is newly enabled. */
export async function destroyOtherSessions(userId: string, keepRawToken?: string): Promise<void> {
  if (keepRawToken) {
    await prisma.session.deleteMany({
      where: { userId, token: { not: hashToken(keepRawToken) } },
    });
    return;
  }
  await prisma.session.deleteMany({ where: { userId } });
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token: hashToken(token) },
    include: {
      user: {
        include: {
          org: { select: { id: true, slug: true } },
          roles: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: { select: { key: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date() || !session.user.isActive) {
    await prisma.session.deleteMany({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // touch (fire and forget)
  prisma.session
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  const roleKeys = session.user.roles.map((r) => r.role.key);
  const permissions = new Set<string>();
  for (const ur of session.user.roles) {
    for (const rp of ur.role.permissions) {
      permissions.add(rp.permission.key);
    }
  }

  const isPlatformAdmin = session.user.isSuperAdmin;
  const isSuperAdmin = isPlatformAdmin || roleKeys.includes("SUPER_ADMIN");

  let orgId = session.user.orgId;
  let orgSlug = session.user.org?.slug ?? null;

  if (isPlatformAdmin) {
    const hdrs = await headers();
    const requested = requestedOrgSlug({
      header: hdrs.get(ORG_SLUG_HEADER),
      host: hdrs.get("host"),
      cookie: store.get(ORG_COOKIE)?.value ?? null,
    });
    if (requested) {
      const switched = await prisma.organization.findUnique({
        where: { slug: requested },
        select: { id: true, slug: true },
      });
      if (switched) {
        orgId = switched.id;
        orgSlug = switched.slug;
      }
    }
    if (!orgId) {
      const sample =
        (await prisma.organization.findUnique({
          where: { slug: SAMPLE_ORG_SLUG },
          select: { id: true, slug: true },
        })) ??
        (await prisma.organization.findUnique({
          where: { id: SAMPLE_ORG_ID },
          select: { id: true, slug: true },
        }));
      orgId = sample?.id ?? SAMPLE_ORG_ID;
      orgSlug = sample?.slug ?? SAMPLE_ORG_SLUG;
    }
  }

  if (!orgId || !orgSlug) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    fullName: session.user.fullName,
    phone: session.user.phone,
    avatarUrl: session.user.avatarUrl,
    jobTitle: session.user.jobTitle,
    department: session.user.department,
    orgId,
    orgSlug,
    isPlatformAdmin,
    isSuperAdmin,
    branchId: session.user.branchId,
    permissions: isSuperAdmin
      ? new Set(PERMISSION_KEYS)
      : permissions,
    roleKeys,
  };
}

export function can(user: AuthUser | null, permission: PermissionKey): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions.has(permission);
}

export function canAny(user: AuthUser | null, perms: PermissionKey[]): boolean {
  return perms.some((p) => can(user, p));
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public extra?: unknown,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "ابتدا وارد شوید", "UNAUTHENTICATED");
  return user;
}

export async function requirePermission(
  permission: PermissionKey,
): Promise<AuthUser> {
  const user = await requireUser();
  if (!can(user, permission)) {
    throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
  }
  return user;
}
