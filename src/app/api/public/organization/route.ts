import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, handleError } from "@/server/http";
import { normalizeOrgSlug, SAMPLE_ORG_SLUG, requestedOrgSlug } from "@/lib/org-slug";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/organization — branding by slug (login / subdomain), no auth.
 * بدون slug مشخص: اول سازمان نمونه (dev)، بعد اولین سازمان واقعی (استقرار تک-سازمانی).
 */
export async function GET(req: NextRequest) {
  try {
    const slug =
      normalizeOrgSlug(req.nextUrl.searchParams.get("slug")) ??
      requestedOrgSlug({
        header: req.headers.get("x-org-slug"),
        query: req.nextUrl.searchParams.get("org"),
        host: req.headers.get("host"),
      });

    let organization = slug
      ? await prisma.organization.findUnique({
          where: { slug },
          select: { name: true, slug: true, logoUrl: true },
        })
      : null;

    // بدون slug یا slug ناموجود → اول سازمان نمونه، بعد اولین سازمان واقعی
    if (!organization && !slug) {
      organization =
        (await prisma.organization.findUnique({
          where: { slug: SAMPLE_ORG_SLUG },
          select: { name: true, slug: true, logoUrl: true },
        })) ??
        (await prisma.organization.findFirst({
          orderBy: { createdAt: "asc" },
          select: { name: true, slug: true, logoUrl: true },
        }));
    }

    if (!organization) {
      // سازمان وجود ندارد — آبجکت خالی بدون slug؛
      // فرم لاگین نباید slug ساختگی بگیرد و لاگین را به سازمان غیرموجود قفل کند
      return ok({ organization: { name: "", slug: null, logoUrl: null }, found: false });
    }
    return ok({ organization, found: true });
  } catch (e) {
    return handleError(e);
  }
}
