import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { maskPrivateMeeting, meetingAccessOr } from "@/server/services/privacy";
import { requireUser, can } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

/** Dashboard aggregates: today, pending approvals, room status, weekly stats. */
export async function GET(_req: NextRequest) {
  try {
    const user = await requireUser();

    // Tehran day bounds
    const t = new Date(Date.now() + 210 * 60000);
    const todayStart = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - 210 * 60000);
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

    const seeAll = user.permissions.has("meeting:view-all");

    const orgId = user.orgId;
    const scope: Record<string, unknown> = {
      orgId,
      ...(seeAll
        ? {}
        : meetingAccessOr(user.id)),
    };

    const [todayCount, activeNow, pendingApprovals, availableRooms, occupiedRooms, cancelledThisWeek, weekMeetings, upcomingMine] =
      await Promise.all([
        prisma.meeting.count({
          where: { ...scope, startAt: { gte: todayStart, lt: todayEnd }, status: { notIn: ["CANCELLED", "REJECTED", "DRAFT"] } },
        }),
        prisma.meeting.count({ where: { ...scope, status: "IN_PROGRESS" } }),
        prisma.meeting.count({
          where: { orgId, status: "PENDING_APPROVAL", ...(seeAll ? {} : { organizerId: user.id }) },
        }),
        prisma.meetingRoom.count({ where: { orgId, isActive: true } }),
        prisma.meeting.findMany({ where: { orgId, status: "IN_PROGRESS" }, select: { roomId: true }, distinct: ["roomId"] }).then((rows) => rows.length),
        prisma.meeting.count({ where: { orgId, status: "CANCELLED", startAt: { gte: todayStart, lt: weekEnd } } }),
        prisma.meeting.findMany({
          where: { ...scope, startAt: { gte: todayStart, lt: weekEnd }, status: { notIn: ["CANCELLED", "REJECTED", "DRAFT"] } },
          select: { startAt: true, endAt: true, status: true, branchId: true, meetingType: true },
        }),
        prisma.meeting.findMany({
          where: { ...scope, startAt: { gte: new Date() }, status: { in: ["CONFIRMED", "APPROVED"] } },
          include: {
            organizer: { select: { fullName: true } },
            room: { select: { name: true } },
            branch: { select: { name: true } },
            participants: { select: { userId: true } },
          },
          orderBy: { startAt: "asc" },
          take: 6,
        }),
      ]);

    // weekly hours by day (Tehran local) — always 7 days from today
    const byDay = new Map<string, number>();
    for (const m of weekMeetings) {
      const key = new Date(m.startAt.getTime() + 210 * 60000).toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + (m.endAt.getTime() - m.startAt.getTime()) / 3600000);
    }
    const weekSeries = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(todayStart.getTime() + i * 86400000);
      const date = new Date(dayStart.getTime() + 210 * 60000).toISOString().slice(0, 10);
      const hours = byDay.get(date) ?? 0;
      return { date, hours: Math.round(hours * 10) / 10 };
    });

    const viewer = { id: user.id, isSuperAdmin: !!user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN") };
    return ok({
      todayCount,
      activeNow,
      pendingApprovals,
      rooms: { total: availableRooms, occupied: occupiedRooms },
      cancelledThisWeek,
      weekSeries,
      upcoming: upcomingMine.map((m) => maskPrivateMeeting(m, viewer)),
      seeAll,
    });
  } catch (e) {
    return handleError(e);
  }
}
