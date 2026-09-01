import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { holidayCreateSchema } from "@/lib/validations";
import { createOrgHoliday } from "@/server/services/holiday.service";

export const dynamic = "force-dynamic";

/** POST /api/admin/holidays — add an org holiday (policy:manage). */
export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("policy:manage");
    const input = holidayCreateSchema.parse(await req.json().catch(() => ({})));
    const holiday = await createOrgHoliday(actor.orgId, {
      dateIso: input.dateIso,
      name: input.name,
      createdBy: actor.id,
    });
    await audit({
      actorId: actor.id,
      action: "HOLIDAY_CREATE",
      entity: "OrgHoliday",
      entityId: holiday.id,
      newValue: holiday,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ holiday }, 201);
  } catch (e) {
    return handleError(e);
  }
}
