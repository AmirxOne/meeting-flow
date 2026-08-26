"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, CalendarX2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { StaggerList, StaggerItem } from "@/components/ui/motion";
import { cn, faNum, formatJalali, STATUS_FA } from "@/lib";
import { useAuth } from "@/lib/auth-store";

interface MeetingRow {
  id: string;
  title: string;
  status: string;
  meetingType: string;
  startAt: string;
  endAt: string;
  isPrivate: boolean;
  organizer: { id: string; fullName: string };
  room: { id: string; name: string } | null;
  branch: { id: string; name: string };
  _count: { participants: number; guests: number };
}

const STATUS_FILTERS = [
  { key: "", label: "همه" },
  { key: "PENDING_APPROVAL", label: STATUS_FA.PENDING_APPROVAL },
  { key: "CONFIRMED", label: STATUS_FA.CONFIRMED },
  { key: "IN_PROGRESS", label: STATUS_FA.IN_PROGRESS },
  { key: "COMPLETED", label: STATUS_FA.COMPLETED },
  { key: "CANCELLED", label: STATUS_FA.CANCELLED },
];

export default function MeetingsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["meetings", status, scope, q],
    queryFn: () =>
      api<{ meetings: MeetingRow[] }>(
        `/api/meetings?status=${status}&scope=${scope}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      ),
  });

  const meetings = data?.meetings ?? [];

  // status counts across the CURRENT result set (for filter chips)
  const statusCounts = new Map<string, number>();
  for (const m of meetings) statusCounts.set(m.status, (statusCounts.get(m.status) ?? 0) + 1);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">جلسات</h1>
        {can("meeting:create") && (
          <Link href="/meetings/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              جلسه جدید
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <FilterBar
        groups={[
          ...(can("meeting:view-all")
            ? [{
                key: "scope",
                options: [
                  { value: "all", label: "کل شرکت" },
                  { value: "mine", label: "جلسات من" },
                ],
              }]
            : []),
          {
            key: "status",
            label: "وضعیت",
            options: STATUS_FILTERS.map((f) => ({
              value: f.key,
              label: f.label,
              count: f.key === "" ? meetings.length : statusCounts.get(f.key) ?? 0,
            })),
          },
          // پیش‌فرض: همه (اولین آپشن با value="")
        ]}
        value={{ scope, status }}
        onChange={(v) => {
          if (v.scope !== scope) setScope(v.scope as "all" | "mine");
          setStatus(v.status);
        }}
      >
        <div className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-white px-3 sm:max-w-64">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی عنوان…"
            className="w-full bg-transparent text-[12px] outline-none"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-ink-faint hover:text-ink" aria-label="پاک کردن">
              ✕
            </button>
          )}
        </div>
      </FilterBar>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {/* filter bar skeleton */}
          <div className="rounded-lg border border-line bg-paper-soft/40 px-4 py-3">
            <div className="skeleton mb-3 h-4 w-16" />
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-7 w-24 rounded-md" />
              ))}
              <div className="skeleton ml-auto h-9 w-56 rounded-md" />
            </div>
          </div>
          {/* meeting cards skeleton — mirrors real card anatomy */}
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-2">
                <div className="skeleton h-4.5 w-44" />
                <div className="skeleton h-5 w-20 rounded-full" />
                <div className="skeleton h-5 w-14 rounded-full" />
              </div>
              <div className="mt-2.5 flex items-center gap-4">
                <div className="skeleton h-3 w-40" />
                <div className="skeleton h-3 w-24" />
                <div className="skeleton mr-auto h-3 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarX2 className="h-10 w-10" />}
            title="جلسه‌ای یافت نشد"
            description="با تغییر فیلترها جستجو کنید یا جلسه جدیدی بسازید"
            action={
              <Link href="/meetings/new">
                <Button size="sm">ایجاد جلسه</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <StaggerList className="flex flex-col gap-3">
          {meetings.map((m) => (
            <StaggerItem key={m.id}>
            <Link href={`/meetings/${m.id}`}>
              <Card className="p-4 transition-colors hover:border-ink-faint">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-medium">{m.title}</p>
                  <StatusBadge status={m.status} />
                  <TypeBadge type={m.meetingType} />
                  {m.isPrivate && <span className="badge badge-gray">خصوصی</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-soft">
                  <span>{formatJalali(new Date(m.startAt), { withTime: true })}</span>
                  {m.room && <span>· {m.room.name}</span>}
                  <span>· {m.branch.name}</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {faNum(m._count.participants)}
                    {m._count.guests > 0 && ` + ${faNum(m._count.guests)} مهمان`}
                  </span>
                  <span className="mr-auto text-ink-faint">{m.organizer.fullName}</span>
                </div>
              </Card>
            </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
