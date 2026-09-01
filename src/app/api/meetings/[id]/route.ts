import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser, HttpError } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { waitlistMeta } from "@/server/services/waitlist.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId: user.orgId },
      include: {
        organizer: { select: { id: true, fullName: true, avatarUrl: true, jobTitle: true } },
        createdBy: { select: { id: true, fullName: true } },
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
        series: {
          select: {
            id: true,
            freq: true,
            interval: true,
            byWeekday: true,
            until: true,
            count: true,
            dtstart: true,
            title: true,
            isPrivate: true,
          },
        },
        attachments: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
            uploadedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        agendaItems: {
          select: {
            id: true,
            sortOrder: true,
            title: true,
            durationMin: true,
            ownerId: true,
            owner: { select: { id: true, fullName: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
        minutes: {
          select: {
            id: true,
            body: true,
            publishedAt: true,
            updatedAt: true,
            publishedBy: { select: { id: true, fullName: true } },
            decisions: {
              select: {
                id: true,
                sortOrder: true,
                text: true,
                ownerId: true,
                dueAt: true,
                owner: { select: { id: true, fullName: true } },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");

    // IDOR protection: private meetings only for participants/organizer/view-all
    const isParticipant =
      meeting.organizerId === user.id ||
      meeting.createdById === user.id ||
      meeting.participants.some((p) => p.userId === user.id);
    const isSuper = !!user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN");
    if (!isParticipant && !isSuper && meeting.isPrivate) {
      throw new HttpError(403, "دسترسی به این جلسه ندارید", "FORBIDDEN");
    }

    return ok({ meeting, waitlist: await waitlistMeta(meeting) });
  } catch (e) {
    return handleError(e);
  }
}
