import { ok, handleError } from "@/server/http";
import { platformNeedsSetup } from "@/server/services/platform-setup.service";

export const dynamic = "force-dynamic";

/** GET /api/public/setup-status — true when DB has no organizations (first-run wizard). */
export async function GET() {
  try {
    const needsSetup = await platformNeedsSetup();
    return ok({ needsSetup });
  } catch (e) {
    return handleError(e);
  }
}
