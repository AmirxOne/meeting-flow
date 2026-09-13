"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock, Users, BarChart3, CalendarClock, UserRound, DoorOpen } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badges";
import { faNum, formatJalali, cn } from "@/lib";

type Me = {
  summary: {
    totalMeetings: number;
    organized: number;
    participated: number;
    totalHours: number;
    avgMinutes: number;
    completed: number;
    noShow: number;
  };
  topPeople: { name: string; count: number; minutes: number }[];
  series: { month: string; hours: number }[];
  types: { type: string; count: number; color: string }[];
  meetings: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    isPrivate: boolean;
    organizer: string;
    role: "ORGANIZER" | "PARTICIPANT";
    participants: string[];
    guests: string[];
    room: string | null;
  }[];
};

const TYPE_FA: Record<string, string> = {
  INTERNAL: "داخلی",
  EXTERNAL: "بیرونی",
  CROSS_TEAM: "بین‌تیمی",
};

/** Personal report — «گزارش من»: my meetings, hours, top companions, topics. */
export function MyReportsClient() {
  const [months, setMonths] = useState("6");
  const { data, isLoading } = useQuery({
    queryKey: ["reports-me", months],
    queryFn: () => api<{ data: Me } | Me>(`/api/reports/me?months=${months}`),
  });
  const me = (data as unknown as { data?: Me })?.data ?? (data as unknown as Me);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold">گزارش من</h1>
          <p className="mt-1 text-[12px] text-ink-soft">
            آمار جلسات شما — چه برگزار کرده‌اید، با چه کسانی و چند ساعت
          </p>
        </div>
        <div className="w-40">
          <Select
            value={months}
            onChange={(v) => setMonths(v)}
            options={[
              { value: "1", label: "ماه گذشته" },
              { value: "3", label: "۳ ماه اخیر" },
              { value: "6", label: "۶ ماه اخیر" },
              { value: "12", label: "یک سال اخیر" },
            ]}
          />
        </div>
      </div>

      {isLoading || !me ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          {/* stat cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={<Clock className="h-4 w-4" />} label="مجموع ساعت جلسات" value={`${faNum(me.summary.totalHours)} ساعت`} />
            <StatCard icon={<CalendarClock className="h-4 w-4" />} label="کل جلسات" value={faNum(me.summary.totalMeetings)} sub={`${faNum(me.summary.organized)} برگزارکرده · ${faNum(me.summary.participated)} مهمان`} />
            <StatCard icon={<BarChart3 className="h-4 w-4" />} label="میانگین مدت هر جلسه" value={`${faNum(me.summary.avgMinutes)} دقیقه`} />
            <StatCard icon={<UserRound className="h-4 w-4" />} label="برگزار شده / عدم حضور" value={`${faNum(me.summary.completed)} / ${faNum(me.summary.noShow)}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* monthly hours chart */}
            <Card>
              <CardHeader title="ساعت جلسات ماهانه" />
              <CardBody>
                {me.series.length === 0 ? (
                  <EmptyState title="داده‌ای نیست" description="در این بازه جلسه‌ای ثبت نشده" />
                ) : (
                  <MonthlyBars series={me.series} />
                )}
              </CardBody>
            </Card>

            {/* top companions */}
            <Card>
              <CardHeader title="بیشترین جلسات با…" />
              <CardBody>
                {me.topPeople.length === 0 ? (
                  <EmptyState title="همکار جلسه‌ای ندارید" description="هنوز با کسی جلسه مشترک نداشته‌اید" />
                ) : (
                  <div className="space-y-2.5">
                    {me.topPeople.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            i === 0 ? "bg-ink text-white" : "bg-paper-soft text-ink-soft",
                          )}
                        >
                          {faNum(i + 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-[13px] font-medium">{p.name}</p>
                            <p className="shrink-0 text-[11px] text-ink-faint">
                              {faNum(p.count)} جلسه · {faNum(Math.round((p.minutes / 60) * 10) / 10)} ساعت
                            </p>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-soft">
                            <div
                              className="h-full rounded-full bg-ink"
                              style={{ width: `${Math.round((p.count / me.topPeople[0].count) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* meeting types */}
            <Card>
              <CardHeader title="نوع جلسات" />
              <CardBody>
                {me.types.length === 0 ? (
                  <p className="text-[12px] text-ink-faint">—</p>
                ) : (
                  <div className="space-y-2">
                    {me.types.map((t) => (
                      <div key={t.type} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                          {TYPE_FA[t.type] ?? t.type}
                        </span>
                        <span className="text-ink-faint">{faNum(t.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* recurring topics */}
            <Card className="lg:col-span-2">
              <CardHeader title="موضوعات پرتکرار شما" />
              <CardBody>
                {(() => {
                  const topics = (me as unknown as { topics?: { title: string; count: number }[] }).topics ?? [];
                  if (topics.length === 0)
                    return <p className="text-[12px] text-ink-faint">موضوع تکراری ندارید</p>;
                  return (
                    <div className="flex flex-wrap gap-2">
                      {topics.map((t) => (
                        <span
                          key={t.title}
                          className="rounded-full border border-line bg-paper-soft px-3 py-1.5 text-[12px]"
                        >
                          {t.title} <span className="text-ink-faint">×{faNum(t.count)}</span>
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </CardBody>
            </Card>
          </div>

          {/* meetings list */}
          <Card>
            <CardHeader title={`آخرین جلسات (${faNum(Math.min(meetingsCount(me), 50))})`} />
            <CardBody>
              {me.meetings.length === 0 ? (
                <EmptyState title="جلسه‌ای ثبت نشده" description="با ثبت اولین جلسه، گزارش شما این‌جا شکل می‌گیرد" />
              ) : (
                <div className="divide-y divide-line">
                  {me.meetings.map((m) => {
                    const mins = Math.round((new Date(m.endAt).getTime() - new Date(m.startAt).getTime()) / 60000);
                    return (
                      <Link
                        key={m.id}
                        href={`/meetings/${m.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 py-3 transition-colors hover:bg-paper-soft/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                            {m.isPrivate && "🔒"}
                            {m.title}
                            {m.role === "ORGANIZER" && (
                              <span className="rounded bg-paper-soft px-1.5 py-0.5 text-[10px] text-ink-faint">برگزارکننده</span>
                            )}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-faint">
                            <span>{formatJalali(new Date(m.startAt), { withTime: true })}</span>
                            <span>· {faNum(mins)} دقیقه</span>
                            {m.room && (
                              <span className="flex items-center gap-0.5">
                                <DoorOpen className="h-3 w-3" /> {m.room}
                              </span>
                            )}
                            {m.participants.length + m.guests.length > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Users className="h-3 w-3" />
                                {faNum(m.participants.length + m.guests.length)} نفر
                              </span>
                            )}
                          </p>
                        </div>
                        <StatusBadge status={m.status} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function meetingsCount(me: Me) {
  return me.meetings.length;
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-ink-faint">
        {icon}
        <p className="text-[11px]">{label}</p>
      </div>
      <p className="mt-2 text-[20px] font-bold leading-7">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-faint">{sub}</p>}
    </Card>
  );
}

/** Simple horizontal-safe vertical bar chart (CSS only). */
function MonthlyBars({ series }: { series: { month: string; hours: number }[] }) {
  const max = Math.max(...series.map((s) => s.hours), 1);
  return (
    <div dir="rtl" className="flex h-40 items-end gap-2" role="img" aria-label="نمودار ساعت جلسات ماهانه">
      {series.map((s) => (
        <div key={s.month} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] font-medium text-ink-soft">{faNum(s.hours)}</span>
          <div
            className="w-full rounded-t-md bg-ink/85 transition-all"
            style={{ height: `${Math.max((s.hours / max) * 100, 4)}%` }}
            title={`${s.month}: ${s.hours}h`}
          />
          <span className="text-[9px] text-ink-faint">{faNum(s.month.slice(5))}</span>
        </div>
      ))}
    </div>
  );
}
