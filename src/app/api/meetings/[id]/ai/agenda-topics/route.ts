import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { runMeetingAiFeature } from "@/server/services/ai/registry.service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST — پیشنهاد ۵ موضوع جلسه با AI (اعضای جلسه) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await requireUser();
    const topics = await runMeetingAiFeature<string[]>("agenda-topics", id);
    return ok({ topics });
  } catch (e) {
    return handleError(e);
  }
}
