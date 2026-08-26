import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { summaryReport, meetingsForExport } from "@/server/services/report.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("report:view");
    const sp = req.nextUrl.searchParams;
    const filters = {
      from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
      to: sp.get("to") ? new Date(sp.get("to")!) : undefined,
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
      const header = "id,title,status,type,branch,room,organizer,participants,guests,start,end,duration_min";
      const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
      const lines = rows.map((r) =>
        [r.id, r.title, r.status, r.type, r.branch, r.room, r.organizer, r.participants, r.guests, r.startAt.toISOString(), r.endAt.toISOString(), r.durationMin].map(esc).join(","),
      );
      // UTF-8 BOM so Excel opens Persian correctly
      return new Response(`\\u{FEFF}${[header, ...lines].join("\\n")}`, {
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
