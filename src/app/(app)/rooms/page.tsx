"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DoorOpen } from "lucide-react";
import { api } from "@/lib/api";
import { Card, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { cn, faNum, faStr, EQUIPMENT_FA } from "@/lib";

interface RoomWithLive {
  id: string;
  name: string;
  capacity: number;
  isVip: boolean;
  isActive: boolean;
  openTime: string | null;
  closeTime: string | null;
  branch: { id: string; name: string };
  floor: { id: string; name: string; number: number } | null;
  equipment: { equipment: string }[];
  manager: { fullName: string } | null;
}

interface RoomStatus {
  id: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "DISABLED";
  current?: { id: string; title: string; endAt: string } | null;
  next?: { id: string; title: string; startAt: string } | null;
}

const STATUS_META: Record<string, { label: string; dot: string; cls: string }> = {
  AVAILABLE: { label: "آزاد", dot: "bg-emerald-500", cls: "badge-green" },
  OCCUPIED: { label: "در جلسه", dot: "bg-red-500", cls: "badge-red" },
  RESERVED: { label: "رزرو شده", dot: "bg-amber-500", cls: "badge-amber" },
  DISABLED: { label: "غیرفعال", dot: "bg-zinc-400", cls: "badge-gray" },
};

export default function RoomsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => api<{ rooms: RoomWithLive[] }>("/api/rooms"),
    refetchInterval: 60_000,
  });

  // live status per room
  const { data: statuses } = useQuery({
    queryKey: ["room-statuses"],
    queryFn: async () => {
      const rooms = await api<{ rooms: RoomWithLive[] }>("/api/rooms");
      const entries = await Promise.all(
        rooms.rooms.map(async (r) => {
          const s = await api<{ status: string; current: unknown; next: unknown }>(`/api/rooms/${r.id}`);
          return [r.id, s] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, RoomStatus>;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <div className="skeleton h-7 w-32" />
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-3.5 w-12" />
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="skeleton h-4.5 w-32" />
                  <div className="skeleton h-3 w-24" />
                </div>
                <div className="skeleton h-5 w-14 rounded-full" />
              </div>
              <div className="mt-3 flex gap-1.5">
                <div className="skeleton h-5 w-20 rounded-full" />
                <div className="skeleton h-5 w-12 rounded-full" />
                <div className="skeleton h-5 w-16 rounded-full" />
              </div>
              <div className="skeleton mt-3 h-9 rounded-md" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const rooms = data?.rooms ?? [];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">اتاق‌های جلسه</h1>
        <div className="flex items-center gap-3 text-[11px] text-ink-soft">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> آزاد</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> در جلسه</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> رزرو</span>
        </div>
      </div>

      {rooms.length === 0 ? (
        <Card>
          <EmptyState icon={<DoorOpen className="h-10 w-10" />} title="اتاقی ثبت نشده است" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((r) => {
            const st = statuses?.[r.id];
            const meta = STATUS_META[st?.status ?? "AVAILABLE"];
            return (
              <Link key={r.id} href={`/rooms/${r.id}`}>
                <Card className="h-full p-4 transition-colors hover:border-ink-faint">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-bold">{r.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-soft">
                        {r.branch.name}
                        {r.floor ? ` · ${r.floor.name}` : ""}
                      </p>
                    </div>
                    <span className={cn("badge", meta.cls)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="badge badge-gray">ظرفیت {faNum(r.capacity)} نفر</span>
                    {r.isVip && <span className="badge badge-black">VIP</span>}
                    {r.equipment.map((e) => (
                      <span key={e.equipment} className="badge badge-gray">
                        {EQUIPMENT_FA[e.equipment] ?? e.equipment}
                      </span>
                    ))}
                  </div>

                  {st?.current && (
                    <div className="mt-3 rounded-md bg-red-50 p-2.5">
                      <p className="truncate text-[12px] font-medium text-red-700">
                        در حال جلسه: {st.current.title}
                      </p>
                    </div>
                  )}
                  {!st?.current && st?.next && (
                    <div className="mt-3 rounded-md bg-amber-50 p-2.5">
                      <p className="truncate text-[12px] text-amber-700">جلسه بعدی: {st.next.title}</p>
                    </div>
                  )}
                  {r.openTime && r.closeTime && (
                    <p className="mt-3 text-[10px] text-ink-faint" dir="rtl">
                      ساعات کاری: {faStr(r.openTime)} تا {faStr(r.closeTime)}
                    </p>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
