"use client";

// Full messenger-style discussion page: conversations rail (right, RTL) +
// chat pane (left), like a real chat app.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn, faNum } from "@/lib";
import { formatJalali } from "@/lib/jalali";
import { UserAvatar } from "@/components/ui/user-avatar";

type Conv = {
  id: string;
  title: string;
  startAt: string;
  status: string;
  meetingType: string;
  organizer: { id: string; fullName: string; avatarUrl: string | null };
  room: { name: string } | null;
  branch: { name: string } | null;
  _count: { messages: number };
  messages: { body: string; createdAt: string; userId: string }[];
};

type Msg = {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
  user: { id: string; fullName: string; avatarUrl: string | null; jobTitle: string | null };
};

type Selected = {
  id: string;
  title: string;
  startAt: string;
  status: string;
  organizerId: string;
  branch: { name: string } | null;
  room: { name: string } | null;
  participants: { userId: string; user: { id: string; fullName: string; avatarUrl: string | null; jobTitle: string | null } }[];
};

const STATUS_FA: Record<string, string> = {
  PENDING_APPROVAL: "در انتظار تأیید",
  APPROVED: "تأییدشده",
  CONFIRMED: "قطعی",
  RESCHEDULED: "جابه‌جا شده",
  IN_PROGRESS: "در حال برگزاری",
  COMPLETED: "برگزارشده",
};

export function DiscussionClient({
  userId,
  meetings,
  selectedId,
  selected,
  selectedMessages,
  canChat,
}: {
  userId: string;
  meetings: Conv[];
  selectedId: string | null;
  selected: Selected | null;
  selectedMessages: Msg[];
  canChat: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<Msg[]>(selectedMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => setMessages(selectedMessages), [selectedId, selectedMessages]);

  /* live polling for the open room */
  const refresh = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/meetings/${selectedId}/messages`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      const next: Msg[] = j?.data?.messages ?? [];
      setMessages((prev) =>
        prev.length === next.length && prev[prev.length - 1]?.id === next[next.length - 1]?.id ? prev : next,
      );
      setLive(true);
    } catch {
      setLive(false);
    }
  };
  useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [selectedId]);

  const scrollToBottom = (smooth = true) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };
  useEffect(() => {
    if (atBottomRef.current) scrollToBottom(false);
  }, [messages.length]);
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    atBottomRef.current = bottom;
    setShowJump(!bottom && el.scrollHeight > el.clientHeight + 120);
  };

  const uploadFile = async (file: File) => {
    if (!selectedId) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/meetings/${selectedId}/attachments`, { method: "POST", body: fd });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error?.message ?? "بارگذاری فایل ناموفق بود");
        return;
      }
      // announce the file in the chat
      const name = j?.data?.attachment?.originalName ?? file.name;
      await fetch(`/api/meetings/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: `📎 «${name}» به پیوست‌های جلسه اضافه شد` }),
      }).catch(() => {});
      await refresh();
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || !selectedId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error?.message ?? "ارسال پیام ناموفق بود");
        return;
      }
      setMessages((prev) => [...prev, j.data.message]);
      setDraft("");
      atBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom());
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setSending(false);
    }
  };

  /* group consecutive messages */
  const groups = useMemo(() => {
    const out: { key: string; day: string; author: Msg["user"]; mine: boolean; items: Msg[] }[] = [];
    let lastDay = "";
    for (const m of messages) {
      const d = new Date(m.createdAt).toISOString().slice(0, 10);
      const prev = out[out.length - 1];
      const same =
        prev &&
        prev.items[0].userId === m.userId &&
        new Date(m.createdAt).getTime() - new Date(prev.items[prev.items.length - 1].createdAt).getTime() < 4 * 60000;
      if (!same) out.push({ key: m.id, day: d !== lastDay ? d : "", author: m.user, mine: m.userId === userId, items: [m] });
      else prev.items.push(m);
      lastDay = d;
    }
    return out;
  }, [messages, userId]);

  const convs = useMemo(() => {
    const needle = q.trim();
    return meetings.filter((m) => !needle || m.title.includes(needle));
  }, [meetings, q]);

  const people = useMemo(() => {
    if (!selected) return [];
    const map = new Map<string, { fullName: string; avatarUrl: string | null; jobTitle: string | null; role: string }>();
    for (const p of selected.participants) {
      map.set(p.user.id, { ...p.user, role: "مشارکت‌کننده" });
    }
    return [...map.values()];
  }, [selected]);

  return (
    <div className="flex h-[calc(100dvh-3.75rem)] gap-0 overflow-hidden p-0 lg:p-0" dir="rtl">
      {/* ── conversations rail ── */}
      <aside className="flex w-full max-w-sm shrink-0 flex-col border-l border-line bg-white md:w-80 lg:w-[22rem]">
        <div className="border-b border-line bg-gradient-to-l from-paper-soft/50 to-white px-4 py-3.5">
          <h1 className="flex items-center gap-2 text-[15px] font-bold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            تبادل نظر
          </h1>
          <div className="mt-2.5 flex h-9 items-center gap-2 rounded-lg bg-paper-soft px-3">
            <svg viewBox="0 0 24 24" className="size-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی جلسه…"
              className="w-full bg-transparent text-[12px] outline-none placeholder:text-ink-faint"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {convs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <p className="text-[12px] font-medium text-ink-soft">جلسه‌ای پیدا نشد</p>
              <p className="text-[10.5px] leading-5 text-ink-faint">گفتگو همیشه روی یک جلسه است — اول جلسه بساز.</p>
              <Link href="/meeting-requests" className="mt-1 rounded-lg bg-accent px-3.5 py-1.5 text-[11px] font-medium text-white">درخواست جلسه</Link>
            </div>
          ) : (
            convs.map((c) => {
              const active = c.id === selectedId;
              const last = c.messages[0];
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/discussion?m=${c.id}`)}
                  className={cn(
                    "group flex w-full items-start gap-3 border-b border-line/70 px-4 py-3 text-right transition-colors",
                    active ? "bg-accent/5 shadow-[inset_3px_0_0_0_var(--accent)]" : "hover:bg-paper-soft/70",
                  )}
                >
                  <div className="relative shrink-0">
                    <span className={cn(
                      "flex size-11 items-center justify-center rounded-2xl text-[14px] font-bold shadow-sm transition-transform group-hover:scale-105",
                      active ? "bg-gradient-to-br from-accent to-accent/80 text-white" : "bg-gradient-to-br from-paper-soft to-paper-deep text-ink-soft",
                    )}>
                      {c.title.trim().slice(0, 1)}
                    </span>
                    {c._count.messages > 0 && (
                      <span className="absolute -top-1.5 -left-1.5 flex min-w-4.5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                        {faNum(c._count.messages)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn("truncate text-[12.5px]", active ? "font-bold" : "font-medium")}>{c.title}</p>
                      <span className="shrink-0 text-[9.5px] text-ink-faint">{formatJalali(new Date(c.startAt)).slice(5)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-ink-faint">
                      {last ? last.body : STATUS_FA[c.status] ?? c.status}
                    </p>
                    <p className="mt-0.5 text-[9.5px] text-ink-faint/70">
                      {c.branch?.name ?? "بیرون"}{c.room ? ` · ${c.room.name}` : ""}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── chat pane ── */}
      <main className="relative hidden min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.03)_1px,transparent_0)] [background-size:20px_20px] md:flex">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-white text-ink-faint shadow-sm">
              <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-[14px] font-bold text-ink-soft">یک گفتگو را انتخاب کنید</p>
            <p className="max-w-72 text-[11.5px] leading-6 text-ink-faint">
              از فهرست سمت راست جلسه‌ای را انتخاب کن تا گفتگوی همان جلسه باز شود — هر گفتگو به یک جلسه‌ی مشخص گره خورده است.
            </p>
          </div>
        ) : (
          <>
            {/* room header */}
            <header className="z-10 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[13.5px] font-bold">«{selected.title}»</h2>
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-medium",
                    selected.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600"
                      : selected.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-600"
                      : selected.status === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-600"
                      : "border border-line bg-white text-ink-soft",
                  )}>
                    {STATUS_FA[selected.status] ?? selected.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10.5px] text-ink-faint">
                  {formatJalali(new Date(selected.startAt), { monthName: true, withTime: true })}
                  {selected.branch ? ` · ${selected.branch.name}` : ""}{selected.room ? ` · ${selected.room.name}` : ""}
                  {" · "}
                  <button onClick={() => setShowPeople((v) => !v)} className="font-medium text-accent underline decoration-dotted underline-offset-2">
                    {faNum(people.length)} نفر
                  </button>
                </p>
              </div>
              <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-medium", live ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                <span className={cn("size-1.5 rounded-full", live ? "animate-pulse bg-emerald-500" : "bg-amber-500")} />
                {live ? "زنده" : "آفلاین"}
              </span>
              <Link href={`/meetings/${selected.id}`} className="shrink-0 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[10.5px] font-medium text-ink-soft hover:bg-paper-soft">
                صفحه‌ی جلسه ↗
              </Link>
            </header>

            {/* people drawer */}
            <AnimatePresence>
              {showPeople && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="z-10 overflow-hidden border-b border-line bg-paper-soft/50"
                >
                  <div className="flex flex-wrap gap-2 px-4 py-2.5">
                    {people.map((p) => (
                      <span key={p.fullName} className="flex items-center gap-1.5 rounded-full border border-line bg-white py-1 pl-3 pr-1.5 text-[11px]">
                        <UserAvatar name={p.fullName} src={p.avatarUrl} size="sm" variant="soft" />
                        {p.fullName}
                        {p.jobTitle && <span className="text-ink-faint">· {p.jobTitle}</span>}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* messages */}
            <div className="relative min-h-0 flex-1">
              <div ref={listRef} onScroll={onScroll} className="h-full overflow-y-auto px-4 py-4 md:px-8">
                {messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                    <p className="text-[12.5px] font-medium text-ink-soft">
                      {canChat ? "اولین پیام گفتگوی این جلسه را بنویسید" : "هنوز گفتگویی شروع نشده"}
                    </p>
                    <p className="max-w-72 text-[10.5px] leading-5 text-ink-faint">هماهنگی پیش از جلسه و جمع‌بندی پس از آن، همه این‌جا.</p>
                  </div>
                )}
                <div className="mx-auto flex max-w-3xl flex-col gap-1">
                  <AnimatePresence initial={false}>
                    {groups.map((g) => (
                      <div key={g.key} className="flex flex-col gap-1">
                        {g.day && (
                          <div className="my-2.5 flex items-center gap-3">
                            <span className="h-px flex-1 bg-line/70" />
                            <span className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[9.5px] text-ink-faint">
                              {formatJalali(new Date(g.day + "T12:00:00Z"), { monthName: true })}
                            </span>
                            <span className="h-px flex-1 bg-line/70" />
                          </div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18 }}
                          className={cn("flex items-end gap-2.5", g.mine ? "justify-start flex-row" : "justify-end flex-row")}
                        >
                          <UserAvatar name={g.author.fullName} src={g.author.avatarUrl} size="sm" variant={g.mine ? "ink" : "soft"} />
                          <div className={cn("flex max-w-[75%] flex-col gap-1", g.mine ? "items-start" : "items-end")}>
                            {!g.mine && (
                              <span className="px-1 text-[10.5px] font-bold text-ink/80">
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
                                    "whitespace-pre-wrap break-words px-3.5 py-2 text-[13px] leading-6 shadow-[0_1px_1px_rgba(0,0,0,0.05)]",
                                    g.mine
                                      ? cn("bg-ink text-white shadow-[0_2px_6px_rgba(13,13,13,0.22)]", last ? "rounded-2xl rounded-tr-md" : "rounded-2xl rounded-r-md", i === 0 && "rounded-tl-md")
                                      : cn("border border-line bg-paper-soft text-ink", last ? "rounded-2xl rounded-tl-md" : "rounded-2xl rounded-l-md", i === 0 && "rounded-tr-md"),
                                  )}
                                >
                                  {m.body.startsWith("📎") ? (
                                    <span className="block rounded-xl bg-ink/5 px-3 py-1.5 text-center text-[11.5px] font-medium text-ink-soft">{m.body}</span>
                                  ) : (
                                    m.body
                                  )}
                                  {last && (
                                    <span className={cn("mt-0.5 block text-left text-[9px] leading-3", g.mine ? "text-white/70" : "text-ink-faint")}>
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
              </div>

              <AnimatePresence>
                {showJump && (
                  <motion.button
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    onClick={() => { atBottomRef.current = true; scrollToBottom(); }}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-white px-3 py-1.5 text-[10.5px] font-medium text-ink-soft shadow-md hover:bg-paper-soft"
                  >
                    ↓ آخرین پیام
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* composer — Telegram-style floating bar */}
            {canChat ? (
              <footer className="relative border-t border-line bg-white/80 px-4 pb-4 pt-3 backdrop-blur-md md:px-8">
                <div className="mx-auto max-w-3xl">
                  {error && (
                    <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mb-2 flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-600">
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" /></svg>
                      {error}
                    </motion.p>
                  )}

                  {/* emoji panel */}
                  <AnimatePresence>
                    {showEmoji && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.96 }}
                        transition={{ type: "spring", duration: 0.25, bounce: 0.2 }}
                        className="absolute bottom-[5rem] left-4 z-30 w-[19.5rem] rounded-2xl border border-line bg-white/95 p-3 shadow-2xl backdrop-blur md:left-8"
                      >
                        <div className="mb-2 flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold text-ink-soft">ایموجی</span>
                          <button onClick={() => setShowEmoji(false)} className="flex size-5 items-center justify-center rounded-full text-ink-faint hover:bg-paper-soft" aria-label="بستن">✕</button>
                        </div>
                        <div className="grid max-h-52 grid-cols-7 gap-0.5 overflow-y-auto">
                          {["😀","😄","😂","🥲","😍","🥰","😎","🤔","🙂","🙃","😉","😅","😢","😡","🥳","😴","🤯","🫡","🤝","👍","👎","👏","🙌","💪","✌️","🤞","🙏","❤️","🧡","💙","💚","💜","💯","🔥","✨","⭐","🎉","🎊","📌","📎","✅","❌","⚠️","⏰","📅","💡","🎯","🚀","☕","🍕"].map((e) => (
                            <motion.button
                              key={e}
                              whileTap={{ scale: 0.8 }}
                              onClick={() => setDraft((d) => (d + " " + e).slice(0, 2000))}
                              className="flex size-9 items-center justify-center rounded-xl text-[21px] transition hover:bg-paper-soft"
                            >
                              {e}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-end gap-1 rounded-[1.6rem] border border-line/90 bg-paper-soft/50 p-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-all duration-200 focus-within:border-ink/30 focus-within:bg-white focus-within:shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadFile(f);
                        e.target.value = "";
                      }}
                    />
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-white hover:text-ink disabled:opacity-40"
                      title="بارگذاری فایل در پیوست‌های جلسه"
                      aria-label="بارگذاری فایل"
                    >
                      {uploading ? (
                        <span className="size-4 animate-spin rounded-full border-2 border-ink-faint/30 border-t-ink-faint" />
                      ) : (
                        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setShowEmoji((v) => !v)}
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white",
                        showEmoji ? "bg-white text-ink" : "text-ink-faint hover:text-ink",
                      )}
                      title="ایموجی"
                      aria-label="ایموجی"
                    >
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" strokeLinecap="round" />
                      </svg>
                    </motion.button>

                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      rows={Math.min(5, Math.max(1, draft.split("\n").length))}
                      placeholder="پیام…"
                      className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[13.5px] leading-6 text-ink outline-none placeholder:text-ink-faint/70"
                      maxLength={2000}
                    />

                    {draft.length > 0 && (
                      <span className={cn("shrink-0 self-center text-[9px] tabular-nums", draft.length > 1800 ? "text-amber-600" : "text-ink-faint")}>
                        {faNum(draft.length)}/۲۰۰۰
                      </span>
                    )}

                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      whileHover={draft.trim() ? { scale: 1.08 } : undefined}
                      onClick={() => void send()}
                      disabled={!draft.trim() || sending}
                      className={cn(
                        "ml-0.5 flex size-10 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                        draft.trim()
                          ? "bg-ink text-white shadow-[0_3px_10px_rgba(13,13,13,0.3)]"
                          : "bg-paper-deep/70 text-ink-faint/60",
                      )}
                      aria-label="ارسال پیام"
                      title="ارسال (Enter)"
                    >
                      {sending ? (
                        <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      ) : (
                        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
                          <path d="M3.4 20.4 20.85 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z" />
                        </svg>
                      )}
                    </motion.button>
                  </div>
                </div>
              </footer>
            ) : (
              <footer className="border-t border-line bg-white/80 py-4 text-center text-[11px] text-ink-soft backdrop-blur">
                برای شرکت در گفتگو باید به این جلسه دعوت شده باشید.
              </footer>
            )}
          </>
        )}
      </main>
    </div>
  );
}
