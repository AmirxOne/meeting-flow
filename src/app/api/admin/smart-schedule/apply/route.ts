import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { z } from "zod";
import { applySmartPlan } from "@/server/services/ai/smart-schedule.service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({ draftId: z.string().min(3) });

/** POST — اعمال نهایی برنامه (تراکنشی + re-check) */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("meeting:approve");
    const input = schema.parse(await req.json());
    const result = await applySmartPlan({ orgId: user.orgId, userId: user.id, draftId: input.draftId });
    await audit({
      actorId: user.id,
      orgId: user.orgId,
      action: "SMART_SCHEDULE_APPLY",
      entity: "Meeting",
      entityId: input.draftId,
      newValue: { created: result.created },
    });
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
