import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

/** Room live status + timeline for a date. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const dateIso = req.nextUrl.searchParams.get("date");
    const dayStart = dateIso
      ? (() => {
          const [y, m, d] = dateIso.split("-").map(Number);
          return new Date(Date.UTC(y, m - 1, d) - 210 * 60000);
        })()
      : (() => {
          const t = new Date(Date.now() + 210 * 60000);
          return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - 210 * 60000);
        })();
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const room = await prisma.meetingRoom.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        floor: { select: { name: true, number: true } },
        equipment: true,
        manager: { select: { fullName: true } },
      },
    });
    if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");

    const meetings = await prisma.meeting.findMany({
      where: {
        roomId: id,
        status: { in: ["PENDING_APPROVAL", "APPROVED", "CONFIRMED", "RESCHEDULED", "IN_PROGRESS", "COMPLETED"] },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      include: {
        organizer: { select: { fullName: true } },
        _count: { select: { participants: true, guests: true } },
      },
      orderBy: { startAt: "asc" },
    });

    const now = new Date();
    const current = meetings.find((m) => m.startAt <= now && m.endAt > now && m.status === "IN_PROGRESS") ?? null;
    const next = meetings.find((m) => m.startAt > now) ?? null;
    const status = !room.isActive ? "DISABLED" : current ? "OCCUPIED" : next ? "RESERVED" : "AVAILABLE";

    return ok({ room, meetings, status, current, next });
  } catch (e) {
    return handleError(e);
  }
}
