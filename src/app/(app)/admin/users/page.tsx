"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, ShieldCheck } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const ROLE_KEYS = ["SUPER_ADMIN", "ADMIN", "MEETING_OPERATOR", "BRANCH_MANAGER", "ROOM_MANAGER", "EMPLOYEE"];
const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: "مدیر ارشد", ADMIN: "مدیر سیستم", MEETING_OPERATOR: "اپراتور جلسات",
  BRANCH_MANAGER: "مدیر شعبه", ROOM_MANAGER: "مدیر اتاق", EMPLOYEE: "کارمند",
};

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const { me } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: "", fullName: "", password: "", jobTitle: "", roleKeys: ["EMPLOYEE"],
  });
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ users: AdminUser[] }>("/api/users"),
  });

  async function createUser() {
    setBusy(true);
    try {
      await api("/api/users", { method: "POST", json: form });
      push("کاربر ایجاد شد", "success");
      setShowForm(false);
      setForm({ email: "", fullName: "", password: "", jobTitle: "", roleKeys: ["EMPLOYEE"] });
      qc.invalidateQueries({ queryKey: ["users"] });
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

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">مدیریت کاربران</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <UserPlus className="h-4 w-4" />
          کاربر جدید
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input dir="ltr" placeholder="ایمیل" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
            <input dir="ltr" placeholder="رمز موقت" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
            <input placeholder="نام کامل" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
            <input placeholder="عنوان شغلی" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[11px] text-ink-soft">نقش‌ها</p>
              <div className="flex flex-wrap gap-1.5">
                {ROLE_KEYS.map((r) => {
                  const sel = form.roleKeys.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          roleKeys: sel ? form.roleKeys.filter((x) => x !== r) : [...form.roleKeys, r],
                        })
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[12px]",
                        sel ? "border-ink bg-ink text-white" : "border-line text-ink-soft",
                      )}
                    >
                      {ROLE_NAMES[r]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Button onClick={createUser} loading={busy} disabled={!form.email || !form.fullName || form.password.length < 6 || form.roleKeys.length === 0}>
                ایجاد کاربر
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <SkeletonBlock className="h-96" />
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
                          <span key={r.role.key} className="badge badge-gray">{r.role.name}</span>
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
                        <button
                          onClick={() => toggleActive(u)}
                          className={cn("text-[11px] underline", u.isActive ? "text-red-600" : "text-emerald-600")}
                        >
                          {u.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        </button>
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
