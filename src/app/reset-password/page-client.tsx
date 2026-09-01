"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { api, type ApiError } from "@/lib/api";
import { faStr, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib/fa";
import { FadeIn } from "@/components/ui/motion";

const fieldClass =
  "h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-right text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15";

export function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ldapBlocked, setLdapBlocked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
    api<{ authMode: string; passwordResetEnabled?: boolean }>("/api/auth/config")
      .then((data) => {
        setLdapBlocked(data.authMode === "ldap" || data.passwordResetEnabled === false);
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("رمز جدید حداقل ۶ کاراکتر است");
      return;
    }
    if (password !== confirmPassword) {
      setError("رمز جدید و تکرار آن یکسان نیست");
      return;
    }
    setLoading(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        json: {
          token: token || undefined,
          identifier: identifier ? toEnDigits(stripBidiMarks(identifier)) : undefined,
          code: code ? toEnDigits(stripBidiMarks(code)) : undefined,
          password,
          confirmPassword,
        },
      });
      router.push("/login");
      router.refresh();
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
              <h1 className="text-[18px] font-bold">رمز جدید</h1>
              <p className="text-[12px] text-ink-soft">مهرسا</p>
            </div>
          </div>

          {ldapBlocked ? (
            <p className="rounded-md bg-paper-soft px-3 py-3 text-[13px] leading-7 text-ink">
              در حالت ورود سازمانی (LDAP) بازنشانی رمز از طریق مهرسا ممکن نیست.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {!token && (
                <>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium" htmlFor="reset-identifier">
                      ایمیل یا شماره موبایل
                    </label>
                    <input
                      id="reset-identifier"
                      name="identifier"
                      type="text"
                      dir="rtl"
                      data-testid="reset-identifier"
                      value={identifier ? withRtlMark(faStr(identifier)) : ""}
                      onChange={(e) => setIdentifier(toEnDigits(stripBidiMarks(e.target.value)))}
                      className={fieldClass}
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium" htmlFor="reset-code">
                      کد یک‌بارمصرف
                    </label>
                    <input
                      id="reset-code"
                      name="code"
                      type="text"
                      inputMode="numeric"
                      dir="rtl"
                      data-testid="reset-code"
                      value={code ? withRtlMark(faStr(code)) : ""}
                      onChange={(e) => setCode(toEnDigits(stripBidiMarks(e.target.value)))}
                      className={fieldClass}
                      placeholder="کد ۶ رقمی ایمیل‌شده"
                      autoComplete="one-time-code"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1.5 block text-[12px] font-medium" htmlFor="reset-password">
                  رمز جدید
                </label>
                <div className="relative">
                  <input
                    id="reset-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    dir="rtl"
                    data-testid="reset-password"
                    value={password ? withRtlMark(password) : ""}
                    onChange={(e) => setPassword(stripBidiMarks(e.target.value))}
                    className={`${fieldClass} pl-11`}
                    required
                    minLength={6}
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

              <div>
                <label className="mb-1.5 block text-[12px] font-medium" htmlFor="reset-confirm">
                  تکرار رمز جدید
                </label>
                <input
                  id="reset-confirm"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  dir="rtl"
                  data-testid="reset-confirm"
                  value={confirmPassword ? withRtlMark(confirmPassword) : ""}
                  onChange={(e) => setConfirmPassword(stripBidiMarks(e.target.value))}
                  className={fieldClass}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2.5 text-[12px] text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                data-testid="reset-submit"
                className="h-11 w-full rounded-md bg-ink text-[13px] font-medium text-white transition hover:bg-[#2a2a2e] disabled:opacity-50"
              >
                {loading ? "در حال ذخیره…" : "ذخیره رمز جدید"}
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
