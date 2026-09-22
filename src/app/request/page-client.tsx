"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, ChevronDown, Search, X, UserRound, Plus } from "@/components/ui/icon";
import { JalaliDatePicker, TimePicker } from "@/components/ui/jalali-date-picker";
import { faStr, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib/fa";

const URGENCY_FA: Record<string, string> = {
  URGENT: "فوری — در اسرع وقت",
  NORMAL: "معمولی",
  FLEXIBLE: "منعطف — هر زمان مناسب",
};

const DURATIONS: { v: string; l: string }[] = [
  { v: "30", l: "۳۰ دقیقه" },
  { v: "60", l: "۱ ساعت" },
  { v: "90", l: "۱.۵ ساعت" },
  { v: "120", l: "۲ ساعت" },
];

type PubPerson = { id: string; name: string; jobTitle?: string | null; company?: string | null };

/** PUBLIC (no login) meeting-request form for guests. */
export function PublicRequestForm() {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCompany, setGuestCompany] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("NORMAL");
  const [durationMin, setDurationMin] = useState("60");
  const [attendeeCount, setAttendeeCount] = useState(2);
  const [people, setPeople] = useState<PubPerson[]>([]); // picked from public directory
  const [busy, setBusy] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  // preferred window (optional): day + from/to hours
  const [prefDay, setPrefDay] = useState("");
  const [prefFrom, setPrefFrom] = useState("");
  const [prefTo, setPrefTo] = useState("");
  // ONSITE = our company · OFFSITE = at another org (e.g. همراه اول)
  const [venue, setVenue] = useState<"ONSITE" | "OFFSITE">("ONSITE");
  const [recFreq, setRecFreq] = useState("NONE");
  const [recCount, setRecCount] = useState("4");
  const [offsiteOrg, setOffsiteOrg] = useState("");
  const [offsiteNote, setOffsiteNote] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (guestName.trim().length < 2 || guestPhone.trim().length < 7 || title.trim().length < 2) {
      setError("نام، شماره تماس و موضوع درخواست را کامل کنید");
      return;
    }
    if (venue === "OFFSITE" && offsiteOrg.trim().length < 2) {
      setError("نام سازمان مقصد را بنویسید");
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
          isPrivate,
          durationMin: Number(durationMin),
          ...(recFreq !== "NONE" ? { recReq: { freq: recFreq, count: Number(recCount) } } : {}),
          venue,
          ...(venue === "OFFSITE" ? { offsiteOrg: offsiteOrg.trim() } : {}),
          ...(venue === "OFFSITE" && offsiteNote.trim() ? { offsiteNote: offsiteNote.trim() } : {}),
          ...(prefDay && prefFrom
            ? {
                prefFrom: tehranToIso(prefDay, prefFrom),
                ...(prefTo ? { prefTo: tehranToIso(prefDay, prefTo) } : {}),
              }
            : {}),
          attendeeCount,
          requestedPersonIds: people.map((p) => p.id),
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
    <div dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper-soft p-4 sm:p-6">
      {/* dot-pattern backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #d9d9e0 1px, transparent 0)", backgroundSize: "22px 22px" }} />
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/4 size-96 rounded-full bg-ink/[0.05] blur-3xl" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.3)] lg:grid-cols-[340px_1fr]">
        {/* ── side panel: brand + trust ── */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-8 text-white lg:flex">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.14) 1px, transparent 0)", backgroundSize: "22px 22px" }} />
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 size-56 rounded-full bg-emerald-400/15 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-white.png" alt="مهرسا" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <p className="text-[15px] font-bold">مهرسا</p>
                <p className="text-[10.5px] text-white/60">سامانه‌ی مدیریت جلسات سازمانی</p>
              </div>
            </div>
            <h2 className="mt-8 text-[20px] font-bold leading-9">
              جلسه‌تان را درخواست کنید،
              <br />
              هماهنگی با ما
            </h2>
            <p className="mt-3 text-[12px] leading-7 text-white/60">
              بدون حساب کاربری — درخواست شما مستقیم به تیم هماهنگی می‌رسد و نتیجه همان‌جا با شما تماس گرفته می‌شود.
            </p>
          </div>

          <ul className="relative mt-10 space-y-3">
            {[
              { t: "بدون نیاز به ثبت‌نام", d: "فرم کوتاه — کمتر از یک دقیقه" },
              { t: "تقویم شمسی و بازه دلخواه", d: "روز و ساعت مورد نظرتان را مشخص کنید" },
              { t: "حضوری یا بیرونی", d: "در شرکت یا در محل سازمان شما" },
              { t: "پیگیری با کد رهگیری", d: "وضعیت درخواست همیشه در دسترس" },
            ].map((f) => (
              <li key={f.t} className="flex items-start gap-2.5 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-[12px] font-bold">{f.t}</p>
                  <p className="mt-0.5 text-[10.5px] leading-4 text-white/55">{f.d}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="relative mt-8 text-[10px] leading-5 text-white/40">
            حریم خصوصی شما محفوظ است — اطلاعات فقط برای هماهنگی همین جلسه استفاده می‌شود.
          </p>
        </aside>

        {/* ── form column ── */}
        <div className="p-6 sm:p-8">
        {/* mobile brand */}
        <div className="mb-5 flex items-center gap-3 lg:hidden">
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
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 0.8, 0.36, 1] }}
            className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-8 text-center"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </span>
            <p className="mt-4 text-[16px] font-bold">درخواست شما ثبت شد</p>
            <p className="mx-auto mt-2 max-w-xs text-[12.5px] leading-7 text-ink-soft">
              همکاران ما در اسرع وقت زمان جلسه را هماهنگ کرده و با شما تماس می‌گیرند.
            </p>
            <button
              onClick={() => {
                setDone(false);
                setTitle("");
                setDescription("");
                setPeople([]);
                setAttendeeCount(2);
                setPrefDay("");
                setPrefFrom("");
                setPrefTo("");
                setVenue("ONSITE");
                setOffsiteOrg("");
                setOffsiteNote("");
                setRecFreq("NONE");
                setRecCount("4");
              }}
              className="mt-5 h-10 rounded-md border border-line px-4 text-[12px] text-ink-soft hover:bg-paper-soft"
            >
              ثبت درخواست جدید
            </button>
          </motion.div>
        ) : (
          <div>
            <h1 className="text-[18px] font-bold">درخواست جلسه</h1>
            <p className="mt-1 text-[12px] leading-6 text-ink-soft">نیاز خود را ثبت کنید — هماهنگی زمان با ما؛ فیلدهای ستاره‌دار الزامی‌اند.</p>

            <div className="mt-6 space-y-4">
              <FormSection n={1} title="اطلاعات تماس" hint="برای هماهنگی زمان با شما تماس می‌گیریم">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">نام و نام خانوادگی *</label>
                  <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className={field} placeholder="نام شما" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">شماره تماس *</label>
                  <input
                    value={guestPhone ? withRtlMark(faStr(guestPhone)) : ""}
                    onChange={(e) => setGuestPhone(toEnDigits(stripBidiMarks(e.target.value)))}
                    className={field}
                    placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                    dir="rtl"
                    inputMode="tel"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium">سازمان / شرکت (اختیاری)</label>
                <input value={guestCompany} onChange={(e) => setGuestCompany(e.target.value)} className={field} placeholder="نام سازمان شما" />
              </div>
              </FormSection>

              <FormSection n={2} title="جزئیات جلسه" hint="موضوع و افراد مورد نظر شما">
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

              {/* who do you want to meet — public directory picker */}
              <PublicPeoplePicker value={people} onChange={setPeople} />

              {/* confidential */}
              <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-md border border-line bg-white px-3.5 transition-colors hover:bg-paper-soft/50">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="h-4 w-4 accent-black" />
                <span className="text-[12px]">جلسه محرمانه — موضوع و جزئیات فقط برای من، دعوت‌شدگان و مدیریت دیده می‌شود</span>
              </label>
              </FormSection>

              <FormSection n={3} title="زمان و محل" hint="تکرار، محل برگزاری و بازه‌ی دلخواه">
              {/* recurrence */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">تکرار (اختیاری)</label>
                  <GuestSelect value={recFreq} onChange={setRecFreq} options={[
                    { v: "NONE", l: "بدون تکرار — یک جلسه" },
                    { v: "DAILY", l: "هر روز" },
                    { v: "WEEKLY", l: "هر هفته" },
                    { v: "MONTHLY", l: "هر ماه" },
                  ]} />
                </div>
                {recFreq !== "NONE" && (
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium">تعداد دفعات</label>
                    <GuestSelect value={recCount} onChange={setRecCount} options={[2, 3, 4, 6, 8, 12].map((n) => ({ v: String(n), l: fa(n) + " بار" }))} />
                  </div>
                )}
              </div>

              {/* venue */}
              <div className="rounded-lg border border-line bg-paper-soft/40 p-3.5">
                <p className="text-[12px] font-bold">محل برگزاری</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setVenue("ONSITE")}
                    className={
                      "flex items-center gap-2.5 rounded-md border p-3 text-right transition-colors " +
                      (venue === "ONSITE" ? "border-ink bg-white shadow-sm" : "border-line bg-white hover:bg-paper-soft")
                    }
                  >
                    <span className={"h-3.5 w-3.5 shrink-0 rounded-full border-2 " + (venue === "ONSITE" ? "border-ink bg-ink" : "border-[#c9c9d0]")} />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium">در شرکت خودمان</span>
                      <span className="block text-[10.5px] text-ink-faint">اتاق را مدیریت انتخاب می‌کند</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVenue("OFFSITE")}
                    className={
                      "flex items-center gap-2.5 rounded-md border p-3 text-right transition-colors " +
                      (venue === "OFFSITE" ? "border-ink bg-white shadow-sm" : "border-line bg-white hover:bg-paper-soft")
                    }
                  >
                    <span className={"h-3.5 w-3.5 shrink-0 rounded-full border-2 " + (venue === "OFFSITE" ? "border-ink bg-ink" : "border-[#c9c9d0]")} />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium">بیرون از شرکت</span>
                      <span className="block text-[10.5px] text-ink-faint">جلسه در محل سازمان مقصد</span>
                    </span>
                  </button>
                </div>
                {venue === "OFFSITE" && (
                  <div className="mt-3 space-y-2.5">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-ink-soft">نام سازمان مقصد *</label>
                      <input
                        value={offsiteOrg}
                        onChange={(e) => setOffsiteOrg(e.target.value)}
                        placeholder="مثلاً: همراه اول"
                        className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-ink-soft">نشانی / توضیح (اختیاری)</label>
                      <input
                        value={offsiteNote}
                        onChange={(e) => setOffsiteNote(e.target.value)}
                        placeholder="مثلاً: برج ساعی، طبقه ۵"
                        className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* preferred window */}
              <div className="rounded-lg border border-dashed border-line bg-paper-soft/40 p-3.5">
                <p className="text-[12px] font-bold">بازه‌ی دلخواه (اختیاری)</p>
                <p className="mt-0.5 text-[11px] leading-5 text-ink-faint">
                  روز و ساعتی که برایتان مناسب است — مدیریت سعی می‌کند جلسه را در همین بازه بگیرد
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-ink-soft">روز</label>
                    <JalaliDatePicker value={prefDay} onChange={(v) => setPrefDay(v)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-ink-soft">از ساعت</label>
                    <TimePicker value={prefFrom} onChange={(v) => setPrefFrom(v)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-ink-soft">تا ساعت</label>
                    <TimePicker value={prefTo} onChange={(v) => setPrefTo(v)} />
                  </div>
                </div>
              </div>

              {/* head-count stepper */}
              <div className="flex items-center justify-between rounded-lg border border-line bg-paper-soft/60 px-4 py-3">
                <div>
                  <p className="text-[12px] font-medium">تعداد حاضران (غیر از خودتان)</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">برای انتخاب اتاق مناسب</p>
                </div>
                <div className="flex items-center gap-2" dir="ltr">
                  <StepperBtn disabled={attendeeCount <= 1} onClick={() => setAttendeeCount((n) => Math.max(1, n - 1))} label="کاهش">
                    <span className="block h-[1.5px] w-3 bg-current" />
                  </StepperBtn>
                  <motion.span
                    key={attendeeCount}
                    initial={{ scale: 0.7, opacity: 0.4 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="w-10 text-center text-[15px] font-bold"
                  >
                    {fa(attendeeCount)}
                  </motion.span>
                  <StepperBtn disabled={attendeeCount >= 50} onClick={() => setAttendeeCount((n) => Math.min(50, n + 1))} label="افزایش">
                    <Plus className="h-3.5 w-3.5" />
                  </StepperBtn>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">فوریت</label>
                  <GuestSelect
                    value={urgency}
                    onChange={setUrgency}
                    options={Object.entries(URGENCY_FA).map(([v, l]) => ({ v, l }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">مدت تقریبی</label>
                  <GuestSelect value={durationMin} onChange={setDurationMin} options={DURATIONS} />
                </div>
              </div>
              </FormSection>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-md bg-red-50 p-2.5 text-[12px] text-red-700"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={submit}
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-[13.5px] font-bold text-white shadow-[0_10px_25px_-10px_rgba(13,13,13,0.5)] transition-colors hover:bg-[#2a2a2e] disabled:opacity-60"
              >
                <ArrowLeft className="h-4 w-4" />
                {busy ? "در حال ثبت…" : "ثبت درخواست"}
              </motion.button>
            </div>
          </div>
        )}

        <p className="mt-5 text-center text-[11px] text-ink-faint">
          کارمند سازمان هستید؟{" "}
          <a href="/login" className="font-medium text-ink underline underline-offset-4">
            وارد شوید
          </a>
        </p>
        </div>
      </div>
    </div>
  );
}

/** numbered section header — groups the form into professional steps */
function FormSection({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line/80 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2.5 border-b border-line/70 pb-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink text-[12px] font-bold text-white">{fa(n)}</span>
        <div>
          <p className="text-[13px] font-bold leading-5">{title}</p>
          {hint && <p className="mt-0.5 text-[10.5px] text-ink-faint">{hint}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/* ---------- helpers ---------- */

/** "2026-09-20" + "14:30" (Tehran, +03:30) → ISO UTC */
function tehranToIso(day: string, hm: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - 3, mm - 30, 0)).toISOString();
}

function fa(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function StepperBtn({ disabled, onClick, label, children }: { disabled?: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-ink-soft transition hover:bg-paper-soft hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** custom dropdown (no native <select>) — same visual language as the app Select */
function GuestSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const label = options.find((o) => o.v === value)?.l ?? "";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between rounded-md border border-[#d9d9e0] bg-white px-3.5 text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15"
      >
        <span>{label}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown className="h-4 w-4 text-ink-faint" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 0.8, 0.36, 1] }}
            className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-md border border-line bg-white p-1 shadow-lg"
          >
            {options.map((o) => (
              <li key={o.v}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.v);
                    setOpen(false);
                  }}
                  className={
                    "flex w-full items-center justify-between rounded px-3 py-2 text-right text-[13px] transition-colors " +
                    (o.v === value ? "bg-paper-soft font-medium text-ink" : "text-ink-soft hover:bg-paper-soft hover:text-ink")
                  }
                >
                  {o.l}
                  {o.v === value && <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/** pick WHO you want to meet — searches the PUBLIC directory (name/jobTitle only) */
function PublicPeoplePicker({ value, onChange }: { value: PubPerson[]; onChange: (p: PubPerson[]) => void }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<PubPerson[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open || debounced.length < 2) {
      setResults([]);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/public/people?q=${encodeURIComponent(debounced)}`)
      .then((r) => r.json())
      .then((j) => {
        if (alive) setResults(j?.data?.people ?? []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [debounced, open]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (p: PubPerson) => {
    if (value.some((x) => x.id === p.id)) onChange(value.filter((x) => x.id !== p.id));
    else if (value.length < 15) onChange([...value, p]);
  };

  return (
    <div ref={ref} className="relative">
      <label className="mb-1.5 block text-[12px] font-medium">با چه کسانی می‌خواهید جلسه داشته باشید؟ (اختیاری)</label>
      <div
        className={
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border bg-white p-2 text-[13px] outline-none transition focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/15 " +
          (open ? "border-ink" : "border-[#d9d9e0]")
        }
        onClick={() => setOpen(true)}
      >
        {value.map((p) => (
          <motion.span
            key={p.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 rounded bg-paper-soft px-2 py-1 text-[11px] text-ink"
          >
            {p.name}
            {p.jobTitle ? <span className="text-ink-faint">— {p.jobTitle}</span> : null}
            <button type="button" aria-label={`حذف ${p.name}`} onClick={() => toggle(p)} className="text-ink-faint hover:text-red-600">
              <X className="h-3 w-3" />
            </button>
          </motion.span>
        ))}
        <div className="flex flex-1 items-center gap-2 px-1">
          <Search className="h-3.5 w-3.5 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            placeholder="جستجوی نام، سمت یا سازمان…"
            className="h-8 min-w-24 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
          />
        </div>
      </div>
      <AnimatePresence>
        {open && debounced.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="absolute z-20 mt-1.5 max-h-56 w-full overflow-auto rounded-md border border-line bg-white p-1 shadow-lg"
          >
            {loading && <p className="px-3 py-2 text-[12px] text-ink-faint">در حال جستجو…</p>}
            {!loading && results.length === 0 && (
              <p className="px-3 py-2 text-[12px] text-ink-faint">کسی با این مشخصات پیدا نشد — می‌توانید در توضیحات بنویسید</p>
            )}
            {!loading &&
              results.map((p) => {
                const picked = value.some((x) => x.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p)}
                    className={
                      "flex w-full items-center gap-2.5 rounded px-3 py-2 text-right transition-colors " +
                      (picked ? "bg-paper-soft" : "hover:bg-paper-soft")
                    }
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-soft text-ink-soft">
                      <UserRound className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-ink">{p.name}</span>
                      {(p.jobTitle || p.company) && (
                        <span className="block truncate text-[10.5px] text-ink-faint">
                          {[p.jobTitle, p.company].filter(Boolean).join(" — ")}
                        </span>
                      )}
                    </span>
                    {picked && <CheckCircle2 className="h-3.5 w-3.5 text-ink" />}
                  </button>
                );
              })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
