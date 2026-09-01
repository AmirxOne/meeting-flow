import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { deleteOrgHoliday } from "@/server/services/holiday.service";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("policy:manage");
    const { id } = await params;
    await deleteOrgHoliday(actor.orgId, id);
    await audit({
      actorId: actor.id,
      action: "HOLIDAY_DELETE",
      entity: "OrgHoliday",
      entityId: id,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
