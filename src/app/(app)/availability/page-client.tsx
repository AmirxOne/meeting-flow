"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { faNum, toJalali } from "@/lib";
import { formatClockInTz, formatJalaliDayMonthInTz, DEFAULT_ORG_TIMEZONE } from "@/lib/timezone";
import { reserveMeetingHref, saveAvailabilityBooking, suggestRoomId } from "@/lib/availability-booking";
import { Select } from "@/components/ui/select";
import { PeoplePicker, type PickedPerson } from "@/components/ui/people-picker";

interface Slot {
  start: string;
  end: string;
  availableRooms: { id: string; name: string; capacity: number }[];
}

export function AvailabilityPage() {
  const { push } = useToast();
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: { id: string; name: string }[] }>("/api/branches"),
  });
  const { data: brandingData } = useQuery({
    queryKey: ["organization-branding"],
    queryFn: () =>
      api<{ branding: { timezone: string } }>("/api/organization/branding"),
  });
  const orgTz = brandingData?.branding.timezone ?? DEFAULT_ORG_TIMEZONE;
  const today = toJalali(new Date());
  const [branchId, setBranchId] = useState("");
  const [people, setPeople] = useState<PickedPerson[]>([]);
  const [durationMin, setDurationMin] = useState(30);
  const [days, setDays] = useState(3);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(false);

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
      const data = await api<{ slots: Slot[] }>("/api/availability", {
        method: "POST",
        json: {
          branchId,
          participantIds,
          durationMin,
          from: new Date().toISOString(),
          to: new Date(Date.now() + days * 86400000).toISOString(),
        },
      });
      setSlots(data.slots);
      if (data.slots.length === 0) push("زمان مشترکی یافت نشد", "error");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 lg:p-6">
      <h1 className="text-lg font-bold">یافتن زمان مناسب</h1>
      <p className="text-[12px] text-ink-soft">
        افراد را انتخاب کنید تا سیستم زمان‌های آزاد مشترک همه را با اتاق موجود پیدا کند.
      </p>

      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">شعبه</label>
              <Select
                value={branchId}
                onChange={setBranchId}
                placeholder="انتخاب…"
                options={(branchesData?.branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              />
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

          <div>
            <label className="mb-1.5 block text-[12px] font-medium">
              افراد ({faNum(people.length)} نفر — عضو شرکت یا فرد خارجی)
            </label>
            <PeoplePicker value={people} onChange={setPeople} />
          </div>

          <Button onClick={search} loading={loading} className="w-full sm:w-auto">
            <Clock className="h-4 w-4" />
            جستجوی زمان‌های آزاد
          </Button>
        </CardBody>
      </Card>

      {slots && slots.length === 0 && (
        <Card>
          <EmptyState
            title="زمان مشترکی پیدا نشد"
            description="افراد انتخابی در این بازه همگی آزاد نیستند. بازه را عوض کنید، تعداد افراد را کم کنید یا مدت جلسه را کوتاه‌تر کنید."
          />
        </Card>
      )}

      {slots && slots.length > 0 && (
        <Card>
          <CardHeader title="پیشنهادهای مناسب" subtitle={`${faNum(slots.length)} زمان آزاد پیدا شد`} />
          <div className="divide-y divide-line">
            {slots.map((s, i) => {
              const bookingDraft = {
                branchId,
                startAt: s.start,
                endAt: s.end,
                durationMin,
                people,
                availableRooms: s.availableRooms,
                roomId: suggestRoomId(s.availableRooms, people.length + 1),
              };
              return (
              <div key={i} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-[14px] font-bold">
                    {formatJalaliDayMonthInTz(new Date(s.start), orgTz)} — {formatClockInTz(new Date(s.start), orgTz)} تا {formatClockInTz(new Date(s.end), orgTz)}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    ✓ همه افراد آزاد هستند · اتاق‌های موجود:{" "}
                    {s.availableRooms.map((r) => `${r.name} (${faNum(r.capacity)} نفر)`).join("، ")}
                  </p>
                </div>
                <Link
                  href={reserveMeetingHref(bookingDraft)}
                  onClick={() => saveAvailabilityBooking(bookingDraft)}
                  className="mr-auto text-[12px] text-ink-soft underline hover:text-ink"
                >
                  رزرو با این زمان
                </Link>
              </div>
            );})}
          </div>
        </Card>
      )}
    </div>
  );
}
