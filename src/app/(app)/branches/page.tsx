"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, MapPin, Phone, User, Plus, Pencil, Trash2, Power } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-store";
import { cn, faNum, faStr } from "@/lib";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  manager: { id: string; fullName: string } | null;
  floors: { id: string; name: string; number: number }[];
  _count: { rooms: number; users: number; meetings: number };
}

interface Manager {
  id: string;
  fullName: string;
}

export default function BranchesPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const { can } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "", managerId: "" });

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
    setForm({ name: "", address: "", phone: "", managerId: "" });
    setShowForm(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({
      name: b.name,
      address: b.address ?? "",
      phone: b.phone ?? "",
      managerId: b.manager?.id ?? "",
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

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">شعب</h1>
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
        <input
          placeholder="تلفن"
          dir="ltr"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
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
          <EmptyState icon={<Building2 className="h-10 w-10" />} title="شعبه‌ای ثبت نشده" />
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
                    <button
                      onClick={() => openEdit(b)}
                      className="rounded-md p-2 text-ink-soft hover:bg-paper-soft hover:text-ink"
                      aria-label="ویرایش"
                      title="ویرایش"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(b)}
                      className="rounded-md p-2 text-ink-soft hover:bg-paper-soft hover:text-ink"
                      aria-label={b.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                      title={b.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(b)}
                      className="rounded-md p-2 text-ink-faint hover:bg-red-50 hover:text-red-600"
                      aria-label="حذف"
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
