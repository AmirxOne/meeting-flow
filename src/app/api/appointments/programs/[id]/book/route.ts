import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { z } from "zod";
import { bookSlot, notifyBooking } from "@/server/services/appointment.service";

export const dynamic = "force-dynamic";

const schema = z.object({ startAt: z.string().datetime() });

/** POST — رزرو اتمیک نوبت → جلسه‌ی واقعی */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const input = schema.parse(await req.json().catch(() => ({})));
    const r = await bookSlot({ programId: id, startAt: input.startAt, user });
    // اعلان خارج از مسیر بحرانی — شکستش رزرو را خراب نمی‌کند
    notifyBooking(r.booking.id).catch(() => undefined);
    return ok({
      bookingId: r.booking.id,
      meetingId: r.meeting.id,
      room: r.room.name,
      startAt: r.booking.startAt,
      endAt: r.booking.endAt,
    });
  } catch (e) {
    return handleError(e);
  }
}
