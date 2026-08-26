"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-store";
import { cn, faNum } from "@/lib";

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  isActive: boolean;
  branch: { id: string; name: string } | null;
  roles: { role: { key: string; name: string } }[];
}

export default function UsersPage() {
  const { can } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ users: AdminUser[] }>("/api/users"),
    enabled: can("user:update"),
  });

  if (!can("user:update")) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-[13px] text-ink-soft">
          مشاهده فهرست کاربران نیازمند دسترسی مدیریت است.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <h1 className="text-lg font-bold">کاربران</h1>
      {isLoading ? (
        <SkeletonBlock className="h-72" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(data?.users ?? []).map((u) => (
            <Card key={u.id} className={cn("p-4", !u.isActive && "opacity-50")}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-soft text-[14px] font-bold">
                  {u.fullName.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold">{u.fullName}</p>
                  <p className="truncate text-[11px] text-ink-soft">{u.jobTitle ?? u.email}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {u.roles.map((r) => (
                  <span key={r.role.key} className="badge badge-gray">{r.role.name}</span>
                ))}
                {u.branch && <span className="badge badge-gray">{u.branch.name}</span>}
              </div>
            </Card>
          ))}
          {(data?.users ?? []).length === 0 && (
            <Card className="sm:col-span-2 xl:col-span-3">
              <EmptyState title="کاربری یافت نشد" />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
