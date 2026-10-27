"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, DoorOpen, Loader2, MapPin, UserCircle, CheckCircle2, ShieldCheck,
} from "@/components/ui/icon";
import { FadeIn } from "@/components/ui/motion";
import { api, type ApiError } from "@/lib/api";
import { faStr, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib/fa";
import { proposeOrgSlug, normalizeOrgSlug } from "@/lib/org-slug";
import { BrandLogo } from "@/components/ui/brand-logo";

/**
 * راه‌اندازی اولیه‌ی سازمان — فقط برای کاربر لاگین‌شده، فقط یک بار.
 * Layout دو-ستونه: پنل معرفی (راست) + فرم تک‌صفحه‌ای (چپ).
 */

const field =
  "h-11 w-full rounded-lg border border-line bg-white px-3.5 text-right text-[13px] text-ink outline-none transition placeholder:text-ink-faint/60 focus:border-ink focus:ring-[3px] focus:ring-ink/10 disabled:bg-paper-soft";
const fieldLtr = field + " text-left";

export function OrgSetupPage({ actorName, actorEmail }: { actorName: string; actorEmail: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [branchName, setBranchName] = useState("دفتر مرکزی");
  const [roomName, setRoomName] = useState("اتاق جلسه ۱");
  const [roomCapacity, setRoomCapacity] = useState("8");

  useEffect(() => {
    if (slugTouched) return;
    const proposed = proposeOrgSlug(orgName);
    if (proposed) setOrgSlug(proposed);
  }, [orgName, slugTouched]);

  const slugPreview = useMemo(
    () => normalizeOrgSlug(orgSlug) ?? proposeOrgSlug(orgName),
    [orgSlug, orgName],
  );

  const capNum = Number(toEnDigits(roomCapacity));
  const validOrg = orgName.trim().length >= 2 && !!slugPreview;
  const validLoc = branchName.trim().length >= 2 && roomName.trim().length >= 2 && Number.isFinite(capNum) && capNum >= 1;
  const canSubmit = validOrg && validLoc && !loading;

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await api("/api/setup", {
        method: "POST",
        json: {
          orgName: orgName.trim(),
          orgSlug: slugPreview ?? undefined,
          adminFullName: actorName,
          adminEmail: actorEmail,
          adminPassword: "-", // حساب جدید ساخته نمی‌شود — کاربر جاری ادمین می‌شود
          branchName: branchName.trim(),
          roomName: roomName.trim(),
          roomCapacity: capNum,
        },
      });
      try {
        sessionStorage.setItem("mh-show-setup-tour", "1");
      } catch { /* ignore */ }
      router.push("/dashboard?welcome=1");
    } catch (e) {
      setError((e as ApiError).message ?? "خطا در راه‌اندازی — دوباره تلاش کنید");
      setLoading(false);
    }
  }

  return (
    <FadeIn className="flex min-h-screen items-stretch justify-center bg-paper py-8 px-4">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_40px_-12px_rgba(0,0,0,0.12)]">

        {/* ── پنل معرفی (راست) ── */}
        <aside className="relative hidden w-[300px] shrink-0 flex-col justify-between overflow-hidden bg-ink p-7 text-white md:flex">
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-white/5 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-12 size-64 rounded-full bg-emerald-400/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }} />

          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <BrandLogo size={30} orgName={orgName || "سازمان"} />
            </div>
            <h2 className="mt-5 text-[17px] font-bold leading-7">
              به سامانه‌ی مدیریت جلسات<br />خوش آمدید
            </h2>
            <p className="mt-2 text-[12px] leading-6 text-white/60">
              سه قدم کوتاه تا شروع: اطلاعات پایه‌ی سازمان، شعبه‌ی اول و اتاق اول را وارد کنید.
            </p>

            <ul className="mt-7 space-y-4">
              {[
                { t: "سازمان", d: "نام و شناسه‌ی شرکت" },
                { t: "شعبه", d: "محل اصلی برگزاری جلسات" },
                { t: "اتاق جلسه", d: "اولین اتاق قابل رزرو" },
              ].map((s, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold ring-1 ring-white/10">
                    {faStr(String(i + 1))}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium leading-5">{s.t}</p>
                    <p className="text-[10.5px] leading-4 text-white/50">{s.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex items-center gap-2 text-[10.5px] text-white/45">
            <ShieldCheck className="size-3.5" />
            پس از ثبت، این صفحه برای همیشه بسته و غیرقابل دسترس می‌شود.
          </div>
        </aside>

        {/* ── فرم (چپ) ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* هدر فرم */}
          <header className="flex items-center gap-3 border-b border-line px-6 py-5">
            <div className="min-w-0 flex-1">
              <h1 className="text-[16px] font-bold text-ink">راه‌اندازی اولیه</h1>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">اطلاعات پایه — بعداً از پنل مدیریت قابل تکمیل است</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10.5px] font-medium text-emerald-800">
              <UserCircle className="size-3.5" />
              {withRtlMark(actorName)}
            </span>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* بخش سازمان */}
            <section>
              <SectionHead step="۱" icon={<Building2 className="size-4" />} title="سازمان" />
              <div className="mt-4 grid gap-4">
                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-ink-soft">نام سازمان <Req /></span>
                  <input
                    data-testid="setup-org-name"
                    value={orgName ? withRtlMark(orgName) : ""}
                    onChange={(e) => setOrgName(stripBidiMarks(e.target.value))}
                    placeholder="نام رسمی شرکت یا مجموعه"
                    className={field}
                    autoFocus
                  />
                  {validOrg && (
                    <span className="flex items-center gap-1 text-[10.5px] text-emerald-700">
                      <CheckCircle2 className="size-3" /> ثبت می‌شود: {withRtlMark(orgName.trim())}
                    </span>
                  )}
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-ink-soft">شناسه‌ی لاتین (slug)</span>
                  <input
                    data-testid="setup-org-slug"
                    dir="ltr"
                    value={orgSlug}
                    onChange={(e) => { setSlugTouched(true); setOrgSlug(e.target.value); }}
                    placeholder="company-co"
                    className={fieldLtr}
                  />
                  <span className="block text-[10.5px] text-ink-faint">
                    {slugPreview ? `slug/${slugPreview}` : "در صورت خالی‌گذاشتن، از نام سازمان ساخته می‌شود"}
                  </span>
                </label>
              </div>
            </section>

            {/* بخش مکان */}
            <section>
              <SectionHead step="۲" icon={<MapPin className="size-4" />} title="شعبه و اتاق اول" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-ink-soft">نام شعبه <Req /></span>
                  <input
                    data-testid="setup-branch-name"
                    value={branchName ? withRtlMark(branchName) : ""}
                    onChange={(e) => setBranchName(stripBidiMarks(e.target.value))}
                    className={field}
                  />
                </label>
                <div className="grid grid-cols-[1fr_88px] gap-2">
                  <label className="block space-y-1.5">
                    <span className="text-[12px] font-medium text-ink-soft">نام اتاق <Req /></span>
                    <input
                      data-testid="setup-room-name"
                      value={roomName ? withRtlMark(roomName) : ""}
                      onChange={(e) => setRoomName(stripBidiMarks(e.target.value))}
                      className={field}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[12px] font-medium text-ink-soft">ظرفیت</span>
                    <input
                      data-testid="setup-room-capacity"
                      inputMode="numeric"
                      value={roomCapacity ? faStr(roomCapacity) : ""}
                      onChange={(e) => setRoomCapacity(toEnDigits(stripBidiMarks(e.target.value)).replace(/\D/g, ""))}
                      className={field + " text-center"}
                    />
                  </label>
                </div>
              </div>
            </section>

            {error && (
              <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-[12px] text-red-600" data-testid="setup-error">{error}</p>
            )}
          </div>

          {/* فوتر ثابت */}
          <footer className="flex items-center justify-between gap-3 border-t border-line bg-paper-soft/40 px-6 py-4">
            <p className="flex items-center gap-1.5 text-[10.5px] leading-5 text-ink-faint">
              <DoorOpen className="size-3.5 shrink-0" />
              شعبه‌ها و اتاق‌های بیشتر را بعداً از پنل مدیریت اضافه کنید.
            </p>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              data-testid="setup-submit"
              className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-ink px-6 text-[13.5px] font-medium text-white transition hover:bg-[#2a2a2e] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "راه‌اندازی سامانه"}
            </button>
          </footer>
        </div>
      </div>
    </FadeIn>
  );
}

function Req() {
  return <span className="text-red-500">*</span>;
}

function SectionHead({ step, icon, title }: { step: string; icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-ink text-[11px] font-bold text-white">{step}</span>
      <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
        {icon}
        {title}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
