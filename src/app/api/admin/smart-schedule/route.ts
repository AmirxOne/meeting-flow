import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { z } from "zod";
import { generateSmartPlan, getDraft } from "@/server/services/ai/smart-schedule.service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const genSchema = z.object({
  windowFrom: z.string().min(10),
  windowTo: z.string().min(10),
  useAi: z.boolean().optional().default(true),
});

/** POST — تولید برنامه‌ی پیش‌نویس (هیچ داده‌ی اصلی تغییر نمی‌کند) */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("meeting:approve");
    const input = genSchema.parse(await req.json());
    const draft = await generateSmartPlan({
      orgId: user.orgId,
      windowFrom: new Date(input.windowFrom),
      windowTo: new Date(input.windowTo),
      useAi: input.useAi,
    });
    return ok({ draft });
  } catch (e) {
    return handleError(e);
  }
}

/** GET — پیش‌نویس موجود */
export async function GET() {
  try {
    await requirePermission("meeting:approve");
    return ok({ draft: await getDraft() });
  } catch (e) {
    return handleError(e);
  }
}
