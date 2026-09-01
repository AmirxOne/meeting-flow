import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/server/http";
import { runWorkerTickWithHeartbeat } from "@/server/services/worker-tick.service";
import { isWorkerTickEnabled, verifyWorkerTickSecret } from "@/server/worker-tick-auth";

export const dynamic = "force-dynamic";

/** POST /api/internal/worker-tick — cron fallback when standalone worker is not running. */
export async function POST(req: NextRequest) {
  try {
    if (!isWorkerTickEnabled()) {
      return fail(503, "WORKER_TICK_SECRET تنظیم نشده است", "DISABLED");
    }
    if (!verifyWorkerTickSecret(req)) {
      return fail(401, "دسترسی مجاز نیست", "UNAUTHORIZED");
    }
    const result = await runWorkerTickWithHeartbeat("cron");
    return ok(result);
  } catch (e) {
    return handleError(e, { source: "worker-tick" });
  }
}
