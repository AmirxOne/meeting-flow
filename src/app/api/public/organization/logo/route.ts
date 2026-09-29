import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, handleError } from "@/server/http";
import { readOrgLogo, logoImageResponse } from "@/server/services/org-logo.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/public/organization/logo?slug=… — فایل لوگوی سازمان (عمومی).
 * لوگوی آپلودی از storage سرو می‌شود؛ اگر logoUrl آدرس خارجی باشد، آن URL برگردانده می‌شود.
 */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug")?.trim().toLowerCase() || null;
    const org = await prisma.organization.findFirst({
      where: slug ? { slug } : {},
      select: { id: true, logoUrl: true },
      orderBy: { createdAt: "asc" },
    });
    if (!org || !org.logoUrl) return ok({ logo: null });

    // لوگوی آپلودی محلی
    const file = await readOrgLogo(org.id);
    if (file) return logoImageResponse(file.body, file.mimeType);

    // آدرس خارجی قدیمی
    return ok({ logo: { url: org.logoUrl } });
  } catch (e) {
    return handleError(e);
  }
}
