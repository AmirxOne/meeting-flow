import { NextRequest } from "next/server";
import { orgSetupSchema } from "@/lib/validations";
import { handleError } from "@/server/http";
import { bootstrapOrganization } from "@/server/services/platform-setup.service";
import { buildLoginResponse } from "@/server/auth/login-response";

export const dynamic = "force-dynamic";

/** POST /api/public/setup — first organization bootstrap (only when DB is empty). */
export async function POST(req: NextRequest) {
  try {
    const input = orgSetupSchema.parse(await req.json().catch(() => ({})));
    const result = await bootstrapOrganization(input);
    return await buildLoginResponse(
      {
        id: result.adminUserId,
        email: result.adminEmail,
        fullName: result.adminFullName,
        jobTitle: "مدیر سازمان",
      },
      result.orgSlug,
    );
  } catch (e) {
    return handleError(e);
  }
}
