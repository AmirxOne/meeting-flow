import { parseAuthMode } from "@/server/auth/auth-config";
import { ok } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/auth/config — public auth mode for login UI. */
export async function GET() {
  const mode = parseAuthMode();
  return ok({
    authMode: mode,
    ldapEnabled: mode === "ldap",
  });
}
