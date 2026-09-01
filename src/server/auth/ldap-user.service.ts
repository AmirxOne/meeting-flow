import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import type { LdapUserProfile } from "./ldap-client";

/** Find existing user by email or auto-provision with EMPLOYEE role. */
export async function findOrProvisionLdapUser(profile: LdapUserProfile, orgId: string) {
  const email = profile.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });

  if (existing) {
    if (!existing.isActive) {
      throw new HttpError(401, "حساب کاربری غیرفعال است", "ACCOUNT_DISABLED");
    }
    if (existing.orgId && existing.orgId !== orgId && !existing.isSuperAdmin) {
      throw new HttpError(401, "ایمیل، شماره موبایل یا رمز عبور اشتباه است", "BAD_CREDENTIALS");
    }

    const needsUpdate =
      existing.fullName !== profile.fullName ||
      (profile.jobTitle && existing.jobTitle !== profile.jobTitle) ||
      (profile.department && existing.department !== profile.department);

    if (needsUpdate) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: profile.fullName,
          ...(profile.jobTitle ? { jobTitle: profile.jobTitle } : {}),
          ...(profile.department ? { department: profile.department } : {}),
        },
        include: { roles: { include: { role: true } } },
      });
    }

    return existing;
  }

  const employeeRole = await prisma.role.findUnique({ where: { key: "EMPLOYEE" } });
  if (!employeeRole) {
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
      roles: { create: [{ roleId: employeeRole.id }] },
    },
    include: { roles: { include: { role: true } } },
  });

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

  return user;
}
