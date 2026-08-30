"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { cn, faNum } from "@/lib";

interface RoleRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionKeys: string[];
}

interface CatalogGroup {
  group: string;
  permissions: { key: string; name: string }[];
}

const emptyForm = {
  key: "",
  name: "",
  description: "",
  permissionKeys: [] as string[],
};

export default function AdminRolesPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => api<{ roles: RoleRow[]; catalog: CatalogGroup[] }>("/api/admin/roles"),
    enabled: can("role:manage"),
  });

  const catalog = data?.catalog ?? [];
  const permissionName = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of catalog) {
      for (const p of g.permissions) map.set(p.key, p.name);
    }
    return map;
  }, [catalog]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(role: RoleRow) {
    setEditing(role);
    setForm({
      key: role.key,
      name: role.name,
      description: role.description ?? "",
      permissionKeys: [...role.permissionKeys],
    });
    setShowForm(true);
  }

  function togglePermission(key: string) {
    setForm((f) => ({
      ...f,
      permissionKeys: f.permissionKeys.includes(key)
        ? f.permissionKeys.filter((k) => k !== key)
        : [...f.permissionKeys, key],
    }));
  }

  async function save() {
    setBusy(true);
    try {
      if (editing) {
        await api(`/api/admin/roles/${editing.id}`, {
          method: "PATCH",
          json: {
            name: form.name.trim(),
            description: form.description.trim() || null,
            permissionKeys: form.permissionKeys,
          },
        });
        push("نقش به‌روزرسانی شد", "success");
      } else {
        await api("/api/admin/roles", {
          method: "POST",
          json: {
            key: form.key.trim().toUpperCase(),
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            permissionKeys: form.permissionKeys,
          },
        });
        push("نقش ایجاد شد", "success");
      }
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(role: RoleRow) {
    if (!confirm(`حذف نقش «${role.name}»؟`)) return;
    setBusy(true);
    try {
      await api(`/api/admin/roles/${role.id}`, { method: "DELETE" });
      push("نقش حذف شد", "success");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!can("role:manage")) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-[13px] text-ink-soft">
          مدیریت نقش‌ها نیازمند دسترسی role:manage است.
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <SkeletonBlock className="h-7 w-40" />
        <SkeletonBlock className="h-48 w-full" />
      </div>
    );
  }

  const roles = data?.roles ?? [];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Shield className="h-5 w-5" />
            مدیریت نقش‌ها
          </h1>
          <p className="mt-0.5 text-[12px] text-ink-soft">
            نقش‌های سفارشی قابل ویرایش؛ نقش‌های سیستمی فقط مشاهده
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          نقش جدید
        </Button>
      </div>

      <Card>
        <CardHeader title={`${faNum(roles.length)} نقش`} subtitle="دسترسی‌ها از کاتالوگ PERMISSIONS" />
        <CardBody className="divide-y divide-line p-0">
          {roles.length === 0 ? (
            <EmptyState title="نقشی یافت نشد" description="با seed نقش‌های پیش‌فرض ساخته می‌شوند." />
          ) : (
            roles.map((role) => (
              <div key={role.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-bold">{role.name}</p>
                    <span className="badge badge-gray font-mono text-[10px]" dir="ltr">
                      {role.key}
                    </span>
                    {role.isSystem && <span className="badge badge-amber text-[10px]">سیستمی</span>}
                    <span className="text-[11px] text-ink-faint">{faNum(role.userCount)} کاربر</span>
                  </div>
                  {role.description && (
                    <p className="mt-1 text-[12px] text-ink-soft">{role.description}</p>
                  )}
                  <p className="mt-2 text-[11px] text-ink-faint">
                    {faNum(role.permissionKeys.length)} دسترسی
                    {role.permissionKeys.slice(0, 4).map((k) => (
                      <span key={k} className="mr-1 inline-block rounded bg-paper-soft px-1.5 py-0.5">
                        {permissionName.get(k) ?? k}
                      </span>
                    ))}
                    {role.permissionKeys.length > 4 ? "…" : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!role.isSystem && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openEdit(role)}>
                        <Pencil className="h-3.5 w-3.5" />
                        ویرایش
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || role.userCount > 0}
                        onClick={() => remove(role)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </Button>
                    </>
                  )}
                  {role.isSystem && (
                    <span className="text-[11px] text-ink-faint">نقش سیستمی — فقط‌خواندنی</span>
                  )}
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `ویرایش ${editing.name}` : "نقش جدید"}
        subtitle="دسترسی‌ها را از چک‌لیست انتخاب کنید"
        wide
        footer={
          <div className="flex gap-2">
            <Button
              onClick={save}
              loading={busy}
              disabled={
                !!editing?.isSystem ||
                !form.name.trim() ||
                form.permissionKeys.length === 0 ||
                (!editing && !/^[A-Z][A-Z0-9_]{1,48}$/.test(form.key.trim().toUpperCase()))
              }
            >
              {editing ? "ذخیره" : "ایجاد نقش"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              انصراف
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {!editing && (
            <Field label="کلید نقش (لاتین)">
              <input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })}
                dir="ltr"
                placeholder="CUSTOM_ROLE"
                className="h-10 w-full rounded-md border border-line px-3 font-mono text-[13px]"
              />
            </Field>
          )}
          <Field label="نام نمایشی">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={!!editing?.isSystem}
              className="h-10 w-full rounded-md border border-line px-3 text-[13px]"
            />
          </Field>
          <Field label="توضیحات">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              disabled={!!editing?.isSystem}
              className="h-10 w-full rounded-md border border-line px-3 text-[13px]"
            />
          </Field>
          <div className="space-y-3">
            <p className="text-[12px] font-medium text-ink-soft">دسترسی‌ها</p>
            {catalog.map((group) => (
              <div key={group.group} className="rounded-md border border-line p-3">
                <p className="mb-2 text-[11px] font-bold text-ink-faint">{group.group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.permissions.map((p) => {
                    const sel = form.permissionKeys.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        disabled={!!editing?.isSystem}
                        onClick={() => togglePermission(p.key)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px]",
                          sel ? "border-ink bg-ink text-white" : "border-line text-ink-soft",
                          editing?.isSystem && "opacity-50",
                        )}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
