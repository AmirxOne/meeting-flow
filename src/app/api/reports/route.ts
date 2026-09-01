import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { endOfDayUtcFromIso, startOfDayUtcFromIso } from "@/lib";
import { meetingsCsv, meetingsForExport, summaryReport } from "@/server/services/report.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const actor = await requirePermission("report:view");
    const sp = req.nextUrl.searchParams;
    const filters = {
      orgId: actor.orgId,
      from: sp.get("from") ? startOfDayUtcFromIso(sp.get("from")!) : undefined,
      to: sp.get("to") ? endOfDayUtcFromIso(sp.get("to")!) : undefined,
      branchId: sp.get("branchId") ?? undefined,
      roomId: sp.get("roomId") ?? undefined,
      organizerId: sp.get("organizerId") ?? undefined,
      participantId: sp.get("participantId") ?? undefined,
      meetingType: sp.get("meetingType") ?? undefined,
      status: sp.get("status") ?? undefined,
    };
    const format = sp.get("format");
    if (format === "csv") {
      const rows = await meetingsForExport(filters);
      return new Response(meetingsCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="meetings-report.csv"',
        },
      });
    }
    const summary = await summaryReport(filters);
    return ok({ summary });
  } catch (e) {
    return handleError(e);
  }
}
