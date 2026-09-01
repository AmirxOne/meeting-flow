import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { isIsoDate } from "@/lib/holiday";
import { getHolidayBookingMode, listHolidays } from "@/server/services/holiday.service";

export const dynamic = "force-dynamic";

/** GET /api/holidays?from=YYYY-MM-DD&to=YYYY-MM-DD — org holidays for calendar / wizard. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const fromRaw = req.nextUrl.searchParams.get("from") ?? undefined;
    const toRaw = req.nextUrl.searchParams.get("to") ?? undefined;
    const from = fromRaw && isIsoDate(fromRaw) ? fromRaw : undefined;
    const to = toRaw && isIsoDate(toRaw) ? toRaw : undefined;
    const [holidays, bookingMode] = await Promise.all([
      listHolidays(user.orgId, from, to),
      getHolidayBookingMode(user.orgId),
    ]);
    return ok({ holidays, bookingMode });
  } catch (e) {
    return handleError(e);
  }
}
