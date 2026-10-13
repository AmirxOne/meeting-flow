import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { prisma } from "@/server/db";
import { z } from "zod";
import { findRoomConflicts, findUserConflicts } from "@/server/services/conflict.service";

export const dynamic = "force-dynamic";

/** کلید تاریخ محلی YYYY-MM-DD (نه UTC) */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const schema = z.object({
  roomIds: z.array(z.string()).min(1),
  daysAhead: z.number().int().min(1).max(30).default(14),
});

/**
 * POST — پیش‌نمایش زنده هنگام ساخت برنامه:
 * برای هر روزِ ۱۴ روز آینده → بازه‌های آزادِ مسئول (خودِ کاربر)
 * + تعداد اتاقِ هم‌زمانِ آزاد در هر ساعت کاری (۹–۱۸).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = schema.parse(await req.json().catch(() => ({})));

    const days: {
      date: string;
      weekday: number;
      hostFree: { from: string; to: string }[];
      roomFree: Record<string, { from: string; to: string; freeRooms: number }[]>;
    }[] = [];

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    for (let d = 0; d < input.daysAhead; d++) {
      const date = new Date(dayStart.getTime() + d * 86400000);
      const dayFrom = new Date(date);
      dayFrom.setHours(8, 0, 0, 0);
      const dayTo = new Date(date);
      dayTo.setHours(19, 0, 0, 0);

      // مشغولیت مسئول (برگزارکننده/مشارکت)
      const busy = await findUserConflicts([user.id], dayFrom, dayTo);
      // بازه‌های آزاد از ۹ تا ۱۸
      const free: { from: string; to: string }[] = [];
      let cur = new Date(date);
      cur.setHours(9, 0, 0, 0);
      const endWork = new Date(date);
      endWork.setHours(18, 0, 0, 0);
      while (cur < endWork) {
        const slotEnd = new Date(Math.min(cur.getTime() + 30 * 60000, endWork.getTime()));
        const isBusy = busy.some((b) => cur.getTime() < new Date(b.endAt).getTime() && new Date(b.startAt).getTime() < slotEnd.getTime());
        if (!isBusy) {
          const last = free[free.length - 1];
          if (last && new Date(last.to).getTime() === cur.getTime()) last.to = slotEnd.toISOString();
          else free.push({ from: cur.toISOString(), to: slotEnd.toISOString() });
        }
        cur = slotEnd;
      }

      // آزادی اتاق‌ها در همان گرید ۳۰ دقیقه‌ای — روی هر اتاق چک
      const roomFree: Record<string, { from: string; to: string; freeRooms: number }[]> = {};
      cur = new Date(date);
      cur.setHours(9, 0, 0, 0);
      while (cur < endWork) {
        const slotEnd = new Date(Math.min(cur.getTime() + 30 * 60000, endWork.getTime()));
        let freeCount = 0;
        await Promise.all(
          input.roomIds.map(async (rid) => {
            const cs = await findRoomConflicts(rid, cur, slotEnd);
            if (cs.length === 0) freeCount++;
          }),
        );
        if (freeCount > 0) {
          const key = localDateKey(cur);
          roomFree[key] = roomFree[key] ?? [];
          const last = roomFree[key][roomFree[key].length - 1];
          if (last && new Date(last.to).getTime() === cur.getTime() && last.freeRooms === freeCount) last.to = slotEnd.toISOString();
          else roomFree[key].push({ from: cur.toISOString(), to: slotEnd.toISOString(), freeRooms: freeCount });
        }
        cur = slotEnd;
      }

      days.push({
        date: localDateKey(date),
        weekday: date.getDay(),
        hostFree: free,
        roomFree,
      });
    }

    return ok({ days });
  } catch (e) {
    return handleError(e);
  }
}
