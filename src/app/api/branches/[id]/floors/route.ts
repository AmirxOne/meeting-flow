import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { floorCreateSchema } from "@/lib/validations";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("branch:update");
    const { id: branchId } = await params;
    const input = floorCreateSchema.parse(await req.json().catch(() => ({})));

    const branch = await prisma.branch.findFirst({ where: { id: branchId, orgId: actor.orgId } });
    if (!branch) throw new HttpError(404, "شعبه یافت نشد", "NOT_FOUND");

    const dup = await prisma.floor.findUnique({
      where: { branchId_number: { branchId, number: input.number } },
    });
    if (dup) {
      return Response.json(
        { ok: false, error: { message: "طبقه‌ای با این شماره در این شعبه وجود دارد", code: "DUPLICATE" } },
        { status: 409 },
      );
    }

    const floor = await prisma.floor.create({
      data: {
        branchId,
        name: input.name,
        number: input.number,
        wayfindingText: input.wayfindingText?.trim() || null,
      },
    });

    await audit({
      actorId: actor.id,
      action: "CREATE",
      entity: "Floor",
      entityId: floor.id,
      newValue: { name: floor.name, number: floor.number, branchId },
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ floor }, 201);
  } catch (e) {
    return handleError(e);
  }
}
