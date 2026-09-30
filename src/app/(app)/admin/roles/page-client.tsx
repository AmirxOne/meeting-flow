"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Users } from "@/components/ui/icon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Shield } from "@/components/ui/icon";
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

export function AdminRolesPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<RoleRow | null>(null);

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

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/admin/roles/${deleting.id}`, { method: "DELETE" });
      push("نقش حذف شد", "success");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!can("role:manage")) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-bold leading-tight">نقش‌ها و دسترسی‌ها</h1>
            <p className="mt-0.5 text-[12px] text-ink-soft">
              {faNum(roles.length)} نقش — نقش‌های سفارشی قابل ویرایش؛ نقش‌های سیستمی فقط مشاهده
            </p>
          </div>
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
            <EmptyState title="نقشی یافت نشد" description="با seed نقش‌های پیش‌فرض ساخته می‌شوند." compact />
          ) : (
            roles.map((role) => {
              const totalPerms = catalog.reduce((n, g) => n + g.permissions.length, 0) || 1;
              const pct = Math.round((role.permissionKeys.length / totalPerms) * 100);
              return (
                <div key={role.id} data-role={role.key} className="group px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        role.isSystem ? "bg-amber-50 text-amber-700" : "bg-paper-soft text-ink-soft",
                      )}
                    >
                      <Shield className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-bold">{role.name}</p>
                        <span className="badge badge-gray font-mono text-[10px]" dir="ltr">
                          {role.key}
                        </span>
                        {role.isSystem && <span className="badge badge-amber text-[10px]">سیستمی — فقط‌خواندنی</span>}
                        <span className="flex items-center gap-1 text-[11px] text-ink-faint">
                          <Users className="h-3.5 w-3.5" />
                          {faNum(role.userCount)} کاربر
                        </span>
                      </div>
                      {role.description && (
                        <p className="mt-1 text-[12px] leading-5 text-ink-soft">{role.description}</p>
                      )}
                      {/* نوار سطح دسترسی */}
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-paper-deep">
                          <div
                            className={cn("h-full rounded-full", pct >= 80 ? "bg-red-400" : pct >= 40 ? "bg-amber-400" : "bg-emerald-500")}
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                        <span className="text-[10.5px] text-ink-faint">
                          {faNum(role.permissionKeys.length)} از {faNum(totalPerms)} دسترسی ({faNum(pct)}٪)
                        </span>
                      </div>
                      {/* چیپ‌های مجوز */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {role.permissionKeys.slice(0, 6).map((k) => (
                          <span key={k} className="rounded-full border border-line bg-paper-soft px-2 py-0.5 text-[10px] text-ink-soft">
                            {permissionName.get(k) ?? k}
                          </span>
                        ))}
                        {role.permissionKeys.length > 6 && (
                          <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-[10px] text-ink-faint">
                            +{faNum(role.permissionKeys.length - 6)} مجوز دیگر
                          </span>
                        )}
                        {role.permissionKeys.length === 0 && (
                          <span className="text-[10.5px] text-ink-faint">بدون دسترسی</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(role)}>
                        <Pencil className="h-3.5 w-3.5" />
                        ویرایش
                      </Button>
                      {!role.isSystem && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || role.userCount > 0}
                          onClick={() => setDeleting(role)}
                          title={role.userCount > 0 ? "ابتدا کاربران این نقش را جابه‌جا کنید" : undefined}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              انصراف
            </Button><Button
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
          </div>
        }
      >
        <div className="space-y-4">
          {!editing && (
            <Field label="شناسه‌ی فنی نقش">
              <div className="flex items-center gap-2">
                <input
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })}
                  dir="ltr"
                  placeholder="مثلاً SALES_MANAGER"
                  className="h-10 w-full rounded-md border border-line px-3 font-mono text-[13px]"
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, key: `ROLE_${Math.random().toString(36).slice(2, 7).toUpperCase()}` }))}
                  className="h-10 shrink-0 rounded-md border border-dashed border-line px-3 text-[11px] text-ink-soft transition hover:border-ink/40 hover:text-ink"
                  title="یک شناسه‌ی مناسب تولید کنید"
                >
                  تولید خودکار
                </button>
              </div>
              <span className="block text-[10.5px] leading-4 text-ink-faint">
                یک کد انگلیسی اختیاری برای استفاده‌ی داخلی سیستم — کاربران آن را نمی‌بینند. اگر ایده‌ای ندارید «تولید خودکار» را بزنید.
              </span>
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
            <div className="flex items-center justify-between rounded-lg border border-line bg-paper-soft/60 px-3.5 py-2.5">
              <p className="text-[12px] font-medium">
                دسترسی‌ها
                <span className="mr-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">
                  {faNum(form.permissionKeys.length)} انتخاب
                </span>
              </p>
              {form.permissionKeys.length > 0 && !editing?.isSystem && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, permissionKeys: [] }))}
                  className="text-[11px] text-ink-soft underline-offset-2 hover:text-danger hover:underline"
                >
                  پاک‌کردن همه
                </button>
              )}
            </div>
            {catalog.map((group) => {
              const groupKeys = group.permissions.map((p) => p.key);
              const selectedCount = groupKeys.filter((k) => form.permissionKeys.includes(k)).length;
              const allSelected = selectedCount === groupKeys.length;
              const someSelected = selectedCount > 0 && !allSelected;
              return (
                <div key={group.group} className="rounded-lg border border-line">
                  <div className="flex items-center justify-between gap-2 border-b border-line/70 px-3.5 py-2.5">
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => ({ ...c, [group.group]: !c[group.group] }))}
                      className="flex items-center gap-1.5 text-[12px] font-bold text-ink"
                    >
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", collapsed[group.group] && "-rotate-90")} />
                      {group.group}
                      <span className="text-[10px] font-normal text-ink-faint">
                        ({faNum(selectedCount)}/{faNum(groupKeys.length)})
                      </span>
                    </button>
                    {!editing?.isSystem && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            permissionKeys: allSelected
                              ? f.permissionKeys.filter((k) => !groupKeys.includes(k))
                              : Array.from(new Set([...f.permissionKeys, ...groupKeys])),
                          }))
                        }
                        className="rounded-md border border-line px-2 py-1 text-[10px] text-ink-soft transition hover:border-ink/40 hover:text-ink"
                      >
                        {allSelected ? "حذف گروه" : "انتخاب گروه"}
                      </button>
                    )}
                  </div>
                  {!collapsed[group.group] && (
                    <div className={cn("flex flex-wrap gap-1.5 p-3", someSelected && "bg-amber-50/40")}>
                      {group.permissions.map((p) => {
                        const sel = form.permissionKeys.includes(p.key);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            disabled={!!editing?.isSystem}
                            onClick={() => togglePermission(p.key)}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] transition",
                              sel
                                ? "border-ink bg-ink text-white"
                                : "border-line text-ink-soft hover:border-ink/40 hover:text-ink",
                              editing?.isSystem && "opacity-50",
                            )}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* مودال تأیید حذف نقش */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`حذف نقش «${deleting?.name ?? ""}»`}
        subtitle="این عملیات قابل بازگشت نیست"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              انصراف
            </Button>
            <Button onClick={remove} loading={busy}>
              <Trash2 className="h-4 w-4" />
              حذف قطعی
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] leading-6">
            نقش <span className="font-bold">{deleting?.name}</span>
            {deleting ? <span className="badge badge-gray mr-1.5 font-mono text-[10px]" dir="ltr">{deleting.key}</span> : null} حذف شود؟
          </p>
          <p className="text-[12px] leading-6 text-ink-soft">
            این نقش به هیچ کاربری اختصاص داده نشده و حذف آن بر دسترسی کسی تأثیری نمی‌گذارد.
            اگر بعداً لازم شد، می‌توانید نقشی با همین مجوزها دوباره بسازید.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block space-y-1.5">
      <span className="block text-[12px] font-medium text-ink-soft">{label}</span>
      {children}
    </div>
  );
}
