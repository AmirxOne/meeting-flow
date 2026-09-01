import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

const DEFAULT_BRANDING = {
  name: "مهرسا",
  logoUrl: null as string | null,
  timezone: "Asia/Tehran",
};

/** GET /api/organization/branding — read-only org name + logo + timezone for authenticated users. */
export async function GET() {
  try {
    const user = await requireUser();
    const organization = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { name: true, logoUrl: true, timezone: true, slug: true },
    });
    if (!organization) {
      return ok({ branding: DEFAULT_BRANDING });
    }
    return ok({
      branding: {
        name: organization.name,
        logoUrl: organization.logoUrl,
        timezone: organization.timezone?.trim() || DEFAULT_BRANDING.timezone,
        slug: organization.slug,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
