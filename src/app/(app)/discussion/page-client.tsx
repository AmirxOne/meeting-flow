"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn, faNum } from "@/lib";
import { formatJalali } from "@/lib/jalali";

type MeetingCard = {
  id: string;
  title: string;
  startAt: string;
  status: string;
  meetingType: string;
  organizer: { id: string; fullName: string };
  room: { name: string } | null;
  branch: { name: string } | null;
  _count: { messages: number; participants: number };
};

const STATUS_FA: Record<string, string> = {
  PENDING_APPROVAL: "در انتظار تأیید",
  APPROVED: "تأییدشده",
  CONFIRMED: "قطعی",
  RESCHEDULED: "جابه‌جا شده",
  IN_PROGRESS: "در حال برگزاری",
  COMPLETED: "برگزارشده",
};

export function DiscussionClient({ userId, meetings }: { userId: string; meetings: MeetingCard[] }) {
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim();
    return meetings.filter((m) => {
      if (onlyMine && m.organizer.id !== userId) return false;
      if (needle && !m.title.includes(needle)) return false;
      return true;
    });
  }, [meetings, q, onlyMine, userId]);

  const totalMsgs = meetings.reduce((a, b) => a + b._count.messages, 0);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            تبادل نظر
          </h1>
          <p className="mt-1 text-[12px] text-ink-soft">
            گفتگو همیشه متصل به یک جلسه‌ی مشخص است — جلسه را انتخاب کن تا درباره‌ی همان بحث کنید
            {totalMsgs > 0 && <span className="mr-1 text-ink-faint">({faNum(totalMsgs)} پیام در {faNum(meetings.length)} جلسه)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3">
            <svg viewBox="0 0 24 24" className="size-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی جلسه…"
              className="w-40 bg-transparent text-[12px] outline-none placeholder:text-ink-faint"
            />
          </div>
          <button
            onClick={() => setOnlyMine((v) => !v)}
            className={cn(
              "h-9 rounded-lg border px-3 text-[12px] font-medium transition",
              onlyMine ? "border-accent bg-accent text-white" : "border-line bg-white text-ink-soft hover:bg-paper-soft",
            )}
          >
            جلساتی که من ساخته‌ام
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-white py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-paper-soft text-ink-faint">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
          <p className="text-[13px] font-medium text-ink-soft">جلسه‌ای برای تبادل نظر نیست</p>
          <p className="max-w-80 text-[11px] leading-5 text-ink-faint">
            تبادل نظر فقط روی جلسه انجام می‌شود. اول جلسه را بساز (یا درخواستش را بفرست)، بعد همین‌جا گفتگو را شروع کن.
          </p>
          <Link href="/meeting-requests" className="mt-1 rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white">
            درخواست جلسه جدید
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link
                href={`/discussion/${m.id}`}
                className="block h-full rounded-xl border border-line bg-white p-4 transition hover:border-accent/50 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-[13.5px] font-bold leading-6">{m.title}</h3>
                  {m._count.messages > 0 && (
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                      {faNum(m._count.messages)}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  {formatJalali(new Date(m.startAt), { monthName: true, withTime: true })}
                  {m.branch ? ` · ${m.branch.name}` : ""}
                  {m.room ? ` · ${m.room.name}` : ""}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                  <span className="text-[10.5px] text-ink-soft">
                    برگزارکننده: {m.organizer.id === userId ? "شما" : m.organizer.fullName}
                  </span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    m.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600"
                      : m.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-600"
                      : m.status === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-600"
                      : "bg-paper-soft text-ink-soft",
                  )}>
                    {STATUS_FA[m.status] ?? m.status}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
