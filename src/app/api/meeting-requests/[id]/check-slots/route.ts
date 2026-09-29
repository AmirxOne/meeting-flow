import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, fail, handleError } from "@/server/http";
import { findRoomConflicts, findUserConflicts } from "@/server/services/conflict.service";

export const dynamic = "force-dynamic";

const checkSchema = z.object({
  roomId: z.string().optional(),
  slots: z.array(z.object({ from: z.string().datetime(), to: z.string().datetime() })).max(10),
});

/**
 * POST /api/meeting-requests/[id]/check-slots — availability check for each
 * proposed slot of the request: room conflicts (if roomId given) and
 * requester/participant conflicts. Returns per-slot ok/reasons so the
 * scheduler UI can auto-pick the first conflict-free option.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = checkSchema.parse(await req.json().catch(() => ({})));

    const request = await prisma.meetingRequest.findFirst({
      where: { id, orgId: user.orgId },
      include: { requester: { select: { id: true } } },
    });
    if (!request) return fail(404, "درخواست یافت نشد", "NOT_FOUND");

    // participants: PersonDirectory ids → user ids (same resolution as schedule)
    const rawIds: string[] = Array.isArray(request.participantIds) ? request.participantIds : [];
    let userIds: string[] = [];
    if (rawIds.length > 0) {
      const dirRows = await prisma.personDirectory.findMany({
        where: { id: { in: rawIds }, orgId: request.orgId },
        select: { userId: true },
      });
      userIds = dirRows.map((r) => r.userId).filter((x): x is string => Boolean(x));
    }
    if (request.requesterId) userIds.push(request.requesterId);
    userIds = Array.from(new Set(userIds));

    const durationMin = request.durationMin ?? 60;

    const results = await Promise.all(
      input.slots.map(async (sl) => {
        const from = new Date(sl.from);
        // meeting occupies the first durationMin of the window (or the whole window if shorter)
        const end = new Date(Math.min(from.getTime() + durationMin * 60000, new Date(sl.to).getTime()));
        if (end <= from) return { from: sl.from, to: sl.to, ok: false, reasons: ["بازه‌ی نامعتبر"] };

        const reasons: string[] = [];
        if (input.roomId) {
          const roomConflicts = await findRoomConflicts(input.roomId, from, end);
          for (const c of roomConflicts) {
            reasons.push(`اتاق درگیر است (${c.isPrivate ? "جلسه محرمانه" : c.meetingTitle})`);
          }
        }
        if (userIds.length > 0) {
          const userConflicts = await findUserConflicts(userIds, from, end);
          for (const c of userConflicts) {
            reasons.push(`تداخل برنامه‌ی ${c.isPrivate ? "شرکت‌کننده" : "شرکت‌کننده با «" + c.meetingTitle + "»"}`);
          }
        }
        return { from: sl.from, to: sl.to, ok: reasons.length === 0, reasons: Array.from(new Set(reasons)).slice(0, 3) };
      }),
    );

    return ok({ slots: results });
  } catch (e) {
    return handleError(e);
  }
}
