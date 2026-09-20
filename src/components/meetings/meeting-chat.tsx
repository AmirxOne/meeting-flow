"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, faNum } from "@/lib";
import { formatJalali } from "@/lib/jalali";
import { UserAvatar } from "@/components/ui/user-avatar";

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

/* ── day separators (Jalali) ── */
function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function MeetingChat({ meetingId, currentUserId, canChat, initialMessages = [] }: Props) {
  const [messages, setMessages] = useState<MeetingMessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true); // polling healthy?
  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

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
      setLive(true);
    } catch {
      setLive(false);
    }
  }, [meetingId]);

  // live polling — keeps pre/post-meeting discussion in sync
  useEffect(() => {
    const t = setInterval(refresh, 7000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (atBottomRef.current) scrollToBottom(false);
  }, [messages.length, scrollToBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    atBottomRef.current = bottom;
    setShowJump(!bottom && el.scrollHeight > el.clientHeight + 120);
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
      atBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom());
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setSending(false);
    }
  };

  /* group consecutive messages by the same author (within 4 min) */
  const groups = useMemo(() => {
    const out: { key: string; day: string; author: MeetingMessageRow["user"]; mine: boolean; items: MeetingMessageRow[] }[] = [];
    let lastDay = "";
    for (const m of messages) {
      const d = dayKey(m.createdAt);
      const prev = out[out.length - 1];
      const sameGroup =
        prev &&
        prev.items[0].userId === m.userId &&
        new Date(m.createdAt).getTime() - new Date(prev.items[prev.items.length - 1].createdAt).getTime() < 4 * 60000;
      if (!sameGroup) {
        out.push({
          key: m.id,
          day: d !== lastDay ? d : "",
          author: m.user,
          mine: m.userId === currentUserId,
          items: [m],
        });
      } else {
        prev.items.push(m);
      }
      lastDay = d;
    }
    return out;
  }, [messages, currentUserId]);

  const lastAuthor = messages.length ? messages[messages.length - 1].user.fullName : null;
  const participants = useMemo(() => new Set(messages.map((m) => m.userId)).size, [messages]);

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* header */}
      <header className="flex items-center justify-between border-b border-line bg-gradient-to-l from-paper-soft/60 to-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="absolute -bottom-0.5 -left-0.5 size-2 rounded-full border-2 border-white bg-emerald-500" />
          </span>
          <div>
            <h2 className="text-[13px] font-bold text-ink">تبادل نظر</h2>
            <p className="text-[10.5px] text-ink-faint">
              {messages.length > 0
                ? `${faNum(participants)} نفر در گفتگو · ${faNum(messages.length)} پیام`
                : "بحث پیش و پس از جلسه"}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
            live ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600",
          )}
          title={live ? "همگام‌سازی زنده فعال است" : "اتصال قطع — تلاش مجدد…"}
        >
          <span className={cn("size-1.5 rounded-full", live ? "animate-pulse bg-emerald-500" : "bg-amber-500")} />
          {live ? "زنده" : "آفلاین"}
        </span>
      </header>

      {/* messages */}
      <div className="relative">
        <div
          ref={listRef}
          onScroll={onScroll}
          className="flex max-h-[26rem] min-h-44 flex-col gap-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.035)_1px,transparent_0)] [background-size:18px_18px] px-4 py-4"
        >
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-paper-soft text-ink-faint">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="text-[12px] font-medium text-ink-soft">
                {canChat ? "اولین پیام را شما بنویسید" : "هنوز گفتگویی شروع نشده"}
              </p>
              <p className="max-w-64 text-[10.5px] leading-5 text-ink-faint">
                {canChat
                  ? "هماهنگی پیش از جلسه، اشتراک اسناد و جمع‌بندی پس از آن — همه در همین گفتگو."
                  : "فقط برگزارکننده و شرکت‌کنندگان به گفتگو دسترسی دارند."}
              </p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {groups.map((g) => (
              <div key={g.key} className="flex flex-col gap-1">
                {g.day && (
                  <div className="my-2 flex items-center gap-3" dir="rtl">
                    <span className="h-px flex-1 bg-line" />
                    <span className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[10px] text-ink-faint">
                      {formatJalali(new Date(g.day + "T12:00:00Z"), { monthName: true })}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={cn("flex items-end gap-2", g.mine ? "flex-row-reverse" : "flex-row")}
                  dir="rtl"
                >
                  <UserAvatar name={g.author.fullName} src={g.author.avatarUrl} size="sm" variant={g.mine ? "ink" : "soft"} />
                  <div className={cn("flex max-w-[78%] flex-col gap-1", g.mine ? "items-end" : "items-start")}>
                    {!g.mine && (
                      <span className="px-1 text-[10.5px] font-medium text-ink-soft">
                        {g.author.fullName}
                        {g.author.jobTitle ? <span className="mr-1 font-normal text-ink-faint">· {g.author.jobTitle}</span> : null}
                      </span>
                    )}
                    {g.items.map((m, i) => {
                      const last = i === g.items.length - 1;
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "relative whitespace-pre-wrap break-words px-3.5 py-2 text-[13px] leading-6 shadow-[0_1px_1px_rgba(0,0,0,0.05)]",
                            g.mine
                              ? cn("bg-accent text-white", last ? "rounded-2xl rounded-tl-md" : "rounded-2xl rounded-l-md", i === 0 && "rounded-tr-md")
                              : cn("border border-line bg-white text-ink", last ? "rounded-2xl rounded-tl-md" : "rounded-2xl rounded-l-md", i === 0 && "rounded-tr-md"),
                          )}
                        >
                          {m.body}
                          {last && (
                            <span className={cn("mt-0.5 block text-left text-[9.5px] leading-3", g.mine ? "text-white/70" : "text-ink-faint")}>
                              {formatJalali(new Date(m.createdAt), { withTime: true })}
                              {g.mine && <span className="mr-1">✓✓</span>}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            ))}
          </AnimatePresence>
        </div>

        {/* jump to latest */}
        <AnimatePresence>
          {showJump && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              onClick={() => { atBottomRef.current = true; scrollToBottom(); }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-medium text-ink-soft shadow-md hover:bg-paper-soft"
              dir="rtl"
            >
              ↓ آخرین پیام{lastAuthor ? ` · ${lastAuthor.split(" ")[0]}` : ""}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* composer */}
      {canChat ? (
        <footer className="border-t border-line bg-paper-soft/40 px-4 py-3">
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-2 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-600" dir="rtl">
              {error}
            </motion.p>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm transition-colors focus-within:border-accent/60" dir="rtl">
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
              placeholder="پیام خود را بنویسید…"
              className="max-h-28 flex-1 resize-none bg-transparent px-2 py-1 text-[13px] text-ink outline-none placeholder:text-ink-faint"
              maxLength={2000}
            />
            <span className={cn("shrink-0 pb-1 text-[9.5px] tabular-nums", draft.length > 1800 ? "text-amber-600" : "text-ink-faint")}>
              {faNum(draft.length)}/۲۰۰۰
            </span>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition disabled:opacity-30"
              title="ارسال (Enter)"
              aria-label="ارسال پیام"
            >
              {sending ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <svg viewBox="0 0 24 24" className="size-4.5 -scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </motion.button>
          </div>
          <p className="mt-1.5 px-1 text-[9.5px] text-ink-faint" dir="rtl">
            Enter ارسال · Shift+Enter خط جدید
          </p>
        </footer>
      ) : (
        <footer className="border-t border-line bg-paper-soft/40 px-4 py-3 text-center text-[11px] text-ink-soft" dir="rtl">
          برای شرکت در گفتگو باید به این جلسه دعوت شده باشید.
        </footer>
      )}
    </section>
  );
}
