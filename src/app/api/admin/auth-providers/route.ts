import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { z } from "zod";
import { buildProviders } from "@/server/auth/provider-registry";
import { resolveLdapConfig } from "@/server/auth/auth-config";

export const dynamic = "force-dynamic";

/** GET /api/admin/auth-providers — وضعیت روش‌های ورود (بدون Secret) */
export async function GET() {
  try {
    await requirePermission("org:manage");
    const providers = buildProviders().map((p) => ({
      id: p.id,
      label: p.label,
      enabled: p.isEnabled(),
    }));

    // اطلاعات غیرحساس LDAP — اگر تنظیم است
    let ldapInfo: Record<string, unknown> | null = null;
    try {
      const cfg = resolveLdapConfig();
      ldapInfo = {
        url: cfg.url,
        baseDn: cfg.baseDn,
        bindDn: cfg.bindDn,
        userFilter: cfg.userFilter,
        tlsRejectUnauthorized: cfg.tlsRejectUnauthorized,
        // bindPassword هرگز بازگردانده نمی‌شود
      };
    } catch {
      ldapInfo = null; // تنظیم نیست
    }

    return ok({ providers, ldap: ldapInfo, source: "env" });
  } catch (e) {
    return handleError(e);
  }
}

const testSchema = z.object({
  action: z.literal("test-connection"),
  /** فقط برای test-search — ایمیل نمونه، از دایرکتوری جست‌وجو می‌شود */
  sampleEmail: z.string().email().optional(),
});

/**
 * POST /api/admin/auth-providers — تست اتصال/جست‌وجوی LDAP.
 * Secret جایی لاگ یا پاس داده نمی‌شود.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("org:manage");
    const input = testSchema.parse(await req.json().catch(() => ({})));

    if (input.action === "test-connection") {
      let cfg;
      try {
        cfg = resolveLdapConfig();
      } catch {
        return ok({
          ok: false,
          message: "تنظیمات LDAP کامل نیست — LDAP_URL، LDAP_BASE_DN و LDAP_BIND_DN لازم است",
        });
      }

      // dynamic import — کتابخانه فقط وقتی لود شود که واقعاً تست می‌کنیم
      const { createLdapClient } = await import("@/server/auth/ldap-client");
      try {
        const client = createLdapClient();
        if (input.sampleEmail) {
          const profile = await client.authenticate(input.sampleEmail, "__test_no_match__");
          // رمز غلط → اگر کاربر پیدا شد bind user ناموفق = دایرکتوری سالم
          const found = profile === null ? "searched" : "bound";
          await audit({ actorId: actor.id, action: "LDAP_TEST", entity: "AuthSettings", entityId: "ldap", newValue: { result: found } });
          return ok({ ok: true, message: "اتصال برقرار است و جست‌وجوی کاربر کار می‌کند", searchTested: true });
        }
        const profile = await client.authenticate("nonexistent-test@example.invalid", "__probe__");
        await audit({ actorId: actor.id, action: "LDAP_TEST", entity: "AuthSettings", entityId: "ldap", newValue: { result: "reachable" } });
        return ok({ ok: true, message: "اتصال به دایرکتوری برقرار است", searchTested: false });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        const isTimeout = /timeout|connect|ECONNREFUSED|ETIMEDOUT/i.test(msg);
        return ok({
          ok: false,
          message: isTimeout ? "دایرکتوری پاسخ نداد — آدرس/پورت/فایروال را بررسی کنید" : "اتصال ناموفق بود — تنظیمات Bind را بررسی کنید",
        });
      }
    }
    return ok({ ok: false, message: "عملیات نامعتبر" });
  } catch (e) {
    return handleError(e);
  }
}
