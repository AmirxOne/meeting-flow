"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, BarChart3 } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { cn, faNum, faPad2, faStr, STATUS_FA, TYPE_FA } from "@/lib";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { FilterBar } from "@/components/ui/filter-bar";
import { PeoplePicker, type PickedPerson } from "@/components/ui/people-picker";

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

function userIdFromPerson(
  person: PickedPerson | undefined,
  dir: { id: string; userId: string | null }[] | undefined,
): string {
  if (!person?.ref.startsWith("dir:") || !dir) return "";
  const dirId = person.ref.slice(4);
  return dir.find((p) => p.id === dirId)?.userId ?? "";
}

export function ReportsPage() {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86400000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [branchId, setBranchId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [organizer, setOrganizer] = useState<PickedPerson[]>([]);
  const [participant, setParticipant] = useState<PickedPerson[]>([]);
  const [rangePreset, setRangePreset] = useState("30");

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: { id: string; name: string }[] }>("/api/branches"),
  });
  const { data: roomsData } = useQuery({
    queryKey: ["rooms", branchId],
    queryFn: () =>
      api<{ rooms: { id: string; name: string }[] }>(
        `/api/rooms?branchId=${encodeURIComponent(branchId)}`,
      ),
    enabled: !!branchId,
  });
  const { data: peopleDir } = useQuery({
    queryKey: ["people", "dir-ids"],
    queryFn: () => api<{ people: { id: string; userId: string | null }[] }>("/api/people"),
  });

  const branches = branchesData?.branches ?? [];
  const rooms = roomsData?.rooms ?? [];
  const organizerId = userIdFromPerson(organizer[0], peopleDir?.people);
  const participantId = userIdFromPerson(participant[0], peopleDir?.people);

  const queryString = useMemo(() => {
    const q = new URLSearchParams({ from, to });
    if (status) q.set("status", status);
    if (type) q.set("meetingType", type);
    if (branchId) q.set("branchId", branchId);
    if (roomId) q.set("roomId", roomId);
    if (organizerId) q.set("organizerId", organizerId);
    if (participantId) q.set("participantId", participantId);
    return q.toString();
  }, [from, to, status, type, branchId, roomId, organizerId, participantId]);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", queryString],
    queryFn: () => api<{ summary: Summary }>(`/api/reports?${queryString}`),
  });

  const filterGroups = useMemo(
    () => [
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
        key: "branch",
        label: "شعبه",
        options: [
          { value: "", label: "همه" },
          ...branches.map((b) => ({ value: b.id, label: b.name })),
        ],
      },
      {
        key: "room",
        label: "اتاق",
        options: [
          { value: "", label: branchId ? "همه" : "ابتدا شعبه" },
          ...rooms.map((r) => ({ value: r.id, label: r.name })),
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
    ],
    [branches, rooms, branchId],
  );

  const s = data?.summary;
  const maxHourly = Math.max(1, ...(s?.hourlyHistogram.map((h) => h.count) ?? [1]));

  function handleFilterChange(v: Record<string, string>) {
    const allEmpty = Object.values(v).every((x) => !x);
    if (allEmpty) {
      setOrganizer([]);
      setParticipant([]);
    }
    if (v.branch !== branchId) {
      v.room = "";
      setRoomId("");
    } else {
      setRoomId(v.room ?? "");
    }
    setRangePreset(v.range ?? "");
    setBranchId(v.branch ?? "");
    setStatus(v.status ?? "");
    setType(v.type ?? "");
    if (v.range) {
      const days = Number(v.range);
      const nowIso = new Date().toISOString().slice(0, 10);
      const fromIso = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      setFrom(fromIso);
      setTo(nowIso);
    }
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <BarChart3 className="h-5 w-5" />
          گزارش‌ها
        </h1>
        <a href={`/api/reports?${queryString}&format=csv`} download>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[12px] font-medium hover:bg-paper-soft">
            <Download className="h-4 w-4" />
            خروجی CSV
          </button>
        </a>
      </div>

      <FilterBar
        groups={filterGroups}
        value={{ range: rangePreset, branch: branchId, room: roomId, status, type }}
        onChange={handleFilterChange}
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium">برگزارکننده</label>
          <PeoplePicker
            value={organizer}
            onChange={setOrganizer}
            max={1}
            allowManual={false}
            placeholder="جستجوی برگزارکننده…"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium">شرکت‌کننده</label>
          <PeoplePicker
            value={participant}
            onChange={setParticipant}
            max={1}
            allowManual={false}
            placeholder="جستجوی شرکت‌کننده…"
          />
        </div>
      </div>

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
            <Card>
              <CardHeader title="ساعت‌های پرتقاضا" subtitle="توزیع شروع جلسات در ساعات روز" />
              <CardBody>
                <div className="flex h-44 gap-1" dir="rtl">
                  {s.hourlyHistogram.map((h) => {
                    const peak = s.peakHour === h.hour;
                    const pct = h.count ? Math.max(10, (h.count / maxHourly) * 100) : 0;
                    return (
                      <div
                        key={h.hour}
                        className="flex min-w-0 flex-1 flex-col items-center gap-1"
                        title={`${faPad2(h.hour)}:۰۰ — ${faNum(h.count)} جلسه`}
                      >
                        <div className="flex w-full flex-1 items-end">
                          <div
                            className={cn(
                              "w-full rounded-t",
                              h.count ? (peak ? "bg-ink" : "bg-ink/70") : "bg-paper-deep",
                            )}
                            style={{ height: h.count ? `${pct}%` : 3 }}
                          />
                        </div>
                        {h.count > 0 && (
                          <span className={cn("text-[9px] font-medium tabular-nums", peak ? "text-ink" : "text-ink-soft")}>
                            {faNum(h.count)}
                          </span>
                        )}
                        <span className={cn("text-[9px] tabular-nums", peak ? "font-bold text-ink" : "text-ink-faint")}>
                          {faPad2(h.hour)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

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
