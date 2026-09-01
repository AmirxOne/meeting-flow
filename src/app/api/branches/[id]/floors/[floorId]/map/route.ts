import { NextRequest } from "next/server";
import { HttpError, requirePermission } from "@/server/auth/session";
import { handleError, ok, audit } from "@/server/http";
import {
  deleteFloorMap,
  mapImageResponse,
  readFloorMap,
  uploadFloorMap,
} from "@/server/services/wayfinding-map.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/branches/:id/floors/:floorId/map — admin preview of floor map. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; floorId: string }> },
) {
  try {
    const actor = await requirePermission("branch:update");
    const { id, floorId } = await params;
    const file = await readFloorMap(actor.orgId, id, floorId);
    return mapImageResponse(file.body, file.mimeType);
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/branches/:id/floors/:floorId/map — upload floor map image. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; floorId: string }> },
) {
  try {
    const actor = await requirePermission("branch:update");
    const { id, floorId } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      throw new HttpError(400, "فایل نقشه انتخاب نشده است", "NO_FILE");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const updated = await uploadFloorMap(actor.orgId, id, floorId, {
      buffer,
      name: file.name || "map.png",
    });
    await audit({
      actorId: actor.id,
      action: "MAP_UPLOAD",
      entity: "Floor",
      entityId: floorId,
      newValue: { mimeType: updated.mapMimeType, branchId: id },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ hasMap: true }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/branches/:id/floors/:floorId/map */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; floorId: string }> },
) {
  try {
    const actor = await requirePermission("branch:update");
    const { id, floorId } = await params;
    await deleteFloorMap(actor.orgId, id, floorId);
    await audit({
      actorId: actor.id,
      action: "MAP_DELETE",
      entity: "Floor",
      entityId: floorId,
      oldValue: { branchId: id },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ hasMap: false });
  } catch (e) {
    return handleError(e);
  }
}
