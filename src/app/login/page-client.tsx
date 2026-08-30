"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";

type AuthMode = "local" | "ldap";

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await api("/api/auth/login", { method: "POST", json: { email, password } });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-soft px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-[40px] w-[40px] items-center justify-center rounded-lg bg-ink">
            <Image
              src="/logo-white.png"
              alt="مهرسا"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold">مهرسا</h1>
            <p className="mt-1 text-[12px] text-ink-soft">سیستم مدیریت جلسات سازمانی</p>
            {ldapMode && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-paper-soft px-2.5 py-1 text-[11px] text-ink-soft">
                <Building2 className="h-3.5 w-3.5" />
                ورود با حساب سازمانی (LDAP)
              </p>
            )}
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-md border border-line bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">
              {ldapMode ? "ایمیل سازمانی" : "ایمیل"}
            </label>
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15"
              placeholder={ldapMode ? "name@company.com" : "admin@example.com"}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">رمز عبور</label>
            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15"
              placeholder="••••••••"
              required
            />
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

          {!ldapMode && (
            <div className="rounded-md bg-paper-soft px-3 py-2.5 text-[11px] leading-5 text-ink-soft" dir="rtl">
              حساب‌های آزمایشی (رمز همه: <span dir="ltr">Pass1234</span>)
              <br />
              <span dir="ltr">admin@ · operator@ · manager@ · room@ · ali@ · amir@ · sara@example.com</span>
            </div>
          )}

          {ldapMode && (
            <p className="text-center text-[11px] leading-5 text-ink-faint">
              با اولین ورود موفق، حساب شما به‌صورت خودکار در مهرسا ساخته می‌شود.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
