import { NextRequest } from "next/server";
import { HttpError, requireUser } from "@/server/auth/session";
import { audit, handleError, ok } from "@/server/http";
import { deleteOwnAvatar, saveOwnAvatar } from "@/server/services/avatar.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/auth/avatar — upload own cropped avatar (multipart `file`). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      throw new HttpError(400, "فایل تصویر انتخاب نشده است", "NO_FILE");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await saveOwnAvatar(user.id, {
      buffer,
      name: file.name || "avatar.jpg",
    });
    await audit({
      actorId: user.id,
      action: "AVATAR_UPLOAD",
      entity: "User",
      entityId: user.id,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/auth/avatar — remove own avatar. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    await deleteOwnAvatar(user.id);
    await audit({
      actorId: user.id,
      action: "AVATAR_DELETE",
      entity: "User",
      entityId: user.id,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ avatarUrl: null });
  } catch (e) {
    return handleError(e);
  }
}
