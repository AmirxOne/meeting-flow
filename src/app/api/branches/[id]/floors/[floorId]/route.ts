import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { floorUpdateSchema } from "@/lib/validations";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; floorId: string }> }) {
  try {
    const actor = await requirePermission("branch:update");
    const { id: branchId, floorId } = await params;
    const input = floorUpdateSchema.parse(await req.json().catch(() => ({})));

    const floor = await prisma.floor.findFirst({ where: { id: floorId, branchId } });
    if (!floor) throw new HttpError(404, "طبقه یافت نشد", "NOT_FOUND");

    if (input.number !== undefined && input.number !== floor.number) {
      const dup = await prisma.floor.findUnique({
        where: { branchId_number: { branchId, number: input.number } },
      });
      if (dup && dup.id !== floorId) {
        return Response.json(
          { ok: false, error: { message: "طبقه‌ای با این شماره در این شعبه وجود دارد", code: "DUPLICATE" } },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.floor.update({
      where: { id: floorId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.number !== undefined ? { number: input.number } : {}),
      },
    });

    await audit({
      actorId: actor.id,
      action: "UPDATE",
      entity: "Floor",
      entityId: floorId,
      oldValue: { name: floor.name, number: floor.number },
      newValue: { name: updated.name, number: updated.number },
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ floor: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; floorId: string }> }) {
  try {
    const actor = await requirePermission("branch:update");
    const { id: branchId, floorId } = await params;

    const floor = await prisma.floor.findFirst({
      where: { id: floorId, branchId },
      include: { _count: { select: { rooms: true } } },
    });
    if (!floor) throw new HttpError(404, "طبقه یافت نشد", "NOT_FOUND");

    if (floor._count.rooms > 0) {
      throw new HttpError(
        409,
        `این طبقه ${floor._count.rooms} اتاق دارد — ابتدا اتاق‌ها را منتقل یا حذف کنید`,
        "FLOOR_IN_USE",
      );
    }

    await prisma.floor.delete({ where: { id: floorId } });

    await audit({
      actorId: actor.id,
      action: "DELETE",
      entity: "Floor",
      entityId: floorId,
      oldValue: { name: floor.name, number: floor.number, branchId },
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
