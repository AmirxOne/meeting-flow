import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ok, handleError } from "@/server/http";
import { normalizeOrgSlug, SAMPLE_ORG_SLUG, requestedOrgSlug } from "@/lib/org-slug";

export const dynamic = "force-dynamic";

const DEFAULT = {
  name: "مهرسا",
  slug: SAMPLE_ORG_SLUG,
  logoUrl: null as string | null,
};

/** GET /api/public/organization — branding by slug (login / subdomain), no auth. */
export async function GET(req: NextRequest) {
  try {
    const slug =
      normalizeOrgSlug(req.nextUrl.searchParams.get("slug")) ??
      requestedOrgSlug({
        header: req.headers.get("x-org-slug"),
        query: req.nextUrl.searchParams.get("org"),
        host: req.headers.get("host"),
      }) ??
      SAMPLE_ORG_SLUG;

    const organization = await prisma.organization.findUnique({
      where: { slug },
      select: { name: true, slug: true, logoUrl: true },
    });
    if (!organization) {
      return ok({ organization: DEFAULT, found: false });
    }
    return ok({ organization, found: true });
  } catch (e) {
    return handleError(e);
  }
}
