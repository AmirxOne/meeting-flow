"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Plus, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Card, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { cn, faNum, faStr, faPad2, formatJalali, toJalali, jMonthLen } from "@/lib";
import { jMonthGrid, J_MONTHS, J_WEEKDAYS_SHORT, toGregorian } from "@/lib/jalali";

interface CalMeeting {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  meetingType: string;
  isPrivate?: boolean;
  isMasked?: boolean;
  organizer: { fullName: string };
  room: { id: string; name: string } | null;
  _count: { participants: number };
}

type ViewMode = "month" | "week" | "day";
type CalMode = "jalali" | "gregorian";

const tehran = (iso: string) => new Date(new Date(iso).getTime() + 210 * 60000);
const timeOf = (iso: string) => {
  const t = tehran(iso);
  return faStr(`${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`);
};
const isoOfLocalDay = (d: Date) => {
  const t = new Date(d.getTime() + 210 * 60000);
  return t.toISOString().slice(0, 10);
};
const todayIso = () => isoOfLocalDay(new Date());

function isoOfJalali(jy: number, jm: number, jd: number): string {
  const g = toGregorian(jy, jm, jd);
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
}

function jalaliOfIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return toJalali(new Date(y, m - 1, d));
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function firstDayOfWeekIso(iso: string): string {
  // Iranian week starts Saturday
  const d = new Date(iso + "T12:00:00Z");
  const shift = (d.getUTCDay() + 1) % 7; // Sat=0
  return addDaysIso(iso, -shift);
}

const WEEKDAY_LONG = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

export default function CalendarPage() {
  const [mode, setMode] = useState<CalMode>("jalali");
  const [view, setView] = useState<ViewMode>("month");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const today = todayIso();
  const [selectedIso, setSelectedIso] = useState(today);
  // month navigation state (jalali anchor)
  const todayJ = toJalali(new Date());
  const [anchor, setAnchor] = useState({ jy: todayJ.jy, jm: todayJ.jm });

  // ── data window: month ± 1 week ──
  const window = useMemo(() => {
    const first = isoOfJalali(anchor.jy, anchor.jm, 1);
    return {
      from: new Date(new Date(first).getTime() - 7 * 86400000),
      to: new Date(new Date(first).getTime() + (jMonthLen(anchor.jy, anchor.jm) + 10) * 86400000),
    };
  }, [anchor]);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", window.from.toISOString(), window.to.toISOString(), scope],
    queryFn: () =>
      api<{ meetings: CalMeeting[]; occupancy: { date: string; count: number; occupancyPct: number }[]; seeAll: boolean }>(
        `/api/calendar?from=${window.from.toISOString()}&to=${window.to.toISOString()}&scope=${scope}`,
      ),
  });

  const meetings = data?.meetings ?? [];
  const occupancyMap = new Map((data?.occupancy ?? []).map((o) => [o.date, o]));

  const byDate = useMemo(() => {
    const map = new Map<string, CalMeeting[]>();
    for (const m of meetings) {
      const key = isoOfLocalDay(new Date(m.startAt));
      (map.get(key) ?? map.set(key, []).get(key)!).push(m);
    }
    for (const list of map.values()) list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return map;
  }, [meetings]);

  const monthGrid = useMemo(() => jMonthGrid(anchor.jy, anchor.jm), [anchor]);

  // week strip (7 days starting at week of selected day)
  const weekDays = useMemo(() => {
    const start = firstDayOfWeekIso(selectedIso);
    return Array.from({ length: 7 }, (_, i) => addDaysIso(start, i));
  }, [selectedIso]);

  function monthDelta(delta: number) {
    let { jy, jm } = anchor;
    jm += delta;
    if (jm > 12) { jm = 1; jy += 1; }
    if (jm < 1) { jm = 12; jy -= 1; }
    setAnchor({ jy, jm });
  }

  const monthTitle =
    mode === "jalali"
      ? `${J_MONTHS[anchor.jm - 1]} ${faNum(anchor.jy)}`
      : gregorianMonthLabel(anchor.jy, anchor.jm);

  const dayLabel = (iso: string) => {
    const d = new Date(iso + "T12:00:00Z");
    if (mode === "jalali") return formatJalali(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), { monthName: true });
    return new Intl.DateTimeFormat("fa-IR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
  };

  // ── swipe support (mobile) ──
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 50) {
        // RTL: swipe right = next, swipe left = previous
        if (dx > 0) {
          if (view === "month") monthDelta(1);
          else if (view === "week") setSelectedIso((s) => addDaysIso(s, 7));
          else setSelectedIso((s) => addDaysIso(s, 1));
        } else {
          if (view === "month") monthDelta(-1);
          else if (view === "week") setSelectedIso((s) => addDaysIso(s, -7));
          else setSelectedIso((s) => addDaysIso(s, -1));
        }
      }
      touchStart.current = null;
    },
    [view],
  );

  const selectedDayMeetings = byDate.get(selectedIso) ?? [];

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* ── header: month title + nav + today ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button onClick={() => { if (view === "month") monthDelta(-1); else if (view === "week") setSelectedIso((s) => addDaysIso(s, -7)); else setSelectedIso((s) => addDaysIso(s, -1)); }} className="rounded-md border border-line bg-white p-1.5 hover:bg-paper-soft" aria-label="قبلی">
            <ChevronRight className="h-4 w-4" />
          </button>
          <h1 className="min-w-36 text-center text-[15px] font-bold sm:min-w-44">{view === "day" ? dayLabel(selectedIso) : monthTitle}</h1>
          <button onClick={() => { if (view === "month") monthDelta(1); else if (view === "week") setSelectedIso((s) => addDaysIso(s, 7)); else setSelectedIso((s) => addDaysIso(s, 1)); }} className="rounded-md border border-line bg-white p-1.5 hover:bg-paper-soft" aria-label="بعدی">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setSelectedIso(today); const tj = toJalali(new Date()); setAnchor({ jy: tj.jy, jm: tj.jm }); }}
            className="mr-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink-soft hover:bg-paper-soft"
          >
            امروز
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {data?.seeAll && (
            <div className="flex overflow-hidden rounded-md border border-line">
              {([["all", "شرکت"], ["mine", "من"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setScope(k)} className={cn("px-3 py-1.5 text-[12px]", scope === k ? "bg-ink text-white" : "text-ink-soft")}>{l}</button>
              ))}
            </div>
          )}
          <div data-tour="cal-views" className="flex overflow-hidden rounded-md border border-line">
            {([["month", "ماه"], ["week", "هفته"], ["day", "روز"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={cn("px-3 py-1.5 text-[12px]", view === k ? "bg-ink text-white" : "text-ink-soft")}>{l}</button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-md border border-line">
            {([["jalali", "شمسی"], ["gregorian", "میلادی"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} className={cn("px-3 py-1.5 text-[12px]", mode === k ? "bg-ink text-white" : "text-ink-soft")}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <SkeletonBlock className="h-[480px] sm:h-[560px]" />
      ) : view === "month" ? (
        <>
          {/* ── MONTH: compact grid — desktop shows event chips, mobile dots only (Google Calendar pattern) ── */}
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-line bg-paper-soft/50">
              {J_WEEKDAYS_SHORT.map((d) => (
                <div key={d} className="py-2 text-center text-[11px] font-medium text-ink-soft">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthGrid.map((cell, i) => {
                if (!cell) return <div key={i} className="h-14 border-b border-l border-line/40 bg-paper-soft/20 sm:h-20 sm:min-h-20 lg:h-24" />;
                const iso = isoOfJalali(cell.jy, cell.jm, cell.jd);
                const dayMeetings = byDate.get(iso) ?? [];
                const occ = occupancyMap.get(iso);
                const isToday = iso === today;
                const isSelected = iso === selectedIso;
                const isOtherMonth = cell.jm !== anchor.jm;
                return (
                  <button
                    key={i}
                    onClick={() => { setSelectedIso(iso); setView("day"); }}
                    className={cn(
                      "relative h-14 border-b border-l border-line/40 p-1 text-right align-top transition-colors hover:bg-paper-soft sm:h-20 sm:p-1.5 lg:h-24",
                      isSelected && "bg-paper-soft",
                      isOtherMonth && "opacity-40",
                    )}
                  >
                    <span className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] sm:h-6 sm:w-6",
                      isToday ? "bg-ink font-bold text-white" : "text-ink",
                    )}>
                      {mode === "jalali" ? faNum(cell.jd) : faNum(gregorianDayOf(iso))}
                    </span>

                    {/* desktop: event chips */}
                    <div className="mt-0.5 hidden space-y-0.5 sm:block">
                      {dayMeetings.slice(0, 2).map((m) => (
                        <div key={m.id} className={cn(
                          "truncate rounded px-1 py-0.5 text-[9px] leading-4",
                          m.status === "IN_PROGRESS" ? "bg-red-100 text-red-700"
                          : m.status === "CANCELLED" ? "bg-paper-deep text-ink-faint line-through"
                          : "bg-paper-deep text-ink",
                        )}>
                          {timeOf(m.startAt)} {m.isMasked ? "🔒 جلسه محرمانه" : m.title}
                        </div>
                      ))}
                      {dayMeetings.length > 2 && (
                        <div className="pr-1 text-[9px] text-ink-faint">+{faNum(dayMeetings.length - 2)} جلسه دیگر</div>
                      )}
                    </div>

                    {/* mobile: colored dots only (Google Calendar mobile) */}
                    <div className="absolute bottom-1.5 right-1.5 flex gap-0.5 sm:hidden">
                      {dayMeetings.slice(0, 3).map((m) => (
                        <span key={m.id} className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          m.status === "IN_PROGRESS" ? "bg-red-500"
                          : m.status === "CANCELLED" ? "bg-ink-faint"
                          : "bg-ink",
                        )} />
                      ))}
                      {dayMeetings.length > 3 && <span className="text-[8px] leading-none text-ink-faint">+</span>}
                    </div>

                    {occ && scope === "all" && dayMeetings.length === 0 && (
                      <div className="absolute bottom-1.5 left-1.5 hidden h-1 w-8 rounded bg-paper-deep sm:block">
                        <div className="h-1 rounded bg-ink" style={{ width: `${occ.occupancyPct}%` }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* mobile agenda under grid (Google Calendar pattern) */}
          <MobileAgenda selectedIso={selectedIso} meetings={selectedDayMeetings} onPickDay={setSelectedIso} monthGrid={monthGrid} byDate={byDate} todayIso={today} mode={mode} />
        </>
      ) : view === "week" ? (
        /* ── WEEK: 7 columns, hour slots — horizontal scroll on mobile ── */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* weekday header row */}
              <div className="grid border-b border-line" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
                <div />
                {weekDays.map((iso) => {
                  const j = jalaliOfIso(iso);
                  const isToday = iso === today;
                  const count = byDate.get(iso)?.length ?? 0;
                  return (
                    <button key={iso} onClick={() => { setSelectedIso(iso); setView("day"); }} className={cn("border-l border-line/40 py-2 text-center transition-colors hover:bg-paper-soft", isToday && "bg-paper-soft")}>
                      <p className="text-[10px] text-ink-soft">{WEEKDAY_LONG[(new Date(iso + "T12:00:00Z").getUTCDay() + 1) % 7]}</p>
                      <span className={cn("mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold", isToday ? "bg-ink text-white" : "text-ink")}>
                        {faNum(j.jd)}
                      </span>
                      {count > 0 && <p className="mt-0.5 text-[9px] text-ink-faint">{faNum(count)} جلسه</p>}
                    </button>
                  );
                })}
              </div>
              {/* hour grid */}
              <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
                <div>
                  {Array.from({ length: 13 }, (_, i) => 8 + i).map((h) => (
                    <div key={h} className="h-12 border-b border-line/30 pr-1.5 pt-0.5 text-left text-[9px] text-ink-faint">
                      {faPad2(h)}:۰۰
                    </div>
                  ))}
                </div>
                {weekDays.map((iso) => (
                  <div key={iso} className="relative border-l border-line/40">
                    {Array.from({ length: 13 }, (_, i) => (
                      <div key={i} className="h-12 border-b border-line/30" />
                    ))}
                    {(byDate.get(iso) ?? []).map((m) => {
                      const s = tehran(m.startAt);
                      const e = tehran(m.endAt);
                      const top = ((s.getUTCHours() * 60 + s.getUTCMinutes()) - 8 * 60) / 60 * 48;
                      const height = Math.max(20, ((e.getUTCHours() * 60 + e.getUTCMinutes()) - (s.getUTCHours() * 60 + s.getUTCMinutes())) / 60 * 48 - 2);
                      return (
                        <Link
                          key={m.id}
                          href={`/meetings/${m.id}`}
                          className={cn(
                            "absolute right-0.5 left-0.5 overflow-hidden rounded px-1.5 py-1 text-[10px] leading-tight transition-colors hover:opacity-90",
                            m.status === "IN_PROGRESS" ? "bg-red-500 text-white"
                            : m.status === "CANCELLED" ? "bg-paper-deep text-ink-faint line-through"
                            : "bg-ink text-white",
                          )}
                          style={{ top, height }}
                        >
                          <p className="truncate font-medium">{m.isMasked ? "🔒 جلسه محرمانه" : m.title}</p>
                          <p className="truncate opacity-80">{timeOf(m.startAt)}</p>
                          {m.room && <p className="truncate opacity-70">{m.room.name}</p>}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        /* ── DAY: timeline list (Google Calendar mobile style) ── */
        <Card>
          <div className="divide-y divide-line">
            {selectedDayMeetings.length === 0 && (
              <EmptyState title="جلسه‌ای در این روز نیست" description="روی هر روز در نمای ماه بزنید تا جزئیاتش را ببینید" />
            )}
            {selectedDayMeetings.map((m) => (
              <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-stretch gap-3 px-4 py-3.5 transition-colors hover:bg-paper-soft sm:px-5">
                {/* time column — fixed width like Google Calendar */}
                <div className="w-14 shrink-0 pt-0.5 text-left sm:w-20">
                  <p className="text-[12px] font-bold sm:text-[13px]">{timeOf(m.startAt)}</p>
                  <p className="mt-0.5 text-[10px] text-ink-faint">{timeOf(m.endAt)}</p>
                </div>
                {/* color bar */}
                <div className={cn("w-1 shrink-0 rounded-full", m.status === "IN_PROGRESS" ? "bg-red-500" : m.status === "CANCELLED" ? "bg-ink-faint" : "bg-ink")} />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[13px] font-medium", m.status === "CANCELLED" && "line-through opacity-60")}>{m.isMasked ? "🔒 جلسه محرمانه" : m.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                    {m.room ? `${m.room.name} · ` : ""}{m.organizer.fullName}
                  </p>
                  {m.status === "IN_PROGRESS" && (
                    <span className="badge badge-red mt-1.5">در حال برگزاری</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* FAB on mobile — Google Calendar style */}
      <Link
        href="/meetings/new"
        className="fixed bottom-24 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-lg transition-transform active:scale-95 lg:hidden"
        aria-label="جلسه جدید"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}

/** Mobile agenda list under month grid — shows selected day's meetings (Google Calendar mobile pattern). */
function MobileAgenda({
  selectedIso,
  meetings,
  onPickDay,
  monthGrid,
  byDate,
  todayIso,
  mode,
}: {
  selectedIso: string;
  meetings: CalMeeting[];
  onPickDay: (iso: string) => void;
  monthGrid: ({ jy: number; jm: number; jd: number } | null)[];
  byDate: Map<string, CalMeeting[]>;
  todayIso: string;
  mode: CalMode;
}) {
  const label = (() => {
    const j = jalaliOfIso(selectedIso);
    const weekday = WEEKDAY_LONG[(new Date(selectedIso + "T12:00:00Z").getUTCDay() + 1) % 7];
    return `${weekday} ${faNum(j.jd)} ${J_MONTHS[j.jm - 1]}${selectedIso === todayIso ? " · امروز" : ""}`;
  })();

  return (
    <Card className="lg:hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-[13px] font-bold">{label}</p>
        <span className={cn("badge", meetings.length ? "badge-gray" : "")}>
          {meetings.length ? `${faNum(meetings.length)} جلسه` : "خالی"}
        </span>
      </div>
      <div className="divide-y divide-line">
        {meetings.length === 0 && <p className="px-4 py-6 text-center text-[12px] text-ink-faint">جلسه‌ای در این روز نیست</p>}
        {meetings.map((m) => (
          <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-paper-soft">
            <div className="w-12 shrink-0 text-left">
              <p className="text-[11px] font-bold">{timeOf(m.startAt)}</p>
            </div>
            <div className={cn("h-8 w-1 shrink-0 rounded-full", m.status === "IN_PROGRESS" ? "bg-red-500" : m.status === "CANCELLED" ? "bg-ink-faint" : "bg-ink")} />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[12px] font-medium", m.status === "CANCELLED" && "line-through opacity-60")}>{m.isMasked ? "🔒 جلسه محرمانه" : m.title}</p>
              <p className="truncate text-[10px] text-ink-faint">{m.room?.name ?? m.organizer.fullName}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function gregorianDayOf(iso: string): number {
  return Number(iso.slice(8, 10));
}

function gregorianMonthLabel(jy: number, jm: number): string {
  const first = new Date(isoOfJalali(jy, jm, 1) + "T12:00:00Z");
  return new Intl.DateTimeFormat("fa-IR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
}
