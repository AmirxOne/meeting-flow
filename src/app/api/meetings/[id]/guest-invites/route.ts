import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { audit, handleError, ok } from "@/server/http";
import { prisma } from "@/server/db";
import { sendGuestInvites } from "@/server/services/guest-invite.service";

export const dynamic = "force-dynamic";

/** POST /api/meetings/[id]/guest-invites — (re)send invitations to external guests (organizer/admin). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId: user.orgId },
      select: {
        id: true,
        organizerId: true,
        isPrivate: true,
        title: true,
        startAt: true,
        endAt: true,
        videoUrl: true,
        roomId: true,
        description: true,
        orgId: true,
      },
    });
    if (!meeting) return Response.json({ ok: false, error: { message: "جلسه یافت نشد", code: "NOT_FOUND" } }, { status: 404 });

    const mayManage =
      meeting.organizerId === user.id ||
      (user.permissions.has("meeting:update") && user.permissions.has("meeting:view-all"));
    if (!mayManage) {
      return Response.json(
        { ok: false, error: { message: "فقط برگزارکننده یا مدیر می‌تواند دعوت‌نامه بفرستد", code: "FORBIDDEN" } },
        { status: 403 },
      );
    }

    const results = await sendGuestInvites(meeting as never, user.id, req.headers.get("x-forwarded-for"));
    await audit({
      actorId: user.id,
      action: "GUEST_INVITE_RESEND",
      entity: "Meeting",
      entityId: id,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({
      sent: results.filter((r) => r.phoneSent || r.emailSent).length,
      failed: results.filter((r) => !r.phoneSent && !r.emailSent).length,
      results,
    });
  } catch (e) {
    return handleError(e);
  }
}
