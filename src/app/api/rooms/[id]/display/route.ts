import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { handleError, ok } from "@/server/http";
import {
  authorizeRoomDisplay,
  getRoomDisplayBoard,
} from "@/server/services/room-display.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/rooms/:id/display — kiosk board (token, room code, or same-org session). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    const room = await authorizeRoomDisplay(id, {
      token: req.nextUrl.searchParams.get("t") ?? req.headers.get("x-room-display-token"),
      code: req.nextUrl.searchParams.get("code") ?? req.headers.get("x-room-display-code"),
      user,
    });
    const board = await getRoomDisplayBoard(room);
    return ok(board);
  } catch (e) {
    return handleError(e);
  }
}
