import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { roomCreateSchema } from "@/lib/validations";
import { assertFloorInBranch } from "@/server/services/floor.service";

async function assertManagerExists(managerId: string | null | undefined) {
  if (!managerId) return;
  const user = await prisma.user.findUnique({ where: { id: managerId } });
  if (!user) throw new HttpError(404, "مدیر اتاق یافت نشد", "NOT_FOUND");
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("room:create");
    const input = roomCreateSchema.parse(await req.json().catch(() => ({})));
    await assertFloorInBranch(input.branchId, input.floorId);
    await assertManagerExists(input.managerId);
    const room = await prisma.meetingRoom.create({
      data: {
        branchId: input.branchId,
        floorId: input.floorId || null,
        managerId: input.managerId || null,
        name: input.name,
        capacity: input.capacity,
        description: input.description || null,
        isVip: input.isVip,
        minDurationMin: input.minDurationMin,
        maxDurationMin: input.maxDurationMin,
        openTime: input.openTime || null,
        closeTime: input.closeTime || null,
        equipment: {
          create: input.equipment.map((e) => ({ equipment: e })),
        },
      },
    });
    await audit({
      actorId: actor.id, action: "CREATE", entity: "MeetingRoom", entityId: room.id,
      newValue: { name: room.name, capacity: room.capacity },
    });
    return ok({ room }, 201);
  } catch (e) {
    return handleError(e);
  }
}
