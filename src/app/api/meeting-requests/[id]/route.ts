import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, fail, handleError, audit } from "@/server/http";

export const dynamic = "force-dynamic";

const scheduleSchema = z.object({
  branchId: z.string().min(1),
  roomId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  meetingType: z.enum(["INTERNAL", "EXTERNAL", "CROSS_TEAM"]).default("INTERNAL"),
});

function canSchedule(user: { isSuperAdmin?: boolean; roleKeys: string[] }) {
  return (
    !!user.isSuperAdmin ||
    user.roleKeys.some((r) => ["SUPER_ADMIN", "ADMIN", "MEETING_OPERATOR"].includes(r))
  );
}


/** PATCH /api/meeting-requests/[id] — reject (admin) or cancel (requester) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = (body.action ?? "") as string;
    const adminNote = typeof body.adminNote === "string" ? body.adminNote.slice(0, 500) : null;

    const request = await prisma.meetingRequest.findUnique({ where: { id } });
    if (!request) return fail(404, "درخواست یافت نشد", "NOT_FOUND");

    if (action === "reject") {
      if (!canSchedule(user)) return fail(403, "دسترسی لازم را ندارید", "FORBIDDEN");
      if (request.status !== "OPEN") return fail(409, "قبلاً پردازش شده", "ALREADY_HANDLED");
      const updated = await prisma.meetingRequest.update({
        where: { id },
        data: { status: "REJECTED", adminNote },
      });
      await audit({
        actorId: user.id,
        action: "meeting-request.reject",
        entity: "MeetingRequest",
        entityId: id,
      });
      return ok({ request: updated });
    }

    if (action === "cancel") {
      if (request.requesterId !== user.id && !canSchedule(user))
        return fail(403, "دسترسی لازم را ندارید", "FORBIDDEN");
      const updated = await prisma.meetingRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      return ok({ request: updated });
    }

    return fail(400, "عملیات نامعتبر", "BAD_REQUEST");
  } catch (e) {
    return handleError(e);
  }
}
