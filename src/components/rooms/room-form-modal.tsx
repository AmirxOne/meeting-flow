"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { faNum } from "@/lib";
import { FaInput } from "@/components/ui/fa-input";
import { EquipmentPicker } from "@/components/rooms/equipment-picker";

export interface RoomFormData {
  id: string;
  name: string;
  capacity: number;
  isVip: boolean;
  isActive: boolean;
  branchId: string;
  openTime: string | null;
  closeTime: string | null;
  description: string | null;
  floor: { id: string; name: string } | null;
  manager: { id: string; fullName: string } | null;
  equipment: { equipment: string }[];
}

interface BranchOption {
  id: string;
  name: string;
  floors: { id: string; name: string; number: number }[];
}

/**
 * مودال ساخت/ویرایش اتاق — مشترک بین صفحه‌ی اتاق‌ها و جزئیات اتاق.
 */
export function RoomFormModal({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: RoomFormData | null; // null = ساخت
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
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
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: BranchOption[] }>("/api/branches"),
    enabled: open,
  });
  const { data: managersData } = useQuery({
    queryKey: ["users", "managers"],
    queryFn: () => api<{ users: { id: string; fullName: string }[] }>("/api/users"),
    enabled: open,
  });

  // هنگام باز شدن برای ویرایش، فرم را از داده‌ی اتاق پر کن (effect — نه داخل render)
  const hydrateKey = editing?.id ?? "__new__";
  useEffect(() => {
    if (!open || hydratedFor === hydrateKey) return;
    setHydratedFor(hydrateKey);
    setForm(
      editing
        ? {
            branchId: editing.branchId,
            floorId: editing.floor?.id ?? "",
            name: editing.name,
            capacity: String(editing.capacity),
            isVip: editing.isVip,
            equipment: editing.equipment.map((e) => e.equipment),
            openTime: editing.openTime ?? "",
            closeTime: editing.closeTime ?? "",
            description: editing.description ?? "",
            managerId: editing.manager?.id ?? "",
          }
        : {
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
          },
    );
  }, [open, hydrateKey, editing, hydratedFor]);

  const branches = branchesData?.branches ?? [];
  const managerOptions = (managersData?.users ?? []).map((u) => ({ value: u.id, label: u.fullName }));
  const activeBranchId = editing?.branchId ?? form.branchId;
  const floorOptions = branches.find((b) => b.id === activeBranchId)?.floors ?? [];

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
      onClose();
      setHydratedFor(null);
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["room"] });
      onSaved?.();
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `ویرایش ${editing.name}` : "اتاق جدید"}
      subtitle="اتاق جلسه در شعبه انتخابی ساخته می‌شود"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={save} loading={busy} disabled={!form.name.trim() || (!editing && !form.branchId)}>
            {editing ? "ذخیره تغییرات" : "ایجاد اتاق"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
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
              onChange={(v) => setForm({ ...form, branchId: v, floorId: "" })}
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
            options={floorOptions.map((f) => ({ value: f.id, label: `${f.name} (${faNum(f.number)})` }))}
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
        <FaInput placeholder="ظرفیت" value={form.capacity} onChange={(capacity) => setForm({ ...form, capacity })} />
        <FaInput
          allow="time"
          placeholder="ساعت باز"
          value={form.openTime}
          onChange={(openTime) => setForm({ ...form, openTime })}
        />
        <FaInput
          allow="time"
          placeholder="ساعت بسته"
          value={form.closeTime}
          onChange={(closeTime) => setForm({ ...form, closeTime })}
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
          <EquipmentPicker
            value={form.equipment}
            onChange={(equipment) => setForm({ ...form, equipment })}
          />
        </div>
      </div>
    </Modal>
  );
}
