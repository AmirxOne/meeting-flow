import { NextRequest } from "next/server";
import { requireUser, can } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { removeDelegate } from "@/server/services/delegate.service";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!can(user, "meeting:create")) {
      return Response.json(
        { ok: false, error: { message: "دسترسی لازم را ندارید", code: "FORBIDDEN" } },
        { status: 403 },
      );
    }
    const { id } = await params;
    const row = await removeDelegate(user.orgId, user.id, id);
    await audit({
      actorId: user.id,
      action: "DELETE",
      entity: "Delegate",
      entityId: id,
      oldValue: { managerId: row.managerId, delegateId: row.delegateId },
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
