"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, faNum, EQUIPMENT_FA } from "@/lib";
import { EQUIPMENT_LIST } from "@/lib";

interface AdminRoom {
  id: string;
  name: string;
  capacity: number;
  isVip: boolean;
  isActive: boolean;
  branch: { id: string; name: string };
  floor: { id: string; name: string } | null;
  equipment: { equipment: string }[];
  openTime: string | null;
  closeTime: string | null;
}

export default function AdminRoomsPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    branchId: "",
    name: "",
    capacity: 8,
    isVip: false,
    equipment: [] as string[],
    openTime: "08:00",
    closeTime: "20:00",
  });

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: { id: string; name: string }[] }>("/api/branches"),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["rooms", "admin"],
    queryFn: () => api<{ rooms: AdminRoom[] }>("/api/rooms?all=1"),
  });

  async function createRoom() {
    setBusy(true);
    try {
      await api("/api/rooms/create", {
        method: "POST",
        json: {
          ...form,
          capacity: Number(form.capacity),
          openTime: form.openTime || undefined,
          closeTime: form.closeTime || undefined,
        },
      });
      push("اتاق ایجاد شد", "success");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["rooms"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(r: AdminRoom) {
    // no disable endpoint yet — equipment/status updates go through room:update
    push("برای غیرفعال‌سازی اتاق از API اتاق استفاده شود", "info");
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">مدیریت اتاق‌ها</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          اتاق جدید
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              className="h-10 rounded-xl border border-line bg-white px-3 text-[12px] outline-none focus:border-ink"
            >
              <option value="">انتخاب شعبه…</option>
              {(branchesData?.branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <input
              placeholder="نام اتاق"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-10 rounded-xl border border-line px-3 text-[12px] outline-none focus:border-ink"
            />
            <input
              type="number"
              dir="ltr"
              placeholder="ظرفیت"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              className="h-10 rounded-xl border border-line px-3 text-[12px] outline-none focus:border-ink"
            />
            <input
              dir="ltr"
              placeholder="ساعت باز شدن (HH:MM)"
              value={form.openTime}
              onChange={(e) => setForm({ ...form, openTime: e.target.value })}
              className="h-10 rounded-xl border border-line px-3 text-[12px] outline-none focus:border-ink"
            />
            <input
              dir="ltr"
              placeholder="ساعت بسته شدن (HH:MM)"
              value={form.closeTime}
              onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
              className="h-10 rounded-xl border border-line px-3 text-[12px] outline-none focus:border-ink"
            />
            <label className="flex h-10 items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={form.isVip}
                onChange={(e) => setForm({ ...form, isVip: e.target.checked })}
                className="h-4 w-4 accent-black"
              />
              اتاق VIP
            </label>
            <div className="sm:col-span-3">
              <p className="mb-1.5 text-[11px] text-ink-soft">تجهیزات</p>
              <div className="flex flex-wrap gap-1.5">
                {EQUIPMENT_LIST.map((eq) => {
                  const sel = form.equipment.includes(eq);
                  return (
                    <button
                      key={eq}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          equipment: sel ? form.equipment.filter((x) => x !== eq) : [...form.equipment, eq],
                        })
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[12px]",
                        sel ? "border-ink bg-ink text-white" : "border-line text-ink-soft",
                      )}
                    >
                      {EQUIPMENT_FA[eq]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-3">
              <Button onClick={createRoom} loading={busy} disabled={!form.branchId || !form.name}>
                ایجاد اتاق
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <SkeletonBlock className="h-72" />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader title={`اتاق‌ها (${faNum(data?.rooms.length ?? 0)})`} />
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[12px]">
              <thead className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                <tr>
                  <th className="px-4 py-2.5 font-medium">نام</th>
                  <th className="px-4 py-2.5 font-medium">شعبه</th>
                  <th className="px-4 py-2.5 font-medium">ظرفیت</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">تجهیزات</th>
                  <th className="px-4 py-2.5 font-medium">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(data?.rooms ?? []).map((r) => (
                  <tr key={r.id} className={cn(!r.isActive && "opacity-50")}>
                    <td className="px-4 py-3 font-medium">
                      {r.name}
                      {r.isVip && <span className="badge badge-black mr-1.5">VIP</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{r.branch.name}</td>
                    <td className="px-4 py-3">{faNum(r.capacity)} نفر</td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {r.equipment.map((e) => (
                          <span key={e.equipment} className="badge badge-gray">{EQUIPMENT_FA[e.equipment]}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("badge", r.isActive ? "badge-green" : "badge-gray")}>
                        {r.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
