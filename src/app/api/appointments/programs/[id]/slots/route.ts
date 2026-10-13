import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { z } from "zod";
import { computeAvailableSlots } from "@/server/services/appointment.service";

export const dynamic = "force-dynamic";

const qSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

/** GET — اسلات‌های واقعاً آزاد (اتاق+مسئول+رزرونشده) در بازه */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const input = qSchema.parse({ from: sp.get("from") ?? "", to: sp.get("to") ?? "" });
    const r = await computeAvailableSlots(id, user, new Date(input.from), new Date(input.to));
    return ok(r);
  } catch (e) {
    return handleError(e);
  }
}
