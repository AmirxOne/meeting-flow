"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, ChevronDown, Search, X, UserRound, Plus } from "@/components/ui/icon";

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
          isPrivate,
          durationMin: Number(durationMin),
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
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 0.8, 0.36, 1] }}
            className="rounded-xl border border-line bg-white p-8 text-center"
          >
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
                setPeople([]);
                setAttendeeCount(2);
              }}
              className="mt-5 h-10 rounded-md border border-line px-4 text-[12px] text-ink-soft hover:bg-paper-soft"
            >
              ثبت درخواست جدید
            </button>
          </motion.div>
        ) : (
          <div className="rounded-xl border border-line bg-white p-6 sm:p-8">
            <h1 className="text-[16px] font-bold">درخواست جلسه</h1>
            <p className="mt-1 text-[12px] text-ink-soft">نیاز خود را ثبت کنید — هماهنگی زمان با ما</p>

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

              <hr className="border-line" />

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
              <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-md border border-line bg-white px-3.5">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="h-4 w-4 accent-black" />
                <span className="text-[12px]">جلسه محرمانه — موضوع و جزئیات فقط برای من، دعوت‌شدگان و مدیریت دیده می‌شود</span>
              </label>

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
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink text-[13px] font-medium text-white transition-colors hover:bg-[#2a2a2e] disabled:opacity-60"
              >
                <ArrowLeft className="h-4 w-4" />
                {busy ? "در حال ثبت…" : "ثبت درخواست"}
              </motion.button>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-ink-faint">
          کارمند سازمان هستید؟{" "}
          <a href="/login" className="font-medium text-ink underline underline-offset-4">
            وارد شوید
          </a>
        </p>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

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
