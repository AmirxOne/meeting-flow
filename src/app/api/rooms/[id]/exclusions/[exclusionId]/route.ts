import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { roomExclusionUpdateSchema } from "@/lib/validations";
import { assertExclusionWindowValid } from "@/server/services/room-exclusion.service";
import { assertRoomManageAccess } from "@/server/services/room-access.service";

export const dynamic = "force-dynamic";

/** PATCH /api/rooms/:id/exclusions/:exclusionId */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; exclusionId: string }> },
) {
  try {
    const actor = await requirePermission("room:update");
    const { id: roomId, exclusionId } = await params;
    const input = roomExclusionUpdateSchema.parse(await req.json().catch(() => ({})));

    const room = await prisma.meetingRoom.findFirst({ where: { id: roomId, orgId: actor.orgId } });
    if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
    assertRoomManageAccess(actor, room);

    const existing = await prisma.roomExclusion.findFirst({
      where: { id: exclusionId, roomId },
    });
    if (!existing) throw new HttpError(404, "غیرفعال‌سازی یافت نشد", "NOT_FOUND");

    const startAt = input.startAt ? new Date(input.startAt) : existing.startAt;
    const endAt = input.endAt ? new Date(input.endAt) : existing.endAt;
    const reason = input.reason ?? existing.reason;

    await assertExclusionWindowValid(
      { roomId, reason, startAt, endAt },
      exclusionId,
    );

    const exclusion = await prisma.roomExclusion.update({
      where: { id: exclusionId },
      data: {
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.startAt ? { startAt } : {}),
        ...(input.endAt ? { endAt } : {}),
      },
    });

    await audit({
      actorId: actor.id,
      action: "UPDATE",
      entity: "RoomExclusion",
      entityId: exclusionId,
      oldValue: { reason: existing.reason, startAt: existing.startAt, endAt: existing.endAt },
      newValue: { reason: exclusion.reason, startAt: exclusion.startAt, endAt: exclusion.endAt },
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ exclusion });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/rooms/:id/exclusions/:exclusionId */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; exclusionId: string }> },
) {
  try {
    const actor = await requirePermission("room:update");
    const { id: roomId, exclusionId } = await params;

    const room = await prisma.meetingRoom.findFirst({ where: { id: roomId, orgId: actor.orgId } });
    if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
    assertRoomManageAccess(actor, room);

    const existing = await prisma.roomExclusion.findFirst({
      where: { id: exclusionId, roomId },
    });
    if (!existing) throw new HttpError(404, "غیرفعال‌سازی یافت نشد", "NOT_FOUND");

    await prisma.roomExclusion.delete({ where: { id: exclusionId } });

    await audit({
      actorId: actor.id,
      action: "DELETE",
      entity: "RoomExclusion",
      entityId: exclusionId,
      oldValue: { reason: existing.reason, startAt: existing.startAt, endAt: existing.endAt },
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
