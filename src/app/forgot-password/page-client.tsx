"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { api, type ApiError } from "@/lib/api";
import { faStr, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib/fa";
import { FadeIn } from "@/components/ui/motion";

type AuthMode = "local" | "ldap";

const fieldClass =
  "h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-right text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15";

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
      <FadeIn className="relative w-full max-w-[440px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white px-6 py-8 shadow-[0_24px_80px_-28px_rgba(13,13,13,0.28)] sm:px-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink">
              <Image
                src="/logo-white.png"
                alt="مهرسا"
                width={26}
                height={26}
                className="h-[26px] w-[26px] object-contain"
              />
            </div>
            <div>
              <h1 className="text-[18px] font-bold">فراموشی رمز عبور</h1>
              <p className="text-[12px] text-ink-soft">مهرسا</p>
            </div>
          </div>

          {ldapMode ? (
            <p className="rounded-md bg-paper-soft px-3 py-3 text-[13px] leading-7 text-ink">
              در حالت ورود سازمانی بازنشانی رمز از طریق مهرسا ممکن نیست. با حساب سازمانی وارد شوید یا رمز را از Active
              Directory / Entra ID تغییر دهید.
            </p>
          ) : sent ? (
            <div className="space-y-4" data-testid="forgot-password-sent">
              <p className="rounded-md bg-emerald-50 px-3 py-3 text-[13px] leading-7 text-emerald-800">
                اگر حسابی با این مشخصات باشد، لینک و کد یک‌بارمصرف به ایمیل ثبت‌شده ارسال شد. لینک تا ۱۵ دقیقه اعتبار
                دارد.
              </p>
              <a
                href="/reset-password"
                className="inline-block text-[12px] text-ink-soft hover:text-ink"
              >
                کد را دارم — ادامه
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
                <p className="rounded-md bg-red-50 px-3 py-2.5 text-[12px] text-red-600">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                data-testid="forgot-submit"
                className="h-11 w-full rounded-md bg-ink text-[13px] font-medium text-white transition hover:bg-[#2a2a2e] disabled:opacity-50"
              >
                {loading ? "در حال ارسال…" : "ارسال لینک بازنشانی"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-[12px]">
            <a href="/login" className="text-ink-soft hover:text-ink">
              بازگشت به ورود
            </a>
          </p>
        </div>
      </FadeIn>
    </div>
  );
}
