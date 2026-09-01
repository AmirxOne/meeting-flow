import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { isLdapAuthEnabled } from "@/server/auth/auth-config";
import { uniqueUserPhone } from "@/server/services/user-phone";
import type { profileSelfUpdateSchema } from "@/lib/validations";
import type { z } from "zod";

export type ProfileSelfUpdateInput = z.infer<typeof profileSelfUpdateSchema>;

export async function updateSelfProfile(userId: string, input: ProfileSelfUpdateInput) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new HttpError(404, "کاربر یافت نشد", "NOT_FOUND");
  if (!target.isActive) throw new HttpError(403, "حساب غیرفعال است", "FORBIDDEN");

  const phone =
    input.phone !== undefined ? await uniqueUserPhone(input.phone, userId) : undefined;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.fullName ? { fullName: input.fullName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle || null } : {}),
      ...(input.department !== undefined ? { department: input.department || null } : {}),
    },
  });

  const tenantId = updated.orgId;
  if (tenantId) {
    await prisma.personDirectory.upsert({
      where: { userId },
      update: {
        ...(input.fullName ? { name: input.fullName } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle || null } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
      create: {
        orgId: tenantId,
        name: updated.fullName,
        kind: "INTERNAL",
        email: updated.email,
        phone: updated.phone,
        jobTitle: updated.jobTitle,
        userId,
      },
    }).catch(() => {});
  }

  return updated;
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (isLdapAuthEnabled()) {
    throw new HttpError(
      400,
      "در حالت LDAP رمز عبور از طریق Active Directory مدیریت می‌شود",
      "LDAP_PASSWORD",
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new HttpError(401, "رمز فعلی اشتباه است", "BAD_CREDENTIALS");
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "رمز فعلی اشتباه است", "BAD_CREDENTIALS");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await prisma.session.deleteMany({ where: { userId } });
}
