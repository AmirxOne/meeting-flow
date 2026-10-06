import { ok, handleError } from "@/server/http";
import { isAiUsable, getAiSettings } from "@/server/services/llm-client.service";

export const dynamic = "force-dynamic";

/** GET — وضعیت AI برای گیت سمت کلاینت؛ کاربر عادی فقط usable می‌بیند. */
export async function GET() {
  try {
    const usable = await isAiUsable();
    return ok({ usable });
  } catch (e) {
    return handleError(e);
  }
}
