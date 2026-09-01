"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, CheckCircle2, Eye, EyeOff, ShieldCheck } from "@/components/ui/icon";
import { FadeIn } from "@/components/ui/motion";
import { Tooltip } from "@/components/ui/tooltip";
import { LegalFooterLinks } from "@/components/legal/legal-footer-links";
import { api, type ApiError } from "@/lib/api";
import { faStr, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib/fa";

type AuthConfig = {
  authMode: string;
  localEnabled: boolean;
  ldapEnabled: boolean;
  ssoEnabled: boolean;
  ssoLabel: string;
  passwordResetEnabled: boolean;
};

const SSO_ERROR_FA: Record<string, string> = {
  access_denied: "ورود سازمانی لغو شد.",
  not_configured: "ورود سازمانی پیکربندی نشده است.",
  state_mismatch: "نشست ورود سازمانی نامعتبر است — دوباره تلاش کنید.",
  nonce_mismatch: "نشست ورود سازمانی نامعتبر است — دوباره تلاش کنید.",
  missing_email: "حساب سازمانی ایمیل معتبری برنگرداند.",
  token_failed: "ارتباط با حساب سازمانی ناموفق بود.",
  account_disabled: "حساب کاربری غیرفعال است.",
};

const DEMO_ACCOUNTS = [
  { label: "مدیر", email: "admin@example.com", phone: "09120001001" },
  { label: "اپراتور", email: "operator@example.com", phone: "09120001003" },
  { label: "مدیر شعبه", email: "manager@example.com", phone: "09120001004" },
  { label: "مسئول اتاق", email: "room@example.com", phone: "09120001005" },
  { label: "کارمند", email: "ali@example.com", phone: "09120001006" },
  { label: "مدیر منابع انسانی", email: "sara@example.com", phone: "09120001008" },
] as const;

const BRAND_POINTS = [
  { icon: CalendarDays, text: "تقویم شمسی و رزرو اتاق" },
  { icon: ShieldCheck, text: "جلسات محرمانه و کنترل دسترسی" },
  { icon: CheckCircle2, text: "تأیید، حضور و یادآوری خودکار" },
] as const;

const fieldClass =
  "h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-right text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15";

export function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({
    authMode: "local",
    localEnabled: true,
    ldapEnabled: false,
    ssoEnabled: false,
    ssoLabel: "ورود با حساب سازمانی",
    passwordResetEnabled: true,
  });
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    api<AuthConfig>("/api/auth/config")
      .then((data) =>
        setAuthConfig({
          authMode: data.authMode,
          localEnabled: data.localEnabled ?? data.authMode === "local",
          ldapEnabled: data.ldapEnabled ?? data.authMode === "ldap",
          ssoEnabled: !!data.ssoEnabled,
          ssoLabel: data.ssoLabel || "ورود با حساب سازمانی",
          passwordResetEnabled: data.passwordResetEnabled !== false,
        }),
      )
      .catch(() => {
        /* keep defaults */
      });

    const params = new URLSearchParams(window.location.search);
    const challenge = params.get("challenge");
    if (challenge && challenge.length >= 16) {
      setChallengeToken(challenge);
    }
    if (params.get("sso") === "error") {
      const code = params.get("code") ?? "token_failed";
      setError(SSO_ERROR_FA[code] ?? SSO_ERROR_FA.token_failed);
    }
    const host = window.location.hostname;
    const sub =
      host.endsWith(".localhost") && host !== "localhost"
        ? host.slice(0, -".localhost".length)
        : null;
    const fromQuery = params.get("org")?.trim().toLowerCase() || null;
    const slug = fromQuery || (sub && sub !== "www" ? sub : null);
    if (slug) setOrgSlug(slug);
    fetch(`/api/public/organization${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`)
      .then((r) => r.json())
      .then((payload: { ok?: boolean; data?: { organization?: { name: string; slug: string }; found?: boolean } }) => {
        const org = payload?.data?.organization;
        if (org?.name) setOrgName(org.name);
        if (org?.slug && !slug) setOrgSlug(org.slug);
      })
      .catch(() => {});
    if (challenge || params.get("sso")) {
      window.history.replaceState({}, "", slug ? `/login?org=${encodeURIComponent(slug)}` : "/login");
    }
  }, []);

  const ldapMode = authConfig.ldapEnabled;
  const passwordForm = authConfig.localEnabled || authConfig.ldapEnabled;
  const ssoEnabled = authConfig.ssoEnabled;
  const needs2fa = Boolean(challengeToken);

  function reset2fa() {
    setChallengeToken(null);
    setOtpCode("");
    setRecoveryCode("");
    setUseRecovery(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ requires2fa?: boolean; challengeToken?: string }>("/api/auth/login", {
        method: "POST",
        json: {
          identifier: toEnDigits(stripBidiMarks(identifier)),
          password,
          ...(orgSlug ? { orgSlug } : {}),
        },
      });
      if (data.requires2fa && data.challengeToken) {
        setChallengeToken(data.challengeToken);
        setOtpCode("");
        setRecoveryCode("");
        setUseRecovery(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  async function submit2fa(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeToken) return;
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/login/2fa", {
        method: "POST",
        json: useRecovery
          ? { challengeToken, recoveryCode: stripBidiMarks(recoveryCode).trim() }
          : { challengeToken, code: toEnDigits(stripBidiMarks(otpCode)) },
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper-soft px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #d9d9e0 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <FadeIn className="relative w-full max-w-[880px]">
        <div className="grid overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_80px_-28px_rgba(13,13,13,0.28)] md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <aside className="relative flex flex-col justify-between bg-ink px-8 py-9 text-white md:min-h-[560px]">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Image
                  src="/logo-white.png"
                  alt="مهرسا"
                  width={30}
                  height={30}
                  className="h-[30px] w-[30px] object-contain"
                  priority
                />
              </div>
              <p className="mt-6 text-[11px] font-medium tracking-wide text-white/55">
                سیستم مدیریت جلسات سازمانی
              </p>
              <h1 className="mt-1.5 text-[28px] font-bold leading-tight">مهرسا</h1>
              {orgName ? (
                <p className="mt-1 text-[13px] text-white/80">{orgName}</p>
              ) : null}
              <p className="mt-3 max-w-[17rem] text-[13px] leading-7 text-white/70">
                زمان‌بندی، رزرو اتاق و هماهنگی تیم‌ها در یک فضای واحد — ساده، امن و فارسی.
              </p>
            </div>

            <ul className="mt-10 space-y-3 md:mt-0">
              {BRAND_POINTS.map(({ icon: BrandIcon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-[12.5px] text-white/80">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-white/10">
                    <BrandIcon className="h-3.5 w-3.5" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </aside>

          <div className="flex flex-col justify-center px-6 py-8 sm:px-10">
            <div className="mb-7">
              <h2 className="text-[20px] font-bold">{needs2fa ? "تأیید دو مرحله‌ای" : "ورود به حساب"}</h2>
              <p className="mt-1.5 text-[12.5px] leading-6 text-ink-soft">
                {needs2fa
                  ? ssoEnabled && !passwordForm
                    ? "حساب سازمانی تأیید شد. کد ۶ رقمی اپ authenticator مهرسا را وارد کنید."
                    : ldapMode
                      ? "رمز سازمانی تأیید شد. کد ۶ رقمی اپ authenticator مهرسا را وارد کنید."
                      : "رمز درست است. کد ۶ رقمی اپ authenticator را وارد کنید."
                  : passwordForm
                    ? ldapMode
                      ? "با ایمیل سازمانی یا شماره موبایل ثبت‌شده وارد شوید."
                      : "با ایمیل یا شماره موبایل وارد شوید."
                    : "با حساب سازمانی وارد شوید."}
              </p>
              {ldapMode && !needs2fa && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-paper-soft px-2.5 py-1 text-[11px] text-ink-soft">
                  <Building2 className="h-3.5 w-3.5" />
                  ورود با حساب سازمانی (LDAP)
                </p>
              )}
              {ssoEnabled && !needs2fa && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-paper-soft px-2.5 py-1 text-[11px] text-ink-soft">
                  <Building2 className="h-3.5 w-3.5" />
                  ورود مرورگر با Microsoft Entra ID
                </p>
              )}
            </div>

            {needs2fa ? (
            <form onSubmit={submit2fa} className="space-y-4" data-testid="login-2fa-form">
              {!useRecovery ? (
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium" htmlFor="login-otp">
                    کد ۶ رقمی
                  </label>
                  <input
                    id="login-otp"
                    name="otp"
                    data-testid="login-2fa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="rtl"
                    value={otpCode ? withRtlMark(faStr(otpCode)) : ""}
                    onChange={(e) =>
                      setOtpCode(toEnDigits(stripBidiMarks(e.target.value)).replace(/\D/g, "").slice(0, 6))
                    }
                    className={`${fieldClass} tracking-[0.35em]`}
                    placeholder={faStr("000000")}
                    required
                    autoFocus
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium" htmlFor="login-recovery">
                    کد بازیابی
                  </label>
                  <input
                    id="login-recovery"
                    name="recovery"
                    data-testid="login-2fa-recovery"
                    type="text"
                    autoComplete="off"
                    dir="ltr"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(stripBidiMarks(e.target.value))}
                    className={`${fieldClass} text-left font-mono tracking-wide`}
                    placeholder="xxxx-xxxx"
                    required
                    autoFocus
                  />
                </div>
              )}

              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2.5 text-[12px] text-red-600">{error}</p>
              )}

              <button
                type="submit"
                data-testid="login-2fa-submit"
                disabled={loading}
                className="h-11 w-full rounded-md bg-ink text-[13px] font-medium text-white transition hover:bg-[#2a2a2e] disabled:opacity-50"
              >
                {loading ? "در حال تأیید…" : "تأیید و ورود"}
              </button>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <button
                  type="button"
                  data-testid="login-2fa-recovery-toggle"
                  onClick={() => {
                    setUseRecovery((v) => !v);
                    setError(null);
                  }}
                  className="text-ink-soft transition hover:text-ink"
                >
                  {useRecovery ? "ورود با کد authenticator" : "استفاده از کد بازیابی"}
                </button>
                <button
                  type="button"
                  data-testid="login-2fa-back"
                  onClick={reset2fa}
                  className="text-ink-soft transition hover:text-ink"
                >
                  بازگشت
                </button>
              </div>
            </form>
            ) : passwordForm ? (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium" htmlFor="login-identifier">
                  {ldapMode ? "ایمیل سازمانی یا موبایل" : "ایمیل یا شماره موبایل"}
                </label>
                <input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  dir="rtl"
                  value={identifier ? withRtlMark(faStr(identifier)) : ""}
                  onChange={(e) => setIdentifier(toEnDigits(stripBidiMarks(e.target.value)))}
                  className={fieldClass}
                  placeholder="admin@example.com یا ۰۹۱۲۰۰۰۰۱۰۰۱"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium" htmlFor="login-password">
                  رمز عبور
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    dir="rtl"
                    value={password ? withRtlMark(password) : ""}
                    onChange={(e) => setPassword(stripBidiMarks(e.target.value))}
                    className={`${fieldClass} pl-11`}
                    placeholder="••••••••"
                    required
                  />
                  <Tooltip content={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-soft transition hover:bg-paper-soft hover:text-ink"
                      aria-label={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}
                    >
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </Tooltip>
                </div>
              </div>

              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2.5 text-[12px] text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-md bg-ink text-[13px] font-medium text-white transition hover:bg-[#2a2a2e] disabled:opacity-50"
              >
                {loading ? "در حال ورود…" : ldapMode ? "ورود با LDAP" : "ورود"}
              </button>
            </form>
            ) : null}

            {!needs2fa && error && !passwordForm && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2.5 text-[12px] text-red-600">{error}</p>
            )}

            {ssoEnabled && !needs2fa && (
              <div className={passwordForm ? "mt-5" : ""}>
                {passwordForm && (
                  <div className="mb-4 flex items-center gap-3 text-[11px] text-ink-faint">
                    <span className="h-px flex-1 bg-line" />
                    یا
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <a
                  href="/api/auth/sso/login"
                  data-testid="sso-login-button"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-white text-[13px] font-medium text-ink transition hover:bg-paper-soft"
                >
                  <Building2 className="h-4 w-4" />
                  {authConfig.ssoLabel}
                </a>
              </div>
            )}

            {authConfig.passwordResetEnabled && !needs2fa && (
              <p className="mt-3 text-center">
                <a
                  href="/forgot-password"
                  data-testid="forgot-password-link"
                  className="text-[12px] text-ink-soft transition hover:text-ink"
                >
                  رمز را فراموش کرده‌ام
                </a>
              </p>
            )}

            {authConfig.localEnabled && !ldapMode && !needs2fa && (
              <div className="mt-6 rounded-xl border border-line bg-paper-soft/80 px-3.5 py-3">
                <p className="text-[11px] text-ink-soft">
                  حساب‌های آزمایشی — رمز همه: <span className="font-medium text-ink">Pass1234</span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => setIdentifier(acc.email)}
                      className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] text-ink transition hover:border-ink/30 hover:bg-paper-soft"
                      title={`${acc.email} · ${acc.phone}`}
                    >
                      {acc.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(ldapMode || ssoEnabled) && !needs2fa && (
              <p className="mt-6 text-center text-[11px] leading-5 text-ink-faint">
                با اولین ورود موفق سازمانی، حساب شما به‌صورت خودکار در مهرسا ساخته می‌شود.
              </p>
            )}
          </div>
        </div>
      </FadeIn>
      <LegalFooterLinks className="relative z-10 mt-8" />
    </div>
  );
}
