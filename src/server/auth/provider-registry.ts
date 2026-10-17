import type { AuthProvider, CredentialsInput, AuthResult } from "./provider";
import { createLocalProvider } from "./providers/local.provider";
import { createLdapProvider } from "./providers/ldap.provider";
import { createSsoProviderStatus } from "./providers/sso.provider";
import { HttpError } from "./session";
import { parseLoginIdentifier } from "@/lib/login-identifier";

/**
 * ─────────────────────────────────────────────────────────────
 *  Registry — ثبت‌شده‌ی providerها و سیاست انتخاب صریح
 * ─────────────────────────────────────────────────────────────
 *
 *  سیاست فعلی (همان رفتار قبلی پروژه، حالت قراردادمحور):
 *   - AUTH_MODE تعیین می‌کند کدام providerها «روشن‌اند».
 *   - در مسیر رمز: اگر ldap روشن باشد → فقط LDAP (بدون fallback
 *     خودکار به local با همان رمز — الزام امنیتی).
 *   - در غیر این صورت local.
 *   - provider خاموش هرگز فراخوانی نمی‌شود.
 *
 *  افزودن provider جدید = ساخت فایل providers/x.provider.ts +
 *  ثبت در این‌جا. سرویس‌های session/2FA تغییر نمی‌کنند.
 */

export function buildProviders(): AuthProvider[] {
  return [createLocalProvider(), createLdapProvider(), createSsoProviderStatus()];
}

/** provider فعال برای مسیر رمز — صریح و قابل‌تست */
export function resolvePasswordProvider(providers: AuthProvider[] = buildProviders()): AuthProvider {
  const methods = (process.env.AUTH_MODE ?? "local").toLowerCase().split(/[,+\s|]+/);
  if (methods.includes("ldap")) {
    const ldap = providers.find((p) => p.id === "ldap")!;
    if (ldap.isEnabled()) return ldap;
    // LDAP در AUTH_MODE است ولی تنظیم نیست → روشن نکن، local ادامه بدهد
    // (نصب بدون LDAP باید کامل کار کند)
  }
  return providers.find((p) => p.id === "local")!;
}

/** نقطه‌ی ورود یکپارچه — جایگزین شرط‌های if/else پراکنده */
export async function authenticateWithProviders(input: CredentialsInput): Promise<Exclude<AuthResult, "unavailable">> {
  const provider = resolvePasswordProvider();
  const result = await provider.authenticate(input);
  switch (result.status) {
    case "ok":
      return result;
    case "invalid":
      throw new HttpError(401, "ایمیل، شماره موبایل یا رمز عبور اشتباه است", "BAD_CREDENTIALS");
    case "disabled":
      throw new HttpError(401, "حساب کاربری غیرفعال است", "ACCOUNT_DISABLED");
    case "unavailable":
      throw new HttpError(503, result.reason || "روش ورود در دسترس نیست", "AUTH_PROVIDER_UNAVAILABLE");
  }
}

