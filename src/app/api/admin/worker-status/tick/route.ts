import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { runWorkerTickWithHeartbeat } from "@/server/services/worker-tick.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/worker-status/tick — admin-triggered worker tick.
 * Runs the same logic as the background worker (reminders + lifecycle +
 * waitlist) once, from the web server. Escape hatch when the standalone
 * worker is down: reminders catch up immediately.
 */
export async function POST() {
  try {
    await requirePermission("org:manage");
    const result = await runWorkerTickWithHeartbeat("admin");
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
