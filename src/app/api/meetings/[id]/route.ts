import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, fullName: true, avatarUrl: true, jobTitle: true } },
        room: {
          select: {
            id: true, name: true, capacity: true, floorId: true,
            floor: { select: { name: true, number: true } },
          },
        },
        branch: { select: { id: true, name: true } },
        participants: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true, jobTitle: true, department: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        guests: true,
        approvals: {
          include: { actor: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: "asc" },
        },
        events: {
          orderBy: { createdAt: "asc" },
        },
        reminders: {
          where: { userId: user.id },
          orderBy: { remindAt: "asc" },
        },
      },
    });

    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");

    // IDOR protection: private meetings only for participants/organizer/view-all
    const isParticipant =
      meeting.organizerId === user.id ||
      meeting.participants.some((p) => p.userId === user.id);
    const isSuper = !!user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN");
    if (!isParticipant && !isSuper && meeting.isPrivate) {
      throw new HttpError(403, "دسترسی به این جلسه ندارید", "FORBIDDEN");
    }

    return ok({ meeting });
  } catch (e) {
    return handleError(e);
  }
}
