import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { branchCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const updateSchema = branchCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/** POST /api/branches — create branch (ADMIN+). */
export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("branch:create");
    const input = branchCreateSchema.parse(await req.json().catch(() => ({})));

    const dup = await prisma.branch.findFirst({ where: { name: input.name } });
    if (dup) {
      return Response.json(
        { ok: false, error: { message: "شعبه‌ای با این نام وجود دارد", code: "DUPLICATE" } },
        { status: 409 },
      );
    }

    const org = await prisma.organization.findFirst();
    if (!org) throw new HttpError(500, "سازمان یافت نشد", "NO_ORG");
    const branch = await prisma.branch.create({
      data: {
        orgId: org.id,
        name: input.name,
        address: input.address || null,
        phone: input.phone || null,
        managerId: input.managerId || null,
      },
    });
    await audit({
      actorId: actor.id,
      action: "CREATE",
      entity: "Branch",
      entityId: branch.id,
      newValue: { name: branch.name },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ branch }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** GET /api/branches — list with manage details when permitted. */
export async function GET(req: NextRequest) {
  try {
    const { requirePermission: rp } = await import("@/server/auth/session");
    const includeInactive = req.nextUrl.searchParams.get("all") === "1";
    let canManage = false;
    try {
      await rp("branch:update");
      canManage = true;
    } catch {
      canManage = false;
    }
    const branches = await prisma.branch.findMany({
      where: includeInactive && canManage ? {} : { isActive: true },
      include: {
        manager: { select: { id: true, fullName: true } },
        floors: { orderBy: { number: "asc" } },
        _count: { select: { rooms: true, users: true, meetings: true } },
      },
      orderBy: { name: "asc" },
    });
    return ok({ branches, canManage });
  } catch (e) {
    return handleError(e);
  }
}
