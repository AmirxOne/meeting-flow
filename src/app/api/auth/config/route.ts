import { parseAuthMethods } from "@/server/auth/auth-config";
import { DEFAULT_SSO_BUTTON_LABEL } from "@/server/auth/oidc-config";
import { isSsoLoginEnabled, loadSsoPolicy } from "@/server/auth/sso-settings.service";
import { ok } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/auth/config — public auth mode for login UI. */
export async function GET() {
  const methods = parseAuthMethods();
  const ssoEnabled = await isSsoLoginEnabled();
  let ssoLabel = DEFAULT_SSO_BUTTON_LABEL;
  if (methods.has("sso")) {
    try {
      ssoLabel = (await loadSsoPolicy()).buttonLabel;
    } catch {
      /* env default */
    }
  }
  return ok({
    authMode: [...methods].sort().join(","),
    methods: [...methods],
    localEnabled: methods.has("local"),
    ldapEnabled: methods.has("ldap"),
    ssoEnabled,
    ssoLabel,
    passwordResetEnabled: methods.has("local"),
  });
}
