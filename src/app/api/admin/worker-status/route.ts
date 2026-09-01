import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { getWorkerAdminStatus } from "@/server/services/worker-status.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/worker-status — worker heartbeat + reminder stats (org:manage). */
export async function GET() {
  try {
    await requirePermission("org:manage");
    return ok(await getWorkerAdminStatus());
  } catch (e) {
    return handleError(e);
  }
}
