import { NextRequest } from "next/server";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { z } from "zod";
import { buildProviders } from "@/server/auth/provider-registry";
import { getLdapConfigSafe, saveLdapConfig, getEffectiveLdapConfig } from "@/server/auth/ldap-settings.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/auth-providers — وضعیت روش‌های ورود (بدون Secret) */
export async function GET() {
  try {
    const actor = await requirePermission("org:manage");
    const providers = buildProviders().map((p) => ({
      id: p.id,
      label: p.label,
      enabled: p.isEnabled(),
    }));

    // تنظیمات مؤثر این سازمان: DB (پنل) → env → none — رمز هرگز برگردانده نمی‌شود
    const orgLdap = await getLdapConfigSafe(actor.orgId).catch(() => null);

    return ok({ providers, orgLdap });
  } catch (e) {
    return handleError(e);
  }
}

const testSchema = z.object({
  action: z.literal("test-connection"),
  /** اگر ارسال شود، همین مقادیر تست می‌شوند (قبل از ذخیره)؛ وگرنه تنظیمات ذخیره‌شده */
  url: z.string().trim().optional(),
  baseDn: z.string().trim().optional(),
  bindDn: z.string().trim().optional(),
  bindPassword: z.string().optional(),
  userFilter: z.string().trim().optional(),
  tlsRejectUnauthorized: z.boolean().optional(),
  sampleEmail: z.string().email().optional(),
});

/**
 * POST /api/admin/auth-providers — تست اتصال LDAP.
 * اولویت مقادیر: فرم ارسالی → تنظیمات ذخیره‌شده‌ی org → env.
 * Secret جایی لاگ یا پاس داده نمی‌شود.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("org:manage");
    const input = testSchema.parse(await req.json().catch(() => ({})));

    if (input.action !== "test-connection") {
      return ok({ ok: false, message: "عملیات نامعتبر" });
    }

    let url = input.url;
    let baseDn = input.baseDn;
    let bindDn = input.bindDn;
    // فاصله/خالی از فیلد رمز = «دست‌نخورده» — هرگز با رمز خالی bind نکن
    let bindPassword = input.bindPassword?.trim() ? input.bindPassword : undefined;
    let userFilter = input.userFilter;
    let tls = input.tlsRejectUnauthorized;
    if (!url || !baseDn || !bindDn || bindPassword === undefined) {
      const cfg = await getEffectiveLdapConfig(actor.orgId).catch(() => null);
      if (cfg) {
        url = url || cfg.url;
        baseDn = baseDn || cfg.baseDn;
        bindDn = bindDn || cfg.bindDn;
        bindPassword = bindPassword?.trim()?.length ? bindPassword : cfg.bindPassword;
        userFilter = userFilter || cfg.userFilter;
        tls = tls ?? cfg.tlsRejectUnauthorized;
      }
    }

    if (!url || !baseDn || !bindDn) {
      return ok({
        ok: false,
        message: "آدرس سرور، Base DN و Bind DN لازم است — پر کنید و دوباره تست بگیرید",
      });
    }
    if (!/^ldap:\/\/|^ldaps:\/\//i.test(url)) {
      return ok({ ok: false, message: "آدرس سرور باید با ldap:// یا ldaps:// شروع شود" });
    }

    // dynamic import — کتابخانه فقط وقتی لود می‌شود که واقعاً تست می‌گیریم
    const { createLdapClient } = await import("@/server/auth/ldap-client");
    try {
      const client = createLdapClient({
        url,
        baseDn,
        bindDn,
        bindPassword: bindPassword ?? "",
        userFilter: userFilter || "(mail={{email}})",
        tlsRejectUnauthorized: tls ?? true,
      });

      let searchTested = false;
      if (input.sampleEmail) {
        searchTested = true;
        // null یعنی کاربر در دایرکتوری نبود ولی جست‌وجو سالم بود؛ throw = خطای اتصال
        await client.authenticate(input.sampleEmail, "__mehrsa_probe__");
      }
      // null = سرور جواب داد و کاربر پیدا نشد (طبیعی)؛ throw = خطای اتصال/bind
      const probe = await client.authenticate("nonexistent-probe@mehrsa.invalid", "__mehrsa_probe__");

      await audit({
        actorId: actor.id,
        orgId: actor.orgId,
        action: "LDAP_TEST",
        entity: "LdapSettings",
        entityId: actor.orgId,
        newValue: { reachable: true, searchTested: searchTested && probe === null },
      });
      return ok({
        ok: true,
        message: input.sampleEmail
          ? "اتصال برقرار است و جست‌وجوی کاربر کار می‌کند"
          : "اتصال به دایرکتوری برقرار است",
        searchTested,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const isNet = /timeout|connect|ECONNREFUSED|ETIMEDOUT|unreachable|EHOSTUNREACH/i.test(msg);
      await audit({
        actorId: actor.id,
        orgId: actor.orgId,
        action: "LDAP_TEST",
        entity: "LdapSettings",
        entityId: actor.orgId,
        newValue: { reachable: false },
      }).catch(() => undefined);
      const fromForm = !!input.bindPassword?.trim();
      return ok({
        ok: false,
        message: isNet
          ? "دایرکتوری پاسخ نداد — آدرس/پورت/فایروال را بررسی کنید"
          : fromForm
            ? "رمز سرویسِ تایپ‌شده رد شد — فیلد را خالی کنید تا از رمز ثبت‌شده استفاده شود، یا رمز درست دایرکتوری را وارد کنید"
            : "اتصال ناموفق بود — Bind DN یا رمز سرویسِ ثبت‌شده را بررسی کنید",
      });
    }
  } catch (e) {
    return handleError(e);
  }
}

const saveSchema = z.object({
  enabled: z.boolean(),
  url: z.string().trim().max(300),
  baseDn: z.string().trim().max(300),
  bindDn: z.string().trim().max(300),
  bindPassword: z.string().max(300).optional(), // خالی = دست‌نخورده
  userFilter: z.string().trim().max(300).optional(),
  tlsRejectUnauthorized: z.boolean().optional(),
  autoProvision: z.boolean().optional(),
});

/** PUT /api/admin/auth-providers — ذخیره‌ی تنظیمات LDAP سازمان (org:manage) */
export async function PUT(req: NextRequest) {
  try {
    const actor = await requirePermission("org:manage");
    if (!actor.orgId) {
      return ok({ ok: false, message: "سازمان یافت نشد" });
    }
    const input = saveSchema.parse(await req.json().catch(() => ({})));
    let saved;
    try {
      saved = await saveLdapConfig(actor.orgId, actor.id, input);
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "تنظیمات نامعتبر است", "BAD_LDAP_SETTINGS");
    }
    await audit({
      actorId: actor.id,
      action: "UPDATE",
      entity: "LdapSettings",
      entityId: actor.orgId,
      newValue: { enabled: saved.enabled, url: saved.url, hasPassword: saved.hasPassword },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ ok: true, ldap: saved, message: saved.enabled ? "LDAP فعال شد" : "تنظیمات ذخیره شد (LDAP غیرفعال)" });
  } catch (e) {
    return handleError(e);
  }
}
