import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { ssoSettingsUpdateSchema } from "@/lib/validations";
import { getSsoAdminStatus, updateSsoPolicy } from "@/server/auth/sso-settings.service";
import { publicOrigin } from "@/server/services/ics-feed.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/sso — OIDC status + group mapping (org:manage). Secrets are never returned. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requirePermission("org:manage");
    const status = await getSsoAdminStatus(publicOrigin(req), actor.orgId);
    return ok(status);
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/admin/sso — toggle, button label, group→role map. Client secret stays in env. */
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission("org:manage");
    const input = ssoSettingsUpdateSchema.parse(await req.json().catch(() => ({})));
    const policy = await updateSsoPolicy(actor.id, input, actor.orgId);
    await audit({
      actorId: actor.id,
      action: "UPDATE",
      entity: "SsoSettings",
      entityId: "sso",
      newValue: {
        enabled: policy.enabled,
        buttonLabel: policy.buttonLabel,
        groupCount: Object.keys(policy.groupRoleMap).length,
      },
      ip: req.headers.get("x-forwarded-for"),
    });
    const status = await getSsoAdminStatus(publicOrigin(req), actor.orgId);
    return ok(status);
  } catch (e) {
    return handleError(e);
  }
}
