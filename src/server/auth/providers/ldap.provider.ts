import type { AuthProvider, AuthResult, CredentialsInput } from "../provider";
import { createLdapClient, type LdapClient } from "../ldap-client";
import { findOrProvisionLdapUser } from "../ldap-user.service";
import { resolveLdapConfig } from "../auth-config";
import { prisma } from "@/server/db";
import { HttpError } from "../session";
import { SAMPLE_ORG_ID } from "@/lib/org-slug";

/** تست‌ها override را از login.service ست می‌کنند — همان منبع را می‌خوانیم */
import { getTestLdapOverride } from "../login.service";

async function resolveOrgId(orgSlug?: string): Promise<string> {
  if (!orgSlug) return SAMPLE_ORG_ID;
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug.toLowerCase() },
    select: { id: true },
  });
  return org?.id ?? SAMPLE_ORG_ID;
}

/**
 * LDAP Authentication — Provider اختیاری.
 *
 *  - تنظیم نبود (env ناقص) → isEnabled=false؛ هیچ اتصالی در startup نمی‌شود
 *    و فراخوانی مستقیم پاسخ «unavailable» می‌دهد نه crash.
 *  - قطع سرور/timeout → unavailable؛ ورود محلی مختل نمی‌شود.
 *  - provisioning با نقش EMPLOYEE — هیچ‌گاه مجوز مدیریتی نمی‌سازد.
 */
export function createLdapProvider(opts?: { client?: LdapClient }): AuthProvider {
  return {
    id: "ldap",
    label: "ورود سازمانی (LDAP / Active Directory)",

    isEnabled(): boolean {
      // فقط وقتی AUTH_MODE شامل ldap است و تنظیمات کامل است
      try {
        const methods = (process.env.AUTH_MODE ?? "local").toLowerCase();
        if (!methods.split(/[,+\s|]+/).includes("ldap")) return false;
        if (opts?.client || getTestLdapOverride()) return true; // تست تزریق‌شده
        resolveLdapConfig(); // throws اگر ناقص
        return true;
      } catch {
        return false;
      }
    },

    async authenticate(input: CredentialsInput): Promise<AuthResult> {
      if (!this.isEnabled()) {
        return { status: "unavailable", reason: "LDAP فعال یا تنظیم نشده است" };
      }
      const client = opts?.client ?? getTestLdapOverride() ?? createLdapClient();
      try {
        // موبایل → ایمیل از حساب موجود
        let email = input.identifier;
        const byPhone = /^[0-9+\s-]+$/.test(input.identifier);
        if (byPhone) {
          const local = await prisma.user.findUnique({ where: { phone: input.identifier } });
          if (!local?.isActive) return { status: "invalid" };
          email = local.email;
        }

        const profile = await client.authenticate(email, input.password);
        if (!profile) return { status: "invalid" };

        const orgId = await resolveOrgId(input.orgSlug);
        const user = await findOrProvisionLdapUser(profile, orgId);
        return { status: "ok", user: { id: user.id, email: user.email, fullName: user.fullName, jobTitle: user.jobTitle } };
      } catch (e) {
        // خطای اتصال/timeout — بدون افشای جزئیات داخلی
        const msg = e instanceof Error ? e.message : "ldap error";
        if (/timeout|connect|ECONNREFUSED|ETIMEDOUT|unreachable/i.test(msg)) {
          return { status: "unavailable", reason: "دایرکتوری سازمانی در دسترس نیست" };
        }
        // خطای منطقی از provision (حساب غیرفعال و…) — HttpError با کد
        if (e instanceof HttpError) {
          if (e.code === "ACCOUNT_DISABLED") return { status: "disabled" };
          return { status: "invalid" };
        }
        return { status: "invalid" };
      }
    },
  };
}
