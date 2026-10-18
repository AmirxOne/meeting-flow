import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { sealSecret, openSecret } from "@/server/crypto/secret-box";

/**
 * تنظیمات LDAP برای هر سازمان — در SystemMeta با کلید org-scoped ذخیره می‌شود.
 * رمز Bind با AES-256-GCM (SESSION_SECRET) مهر و موم شده و هرگز خام برگردانده نمی‌شود.
 *
 * اولویت: تنظیمات DB (از پنل ادمین) > متغیرهای محیطی > غیرفعال.
 */

export interface LdapOrgConfig {
  enabled: boolean;
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string; // فقط هنگام خواندن برای اتصال استفاده می‌شود
  userFilter: string;
  tlsRejectUnauthorized: boolean;
  /** اجازه‌ی ساخت خودکار کاربر جدید در اولین ورود LDAP */
  autoProvision: boolean;
}

const DEFAULT_FILTER = "(mail={{email}})";

function metaKey(orgId: string): string {
  return `ldap:${orgId}`;
}

/** فرم غیرحساس برای UI — رمز هرگز برگردانده نمی‌شود */
export interface LdapOrgConfigSafe {
  enabled: boolean;
  url: string;
  baseDn: string;
  bindDn: string;
  userFilter: string;
  tlsRejectUnauthorized: boolean;
  autoProvision: boolean;
  hasPassword: boolean;
  source: "db" | "env" | "none";
}

/** خواندن تنظیمات مؤثر سازمان: DB → env → null */
export async function getEffectiveLdapConfig(orgId: string): Promise<LdapOrgConfig | null> {
  // ۱) DB
  const row = await prisma.systemMeta.findUnique({ where: { key: metaKey(orgId) } });
  if (row) {
    const v = row.value as Record<string, unknown>;
    let bindPassword = "";
    if (typeof v.bindPasswordSealed === "string" && v.bindPasswordSealed) {
      try {
        bindPassword = openSecret(v.bindPasswordSealed);
      } catch {
        bindPassword = ""; // SESSION_SECRET عوض شده — رمز قبلی قابل بازیابی نیست
      }
    }
    return {
      enabled: v.enabled === true,
      url: String(v.url ?? ""),
      baseDn: String(v.baseDn ?? ""),
      bindDn: String(v.bindDn ?? ""),
      bindPassword,
      userFilter: String(v.userFilter ?? DEFAULT_FILTER),
      tlsRejectUnauthorized: v.tlsRejectUnauthorized !== false,
      autoProvision: v.autoProvision !== false,
    };
  }

  // ۲) env — فقط اگر تنظیم کامل باشد
  const url = process.env.LDAP_URL?.trim();
  const baseDn = process.env.LDAP_BASE_DN?.trim();
  const bindDn = process.env.LDAP_BIND_DN?.trim();
  if (url && baseDn && bindDn) {
    return {
      enabled: (process.env.AUTH_MODE ?? "local").includes("ldap"),
      url,
      baseDn,
      bindDn,
      bindPassword: process.env.LDAP_BIND_PASSWORD ?? "",
      userFilter: process.env.LDAP_USER_FILTER?.trim() || DEFAULT_FILTER,
      tlsRejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED?.trim().toLowerCase() !== "false",
      autoProvision: true,
    };
  }
  return null;
}

/** فرم امن برای پنل مدیریت */
export async function getLdapConfigSafe(orgId: string): Promise<LdapOrgConfigSafe> {
  const cfg = await getEffectiveLdapConfig(orgId);
  if (!cfg) return { enabled: false, url: "", baseDn: "", bindDn: "", userFilter: DEFAULT_FILTER, tlsRejectUnauthorized: true, autoProvision: true, hasPassword: false, source: "none" };
  return {
    enabled: cfg.enabled,
    url: cfg.url,
    baseDn: cfg.baseDn,
    bindDn: cfg.bindDn,
    userFilter: cfg.userFilter,
    tlsRejectUnauthorized: cfg.tlsRejectUnauthorized,
    autoProvision: cfg.autoProvision,
    hasPassword: cfg.bindPassword.length > 0,
    source: (await prisma.systemMeta.findUnique({ where: { key: metaKey(orgId) } })) ? "db" : "env",
  };
}

/** ذخیره‌ی تنظیمات از پنل — bindPassword اختیاری (خالی = دست‌نخورده) */
export async function saveLdapConfig(
  orgId: string,
  actorId: string,
  input: {
    enabled: boolean;
    url: string;
    baseDn: string;
    bindDn: string;
    bindPassword?: string;
    userFilter?: string;
    tlsRejectUnauthorized?: boolean;
    autoProvision?: boolean;
  },
): Promise<LdapOrgConfigSafe> {
  const url = input.url.trim();
  const baseDn = input.baseDn.trim();
  const bindDn = input.bindDn.trim();

  // اگر فعال می‌شود، تنظیمات اتصال کامل لازم است
  if (input.enabled && (!url || !baseDn || !bindDn)) {
    throw new Error("برای فعال‌سازی LDAP، آدرس سرور و Base DN و Bind DN لازم است");
  }
  if (url && !/^ldap:\/\/|^ldaps:\/\//i.test(url)) {
    throw new Error("آدرس سرور باید با ldap:// یا ldaps:// شروع شود");
  }

  const existing = await prisma.systemMeta.findUnique({ where: { key: metaKey(orgId) } });
  const prevSealed = existing ? String((existing.value as Record<string, unknown>).bindPasswordSealed ?? "") : "";
  const newPassword = input.bindPassword?.length ? sealSecret(input.bindPassword) : prevSealed;

  const value = {
    enabled: input.enabled,
    url,
    baseDn,
    bindDn,
    bindPasswordSealed: newPassword,
    userFilter: input.userFilter?.trim() || DEFAULT_FILTER,
    tlsRejectUnauthorized: input.tlsRejectUnauthorized ?? true,
    autoProvision: input.autoProvision ?? true,
    updatedBy: actorId,
    updatedAt: new Date().toISOString(),
  };

  await prisma.systemMeta.upsert({
    where: { key: metaKey(orgId) },
    create: { key: metaKey(orgId), value: value as unknown as Prisma.InputJsonValue },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });

  return getLdapConfigSafe(orgId);
}

