import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, HttpError } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

const schema = z.object({ ids: z.array(z.string()).optional() });

/** POST /api/notifications/read — mark specific (or all) as read. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = schema.parse(await req.json().catch(() => ({})));

    if (input.ids && input.ids.length > 0) {
      // only the owner's notifications — IDOR-safe
      const result = await prisma.notification.updateMany({
        where: { id: { in: input.ids }, userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return ok({ marked: result.count });
    }

    const result = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ marked: result.count });
  } catch (e) {
    return handleError(e);
  }
}
