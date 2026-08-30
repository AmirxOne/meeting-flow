"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, KeyRound, Power } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState, SkeletonBlock, SkeletonTable } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { cn, faNum } from "@/lib";

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  isActive: boolean;
  branch: { id: string; name: string } | null;
  roles: { role: { key: string; name: string } }[];
}

interface BranchOption {
  id: string;
  name: string;
}

interface RoleOption {
  key: string;
  name: string;
}

const emptyCreateForm = {
  email: "",
  fullName: "",
  password: "",
  phone: "",
  jobTitle: "",
  department: "",
  branchId: "",
  roleKeys: ["EMPLOYEE"] as string[],
};

function RolePicker({
  roles,
  value,
  onChange,
  disabled,
}: {
  roles: RoleOption[];
  value: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((r) => {
        const sel = value.includes(r.key);
        return (
          <button
            key={r.key}
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange(sel ? value.filter((x) => x !== r.key) : [...value, r.key])
            }
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px]",
              disabled && "cursor-not-allowed opacity-50",
              sel ? "border-ink bg-ink text-white" : "border-line text-ink-soft",
            )}
          >
            {r.name}
          </button>
        );
      })}
    </div>
  );
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const { me, can } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    jobTitle: "",
    department: "",
    branchId: "",
    roleKeys: [] as string[],
  });
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const manageRoles = can("role:manage");

  const { data: rolesData } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => api<{ roles: RoleOption[] }>("/api/admin/roles"),
    enabled: manageRoles,
  });
  const roleOptions: RoleOption[] = rolesData?.roles ?? [{ key: "EMPLOYEE", name: "کارمند" }];

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ users: AdminUser[] }>("/api/users"),
    enabled: can("user:update"),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: BranchOption[] }>("/api/branches"),
    enabled: can("user:update"),
  });

  const branchOptions = (branchesData?.branches ?? []).map((b) => ({
    value: b.id,
    label: b.name,
  }));

  function openEdit(u: AdminUser) {
    setEditing(u);
    setEditForm({
      fullName: u.fullName,
      phone: u.phone ?? "",
      jobTitle: u.jobTitle ?? "",
      department: u.department ?? "",
      branchId: u.branch?.id ?? "",
      roleKeys: u.roles.map((r) => r.role.key),
    });
  }

  function openReset(u: AdminUser) {
    setResetUser(u);
    setNewPassword("");
  }

  async function createUser() {
    setBusy(true);
    try {
      await api("/api/users", {
        method: "POST",
        json: {
          ...createForm,
          branchId: createForm.branchId || null,
          phone: createForm.phone || undefined,
          jobTitle: createForm.jobTitle || undefined,
          department: createForm.department || undefined,
        },
      });
      push("کاربر ایجاد شد", "success");
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim() || "",
        jobTitle: editForm.jobTitle.trim() || "",
        department: editForm.department.trim() || "",
        branchId: editForm.branchId || null,
      };
      if (manageRoles) payload.roleKeys = editForm.roleKeys;

      await api(`/api/users/${editing.id}`, { method: "PATCH", json: payload });
      push("کاربر ویرایش شد", "success");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!resetUser) return;
    setBusy(true);
    try {
      await api(`/api/users/${resetUser.id}/reset-password`, {
        method: "POST",
        json: { password: newPassword },
      });
      push("رمز عبور بازنشانی شد", "success");
      setResetUser(null);
      setNewPassword("");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: AdminUser) {
    try {
      await api(`/api/users/${u.id}`, {
        method: "PATCH",
        json: { isActive: !u.isActive },
      });
      push(u.isActive ? "کاربر غیرفعال شد" : "کاربر فعال شد", "success");
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    }
  }

  if (!can("user:update")) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-[13px] text-ink-soft">
          مدیریت کاربران نیازمند دسترسی user:update است.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">مدیریت کاربران</h1>
        {can("user:create") && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4" />
            کاربر جدید
          </Button>
        )}
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="کاربر جدید"
        subtitle="حساب داخلی با رمز موقت ساخته می‌شود"
        wide
        footer={
          <div className="flex gap-2">
            <Button
              onClick={createUser}
              loading={busy}
              disabled={
                !createForm.email ||
                !createForm.fullName ||
                createForm.password.length < 6 ||
                createForm.roleKeys.length === 0
              }
            >
              ایجاد کاربر
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              انصراف
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            dir="ltr"
            placeholder="ایمیل *"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <input
            dir="ltr"
            placeholder="رمز موقت *"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <input
            placeholder="نام کامل *"
            value={createForm.fullName}
            onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <input
            placeholder="عنوان شغلی"
            value={createForm.jobTitle}
            onChange={(e) => setCreateForm({ ...createForm, jobTitle: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <input
            placeholder="دپارتمان"
            value={createForm.department}
            onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <input
            dir="ltr"
            placeholder="تلفن"
            value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">شعبه</label>
            <Select
              value={createForm.branchId}
              onChange={(v) => setCreateForm({ ...createForm, branchId: v })}
              placeholder="انتخاب شعبه…"
              options={branchOptions}
            />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[11px] text-ink-soft">نقش‌ها *</p>
            <RolePicker
              roles={roleOptions}
              value={createForm.roleKeys}
              onChange={(roleKeys) => setCreateForm({ ...createForm, roleKeys })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `ویرایش ${editing.fullName}` : "ویرایش کاربر"}
        subtitle={editing?.email}
        wide
        footer={
          <div className="flex gap-2">
            <Button
              onClick={saveEdit}
              loading={busy}
              disabled={!editForm.fullName.trim() || (manageRoles && editForm.roleKeys.length === 0)}
            >
              ذخیره تغییرات
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              انصراف
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="نام کامل *"
            value={editForm.fullName}
            onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <input
            placeholder="عنوان شغلی"
            value={editForm.jobTitle}
            onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <input
            placeholder="دپارتمان"
            value={editForm.department}
            onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <input
            dir="ltr"
            placeholder="تلفن"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">شعبه</label>
            <Select
              value={editForm.branchId}
              onChange={(v) => setEditForm({ ...editForm, branchId: v })}
              placeholder="بدون شعبه"
              options={branchOptions}
            />
          </div>
          {manageRoles && (
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[11px] text-ink-soft">نقش‌ها</p>
              <RolePicker
                roles={roleOptions}
                value={editForm.roleKeys}
                onChange={(roleKeys) => setEditForm({ ...editForm, roleKeys })}
              />
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!resetUser}
        onClose={() => setResetUser(null)}
        title={resetUser ? `بازنشانی رمز — ${resetUser.fullName}` : "بازنشانی رمز"}
        subtitle="کاربر باید با رمز جدید دوباره وارد شود"
        footer={
          <div className="flex gap-2">
            <Button onClick={resetPassword} loading={busy} disabled={newPassword.length < 6}>
              بازنشانی رمز
            </Button>
            <Button variant="ghost" onClick={() => setResetUser(null)}>
              انصراف
            </Button>
          </div>
        }
      >
        <input
          dir="ltr"
          type="password"
          placeholder="رمز جدید (حداقل ۶ کاراکتر)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
        />
      </Modal>

      {isLoading ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SkeletonBlock className="h-4 w-40" />
          </div>
          <SkeletonTable rows={7} cols={6} />
        </Card>
      ) : (data?.users ?? []).length === 0 ? (
        <Card>
          <EmptyState title="کاربری یافت نشد" description="اولین کاربر را بسازید" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader title={`کاربران (${faNum(data?.users.length ?? 0)})`} />
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[12px]">
              <thead className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                <tr>
                  <th className="px-4 py-2.5 font-medium">نام</th>
                  <th className="px-4 py-2.5 font-medium">ایمیل</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">نقش‌ها</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">شعبه</th>
                  <th className="px-4 py-2.5 font-medium">وضعیت</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(data?.users ?? []).map((u) => (
                  <tr key={u.id} className={cn(!u.isActive && "opacity-50")}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.fullName}</p>
                      <p className="text-[10px] text-ink-faint">{u.jobTitle ?? ""}</p>
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      <span className="text-ink-soft">{u.email}</span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span key={r.role.key} className="badge badge-gray">
                            {r.role.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{u.branch?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("badge", u.isActive ? "badge-green" : "badge-gray")}>
                        {u.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {me?.id !== u.id && (
                        <div className="flex justify-end gap-1">
                          {can("user:update") && (
                            <button
                              onClick={() => openEdit(u)}
                              className="rounded-md p-1.5 text-ink-soft hover:bg-paper-soft hover:text-ink"
                              title="ویرایش"
                              aria-label="ویرایش"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {can("user:reset-password") && (
                            <button
                              onClick={() => openReset(u)}
                              className="rounded-md p-1.5 text-ink-soft hover:bg-paper-soft hover:text-ink"
                              title="بازنشانی رمز"
                              aria-label="بازنشانی رمز"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {can("user:update") && (
                            <button
                              onClick={() => toggleActive(u)}
                              className="rounded-md p-1.5 text-ink-soft hover:bg-paper-soft hover:text-ink"
                              title={u.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                              aria-label="تغییر وضعیت"
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
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
