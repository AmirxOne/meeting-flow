"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "@/components/ui/icon";
import { faNum } from "@/lib";

const URGENCY_FA: Record<string, string> = {
  URGENT: "فوری — در اسرع وقت",
  NORMAL: "معمولی",
  FLEXIBLE: "منعطف — هر زمان مناسب",
};

/** PUBLIC (no login) meeting-request form for guests. */
export function PublicRequestForm() {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCompany, setGuestCompany] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("NORMAL");
  const [durationMin, setDurationMin] = useState("60");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (guestName.trim().length < 2 || guestPhone.trim().length < 7 || title.trim().length < 2) {
      setError("نام، شماره تماس و موضوع درخواست را کامل کنید");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/meeting-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          guestCompany: guestCompany.trim() || undefined,
          urgency,
          durationMin: Number(durationMin),
        }),
      });
      const j = await res.json().catch(() => null);
      if (res.status === 201) {
        setDone(true);
      } else {
        setError(j?.error?.message ?? "خطا در ثبت درخواست");
      }
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15";

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-paper-soft p-4">
      <div className="w-full max-w-lg">
        {/* brand */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="مهرسا" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <p className="text-[15px] font-bold">مهرسا</p>
            <p className="text-[11px] text-ink-faint">درخواست جلسه — بدون نیاز به ورود</p>
          </div>
        </div>

        {done ? (
          <div className="rounded-xl border border-line bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="mt-3 text-[15px] font-bold">درخواست شما ثبت شد</p>
            <p className="mt-2 text-[12px] leading-6 text-ink-soft">
              همکاران ما در اسرع وقت زمان جلسه را هماهنگ کرده و با شما تماس می‌گیرند.
            </p>
            <button
              onClick={() => {
                setDone(false);
                setTitle("");
                setDescription("");
              }}
              className="mt-5 h-10 rounded-md border border-line px-4 text-[12px] text-ink-soft hover:bg-paper-soft"
            >
              ثبت درخواست جدید
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-white p-6 sm:p-8">
            <h1 className="text-[16px] font-bold">درخواست جلسه</h1>
            <p className="mt-1 text-[12px] text-ink-soft">
              نیاز خود را ثبت کنید — هماهنگی زمان با ما
            </p>

            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">نام و نام خانوادگی *</label>
                  <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className={field} placeholder="نام شما" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">شماره تماس *</label>
                  <input
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className={field}
                    placeholder="09xxxxxxxxx"
                    dir="ltr"
                    inputMode="tel"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium">سازمان / شرکت (اختیاری)</label>
                <input value={guestCompany} onChange={(e) => setGuestCompany(e.target.value)} className={field} placeholder="نام سازمان شما" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium">موضوع جلسه *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={field}
                  placeholder="مثلاً: جلسه معرفی محصول"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium">توضیح نیاز (اختیاری)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-[#d9d9e0] p-3 text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15"
                  placeholder="چه چیزی باید در این جلسه بررسی شود؟"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">فوریت</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    className={field}
                  >
                    {Object.entries(URGENCY_FA).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">مدت تقریبی</label>
                  <select
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    className={field}
                  >
                    <option value="30">۳۰ دقیقه</option>
                    <option value="60">۱ ساعت</option>
                    <option value="90">۱.۵ ساعت</option>
                    <option value="120">۲ ساعت</option>
                  </select>
                </div>
              </div>

              {error && (
                <p className="rounded-md bg-red-50 p-2.5 text-[12px] text-red-700">{error}</p>
              )}

              <button
                onClick={submit}
                disabled={busy}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink text-[13px] font-medium text-white transition-colors hover:bg-[#2a2a2e] disabled:opacity-60"
              >
                <ArrowLeft className="h-4 w-4" />
                {busy ? "در حال ثبت…" : "ثبت درخواست"}
              </button>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-ink-faint">
          {faNum(0) && ""}کارمند سازمان هستید؟{" "}
          <a href="/login" className="font-medium text-ink underline underline-offset-4">
            وارد شوید
          </a>
        </p>
      </div>
    </div>
  );
}
