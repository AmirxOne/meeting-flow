import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/stats — admin overview counters + recent activity. */
export async function GET() {
  try {
    await requirePermission("user:update");

    const [
      activeUsers,
      disabledUsers,
      totalRooms,
      activeRooms,
      totalBranches,
      pendingApprovals,
      todayMeetings,
      directorySize,
      auditToday,
      recentLogs,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
      prisma.meetingRoom.count(),
      prisma.meetingRoom.count({ where: { isActive: true } }),
      prisma.branch.count(),
      prisma.meeting.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.meeting.count({
        where: {
          startAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
      prisma.personDirectory.count(),
      prisma.auditLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
      }),
      prisma.auditLog.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { fullName: true } } },
      }),
    ]);

    const day = new Date(new Date().setHours(0, 0, 0, 0));
    const weekAgo = new Date(day.getTime() - 6 * 86400000);
    const [weekMeetings, weekCancelled] = await Promise.all([
      prisma.meeting.count({ where: { startAt: { gte: weekAgo } } }),
      prisma.meeting.count({
        where: { startAt: { gte: weekAgo }, status: "CANCELLED" },
      }),
    ]);

    return ok({
      users: { active: activeUsers, disabled: disabledUsers },
      rooms: { total: totalRooms, active: activeRooms },
      branches: totalBranches,
      pendingApprovals,
      todayMeetings,
      directorySize,
      auditToday,
      week: { meetings: weekMeetings, cancelled: weekCancelled },
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        action: l.action,
        entity: l.entity,
        actor: l.actor?.fullName ?? "—",
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
