import { parseAuthMethods } from "@/server/auth/auth-config";
import { ok } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/auth/config — public auth mode for login UI. */
export async function GET() {
  const methods = parseAuthMethods();
  return ok({
    authMode: [...methods].sort().join(","),
    methods: [...methods],
    localEnabled: methods.has("local"),
    ldapEnabled: methods.has("ldap"),
    ssoEnabled: false, // SSO حذف شد — فقط local و ldap
    passwordResetEnabled: methods.has("local"),
  });
}
