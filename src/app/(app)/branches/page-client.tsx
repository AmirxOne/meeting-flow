"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, MapPin, Phone, User, Plus, Pencil, Trash2, Power, Layers } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-store";
import { IconTipButton } from "@/components/ui/tooltip";
import { cn, faNum, faStr } from "@/lib";
import { FaInput } from "@/components/ui/fa-input";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  manager: { id: string; fullName: string } | null;
  wayfindingText: string | null;
  hasMap: boolean;
  floors: { id: string; name: string; number: number; wayfindingText: string | null; hasMap: boolean }[];
  _count: { rooms: number; users: number; meetings: number };
}

interface Manager {
  id: string;
  fullName: string;
}

export function BranchesPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const { can } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "", managerId: "", wayfindingText: "" });
  const [floorBranch, setFloorBranch] = useState<Branch | null>(null);
  const [floorEditing, setFloorEditing] = useState<{
    id: string;
    name: string;
    number: number;
    wayfindingText: string | null;
    hasMap: boolean;
  } | null>(null);
  const [floorForm, setFloorForm] = useState({ name: "", number: "", wayfindingText: "" });
  const [floorBusy, setFloorBusy] = useState(false);
  const [mapBusy, setMapBusy] = useState(false);
  const [mapRev, setMapRev] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: Branch[]; canManage: boolean }>("/api/branches"),
  });

  const { data: managersData } = useQuery({
    queryKey: ["users-lite"],
    queryFn: () => api<{ users: Manager[] }>("/api/users"),
    enabled: can("branch:update"),
  });

  const canManage = data?.canManage ?? false;
  const branches = data?.branches ?? [];

  function openCreate() {
    setEditing(null);
    setForm({ name: "", address: "", phone: "", managerId: "", wayfindingText: "" });
    setShowForm(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({
      name: b.name,
      address: b.address ?? "",
      phone: b.phone ?? "",
      managerId: b.manager?.id ?? "",
      wayfindingText: b.wayfindingText ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        managerId: form.managerId || null,
        wayfindingText: form.wayfindingText.trim() || null,
      };
      if (editing) {
        await api(`/api/branches/${editing.id}`, { method: "PATCH", json: payload });
        push("شعبه ویرایش شد", "success");
      } else {
        await api("/api/branches", { method: "POST", json: payload });
        push("شعبه ایجاد شد", "success");
      }
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(b: Branch) {
    try {
      await api(`/api/branches/${b.id}`, {
        method: "PATCH",
        json: { isActive: !b.isActive },
      });
      push(b.isActive ? "شعبه غیرفعال شد" : "شعبه فعال شد", "success");
      qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    }
  }

  async function remove(b: Branch) {
    if (!confirm(`حذف «${b.name}»؟ این عمل بازگشت‌پذیر نیست.`)) return;
    try {
      await api(`/api/branches/${b.id}`, { method: "DELETE" });
      push("شعبه حذف شد", "success");
      qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    }
  }

  function openFloors(b: Branch) {
    setFloorBranch(b);
    setFloorEditing(null);
    setFloorForm({ name: "", number: "", wayfindingText: "" });
  }

  function openFloorEdit(f: { id: string; name: string; number: number; wayfindingText: string | null; hasMap: boolean }) {
    setFloorEditing(f);
    setFloorForm({ name: f.name, number: String(f.number), wayfindingText: f.wayfindingText ?? "" });
  }

  async function saveFloor() {
    if (!floorBranch) return;
    const number = Number(floorForm.number);
    if (!floorForm.name.trim() || !Number.isInteger(number)) {
      push("نام و شماره طبقه را وارد کنید", "error");
      return;
    }
    setFloorBusy(true);
    try {
      const payload = {
        name: floorForm.name.trim(),
        number,
        wayfindingText: floorForm.wayfindingText.trim() || null,
      };
      if (floorEditing) {
        await api(`/api/branches/${floorBranch.id}/floors/${floorEditing.id}`, {
          method: "PATCH",
          json: payload,
        });
        push("طبقه ویرایش شد", "success");
      } else {
        await api(`/api/branches/${floorBranch.id}/floors`, { method: "POST", json: payload });
        push("طبقه اضافه شد", "success");
      }
      setFloorEditing(null);
      setFloorForm({ name: "", number: "", wayfindingText: "" });
      qc.invalidateQueries({ queryKey: ["branches"] });
      const refreshed = await api<{ branches: Branch[] }>("/api/branches");
      const next = refreshed.branches.find((x) => x.id === floorBranch.id);
      if (next) setFloorBranch(next);
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setFloorBusy(false);
    }
  }

  async function removeFloor(f: { id: string; name: string }) {
    if (!floorBranch) return;
    if (!confirm(`حذف «${f.name}»؟`)) return;
    setFloorBusy(true);
    try {
      await api(`/api/branches/${floorBranch.id}/floors/${f.id}`, { method: "DELETE" });
      push("طبقه حذف شد", "success");
      setFloorEditing(null);
      setFloorForm({ name: "", number: "", wayfindingText: "" });
      qc.invalidateQueries({ queryKey: ["branches"] });
      const refreshed = await api<{ branches: Branch[] }>("/api/branches");
      const next = refreshed.branches.find((x) => x.id === floorBranch.id);
      if (next) setFloorBranch(next);
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setFloorBusy(false);
    }
  }

  async function refreshBranchState(branchId: string) {
    qc.invalidateQueries({ queryKey: ["branches"] });
    const refreshed = await api<{ branches: Branch[] }>("/api/branches");
    const next = refreshed.branches.find((x) => x.id === branchId);
    if (next) {
      setFloorBranch((cur) => (cur?.id === branchId ? next : cur));
      setEditing((cur) => (cur?.id === branchId ? next : cur));
    }
    setMapRev((n) => n + 1);
  }

  async function uploadMap(url: string, file: File | undefined) {
    if (!file) return;
    setMapBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api(url, { method: "POST", body: fd });
      push("نقشه ذخیره شد", "success");
      if (editing) await refreshBranchState(editing.id);
      else if (floorBranch) await refreshBranchState(floorBranch.id);
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setMapBusy(false);
    }
  }

  async function deleteMap(url: string, branchId: string) {
    setMapBusy(true);
    try {
      await api(url, { method: "DELETE" });
      push("نقشه حذف شد", "success");
      await refreshBranchState(branchId);
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setMapBusy(false);
    }
  }

  // While the floors modal is open, trust floorBranch (refreshed after each mutation).
  // Using branches[] here caused stale React Query cache to override fresh floorBranch.floors.
  const floorList = floorBranch?.floors ?? [];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">شعب</h1>
          <p className="mt-1 text-[12px] text-ink-soft" data-tour="branch-map">
            راهنمای متنی و نقشهٔ مهمان را از ویرایش شعبه (دسکتاپ) یا طبقات تنظیم کنید.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            شعبه جدید
          </Button>
        )}
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `ویرایش ${editing.name}` : "شعبه جدید"}
        subtitle="شعبه‌های سازمان — هر شعبه اتاق‌ها و کاربران خود را دارد"
        wide
        footer={
          <div className="flex gap-2">
            <Button onClick={save} loading={busy} disabled={form.name.trim().length < 2}>
              {editing ? "ذخیره تغییرات" : "ایجاد شعبه"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              انصراف
            </Button>
          </div>
        }
      >
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          placeholder="نام شعبه *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
        />
        <FaInput
          allow="phone"
          placeholder="تلفن"
          value={form.phone}
          onChange={(phone) => setForm({ ...form, phone })}
        />
        <input
          placeholder="آدرس"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink sm:col-span-2"
        />
        {managersData && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] text-ink-soft">مدیر شعبه</label>
            <Select
              value={form.managerId}
              onChange={(v) => setForm({ ...form, managerId: v })}
              placeholder="بدون مدیر"
              options={managersData.users.map((u) => ({ value: u.id, label: u.fullName }))}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] text-ink-soft">راهنمای متنی مهمان (مسیر رسیدن به اتاق‌ها)</label>
          <textarea
            value={form.wayfindingText}
            onChange={(e) => setForm({ ...form, wayfindingText: e.target.value })}
            rows={3}
            maxLength={500}
            placeholder="مثلاً از لابی آسانسور سمت راست…"
            className="w-full rounded-md border border-line px-3 py-2 text-[12px] outline-none focus:border-ink"
          />
        </div>
        {editing && (
          <div className="sm:col-span-2">
            <MapFileField
              label="نقشه شعبه"
              hasMap={editing.hasMap}
              previewSrc={`/api/branches/${editing.id}/map?v=${mapRev}`}
              busy={mapBusy}
              onUpload={(file) => uploadMap(`/api/branches/${editing.id}/map`, file)}
              onDelete={() => deleteMap(`/api/branches/${editing.id}/map`, editing.id)}
            />
          </div>
        )}
        
        </div>
      </Modal>

      <Modal
        open={!!floorBranch}
        onClose={() => setFloorBranch(null)}
        title={floorBranch ? `طبقات ${floorBranch.name}` : "طبقات"}
        subtitle="هر طبقه می‌تواند چند اتاق داشته باشد"
        wide
        footer={
          <Button variant="ghost" onClick={() => setFloorBranch(null)}>
            بستن
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              data-testid="floor-name-input"
              placeholder="نام طبقه *"
              value={floorForm.name}
              onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })}
              className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
            />
            <FaInput
              data-testid="floor-number-input"
              placeholder="شماره طبقه *"
              value={floorForm.number}
              onChange={(number) => setFloorForm({ ...floorForm, number })}
            />
            <input
              placeholder="راهنمای این طبقه (اختیاری)"
              value={floorForm.wayfindingText}
              onChange={(e) => setFloorForm({ ...floorForm, wayfindingText: e.target.value })}
              className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink sm:col-span-3"
            />
            <div className="flex gap-2 sm:col-span-3">
              <Button
                data-testid="floor-save-btn"
                onClick={saveFloor}
                loading={floorBusy}
                disabled={floorForm.name.trim().length < 1 || floorForm.number === ""}
              >
                {floorEditing ? "ذخیره" : "افزودن طبقه"}
              </Button>
              {floorEditing && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFloorEditing(null);
                    setFloorForm({ name: "", number: "", wayfindingText: "" });
                  }}
                >
                  انصراف
                </Button>
              )}
            </div>
          </div>

          {floorList.length === 0 ? (
            <p className="text-center text-[12px] text-ink-faint py-4">هنوز طبقه‌ای ثبت نشده</p>
          ) : (
            <div className="divide-y divide-line rounded-md border border-line">
              {floorList.map((f) => (
                <div
                  key={f.id}
                  data-testid="floor-row"
                  data-floor-id={f.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-[13px] font-medium">{f.name}</p>
                    <p className="text-[11px] text-ink-soft">
                      شماره {faNum(f.number)}
                      {f.hasMap ? " · نقشه دارد" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {floorBranch && (
                      <div className="hidden md:block">
                        <MapFileField
                          compact
                          hasMap={f.hasMap}
                          previewSrc={`/api/branches/${floorBranch.id}/floors/${f.id}/map?v=${mapRev}`}
                          busy={mapBusy}
                          onUpload={(file) =>
                            uploadMap(`/api/branches/${floorBranch.id}/floors/${f.id}/map`, file)
                          }
                          onDelete={() =>
                            deleteMap(`/api/branches/${floorBranch.id}/floors/${f.id}/map`, floorBranch.id)
                          }
                        />
                      </div>
                    )}
                    <IconTipButton
                      tip="ویرایش"
                      onClick={() => openFloorEdit(f)}
                      className="rounded-md p-2 text-ink-soft hover:bg-paper-soft hover:text-ink"
                    >
                      <Pencil className="h-4 w-4" />
                    </IconTipButton>
                    <IconTipButton
                      tip="حذف"
                      onClick={() => removeFloor(f)}
                      className="rounded-md p-2 text-ink-faint hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconTipButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="skeleton h-7 w-24" />
            <div className="skeleton h-8 w-28 rounded-md" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="skeleton h-5 w-28" />
                      <div className="skeleton h-5 w-12 rounded-full" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="skeleton h-3 w-44" />
                      <div className="skeleton h-3 w-32" />
                      <div className="skeleton h-3 w-36" />
                    </div>
                    <div className="flex gap-1.5">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <div key={j} className="skeleton h-5 w-16 rounded-full" />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="skeleton h-8 w-8 rounded-md" />
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : branches.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 className="h-10 w-10" />} title="شعبه‌ای ثبت نشده" description="هر شعبه اتاق‌ها و کاربران خود را دارد — اولین شعبه را بسازید" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {branches.map((b) => (
            <Card key={b.id} className={cn("p-5", !b.isActive && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-bold">{b.name}</p>
                    <span className={cn("badge", b.isActive ? "badge-green" : "badge-gray")}>
                      {b.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 text-[12px] text-ink-soft">
                    {b.address && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {b.address}
                      </p>
                    )}
                    {b.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        <span dir="ltr">{faStr(b.phone)}</span>
                      </p>
                    )}
                    {b.manager && (
                      <p className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        مدیر: {b.manager.fullName}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="badge badge-gray">{faNum(b._count.rooms)} اتاق</span>
                    <span className="badge badge-gray">{faNum(b._count.users)} کاربر</span>
                    <span className="badge badge-gray">{faNum(b._count.meetings)} جلسه</span>
                    {b.floors.map((f) => (
                      <span key={f.id} className="badge badge-gray">{f.name}</span>
                    ))}
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <IconTipButton
                      tip="مدیریت طبقات"
                      onClick={() => openFloors(b)}
                      className="rounded-md p-2 text-ink-soft hover:bg-paper-soft hover:text-ink"
                    >
                      <Layers className="h-4 w-4" />
                    </IconTipButton>
                    <IconTipButton
                      tip="ویرایش"
                      onClick={() => openEdit(b)}
                      className="rounded-md p-2 text-ink-soft hover:bg-paper-soft hover:text-ink"
                    >
                      <Pencil className="h-4 w-4" />
                    </IconTipButton>
                    <IconTipButton
                      tip={b.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                      onClick={() => toggleActive(b)}
                      className="rounded-md p-2 text-ink-soft hover:bg-paper-soft hover:text-ink"
                    >
                      <Power className="h-4 w-4" />
                    </IconTipButton>
                    <IconTipButton
                      tip="حذف"
                      onClick={() => remove(b)}
                      className="rounded-md p-2 text-ink-faint hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconTipButton>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MapFileField({
  label,
  hasMap,
  previewSrc,
  busy,
  compact,
  onUpload,
  onDelete,
}: {
  label?: string;
  hasMap: boolean;
  previewSrc: string;
  busy: boolean;
  compact?: boolean;
  onUpload: (file: File | undefined) => void;
  onDelete: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("space-y-2", compact && "space-y-1")}>
      {label && <p className="text-[11px] font-medium text-ink-soft">{label}</p>}
      <p className="text-[11px] text-ink-faint md:hidden">آپلود نقشه فقط از رایانه رومیزی ممکن است.</p>
      <div className="hidden md:block space-y-2">
        {hasMap && !compact && (
          // Admin preview of uploaded plan — API stream, not a static asset.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt={label ?? "نقشه"}
            className="max-h-40 w-full rounded-md border border-line bg-white object-contain"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            {hasMap ? "تعویض نقشه" : "آپلود نقشه"}
          </Button>
          {hasMap && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDelete}>
              حذف نقشه
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            onUpload(file);
          }}
        />
        {!compact && (
          <p className="text-[11px] text-ink-faint">تصویر ساده پلان — JPG یا PNG، حداکثر ۲ مگابایت</p>
        )}
      </div>
    </div>
  );
}
