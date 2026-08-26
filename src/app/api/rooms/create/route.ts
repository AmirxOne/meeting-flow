import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { roomCreateSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("room:create");
    const input = roomCreateSchema.parse(await req.json().catch(() => ({})));
    const room = await prisma.meetingRoom.create({
      data: {
        branchId: input.branchId,
        floorId: input.floorId || null,
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
