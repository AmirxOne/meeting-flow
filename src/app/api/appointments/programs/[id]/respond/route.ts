import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { z } from "zod";
import { respondToProgram } from "@/server/services/appointment.service";

export const dynamic = "force-dynamic";

const schema = z.object({ response: z.literal("DECLINED") });

/** POST — «در این برنامه شرکت نمی‌کنم» */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const input = schema.parse(await req.json().catch(() => ({})));
    return ok(await respondToProgram(id, user, input.response));
  } catch (e) {
    return handleError(e);
  }
}
