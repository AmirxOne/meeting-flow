import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { z } from "zod";
import { testProvider } from "@/server/services/ai-provider.service";

export const dynamic = "force-dynamic";

/** POST — تست اتصال واقعی؛ کلید از DB، هرگز به پاسخ اضافه نمی‌شود. */
export async function POST(req: NextRequest) {
  try {
    await requirePermission("org:manage");
    const { id } = z.object({ id: z.string() }).parse(await req.json().catch(() => ({})));
    return ok(await testProvider(id));
  } catch (e) {
    return handleError(e);
  }
}
