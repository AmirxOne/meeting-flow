"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, DoorOpen, Hourglass, Users, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, StatCard, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badges";
import { faNum, faStr, formatJalali } from "@/lib";

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
  }[];
  seeAll: boolean;
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<DashboardData>("/api/dashboard"),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <SkeletonBlock className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
        <SkeletonBlock className="h-64" />
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

  const maxHours = Math.max(1, ...data.weekSeries.map((d) => d.hours));

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">داشبورد</h1>
        <div className="text-[12px] text-ink-soft">{formatJalali(new Date(), { withTime: false, monthName: true })}</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="جلسات امروز" value={faNum(data.todayCount)} icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard
          label="در حال برگزاری"
          value={faNum(data.activeNow)}
          tone={data.activeNow > 0 ? "success" : "default"}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="در انتظار تأیید"
          value={faNum(data.pendingApprovals)}
          tone={data.pendingApprovals > 0 ? "warn" : "default"}
          icon={<Hourglass className="h-5 w-5" />}
        />
        <StatCard
          label="اتاق آزاد / کل"
          value={`${faNum(data.rooms.total - data.rooms.occupied)} / ${faNum(data.rooms.total)}`}
          icon={<DoorOpen className="h-5 w-5" />}
        />
        <StatCard label="لغو این هفته" value={faNum(data.cancelledThisWeek)} tone={data.cancelledThisWeek > 0 ? "danger" : "default"} icon={<XCircle className="h-5 w-5" />} />
        <StatCard label="ساعت جلسات هفته" value={faNum(data.weekSeries.reduce((a, b) => a + b.hours, 0))} icon={<Users className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Weekly chart */}
        <Card className="lg:col-span-2">
          <CardHeader title="ساعات جلسات هفته جاری" subtitle="بر اساس روز" />
          <CardBody>
            {data.weekSeries.length === 0 ? (
              <EmptyState title="جلسه‌ای در این هفته ثبت نشده" />
            ) : (
              <div className="flex h-48 items-end justify-between gap-2" dir="rtl">
                {data.weekSeries.map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[10px] text-ink-soft">{faStr(d.hours.toFixed(1))}</span>
                    <div
                      className="w-full rounded-t-lg bg-ink transition-all"
                      style={{ height: `${Math.max(4, (d.hours / maxHours) * 100)}%` }}
                    />
                    <span className="text-[10px] text-ink-faint">
                      {formatJalali(new Date(d.date + "T12:00:00+03:30")).slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                    className="mt-1 inline-flex h-9 items-center rounded-xl bg-ink px-4 text-[12px] font-medium text-white"
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
                  <p className="truncate text-[13px] font-medium">{m.title}</p>
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
