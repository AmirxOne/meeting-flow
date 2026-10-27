"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, DoorOpen, Loader2, MapPin, UserCircle } from "@/components/ui/icon";
import { FadeIn } from "@/components/ui/motion";
import { api, type ApiError } from "@/lib/api";
import { faStr, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib/fa";
import { proposeOrgSlug, normalizeOrgSlug } from "@/lib/org-slug";
import { BrandLogo } from "@/components/ui/brand-logo";

/**
 * راه‌اندازی اولیه‌ی سازمان — تک‌صفحه، فقط برای ادمینِ لاگین‌شده.
 * بخش «مدیر» وجود ندارد: خودِ کاربر جاری ادمین سازمان می‌شود.
 */

const field =
  "h-11 w-full rounded-lg border border-line bg-white px-3.5 text-right text-[13px] text-ink outline-none transition placeholder:text-ink-faint/70 focus:border-ink focus:ring-[3px] focus:ring-ink/10";
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

  async function submit() {
    setError(null);
    if (orgName.trim().length < 2) return setError("نام سازمان را وارد کنید (حداقل ۲ نویسه)");
    if (!slugPreview) return setError("شناسه‌ی انگلیسی (slug) نامعتبر است — فقط a-z، 0-9 و خط تیره");
    if (branchName.trim().length < 2 || roomName.trim().length < 2)
      return setError("نام شعبه و اتاق را کامل کنید");
    const cap = Number(toEnDigits(roomCapacity));
    if (!Number.isFinite(cap) || cap < 1) return setError("ظرفیت اتاق نامعتبر است");

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
          roomCapacity: cap,
        },
      });
      try {
        sessionStorage.setItem("mh-show-setup-tour", "1");
      } catch {
        /* ignore */
      }
      router.push("/dashboard?welcome=1");
    } catch (e) {
      setError((e as ApiError).message ?? "خطا در راه‌اندازی — دوباره تلاش کنید");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = orgName.trim().length >= 2 && !!slugPreview && branchName.trim().length >= 2 && roomName.trim().length >= 2 && !loading;

  return (
    <FadeIn className="min-h-screen bg-paper px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        {/* هدر */}
        <div className="flex items-center gap-3">
          <BrandLogo size={44} orgName={orgName || "سازمان"} />
          <div className="min-w-0">
            <h1 className="text-[19px] font-bold text-ink">راه‌اندازی اولیه‌ی سامانه</h1>
            <p className="mt-0.5 text-[12.5px] leading-5 text-ink-soft">
              سه اطلاعات زیر را یک بار وارد کنید؛ بعد از آن می‌توانید شعبه‌ها، اتاق‌ها و کاربران را از پنل مدیریت بسازید.
            </p>
          </div>
        </div>

        {/* کارت ادمین جاری */}
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-paper-soft/60 px-4 py-3">
          <UserCircle className="size-8 shrink-0 text-ink-soft" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-ink">{withRtlMark(actorName)}</p>
            <p className="truncate text-[11.5px] text-ink-faint" dir="ltr">{actorEmail}</p>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10.5px] font-medium text-emerald-800">
            مدیر سازمان خواهد شد
          </span>
        </div>

        {/* بخش سازمان */}
        <section className="mt-5 rounded-xl border border-line bg-white p-5">
          <SectionHead icon={<Building2 className="size-4" />} title="سازمان" hint="نام شرکت یا مجموعه‌ی شما" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-[12px] font-medium text-ink-soft">نام سازمان *</span>
              <input
                data-testid="setup-org-name"
                value={orgName ? withRtlMark(orgName) : ""}
                onChange={(e) => setOrgName(stripBidiMarks(e.target.value))}
                placeholder="مثلاً: شرکت نمونه"
                className={field}
                autoFocus
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink-soft">شناسه‌ی انگلیسی (slug)</span>
              <input
                data-testid="setup-org-slug"
                dir="ltr"
                value={orgSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setOrgSlug(e.target.value);
                }}
                placeholder="sample-co"
                className={fieldLtr}
              />
              <span className="block text-[10.5px] text-ink-faint">
                {slugPreview ? `شناسه‌ی نهایی: ${slugPreview}` : "خودکار از نام سازمان ساخته می‌شود"}
              </span>
            </label>
          </div>
        </section>

        {/* بخش مکان */}
        <section className="mt-4 rounded-xl border border-line bg-white p-5">
          <SectionHead icon={<MapPin className="size-4" />} title="شعبه و اتاق اول" hint="بعداً می‌توانید بیشتر بسازید" />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink-soft">نام شعبه *</span>
              <input
                data-testid="setup-branch-name"
                value={branchName ? withRtlMark(branchName) : ""}
                onChange={(e) => setBranchName(stripBidiMarks(e.target.value))}
                className={field}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink-soft">نام اتاق *</span>
              <input
                data-testid="setup-room-name"
                value={roomName ? withRtlMark(roomName) : ""}
                onChange={(e) => setRoomName(stripBidiMarks(e.target.value))}
                className={field}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink-soft">ظرفیت اتاق</span>
              <input
                data-testid="setup-room-capacity"
                inputMode="numeric"
                value={roomCapacity ? faStr(roomCapacity) : ""}
                onChange={(e) => setRoomCapacity(toEnDigits(stripBidiMarks(e.target.value)).replace(/\D/g, ""))}
                className={field}
              />
            </label>
          </div>
        </section>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-[12px] text-red-600" data-testid="setup-error">
            {error}
          </p>
        )}

        {/* دکمه */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[11px] leading-5 text-ink-faint">
            <DoorOpen className="ml-1 inline size-3.5 align-[-2px]" />
            این صفحه فقط یک بار نمایش داده می‌شود و پس از ثبت، برای همیشه بسته است.
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
        </div>
      </div>
    </FadeIn>
  );
}

function SectionHead({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line pb-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-paper-soft text-ink-soft">{icon}</span>
      <div>
        <h2 className="text-[13.5px] font-bold text-ink">{title}</h2>
        <p className="text-[11px] text-ink-faint">{hint}</p>
      </div>
    </div>
  );
}
