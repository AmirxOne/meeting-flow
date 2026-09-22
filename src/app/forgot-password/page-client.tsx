"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { api, type ApiError } from "@/lib/api";
import { faStr, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib/fa";
import { FadeIn } from "@/components/ui/motion";
import { CheckCircle2 } from "@/components/ui/icon";

type AuthMode = "local" | "ldap";

const fieldClass =
  "h-11 w-full rounded-xl border border-line bg-paper-soft/40 px-3.5 text-right text-[13px] outline-none transition-all focus:border-ink/40 focus:bg-white focus:ring-4 focus:ring-ink/10";

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("local");
  const [resetEnabled, setResetEnabled] = useState(true);

  useEffect(() => {
    api<{ passwordResetEnabled?: boolean; ldapEnabled?: boolean; authMode: string }>("/api/auth/config")
      .then((data) => {
        setAuthMode(data.authMode === "ldap" ? "ldap" : "local");
        setResetEnabled(data.passwordResetEnabled !== false);
      })
      .catch(() => setAuthMode("local"));
  }, []);

  const ldapMode = authMode === "ldap" || !resetEnabled;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        json: { identifier: toEnDigits(stripBidiMarks(identifier)) },
      });
      setSent(true);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper-soft px-4 py-10">
      {/* backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #d9d9e0 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -top-28 right-1/4 size-80 rounded-full bg-ink/[0.05] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/4 size-80 rounded-full bg-emerald-200/25 blur-3xl" />

      <FadeIn className="relative w-full max-w-[440px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_80px_-28px_rgba(13,13,13,0.28)]">
          {/* header band */}
          <div className="relative overflow-hidden bg-gradient-to-l from-paper-soft to-white px-6 pb-5 pt-7 sm:px-8">
            <div aria-hidden className="pointer-events-none absolute -left-10 -top-14 size-40 rounded-full bg-emerald-200/30 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink shadow-md">
                <Image src="/logo-white.png" alt="مهرسا" width={26} height={26} className="h-[26px] w-[26px] object-contain" priority />
              </div>
              <div>
                <h1 className="text-[17px] font-bold">بازیابی رمز عبور</h1>
                <p className="mt-0.5 text-[11.5px] text-ink-soft">مهرسا — مدیریت جلسات سازمانی</p>
              </div>
            </div>
            <div className="relative mt-4 flex items-center gap-2 text-[11px] text-ink-faint" aria-hidden>
              <span className="flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-ink-soft ring-1 ring-line">۱</span>
              <span className="h-px w-8 bg-line" />
              <span className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ring-1 ${sent ? "bg-emerald-500 text-white ring-emerald-500" : "bg-white text-ink-soft ring-line"}`}>۲</span>
              <span className="h-px w-8 bg-line" />
              <span className="flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-ink-soft ring-1 ring-line">۳</span>
              <span className="mr-1">ایمیل ← کد ← رمز جدید</span>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {ldapMode ? (
              <p className="rounded-xl bg-paper-soft px-3.5 py-3.5 text-[13px] leading-7 text-ink ring-1 ring-line">
                در حالت ورود سازمانی بازنشانی رمز از طریق مهرسا ممکن نیست. با حساب سازمانی وارد شوید یا رمز را از Active
                Directory / Entra ID تغییر دهید.
              </p>
            ) : sent ? (
              <div className="space-y-4" data-testid="forgot-password-sent">
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-3.5 py-3.5 ring-1 ring-emerald-100">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  <p className="text-[12.5px] leading-6 text-emerald-800">
                    اگر حسابی با این مشخصات باشد، لینک و کد یک‌بارمصرف به ایمیل ثبت‌شده ارسال شد.
                    <span className="mt-1 block text-emerald-700/80">لینک تا ۱۵ دقیقه اعتبار دارد.</span>
                  </p>
                </div>
                <a
                  href="/reset-password"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-[13px] font-medium text-white transition-all hover:bg-[#2a2a2e] hover:shadow-lg"
                >
                  کد را دارم — ادامه
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <p className="text-[12.5px] leading-6 text-ink-soft">
                  ایمیل یا شماره موبایل حساب را وارد کنید. لینک بازنشانی به ایمیل همان حساب فرستاده می‌شود.
                </p>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium" htmlFor="forgot-identifier">
                    ایمیل یا شماره موبایل
                  </label>
                  <input
                    id="forgot-identifier"
                    name="identifier"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    dir="rtl"
                    data-testid="forgot-identifier"
                    value={identifier ? withRtlMark(faStr(identifier)) : ""}
                    onChange={(e) => setIdentifier(toEnDigits(stripBidiMarks(e.target.value)))}
                    className={fieldClass}
                    placeholder="ali@example.com یا ۰۹۱۲۰۰۰۰۱۰۰۶"
                    required
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-600 ring-1 ring-red-100">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  data-testid="forgot-submit"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-[13px] font-medium text-white transition-all hover:bg-[#2a2a2e] hover:shadow-lg disabled:opacity-50"
                >
                  {loading && <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                  {loading ? "در حال ارسال…" : "ارسال لینک بازنشانی"}
                </button>
                <p className="text-center text-[10.5px] leading-5 text-ink-faint">
                  برای امنیت حساب، به ایمیل/موبایل دیگری اطلاعاتی داده نمی‌شود.
                </p>
              </form>
            )}

            <p className="mt-6 text-center text-[12px]">
              <a href="/login" className="inline-flex flex-row-reverse items-center gap-1 text-ink-soft transition hover:text-ink">
                <svg viewBox="0 0 24 24" className="size-3.5 rotate-180" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                بازگشت به ورود
              </a>
            </p>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
