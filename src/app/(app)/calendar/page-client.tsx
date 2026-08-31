"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Plus, Shield } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, SkeletonBlock } from "@/components/ui/card";
import { DayTimeline, DayTimelineSkeleton } from "@/components/calendar/day-timeline";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { cn, faNum, faStr, faPad2, formatJalali, toJalali, jMonthLen } from "@/lib";
import { jMonthGrid, J_MONTHS, J_WEEKDAYS_LONG, toGregorian, isFridayIso } from "@/lib/jalali";
import { calendarEventTone, newMeetingHref } from "@/lib/calendar-event";
import { layoutDayBlocks, nowLineTop } from "@/lib/calendar-timeline";

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

const WEEK_START_HOUR = 8;
const WEEK_HOURS = 13;
const WEEK_PX = 48;
const WEEK_END_HOUR = WEEK_START_HOUR + WEEK_HOURS;

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
  const d = new Date(iso + "T12:00:00Z");
  const shift = (d.getUTCDay() + 1) % 7;
  return addDaysIso(iso, -shift);
}

function minutesOf(iso: string): number {
  const t = tehran(iso);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

const WEEKDAY_LONG = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

function EventLabel({ meeting, className }: { meeting: CalMeeting; className?: string }) {
  if (!meeting.isMasked) return <span className={className}>{meeting.title}</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <Shield className="h-3 w-3 shrink-0" />
      <span className="truncate">جلسه محرمانه</span>
    </span>
  );
}

export function CalendarPage() {
  const [mode, setMode] = useState<CalMode>("jalali");
  const [view, setView] = useState<ViewMode>("month");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const today = todayIso();
  const [selectedIso, setSelectedIso] = useState(today);
  const todayJ = toJalali(new Date());
  const [anchor, setAnchor] = useState({ jy: todayJ.jy, jm: todayJ.jm });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (view !== "week") return;
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [view]);

  const range = useMemo(() => {
    const first = isoOfJalali(anchor.jy, anchor.jm, 1);
    return {
      from: new Date(new Date(first).getTime() - 7 * 86400000),
      to: new Date(new Date(first).getTime() + (jMonthLen(anchor.jy, anchor.jm) + 10) * 86400000),
    };
  }, [anchor]);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", range.from.toISOString(), range.to.toISOString(), scope],
    queryFn: () =>
      api<{ meetings: CalMeeting[]; occupancy: { date: string; count: number; occupancyPct: number }[]; seeAll: boolean }>(
        `/api/calendar?from=${range.from.toISOString()}&to=${range.to.toISOString()}&scope=${scope}`,
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

  function jumpToIso(iso: string) {
    setSelectedIso(iso);
    const j = jalaliOfIso(iso);
    setAnchor({ jy: j.jy, jm: j.jm });
  }

  function goToday() {
    const tj = toJalali(new Date());
    setSelectedIso(today);
    setAnchor({ jy: tj.jy, jm: tj.jm });
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

  function stepNav(dir: -1 | 1) {
    if (view === "month") monthDelta(dir);
    else if (view === "week") setSelectedIso((s) => addDaysIso(s, dir * 7));
    else setSelectedIso((s) => addDaysIso(s, dir));
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => stepNav(-1)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-white p-0 hover:bg-paper-soft"
            aria-label="قبلی"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h1 className={cn("min-w-36 text-center text-[18px] font-bold sm:min-w-48", view === "day" && isFridayIso(selectedIso) && "text-red-600")}>
            {view === "day" ? dayLabel(selectedIso) : monthTitle}
          </h1>
          <button
            onClick={() => stepNav(1)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-white p-0 hover:bg-paper-soft"
            aria-label="بعدی"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <JalaliDatePicker variant="icon" value={selectedIso} onChange={jumpToIso} className="shrink-0" />
          <button
            onClick={goToday}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink-soft hover:bg-paper-soft"
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
        view === "month" ? (
          <CalendarMonthSkeleton monthGrid={monthGrid} />
        ) : view === "week" ? (
          <CalendarWeekSkeleton weekDays={weekDays} />
        ) : (
          <DayTimelineSkeleton />
        )
      ) : view === "month" ? (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <Card className="overflow-hidden">
              <div className="grid grid-cols-7 border-b border-line bg-paper-soft/50">
                {J_WEEKDAYS_LONG.map((d, i) => (
                  <div key={d} className={cn("px-0.5 py-2 text-center text-[10px] font-medium leading-4 sm:text-[11px]", i === 6 ? "text-red-500" : "text-ink-soft")}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthGrid.map((cell, i) => {
                  const fridayCol = i % 7 === 6;
                  if (!cell) return <div key={i} className="h-16 border-b border-l border-line/40 bg-paper-soft/20 sm:h-24 lg:h-[7.25rem]" />;
                  const iso = isoOfJalali(cell.jy, cell.jm, cell.jd);
                  const dayMeetings = byDate.get(iso) ?? [];
                  const occ = occupancyMap.get(iso);
                  const isToday = iso === today;
                  const isSelected = iso === selectedIso;
                  const isOtherMonth = cell.jm !== anchor.jm;
                  const isFriday = fridayCol || isFridayIso(iso);
                  return (
                    <button
                      key={i}
                      type="button"
                      data-weekday={isFriday ? "friday" : undefined}
                      onClick={() => setSelectedIso(iso)}
                      className={cn(
                        "relative h-16 border-b border-l border-line/40 p-1 text-right align-top transition-colors sm:h-24 sm:p-1.5 lg:h-[7.25rem]",
                        isSelected ? "bg-paper-soft" : "hover:bg-paper-soft/70",
                        isOtherMonth && "opacity-40",
                      )}
                    >
                      <span className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] sm:h-6 sm:w-6",
                        isToday ? "bg-ink font-bold text-white" : isFriday ? "font-medium text-red-600" : "text-ink",
                      )}>
                        {mode === "jalali" ? faNum(cell.jd) : faNum(gregorianDayOf(iso))}
                      </span>

                      <div className="mt-0.5 hidden space-y-0.5 sm:block">
                        {dayMeetings.slice(0, 3).map((m) => (
                          <Link
                            key={m.id}
                            href={`/meetings/${m.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={cn("flex truncate rounded px-1 py-0.5 text-[10px] leading-4", calendarEventTone(m.status).chip)}
                          >
                            <span className="truncate">{timeOf(m.startAt)} {m.isMasked ? "جلسه محرمانه" : m.title}</span>
                          </Link>
                        ))}
                        {dayMeetings.length > 3 && (
                          <div className="pr-1 text-[10px] text-ink-faint">+{faNum(dayMeetings.length - 3)} جلسه دیگر</div>
                        )}
                      </div>

                      <div className="absolute bottom-1.5 right-1.5 flex gap-0.5 sm:hidden">
                        {dayMeetings.slice(0, 3).map((m) => (
                          <span key={m.id} className={cn("h-1.5 w-1.5 rounded-full", calendarEventTone(m.status).dot)} />
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

            <DayPanel
              selectedIso={selectedIso}
              todayIso={today}
              meetings={selectedDayMeetings}
              mode={mode}
              className="hidden lg:block"
            />
          </div>

          <MobileAgenda selectedIso={selectedIso} meetings={selectedDayMeetings} todayIso={today} />
        </>
      ) : view === "week" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid border-b border-line" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
                <div />
                {weekDays.map((iso) => {
                  const j = jalaliOfIso(iso);
                  const isToday = iso === today;
                  const isFriday = isFridayIso(iso);
                  const count = byDate.get(iso)?.length ?? 0;
                  return (
                    <button
                      key={iso}
                      type="button"
                      data-weekday={isFriday ? "friday" : undefined}
                      onClick={() => { setSelectedIso(iso); setView("day"); }}
                      className={cn(
                        "border-l border-line/40 py-2 text-center transition-colors hover:bg-paper-soft",
                        isToday && "bg-paper-soft",
                      )}
                    >
                      <p className={cn("text-[10px]", isFriday ? "text-red-500" : "text-ink-soft")}>{WEEKDAY_LONG[(new Date(iso + "T12:00:00Z").getUTCDay() + 1) % 7]}</p>
                      <span className={cn("mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold", isToday ? "bg-ink text-white" : isFriday ? "text-red-600" : "text-ink")}>
                        {faNum(j.jd)}
                      </span>
                      {count > 0 && <p className="mt-0.5 text-[9px] text-ink-faint">{faNum(count)} جلسه</p>}
                    </button>
                  );
                })}
              </div>
              <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
                <div>
                  {Array.from({ length: WEEK_HOURS }, (_, i) => WEEK_START_HOUR + i).map((h) => (
                    <div key={h} className="h-12 border-b border-line/30 pr-1.5 pt-0.5 text-left text-[9px] text-ink-faint">
                      {faPad2(h)}:۰۰
                    </div>
                  ))}
                </div>
                {weekDays.map((iso) => {
                  const dayMeetings = byDate.get(iso) ?? [];
                  const intervals = dayMeetings.map((m) => ({
                    id: m.id,
                    startMin: minutesOf(m.startAt),
                    endMin: minutesOf(m.endAt),
                  }));
                  const blocks = layoutDayBlocks(intervals, WEEK_START_HOUR, WEEK_PX);
                  const nowMin = minutesOf(now.toISOString());
                  const nowTop = iso === today ? nowLineTop(nowMin, WEEK_START_HOUR, WEEK_END_HOUR, WEEK_PX) : null;
                  return (
                    <div key={iso} className="relative border-l border-line/40">
                      {Array.from({ length: WEEK_HOURS }, (_, i) => WEEK_START_HOUR + i).map((h) => (
                        <Link
                          key={h}
                          href={newMeetingHref(iso, h)}
                          aria-label={`جلسه جدید ${faPad2(h)}:۰۰`}
                          className="block h-12 border-b border-line/30 transition-colors hover:bg-paper-soft/80"
                        />
                      ))}
                      {nowTop != null && (
                        <div className="pointer-events-none absolute right-0 left-0 z-20" style={{ top: nowTop }}>
                          <div className="h-px bg-red-500" data-now-line />
                          <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-red-500" />
                        </div>
                      )}
                      {blocks.map((b) => {
                        const m = dayMeetings.find((x) => x.id === b.id);
                        if (!m) return null;
                        return (
                          <Link
                            key={m.id}
                            href={`/meetings/${m.id}`}
                            className={cn(
                              "absolute z-10 overflow-hidden rounded px-1.5 py-1 text-[10px] leading-tight transition-opacity hover:opacity-90",
                              calendarEventTone(m.status).block,
                            )}
                            style={{
                              top: b.top,
                              height: b.height,
                              right: `calc(${(b.col / b.cols) * 100}% + 2px)`,
                              width: `calc(${100 / b.cols}% - 4px)`,
                            }}
                          >
                            <p className="truncate font-medium"><EventLabel meeting={m} /></p>
                            <p className="truncate opacity-80">{timeOf(m.startAt)}</p>
                            {m.room && b.height > 36 && <p className="truncate opacity-70">{m.room.name}</p>}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <DayTimeline
          meetings={selectedDayMeetings}
          selectedIso={selectedIso}
          todayIso={today}
          friday={isFridayIso(selectedIso)}
        />
      )}

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

function DayPanel({
  selectedIso,
  todayIso,
  meetings,
  mode,
  className,
}: {
  selectedIso: string;
  todayIso: string;
  meetings: CalMeeting[];
  mode: CalMode;
  className?: string;
}) {
  const j = jalaliOfIso(selectedIso);
  const weekday = WEEKDAY_LONG[(new Date(selectedIso + "T12:00:00Z").getUTCDay() + 1) % 7];
  const friday = isFridayIso(selectedIso);
  const dateText =
    mode === "jalali"
      ? `${weekday} ${faNum(j.jd)} ${J_MONTHS[j.jm - 1]}`
      : new Intl.DateTimeFormat("fa-IR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
          new Date(selectedIso + "T12:00:00Z"),
        );

  return (
    <Card data-tour="cal-day-panel" className={cn("sticky top-4", className)}>
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <p className={cn("text-[14px] font-bold", friday && "text-red-600")}>
            {dateText}
            {selectedIso === todayIso ? " · امروز" : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {meetings.length ? `${faNum(meetings.length)} جلسه` : "روز خالی"}
          </p>
        </div>
      </div>
      <div className="max-h-[28rem] divide-y divide-line overflow-y-auto">
        {meetings.length === 0 && (
          <p className="px-4 py-8 text-center text-[12px] text-ink-faint">جلسه‌ای در این روز نیست</p>
        )}
        {meetings.map((m) => {
          const tone = calendarEventTone(m.status);
          return (
            <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-paper-soft">
              <div className="w-12 shrink-0 pt-0.5 text-left">
                <p className="text-[11px] font-bold">{timeOf(m.startAt)}</p>
              </div>
              <div className={cn("mt-1 h-8 w-1 shrink-0 rounded-full", tone.rail)} />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-[12.5px] font-medium", m.status === "CANCELLED" && "line-through opacity-60")}>
                  <EventLabel meeting={m} />
                </p>
                <p className="mt-0.5 truncate text-[11px] text-ink-faint">{m.room?.name ?? m.organizer.fullName}</p>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="border-t border-line p-3">
        <Link
          href={newMeetingHref(selectedIso)}
          className="flex h-10 items-center justify-center rounded-md bg-ink text-[12.5px] font-medium text-white transition-colors hover:bg-[#2a2a2e]"
        >
          ثبت جلسه در این روز
        </Link>
      </div>
    </Card>
  );
}

function CalendarMonthSkeleton({
  monthGrid,
}: {
  monthGrid: ({ jy: number; jm: number; jd: number } | null)[];
}) {
  return (
    <>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-paper-soft/50">
            {J_WEEKDAYS_LONG.map((d, i) => (
              <div key={d} className={cn("px-0.5 py-2 text-center text-[10px] font-medium leading-4 sm:text-[11px]", i === 6 ? "text-red-500" : "text-ink-soft")}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGrid.map((cell, i) => {
              if (!cell) {
                return <div key={i} className="h-16 border-b border-l border-line/40 bg-paper-soft/20 sm:h-24 lg:h-[7.25rem]" />;
              }
              return (
                <div key={i} className="relative h-16 border-b border-l border-line/40 p-1 text-right sm:h-24 sm:p-1.5 lg:h-[7.25rem]">
                  <SkeletonBlock className="inline-flex h-5 w-5 rounded-full sm:h-6 sm:w-6" />
                  <div className="mt-0.5 hidden space-y-0.5 sm:block">
                    <SkeletonBlock className="h-4 w-full rounded" />
                    <SkeletonBlock className="h-4 w-[85%] rounded" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="hidden lg:block">
          <div className="border-b border-line px-4 py-3">
            <SkeletonBlock className="h-4 w-40" />
          </div>
          <div className="space-y-3 p-4">
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-2/3" />
          </div>
        </Card>
      </div>
      <Card className="lg:hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-5 w-14 rounded-full" />
        </div>
        <div className="divide-y divide-line">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <SkeletonBlock className="h-3.5 w-12" />
              <SkeletonBlock className="h-8 w-1 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <SkeletonBlock className="h-3.5 w-2/3" />
                <SkeletonBlock className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function CalendarWeekSkeleton({ weekDays }: { weekDays: string[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid border-b border-line" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
            <div />
            {weekDays.map((iso) => (
              <div key={iso} className="border-l border-line/40 py-2 text-center">
                <SkeletonBlock className="mx-auto h-3 w-12" />
                <SkeletonBlock className="mx-auto mt-1 h-7 w-7 rounded-full" />
              </div>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
            <div>
              {Array.from({ length: WEEK_HOURS }, (_, i) => WEEK_START_HOUR + i).map((h) => (
                <div key={h} className="h-12 border-b border-line/30 pr-1.5 pt-0.5 text-left text-[9px] text-ink-faint">
                  {faPad2(h)}:۰۰
                </div>
              ))}
            </div>
            {weekDays.map((iso) => (
              <div key={iso} className="relative border-l border-line/40">
                {Array.from({ length: WEEK_HOURS }, (_, i) => (
                  <div key={i} className="h-12 border-b border-line/30" />
                ))}
                {(iso === weekDays[2] || iso === weekDays[4]) && (
                  <SkeletonBlock className="absolute right-0.5 left-0.5 rounded" style={{ top: 48, height: 64 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MobileAgenda({
  selectedIso,
  meetings,
  todayIso,
}: {
  selectedIso: string;
  meetings: CalMeeting[];
  todayIso: string;
}) {
  const j = jalaliOfIso(selectedIso);
  const weekday = WEEKDAY_LONG[(new Date(selectedIso + "T12:00:00Z").getUTCDay() + 1) % 7];
  const label = `${weekday} ${faNum(j.jd)} ${J_MONTHS[j.jm - 1]}${selectedIso === todayIso ? " · امروز" : ""}`;

  return (
    <Card className="lg:hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className={cn("text-[13px] font-bold", isFridayIso(selectedIso) && "text-red-600")}>{label}</p>
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
            <div className={cn("h-8 w-1 shrink-0 rounded-full", calendarEventTone(m.status).rail)} />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[12px] font-medium", m.status === "CANCELLED" && "line-through opacity-60")}>
                <EventLabel meeting={m} />
              </p>
              <p className="truncate text-[10px] text-ink-faint">{m.room?.name ?? m.organizer.fullName}</p>
            </div>
          </Link>
        ))}
      </div>
      <div className="border-t border-line p-3">
        <Link
          href={newMeetingHref(selectedIso)}
          className="flex h-10 items-center justify-center rounded-md border border-line text-[12px] font-medium text-ink hover:bg-paper-soft"
        >
          ثبت جلسه در این روز
        </Link>
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
