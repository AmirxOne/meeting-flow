import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { cancelBooking } from "@/server/services/appointment.service";

export const dynamic = "force-dynamic";

/** POST — لغو رزرو (خود کاربر یا مسئول) → جلسه CANCELLED، نوبت آزاد */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    return ok(await cancelBooking(id, user));
  } catch (e) {
    return handleError(e);
  }
}
