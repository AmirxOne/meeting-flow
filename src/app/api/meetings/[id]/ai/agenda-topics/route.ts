import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { suggestAgendaTopics } from "@/server/services/agenda-ai.service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST — پیشنهاد ۵ موضوع جلسه با AI (برگزارکننده/دبیر/مدیر) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    const topics = await suggestAgendaTopics(id);
    return ok({ topics });
  } catch (e) {
    return handleError(e);
  }
}
