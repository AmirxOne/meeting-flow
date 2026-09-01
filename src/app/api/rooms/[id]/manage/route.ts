import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requirePermission, requireUser, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { roomCreateSchema } from "@/lib/validations";
import { assertFloorInBranch } from "@/server/services/floor.service";
import { assertRoomManageAccess, isRoomManagerScoped } from "@/server/services/room-access.service";

export const dynamic = "force-dynamic";

const updateSchema = roomCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

async function assertManagerExists(managerId: string | null | undefined) {
  if (!managerId) return;
  const user = await prisma.user.findUnique({ where: { id: managerId } });
  if (!user) throw new HttpError(404, "مدیر اتاق یافت نشد", "NOT_FOUND");
}

/** GET /api/rooms/:id — detail + today's timeline (existing live status). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const room = await prisma.meetingRoom.findFirst({
      where: { id, orgId: user.orgId },
      include: {
        branch: { select: { id: true, name: true } },
        floor: { select: { name: true, number: true } },
        equipment: true,
        manager: { select: { fullName: true } },
      },
    });
    if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
    return ok({ room });
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/rooms/:id — edit room (capacity, equipment, hours, VIP…). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("room:update");
    const { id } = await params;
    const input = updateSchema.parse(await req.json().catch(() => ({})));

    const room = await prisma.meetingRoom.findFirst({ where: { id, orgId: actor.orgId } });
    if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
    assertRoomManageAccess(actor, room);

    if (input.floorId !== undefined) {
      await assertFloorInBranch(room.branchId, input.floorId);
    }
    if (input.managerId !== undefined) {
      if (isRoomManagerScoped(actor)) {
        throw new HttpError(403, "تغییر مدیر اتاق مجاز نیست", "FORBIDDEN");
      }
      await assertManagerExists(input.managerId);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.meetingRoom.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.capacity ? { capacity: input.capacity } : {}),
          ...(input.description !== undefined ? { description: input.description || null } : {}),
          ...(input.isVip !== undefined ? { isVip: input.isVip } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.minDurationMin ? { minDurationMin: input.minDurationMin } : {}),
          ...(input.maxDurationMin ? { maxDurationMin: input.maxDurationMin } : {}),
          ...(input.openTime !== undefined ? { openTime: input.openTime || null } : {}),
          ...(input.closeTime !== undefined ? { closeTime: input.closeTime || null } : {}),
          ...(input.floorId !== undefined ? { floorId: input.floorId || null } : {}),
          ...(input.managerId !== undefined ? { managerId: input.managerId || null } : {}),
        },
      });
      if (input.equipment) {
        await tx.roomEquipment.deleteMany({ where: { roomId: id } });
        await tx.roomEquipment.createMany({
          data: input.equipment.map((e) => ({ roomId: id, equipment: e })),
        });
      }
      return r;
    });

    await audit({
      actorId: actor.id,
      action: input.isActive === false ? "ROOM_DISABLE" : input.isActive === true ? "ROOM_ENABLE" : "UPDATE",
      entity: "MeetingRoom",
      entityId: id,
      oldValue: { name: room.name, capacity: room.capacity, isActive: room.isActive },
      newValue: { name: updated.name, capacity: updated.capacity, isActive: updated.isActive },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ room: updated });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/rooms/:id — only when no active meetings reference it. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("room:delete");
    const { id } = await params;

    const room = await prisma.meetingRoom.findFirst({
      where: { id, orgId: actor.orgId },
      include: { meetings: { where: { status: { in: ["PENDING_APPROVAL", "APPROVED", "CONFIRMED", "RESCHEDULED", "IN_PROGRESS"] } } } },
    });
    if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
    assertRoomManageAccess(actor, room);

    if (room.meetings.length > 0) {
      // block delete, suggest disable instead
      throw new HttpError(
        409,
        `این اتاق ${room.meetings.length} جلسه فعال دارد — ابتدا آن‌ها را جابه‌جا کنید یا اتاق را غیرفعال کنید`,
        "ROOM_IN_USE",
      );
    }

    // detach past meetings (SetNull) then delete
    await prisma.meeting.updateMany({ where: { roomId: id }, data: { roomId: null } });
    await prisma.roomEquipment.deleteMany({ where: { roomId: id } });
    await prisma.roomExclusion.deleteMany({ where: { roomId: id } });
    await prisma.meetingRoom.delete({ where: { id } });

    await audit({
      actorId: actor.id,
      action: "DELETE",
      entity: "MeetingRoom",
      entityId: id,
      oldValue: { name: room.name },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
