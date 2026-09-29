import { prisma } from "@/server/db";
import { SAMPLE_ORG_SLUG } from "@/lib/org-slug";

/**
 * نام نمایشی سازمان برای metadata سرور (عنوان تب صفحات عمومی).
 * از همان رکوردی خوانده می‌شود که ادمین در تنظیمات ویرایش می‌کند.
 */
export async function serverOrgName(): Promise<string> {
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: SAMPLE_ORG_SLUG },
      select: { name: true },
    });
    return org?.name?.trim() || "مهرسا";
  } catch {
    return "مهرسا";
  }
}
