"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, DoorOpen, Hourglass, Users, XCircle, Check, X, MessageQuestion } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, StatCard, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badges";
import { cn, faNum, faStr, formatJalali, isoDateInTz } from "@/lib";
import { J_MONTHS, J_WEEKDAYS_LONG, jalaliPartsInTz } from "@/lib/jalali";
import { StaggerList, StaggerItem } from "@/components/ui/motion";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";

interface DashboardData {
  todayCount: number;
  activeNow: number;
  pendingApprovals: number;
  rooms: { total: number; occupied: number };
  cancelledThisWeek: number;
  weekSeries: { date: string; hours: number; count: number }[];
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
  pendingRsvp: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    organizer: { fullName: string } | null;
    room: { name: string } | null;
    isMasked?: boolean;
  }[];
  seeAll: boolean;
}

export function DashboardPage() {
  const { can } = useAuth();
  const canCreateMeeting = can("meeting:create");
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

  const weekCount = data.weekSeries.reduce((a, b) => a + (b.count ?? 0), 0);
  const maxCount = Math.max(1, ...data.weekSeries.map((d) => d.count));
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
          <StatCard label="جلسات این هفته" value={faNum(weekCount)} icon={<Users className="h-5 w-5" />} />
        </StaggerItem>
      </StaggerList>

      {/* دعوت‌های در انتظار پاسخ — اول صبح همین‌جا جواب بده */}
      {data.pendingRsvp.length > 0 && (
        <PendingRsvpCard invites={data.pendingRsvp} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Weekly chart */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="جلسات — ۷ روز آینده"
            subtitle={
              weekCount > 0
                ? `مجموع ${faNum(weekCount)} جلسه در ${faNum(data.weekSeries.filter((d) => d.count > 0).length)} روز`
                : "جلسه‌ای در این بازه ثبت نشده"
            }
          />
          <CardBody className="space-y-2.5">
            {data.weekSeries.map((d) => {
              const isToday = d.date === todayIso;
              const { weekday, date } = dayLabel(d.date);
              const barPct = d.count > 0 ? Math.max(6, (d.count / maxCount) * 100) : 0;
              return (
                <Tooltip key={d.date} content={`${weekday} ${date} — ${faNum(d.count)} جلسه`}>
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
                        d.count > 0 ? "text-ink" : "text-ink-faint",
                      )}
                    >
                      {d.count > 0 ? `${faNum(d.count)} جلسه` : "بدون جلسه"}
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-line/50">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        d.count > 0 ? "bg-ink" : "bg-line/30",
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
                    href={canCreateMeeting ? "/meetings/new" : "/meeting-requests"}
                    className="mt-1 inline-flex h-10 items-center rounded-md bg-ink px-4 text-[12px] font-medium text-white"
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

function PendingRsvpCard({ invites }: { invites: DashboardData["pendingRsvp"] }) {
  const qc = useQueryClient();
  const { push } = useToast();
  const respond = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACCEPTED" | "DECLINED" | "TENTATIVE" }) =>
      api(`/api/meetings/${id}/participants/respond`, { method: "POST", json: { responseStatus: status } }),
    onSuccess: (_d, v) => {
      push(
        v.status === "ACCEPTED" ? "حضور شما ثبت شد" : v.status === "DECLINED" ? "عدم حضور شما ثبت شد" : "شاید — ثبت شد",
        "success",
      );
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e) => push((e as Error).message || "ثبت پاسخ ناموفق بود", "error"),
  });

  return (
    <Card className="ring-1 ring-amber-100">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <MessageQuestion className="h-4 w-4 text-amber-500" />
            دعوت‌های در انتظار پاسخ شما
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">
              {faNum(invites.length)}
            </span>
          </span>
        }
        subtitle="به جلسه‌های زیر دعوت شده‌اید و هنوز پاسخ نداده‌اید"
      />
      <div className="divide-y divide-line">
        {invites.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <Link href={`/meetings/${m.id}`} className="truncate text-[13px] font-medium hover:underline">
                {m.isMasked ? "🔒 جلسه محرمانه" : m.title}
              </Link>
              <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                {formatJalali(new Date(m.startAt), { withTime: true, monthName: true })}
                {m.room ? ` · ${m.room.name}` : ""}
                {m.organizer ? ` · برگزارکننده: ${m.organizer.fullName}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                loading={respond.isPending && respond.variables?.id === m.id && respond.variables?.status === "ACCEPTED"}
                onClick={() => respond.mutate({ id: m.id, status: "ACCEPTED" })}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" />
                می‌آیم
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={respond.isPending && respond.variables?.id === m.id && respond.variables?.status === "TENTATIVE"}
                onClick={() => respond.mutate({ id: m.id, status: "TENTATIVE" })}
              >
                <Hourglass className="h-4 w-4" />
                شاید
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={respond.isPending && respond.variables?.id === m.id && respond.variables?.status === "DECLINED"}
                onClick={() => respond.mutate({ id: m.id, status: "DECLINED" })}
                className="text-red-600 hover:border-red-300 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
                نمی‌آیم
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
