import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { z } from "zod";
import { getAiSettings, saveAiSettings } from "@/server/services/llm-client.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  activeProviderId: z.string().nullable().optional(),
  fallbackProviderId: z.string().nullable().optional(),
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
    return ok({ settings: await saveAiSettings(input) });
  } catch (e) {
    return handleError(e);
  }
}
