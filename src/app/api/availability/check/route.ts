import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { prisma } from "@/server/db";
import { checkConflicts } from "@/server/services/meeting.service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  startAt: z.string().min(10),
  endAt: z.string().min(10),
  participantIds: z.array(z.string()).default([]),
  branchId: z.string().optional(),
});

/**
 * POST /api/availability/check — بررسی آزادی یک بازه‌ی دستی برای افراد + اتاق‌های شعبه.
 * free=true فقط وقتی هیچ تداخل سختی (اتاق) و نرمی (افراد) نباشد.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = bodySchema.parse(await req.json().catch(() => ({})));
    const start = new Date(input.startAt);
    const end = new Date(input.endAt);
    if (!(end > start)) return ok({ free: false, conflicts: [{ kind: "INVALID_RANGE" }] });

    // userId های اعضا از PersonDirectory (ورودی کلاینت id دایرکتوری است)
    const dirIds = input.participantIds.filter(Boolean);
    const dirPeople = dirIds.length
      ? await prisma.personDirectory.findMany({ where: { id: { in: dirIds } }, select: { id: true, userId: true } })
      : [];
    const userIds = dirPeople.map((d) => d.userId).filter((x): x is string => !!x);

    // individuals (organizer + participants)
    const indiv = await checkConflicts({
      organizerId: user.id,
      participantIds: userIds,
      startAt: start,
      endAt: end,
      orgId: user.orgId,
    });

    // اتاق آزاد در شعبه؟ اگر حداقل یک اتاق بدون تداخل باشد، از نظر اتاق آزاد است
    let roomFree = true;
    if (input.branchId) {
      const rooms = await prisma.meetingRoom.findMany({
        where: { orgId: user.orgId, branchId: input.branchId, isActive: true },
        select: { id: true },
      });
      const results = await Promise.all(
        rooms.map((r) => checkConflicts({ roomId: r.id, organizerId: user.id, participantIds: [], startAt: start, endAt: end, orgId: user.orgId })),
      );
      roomFree = results.some((r) => r.hard.length === 0);
    }

    const conflicts = [
      ...indiv.soft.map((c) => ({ kind: "USER", label: c.meetingTitle ?? "" })),
      ...(roomFree ? [] : [{ kind: "ROOM", label: "" }]),
    ];
    return ok({ free: conflicts.length === 0, conflicts });
  } catch (e) {
    return handleError(e);
  }
}
