"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Shield } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, faNum, faPad2, faStr, STATUS_FA } from "@/lib";
import {
  DAY_PERIOD_FA,
  HOUR_PREVIEW,
  busiestHour,
  dayHourRange,
  dayPeriod,
  groupByStartHour,
  hourDensity,
  type TimelineInterval,
} from "@/lib/calendar-timeline";

export type DayTimelineMeeting = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  isMasked?: boolean;
  organizer: { fullName: string };
  room: { id: string; name: string } | null;
  _count: { participants: number };
};

const tehran = (iso: string) => new Date(new Date(iso).getTime() + 210 * 60000);

function minutesOf(iso: string): number {
  const t = tehran(iso);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

function timeLabel(iso: string): string {
  const t = tehran(iso);
  return faStr(`${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`);
}

function durationLabel(startMin: number, endMin: number): string {
  const mins = Math.max(1, endMin - startMin);
  if (mins < 60) return `${faNum(mins)} دقیقه`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!m) return `${faNum(h)} ساعت`;
  return `${faNum(h)} ساعت و ${faNum(m)} دقیقه`;
}

function toInterval(m: DayTimelineMeeting): TimelineInterval {
  const startMin = minutesOf(m.startAt);
  let endMin = minutesOf(m.endAt);
  if (endMin <= startMin) endMin = startMin + 15;
  return { id: m.id, startMin, endMin: Math.min(24 * 60, endMin) };
}

function statusTone(status: string) {
  if (status === "IN_PROGRESS") return { rail: "bg-red-500", card: "border-red-200 bg-red-50/70", badge: "badge-red" };
  if (status === "CANCELLED" || status === "REJECTED" || status === "NO_SHOW") {
    return { rail: "bg-ink-faint", card: "border-line bg-paper-soft", badge: "badge-gray" };
  }
  if (status === "PENDING_APPROVAL") return { rail: "bg-amber-500", card: "border-amber-200 bg-amber-50/50", badge: "badge-amber" };
  if (status === "COMPLETED") return { rail: "bg-ink-faint", card: "border-line bg-white", badge: "badge-gray" };
  return { rail: "bg-ink", card: "border-line bg-white hover:border-ink/20 hover:bg-paper-soft/60", badge: "badge-gray" };
}

function densityLevel(count: number, max: number): { fill: string; pct: number } {
  if (count === 0) return { fill: "bg-transparent", pct: 0 };
  if (max <= 1) return { fill: "bg-ink", pct: 100 };
  const pct = Math.round((count / max) * 100);
  if (pct > 66) return { fill: "bg-ink", pct: Math.max(pct, 55) };
  if (pct > 33) return { fill: "bg-ink/70", pct: Math.max(pct, 35) };
  return { fill: "bg-ink/40", pct: Math.max(pct, 18) };
}

export function DayTimeline({
  meetings,
  selectedIso,
  todayIso,
  friday = false,
  onReschedule,
}: {
  meetings: DayTimelineMeeting[];
  selectedIso: string;
  todayIso: string;
  friday?: boolean;
  /** drag & drop: user dropped a meeting onto an hour slot of this day */
  onReschedule?: (meetingId: string, startHour: number) => void;
}) {
  const isToday = selectedIso === todayIso;
  const [now, setNow] = useState(() => new Date());
  const [dragId, setDragId] = useState<string | null>(null);
  const router = useRouter();
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [openHours, setOpenHours] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!isToday) return;
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [isToday]);

  useEffect(() => {
    setOpenHours(new Set());
  }, [selectedIso]);

  const nowMin = minutesOf(now.toISOString());
  const nowHour = Math.floor(nowMin / 60);
  const intervals = useMemo(() => meetings.map(toInterval), [meetings]);
  const byId = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);
  const intervalById = useMemo(() => new Map(intervals.map((x) => [x.id, x])), [intervals]);
  const groups = useMemo(() => groupByStartHour(intervals), [intervals]);
  const range = dayHourRange(intervals);
  const density = hourDensity(intervals, range.startHour, range.endHour);
  const peak = busiestHour(groups);
  const densMax = density.reduce((n, d) => Math.max(n, d.count), 0);

  function toggleHour(hour: number) {
    setOpenHours((prev) => {
      const next = new Set(prev);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  }

  function jumpToHour(hour: number) {
    setOpenHours((prev) => new Set(prev).add(hour));
    document.getElementById(`day-hour-${hour}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <Card className={cn("overflow-hidden", friday && "ring-1 ring-red-100")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <p className={cn("text-[13px] font-bold", friday && "text-red-600")}>
            {meetings.length ? `${faNum(meetings.length)} جلسه` : "روز خالی"}
          </p>
          {peak && peak.count > 1 && (
            <p className="mt-0.5 text-[11px] text-ink-faint">
              شلوغ‌ترین ساعت {faPad2(peak.hour)}:۰۰ · {faNum(peak.count)} جلسه
            </p>
          )}
        </div>
        {isToday && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            الان {timeLabel(now.toISOString())}
          </span>
        )}
      </div>

      <div data-tour="day-timeline" className={cn(friday && "bg-red-50/25")}>
        {/* نمودار تراکم ساعت‌ها — میله‌ها از یک پایه‌ی مشترک؛ قد = سهم از اوج روز */}
        <div className="border-b border-line bg-paper-soft/40 px-3 py-2.5 sm:px-4">
          <div className="mb-1.5 flex items-center justify-between px-0.5">
            <p className="text-[10.5px] font-medium text-ink-faint">تراکم ساعت‌ها</p>
            {peak && peak.count > 1 && (
              <p className="text-[10.5px] text-ink-faint">
                اوج: <span className="font-bold tabular-nums text-ink">{faPad2(peak.hour)}:۰۰</span> · {faNum(peak.count)} جلسه
              </p>
            )}
          </div>
          <div className="-my-1 flex items-end gap-1.5 overflow-x-auto px-1 py-1.5" role="img" aria-label="نمودار تراکم جلسات به تفکیک ساعت">
            {density.map((slot) => {
              const active = slot.count > 0;
              const level = densityLevel(slot.count, densMax);
              const isNow = isToday && slot.hour === nowHour;
              const isPeak = !!peak && slot.hour === peak.hour && peak.count > 1;
              return (
                <Tooltip key={slot.hour} content={active ? `ساعت ${faPad2(slot.hour)}:۰۰ — ${faNum(slot.count)} جلسه` : `ساعت ${faPad2(slot.hour)}:۰۰ — خالی`}>
                  <span className="inline-flex">
                    <button
                      type="button"
                      disabled={!active}
                      onClick={() => jumpToHour(slot.hour)}
                      className={cn(
                        "group flex w-9 shrink-0 flex-col items-center gap-1 rounded-md px-0.5 pb-1 pt-1.5 text-center transition-colors",
                        active ? "hover:bg-white hover:ring-1 hover:ring-line" : "cursor-default",
                        isNow && "bg-red-50/70 ring-1 ring-red-300",
                      )}
                    >
                      {/* میله روی تراک — پایه‌ی مشترک، پرشدگی درصدی */}
                      <span className="flex h-9 w-full items-end justify-center" aria-hidden="true">
                        <span className="relative flex h-full w-5 items-end justify-center overflow-hidden rounded-full bg-paper-deep/50">
                          <span
                            className={cn(
                              "w-full rounded-full transition-all",
                              level.fill,
                              active && "group-hover:bg-ink",
                              isNow && "bg-red-500",
                              isPeak && !isNow && "bg-ink",
                            )}
                            style={{ height: `${level.pct}%` }}
                          />
                          {isNow && <span className="absolute inset-x-0 top-0 h-full w-full animate-pulse rounded-full bg-red-500/10" />}
                        </span>
                      </span>
                      {/* ساعت + شمارنده */}
                      <span className={cn("text-[10px] font-medium tabular-nums leading-3", active ? "text-ink" : "text-ink-faint/70")}>
                        {faPad2(slot.hour)}
                      </span>
                      <span
                        className={cn(
                          "min-w-4 rounded-full px-1 text-[9px] font-bold leading-4 tabular-nums",
                          active ? "bg-ink/[0.08] text-ink" : "text-transparent",
                          isNow && "bg-red-100 text-red-700",
                        )}
                      >
                        {slot.count ? faNum(slot.count) : "·"}
                      </span>
                    </button>
                  </span>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-faint">جلسه‌ای در این روز ثبت نشده</p>
        ) : (
          <div className="px-3 py-4 sm:px-5">
            {groups.map((group, gi) => {
              const period = dayPeriod(group.hour);
              const prevPeriod = gi > 0 ? dayPeriod(groups[gi - 1].hour) : null;
              const showPeriod = period !== prevPeriod;
              const expanded = openHours.has(group.hour) || group.ids.length <= HOUR_PREVIEW;
              const visible = expanded ? group.ids : group.ids.slice(0, HOUR_PREVIEW);
              const hidden = group.ids.length - visible.length;
              const isNowHour = isToday && group.hour === nowHour;

              return (
                <div key={group.hour}>
                  {showPeriod && (
                    <p className="mb-3 mt-5 first:mt-0 text-[11px] font-medium text-ink-faint">{DAY_PERIOD_FA[period]}</p>
                  )}
                  <div
                    id={`day-hour-${group.hour}`}
                    className="flex gap-3"
                    onDragOver={(e) => {
                      if (!dragId || !onReschedule) return;
                      e.preventDefault();
                      setDragOverHour(group.hour);
                    }}
                    onDragLeave={() => setDragOverHour((h) => (h === group.hour ? null : h))}
                    onDrop={(e) => {
                      if (!onReschedule) return;
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain") || dragId;
                      setDragId(null);
                      setDragOverHour(null);
                      if (id) onReschedule(id, group.hour);
                    }}
                  >
                    <div
                      className={cn(
                        "flex w-12 shrink-0 flex-col items-center rounded-lg -mx-1 px-1 transition-colors",
                        dragOverHour === group.hour && "bg-paper-soft ring-2 ring-inset ring-ink",
                      )}
                    >
                      <span className={cn("text-[12px] font-bold tabular-nums", isNowHour ? "text-red-600" : "text-ink")}>
                        {faPad2(group.hour)}:۰۰
                      </span>
                      <span className={cn("mt-2 h-2 w-2 rounded-full", isNowHour ? "bg-red-500" : "bg-ink")} />
                      <span className="mt-1 w-px flex-1 bg-line" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2.5 pb-6">
                      {isNowHour && (
                        <p className="text-[11px] font-medium text-red-600">الان {timeLabel(now.toISOString())}</p>
                      )}
                      {visible.map((id) => {
                        const m = byId.get(id);
                        const interval = intervalById.get(id);
                        if (!m || !interval) return null;
                        const tone = statusTone(m.status);
                        const faded = m.status === "CANCELLED" || m.status === "REJECTED";
                        return (
                          <div
                            key={m.id}
                            data-mid={m.id}
                            role="link"
                            tabIndex={0}
                            onClick={() => router.push(`/meetings/${m.id}`)}
                            onKeyDown={(e) => { if (e.key === "Enter") router.push(`/meetings/${m.id}`); }}
                            draggable={onReschedule && !m.isMasked ? true : undefined}
                            onDragStart={(e) => {
                              setDragId(m.id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", m.id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setDragOverHour(null);
                            }}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors",
                              tone.card,
                              onReschedule && "cursor-grab active:cursor-grabbing",
                              dragId === m.id && "dragging opacity-40",
                            )}
                          >
                            <span className={cn("h-9 w-[3px] shrink-0 rounded-full", tone.rail)} />
                            <div className="w-16 shrink-0">
                              <p className="text-[12px] font-bold tabular-nums leading-4">{timeLabel(m.startAt)}</p>
                              <p className="text-[10px] tabular-nums text-ink-faint">{timeLabel(m.endAt)} · {durationLabel(interval.startMin, interval.endMin)}</p>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={cn("truncate text-[13px] font-medium leading-5", faded && "text-ink-faint line-through")}>
                                {m.isMasked ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Shield className="h-3.5 w-3.5" />
                                    جلسه محرمانه
                                  </span>
                                ) : (
                                  m.title
                                )}
                              </p>
                              <p className="truncate text-[11px] text-ink-soft">
                                {m.room?.name ?? "بدون اتاق"}
                                {m.organizer.fullName ? ` · ${m.organizer.fullName}` : ""}
                                {m._count.participants > 0 ? ` · ${faNum(m._count.participants)} نفر` : ""}
                              </p>
                            </div>
                            {STATUS_FA[m.status] && m.status !== "APPROVED" && m.status !== "CONFIRMED" && (
                              <span className={cn("badge shrink-0", tone.badge)}>{STATUS_FA[m.status]}</span>
                            )}
                          </div>
                        );
                      })}
                      {hidden > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleHour(group.hour)}
                          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-line py-2 text-[12px] text-ink-soft hover:bg-paper-soft hover:text-ink"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                          {faNum(hidden)} جلسه دیگر در این ساعت
                        </button>
                      )}
                      {expanded && group.ids.length > HOUR_PREVIEW && openHours.has(group.hour) && (
                        <button
                          type="button"
                          onClick={() => toggleHour(group.hour)}
                          className="w-full py-1 text-center text-[11px] text-ink-faint hover:text-ink"
                        >
                          بستن
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {onReschedule && (
          <div className="mt-4 rounded-lg border border-dashed border-line p-3">
            <p className="mb-2 text-[11px] font-medium text-ink-faint">انتقال به ساعت خالی — جلسه را روی ساعت دلخواه رها کنید</p>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-7 lg:grid-cols-13">
              {Array.from({ length: 13 }, (_, i) => 8 + i).map((h) => (
                <div
                  key={h}
                  data-empty-hour={h}
                  onDragOver={(e) => { if (!dragId) return; e.preventDefault(); setDragOverHour(h); }}
                  onDragLeave={() => setDragOverHour((x) => (x === h ? null : x))}
                  onDrop={(e) => {
                    if (!onReschedule) return;
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain") || dragId;
                    setDragId(null);
                    setDragOverHour(null);
                    if (id) onReschedule(id, h);
                  }}
                  className={cn(
                    "flex h-9 cursor-grab items-center justify-center rounded-md border text-[11.5px] font-medium tabular-nums transition-colors",
                    dragOverHour === h ? "border-ink bg-paper-soft ring-2 ring-inset ring-ink" : "border-line bg-white text-ink-soft hover:bg-paper-soft",
                  )}
                >
                  {faPad2(h)}:۰۰
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function DayTimelineSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="skeleton h-3.5 w-24" />
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="border-b border-line px-4 py-2.5">
        <div className="skeleton mb-1.5 h-2.5 w-24" />
        <div className="flex gap-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex w-9 flex-col items-center gap-1">
              <div className="skeleton h-9 w-5 rounded-full" />
              <div className="skeleton h-2.5 w-5" />
              <div className="skeleton h-2 w-3" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4 px-5 py-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="skeleton h-4 w-12" />
            <div className="skeleton h-16 flex-1 rounded-xl" />
          </div>
        ))}
      </div>
    </Card>
  );
}
