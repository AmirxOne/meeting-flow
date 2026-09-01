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

    const dup = await prisma.branch.findFirst({ where: { orgId: actor.orgId, name: input.name } });
    if (dup) {
      return Response.json(
        { ok: false, error: { message: "شعبه‌ای با این نام وجود دارد", code: "DUPLICATE" } },
        { status: 409 },
      );
    }

    const branch = await prisma.branch.create({
      data: {
        orgId: actor.orgId,
        name: input.name,
        address: input.address || null,
        phone: input.phone || null,
        managerId: input.managerId || null,
        wayfindingText: input.wayfindingText?.trim() || null,
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
    const { requireUser, requirePermission: rp } = await import("@/server/auth/session");
    const actor = await requireUser();
    const includeInactive = req.nextUrl.searchParams.get("all") === "1";
    let canManage = false;
    try {
      await rp("branch:update");
      canManage = true;
    } catch {
      canManage = false;
    }
    const branches = await prisma.branch.findMany({
      where: {
        orgId: actor.orgId,
        ...(includeInactive && canManage ? {} : { isActive: true }),
      },
      include: {
        manager: { select: { id: true, fullName: true } },
        floors: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            name: true,
            number: true,
            wayfindingText: true,
            mapStorageKey: true,
          },
        },
        _count: { select: { rooms: true, users: true, meetings: true } },
      },
      orderBy: { name: "asc" },
    });
    return ok({
      canManage,
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        phone: b.phone,
        isActive: b.isActive,
        manager: b.manager,
        wayfindingText: b.wayfindingText,
        hasMap: !!b.mapStorageKey,
        floors: b.floors.map((f) => ({
          id: f.id,
          name: f.name,
          number: f.number,
          wayfindingText: f.wayfindingText,
          hasMap: !!f.mapStorageKey,
        })),
        _count: b._count,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
