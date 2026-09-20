import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { emailTestSchema } from "@/lib/validations";
import { getEmailAdminStatus, sendEmailTest } from "@/server/services/email-status.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/email — SMTP/mock status + config checklist (org:manage). */
export async function GET() {
  try {
    const actor = await requirePermission("org:manage");
    return ok(await getEmailAdminStatus(actor.orgId));
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/admin/email — send a one-address pilot test (org:manage). */
export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("org:manage");
    const input = emailTestSchema.parse(await req.json().catch(() => ({})));
    try {
      const result = await sendEmailTest(input.email);
      await audit({
        actorId: actor.id,
        action: "EMAIL_TEST",
        entity: "Email",
        entityId: actor.orgId,
        newValue: { ok: true, to: input.email, provider: result.provider },
        ip: req.headers.get("x-forwarded-for"),
      });
      return ok(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : "ارسال ناموفق";
      await audit({
        actorId: actor.id,
        action: "EMAIL_TEST",
        entity: "Email",
        entityId: actor.orgId,
        newValue: { ok: false, error: message.slice(0, 300) },
        ip: req.headers.get("x-forwarded-for"),
      }).catch(() => undefined);
      throw e;
    }
  } catch (e) {
    return handleError(e);
  }
}
