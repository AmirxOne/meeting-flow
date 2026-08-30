"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Power, Wrench } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState, SkeletonBlock, SkeletonTable } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { cn, faNum, formatJalali, EQUIPMENT_FA, EQUIPMENT_LIST } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { JalaliDatePicker, TimePicker } from "@/components/ui/jalali-date-picker";

interface BranchOption {
  id: string;
  name: string;
  floors: { id: string; name: string; number: number }[];
}

interface RoomExclusion {
  id: string;
  reason: string;
  startAt: string;
  endAt: string;
}

interface AdminRoom {
  id: string;
  name: string;
  capacity: number;
  isVip: boolean;
  isActive: boolean;
  branchId: string;
  branch: { id: string; name: string };
  floor: { id: string; name: string } | null;
  manager: { id: string; fullName: string } | null;
  equipment: { equipment: string }[];
  openTime: string | null;
  closeTime: string | null;
  description: string | null;
}

interface ManagerOption {
  id: string;
  fullName: string;
}

export function AdminRoomsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    branchId: "",
    floorId: "",
    name: "",
    capacity: "8",
    isVip: false,
    equipment: [] as string[],
    openTime: "08:00",
    closeTime: "20:00",
    description: "",
    managerId: "",
  });
  const [exclusionRoom, setExclusionRoom] = useState<AdminRoom | null>(null);
  const [exForm, setExForm] = useState({
    reason: "",
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "12:00",
  });
  const [exBusy, setExBusy] = useState(false);

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: BranchOption[] }>("/api/branches"),
    enabled: can("room:update"),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["rooms", "admin"],
    queryFn: () => api<{ rooms: AdminRoom[] }>("/api/rooms?all=1"),
    enabled: can("room:update"),
  });

  const { data: managersData } = useQuery({
    queryKey: ["users", "managers"],
    queryFn: () => api<{ users: ManagerOption[] }>("/api/users"),
    enabled: can("room:update"),
  });

  const { data: exclusionsData, refetch: refetchExclusions } = useQuery({
    queryKey: ["room-exclusions", exclusionRoom?.id],
    queryFn: () => api<{ exclusions: RoomExclusion[] }>(`/api/rooms/${exclusionRoom!.id}/exclusions`),
    enabled: !!exclusionRoom,
  });

  const branches = branchesData?.branches ?? [];
  const activeBranchId = editing?.branchId ?? form.branchId;
  const floorOptions = branches.find((b) => b.id === activeBranchId)?.floors ?? [];
  const managerOptions = (managersData?.users ?? []).map((u) => ({
    value: u.id,
    label: u.fullName,
  }));

  function openCreate() {
    setEditing(null);
    setForm({
      branchId: "",
      floorId: "",
      name: "",
      capacity: "8",
      isVip: false,
      equipment: [],
      openTime: "08:00",
      closeTime: "20:00",
      description: "",
      managerId: "",
    });
    setShowForm(true);
  }

  function openEdit(r: AdminRoom) {
    setEditing(r);
    setForm({
      branchId: r.branchId,
      floorId: r.floor?.id ?? "",
      name: r.name,
      capacity: String(r.capacity),
      isVip: r.isVip,
      equipment: r.equipment.map((e) => e.equipment),
      openTime: r.openTime ?? "",
      closeTime: r.closeTime ?? "",
      description: r.description ?? "",
      managerId: r.manager?.id ?? "",
    });
    setShowForm(true);
  }

  function onBranchChange(branchId: string) {
    setForm({ ...form, branchId, floorId: "" });
  }

  function isoToday(): string {
    const t = new Date(Date.now() + 210 * 60000);
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
  }

  function openExclusions(r: AdminRoom) {
    setExclusionRoom(r);
    setExForm({
      reason: "",
      startDate: isoToday(),
      startTime: "09:00",
      endDate: isoToday(),
      endTime: "12:00",
    });
  }

  async function addExclusion() {
    if (!exclusionRoom) return;
    if (!exForm.reason.trim() || !exForm.startDate || !exForm.endDate || !exForm.startTime || !exForm.endTime) {
      push("همه فیلدها را پر کنید", "error");
      return;
    }
    setExBusy(true);
    try {
      const startAt = tehranInstant(exForm.startDate, exForm.startTime);
      const endAt = tehranInstant(exForm.endDate, exForm.endTime);
      await api(`/api/rooms/${exclusionRoom.id}/exclusions`, {
        method: "POST",
        json: { reason: exForm.reason.trim(), startAt: startAt.toISOString(), endAt: endAt.toISOString() },
      });
      push("غیرفعال‌سازی ثبت شد", "success");
      setExForm({ reason: "", startDate: isoToday(), startTime: "09:00", endDate: isoToday(), endTime: "12:00" });
      refetchExclusions();
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setExBusy(false);
    }
  }

  async function removeExclusion(ex: RoomExclusion) {
    if (!exclusionRoom) return;
    if (!confirm(`حذف «${ex.reason}»؟`)) return;
    setExBusy(true);
    try {
      await api(`/api/rooms/${exclusionRoom.id}/exclusions/${ex.id}`, { method: "DELETE" });
      push("غیرفعال‌سازی حذف شد", "success");
      refetchExclusions();
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setExBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        ...(editing ? {} : { branchId: form.branchId }),
        floorId: form.floorId || null,
        name: form.name.trim(),
        capacity: Number(form.capacity),
        isVip: form.isVip,
        equipment: form.equipment,
        openTime: form.openTime || undefined,
        closeTime: form.closeTime || undefined,
        description: form.description.trim() || undefined,
        managerId: form.managerId || null,
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

  if (!can("room:update")) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-[13px] text-ink-soft">
          مدیریت اتاق‌ها نیازمند دسترسی room:update است.
        </Card>
      </div>
    );
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

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `ویرایش ${editing.name}` : "اتاق جدید"}
        subtitle="اتاق جلسه در شعبه انتخابی ساخته می‌شود"
        wide
        footer={
          <div className="flex gap-2">
            <Button onClick={save} loading={busy} disabled={!form.name.trim() || (!editing && !form.branchId)}>
              {editing ? "ذخیره تغییرات" : "ایجاد اتاق"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              انصراف
            </Button>
          </div>
        }
      >
      <div className="grid gap-3 sm:grid-cols-3">
        {!editing && (
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">شعبه *</label>
            <Select
              value={form.branchId}
              onChange={onBranchChange}
              placeholder="انتخاب شعبه…"
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-[11px] text-ink-soft">طبقه</label>
          <Select
            value={form.floorId}
            onChange={(v) => setForm({ ...form, floorId: v })}
            placeholder={activeBranchId ? "انتخاب طبقه…" : "ابتدا شعبه را انتخاب کنید"}
            disabled={!activeBranchId}
            options={floorOptions.map((f) => ({
              value: f.id,
              label: `${f.name} (${faNum(f.number)})`,
            }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-ink-soft">مدیر اتاق</label>
          <Select
            value={form.managerId}
            onChange={(v) => setForm({ ...form, managerId: v })}
            placeholder="بدون مدیر"
            options={managerOptions}
          />
        </div>
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
        
        </div>
      </Modal>

      <Modal
        open={!!exclusionRoom}
        onClose={() => setExclusionRoom(null)}
        title={exclusionRoom ? `تعمیر / غیرفعال — ${exclusionRoom.name}` : "غیرفعال‌سازی موقت"}
        subtitle="در بازه‌های ثبت‌شده رزرو جدید ممکن نیست"
        wide
        footer={
          <Button variant="ghost" onClick={() => setExclusionRoom(null)}>
            بستن
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] text-ink-soft">دلیل *</label>
              <input
                placeholder="مثلاً تعمیرات، رزرو VIP، …"
                value={exForm.reason}
                onChange={(e) => setExForm({ ...exForm, reason: e.target.value })}
                className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">شروع — تاریخ</label>
              <JalaliDatePicker
                value={exForm.startDate}
                onChange={(v) => setExForm({ ...exForm, startDate: v })}
                min={isoToday()}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">شروع — ساعت</label>
              <TimePicker
                value={exForm.startTime}
                onChange={(v) => setExForm({ ...exForm, startTime: v })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">پایان — تاریخ</label>
              <JalaliDatePicker
                value={exForm.endDate}
                onChange={(v) => setExForm({ ...exForm, endDate: v })}
                min={exForm.startDate || isoToday()}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">پایان — ساعت</label>
              <TimePicker
                value={exForm.endTime}
                onChange={(v) => setExForm({ ...exForm, endTime: v })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                onClick={addExclusion}
                loading={exBusy}
                disabled={!exForm.reason.trim() || !exForm.startDate || !exForm.endDate}
              >
                ثبت غیرفعال‌سازی
              </Button>
            </div>
          </div>

          {(exclusionsData?.exclusions ?? []).length === 0 ? (
            <p className="text-center text-[12px] text-ink-faint py-4">غیرفعال‌سازی آینده‌ای ثبت نشده</p>
          ) : (
            <div className="divide-y divide-line rounded-md border border-line">
              {(exclusionsData?.exclusions ?? []).map((ex) => (
                <div key={ex.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium">{ex.reason}</p>
                    <p className="mt-0.5 text-[11px] text-ink-soft">
                      {formatJalali(new Date(ex.startAt), { withTime: true })} — {formatJalali(new Date(ex.endAt), { withTime: true })}
                    </p>
                  </div>
                  <button
                    onClick={() => removeExclusion(ex)}
                    className="rounded-md p-2 text-ink-faint hover:bg-red-50 hover:text-red-600"
                    aria-label="حذف"
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {isLoading ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SkeletonBlock className="h-4 w-32" />
          </div>
          <SkeletonTable rows={5} cols={7} />
        </Card>
      ) : (data?.rooms ?? []).length === 0 ? (
        <Card>
          <EmptyState
            title="هنوز اتاقی نساخته‌اید"
            description="اولین اتاق جلسه را بسازید تا رزرو و زمان‌بندی آغاز شود"
            action={<Button size="sm" onClick={openCreate}>ساخت اولین اتاق</Button>}
          />
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
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">طبقه</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">مدیر</th>
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
                    <td className="hidden px-4 py-3 text-ink-soft sm:table-cell">{r.floor?.name ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-ink-soft lg:table-cell">{r.manager?.fullName ?? "—"}</td>
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
                          onClick={() => openExclusions(r)}
                          className="rounded-md p-1.5 text-ink-soft hover:bg-paper-soft hover:text-ink"
                          title="تعمیر / غیرفعال موقت"
                          aria-label="غیرفعال‌سازی موقت"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                        </button>
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

function tehranInstant(isoDate: string, time: string): Date {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - 210 * 60000);
}
