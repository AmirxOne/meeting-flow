import { compare } from "bcryptjs";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { parseLoginIdentifier, type ParsedLoginIdentifier } from "@/lib/login-identifier";
import { isLdapAuthEnabled, isPasswordLoginEnabled, parseAuthMode } from "./auth-config";
import { getEffectiveLdapConfig } from "./ldap-settings.service";
import { resolvePasswordProvider } from "./provider-registry";
import { createLdapClient, type LdapClient, type LdapUserProfile } from "./ldap-client";
import { findOrProvisionLdapUser } from "./ldap-user.service";
import { SAMPLE_ORG_ID } from "@/lib/org-slug";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
}

const CREDENTIALS_MSG = "ایمیل، شماره موبایل یا رمز عبور اشتباه است";

let ldapClientOverride: LdapClient | null = null;

/** Test hook — inject mock LDAP client. */
export function setLdapClientForTests(client: LdapClient | null): void {
  ldapClientOverride = client;
}

function getLdapClient(): LdapClient {
  return ldapClientOverride ?? createLdapClient();
}

/** فقط برای تست‌ها — provider جدید هم همان override را ببیند */
export function getTestLdapOverride(): LdapClient | null {
  return ldapClientOverride;
}

function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    jobTitle: user.jobTitle,
  };
}

async function findUserByIdentifier(parsed: ParsedLoginIdentifier) {
  return parsed.kind === "email"
    ? prisma.user.findUnique({ where: { email: parsed.value } })
    : prisma.user.findUnique({ where: { phone: parsed.value } });
}

async function authenticateLocal(
  parsed: ParsedLoginIdentifier,
  password: string,
): Promise<AuthenticatedUser> {
  const user = await findUserByIdentifier(parsed);

  if (!user || !user.isActive) {
    throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
  }

  return toAuthUser(user);
}

async function authenticateLdap(
  parsed: ParsedLoginIdentifier,
  password: string,
  orgSlug?: string,
): Promise<AuthenticatedUser> {
  let email = parsed.kind === "email" ? parsed.value : null;
  if (parsed.kind === "phone") {
    const local = await findUserByIdentifier(parsed);
    if (!local || !local.isActive) {
      throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
    }
    email = local.email;
  }

  const orgId = await resolveProvisionOrgId(orgSlug);

  // client با تنظیمات همین org: DB (پنل) → env؛ تست override اولویت دارد
  let client: LdapClient;
  if (ldapClientOverride) {
    client = ldapClientOverride;
  } else {
    const cfg = await getEffectiveLdapConfig(orgId).catch(() => null);
    if (cfg?.enabled && cfg.url && cfg.baseDn && cfg.bindDn) {
      client = createLdapClient({
        url: cfg.url, baseDn: cfg.baseDn, bindDn: cfg.bindDn,
        bindPassword: cfg.bindPassword, userFilter: cfg.userFilter,
        tlsRejectUnauthorized: cfg.tlsRejectUnauthorized,
      });
    } else {
      client = createLdapClient(); // env — اگر ناقص باشد resolveLdapConfig خطای صریح می‌دهد
    }
  }

  let profile: LdapUserProfile | null;
  try {
    profile = await client.authenticate(email!, password);
  } catch (e) {
    // خطای اتصال/timeout دایرکتوری → پیام کنترل‌شده، بدون crash
    const msg = e instanceof Error ? e.message : "";
    if (/timeout|connect|ECONNREFUSED|ETIMEDOUT|unreachable|EHOSTUNREACH/i.test(msg)) {
      throw new HttpError(503, "دایرکتوری سازمانی در دسترس نیست", "AUTH_PROVIDER_UNAVAILABLE");
    }
    throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
  }
  if (!profile) {
    // کاربر در دایرکتوری نیست (search خالی) یا bind کاربر ناموفق —
    // کد متمایز تا سیاست fallback بداند فقط «نبودن کاربر» قابل بازگشت به local است
    throw new HttpError(401, CREDENTIALS_MSG, "NOT_IN_DIRECTORY");
  }
  const user = await findOrProvisionLdapUser(profile, orgId);
  return toAuthUser(user);
}

async function resolveProvisionOrgId(orgSlug?: string): Promise<string> {
  if (orgSlug) {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug.toLowerCase() },
      select: { id: true },
    });
    if (org) return org.id;
  }
  return SAMPLE_ORG_ID;
}

async function assertLoginTenant(userId: string, orgSlug?: string) {
  if (!orgSlug) return;
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug.toLowerCase() },
    select: { id: true },
  });
  if (!org) {
    throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { orgId: true, isSuperAdmin: true },
  });
  if (!user) {
    throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
  }
  if (user.isSuperAdmin) return;
  if (user.orgId !== org.id) {
    throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
  }
}

/** Load a user after a successful 2FA challenge (password/LDAP already verified). */
export async function getAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, jobTitle: true, isActive: true },
  });
  if (!user?.isActive) {
    throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
  }
  return toAuthUser(user);
}

/**
 * Resolve credentials (email or Iranian mobile) according to AUTH_MODE.
 * LDAP: directory bind only. If the user later enabled Mehrsa TOTP, the login
 * route still requires that authenticator code — LDAP MFA is not a substitute.
 */
export async function authenticateLogin(
  identifier: string,
  password: string,
  orgSlug?: string,
): Promise<AuthenticatedUser> {
  if (!isPasswordLoginEnabled()) {
    throw new HttpError(
      400,
      "ورود با رمز برای این سازمان فعال نیست",
      "PASSWORD_LOGIN_DISABLED",
    );
  }
  const parsed = parseLoginIdentifier(identifier);
  if (!parsed) {
    throw new HttpError(400, "ایمیل یا شماره موبایل نامعتبر است", "INVALID_IDENTIFIER");
  }
  // سیاست انتخاب provider — env (سینک) یا تنظیمات DB این org (آسنک)
  let useLdap = resolvePasswordProvider().id === "ldap";
  if (!useLdap) {
    // LDAP از پنل مدیریت برای این سازمان فعال شده باشد → همان
    const orgId = await resolveProvisionOrgId(orgSlug).catch(() => null);
    if (orgId) {
      const cfg = await getEffectiveLdapConfig(orgId).catch(() => null);
      if (cfg?.enabled && cfg.url && cfg.baseDn && cfg.bindDn) useLdap = true;
    }
  }
  let user: AuthenticatedUser | null = null;
  if (useLdap) {
    // اول دایرکتوری سازمانی.
    // NOT_IN_DIRECTORY (کاربر در دایرکتوری نیست) → حساب‌های داخلی مثل admin
    // با رمز محلی وارد می‌شوند تا ادمین قفل نشود. رمز غلط کاربرِ دایرکتوری
    // و قطعی سرور → بدون fallback (امنیت).
    try {
      user = await authenticateLdap(parsed, password, orgSlug);
    } catch (e) {
      if (!(e instanceof HttpError) || e.code !== "NOT_IN_DIRECTORY") throw e;
      user = null; // تلاش با local در ادامه
    }
  }
  if (!user) {
    user = await authenticateLocal(parsed, password);
  }
  await assertLoginTenant(user.id, orgSlug);
  return user;
}

export { parseAuthMode, isLdapAuthEnabled };
