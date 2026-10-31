import { prisma } from "@/server/db";
import { SAMPLE_ORG_SLUG } from "@/lib/org-slug";

/**
 * نام نمایشی سازمان برای metadata سرور (عنوان تب صفحات عمومی).
 * از همان رکوردی خوانده می‌شود که ادمین در تنظیمات ویرایش می‌کند.
 * استراتژی: slug نمونه (dev) → اولین سازمان واقعی (استقرار تک-سازمانی).
 */
export async function serverOrgName(): Promise<string> {
  try {
    const bySlug = await prisma.organization.findUnique({
      where: { slug: SAMPLE_ORG_SLUG },
      select: { name: true },
    });
    if (bySlug?.name?.trim()) return bySlug.name.trim();
    const first = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
      select: { name: true },
    });
    return first?.name?.trim() ?? ""; // بدون سازمان: هیچ نامی نمایش داده نمی‌شود
  } catch {
    return "";
  }
}
