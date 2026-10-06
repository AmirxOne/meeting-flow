import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { z } from "zod";
import { getAiSettings, saveAiSettings, samePair } from "@/server/services/llm-client.service";
import { listProviders } from "@/server/services/ai-provider.service";
import { HttpError } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  activeProviderId: z.string().nullable().optional(),
  fallbackProviderId: z.string().nullable().optional(),
  fallbackModel: z.string().nullable().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(50).max(32000).optional(),
});

/** GET/POST — تنظیمات LLM (پروایدر فعال + fallback). */
export async function GET() {
  try {
    await requirePermission("org:manage");
    return ok({ settings: await getAiSettings() });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("org:manage");
    const input = schema.parse(await req.json().catch(() => ({})));
    // اعتبارسنجی: پشتیبان نباید همان (پروایدر + مدل) فعال باشد
    const merged = { ...(await getAiSettings()), ...input };
    const provs = await listProviders();
    const active = provs.find((p) => p.id === merged.activeProviderId);
    const fb = provs.find((p) => p.id === merged.fallbackProviderId);
    if (active && fb && samePair(
      { providerId: active.id, model: active.model },
      { providerId: fb.id, model: merged.fallbackModel ?? fb.model },
    )) {
      throw new HttpError(409, "پروایدر پشتیبان نباید دقیقاً همان مدلِ پروایدر فعال باشد — مدل دیگری انتخاب کنید");
    }
    return ok({ settings: await saveAiSettings(input) });
  } catch (e) {
    return handleError(e);
  }
}
