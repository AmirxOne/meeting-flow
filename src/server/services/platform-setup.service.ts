import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { normalizeOrgSlug, proposeOrgSlug } from "@/lib/org-slug";
import type { OrgSetupInput } from "@/lib/validations";
import { ensureSystemRoles } from "@/server/bootstrap/system-roles";
import { DEFAULT_POLICIES } from "@/server/services/state-machine";

const DEFAULT_POLICY_META: Record<string, string> = {
  requireApprovalExternalGuest: "جلسه با مهمان خارجی نیاز به تأیید دارد",
  requireApprovalVipRoom: "اتاق VIP نیاز به تأیید دارد",
  requireApprovalLongerThanMin: "جلسه بیش از ۲ ساعت نیاز به تأیید دارد",
  autoApproveInternal: "جلسه داخلی خودکار تأیید شود",
  minDurationMin: "حداقل مدت جلسه (دقیقه)",
  maxDurationMin: "حداکثر مدت جلسه (دقیقه)",
  defaultReminderOffsets: "یادآورها (دقیقه قبل)",
  holidayBooking: "رزرو در تعطیل سازمانی",
};

/** True when no organization exists — first-run wizard is allowed. */
export function isPlatformSetupOpen(orgCount: number): boolean {
  return orgCount === 0;
}

export async function platformNeedsSetup(): Promise<boolean> {
  const count = await prisma.organization.count();
  return isPlatformSetupOpen(count);
}

async function resolveUniqueSlug(input: OrgSetupInput): Promise<string> {
  const preferred =
    normalizeOrgSlug(input.orgSlug?.trim()) ||
    proposeOrgSlug(input.orgName) ||
    `org-${Date.now().toString(36).slice(-6)}`;

  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? preferred : `${preferred}-${i + 1}`.slice(0, 48);
    if (!normalizeOrgSlug(candidate)) continue;
    const exists = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
  }
  throw new HttpError(409, "شناسه سازمان (slug) در دسترس نیست — slug دیگری انتخاب کنید", "SLUG_CONFLICT");
}

async function seedOrgPolicies(orgId: string, updatedBy: string): Promise<void> {
  const entries = Object.entries(DEFAULT_POLICIES) as [string, unknown][];
  for (const [key, value] of entries) {
    await prisma.meetingPolicy.create({
      data: {
        orgId,
        key,
        value: value as object,
        description: DEFAULT_POLICY_META[key] ?? key,
        updatedBy,
      },
    });
  }
}

export type BootstrapOrgResult = {
  orgId: string;
  orgSlug: string;
  orgName: string;
  adminUserId: string;
  adminEmail: string;
  adminFullName: string;
  branchId: string;
  roomId: string;
};

/** Create first organization + admin + branch + room. Only when DB has zero orgs. */
export async function bootstrapOrganization(input: OrgSetupInput): Promise<BootstrapOrgResult> {
  const orgCount = await prisma.organization.count();
  if (!isPlatformSetupOpen(orgCount)) {
    throw new HttpError(403, "راه‌اندازی اولیه قبلاً انجام شده است", "SETUP_CLOSED");
  }

  const email = input.adminEmail.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new HttpError(409, "این ایمیل قبلاً ثبت شده است", "EMAIL_EXISTS");
  }

  await ensureSystemRoles();
  const slug = await resolveUniqueSlug(input);
  const passwordHash = await bcrypt.hash(input.adminPassword, 10);
  const adminRole = await prisma.role.findUnique({ where: { key: "ADMIN" } });
  if (!adminRole) {
    throw new HttpError(500, "نقش ADMIN یافت نشد", "ROLE_MISSING");
  }

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.organization.count();
    if (locked > 0) {
      throw new HttpError(403, "راه‌اندازی اولیه هم‌زمان انجام شد", "SETUP_CLOSED");
    }

    const org = await tx.organization.create({
      data: {
        name: input.orgName.trim(),
        slug,
        legalName: input.orgName.trim(),
        timezone: "Asia/Tehran",
      },
    });

    const admin = await tx.user.create({
      data: {
        email,
        fullName: input.adminFullName.trim(),
        passwordHash,
        jobTitle: "مدیر سازمان",
        orgId: org.id,
        isActive: true,
      },
    });

    await tx.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

    const branch = await tx.branch.create({
      data: {
        orgId: org.id,
        name: input.branchName.trim(),
        managerId: admin.id,
      },
    });

    await tx.user.update({
      where: { id: admin.id },
      data: { branchId: branch.id },
    });

    const floor = await tx.floor.create({
      data: { branchId: branch.id, name: "طبقه اول", number: 1 },
    });

    const room = await tx.meetingRoom.create({
      data: {
        orgId: org.id,
        branchId: branch.id,
        floorId: floor.id,
        name: input.roomName.trim(),
        capacity: input.roomCapacity,
        openTime: "08:00",
        closeTime: "20:00",
        managerId: admin.id,
      },
    });

    await tx.personDirectory.create({
      data: {
        orgId: org.id,
        name: admin.fullName,
        kind: "INTERNAL",
        email: admin.email,
        jobTitle: admin.jobTitle,
        userId: admin.id,
      },
    });

    const policies = Object.entries(DEFAULT_POLICIES) as [string, unknown][];
    for (const [key, value] of policies) {
      await tx.meetingPolicy.create({
        data: {
          orgId: org.id,
          key,
          value: value as object,
          description: DEFAULT_POLICY_META[key] ?? key,
          updatedBy: admin.id,
        },
      });
    }

    return { org, admin, branch, room };
  });

  return {
    orgId: result.org.id,
    orgSlug: result.org.slug,
    orgName: result.org.name,
    adminUserId: result.admin.id,
    adminEmail: result.admin.email,
    adminFullName: result.admin.fullName,
    branchId: result.branch.id,
    roomId: result.room.id,
  };
}
