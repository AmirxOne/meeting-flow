import type { AuthProvider, AuthResult, CredentialsInput } from "../provider";

/**
 * SSO (OIDC) — redirect-based؛ در مسیر رمز شرکت نمی‌کند.
 * وضعیت فقط برای پنل مدیریت گزارش می‌شود. جزئیات در oidc-client.
 */
export function createSsoProviderStatus(): AuthProvider {
  return {
    id: "sso",
    label: "ورود یکپارچه (SSO / OpenID Connect)",
    isEnabled() {
      return (process.env.OIDC_ISSUER ?? "").trim().length > 0;
    },
    async authenticate(_input: CredentialsInput): Promise<AuthResult> {
      // SSO با redirect کار می‌کند نه رمز — این متد برای این provider بی‌معناست
      return { status: "unavailable", reason: "SSO از مسیر دکمه‌ی حساب سازمانی استفاده می‌کند" };
    },
  };
}
