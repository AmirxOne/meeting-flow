import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";

/**
 * POST /api/meetings/:id/attendance — حضورغیاب توسط برگزارکننده
 * body: { marks: [{ userId, status }] } — یک‌جا برای همه یا تک‌تک
 * status: PRESENT | LATE | ABSENT | EXCUSED (یا null برای پاک‌کردن علامت)
 */
const markSchema = z
  .object({
    userId: z.string().min(1).optional(),
    guestId: z.string().min(1).optional(),
    status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]).nullish(),
  })
  .refine((m) => Boolean(m.userId ?? m.guestId), { message: "userId یا guestId لازم است" });

const bodySchema = z.object({ marks: z.array(markSchema).min(1).max(100) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { marks } = bodySchema.parse(await req.json().catch(() => ({})));

    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId: user.orgId },
      select: {
        id: true,
        organizerId: true,
        status: true,
        participants: { select: { userId: true } },
        guests: { select: { id: true } },
      },
    });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");

    // only the organizer (or super admin) takes attendance
    if (meeting.organizerId !== user.id && !user.isSuperAdmin) {
      throw new HttpError(403, "فقط برگزارکننده جلسه می‌تواند حضورغیاب ثبت کند", "FORBIDDEN");
    }

    const memberIds = new Set(meeting.participants.map((p) => p.userId));
    const guestIds = new Set(meeting.guests.map((g) => g.id));
    for (const m of marks) {
      if (m.userId && !memberIds.has(m.userId)) {
        throw new HttpError(400, "کاربر انتخاب‌شده شرکت‌کننده این جلسه نیست", "BAD_PARTICIPANT");
      }
      if (m.guestId && !guestIds.has(m.guestId)) {
        throw new HttpError(400, "مهمان انتخاب‌شده متعلق به این جلسه نیست", "BAD_GUEST");
      }
    }

    const now = new Date();
    for (const m of marks) {
      const data = {
        attendanceStatus: m.status ?? null,
        attendanceMarkedAt: m.status ? now : null,
        attendanceMarkedById: m.status ? user.id : null,
      };
      if (m.userId) {
        await prisma.meetingParticipant.update({
          where: { meetingId_userId: { meetingId: id, userId: m.userId } },
          data,
        });
      } else if (m.guestId) {
        await prisma.meetingGuest.update({ where: { id: m.guestId }, data });
      }
    }

    await audit({
      actorId: user.id,
      action: "ATTENDANCE_MARK",
      entity: "Meeting",
      entityId: id,
      newValue: { marks: marks.map((m) => ({ userId: m.userId, guestId: m.guestId, status: m.status })) },
    });

    const [participants, guests] = await Promise.all([
      prisma.meetingParticipant.findMany({
        where: { meetingId: id },
        select: {
          userId: true,
          attendanceStatus: true,
          attendanceMarkedAt: true,
          attendanceMarkedBy: { select: { id: true, fullName: true } },
        },
      }),
      prisma.meetingGuest.findMany({
        where: { meetingId: id },
        select: {
          id: true,
          name: true,
          attendanceStatus: true,
          attendanceMarkedAt: true,
          attendanceMarkedBy: { select: { id: true, fullName: true } },
        },
      }),
    ]);
    return ok({ participants, guests });
  } catch (e) {
    return handleError(e);
  }
}

/** GET — خلاصه حضورغیاب (همه‌ی شرکت‌کنندگان جلسه می‌بینند) */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId: user.orgId },
      select: { id: true, organizerId: true, participants: { select: { userId: true } } },
    });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
    const isMember = meeting.organizerId === user.id || meeting.participants.some((p) => p.userId === user.id);
    if (!isMember && !user.isSuperAdmin) {
      throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    }
    const [rows, guests] = await Promise.all([
      prisma.meetingParticipant.findMany({
        where: { meetingId: id },
        select: {
          userId: true,
          attendanceStatus: true,
          attendanceMarkedAt: true,
          attendanceMarkedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.meetingGuest.findMany({
        where: { meetingId: id },
        select: {
          id: true,
          name: true,
          attendanceStatus: true,
          attendanceMarkedAt: true,
          attendanceMarkedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return ok({ attendance: rows, guests });
  } catch (e) {
    return handleError(e);
  }
}
