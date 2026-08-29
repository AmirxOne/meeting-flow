import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { maskPrivateMeeting } from "@/server/services/privacy";
import { requireUser, can } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { meetingCreateSchema } from "@/lib/validations";
import { createMeeting, checkConflicts } from "@/server/services/meeting.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const status = sp.get("status");
    const branchId = sp.get("branchId");
    const roomId = sp.get("roomId");
    const q = sp.get("q");
    const scope = sp.get("scope"); // mine | all

    const seeAll = can(user, "meeting:view-all") && scope !== "mine";

    const meetings = await prisma.meeting.findMany({
      where: {
        ...(seeAll
          ? {}
          : {
              OR: [
                { organizerId: user.id },
                { participants: { some: { userId: user.id } } },
              ],
            }),
        ...(from && to
          ? { startAt: { gte: new Date(from), lte: new Date(to) } }
          : {}),
        ...(status ? { status } : { status: { not: "DRAFT" } }),
        ...(branchId ? { branchId } : {}),
        ...(roomId ? { roomId } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      include: {
        organizer: { select: { id: true, fullName: true, avatarUrl: true } },
        room: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        participants: { select: { userId: true } },
        _count: { select: { participants: true, guests: true } },
      },
      orderBy: { startAt: "asc" },
      take: Math.min(Number(sp.get("limit") ?? 200), 500),
    });
    const viewer = { id: user.id, isSuperAdmin: !!user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN") };
    const masked = meetings.map((m) => maskPrivateMeeting(m, viewer));
    return ok({ meetings: masked });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!can(user, "meeting:create")) {
      return Response.json(
        { ok: false, error: { message: "دسترسی لازم را ندارید", code: "FORBIDDEN" } },
        { status: 403 },
      );
    }
    const body = await req.json();
    const input = meetingCreateSchema.parse(body);

    const meeting = await createMeeting({
      title: input.title,
      description: input.description,
      branchId: input.branchId,
      roomId: input.roomId ?? undefined,
      organizerId: user.id,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      meetingType: input.meetingType,
      priority: input.priority,
      isPrivate: input.isPrivate,
      participantIds: input.participantIds,
      guests: input.guests
        .filter((g) => g.name)
        .map((g) => ({
          name: g.name,
          company: g.company || undefined,
          phone: g.phone || undefined,
          email: g.email || undefined,
          notes: g.notes || undefined,
        })),
    });

    await audit({
      actorId: user.id,
      action: "CREATE",
      entity: "Meeting",
      entityId: meeting.id,
      newValue: { title: meeting.title, startAt: meeting.startAt, roomId: meeting.roomId },
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    return ok({ meeting }, 201);
  } catch (e) {
    return handleError(e);
  }
}
