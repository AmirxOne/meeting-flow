import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { roomExclusionCreateSchema } from "@/lib/validations";
import { assertExclusionWindowValid } from "@/server/services/room-exclusion.service";
import { assertRoomManageAccess } from "@/server/services/room-access.service";

export const dynamic = "force-dynamic";

/** GET /api/rooms/:id/exclusions — upcoming maintenance / closure windows. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("room:update");
    const { id: roomId } = await params;

    const room = await prisma.meetingRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
    assertRoomManageAccess(actor, room);

    const now = new Date();
    const exclusions = await prisma.roomExclusion.findMany({
      where: { roomId, endAt: { gte: now } },
      orderBy: { startAt: "asc" },
    });

    return ok({ exclusions });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/rooms/:id/exclusions — schedule temporary room closure. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("room:update");
    const { id: roomId } = await params;
    const raw = roomExclusionCreateSchema.parse(await req.json().catch(() => ({})));

    const room = await prisma.meetingRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
    assertRoomManageAccess(actor, room);

    const startAt = new Date(raw.startAt);
    const endAt = new Date(raw.endAt);

    await assertExclusionWindowValid({ roomId, reason: raw.reason, startAt, endAt });

    const exclusion = await prisma.roomExclusion.create({
      data: { roomId, reason: raw.reason, startAt, endAt },
    });

    await audit({
      actorId: actor.id,
      action: "CREATE",
      entity: "RoomExclusion",
      entityId: exclusion.id,
      newValue: { roomId, reason: exclusion.reason, startAt, endAt },
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ exclusion }, 201);
  } catch (e) {
    return handleError(e);
  }
}
