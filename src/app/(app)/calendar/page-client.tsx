"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Plus, Shield, Download } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
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
  seriesId?: string | null;
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
  const repeat = meeting.seriesId ? " ↻" : "";
  if (!meeting.isMasked) return <span className={className}>{meeting.title}{repeat}</span>;
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
  // +1 = paging forward (slide left), -1 = backward (slide right)
  const [monthAnimDir, setMonthAnimDir] = useState(1);
  const gotoMonth = useCallback((jy: number, jm: number, dir?: 1 | -1) => {
    if (dir) setMonthAnimDir(dir);
    setAnchor({ jy, jm });
  }, []);
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

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["calendar", range.from.toISOString(), range.to.toISOString(), scope],
    queryFn: () =>
      api<{ meetings: CalMeeting[]; occupancy: { date: string; count: number; occupancyPct: number }[]; seeAll: boolean }>(
        `/api/calendar?from=${range.from.toISOString()}&to=${range.to.toISOString()}&scope=${scope}`,
      ),
    // keep last month's data while fetching the new one — no skeleton flash,
    // no DOM teardown (docks/drag context survive), smooth animated flip
    placeholderData: keepPreviousData,
  });
  // only the FIRST load shows a skeleton; month flips keep rendering data
  const showSkeleton = isLoading && !isPlaceholderData;  const meetings = data?.meetings ?? [];
  // ── drag & drop reschedule (month view) ──
  const qc = useQueryClient();
  const { push } = useToast();
  const { can, me } = useAuth();
  const canDnD = can("meeting:reschedule") || me?.id != null; // organizer check is server-side too
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverIso, setDragOverIso] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  // edge-dock month picker during drag: NEXT months (left edge) / PREV months (right edge)
  const [monthDock, setMonthDock] = useState<"next" | "prev" | null>(null);
  // auto-advance: hold the chip on an edge → calendar pages through months repeatedly
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopAutoAdvance = useCallback(() => {
    if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null; }
    if (autoIntervalRef.current) { clearInterval(autoIntervalRef.current); autoIntervalRef.current = null; }
  }, []);
  const startAutoAdvance = useCallback(
    (dir: 1 | -1) => {
      stopAutoAdvance();
      // first flip after a short hold, then keep flipping while hovering
      autoTimerRef.current = setTimeout(() => {
        monthDelta(dir);
        autoIntervalRef.current = setInterval(() => monthDelta(dir), 700);
      }, 600);
    },
    [stopAutoAdvance, monthDelta],
  );
  useEffect(() => () => { stopAutoAdvance(); if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, [stopAutoAdvance]);

  // sticky dock hover: the panel stays open while the chip is over the dock OR the panel.
  // Closing is delayed 280ms so the dock→panel journey doesn't kill it, and any
  // dragenter/dragover on either element cancels the pending close.
  const dockNextRef = useRef<HTMLDivElement | null>(null);
  const dockPrevRef = useRef<HTMLDivElement | null>(null);
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const cancelPendingClose = useCallback(() => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  }, []);
  const scheduleDockClose = useCallback(() => {
    cancelPendingClose();
    closeTimerRef.current = setTimeout(() => { setMonthDock(null); stopAutoAdvance(); }, 280);
  }, [cancelPendingClose, stopAutoAdvance]);
  const inDockUnion = useCallback((t: EventTarget | null) => {
    if (!(t instanceof Node)) return false;
    return (
      (dockNextRef.current?.contains(t) ?? false) ||
      (dockPrevRef.current?.contains(t) ?? false) ||
      (panelRootRef.current?.contains(t) ?? false)
    );
  }, []);
  // pending drop awaiting modal confirmation: { meeting, iso, newStart, newEnd }
  const [pendingDrop, setPendingDrop] = useState<{
    id: string;
    title: string;
    iso: string;
    newStart: Date;
    newEnd: Date;
  } | null>(null);

  const onDropToDay = useCallback(
    (iso: string, idFromData?: string) => {
      const id = idFromData ?? dragId;
      setDragId(null);
      setDragOverIso(null);
      if (!id) return;
      const m = (meetings ?? []).find((x) => x.id === id);
      if (!m) return;
      // same-day drop = no-op
      const srcIso = new Date(new Date(m.startAt).getTime() + 210 * 60000).toISOString().slice(0, 10);
      if (srcIso === iso) return;
      // keep the same local time-of-day and duration, move to the target day
      const startLocal = new Date(new Date(m.startAt).getTime() + 210 * 60000);
      const durMin = (new Date(m.endAt).getTime() - new Date(m.startAt).getTime()) / 60000;
      const [y, mo, d] = iso.split("-").map(Number);
      const newStartLocal = new Date(Date.UTC(y, mo - 1, d, startLocal.getUTCHours(), startLocal.getUTCMinutes()));
      const newStart = new Date(newStartLocal.getTime() - 210 * 60000);
      const newEnd = new Date(newStart.getTime() + durMin * 60000);
      // show the confirmation MODAL instead of window.confirm
      setPendingDrop({ id, title: m.isMasked ? "جلسه محرمانه" : m.title, iso, newStart, newEnd });
    },
    [dragId, meetings],
  );

  // compute target iso: same Jalali day in an arbitrary month offset from the DRAGGED meeting's month
  const isoInMonthOffset = useCallback((meetingId: string, offset: number): string | null => {
    const m = (meetings ?? []).find((x) => x.id === meetingId);
    if (!m) return null;
    const j = jalaliOfIso(new Date(new Date(m.startAt).getTime() + 210 * 60000).toISOString().slice(0, 10));
    let { jy, jm } = j;
    jm += offset;
    while (jm > 12) { jm -= 12; jy += 1; }
    while (jm < 1) { jm += 12; jy -= 1; }
    const jd = Math.min(j.jd, jMonthLen(jy, jm));
    return isoOfJalali(jy, jm, jd);
  }, [meetings]);

  // drop on the month arrows: same Jalali day in the next/previous month
  const onDropToMonth = useCallback(
    (delta: 1 | -1, idFromData?: string) => {
      const id = idFromData ?? dragId;
      setDragId(null);
      setDragOverIso(null);
      if (!id) return;
      const m = (meetings ?? []).find((x) => x.id === id);
      if (!m) return;
      const j = jalaliOfIso(new Date(new Date(m.startAt).getTime() + 210 * 60000).toISOString().slice(0, 10));
      let { jy, jm } = j;
      jm += delta;
      if (jm > 12) { jm = 1; jy += 1; }
      if (jm < 1) { jm = 12; jy -= 1; }
      const jd = Math.min(j.jd, jMonthLen(jy, jm)); // clamp for short months
      const iso = isoOfJalali(jy, jm, jd);
      // reuse the same computation as a day-drop
      onDropToDay(iso, id);
    },
    [dragId, meetings, onDropToDay],
  );

  // drop onto an HOUR slot in the day timeline — same confirm modal
  const onDropToHour = useCallback(
    (meetingId: string, hour: number) => {
      const m = (meetings ?? []).find((x) => x.id === meetingId);
      if (!m) return;
      const src = new Date(new Date(m.startAt).getTime() + 210 * 60000);
      const durMin = (new Date(m.endAt).getTime() - new Date(m.startAt).getTime()) / 60000;
      const newStartLocal = new Date(
        Date.UTC(src.getUTCFullYear(), src.getUTCMonth(), src.getUTCDate(), hour, 0),
      );
      const newStart = new Date(newStartLocal.getTime() - 210 * 60000);
      const newEnd = new Date(newStart.getTime() + durMin * 60000);
      const iso = new Date(newStartLocal.getTime()).toISOString().slice(0, 10);
      setPendingDrop({ id: meetingId, title: m.isMasked ? "جلسه محرمانه" : m.title, iso, newStart, newEnd });
    },
    [meetings],
  );

  const confirmDrop = useCallback(async () => {
    if (!pendingDrop) return;
    setDropping(true);
    try {
      await api(`/api/meetings/${pendingDrop.id}/reschedule`, {
        method: "POST",
        json: {
          startAt: pendingDrop.newStart.toISOString(),
          endAt: pendingDrop.newEnd.toISOString(),
          reason: "CALENDAR_DRAG",
        },
      });
      push("جلسه جابه‌جا شد ✓", "success");
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setPendingDrop(null);
    } catch (e) {
      push((e as Error).message || "جابه‌جایی ناموفق بود", "error");
    } finally {
      setDropping(false);
    }
  }, [pendingDrop, push, qc]);


  const holidayFrom = isoOfJalali(anchor.jy, anchor.jm, 1);
  const holidayTo = addDaysIso(holidayFrom, jMonthLen(anchor.jy, anchor.jm) + 14);
  const { data: holidayData } = useQuery({
    queryKey: ["org-holidays", holidayFrom, holidayTo],
    queryFn: () =>
      api<{ holidays: { dateIso: string; name: string }[]; bookingMode: "BLOCK" | "REQUIRE_APPROVAL" }>(
        `/api/holidays?from=${holidayFrom}&to=${holidayTo}`,
      ),
  });
  const holidayByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of holidayData?.holidays ?? []) map.set(h.dateIso, h.name);
    return map;
  }, [holidayData]);
  const holidayMode = holidayData?.bookingMode ?? "BLOCK";


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

  function monthMeta(offset: number): { label: string; sub: string } {
    let { jy, jm } = anchor;
    jm += offset;
    while (jm > 12) { jm -= 12; jy += 1; }
    while (jm < 1) { jm += 12; jy -= 1; }
    const now = toJalali(new Date());
    const isCurrent = jy === now.jy && jm === now.jm;
    return { label: `${J_MONTHS[jm - 1]}`, sub: isCurrent ? "ماه جاری" : `${jy}` };
  }

  function monthDelta(delta: number) {
    let { jy, jm } = anchor;
    jm += delta;
    if (jm > 12) { jm = 1; jy += 1; }
    if (jm < 1) { jm = 12; jy -= 1; }
    gotoMonth(jy, jm, delta > 0 ? 1 : -1);
  }

  function jumpToIso(iso: string) {
    setSelectedIso(iso);
    const j = jalaliOfIso(iso);
    const dir = j.jm !== anchor.jm || j.jy !== anchor.jy ? (j.jy > anchor.jy || (j.jy === anchor.jy && j.jm > anchor.jm) ? 1 : -1) : undefined;
    gotoMonth(j.jy, j.jm, dir as 1 | -1 | undefined);
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
    <div className="min-w-0 space-y-4 overflow-x-clip p-4 lg:p-6" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => stepNav(-1)}
            onDragOver={(e) => { if (view === "month" && dragId) { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("ring-2","ring-ink"); } }}
            onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("ring-2","ring-ink")}
            onDrop={(e) => { if (view === "month") { e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove("ring-2","ring-ink"); onDropToMonth(-1, e.dataTransfer.getData("text/plain") || undefined); } }}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-white p-0 hover:bg-paper-soft"
            aria-label="قبلی"
            title="جابه‌جایی جلسه به ماه قبل — بکشید و این‌جا رها کنید"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h1 className={cn("min-w-36 text-center text-[18px] font-bold sm:min-w-48", view === "day" && isFridayIso(selectedIso) && "text-red-600")}>
            {view === "day" ? dayLabel(selectedIso) : monthTitle}
          </h1>
          <button
            onClick={() => stepNav(1)}
            onDragOver={(e) => { if (view === "month" && dragId) { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("ring-2","ring-ink"); } }}
            onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("ring-2","ring-ink")}
            onDrop={(e) => { if (view === "month") { e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove("ring-2","ring-ink"); onDropToMonth(1, e.dataTransfer.getData("text/plain") || undefined); } }}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-white p-0 hover:bg-paper-soft"
            aria-label="بعدی"
            title="جابه‌جایی جلسه به ماه بعد — بکشید و این‌جا رها کنید"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <JalaliDatePicker variant="icon" value={selectedIso} onChange={jumpToIso} className="shrink-0" />
          <button
            onClick={goToday}
            className="inline-flex h-9 items-center rounded-md border border-line bg-white px-3 text-[11px] font-medium text-ink-soft hover:bg-paper-soft"
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
          <Link
            href="/profile#calendar-feed"
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-[12px] text-ink-soft hover:bg-paper-soft"
          >
            <Download className="h-3.5 w-3.5" />
            خروجی ICS
          </Link>
        </div>
      </div>

      {showSkeleton ? (
        view === "month" ? (
          <CalendarMonthSkeleton monthGrid={monthGrid} />
        ) : view === "week" ? (
          <CalendarWeekSkeleton weekDays={weekDays} />
        ) : (
          <DayTimelineSkeleton />
        )
      ) : view === "month" ? (
        <>
          <div className="relative grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <Card className="overflow-visible">
              <div className="grid grid-cols-7 border-b border-line bg-paper-soft/50">
                {J_WEEKDAYS_LONG.map((d, i) => (
                  <div key={d} className={cn("px-0.5 py-2 text-center text-[10px] font-medium leading-4 sm:text-[11px]", i === 6 ? "text-red-500" : "text-ink-soft")}>{d}</div>
                ))}
              </div>
              <div className="relative overflow-hidden">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={`${anchor.jy}/${anchor.jm}`}
                  initial={{ opacity: 0, x: monthAnimDir * 36 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: monthAnimDir * -36 }}
                  transition={{ duration: 0.28, ease: [0.22, 0.8, 0.36, 1] }}
                  className="grid grid-cols-7"
                >
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
                  const holidayName = holidayByDate.get(iso);
                  return (
                    <button
                      key={i}
                      type="button"
                      data-weekday={isFriday ? "friday" : undefined}
                      onClick={() => setSelectedIso(iso)}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        // other-month cells are NOT drop targets — use the edge dock panel instead
                        if (cell.jm !== anchor.jm) return;
                        e.preventDefault();
                        setDragOverIso(iso);
                      }}
                      onDragLeave={() => setDragOverIso((cur) => (cur === iso ? null : cur))}
                      onDrop={(e) => {
                        if (cell.jm !== anchor.jm) return; // not this month → dock panel handles it
                        e.preventDefault();
                        const fromData = e.dataTransfer.getData("text/plain");
                        onDropToDay(iso, fromData || undefined);
                      }}
                      className={cn(
                        "relative h-16 border-b border-l border-line/40 p-1 text-right align-top transition-colors sm:h-24 sm:p-1.5 lg:h-[7.25rem]",
                        dragOverIso === iso && "ring-2 ring-inset ring-ink bg-paper-soft",
                        holidayName
                          ? "bg-amber-50"
                          : isSelected
                            ? "bg-paper-soft"
                            : "hover:bg-paper-soft/70",
                        isOtherMonth && (dragId ? "opacity-100" : "opacity-40"),
                      )}
                    >
                      <span className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] sm:h-6 sm:w-6",
                        isToday ? "bg-ink font-bold text-white" : isFriday || holidayName ? "font-medium text-red-600" : "text-ink",
                      )}>
                        {mode === "jalali" ? faNum(cell.jd) : faNum(gregorianDayOf(iso))}
                      </span>
                      {holidayName && (
                        <p className="mt-0.5 truncate text-[8px] font-medium text-amber-800 sm:text-[9px]">
                          تعطیل
                        </p>
                      )}

                      <div className="mt-0.5 hidden space-y-0.5 sm:block">
                        {dayMeetings.slice(0, 3).map((m) => (
                          <Link
                            key={m.id}
                            href={`/meetings/${m.id}`}
                            onClick={(e) => e.stopPropagation()}
                            draggable={canDnD && !m.isMasked ? true : undefined}
                            onDragStart={(e) => {
                              setDragId(m.id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", m.id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setDragOverIso(null);
                              stopAutoAdvance();
                            }}
                            className={cn(
                              "flex truncate rounded px-1 py-0.5 text-[10px] leading-4",
                              calendarEventTone(m.status).chip,
                              dragId === m.id && "opacity-40",
                              canDnD && "cursor-grab active:cursor-grabbing",
                            )}
                          >
                            <span className="truncate">{timeOf(m.startAt)} {m.isMasked ? "جلسه محرمانه" : m.title}{m.seriesId ? " ↻" : ""}</span>
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
              {/* ── edge docks (hover while dragging): LEFT = next months, RIGHT = previous months ── */}
              <AnimatePresence>
                {dragId && (
                  <>
                    {/* next-months dock — full calendar height, slides in only while dragging */}
                    <motion.div
                      key="dock-next"
                      initial={{ opacity: 0, x: 28 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 28 }}
                      transition={{ duration: 0.25, ease: [0.22, 0.8, 0.36, 1] }}
                      ref={dockNextRef}
                      className="absolute -left-[2px] top-0 bottom-0 z-30 w-[72px]"
                      onDragEnter={(e) => { e.preventDefault(); cancelPendingClose(); setMonthDock("next"); startAutoAdvance(1); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); cancelPendingClose(); setMonthDock("next"); }}
                      onDragLeave={(e) => { if (inDockUnion(e.relatedTarget)) return; scheduleDockClose(); }}
                      onDrop={(e) => { e.preventDefault(); cancelPendingClose(); setMonthDock(null); stopAutoAdvance(); }}
                      title="ماه‌های بعد"
                    >
                      <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink/40 bg-paper-soft/90 shadow-sm">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="text-[10px] font-bold [writing-mode:vertical-rl] text-ink-soft">ماه‌های بعد</span>
                      </div>
                    </motion.div>
                    {/* previous-months dock */}
                    <motion.div
                      key="dock-prev"
                      initial={{ opacity: 0, x: -28 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -28 }}
                      transition={{ duration: 0.25, ease: [0.22, 0.8, 0.36, 1] }}
                      ref={dockPrevRef}
                      className="absolute -right-[2px] top-0 bottom-0 z-30 w-[72px]"
                      onDragEnter={(e) => { e.preventDefault(); cancelPendingClose(); setMonthDock("prev"); startAutoAdvance(-1); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); cancelPendingClose(); setMonthDock("prev"); }}
                      onDragLeave={(e) => { if (inDockUnion(e.relatedTarget)) return; scheduleDockClose(); }}
                      onDrop={(e) => { e.preventDefault(); cancelPendingClose(); setMonthDock(null); stopAutoAdvance(); }}
                      title="ماه‌های قبل"
                    >
                      <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink/40 bg-paper-soft/90 shadow-sm">
                        <ChevronRight className="h-4 w-4" />
                        <span className="text-[10px] font-bold [writing-mode:vertical-rl] text-ink-soft">ماه‌های قبل</span>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

                  {/* floating month panel */}
                  <AnimatePresence>
                  {monthDock && (
                    <motion.div
                      dir="rtl"
                      initial={{ opacity: 0, scale: 0.92, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: 8 }}
                      transition={{ duration: 0.2, ease: [0.22, 0.8, 0.36, 1] }}
                      className={cn(
                        "absolute top-10 z-40 w-56 rounded-xl border border-line bg-white p-3 shadow-2xl",
                        monthDock === "next" ? "left-[80px]" : "right-[80px]",
                      )}
                      ref={panelRootRef}
                      onDragEnter={(e) => { e.preventDefault(); cancelPendingClose(); stopAutoAdvance(); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); cancelPendingClose(); }}
                      onDragLeave={(e) => { if (inDockUnion(e.relatedTarget)) return; scheduleDockClose(); }}
                    >
                      <p className="mb-2 text-[11px] font-bold text-ink">
                        {monthDock === "next" ? "انتقال به ماه‌های بعد" : "انتقال به ماه‌های قبل"}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(monthDock === "next"
                          ? [1, 2, 3, 4, 5, 6]
                          : [-1, -2, -3, -4, -5, -6]
                        ).map((offset) => {
                          const meta = monthMeta(offset);
                          return (
                            <div
                              key={offset}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const id = e.dataTransfer.getData("text/plain") || dragId || "";
                                setMonthDock(null);
                                setDragId(null);
                                const iso = isoInMonthOffset(id, offset);
                                if (id && iso) onDropToDay(iso, id);
                              }}
                              className="cursor-pointer rounded-lg border border-line bg-paper-soft/40 p-2 text-center transition-colors hover:border-ink hover:bg-paper-soft"
                            >
                              <p className="text-[12px] font-bold text-ink">{meta.label}</p>
                              <p className="mt-0.5 text-[9px] text-ink-faint">{meta.sub}</p>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-center text-[9px] text-ink-faint">
                        جلسه را روی ماه دلخواه رها کنید
                      </p>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
              </div>

            </Card>

            <DayPanel
              selectedIso={selectedIso}
              todayIso={today}
              meetings={selectedDayMeetings}
              mode={mode}
              holidayName={holidayByDate.get(selectedIso) ?? null}
              holidayMode={holidayMode}
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
          onReschedule={onDropToHour}
        />
      )}

      <Link
        href="/meetings/new"
        className="fixed bottom-24 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-lg transition-transform active:scale-95 lg:hidden"
        aria-label="جلسه جدید"
      >
        <Plus className="h-6 w-6" />
      </Link>

      {/* drag & drop confirmation — modal instead of window.confirm */}
      <Modal
        open={!!pendingDrop}
        onClose={() => setPendingDrop(null)}
        title="جابه‌جایی جلسه"
        subtitle="زمان جدید با حفظ ساعت و مدت جلسه"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPendingDrop(null)}>
              انصراف
            </Button>
            <Button onClick={confirmDrop} disabled={dropping}>
              {dropping ? "در حال جابه‌جایی…" : "تأیید جابه‌جایی"}
            </Button>
          </div>
        }
      >
        {pendingDrop && (
          <div className="space-y-3 text-[13px]">
            <p>
              جلسه <span className="font-bold">«{pendingDrop.title}»</span> به{" "}
              <span className="font-bold">{formatJalali(new Date(pendingDrop.iso + "T12:00:00Z"), { monthName: true })}</span> منتقل شود؟
            </p>
            <div className="rounded-md border border-line bg-paper-soft/60 p-3 text-[12px] leading-6">
              <p>
                شروع جدید:{" "}
                <span className="font-medium">
                  {formatJalali(pendingDrop.newStart, { withTime: true })}
                </span>
              </p>
              <p>
                پایان جدید:{" "}
                <span className="font-medium">
                  {formatJalali(pendingDrop.newEnd, { withTime: true })}
                </span>
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DayPanel({
  selectedIso,
  todayIso,
  meetings,
  mode,
  holidayName,
  holidayMode,
  className,
}: {
  selectedIso: string;
  todayIso: string;
  meetings: CalMeeting[];
  mode: CalMode;
  holidayName?: string | null;
  holidayMode?: "BLOCK" | "REQUIRE_APPROVAL";
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
          <p className={cn("text-[14px] font-bold", (friday || holidayName) && "text-red-600")}>
            {dateText}
            {selectedIso === todayIso ? " · امروز" : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {holidayName
              ? `تعطیل: ${holidayName}`
              : meetings.length
                ? `${faNum(meetings.length)} جلسه`
                : "روز خالی"}
          </p>
        </div>
      </div>
      {holidayName && (
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] leading-5 text-amber-900">
          {holidayMode === "REQUIRE_APPROVAL"
            ? "روز تعطیل سازمانی — رزرو نیاز به تأیید دارد."
            : "روز تعطیل سازمانی — رزرو اتاق پیش‌فرض ممنوع است."}
        </p>
      )}
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
