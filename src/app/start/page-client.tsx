"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, DoorOpen, MessageQuestion, User } from "@/components/ui/icon";
import { FadeIn } from "@/components/ui/motion";
import { api, type ApiError } from "@/lib/api";
import { faNum, faStr, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib/fa";
import { proposeOrgSlug, normalizeOrgSlug } from "@/lib/org-slug";

const STEPS = [
  { id: 1, title: "سازمان", icon: Building2 },
  { id: 2, title: "مدیر", icon: User },
  { id: 3, title: "شعبه و اتاق", icon: DoorOpen },
] as const;

const fieldClass =
  "h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-right text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15";

export function OrgSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [branchName, setBranchName] = useState("دفتر مرکزی");
  const [roomName, setRoomName] = useState("اتاق جلسه ۱");
  const [roomCapacity, setRoomCapacity] = useState("8");

  useEffect(() => {
    if (slugTouched) return;
    const proposed = proposeOrgSlug(orgName);
    if (proposed) setOrgSlug(proposed);
  }, [orgName, slugTouched]);

  const slugPreview = useMemo(() => normalizeOrgSlug(orgSlug) ?? proposeOrgSlug(orgName), [orgSlug, orgName]);

  function nextStep() {
    setError(null);
    if (step === 1) {
      if (orgName.trim().length < 2) {
        setError("نام سازمان را وارد کنید");
        return;
      }
      if (!slugPreview) {
        setError("شناسه انگلیسی (slug) نامعتبر است — فقط a-z، 0-9 و خط تیره");
        return;
      }
    }
    if (step === 2) {
      if (adminFullName.trim().length < 2) {
        setError("نام مدیر را وارد کنید");
        return;
      }
      if (!adminEmail.includes("@")) {
        setError("ایمیل مدیر نامعتبر است");
        return;
      }
      if (adminPassword.length < 6) {
        setError("رمز عبور حداقل ۶ کاراکتر");
        return;
      }
    }
    setStep((s) => Math.min(3, s + 1));
  }

  async function submit() {
    setError(null);
    if (branchName.trim().length < 2 || roomName.trim().length < 2) {
      setError("نام شعبه و اتاق را کامل کنید");
      return;
    }
    const cap = Number(toEnDigits(roomCapacity));
    if (!Number.isFinite(cap) || cap < 1) {
      setError("ظرفیت اتاق نامعتبر است");
      return;
    }

    setLoading(true);
    try {
      await api("/api/public/setup", {
        method: "POST",
        json: {
          orgName: orgName.trim(),
          orgSlug: slugPreview ?? undefined,
          adminFullName: adminFullName.trim(),
          adminEmail: stripBidiMarks(adminEmail).trim().toLowerCase(),
          adminPassword,
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
      router.refresh();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper-soft px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #d9d9e0 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <FadeIn className="relative mx-auto w-full max-w-[720px]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo-white.png" alt="مهرسا" width={36} height={36} className="rounded-xl bg-ink p-1.5" />
            <div>
              <h1 className="text-[20px] font-bold">شروع برای سازمان من</h1>
              <p className="text-[12px] text-ink-soft">راه‌اندازی اولیه — بدون seed دستی</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="setup-help-toggle"
            onClick={() => setHelpOpen((v) => !v)}
            className="flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[12px] text-ink-soft transition hover:text-ink"
          >
            <MessageQuestion className="h-4 w-4" />
            راهنما
          </button>
        </div>

        {helpOpen && (
          <div className="mb-4 rounded-xl border border-line bg-white px-4 py-3 text-[12px] leading-7 text-ink-soft">
            <p>
              این ویزارد فقط وقتی پایگاه داده خالی است فعال می‌شود. یک سازمان، مدیر (ADMIN)، یک شعبه، طبقه اول و
              یک اتاق می‌سازد. برای محیط dev همچنان می‌توانید از <code className="text-ink">pnpm db:seed</code>{" "}
              استفاده کنید.
            </p>
          </div>
        )}

        <ol className="mb-6 flex gap-2" data-testid="setup-steps">
          {STEPS.map(({ id, title, icon: Icon }) => (
            <li
              key={id}
              className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                step === id
                  ? "border-ink bg-white font-medium text-ink shadow-sm"
                  : step > id
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-line bg-white/70 text-ink-soft"
              }`}
            >
              {step > id ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Icon className="h-4 w-4 shrink-0" />}
              <span>{title}</span>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-line bg-white px-6 py-8 shadow-[0_24px_80px_-28px_rgba(13,13,13,0.2)] sm:px-10">
          {step === 1 && (
            <div className="space-y-4" data-testid="setup-step-org">
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium">نام سازمان *</span>
                <input
                  data-testid="setup-org-name"
                  value={orgName ? withRtlMark(orgName) : ""}
                  onChange={(e) => setOrgName(stripBidiMarks(e.target.value))}
                  className={fieldClass}
                  placeholder="شرکت نمونه"
                  autoFocus
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium">شناسه URL (slug)</span>
                <input
                  data-testid="setup-org-slug"
                  dir="ltr"
                  value={orgSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setOrgSlug(stripBidiMarks(e.target.value).toLowerCase());
                  }}
                  className={`${fieldClass} text-left font-mono text-[12px]`}
                  placeholder="sample-co"
                />
                <p className="text-[11px] text-ink-faint">
                  ورود: <span dir="ltr">{slugPreview ? `/login?org=${slugPreview}` : "—"}</span>
                </p>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4" data-testid="setup-step-admin">
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium">نام مدیر *</span>
                <input
                  data-testid="setup-admin-name"
                  value={adminFullName ? withRtlMark(adminFullName) : ""}
                  onChange={(e) => setAdminFullName(stripBidiMarks(e.target.value))}
                  className={fieldClass}
                  placeholder="علیرضا محمدی"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium">ایمیل مدیر *</span>
                <input
                  data-testid="setup-admin-email"
                  type="email"
                  dir="ltr"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(stripBidiMarks(e.target.value))}
                  className={`${fieldClass} text-left`}
                  placeholder="admin@company.ir"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium">رمز عبور *</span>
                <input
                  data-testid="setup-admin-password"
                  type="password"
                  dir="rtl"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(stripBidiMarks(e.target.value))}
                  className={fieldClass}
                  placeholder="حداقل ۶ کاراکتر"
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4" data-testid="setup-step-location">
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium">نام شعبه اول *</span>
                <input
                  data-testid="setup-branch-name"
                  value={branchName ? withRtlMark(branchName) : ""}
                  onChange={(e) => setBranchName(stripBidiMarks(e.target.value))}
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium">نام اتاق اول *</span>
                <input
                  data-testid="setup-room-name"
                  value={roomName ? withRtlMark(roomName) : ""}
                  onChange={(e) => setRoomName(stripBidiMarks(e.target.value))}
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium">ظرفیت اتاق</span>
                <input
                  data-testid="setup-room-capacity"
                  inputMode="numeric"
                  value={roomCapacity ? faStr(roomCapacity) : ""}
                  onChange={(e) => setRoomCapacity(toEnDigits(stripBidiMarks(e.target.value)).replace(/\D/g, ""))}
                  className={fieldClass}
                />
              </label>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2.5 text-[12px] text-red-600" data-testid="setup-error">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep((s) => s - 1);
                }}
                className="h-10 rounded-md border border-line px-4 text-[13px] text-ink-soft transition hover:bg-paper-soft"
              >
                قبلی
              </button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <button
                type="button"
                data-testid="setup-next"
                onClick={nextStep}
                className="h-10 rounded-md bg-ink px-6 text-[13px] font-medium text-white transition hover:bg-[#2a2a2e]"
              >
                بعدی
              </button>
            ) : (
              <button
                type="button"
                data-testid="setup-submit"
                disabled={loading}
                onClick={submit}
                className="h-10 rounded-md bg-ink px-6 text-[13px] font-medium text-white transition hover:bg-[#2a2a2e] disabled:opacity-50"
              >
                {loading ? "در حال ساخت…" : "ساخت سازمان و ورود"}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-faint">
          محیط dev با دادهٔ نمونه: بعد از <code className="text-ink-soft">pnpm db:seed</code> از /login وارد شوید.
        </p>
      </FadeIn>
    </div>
  );
}
