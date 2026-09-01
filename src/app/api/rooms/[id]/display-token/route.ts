import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { audit, handleError, ok } from "@/server/http";
import { publicOrigin } from "@/server/services/ics-feed.service";
import {
  getRoomDisplayTokenStatus,
  revokeRoomDisplayAccess,
  rotateRoomDisplayAccess,
} from "@/server/services/room-display.service";
import { roomDisplayPath } from "@/lib/room-display";

export const dynamic = "force-dynamic";

/** GET /api/rooms/:id/display-token — whether a kiosk token exists (room:update). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("room:update");
    const { id } = await params;
    const status = await getRoomDisplayTokenStatus(actor.orgId, id);
    return ok(status);
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/rooms/:id/display-token — create or rotate kiosk token + room code. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("room:update");
    const { id } = await params;
    const rotated = await rotateRoomDisplayAccess(actor, id);
    const origin = publicOrigin(req);
    await audit({
      actorId: actor.id,
      action: "DISPLAY_TOKEN",
      entity: "MeetingRoom",
      entityId: id,
      newValue: { rotated: true },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({
      token: rotated.token,
      displayCode: rotated.displayCode,
      createdAt: rotated.createdAt,
      enabled: true,
      url: `${origin.replace(/\/$/, "")}${roomDisplayPath(id, rotated.token)}`,
    });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/rooms/:id/display-token — revoke kiosk access. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("room:update");
    const { id } = await params;
    await revokeRoomDisplayAccess(actor, id);
    await audit({
      actorId: actor.id,
      action: "DISPLAY_TOKEN_REVOKE",
      entity: "MeetingRoom",
      entityId: id,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ enabled: false, displayCode: null });
  } catch (e) {
    return handleError(e);
  }
}
