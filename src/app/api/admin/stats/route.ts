import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/stats — admin overview counters + recent activity. */
export async function GET() {
  try {
    const actor = await requirePermission("user:update");
    const orgId = actor.orgId;

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
      prisma.user.count({ where: { orgId, isActive: true } }),
      prisma.user.count({ where: { orgId, isActive: false } }),
      prisma.meetingRoom.count({ where: { orgId } }),
      prisma.meetingRoom.count({ where: { orgId, isActive: true } }),
      prisma.branch.count({ where: { orgId } }),
      prisma.meeting.count({ where: { orgId, status: "PENDING_APPROVAL" } }),
      prisma.meeting.count({
        where: {
          orgId,
          startAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
      prisma.personDirectory.count({ where: { orgId } }),
      prisma.auditLog.count({
        where: { orgId, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
      }),
      prisma.auditLog.findMany({
        where: { orgId },
        take: 6,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { fullName: true } } },
      }),
    ]);

    const day = new Date(new Date().setHours(0, 0, 0, 0));
    const weekAgo = new Date(day.getTime() - 6 * 86400000);
    const [weekMeetings, weekCancelled] = await Promise.all([
      prisma.meeting.count({ where: { orgId, startAt: { gte: weekAgo } } }),
      prisma.meeting.count({
        where: { orgId, startAt: { gte: weekAgo }, status: "CANCELLED" },
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
