import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import {
  ROLE_DEFINITIONS,
  type PermissionKey,
} from "@/server/auth/permissions";

export const SESSION_COOKIE = "mh_session";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
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

export async function createSession(userId: string): Promise<string> {
  const hdrs = await headers();
  const token = newSessionToken();
  const ttlHours = Number(process.env.SESSION_TTL_HOURS ?? 72);
  const expiresAt = new Date(Date.now() + ttlHours * 3600000);
  await prisma.session.create({
    data: {
      token: hashToken(token),
      userId,
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

export async function getSessionUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token: hashToken(token) },
    include: {
      user: {
        include: { roles: { include: { role: true } } },
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
  for (const key of roleKeys) {
    const def = ROLE_DEFINITIONS[key];
    if (def) for (const p of def.permissions) permissions.add(p);
  }

  return {
    id: session.user.id,
    email: session.user.email,
    fullName: session.user.fullName,
    avatarUrl: session.user.avatarUrl,
    jobTitle: session.user.jobTitle,
    department: session.user.department,
    isSuperAdmin: session.user.isSuperAdmin || roleKeys.includes("SUPER_ADMIN"),
    branchId: session.user.branchId,
    permissions: session.user.isSuperAdmin
      ? new Set(Object.keys(ROLE_DEFINITIONS.SUPER_ADMIN.permissions))
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
