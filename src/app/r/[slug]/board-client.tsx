"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { cn, faNum, formatJalali } from "@/lib";

type Meeting = {
  id: string;
  title: string;
  isPrivate: boolean;
  startAt: string;
  endAt: string;
  status: string;
  organizer: string | null;
};

const faTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });

/** «۲۵ دقیقه» style remaining label */
function untilLabel(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${faNum(min)} دقیقه`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${faNum(h)} ساعت و ${faNum(m)} دقیقه` : `${faNum(h)} ساعت`;
}

/** Live room agenda — kiosk/QR landing. Polls every 30s, live clock every 10s. */
export function RoomBoardClient({
  room,
}: {
  room: { name: string; capacity: number; branch: string; org: string; slug: string };
}) {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [err, setErr] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/public/rooms/${room.slug}`, { cache: "no-store" });
        const j = await res.json();
        if (alive) {
          setMeetings(j?.data?.meetings ?? []);
          setErr(null);
          setPulse((p) => p + 1);
        }
      } catch {
        if (alive) setErr("ارتباط با سرور برقرار نشد");
      }
    };
    load();
    const poll = setInterval(load, 30_000);
    const tick = setInterval(() => setNow(new Date()), 10_000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [room.slug]);

  const active = useMemo(
    () =>
      (meetings ?? []).filter((m) => m.status !== "CANCELLED" && m.status !== "REJECTED"),
    [meetings],
  );
  const current = active.find((m) => new Date(m.startAt) <= now && now < new Date(m.endAt));
  const upcoming = active.filter((m) => new Date(m.startAt) > now);
  const next = upcoming[0] ?? null;

  const progress = current
    ? Math.min(
        100,
        Math.max(
          0,
          ((now.getTime() - new Date(current.startAt).getTime()) /
            (new Date(current.endAt).getTime() - new Date(current.startAt).getTime())) *
            100,
        ),
      )
    : 0;

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-ink text-white">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 size-[30rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-52 -right-32 size-[34rem] rounded-full bg-white/5 blur-3xl" />
        {current && (
          <div className="absolute top-1/3 left-1/2 size-[26rem] -translate-x-1/2 rounded-full bg-emerald-400/5 blur-3xl" />
        )}
      </div>

      <div className="relative mx-auto max-w-4xl p-5 pb-24 sm:p-10">
        {/* header */}
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[12px] text-white/45">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {room.org} · {room.branch}
            </p>
            <h1 className="mt-1.5 text-[34px] font-bold leading-tight tracking-tight sm:text-[40px]">
              {room.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-white/55">
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                ظرفیت {faNum(room.capacity)} نفر
              </span>
              <span className="text-white/25">|</span>
              <span className="tabular-nums">{formatJalali(now, { withTime: true })}</span>
              <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-emerald-300/90">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                زنده
              </span>
            </p>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-2xl">
            <QRCodeSVG value={`/r/${room.slug}`} size={88} level="M" />
          </div>
        </header>

        {/* NOW — hero status */}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            {meetings === null ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-6"
              >
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton mt-3 h-8 w-64 rounded" />
              </motion.div>
            ) : current ? (
              <motion.div
                key={`cur-${current.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-l from-emerald-400/15 to-emerald-400/5 p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-[12px] font-bold text-emerald-300">
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
                    </span>
                    در حال برگزاری
                  </p>
                  <p className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-medium text-emerald-200 tabular-nums">
                    {untilLabel(new Date(current.endAt).getTime() - now.getTime())} تا پایان
                  </p>
                </div>
                <p className="mt-3 text-[24px] font-bold leading-snug sm:text-[28px]">{current.title}</p>
                <p className="mt-1.5 text-[13px] text-white/60">
                  <span className="tabular-nums">{faTime(current.startAt)} تا {faTime(current.endAt)}</span>
                  {current.organizer ? ` · ${current.organizer}` : ""}
                </p>
                {/* live progress */}
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    key={`${current.id}-${Math.round(progress)}`}
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full bg-gradient-to-l from-emerald-300 to-emerald-500"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`free-${pulse}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-2xl border border-emerald-400/20 bg-gradient-to-l from-emerald-400/10 to-transparent p-6"
              >
                <p className="text-[12px] font-medium text-white/45">وضعیت فعلی</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
                  <p className="text-[26px] font-bold text-emerald-300">اتاق آزاد است</p>
                  {next && (
                    <p className="text-[13px] text-white/55">
                      تا <span className="font-medium text-white/80 tabular-nums">{faTime(next.startAt)}</span> —{" "}
                      {untilLabel(new Date(next.startAt).getTime() - now.getTime())} دیگر
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* day timeline strip */}
        {active.length > 0 && (
          <div className="mt-6">
            <p className="mb-2.5 text-[12px] font-medium text-white/45">برنامه‌ی امروز</p>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
              {active.map((m) => {
                const s = new Date(m.startAt);
                const e = new Date(m.endAt);
                const dayStart = new Date(s); dayStart.setHours(8, 0, 0, 0);
                const dayEnd = new Date(s); dayEnd.setHours(20, 0, 0, 0);
                const span = dayEnd.getTime() - dayStart.getTime() || 1;
                const left = Math.max(0, Math.min(100, ((s.getTime() - dayStart.getTime()) / span) * 100));
                const width = Math.max(2, Math.min(100 - left, ((e.getTime() - s.getTime()) / span) * 100));
                const isNow = current?.id === m.id;
                return (
                  <div key={m.id} className="relative h-full flex-1 rounded-full bg-white/5">
                    <div
                      className={cn(
                        "absolute top-0 h-full rounded-full",
                        isNow ? "bg-gradient-to-l from-emerald-300 to-emerald-500" : "bg-white/25",
                      )}
                      style={{ right: `${left}%`, width: `${width}%` }}
                      title={`${m.title} — ${faTime(m.startAt)}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[9.5px] text-white/25 tabular-nums">
              <span>۸</span><span>۱۱</span><span>۱۴</span><span>۱۷</span><span>۲۰</span>
            </div>
          </div>
        )}

        {/* upcoming list */}
        <div className="mt-7">
          <p className="mb-3 flex items-center justify-between text-[13px] font-medium text-white/70">
            <span>جلسات بعدی</span>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10.5px] text-white/50">
              {faNum(upcoming.length)} جلسه
            </span>
          </p>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center">
              <svg viewBox="0 0 24 24" className="size-7 text-white/20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
              </svg>
              <p className="text-[13px] text-white/45">برنامه‌ی دیگری برای امروز ثبت نشده است</p>
              <p className="text-[11px] text-white/30">اتاق تا پایان روز آزاد خواهد بود</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 8).map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[11px] font-bold text-white/50 tabular-nums group-hover:bg-white/10">
                      {faTime(m.startAt).slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium">{m.title}</p>
                      {m.organizer && (
                        <p className="mt-0.5 truncate text-[11px] text-white/40">{m.organizer}</p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="text-[14px] font-medium text-white/75 tabular-nums">{faTime(m.startAt)}</p>
                    <p className="text-[10px] text-white/35">
                      {untilLabel(new Date(m.startAt).getTime() - now.getTime())} دیگر
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {err && (
          <p className="mt-6 flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            {err}
          </p>
        )}
      </div>

      {/* sticky footer */}
      <footer className="fixed inset-x-0 bottom-0 border-t border-white/5 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3 sm:px-10">
          <p className="flex items-center gap-1.5 text-[11px] text-white/35">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400/70" />
            هر ۳۰ ثانیه به‌روزرسانی می‌شود · مهرسا
          </p>
          <p className="text-[11px] text-white/35">برای دسترسی همیشگی، کد را اسکن کنید</p>
        </div>
      </footer>
    </div>
  );
}
