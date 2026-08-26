import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser, can } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

/** Global search: meetings, users, rooms, guests, branches. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return ok({ results: { meetings: [], users: [], rooms: [], guests: [], branches: [] } });

    const [meetings, users, rooms, branches] = await Promise.all([
      prisma.meeting.findMany({
        where: {
          title: { contains: q },
          ...(can(user, "meeting:view-all")
            ? {}
            : { OR: [{ organizerId: user.id }, { participants: { some: { userId: user.id } } }] }),
        },
        select: { id: true, title: true, startAt: true, status: true },
        take: 5,
      }),
      can(user, "user:update")
        ? prisma.user.findMany({
            where: { OR: [{ fullName: { contains: q } }, { email: { contains: q } }] },
            select: { id: true, fullName: true, email: true, jobTitle: true },
            take: 5,
          })
        : Promise.resolve([]),
      prisma.meetingRoom.findMany({
        where: { name: { contains: q } },
        select: { id: true, name: true, capacity: true, branch: { select: { name: true } } },
        take: 5,
      }),
      prisma.branch.findMany({
        where: { name: { contains: q } },
        select: { id: true, name: true },
        take: 5,
      }),
    ]);

    // guests only visible with view-all or manage-guests
    const guests =
      can(user, "meeting:view-all") || can(user, "meeting:manage-guests")
        ? await prisma.meetingGuest.findMany({
            where: { OR: [{ name: { contains: q } }, { company: { contains: q } }] },
            select: { id: true, name: true, company: true, meetingId: true },
            take: 5,
          })
        : [];

    return ok({ results: { meetings, users, rooms, guests, branches } });
  } catch (e) {
    return handleError(e);
  }
}
