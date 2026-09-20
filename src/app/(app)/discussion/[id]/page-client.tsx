"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib";
import { MeetingChat, type MeetingMessageRow } from "@/components/meetings/meeting-chat";

const STATUS_FA: Record<string, string> = {
  PENDING_APPROVAL: "در انتظار تأیید",
  APPROVED: "تأییدشده",
  CONFIRMED: "قطعی",
  RESCHEDULED: "جابه‌جا شده",
  IN_PROGRESS: "در حال برگزاری",
  COMPLETED: "برگزارشده",
};

type Props = {
  meetingId: string;
  title: string;
  startAt: string;
  status: string;
  place: string;
  currentUserId: string;
  canChat: boolean;
  initialMessages?: MeetingMessageRow[];
};

export function DiscussionRoomClient(p: Props) {
  return (
    <div className="flex h-[calc(100dvh-3.75rem)] flex-col p-2 md:mx-auto md:max-w-4xl md:space-y-3 md:p-4 lg:p-6">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2 md:border-0 md:pb-0">
        <Link
          href="/discussion"
          className="flex size-10 items-center gap-1 rounded-full border border-line bg-white px-3 text-[12px] font-bold text-ink-soft hover:bg-paper-soft md:size-auto md:py-1"
          aria-label="بازگشت به گفتگوها"
        >
          <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden md:inline">همه‌ی گفتگوها</span>
        </Link>
        <span className="text-[10px] text-ink-faint md:hidden">گفتگوی جلسه</span>
      </div>

      {/* meeting context header — the discussion is ALWAYS anchored to this meeting */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="shrink-0 rounded-xl border border-line bg-gradient-to-l from-paper-soft/70 to-white p-3 md:p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold">«{p.title}»</h1>
            <p className="mt-1 text-[11px] text-ink-faint">
              {p.place ? `${p.place} · ` : ""}
              <span className="text-ink-soft">
                {new Date(p.startAt).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "rounded-full px-2.5 py-1 text-[10.5px] font-medium",
              p.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600"
                : p.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-600"
                : p.status === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-600"
                : "bg-white text-ink-soft border border-line",
            )}>
              {STATUS_FA[p.status] ?? p.status}
            </span>
            <Link
              href={`/meetings/${p.meetingId}`}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-[11px] font-medium text-ink-soft hover:bg-paper-soft"
            >
              صفحه‌ی جلسه ↗
            </Link>
          </div>
        </div>
      </motion.div>

      {/* full chat — stretched taller on the dedicated page */}
      <div className="flex min-h-0 flex-1 flex-col [&_section]:flex [&_section]:min-h-0 [&_section]:flex-1 [&_section]:max-h-none md:[&_section]:min-h-72">
        <MeetingChat
          meetingId={p.meetingId}
          currentUserId={p.currentUserId}
          canChat={p.canChat}
          initialMessages={p.initialMessages}
        />
      </div>
    </div>
  );
}
