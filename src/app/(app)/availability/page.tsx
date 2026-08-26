"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2 } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, faNum, faStr, toJalali } from "@/lib";
import { Select } from "@/components/ui/select";

interface Slot {
  start: string;
  end: string;
  availableRooms: { id: string; name: string; capacity: number }[];
}

export default function AvailabilityPage() {
  const { push } = useToast();
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: { id: string; name: string }[] }>("/api/branches"),
  });
  const { data: usersData } = useQuery({
    queryKey: ["users-lite"],
    queryFn: () => api<{ users: { id: string; fullName: string }[] }>("/api/users"),
  });

  const today = toJalali(new Date());
  const [branchId, setBranchId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [durationMin, setDurationMin] = useState(30);
  const [days, setDays] = useState(3);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(false);

  const users = usersData?.users ?? [];

  async function search() {
    if (!branchId) {
      push("شعبه را انتخاب کنید", "error");
      return;
    }
    setLoading(true);
    setSlots(null);
    try {
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

  function tehranTime(iso: string): string {
    const t = new Date(new Date(iso).getTime() + 210 * 60000);
    return faStr(`${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`);
  }
  function tehranDate(iso: string): string {
    const d = new Date(new Date(iso).getTime() + 210 * 60000);
    const j = toJalali(d);
    return `${faNum(j.jd)}/${faNum(j.jm)}`;
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
              افراد ({faNum(participantIds.length)} نفر)
            </label>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-line p-2.5">
              {users.map((u) => {
                const selected = participantIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      setParticipantIds((prev) =>
                        selected ? prev.filter((x) => x !== u.id) : [...prev, u.id],
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[12px]",
                      selected ? "border-ink bg-ink text-white" : "border-line text-ink-soft",
                    )}
                  >
                    {u.fullName}
                  </button>
                );
              })}
            </div>
          </div>

          <Button onClick={search} loading={loading} className="w-full sm:w-auto">
            <Clock className="h-4 w-4" />
            جستجوی زمان‌های آزاد
          </Button>
        </CardBody>
      </Card>

      {slots && slots.length > 0 && (
        <Card>
          <CardHeader title="پیشنهادهای مناسب" subtitle={`${faNum(slots.length)} زمان آزاد پیدا شد`} />
          <div className="divide-y divide-line">
            {slots.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-[14px] font-bold">
                    {tehranDate(s.start)} — {tehranTime(s.start)} تا {tehranTime(s.end)}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    ✓ همه افراد آزاد هستند · اتاق‌های موجود:{" "}
                    {s.availableRooms.map((r) => `${r.name} (${faNum(r.capacity)} نفر)`).join("، ")}
                  </p>
                </div>
                <Link
                  href="/meetings/new"
                  className="mr-auto text-[12px] text-ink-soft underline hover:text-ink"
                >
                  رزرو با این زمان
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
