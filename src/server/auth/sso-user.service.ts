import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { mapDirectoryGroupsToRoleKeys, type GroupRoleMap } from "./oidc-groups";
import type { OidcProfile } from "./oidc-client";
import type { AuthenticatedUser } from "./login.service";

function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    jobTitle: user.jobTitle,
  };
}

async function syncPersonDirectory(
  user: {
    id: string;
    email: string;
    fullName: string;
    jobTitle: string | null;
    phone: string | null;
  },
  orgId: string,
) {
  await prisma.personDirectory
    .upsert({
      where: { userId: user.id },
      update: {
        name: user.fullName,
        email: user.email,
        jobTitle: user.jobTitle,
        kind: "INTERNAL",
        orgId,
      },
      create: {
        orgId,
        name: user.fullName,
        kind: "INTERNAL",
        email: user.email,
        jobTitle: user.jobTitle,
        userId: user.id,
      },
    })
    .catch(() => {});
}

async function applyRoleKeys(userId: string, roleKeys: string[]): Promise<void> {
  if (roleKeys.length === 0) return;
  const roles = await prisma.role.findMany({ where: { key: { in: roleKeys } } });
  if (roles.length === 0) return;
  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.userRole.createMany({
    data: roles.map((r) => ({ userId, roleId: r.id })),
  });
}

/** Find by email or auto-provision. Groups map to roles when the mapping hits. */
export async function findOrProvisionSsoUser(
  profile: OidcProfile,
  groupRoleMap: GroupRoleMap,
  orgId: string,
): Promise<AuthenticatedUser> {
  const email = profile.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new HttpError(400, "حساب سازمانی ایمیل معتبری برنگرداند", "SSO_NO_EMAIL");
  }

  const mapped = mapDirectoryGroupsToRoleKeys({
    groups: profile.groups,
    mapping: groupRoleMap,
    fallback: null,
  });

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });

  if (existing) {
    if (!existing.isActive) {
      throw new HttpError(401, "حساب کاربری غیرفعال است", "ACCOUNT_DISABLED");
    }

    if (existing.orgId && existing.orgId !== orgId && !existing.isSuperAdmin) {
      throw new HttpError(401, "حساب کاربری غیرفعال است", "ACCOUNT_DISABLED");
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: profile.fullName || existing.fullName,
        ...(profile.jobTitle ? { jobTitle: profile.jobTitle } : {}),
        ...(profile.department ? { department: profile.department } : {}),
      },
    });
    if (mapped.length > 0) {
      await applyRoleKeys(existing.id, mapped);
    }
    await syncPersonDirectory(
      {
        id: existing.id,
        email: existing.email,
        fullName: profile.fullName || existing.fullName,
        jobTitle: profile.jobTitle ?? existing.jobTitle,
        phone: existing.phone,
      },
      existing.orgId ?? orgId,
    );
    return toAuthUser({
      id: existing.id,
      email: existing.email,
      fullName: profile.fullName || existing.fullName,
      jobTitle: profile.jobTitle ?? existing.jobTitle,
    });
  }

  const roleKeys = mapped.length > 0 ? mapped : ["EMPLOYEE"];
  const roles = await prisma.role.findMany({ where: { key: { in: roleKeys } } });
  const employeeRole = roles.length
    ? null
    : await prisma.role.findUnique({ where: { key: "EMPLOYEE" } });
  const roleIds = roles.length ? roles.map((r) => r.id) : employeeRole ? [employeeRole.id] : [];
  if (roleIds.length === 0) {
    throw new HttpError(500, "نقش EMPLOYEE در سیستم یافت نشد", "ROLE_MISSING");
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const user = await prisma.user.create({
    data: {
      email,
      fullName: profile.fullName,
      jobTitle: profile.jobTitle ?? null,
      department: profile.department ?? null,
      passwordHash,
      orgId,
      roles: { create: roleIds.map((roleId) => ({ roleId })) },
    },
  });
  await syncPersonDirectory(
    {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      jobTitle: user.jobTitle,
      phone: user.phone,
    },
    orgId,
  );
  return toAuthUser(user);
}
