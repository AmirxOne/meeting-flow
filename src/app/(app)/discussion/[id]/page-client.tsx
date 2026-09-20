"use client";

// Standalone discussion room — same messenger quality as the hub pane,
// full-bleed layout: glassy room header + borderless chat surface.

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib";
import { MeetingChat, type MeetingMessageRow } from "@/components/meetings/meeting-chat";
import { ChevronLeft, ExternalLink } from "@/components/ui/icon";

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
    <div className="flex h-[calc(100dvh-3.75rem)] flex-col overflow-hidden" dir="rtl">
      {/* room header — one piece with the chat surface */}
      <header className="z-10 shrink-0 border-b border-line bg-white/85 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link
            href="/discussion"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink-soft transition hover:bg-paper-soft"
            aria-label="بازگشت به گفتگوها"
          >
            <ChevronLeft className="size-4.5" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[14.5px] font-bold">«{p.title}»</h1>
              <span className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-medium",
                p.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600"
                  : p.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-600"
                  : p.status === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-600"
                  : "border border-line bg-white text-ink-soft",
              )}>
                {STATUS_FA[p.status] ?? p.status}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10.5px] text-ink-faint">
              {p.place ? `${p.place} · ` : ""}
              <span className="text-ink-soft">
                {new Date(p.startAt).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </p>
          </div>

          <Link
            href={`/meetings/${p.meetingId}`}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[11px] font-medium text-ink-soft transition hover:bg-paper-soft"
          >
            صفحه‌ی جلسه
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* chat surface — full width, dotted paper backdrop, borderless card */}
      <div className="min-h-0 flex-1 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.03)_1px,transparent_0)] [background-size:20px_20px]">
        <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
          <MeetingChat
            meetingId={p.meetingId}
            currentUserId={p.currentUserId}
            canChat={p.canChat}
            initialMessages={p.initialMessages}
            bare
          />
        </div>
      </div>
    </div>
  );
}
