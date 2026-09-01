"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, CalendarX2, Users } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, EmptyState } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { StaggerList, StaggerItem } from "@/components/ui/motion";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, faNum, formatJalali, STATUS_FA } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { meetingPeriodRange, type MeetingPeriod } from "@/lib/meeting-period";
import { useCompactViewport } from "@/lib/use-compact-viewport";
import { MeetingRsvpBar } from "@/components/meetings/meeting-rsvp";

interface MeetingRow {
  id: string;
  title: string;
  status: string;
  meetingType: string;
  startAt: string;
  endAt: string;
  isPrivate: boolean;
  organizer: { id: string; fullName: string };
  isMasked?: boolean;
  seriesId?: string | null;
  room: { id: string; name: string } | null;
  branch: { id: string; name: string };
  _count: { participants: number; guests: number };
  myResponseStatus?: string | null;
}

const STATUS_FILTERS = [
  { key: "", label: "همه" },
  { key: "PENDING_APPROVAL", label: STATUS_FA.PENDING_APPROVAL },
  { key: "CONFIRMED", label: STATUS_FA.CONFIRMED },
  { key: "IN_PROGRESS", label: STATUS_FA.IN_PROGRESS },
  { key: "COMPLETED", label: STATUS_FA.COMPLETED },
  { key: "WAITLISTED", label: STATUS_FA.WAITLISTED },
  { key: "CANCELLED", label: STATUS_FA.CANCELLED },
];

const PERIODS: { key: MeetingPeriod; label: string }[] = [
  { key: "today", label: "امروز" },
  { key: "week", label: "این هفته" },
];

export function MeetingsPage() {
  const { can } = useAuth();
  const compact = useCompactViewport();
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<MeetingPeriod>("today");

  const isCompact = compact === true;
  const effectiveScope = isCompact ? "mine" : scope;
  const range = isCompact ? meetingPeriodRange(period) : null;

  const { data, isLoading } = useQuery({
    queryKey: ["meetings", status, effectiveScope, q, range?.from, range?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      params.set("scope", effectiveScope);
      if (q) params.set("q", q);
      if (range) {
        params.set("from", range.from);
        params.set("to", range.to);
      }
      return api<{ meetings: MeetingRow[] }>(`/api/meetings?${params.toString()}`);
    },
    enabled: compact !== null,
  });

  const meetings = data?.meetings ?? [];

  const statusCounts = new Map<string, number>();
  for (const m of meetings) statusCounts.set(m.status, (statusCounts.get(m.status) ?? 0) + 1);

  const heading = isCompact ? "جلسات من" : "جلسات";

  return (
    <div className="min-w-0 space-y-4 overflow-x-clip p-4 lg:p-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-lg font-bold">{heading}</h1>
        {can("meeting:create") && (
          <Link href="/meetings/new" className="shrink-0">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              جلسه جدید
            </Button>
          </Link>
        )}
      </div>

      {isCompact && (
        <div
          data-tour="meetings-period"
          role="tablist"
          aria-label="بازه جلسات"
          className="grid grid-cols-2 gap-1 rounded-lg bg-paper-soft p-1"
        >
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "h-9 min-w-0 rounded-md text-[13px] font-medium transition-colors",
                period === p.key ? "bg-white text-ink shadow-sm" : "text-ink-soft",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <FilterBar
        groups={[
          ...(!isCompact && can("meeting:view-all")
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
        ]}
        value={{ scope, status }}
        onChange={(v) => {
          if (v.scope !== undefined && v.scope !== scope) setScope(v.scope as "all" | "mine");
          setStatus(v.status);
        }}
      >
        <div className="flex h-9 min-w-0 w-full items-center gap-2 rounded-md border border-line bg-white px-3 sm:max-w-64">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی عنوان…"
            className="min-w-0 w-full bg-transparent text-[12px] outline-none"
          />
          {q && (
            <button onClick={() => setQ("")} className="shrink-0 text-ink-faint hover:text-ink" aria-label="پاک کردن">
              ✕
            </button>
          )}
        </div>
      </FilterBar>

      {compact === null || isLoading ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-paper-soft/40 px-4 py-3">
            <div className="skeleton mb-3 h-4 w-16" />
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-7 w-24 rounded-md" />
              ))}
              <div className="skeleton ml-auto h-9 w-56 rounded-md" />
            </div>
          </div>
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
            title={isCompact ? (period === "today" ? "جلسه‌ای برای امروز نیست" : "جلسه‌ای در این هفته نیست") : "جلسه‌ای یافت نشد"}
            description={
              isCompact && period === "today"
                ? "جلسات بقیهٔ هفته را از زبانه «این هفته» ببینید"
                : "با تغییر فیلترها جستجو کنید یا جلسه جدیدی بسازید"
            }
            action={
              isCompact && period === "today" ? (
                <Button size="sm" variant="secondary" onClick={() => setPeriod("week")}>
                  نمایش جلسات هفته
                </Button>
              ) : (
                <Link href="/meetings/new">
                  <Button size="sm">ایجاد جلسه</Button>
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <StaggerList className="flex min-w-0 flex-col gap-3">
          {meetings.map((m) => (
            <StaggerItem key={m.id}>
              <Card className="min-w-0 overflow-hidden p-4 transition-colors hover:border-ink-faint">
                <Link href={`/meetings/${m.id}`} className="block min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="flex min-w-0 items-center gap-1 break-words text-[14px] font-medium">
                      {m.isMasked && (
                        <Tooltip content="جلسه محرمانه">
                          <span>🔒</span>
                        </Tooltip>
                      )}
                      {m.title}
                    </p>
                    <StatusBadge status={m.status} />
                    <TypeBadge type={m.meetingType} />
                    {m.isPrivate && !m.isMasked && <span className="badge badge-gray">محرمانه</span>}
                    {m.seriesId && <span className="badge badge-gray">تکراری</span>}
                  </div>
                  <div className="mt-2 flex min-w-0 flex-col gap-1 text-[12px] text-ink-soft sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
                    <span className="min-w-0 truncate">{formatJalali(new Date(m.startAt), { withTime: true })}</span>
                    {m.room && <span className="min-w-0 truncate">· {m.room.name}</span>}
                    <span className="min-w-0 truncate">· {m.branch.name}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      {faNum(m._count.participants)}
                      {m._count.guests > 0 && ` + ${faNum(m._count.guests)} مهمان`}
                    </span>
                    <span className="text-ink-faint sm:mr-auto">{m.organizer.fullName}</span>
                  </div>
                </Link>
                {isCompact && (
                  <MeetingRsvpBar
                    meetingId={m.id}
                    status={m.status}
                    myResponseStatus={m.myResponseStatus ?? null}
                  />
                )}
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
