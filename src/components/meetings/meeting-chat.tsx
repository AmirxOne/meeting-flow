"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, faNum } from "@/lib";
import { formatJalali } from "@/lib/jalali";

export type MeetingMessageRow = {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
  user: { id: string; fullName: string; avatarUrl: string | null; jobTitle: string | null };
};

type Props = {
  meetingId: string;
  currentUserId: string;
  canChat: boolean;
  initialMessages?: MeetingMessageRow[];
};

export function MeetingChat({ meetingId, currentUserId, canChat, initialMessages = [] }: Props) {
  const [messages, setMessages] = useState<MeetingMessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef(true);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/messages`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const next: MeetingMessageRow[] = json?.data?.messages ?? [];
      setMessages((prev) => {
        if (prev.length === next.length && prev[prev.length - 1]?.id === next[next.length - 1]?.id) return prev;
        return next;
      });
    } catch {
      /* offline — next poll retries */
    }
  }, [meetingId]);

  // light polling so pre/post-meeting discussion stays live
  useEffect(() => {
    const t = setInterval(refresh, 7000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (bottomRef.current) scrollToBottom(false);
  }, [messages.length, scrollToBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    bottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "ارسال پیام ناموفق بود");
        return;
      }
      setMessages((prev) => [...prev, json.data.message]);
      setDraft("");
      requestAnimationFrame(() => scrollToBottom());
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-white">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-bold text-ink">💬 تبادل نظر</h2>
        <span className="text-[11px] text-ink-soft">
          {messages.length > 0 ? `${faNum(messages.length)} پیام` : "هنوز پیامی نیست"}
        </span>
      </header>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex max-h-80 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <p className="py-6 text-center text-xs text-ink-soft">
            {canChat
              ? "بحث قبل یا بعد از جلسه را همین‌جا شروع کنید…"
              : "فقط برگزارکننده و شرکت‌کنندگان به گفتگو دسترسی دارند."}
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const mine = m.userId === currentUserId;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex flex-col", mine ? "items-start" : "items-end")}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-soft">
                  <span className="font-medium">{mine ? "شما" : m.user.fullName}</span>
                  <span>·</span>
                  <span>{formatJalali(new Date(m.createdAt), { withTime: true })}</span>
                </div>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13px] leading-6",
                    mine
                      ? "rounded-bl-md bg-accent text-white"
                      : "rounded-br-md border border-line bg-paper-soft text-ink",
                  )}
                >
                  {m.body}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {canChat ? (
        <footer className="border-t border-line px-4 py-3">
          {error && <p className="mb-2 text-[11px] text-danger">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={Math.min(4, Math.max(1, draft.split("\n").length))}
              placeholder="پیام خود را بنویسید… (Enter برای ارسال، Shift+Enter خط جدید)"
              className="flex-1 resize-none rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
              maxLength={2000}
            />
            <button
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white transition disabled:opacity-40"
            >
              {sending ? "…" : "ارسال"}
            </button>
          </div>
        </footer>
      ) : (
        <footer className="border-t border-line px-4 py-3 text-center text-[11px] text-ink-soft">
          برای شرکت در گفتگو باید دعوت‌شده باشید.
        </footer>
      )}
    </section>
  );
}
