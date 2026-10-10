import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { z } from "zod";
import { updateDraftAssignment } from "@/server/services/ai/smart-schedule.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  draftId: z.string().min(3),
  requestId: z.string().min(3),
  start: z.string().min(10),
  end: z.string().min(10),
  roomId: z.string().nullable().optional(),
});

/** POST — ویرایش دستی یک تخصیص + اعتبارسنجی مجدد تداخل‌ها */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("meeting:approve");
    const input = schema.parse(await req.json());
    const r = await updateDraftAssignment({
      orgId: user.orgId,
      draftId: input.draftId,
      requestId: input.requestId,
      start: new Date(input.start),
      end: new Date(input.end),
      roomId: input.roomId ?? null,
    });
    return ok(r);
  } catch (e) {
    return handleError(e);
  }
}
