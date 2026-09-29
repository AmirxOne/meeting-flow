import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, fail, handleError, audit } from "@/server/http";
import { saveOrgLogo, deleteOrgLogo } from "@/server/services/org-logo.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/admin/organization/logo — آپلود لوگوی سازمان (org:manage، multipart). */
export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("org:manage");
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      throw new HttpError(400, "فایل انتخاب نشده است", "NO_FILE");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const { logoUrl } = await saveOrgLogo(actor, { buffer, name: file.name || "logo" });
    await audit({
      actorId: actor.id,
      action: "ORG_LOGO_UPLOAD",
      entity: "Organization",
      entityId: actor.orgId,
      newValue: { size: buffer.length },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ logoUrl }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/organization/logo — حذف لوگو. */
export async function DELETE(req: NextRequest) {
  try {
    const actor = await requirePermission("org:manage");
    await deleteOrgLogo(actor);
    await audit({
      actorId: actor.id,
      action: "ORG_LOGO_DELETE",
      entity: "Organization",
      entityId: actor.orgId,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
