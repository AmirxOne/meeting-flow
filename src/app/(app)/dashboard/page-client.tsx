"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, DoorOpen, Hourglass, Users, XCircle } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, StatCard, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badges";
import { cn, faNum, faStr, formatJalali, isoDateInTz } from "@/lib";
import { J_MONTHS, J_WEEKDAYS_LONG, jalaliPartsInTz } from "@/lib/jalali";
import { StaggerList, StaggerItem } from "@/components/ui/motion";
import { Tooltip } from "@/components/ui/tooltip";

interface DashboardData {
  todayCount: number;
  activeNow: number;
  pendingApprovals: number;
  rooms: { total: number; occupied: number };
  cancelledThisWeek: number;
  weekSeries: { date: string; hours: number }[];
  upcoming: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    organizer: { fullName: string };
    room: { name: string } | null;
    branch: { name: string };
    isPrivate?: boolean;
    isMasked?: boolean;
  }[];
  seeAll: boolean;
}

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<DashboardData>("/api/dashboard"),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        {/* header — mirrors title + date */}
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-7 w-28" />
          <SkeletonBlock className="h-5 w-40" />
        </div>
        {/* stats — mirrors 6 StatCards (label + big number + hint) */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <SkeletonBlock className="h-3.5 w-20" />
              <SkeletonBlock className="mt-2 h-7 w-14" />
            </Card>
          ))}
        </div>
        {/* charts — mirrors weekly chart card + upcoming list card (2:1) */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="border-b border-line px-5 py-4">
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="mt-1 h-3 w-24" />
            </div>
            <div className="space-y-2.5 p-5" dir="rtl" role="img" aria-label="نمودار ساعات جلسات هفتگی">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="rounded-lg p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <SkeletonBlock className="h-4 w-28" />
                    <SkeletonBlock className="h-4 w-14" />
                  </div>
                  <SkeletonBlock className="h-2.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="border-b border-line px-5 py-4">
              <SkeletonBlock className="h-4 w-24" />
            </div>
            <div className="divide-y divide-line">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2 px-5 py-3.5">
                  <SkeletonBlock className="h-4 w-3/4" />
                  <SkeletonBlock className="h-3 w-1/2" />
                  <SkeletonBlock className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center text-[13px] text-red-600">
          خطا در بارگذاری داشبورد — دوباره تلاش کنید
        </Card>
      </div>
    );
  }

  const weekTotal = data.weekSeries.reduce((a, b) => a + b.hours, 0);
  const maxHours = Math.max(1, ...data.weekSeries.map((d) => d.hours));
  const todayIso = isoDateInTz(new Date(), "Asia/Tehran");

  function dayLabel(iso: string) {
    const d = new Date(`${iso}T12:00:00+03:30`);
    const j = jalaliPartsInTz(d, "Asia/Tehran");
    const weekday = J_WEEKDAYS_LONG[(d.getDay() + 1) % 7];
    return { weekday, date: `${faNum(j.jd)} ${J_MONTHS[j.jm - 1]}` };
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">داشبورد</h1>
        <div className="text-[12px] text-ink-soft">{formatJalali(new Date(), { withTime: false, monthName: true })}</div>
      </div>

      {/* Stats */}
      <StaggerList className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StaggerItem>
          <StatCard label="جلسات امروز" value={faNum(data.todayCount)} icon={<CalendarDays className="h-5 w-5" />} />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="در حال برگزاری"
            value={faNum(data.activeNow)}
            tone={data.activeNow > 0 ? "success" : "default"}
            icon={<Clock className="h-5 w-5" />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="در انتظار تأیید"
            value={faNum(data.pendingApprovals)}
            tone={data.pendingApprovals > 0 ? "warn" : "default"}
            icon={<Hourglass className="h-5 w-5" />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="اتاق آزاد / کل"
            value={`${faNum(data.rooms.total - data.rooms.occupied)} / ${faNum(data.rooms.total)}`}
            icon={<DoorOpen className="h-5 w-5" />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="لغو این هفته" value={faNum(data.cancelledThisWeek)} tone={data.cancelledThisWeek > 0 ? "danger" : "default"} icon={<XCircle className="h-5 w-5" />} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="ساعت جلسات هفته" value={faNum(weekTotal)} icon={<Users className="h-5 w-5" />} />
        </StaggerItem>
      </StaggerList>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Weekly chart */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="ساعات جلسات — ۷ روز آینده"
            subtitle={
              weekTotal > 0
                ? `مجموع ${faStr(weekTotal.toFixed(1))} ساعت در ${faNum(data.weekSeries.filter((d) => d.hours > 0).length)} روز`
                : "جلسه‌ای در این بازه ثبت نشده"
            }
          />
          <CardBody className="space-y-2.5">
            {data.weekSeries.map((d) => {
              const isToday = d.date === todayIso;
              const { weekday, date } = dayLabel(d.date);
              const barPct = d.hours > 0 ? Math.max(6, (d.hours / maxHours) * 100) : 0;
              return (
                <Tooltip key={d.date} content={`${weekday} ${date} — ${faStr(d.hours.toFixed(1))} ساعت`}>
                <div
                  className={cn(
                    "rounded-lg px-3 py-2.5 transition-colors sm:px-4 sm:py-3",
                    isToday ? "bg-paper-soft ring-1 ring-line" : "hover:bg-paper-soft/50",
                  )}
                >
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={cn("text-[13px] font-semibold", isToday ? "text-ink" : "text-ink-soft")}>
                        {weekday}
                      </span>
                      <span className="text-[11px] text-ink-faint">{date}</span>
                      {isToday && (
                        <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-white">
                          امروز
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-[13px] font-bold tabular-nums",
                        d.hours > 0 ? "text-ink" : "text-ink-faint",
                      )}
                    >
                      {d.hours > 0 ? `${faStr(d.hours.toFixed(1))} ساعت` : "بدون جلسه"}
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-line/50">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        d.hours > 0 ? "bg-ink" : "bg-line/30",
                      )}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
                </Tooltip>
              );
            })}
          </CardBody>
        </Card>

        {/* Upcoming */}
        <Card>
          <CardHeader
            title="جلسات پیش رو"
            action={
              <Link href="/meetings" className="text-[12px] text-ink-soft hover:text-ink">
                همه ←
              </Link>
            }
          />
          <div className="divide-y divide-line">
            {data.upcoming.length === 0 && (
              <EmptyState
                title="جلسه‌ای در پیش نیست"
                action={
                  <Link
                    href="/meetings/new"
                    className="mt-1 inline-flex h-9 items-center rounded-md bg-ink px-4 text-[12px] font-medium text-white"
                  >
                    ایجاد جلسه
                  </Link>
                }
              />
            )}
            {data.upcoming.map((m) => (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="block px-5 py-3.5 transition-colors hover:bg-paper-soft"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] font-medium">{m.isMasked ? "🔒 جلسه محرمانه" : m.title}</p>
                  <StatusBadge status={m.status} />
                </div>
                <p className="mt-1 flex items-center gap-2 text-[11px] text-ink-soft">
                  <span>{formatJalali(new Date(m.startAt), { withTime: true })}</span>
                  {m.room && <span>· {m.room.name}</span>}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-faint">{m.organizer.fullName}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
