"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2, CalendarClock, CalendarDays, User, Building2, DoorOpen, ArrowLeft, Info } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { faNum, faStr } from "@/lib";
import { formatClockInTz, formatJalaliDayMonthInTz, DEFAULT_ORG_TIMEZONE } from "@/lib/timezone";
import { reserveMeetingHref, saveAvailabilityBooking, suggestRoomId } from "@/lib/availability-booking";
import { Select } from "@/components/ui/select";
import { PeoplePicker, type PickedPerson } from "@/components/ui/people-picker";
import { useAuth } from "@/lib/auth-store";

interface Slot {
  start: string;
  end: string;
  availableRooms: { id: string; name: string; capacity: number }[];
}

type EmptyReason = "NO_ACTIVE_ROOM" | "HOLIDAY_BLOCKED" | "NO_COMMON_TIME" | undefined;

interface Branch {
  id: string;
  name: string;
  isActive: boolean;
  roomCount: number;
}

/** اسکلتون حین جستجو */
function SearchSkeleton() {
  return (
    <Card>
      <CardBody className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-line p-4">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-40 rounded" />
              <div className="skeleton h-3 w-64 rounded" />
            </div>
            <div className="skeleton h-8 w-20 rounded-md" />
          </div>
        ))}
        <p className="text-center text-[11px] text-ink-faint">در حال یافتن زمان‌های آزاد مشترک…</p>
      </CardBody>
    </Card>
  );
}

export function AvailabilityPage() {
  const { push } = useToast();
  const { me } = useAuth();
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: Branch[] }>("/api/branches"),
  });
  const { data: brandingData } = useQuery({
    queryKey: ["organization-branding"],
    queryFn: () => api<{ branding: { timezone: string } }>("/api/organization/branding"),
  });
  const orgTz = brandingData?.branding.timezone ?? DEFAULT_ORG_TIMEZONE;
  const [branchId, setBranchId] = useState("");
  const [people, setPeople] = useState<PickedPerson[]>([]);
  const [durationMin, setDurationMin] = useState(30);
  const [days, setDays] = useState(3);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [emptyReason, setEmptyReason] = useState<EmptyReason>(undefined);
  const [loading, setLoading] = useState(false);
  const [searchedBranchName, setSearchedBranchName] = useState("");
  const [organizerId, setOrganizerId] = useState("");

  const { data: delegateData } = useQuery({
    queryKey: ["delegates"],
    queryFn: () =>
      api<{ principals: { id: string; user: { id: string; fullName: string } }[] }>("/api/delegates"),
  });
  const principals = delegateData?.principals ?? [];
  const effectiveOrganizerId = organizerId || me?.id || "";

  const branches = branchesData?.branches ?? [];
  const activeBranches = useMemo(() => branches.filter((b) => b.isActive && b.roomCount > 0), [branches]);
  const pickedBranch = branches.find((b) => b.id === branchId);
  const branchUnavailable = !!pickedBranch && (!pickedBranch.isActive || pickedBranch.roomCount === 0);

  async function search() {
    if (!branchId) {
      push("شعبه را انتخاب کنید", "error");
      return;
    }
    setLoading(true);
    setSlots(null);
    try {
      const dir = await api<{ people: { id: string; userId: string | null }[] }>("/api/people");
      const userIdByDir = new Map(dir.people.map((d) => [d.id, d.userId]));
      const participantIds = people
        .filter((p) => p.ref.startsWith("dir:"))
        .map((p) => userIdByDir.get(p.ref.slice(4)))
        .filter((x): x is string => !!x);
      const data = await api<{ slots: Slot[]; reason?: EmptyReason }>("/api/availability", {
        method: "POST",
        json: {
          branchId,
          participantIds,
          durationMin,
          from: new Date().toISOString(),
          to: new Date(Date.now() + days * 86400000).toISOString(),
          ...(effectiveOrganizerId && me?.id && effectiveOrganizerId !== me.id
            ? { organizerId: effectiveOrganizerId }
            : {}),
        },
      });
      setSlots(data.slots);
      setEmptyReason(data.slots.length === 0 ? data.reason ?? "NO_COMMON_TIME" : undefined);
      setSearchedBranchName(pickedBranch?.name ?? "");
      if (data.slots.length === 0) {
        push(
          data.reason === "NO_ACTIVE_ROOM"
            ? "این شعبه اتاق فعال ندارد — از بخش اتاق‌ها فعالش کنید"
            : "زمان مشترکی یافت نشد",
          "error",
        );
      }
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setLoading(false);
    }
  }

  // نتایج بر اساس روز گروه‌بندی می‌شوند
  const byDay = useMemo(() => {
    if (!slots) return [];
    const groups: { label: string; items: { slot: Slot; i: number }[] }[] = [];
    for (let i = 0; i < slots.length; i++) {
      const label = formatJalaliDayMonthInTz(new Date(slots[i].start), orgTz);
      const g = groups.find((x) => x.label === label);
      if (g) g.items.push({ slot: slots[i], i });
      else groups.push({ label, items: [{ slot: slots[i], i }] });
    }
    return groups;
  }, [slots, orgTz]);

  return (
    <div className="min-w-0 space-y-4 overflow-x-clip p-4 lg:p-6">
      {/* هدر برندینگ‌دار */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <CalendarClock className="h-5 w-5" />
            یافتن زمان مناسب
          </h1>
          <p className="mt-1 text-[12px] leading-5 text-ink-soft">
            افراد را انتخاب کنید تا سیستم زمان‌های آزاد مشترک همه را با اتاق موجود پیدا کند.
          </p>
        </div>

      </div>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-ink-soft" />
              مشخصات جستجو
            </span>
          }
          subtitle="شرایط جلسه را مشخص کنید و زمان‌های مشترک را ببینید"
        />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">شعبه</label>
              <Select
                value={branchId}
                onChange={setBranchId}
                placeholder="انتخاب…"
                options={activeBranches.map((b) => ({ value: b.id, label: b.name }))}
              />
              {branches.length > 0 && activeBranches.length === 0 && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600">
                  <Info className="h-3.5 w-3.5" />
                  شعبه‌ی فعالی با اتاق موجود نیست — از بخش شعب فعال کنید
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">مدت جلسه</label>
              <Select
                value={String(durationMin)}
                onChange={(v) => setDurationMin(Number(v))}
                options={[15, 30, 45, 60, 90, 120].map((d) => ({ value: String(d), label: `${faNum(d)} دقیقه` }))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">بازه جستجو</label>
              <Select
                value={String(days)}
                onChange={(v) => setDays(Number(v))}
                options={[1, 2, 3, 7].map((d) => ({ value: String(d), label: `${faNum(d)} روز آینده` }))}
              />
            </div>
          </div>

          {principals.length > 0 && me && (
            <div data-testid="availability-organizer">
              <label className="mb-1.5 block text-[12px] font-medium">برگزارکننده</label>
              <Select
                value={effectiveOrganizerId}
                onChange={setOrganizerId}
                options={[
                  { value: me.id, label: `خودم (${me.fullName})` },
                  ...principals.map((p) => ({
                    value: p.user.id,
                    label: `برگزارکننده = ${p.user.fullName}`,
                  })),
                ]}
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-medium">
              افراد ({faNum(people.length)} نفر — عضو شرکت یا فرد خارجی)
            </label>
            <PeoplePicker value={people} onChange={setPeople} />
            <p className="mt-1.5 text-[11px] text-ink-faint">
              اگر کسی انتخاب نکنید، فقط زمان‌های آزاد خودتان و اتاق‌ها جستجو می‌شود.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {slots && (
              <Button variant="outline" onClick={() => { setSlots(null); }} className="w-full sm:w-auto">
                پاک‌کردن نتایج
              </Button>
            )}
            <Button onClick={search} loading={loading} className="w-full sm:w-auto">
              <Clock className="h-4 w-4" />
              جستجوی زمان‌های آزاد
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* اسکلتون هنگام جستجو */}
      {loading && <SearchSkeleton />}

      {/* هشدار شعبه‌ی بدون اتاق فعال */}
      {!loading && branchUnavailable && !slots && (
        <Card>
          <EmptyState
            title="این شعبه اتاق فعالی ندارد"
            description="جستجو در این شعبه همیشه بی‌نتیجه است. شعبه‌ی دیگری انتخاب کنید یا از بخش شعب، اتاقی را فعال کنید."
          />
        </Card>
      )}

      {slots && slots.length === 0 && (
        <Card>
          {emptyReason === "NO_ACTIVE_ROOM" ? (
            <EmptyState
              title="این شعبه اتاق فعالی ندارد"
              description="جستجو بدون اتاق فعال ممکن نیست — از بخش «اتاق‌ها» اتاق این شعبه را فعال کنید یا شعبه‌ی دیگری انتخاب کنید."
            />
          ) : (
            <EmptyState
              title="زمان مشترکی پیدا نشد"
              description="افراد انتخابی در این بازه همگی آزاد نیستند. بازه را عوض کنید، تعداد افراد را کم کنید یا مدت جلسه را کوتاه‌تر کنید."
            />
          )}
        </Card>
      )}

      {slots && slots.length > 0 && (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                پیشنهادهای مناسب
              </span>
            }
            subtitle={`${faStr(searchedBranchName)} · ${faNum(slots.length)} زمان آزاد پیدا شد`}
          />
          <CardBody className="space-y-5">
            {byDay.map((g) => (
              <div key={g.label}>
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-ink-soft">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {g.label}
                </p>
                <div className="space-y-2">
                  {g.items.map(({ slot: s, i }) => {
                    const bookingDraft = {
                      branchId,
                      startAt: s.start,
                      endAt: s.end,
                      durationMin,
                      people,
                      availableRooms: s.availableRooms,
                      roomId: suggestRoomId(s.availableRooms, people.length + 1),
                      ...(effectiveOrganizerId && me?.id && effectiveOrganizerId !== me.id
                        ? { organizerId: effectiveOrganizerId }
                        : {}),
                    };
                    const bestRoom = s.availableRooms.length
                      ? s.availableRooms.reduce((a, b) => (a.capacity <= b.capacity ? a : b))
                      : null;
                    return (
                      <div
                        key={i}
                        className="group flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 transition-colors hover:border-ink/30"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                          <CheckCircle2 className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-bold" dir="ltr" style={{ textAlign: "right" }}>
                            {formatClockInTz(new Date(s.start), orgTz)} تا {formatClockInTz(new Date(s.end), orgTz)}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              همه آزاد ({faNum(people.length + 1)} نفر)
                            </span>
                            <span className="flex items-center gap-1">
                              <DoorOpen className="h-3 w-3" />
                              {bestRoom ? `${bestRoom.name} (${faNum(bestRoom.capacity)} نفره)` : "اتاق موجود نیست"}
                            </span>
                          </p>
                        </div>
                        <Link
                          href={reserveMeetingHref(bookingDraft)}
                          onClick={() => saveAvailabilityBooking(bookingDraft)}
                          className="flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[12px] font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white"
                        >
                          رزرو این زمان
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
