"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, CalendarX2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-wrap items-center gap-2">
        {can("meeting:view-all") && (
          <div className="flex overflow-hidden rounded-xl border border-line">
            <button
              onClick={() => setScope("all")}
              className={cn("px-3 py-1.5 text-[12px]", scope === "all" ? "bg-ink text-white" : "text-ink-soft")}
            >
              کل شرکت
            </button>
            <button
              onClick={() => setScope("mine")}
              className={cn("px-3 py-1.5 text-[12px]", scope === "mine" ? "bg-ink text-white" : "text-ink-soft")}
            >
              جلسات من
            </button>
          </div>
        )}
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
              status === f.key
                ? "border-ink bg-ink text-white"
                : "border-line text-ink-soft hover:border-ink-faint",
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="flex h-9 min-w-44 flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 sm:max-w-64">
          <Search className="h-4 w-4 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی عنوان…"
            className="w-full bg-transparent text-[12px] outline-none"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-20" />
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
        <div className="space-y-2">
          {meetings.map((m) => (
            <Link key={m.id} href={`/meetings/${m.id}`}>
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
          ))}
        </div>
      )}
    </div>
  );
}
