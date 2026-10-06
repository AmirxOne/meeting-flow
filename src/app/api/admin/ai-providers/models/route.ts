import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { z } from "zod";
import { fetchProviderModels } from "@/server/services/ai-provider.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  providerId: z.string().optional(), // پروایدر ذخیره‌شده
  specId: z.string().optional(), // یا مستقیم از فرمِ در حال تکمیل
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
});

/** POST — کشف مدل‌های واقعی پروایدر. کلید خام در پاسخ برنمی‌گردد. */
export async function POST(req: NextRequest) {
  try {
    await requirePermission("org:manage");
    const input = schema.parse(await req.json().catch(() => ({})));
    return ok(await fetchProviderModels(input));
  } catch (e) {
    return handleError(e);
  }
}
