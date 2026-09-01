import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser, can } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { meetingAccessOr } from "@/server/services/privacy";

export const dynamic = "force-dynamic";

/** Global search: meetings, users, rooms, guests, branches. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return ok({ results: { meetings: [], users: [], rooms: [], guests: [], branches: [] } });

    const orgId = user.orgId;
    const [meetings, users, rooms, branches] = await Promise.all([
      prisma.meeting.findMany({
        where: {
          orgId,
          title: { contains: q },
          ...(can(user, "meeting:view-all")
            ? {}
            : meetingAccessOr(user.id)),
        },
        select: { id: true, title: true, startAt: true, status: true },
        take: 5,
      }),
      can(user, "user:update")
        ? prisma.user.findMany({
            where: {
              orgId,
              OR: [{ fullName: { contains: q } }, { email: { contains: q } }],
            },
            select: { id: true, fullName: true, email: true, jobTitle: true },
            take: 5,
          })
        : Promise.resolve([]),
      prisma.meetingRoom.findMany({
        where: { orgId, name: { contains: q } },
        select: { id: true, name: true, capacity: true, branch: { select: { name: true } } },
        take: 5,
      }),
      prisma.branch.findMany({
        where: { orgId, name: { contains: q } },
        select: { id: true, name: true },
        take: 5,
      }),
    ]);

    // guests only visible with view-all or manage-guests
    const guests =
      can(user, "meeting:view-all") || can(user, "meeting:manage-guests")
        ? await prisma.meetingGuest.findMany({
            where: {
              meeting: { orgId },
              OR: [{ name: { contains: q } }, { company: { contains: q } }],
            },
            select: { id: true, name: true, company: true, meetingId: true },
            take: 5,
          })
        : [];

    return ok({ results: { meetings, users, rooms, guests, branches } });
  } catch (e) {
    return handleError(e);
  }
}
