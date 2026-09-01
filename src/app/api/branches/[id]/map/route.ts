import { NextRequest } from "next/server";
import { HttpError, requirePermission } from "@/server/auth/session";
import { handleError, ok, audit } from "@/server/http";
import {
  deleteBranchMap,
  mapImageResponse,
  readBranchMap,
  uploadBranchMap,
} from "@/server/services/wayfinding-map.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/branches/:id/map — admin preview of branch map. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("branch:update");
    const { id } = await params;
    const file = await readBranchMap(actor.orgId, id);
    return mapImageResponse(file.body, file.mimeType);
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/branches/:id/map — upload branch map image (desktop admin). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("branch:update");
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      throw new HttpError(400, "فایل نقشه انتخاب نشده است", "NO_FILE");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const updated = await uploadBranchMap(actor.orgId, id, {
      buffer,
      name: file.name || "map.png",
    });
    await audit({
      actorId: actor.id,
      action: "MAP_UPLOAD",
      entity: "Branch",
      entityId: id,
      newValue: { mimeType: updated.mapMimeType },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ hasMap: true }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/branches/:id/map — remove branch map. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("branch:update");
    const { id } = await params;
    await deleteBranchMap(actor.orgId, id);
    await audit({
      actorId: actor.id,
      action: "MAP_DELETE",
      entity: "Branch",
      entityId: id,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ hasMap: false });
  } catch (e) {
    return handleError(e);
  }
}
