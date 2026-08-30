"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badges";
import { cn, faNum, faStr, formatJalali, EQUIPMENT_FA, pad2 } from "@/lib";

interface RoomDetail {
  room: {
    id: string;
    name: string;
    capacity: number;
    description: string | null;
    isVip: boolean;
    isActive: boolean;
    openTime: string | null;
    closeTime: string | null;
    minDurationMin: number;
    maxDurationMin: number;
    branch: { id: string; name: string };
    floor: { name: string; number: number } | null;
    equipment: { equipment: string }[];
    manager: { fullName: string } | null;
  };
  meetings: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    organizer: { fullName: string };
    _count: { participants: number };
  }[];
  status: string;
  current: { id: string; title: string; endAt: string } | null;
  next: { id: string; title: string; startAt: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "آزاد",
  OCCUPIED: "در جلسه",
  RESERVED: "رزرو شده",
  DISABLED: "غیرفعال",
};

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["room", id],
    queryFn: () => api<RoomDetail>(`/api/rooms/${id}`),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <SkeletonBlock className="h-6 w-40" />
            <SkeletonBlock className="h-3.5 w-56" />
          </div>
          <SkeletonBlock className="h-5 w-16 rounded-full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="border-b border-line px-5 py-4">
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="mt-1 h-3 w-32" />
            </div>
            <div className="p-5">
              <SkeletonBlock className="mb-4 h-10 rounded-md" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between border-b border-line py-3 last:border-0">
                  <div className="space-y-1.5">
                    <SkeletonBlock className="h-4 w-44" />
                    <SkeletonBlock className="h-3 w-56" />
                  </div>
                  <SkeletonBlock className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="border-b border-line px-5 py-4">
              <SkeletonBlock className="h-4 w-24" />
            </div>
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="h-3.5 w-16" />
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-5 w-16 rounded-full" />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const { room, meetings } = data;
  const t = new Date(Date.now() + 210 * 60000);
  const dayStartMin = 8 * 60;
  const dayEndMin = 20 * 60;
  const minutesOf = (iso: string) => {
    const lt = new Date(new Date(iso).getTime() + 210 * 60000);
    return lt.getUTCHours() * 60 + lt.getUTCMinutes();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">{room.name}</h1>
          <p className="mt-0.5 text-[12px] text-ink-soft">
            {room.branch.name}
            {room.floor ? ` · ${room.floor.name}` : ""}
            {room.manager ? ` · مدیر اتاق: ${room.manager.fullName}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "badge",
            data.status === "AVAILABLE" && "badge-green",
            data.status === "OCCUPIED" && "badge-red",
            data.status === "RESERVED" && "badge-amber",
            data.status === "DISABLED" && "badge-gray",
          )}
        >
          {STATUS_LABEL[data.status]}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="برنامه امروز"
            subtitle={formatJalali(new Date(), { monthName: true })}
          />
          <CardBody>
            {meetings.length === 0 ? (
              <EmptyState title="امروز جلسه‌ای در این اتاق نیست" />
            ) : (
              <>
                {/* timeline */}
                <div className="relative mb-4 h-16" dir="rtl">
                  <div className="absolute inset-x-0 top-7 h-2 rounded-full bg-paper-soft" />
                  {meetings
                    .filter((m) => !["CANCELLED", "REJECTED"].includes(m.status))
                    .map((m) => {
                      const s = minutesOf(m.startAt);
                      const e = minutesOf(m.endAt);
                      const right = ((Math.max(s, dayStartMin) - dayStartMin) / (dayEndMin - dayStartMin)) * 100;
                      const width = ((Math.min(e, dayEndMin) - Math.max(s, dayStartMin)) / (dayEndMin - dayStartMin)) * 100;
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "absolute top-7 h-2 rounded-full",
                            m.status === "IN_PROGRESS" ? "bg-red-500" : "bg-ink",
                          )}
                          style={{ right: `${right}%`, width: `${width}%` }}
                          title={m.title}
                        />
                      );
                    })}
                  {[8, 10, 12, 14, 16, 18, 20].map((h) => (
                    <span
                      key={h}
                      className="absolute top-12 text-[9px] text-ink-faint"
                      style={{ right: `${((h * 60 - dayStartMin) / (dayEndMin - dayStartMin)) * 100}%`, transform: "translateX(50%)" }}
                    >
                      {faStr(pad2(h))}
                    </span>
                  ))}
                </div>

                <div className="divide-y divide-line">
                  {meetings.map((m) => (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className="flex items-center justify-between gap-2 px-1 py-3 hover:bg-paper-soft"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{m.title}</p>
                        <p className="mt-0.5 text-[11px] text-ink-soft">
                          {faStr(new Date(new Date(m.startAt).getTime() + 210 * 60000).toISOString().slice(11, 16))} —{" "}
                          {faStr(new Date(new Date(m.endAt).getTime() + 210 * 60000).toISOString().slice(11, 16))}
                          {" · "}
                          {m.organizer.fullName}
                          {" · "}
                          {faNum(m._count.participants)} نفر
                        </p>
                      </div>
                      <StatusBadge status={m.status} />
                    </Link>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="مشخصات اتاق" />
          <CardBody className="space-y-3 text-[12px]">
            <Row label="ظرفیت" value={`${faNum(room.capacity)} نفر`} />
            <Row label="مدیر اتاق" value={room.manager?.fullName ?? "—"} />
            <Row label="اتاق VIP" value={room.isVip ? "بله" : "خیر"} />
            <Row label="حداقل مدت رزرو" value={`${faNum(room.minDurationMin)} دقیقه`} />
            <Row label="حداکثر مدت رزرو" value={`${faNum(room.maxDurationMin)} دقیقه`} />
            {room.openTime && (
              <Row label="ساعات کاری" value={`${faStr(room.openTime)} تا ${faStr(room.closeTime ?? "")}`} />
            )}
            <div>
              <p className="text-ink-soft">تجهیزات</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {room.equipment.length === 0 && <span className="text-ink-faint">—</span>}
                {room.equipment.map((e) => (
                  <span key={e.equipment} className="badge badge-gray">
                    {EQUIPMENT_FA[e.equipment] ?? e.equipment}
                  </span>
                ))}
              </div>
            </div>
            {room.description && (
              <div>
                <p className="text-ink-soft">توضیحات</p>
                <p className="mt-1 leading-5">{room.description}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
