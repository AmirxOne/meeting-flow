"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Power } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, SkeletonBlock, SkeletonTable } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn, faNum, EQUIPMENT_FA, EQUIPMENT_LIST } from "@/lib";

interface AdminRoom {
  id: string;
  name: string;
  capacity: number;
  isVip: boolean;
  isActive: boolean;
  branchId: string;
  branch: { id: string; name: string };
  floor: { id: string; name: string } | null;
  equipment: { equipment: string }[];
  openTime: string | null;
  closeTime: string | null;
  description: string | null;
}

export default function AdminRoomsPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    branchId: "",
    name: "",
    capacity: "8",
    isVip: false,
    equipment: [] as string[],
    openTime: "08:00",
    closeTime: "20:00",
    description: "",
  });

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: { id: string; name: string }[] }>("/api/branches"),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["rooms", "admin"],
    queryFn: () => api<{ rooms: AdminRoom[] }>("/api/rooms?all=1"),
  });

  function openCreate() {
    setEditing(null);
    setForm({ branchId: "", name: "", capacity: "8", isVip: false, equipment: [], openTime: "08:00", closeTime: "20:00", description: "" });
    setShowForm(true);
  }

  function openEdit(r: AdminRoom) {
    setEditing(r);
    setForm({
      branchId: r.branchId,
      name: r.name,
      capacity: String(r.capacity),
      isVip: r.isVip,
      equipment: r.equipment.map((e) => e.equipment),
      openTime: r.openTime ?? "",
      closeTime: r.closeTime ?? "",
      description: r.description ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        ...(editing ? {} : { branchId: form.branchId }),
        name: form.name.trim(),
        capacity: Number(form.capacity),
        isVip: form.isVip,
        equipment: form.equipment,
        openTime: form.openTime || undefined,
        closeTime: form.closeTime || undefined,
        description: form.description.trim() || undefined,
      };
      if (editing) {
        await api(`/api/rooms/${editing.id}/manage`, { method: "PATCH", json: payload });
        push("اتاق ویرایش شد", "success");
      } else {
        await api("/api/rooms/create", { method: "POST", json: payload });
        push("اتاق ایجاد شد", "success");
      }
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["rooms"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(r: AdminRoom) {
    try {
      await api(`/api/rooms/${r.id}/manage`, {
        method: "PATCH",
        json: { isActive: !r.isActive },
      });
      push(r.isActive ? "اتاق غیرفعال شد" : "اتاق فعال شد", "success");
      qc.invalidateQueries({ queryKey: ["rooms"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    }
  }

  async function remove(r: AdminRoom) {
    if (!confirm(`حذف «${r.name}»؟`)) return;
    try {
      await api(`/api/rooms/${r.id}/manage`, { method: "DELETE" });
      push("اتاق حذف شد", "success");
      qc.invalidateQueries({ queryKey: ["rooms"] });
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "ROOM_IN_USE") {
        // offer the correct action instead of a dead-end
        if (confirm(`${err.message}

غیرفعالش کنیم؟ (جلسات فعلی حفظ می‌شوند ولی رزرو جدید ممکن نیست)`)) {
          await toggleActive({ ...r, isActive: true });
        }
      } else {
        push(err.message, "error");
      }
    }
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">مدیریت اتاق‌ها</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          اتاق جدید
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <p className="mb-3 text-[13px] font-bold">{editing ? `ویرایش ${editing.name}` : "اتاق جدید"}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {!editing && (
              <div>
                <label className="mb-1 block text-[11px] text-ink-soft">شعبه *</label>
                <Select
                  value={form.branchId}
                  onChange={(v) => setForm({ ...form, branchId: v })}
                  placeholder="انتخاب شعبه…"
                  options={(branchesData?.branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
                />
              </div>
            )}
            <input
              placeholder="نام اتاق *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
            />
            <input
              type="number"
              dir="ltr"
              placeholder="ظرفیت"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
            />
            <input
              dir="ltr"
              placeholder="ساعت باز (HH:MM)"
              value={form.openTime}
              onChange={(e) => setForm({ ...form, openTime: e.target.value })}
              className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
            />
            <input
              dir="ltr"
              placeholder="ساعت بسته (HH:MM)"
              value={form.closeTime}
              onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
              className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
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
              <Button
                onClick={save}
                loading={busy}
                disabled={!form.name.trim() || (!editing && !form.branchId)}
              >
                {editing ? "ذخیره تغییرات" : "ایجاد اتاق"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SkeletonBlock className="h-4 w-32" />
          </div>
          <SkeletonTable rows={5} cols={7} />
        </Card>
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
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">ساعات</th>
                  <th className="px-4 py-2.5 font-medium">وضعیت</th>
                  <th className="px-4 py-2.5"></th>
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
                    <td className="hidden px-4 py-3 text-ink-soft md:table-cell" dir="rtl">
                      {r.openTime ? `${faStr2(r.openTime)}–${faStr2(r.closeTime ?? "")}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("badge", r.isActive ? "badge-green" : "badge-gray")}>
                        {r.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="rounded-md p-1.5 text-ink-soft hover:bg-paper-soft hover:text-ink"
                          title="ویرایش"
                          aria-label="ویرایش"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(r)}
                          className="rounded-md p-1.5 text-ink-soft hover:bg-paper-soft hover:text-ink"
                          title={r.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                          aria-label="تغییر وضعیت"
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => remove(r)}
                          className="rounded-md p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600"
                          title="حذف"
                          aria-label="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
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

function faStr2(s: string): string {
  return s.replace(/[0-9]/g, (ch) => "۰۱۲۳۴۵۶۷۸۹"[Number(ch)]);
}
