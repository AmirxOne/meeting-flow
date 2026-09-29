import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET — شمارش درخواست‌های در انتظار هماهنگی (badge سایدبار ادمین) */
export async function GET(_req: NextRequest) {
  try {
    const user = await requireUser();
    const isQueueViewer =
      !!user.isSuperAdmin ||
      user.roleKeys.some((r) => ["SUPER_ADMIN", "ADMIN", "MEETING_OPERATOR"].includes(r));
    if (!isQueueViewer) return ok({ openCount: 0 });
    const openCount = await prisma.meetingRequest.count({
      where: { orgId: user.orgId, status: "OPEN" },
    });
    return ok({ openCount });
  } catch (e) {
    return handleError(e);
  }
}
