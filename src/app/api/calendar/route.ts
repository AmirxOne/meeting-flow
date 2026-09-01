import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { maskPrivateMeeting, meetingAccessOr } from "@/server/services/privacy";
import { requireUser, can } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const from = new Date(sp.get("from") ?? Date.now() - 7 * 86400000);
    const to = new Date(sp.get("to") ?? Date.now() + 30 * 86400000);
    const branchId = sp.get("branchId");
    const scope = sp.get("scope");

    const seeAll = can(user, "meeting:view-all") && scope !== "mine";

    const meetings = await prisma.meeting.findMany({
      where: {
        orgId: user.orgId,
        ...(seeAll
          ? {}
          : meetingAccessOr(user.id)),
        startAt: { gte: from, lte: to },
        status: { notIn: ["DRAFT", "CANCELLED", "REJECTED", "WAITLISTED", "WAITLIST_OFFERED"] },
        ...(branchId ? { branchId } : {}),
      },
      select: {
        id: true, title: true, startAt: true, endAt: true, status: true,
        meetingType: true, priority: true,
        organizerId: true,
        createdById: true,
        organizer: { select: { id: true, fullName: true } },
        room: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        isPrivate: true,
        seriesId: true,
        participants: { select: { userId: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { startAt: "asc" },
    });

    // Company occupancy per weekday (for company calendar view)
    const dayMap = new Map<string, { count: number; busyMs: number }>();
    for (const m of meetings) {
      if (!seeAll) break;
      const key = new Date(m.startAt.getTime() + 210 * 60000).toISOString().slice(0, 10);
      const cur = dayMap.get(key) ?? { count: 0, busyMs: 0 };
      cur.count += 1;
      cur.busyMs += m.endAt.getTime() - m.startAt.getTime();
      dayMap.set(key, cur);
    }
    // rough occupancy: busy hours / (rooms × 12h open window)
    const roomCount = await prisma.meetingRoom.count({ where: { orgId: user.orgId, isActive: true } });
    const occupancy = [...dayMap.entries()].map(([date, v]) => ({
      date,
      count: v.count,
      occupancyPct: roomCount
        ? Math.min(100, Math.round((v.busyMs / 3600000 / (roomCount * 12)) * 100))
        : 0,
    }));

        const viewer = { id: user.id, isSuperAdmin: !!user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN") };
    const masked = meetings.map((m) => maskPrivateMeeting(m, viewer));
    return ok({ meetings: masked, occupancy, seeAll });
  } catch (e) {
    return handleError(e);
  }
}
