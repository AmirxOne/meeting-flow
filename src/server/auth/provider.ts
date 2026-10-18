import type { AuthenticatedUser } from "./login.service";

/**
 * ─────────────────────────────────────────────────────────────
 *  Authentication Provider Contract — قرارداد واحد روش‌های ورود
 * ─────────────────────────────────────────────────────────────
 *
 *  هر روش احراز هویت (local / ldap — قابل توسعه)
 *  همین قرارداد را پیاده می‌کند. سرویس‌های session/2FA به
 *  پیاده‌سازی داخلی هیچ providerی وابسته نیستند.
 *
 *  اصول:
 *  - provider خاموش (enabled=false) هرگز فراخوانی نمی‌شود؛
 *    فراخوانی مستقیم هم باید پاسخ کنترل‌شده بدهد.
 *  - شکست یک provider نباید provider دیگر را دور بزند یا
 *    خودکار fallback ناامن انجام دهد — سیاست انتخاب در
 *    login.service صریح است.
 *  - احراز هویت ≠ مجوز: نقش‌ها فقط از سیستم داخلی می‌آیند.
 */

export type ProviderId = "local" | "ldap";

export interface CredentialsInput {
  identifier: string; // email یا موبایل
  password: string;
  orgSlug?: string;
}

/** نتیجه‌ی احراز هویت — provider فقط هویت را تأیید می‌کند. */
export type AuthResult =
  | { status: "ok"; user: AuthenticatedUser }
  | { status: "invalid" } // رمز/کاربر اشتباه — پیام عمومی
  | { status: "disabled" } // حساب غیرفعال
  | { status: "unavailable"; reason: string }; // provider قطع/تنظیم نیست — بدون جزئیات حساس

export interface AuthProvider {
  readonly id: ProviderId;
  /** برچسب فارسی برای پنل مدیریت */
  readonly label: string;
  /** آیا تنظیمات لازم موجود است و provider روشن است؟ */
  isEnabled(): boolean;
  /**
   * احراز هویت با رمز عبور.
   */
  authenticate(input: CredentialsInput): Promise<AuthResult>;
}
