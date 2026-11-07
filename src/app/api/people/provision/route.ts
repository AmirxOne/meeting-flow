import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { findOrProvisionLdapUser } from "@/server/auth/ldap-user.service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  jobTitle: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
});

/**
 * ساخت اکانت برای کاربر دایرکتوری LDAP هنگام انتخاب او در PeoplePicker —
 * بدون نیاز به اینکه خودش یک بار لاگین کرده باشد.
 * اکانت با رمز تصادفی ساخته می‌شود؛ کاربر با اولین لاگین LDAP واقعی واردش می‌شود.
 * دسترسی: هر کاربر لاگین‌شده‌ی همان سازمان (ادمین جلسه باید بتواند همکار دعوت کند).
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser();
    const input = bodySchema.parse(await req.json());

    // idempotent: اگر هست، فقط برگردان
    const user = await findOrProvisionLdapUser(
      {
        email: input.email,
        fullName: input.fullName,
        jobTitle: input.jobTitle ?? undefined,
        department: input.department ?? undefined,
      },
      actor.orgId,
    );

    const dir = await prisma.personDirectory.findUnique({
      where: { userId: user.id },
      select: { id: true, userId: true },
    });

    return ok({ userId: user.id, directoryId: dir?.id ?? null });
  } catch (e) {
    return handleError(e);
  }
}
