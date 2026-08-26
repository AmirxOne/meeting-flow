"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-lg font-bold text-white">
            م
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold">میتینگ‌هاب</h1>
            <p className="mt-1 text-[12px] text-ink-soft">سیستم مدیریت جلسات سازمانی</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">ایمیل</label>
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#d9d9e0] bg-white px-3.5 text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15"
              placeholder="admin@example.com"
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
              className="h-11 w-full rounded-xl border border-[#d9d9e0] bg-white px-3.5 text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[12px] text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-xl bg-ink text-[13px] font-medium text-white transition hover:bg-[#2a2a2e] disabled:opacity-50"
          >
            {loading ? "در حال ورود…" : "ورود"}
          </button>

          <div className="rounded-xl bg-paper-soft px-3 py-2.5 text-[11px] leading-5 text-ink-soft" dir="rtl">
            حساب‌های آزمایشی (رمز همه: <span dir="ltr">Pass1234</span>)
            <br />
            <span dir="ltr">admin@ · operator@ · manager@ · room@ · ali@ · amir@ · sara@example.com</span>
          </div>
        </form>
      </div>
    </div>
  );
}
