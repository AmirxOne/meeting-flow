"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { cn, faNum, faStr, STATUS_FA, TYPE_FA } from "@/lib";
import { Select } from "@/components/ui/select";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { FilterBar } from "@/components/ui/filter-bar";

interface Summary {
  totalMeetings: number;
  totalHours: number;
  avgDurationMin: number;
  cancelledCount: number;
  cancellationRate: number;
  noShowRate: number;
  externalCount: number;
  completedCount: number;
  peakHour: number | null;
  meetingsByDay: { date: string; count: number; hours: number }[];
  roomUtilization: { roomId: string; roomName: string; branchName: string; hours: number; utilization: number; meetings: number }[];
  byBranch: { branchId: string; branchName: string; meetings: number; hours: number }[];
  byType: { type: string; count: number }[];
  hourlyHistogram: { hour: number; count: number }[];
}

export default function ReportsPage() {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86400000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [rangePreset, setRangePreset] = useState("30");

  const query = new URLSearchParams({
    from, to,
    ...(status ? { status } : {}),
    ...(type ? { meetingType: type } : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["reports", from, to, status, type],
    queryFn: () => api<{ summary: Summary }>(`/api/reports?${query.toString()}`),
  });

  const s = data?.summary;
  const maxHourly = Math.max(1, ...(s?.hourlyHistogram.map((h) => h.count) ?? [1]));

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <BarChart3 className="h-5 w-5" />
          گزارش‌ها
        </h1>
        <a href={`/api/reports?${query.toString()}&format=csv`} download>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[12px] font-medium hover:bg-paper-soft">
            <Download className="h-4 w-4" />
            خروجی CSV
          </button>
        </a>
      </div>

      {/* Filters */}
      <FilterBar
        groups={[
          {
            key: "range",
            label: "بازه",
            options: [
              { value: "7", label: "۷ روز" },
              { value: "30", label: "۳۰ روز" },
              { value: "90", label: "۳ ماه" },
              { value: "", label: "دلخواه" },
            ],
          },
          {
            key: "status",
            label: "وضعیت",
            options: [{ value: "", label: "همه" }, ...Object.entries(STATUS_FA).map(([value, label]) => ({ value, label }))],
          },
          {
            key: "type",
            label: "نوع",
            options: [{ value: "", label: "همه" }, ...Object.entries(TYPE_FA).map(([value, label]) => ({ value, label }))],
          },
        ]}
        value={{ range: rangePreset, status, type }}
        onChange={(v) => {
          setRangePreset(v.range);
          setStatus(v.status);
          setType(v.type);
          if (v.range) {
            const days = Number(v.range);
            const nowIso = new Date().toISOString().slice(0, 10);
            const fromIso = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
            setFrom(fromIso);
            setTo(nowIso);
          }
        }}
      >
        <div className="flex items-center gap-2">
          <JalaliDatePicker
            value={from}
            onChange={setFrom}
            placeholder="از تاریخ"
            className="w-40 [&>button]:h-9 [&>button]:text-[12px]"
          />
          <span className="text-[11px] text-ink-faint">تا</span>
          <JalaliDatePicker
            value={to}
            onChange={setTo}
            placeholder="تا تاریخ"
            className="w-40 [&>button]:h-9 [&>button]:text-[12px]"
          />
        </div>
      </FilterBar>

      {isLoading || !s ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="p-4">
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="mt-2 h-6 w-16" />
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <div className="border-b border-line px-5 py-4">
                  <SkeletonBlock className="h-4 w-36" />
                </div>
                <div className="p-5">
                  {i < 2 ? (
                    <div className="flex h-40 items-end gap-1" dir="rtl">
                      {Array.from({ length: 12 }).map((_, j) => (
                        <SkeletonBlock
                          key={j}
                          className="flex-1 rounded-t"
                          style={{ height: `${25 + ((j * 29 + i * 13) % 65)}%` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <div key={j} className="flex items-center justify-between">
                          <SkeletonBlock className="h-3.5 w-32" />
                          <SkeletonBlock className="h-3.5 w-20" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : s && s.totalMeetings === 0 ? (
        <Card>
          <EmptyState
            title="در این بازه جلسه‌ای نبوده است"
            description="بازه زمانی یا فیلترها را تغییر دهید — مثلاً بازه ۳۰ روز اخیر را امتحان کنید"
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="کل جلسات" value={faNum(s.totalMeetings)} />
            <Metric label="کل ساعت‌ها" value={faStr(s.totalHours.toFixed(1))} />
            <Metric label="میانگین مدت" value={`${faNum(s.avgDurationMin)} دقیقه`} />
            <Metric label="نرخ لغو" value={`٪${faNum(s.cancellationRate)}`} tone={s.cancellationRate > 15 ? "danger" : "default"} />
            <Metric label="نرخ غیبت" value={`٪${faNum(s.noShowRate)}`} tone={s.noShowRate > 10 ? "danger" : "default"} />
            <Metric label="جلسات خارجی" value={faNum(s.externalCount)} />
            <Metric label="تکمیل‌شده" value={faNum(s.completedCount)} />
            <Metric label="ساعت پیک" value={s.peakHour !== null ? faStr(String(s.peakHour).padStart(2, "0")) + ":۰۰" : "—"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Hourly histogram */}
            <Card>
              <CardHeader title="ساعت‌های پرتقاضا" subtitle="توزیع شروع جلسات در ساعات روز" />
              <CardBody>
                <div className="flex h-40 items-end gap-1" dir="rtl">
                  {s.hourlyHistogram.map((h) => (
                    <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-ink"
                        style={{ height: `${(h.count / maxHourly) * 100}%`, minHeight: h.count ? 4 : 1 }}
                      />
                      <span className="text-[8px] text-ink-faint">{faStr(String(h.hour).padStart(2, "0"))}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Room utilization */}
            <Card>
              <CardHeader title="بهره‌وری اتاق‌ها" subtitle="درصد اشغال در ساعات کاری" />
              <CardBody className="space-y-3">
                {s.roomUtilization.map((r) => (
                  <div key={r.roomId}>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-medium">
                        {r.roomName}
                        <span className="mr-1.5 text-[10px] text-ink-faint">({r.branchName})</span>
                      </span>
                      <span className="text-ink-soft">
                        {faStr(r.hours.toFixed(1))} ساعت · ٪{faNum(r.utilization)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-paper-soft">
                      <div className="h-1.5 rounded-full bg-ink" style={{ width: `${r.utilization}%` }} />
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            {/* By branch */}
            <Card>
              <CardHeader title="جلسات به تفکیک شعبه" />
              <CardBody>
                {s.byBranch.map((b) => (
                  <div key={b.branchId} className="flex items-center justify-between border-b border-line py-2.5 text-[13px] last:border-0">
                    <span>{b.branchName}</span>
                    <span className="text-ink-soft">
                      {faNum(b.meetings)} جلسه · {faStr(b.hours.toFixed(1))} ساعت
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>

            {/* By type */}
            <Card>
              <CardHeader title="جلسات به تفکیک نوع" />
              <CardBody>
                {s.byType.map((t) => (
                  <div key={t.type} className="flex items-center justify-between border-b border-line py-2.5 text-[13px] last:border-0">
                    <span>{TYPE_FA[t.type] ?? t.type}</span>
                    <span className="text-ink-soft">{faNum(t.count)} جلسه</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "danger" | "default" }) {
  return (
    <Card className={cn("p-4", tone === "danger" && "text-red-600")}>
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </Card>
  );
}
