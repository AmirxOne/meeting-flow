"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { cn, faNum, faStr, STATUS_FA, TYPE_FA } from "@/lib";
import { Select } from "@/components/ui/select";

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
  const [meetingType, setMeetingType] = useState("");

  const query = new URLSearchParams({ from, to, ...(status ? { status } : {}), ...(meetingType ? { meetingType } : {}) });

  const { data, isLoading } = useQuery({
    queryKey: ["reports", from, to, status, meetingType],
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
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">از تاریخ</label>
            <input
              type="date"
              dir="ltr"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">تا تاریخ</label>
            <input
              type="date"
              dir="ltr"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">وضعیت</label>
            <Select
              value={status}
              onChange={setStatus}
              placeholder="همه"
              options={Object.entries(STATUS_FA).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">نوع جلسه</label>
            <Select
              value={meetingType}
              onChange={setMeetingType}
              placeholder="همه"
              options={Object.entries(TYPE_FA).map(([value, label]) => ({ value, label }))}
            />
          </div>
        </div>
      </Card>

      {isLoading || !s ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
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
