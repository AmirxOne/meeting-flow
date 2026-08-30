"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, CheckCircle2, Eye, EyeOff, ShieldCheck } from "@/components/ui/icon";
import { FadeIn } from "@/components/ui/motion";
import { Tooltip } from "@/components/ui/tooltip";
import { api, type ApiError } from "@/lib/api";
import { faStr, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib/fa";

type AuthMode = "local" | "ldap";

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
  const [authMode, setAuthMode] = useState<AuthMode>("local");

  useEffect(() => {
    api<{ authMode: AuthMode }>("/api/auth/config")
      .then((data) => setAuthMode(data.authMode))
      .catch(() => setAuthMode("local"));
  }, []);

  const ldapMode = authMode === "ldap";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        json: { identifier: toEnDigits(stripBidiMarks(identifier)), password },
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
              <h2 className="text-[20px] font-bold">ورود به حساب</h2>
              <p className="mt-1.5 text-[12.5px] leading-6 text-ink-soft">
                {ldapMode
                  ? "با ایمیل سازمانی یا شماره موبایل ثبت‌شده وارد شوید."
                  : "با ایمیل یا شماره موبایل وارد شوید."}
              </p>
              {ldapMode && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-paper-soft px-2.5 py-1 text-[11px] text-ink-soft">
                  <Building2 className="h-3.5 w-3.5" />
                  ورود با حساب سازمانی (LDAP)
                </p>
              )}
            </div>

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

            {!ldapMode && (
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

            {ldapMode && (
              <p className="mt-6 text-center text-[11px] leading-5 text-ink-faint">
                با اولین ورود موفق، حساب شما به‌صورت خودکار در مهرسا ساخته می‌شود.
              </p>
            )}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
