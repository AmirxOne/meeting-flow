import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { smsTestSchema } from "@/lib/validations";
import { getSmsAdminStatus, sendSmsTest } from "@/server/services/sms-status.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/sms — Kavenegar/mock status + last reminder send (org:manage). */
export async function GET() {
  try {
    const actor = await requirePermission("org:manage");
    return ok(await getSmsAdminStatus(actor.orgId));
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/admin/sms — send a one-number pilot test (org:manage). */
export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("org:manage");
    const input = smsTestSchema.parse(await req.json().catch(() => ({})));
    try {
      const result = await sendSmsTest(input.phone);
      await audit({
        actorId: actor.id,
        action: "SMS_TEST",
        entity: "Sms",
        entityId: actor.orgId,
        newValue: { ok: true, receptor: result.receptor, provider: result.provider },
        ip: req.headers.get("x-forwarded-for"),
      });
      return ok(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : "ارسال ناموفق";
      await audit({
        actorId: actor.id,
        action: "SMS_TEST",
        entity: "Sms",
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
