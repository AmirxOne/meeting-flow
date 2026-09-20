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
    <div className="mx-auto max-w-4xl space-y-3 p-4 lg:p-6">
      <div className="flex items-center gap-2 text-[11px] text-ink-faint">
        <Link href="/discussion" className="rounded-md border border-line bg-white px-2 py-1 font-medium text-ink-soft hover:bg-paper-soft">
          → همه‌ی گفتگوها
        </Link>
        <span>گفتگوی جلسه</span>
      </div>

      {/* meeting context header — the discussion is ALWAYS anchored to this meeting */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-line bg-gradient-to-l from-paper-soft/70 to-white p-4"
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
      <div className="[&_section]:max-h-[calc(100dvh-19rem)] [&_section]:min-h-72">
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
