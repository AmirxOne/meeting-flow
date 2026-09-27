"use client";

/**
 * ابزارهای مدیریتی کاربر — مودال‌های ساخت/ویرایش/بازنشانی رمز + اکشن‌های فعال‌سازی.
 * از /admin/users استخراج شده تا در جدول تب «اعضای شرکت» هم استفاده شود.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { cn, faStr, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib";
import { FaInput } from "@/components/ui/fa-input";
import type { Colleague } from "@/lib/colleague-directory";

interface RoleOption { key: string; name: string }
interface BranchOption { id: string; name: string }

export const emptyCreateForm = {
  email: "",
  fullName: "",
  password: "",
  phone: "",
  jobTitle: "",
  department: "",
  branchId: "",
  roleKeys: ["EMPLOYEE"] as string[],
};

export function RolePicker({
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
            onClick={() => onChange(sel ? value.filter((x) => x !== r.key) : [...value, r.key])}
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

/**
 * همه‌ی مودال‌ها + state مدیریت کاربر در یک hook — استفاده در جدول اعضای شرکت.
 */
export function useUserManagement() {
  const qc = useQueryClient();
  const { push } = useToast();
  const { me, can } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Colleague | null>(null);
  const [resetUser, setResetUser] = useState<Colleague | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState({
    fullName: "", phone: "", jobTitle: "", department: "", branchId: "",
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
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: BranchOption[] }>("/api/branches"),
    enabled: can("user:update"),
  });
  const branchOptions = (branchesData?.branches ?? []).map((b) => ({ value: b.id, label: b.name }));

  function openEdit(u: Colleague) {
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

  function openReset(u: Colleague) {
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
      qc.invalidateQueries({ queryKey: ["colleagues"] });
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
      qc.invalidateQueries({ queryKey: ["colleagues"] });
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

  async function toggleActive(u: Colleague) {
    try {
      await api(`/api/users/${u.id}`, { method: "PATCH", json: { isActive: !(u.isActive !== false) } });
      push(u.isActive !== false ? "کاربر غیرفعال شد" : "کاربر فعال شد", "success");
      qc.invalidateQueries({ queryKey: ["colleagues"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    }
  }

  const modals = (
    <>
      {/* ساخت کاربر */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="کاربر جدید"
        subtitle="حساب داخلی با رمز موقت ساخته می‌شود"
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={createUser} loading={busy} disabled={!createForm.email || !createForm.fullName || createForm.password.length < 6 || createForm.roleKeys.length === 0}>
              ایجاد کاربر
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>انصراف</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input dir="rtl" inputMode="email" placeholder="ایمیل *" value={createForm.email ? withRtlMark(faStr(createForm.email)) : ""} onChange={(e) => setCreateForm({ ...createForm, email: toEnDigits(stripBidiMarks(e.target.value)) })} className="h-10 rounded-md border border-line px-3 text-right text-[12px] outline-none focus:border-ink" />
          <input dir="rtl" placeholder="رمز موقت *" value={createForm.password ? withRtlMark(createForm.password) : ""} onChange={(e) => setCreateForm({ ...createForm, password: stripBidiMarks(e.target.value) })} className="h-10 rounded-md border border-line px-3 text-right text-[12px] outline-none focus:border-ink" />
          <input placeholder="نام کامل *" value={createForm.fullName} onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
          <input placeholder="عنوان شغلی" value={createForm.jobTitle} onChange={(e) => setCreateForm({ ...createForm, jobTitle: e.target.value })} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
          <input placeholder="دپارتمان" value={createForm.department} onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
          <FaInput allow="phone" placeholder="تلفن" value={createForm.phone} onChange={(phone) => setCreateForm({ ...createForm, phone })} />
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">شعبه</label>
            <Select value={createForm.branchId} onChange={(v) => setCreateForm({ ...createForm, branchId: v })} placeholder="انتخاب شعبه…" options={branchOptions} />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[11px] text-ink-soft">نقش‌ها *</p>
            <RolePicker roles={roleOptions} value={createForm.roleKeys} onChange={(roleKeys) => setCreateForm({ ...createForm, roleKeys })} />
          </div>
        </div>
      </Modal>

      {/* ویرایش */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `ویرایش ${editing.fullName}` : "ویرایش کاربر"}
        subtitle={editing?.email ?? undefined}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={saveEdit} loading={busy} disabled={!editForm.fullName.trim() || (manageRoles && editForm.roleKeys.length === 0)}>ذخیره تغییرات</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>انصراف</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input placeholder="نام کامل *" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
          <input placeholder="عنوان شغلی" value={editForm.jobTitle} onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
          <input placeholder="دپارتمان" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
          <FaInput allow="phone" placeholder="تلفن" value={editForm.phone} onChange={(phone) => setEditForm({ ...editForm, phone })} />
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">شعبه</label>
            <Select value={editForm.branchId} onChange={(v) => setEditForm({ ...editForm, branchId: v })} placeholder="بدون شعبه" options={branchOptions} />
          </div>
          {manageRoles && (
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[11px] text-ink-soft">نقش‌ها</p>
              <RolePicker roles={roleOptions} value={editForm.roleKeys} onChange={(roleKeys) => setEditForm({ ...editForm, roleKeys })} />
            </div>
          )}
        </div>
      </Modal>

      {/* بازنشانی رمز */}
      <Modal
        open={!!resetUser}
        onClose={() => setResetUser(null)}
        title={resetUser ? `بازنشانی رمز — ${resetUser.fullName}` : "بازنشانی رمز"}
        subtitle="کاربر باید با رمز جدید دوباره وارد شود"
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={resetPassword} loading={busy} disabled={newPassword.length < 6}>بازنشانی رمز</Button>
            <Button variant="ghost" onClick={() => setResetUser(null)}>انصراف</Button>
          </div>
        }
      >
        <input dir="rtl" type="password" name="new-password" autoComplete="new-password" placeholder="رمز جدید (حداقل ۶ کاراکتر)" value={newPassword ? withRtlMark(newPassword) : ""} onChange={(e) => setNewPassword(stripBidiMarks(e.target.value))} className="h-10 w-full rounded-md border border-line px-3 text-right text-[12px] outline-none focus:border-ink" />
      </Modal>
    </>
  );

  return {
    modals,
    openEdit,
    openReset,
    toggleActive,
    openCreate: () => setShowCreate(true),
    canCreate: can("user:create"),
    canEdit: can("user:update"),
    canReset: can("user:reset-password"),
    isSelf: (id: string) => me?.id === id,
  };
}
