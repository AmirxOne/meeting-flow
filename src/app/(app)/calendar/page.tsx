"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import { Card, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { cn, faNum, faStr, formatJalali, toJalali } from "@/lib";
import { jMonthGrid, J_MONTHS, J_WEEKDAYS_SHORT, jMonthLen } from "@/lib/jalali";

interface CalMeeting {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  meetingType: string;
  organizer: { fullName: string };
  room: { id: string; name: string } | null;
  _count: { participants: number };
}

type ViewMode = "month" | "day";

export default function CalendarPage() {
  const [mode, setMode] = useState<"jalali" | "gregorian">("jalali");
  const [view, setView] = useState<ViewMode>("month");
  const [scope, setScope] = useState<"all" | "mine">("all");

  const today = toJalali(new Date());
  const [jy, setJy] = useState(today.jy);
  const [jm, setJm] = useState(today.jm);
  const [selectedIso, setSelectedIso] = useState<string>(() => {
    const t = new Date(Date.now() + 210 * 60000);
    return t.toISOString().slice(0, 10);
  });

  // month window (UTC instants)
  const window = useMemo(() => {
    // jalali jm/jy → gregorian month approx via 1st and last day
    const first = jalaliFirst(jy, jm);
    const len = jMonthLen(jy, jm);
    const from = new Date(first.getTime() - 7 * 86400000);
    const to = new Date(first.getTime() + (len + 7) * 86400000);
    return { from, to };
  }, [jy, jm]);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", window.from.toISOString(), window.to.toISOString(), scope],
    queryFn: () =>
      api<{ meetings: CalMeeting[]; occupancy: { date: string; count: number; occupancyPct: number }[]; seeAll: boolean }>(
        `/api/calendar?from=${window.from.toISOString()}&to=${window.to.toISOString()}&scope=${scope}`,
      ),
  });

  const meetings = data?.meetings ?? [];
  const occupancyMap = new Map((data?.occupancy ?? []).map((o) => [o.date, o]));

  // meetings by local iso date
  const byDate = useMemo(() => {
    const map = new Map<string, CalMeeting[]>();
    for (const m of meetings) {
      const key = new Date(new Date(m.startAt).getTime() + 210 * 60000).toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return map;
  }, [meetings]);

  const grid = jMonthGrid(jy, jm);

  function monthDelta(delta: number) {
    let m = jm + delta;
    let y = jy;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setJm(m);
    setJy(y);
  }

  const dayMeetings = byDate.get(selectedIso) ?? [];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">تقویم</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-line">
            <button
              onClick={() => setScope("all")}
              className={cn("px-3 py-1.5 text-[12px]", scope === "all" ? "bg-ink text-white" : "text-ink-soft")}
            >
              شرکت
            </button>
            <button
              onClick={() => setScope("mine")}
              className={cn("px-3 py-1.5 text-[12px]", scope === "mine" ? "bg-ink text-white" : "text-ink-soft")}
            >
              من
            </button>
          </div>
          <div className="flex overflow-hidden rounded-md border border-line">
            <button
              onClick={() => setMode("jalali")}
              className={cn("px-3 py-1.5 text-[12px]", mode === "jalali" ? "bg-ink text-white" : "text-ink-soft")}
            >
              شمسی
            </button>
            <button
              onClick={() => setMode("gregorian")}
              className={cn("px-3 py-1.5 text-[12px]", mode === "gregorian" ? "bg-ink text-white" : "text-ink-soft")}
            >
              میلادی
            </button>
          </div>
          <div className="flex overflow-hidden rounded-md border border-line">
            <button
              onClick={() => setView("month")}
              className={cn("px-3 py-1.5 text-[12px]", view === "month" ? "bg-ink text-white" : "text-ink-soft")}
            >
              ماه
            </button>
            <button
              onClick={() => setView("day")}
              className={cn("px-3 py-1.5 text-[12px]", view === "day" ? "bg-ink text-white" : "text-ink-soft")}
            >
              روز
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <SkeletonBlock className="h-[560px]" />
      ) : view === "month" ? (
        <Card className="overflow-hidden">
          {/* month header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <button onClick={() => monthDelta(-1)} className="rounded-md p-1.5 hover:bg-paper-soft" aria-label="ماه قبل">
              <ChevronRight className="h-4 w-4" />
            </button>
            <p className="text-[14px] font-bold">
              {mode === "jalali"
                ? `${J_MONTHS[jm - 1]} ${faNum(jy)}`
                : gregorianMonthLabel(jy, jm)}
            </p>
            <button onClick={() => monthDelta(1)} className="rounded-md p-1.5 hover:bg-paper-soft" aria-label="ماه بعد">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* weekday header */}
          <div className="grid grid-cols-7 border-b border-line bg-paper-soft/50">
            {J_WEEKDAYS_SHORT.map((d) => (
              <div key={d} className="py-2 text-center text-[11px] font-medium text-ink-soft">
                {d}
              </div>
            ))}
          </div>

          {/* grid */}
          <div className="grid grid-cols-7">
            {grid.map((cell, i) => {
              if (!cell) return <div key={i} className="min-h-20 border-b border-l border-line/60 bg-paper-soft/30" />;
              const iso = isoOfJalali(cell.jy, cell.jm, cell.jd);
              const dayMeetings = byDate.get(iso) ?? [];
              const occ = occupancyMap.get(iso);
              const isToday = iso === new Date(Date.now() + 210 * 60000).toISOString().slice(0, 10);
              const isSelected = iso === selectedIso;
              return (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedIso(iso);
                    setView("day");
                  }}
                  className={cn(
                    "min-h-20 border-b border-l border-line/60 p-1.5 text-right align-top transition-colors hover:bg-paper-soft",
                    isSelected && "ring-2 ring-inset ring-ink",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px]",
                      isToday && "bg-ink font-bold text-white",
                    )}
                  >
                    {mode === "jalali" ? faNum(cell.jd) : faNum(gregorianDayOf(iso))}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayMeetings.slice(0, 2).map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[9px] leading-4",
                          m.status === "IN_PROGRESS"
                            ? "bg-red-100 text-red-700"
                            : m.status === "CANCELLED"
                              ? "bg-paper-deep text-ink-faint line-through"
                              : "bg-paper-deep text-ink",
                        )}
                      >
                        {faStr(new Date(new Date(m.startAt).getTime() + 210 * 60000).toISOString().slice(11, 16))} {m.title}
                      </div>
                    ))}
                    {dayMeetings.length > 2 && (
                      <div className="pr-1 text-[9px] text-ink-faint">+{faNum(dayMeetings.length - 2)} جلسه دیگر</div>
                    )}
                  </div>
                  {occ && scope === "all" && (
                    <div className="mt-1 h-0.5 rounded bg-paper-deep">
                      <div className="h-0.5 rounded bg-ink" style={{ width: `${occ.occupancyPct}%` }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
        /* Day view */
        <Card>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <button onClick={() => setSelectedIso(dayDelta(selectedIso, -1))} className="rounded-md p-1.5 hover:bg-paper-soft" aria-label="روز قبل">
              <ChevronRight className="h-4 w-4" />
            </button>
            <p className="text-[14px] font-bold">{dayLabel(selectedIso, mode)}</p>
            <button onClick={() => setSelectedIso(dayDelta(selectedIso, 1))} className="rounded-md p-1.5 hover:bg-paper-soft" aria-label="روز بعد">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="divide-y divide-line">
            {dayMeetings.length === 0 && <EmptyState title="جلسه‌ای در این روز نیست" />}
            {dayMeetings.map((m) => (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-paper-soft"
              >
                <div className="w-16 shrink-0 text-center">
                  <p className="text-[13px] font-bold">
                    {faStr(new Date(new Date(m.startAt).getTime() + 210 * 60000).toISOString().slice(11, 16))}
                  </p>
                  <p className="text-[10px] text-ink-faint">
                    {faStr(new Date(new Date(m.endAt).getTime() + 210 * 60000).toISOString().slice(11, 16))}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{m.title}</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    {m.organizer.fullName}
                    {m.room ? ` · ${m.room.name}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    m.status === "IN_PROGRESS" ? "bg-red-500" : m.status === "CANCELLED" ? "bg-zinc-300" : "bg-ink",
                  )}
                />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function jalaliFirst(jy: number, jm: number): Date {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let gy = jy + 621, leapJ = -14, jp = breaks[0], jump = 0;
  for (let i = 1; i < breaks.length; i += 1) {
    const b = breaks[i];
    jump = b - jp;
    if (jy < b) break;
    leapJ += Math.floor(jump / 33) * 8 + Math.floor((jump % 33) / 4);
    jp = b;
  }
  const n = jy - jp;
  leapJ += Math.floor(n / 33) * 8 + Math.floor(((n % 33) + 3) / 4);
  if (jump % 33 === 4 && jump - n === 4) leapJ += 1;
  const leapG = Math.floor(gy / 4) - Math.floor((Math.floor(gy / 100) + 1) * 3 / 4) - 150;
  const march = 20 + leapJ - leapG;
  const doy = (jm - 1) * 31 - Math.floor(jm / 7) * (jm - 7);
  const date = new Date(Date.UTC(gy, 2, march));
  const g = new Date(date.getTime() + doy * 86400000);
  // Tehran midnight
  return new Date(Date.UTC(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate()) - 210 * 60000);
}

function isoOfJalali(jy: number, jm: number, jd: number): string {
  const first = jalaliFirst(jy, jm);
  const g = new Date(first.getTime() + (jd - 1) * 86400000 + 12 * 3600000);
  return new Date(g.getTime() + 210 * 60000).toISOString().slice(0, 10);
}

function gregorianDayOf(iso: string): number {
  return Number(iso.slice(8, 10));
}

function gregorianMonthLabel(jy: number, jm: number): string {
  const first = jalaliFirst(jy, jm);
  const d = new Date(first.getTime() + 12 * 3600000);
  return new Intl.DateTimeFormat("fa-IR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

function faStrDigits(text: string): string {
  return text.replace(/[0-9]/g, (ch) => "۰۱۲۳۴۵۶۷۸۹"[Number(ch)]);
}

function dayLabel(iso: string, mode: "jalali" | "gregorian"): string {
  const d = new Date(iso + "T12:00:00Z");
  if (mode === "jalali") {
    return formatJalali(d, { monthName: true });
  }
  return new Intl.DateTimeFormat("fa-IR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

function dayDelta(current: string, delta: number): string {
  const d = new Date(current + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
