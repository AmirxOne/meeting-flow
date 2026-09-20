import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/server/auth/session";
import { audit, handleError, ok } from "@/server/http";
import { prisma } from "@/server/db";


export const dynamic = "force-dynamic";

const MESSAGE_SELECT = {
  id: true,
  userId: true,
  body: true,
  createdAt: true,
  user: { select: { id: true, fullName: true, avatarUrl: true, jobTitle: true } },
} as const;

async function loadMeetingForChat(meetingId: string, orgId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, orgId },
    select: {
      id: true,
      organizerId: true,
      isPrivate: true,
      title: true,
      participants: { select: { userId: true } },
    },
  });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
  return meeting;
}

/** GET /api/meetings/[id]/messages — chat log (organizer/participant only; admins with view-all) */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await loadMeetingForChat(id, user.orgId);

    const isInvolved =
      meeting.organizerId === user.id ||
      meeting.participants.some((p) => p.userId === user.id);
    const viewAll = user.permissions.has("meeting:view-all");
    if (!isInvolved && !viewAll) {
      throw new HttpError(403, "دسترسی به گفتگوی این جلسه ندارید", "FORBIDDEN");
    }

    const messages = await prisma.meetingMessage.findMany({
      where: { meetingId: id },
      select: MESSAGE_SELECT,
      orderBy: { createdAt: "asc" },
      take: 300,
    });
    return ok({ messages });
  } catch (e) {
    return handleError(e);
  }
}

const postSchema = z.object({
  body: z.string().trim().min(1, "پیام خالی است").max(2000, "پیام طولانی است"),
});

/** POST /api/meetings/[id]/messages — send a chat message (organizer/participant only) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await loadMeetingForChat(id, user.orgId);

    const isInvolved =
      meeting.organizerId === user.id ||
      meeting.participants.some((p) => p.userId === user.id);
    if (!isInvolved) {
      throw new HttpError(403, "فقط برگزارکننده و شرکت‌کنندگان می‌توانند پیام بفرستند", "FORBIDDEN");
    }

    const input = postSchema.parse(await req.json());
    const message = await prisma.meetingMessage.create({
      data: { meetingId: id, userId: user.id, body: input.body },
      select: MESSAGE_SELECT,
    });

    // notify the other side (organizer + participants, minus sender)
    const recipients = new Set<string>([
      meeting.organizerId,
      ...meeting.participants.map((p) => p.userId),
    ]);
    recipients.delete(user.id);
    if (recipients.size > 0) {
      await prisma.notification.createMany({
        data: [...recipients].map((userId) => ({
          orgId: user.orgId,
          userId,
          type: "MEETING_MESSAGE",
          title: "پیام جدید در جلسه",
          body: `${user.fullName} در «${meeting.title}»: ${input.body.slice(0, 120)}`,
          data: { link: `/meetings/${id}` },
        })),
      });
    }

    await audit({
      actorId: user.id,
      action: "MEETING_MESSAGE_SENT",
      entity: "Meeting",
      entityId: id,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ message }, 201);
  } catch (e) {
    return handleError(e);
  }
}
