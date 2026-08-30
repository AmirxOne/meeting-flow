import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { organizationUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/** GET /api/admin/organization — org profile (org:manage). */
export async function GET() {
  try {
    await requirePermission("org:manage");
    const organization = await prisma.organization.findFirst({
      select: {
        id: true,
        name: true,
        legalName: true,
        timezone: true,
        logoUrl: true,
        updatedAt: true,
      },
    });
    if (!organization) {
      return ok({ organization: null });
    }
    return ok({ organization });
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/admin/organization — update org profile (org:manage). */
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission("org:manage");
    const input = organizationUpdateSchema.parse(await req.json().catch(() => ({})));

    const existing = await prisma.organization.findFirst();
    if (!existing) {
      return ok({ organization: null, updated: false });
    }

    const updated = await prisma.organization.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.legalName !== undefined ? { legalName: input.legalName || null } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
      },
      select: {
        id: true,
        name: true,
        legalName: true,
        timezone: true,
        logoUrl: true,
        updatedAt: true,
      },
    });

    await audit({
      actorId: actor.id,
      action: "UPDATE",
      entity: "Organization",
      entityId: existing.id,
      oldValue: {
        name: existing.name,
        legalName: existing.legalName,
        timezone: existing.timezone,
        logoUrl: existing.logoUrl,
      },
      newValue: {
        name: updated.name,
        legalName: updated.legalName,
        timezone: updated.timezone,
        logoUrl: updated.logoUrl,
      },
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ organization: updated });
  } catch (e) {
    return handleError(e);
  }
}
