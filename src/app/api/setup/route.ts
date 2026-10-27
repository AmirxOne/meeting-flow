import { NextRequest } from "next/server";
import { orgSetupSchema } from "@/lib/validations";
import { handleError } from "@/server/http";
import { bootstrapOrganization } from "@/server/services/platform-setup.service";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/setup — راه‌اندازی اولیه‌ی سازمان.
 * امنیت: فقط کاربر لاگین‌شده؛ همان کاربر ادمین سازمان می‌شود (حساب جدید ساخته نمی‌شود).
 * فقط وقتی DB هنوز سازمانی ندارد (SETUP_CLOSED وگرنه).
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(); // 401 اگر لاگین نیست
    const input = orgSetupSchema.parse(await req.json().catch(() => ({})));
    const result = await bootstrapOrganization(input, actor.id);
    return Response.json({
      ok: true,
      data: {
        organization: { id: result.orgId, slug: result.orgSlug, name: result.orgName },
        admin: { id: result.adminUserId, email: result.adminEmail, fullName: result.adminFullName },
        branch: { id: result.branchId },
        room: { id: result.roomId },
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
