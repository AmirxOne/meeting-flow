"use client";

/**
 * Product: colleague directory for all authenticated users.
 * Admin view: professional users table with availability multi-select + schedule bar.
 * Others: read-only colleague cards. Admin CRUD lives at /admin/users.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UsersAvailabilityTable } from "@/components/availability/users-availability-table";
import { Briefcase, Building2, Search, Settings2, UsersRound } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Button } from "@/components/ui/button";
import { useUserManagement } from "@/components/users/user-management";
import { UserPlus } from "@/components/ui/icon";
import { StaggerList, StaggerItem } from "@/components/ui/motion";
import { useAuth } from "@/lib/auth-store";
import { cn, faNum } from "@/lib";
import {
  filterColleagues,
  groupColleaguesByBranch,
  uniqueColleagueOptions,
  type Colleague,
} from "@/lib/colleague-directory";
import { UserAvatar } from "@/components/ui/user-avatar";

export function UsersPage({ embedded = false }: { embedded?: boolean }) {
  const { me, can } = useAuth();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ branchId: "", roleKey: "", department: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["colleagues"],
    queryFn: () => api<{ users: Colleague[] }>("/api/users"),
  });

  const users = data?.users ?? [];
  const options = useMemo(() => uniqueColleagueOptions(users), [users]);
  const visible = useMemo(
    () =>
      filterColleagues(users, {
        q,
        branchId: filters.branchId,
        roleKey: filters.roleKey,
        department: filters.department,
      }),
    [users, q, filters],
  );
  const isAdmin = can("user:update");
  const um = useUserManagement();
  const groups = useMemo(() => groupColleaguesByBranch(visible), [visible]);
  const departmentCount = new Set(users.map((u) => u.department).filter(Boolean)).size;
  const branchCount = new Set(users.map((u) => u.branch?.id).filter(Boolean)).size;

  return (
    <div className={embedded ? "space-y-4" : "space-y-4 p-4 lg:p-6"}>
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">کاربران</h1>
            <p className="mt-0.5 text-[12px] leading-6 text-ink-soft">
              همکارانی که <span className="font-medium text-ink">به سامانه لاگین می‌کنند</span> — با نقش، سمت و سطح دسترسی.
              {isAdmin && " افراد را برای اعلام زمان‌های آزاد انتخاب و زمان‌بندی کنید."}
            </p>
          </div>
        </div>
      )}


      {!isLoading && users.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="همکار" value={faNum(users.length)} icon={<UsersRound className="h-4 w-4" />} />
          <Stat label="شعبه" value={faNum(branchCount)} icon={<Building2 className="h-4 w-4" />} />
          <Stat label="واحد سازمانی" value={faNum(departmentCount)} icon={<Briefcase className="h-4 w-4" />} />
        </div>
      )}

      <div data-tour="users-filters">
        <FilterBar
          groups={[
            {
              key: "branchId",
              label: "شعبه",
              options: [{ value: "", label: "همه" }, ...options.branches],
            },
            {
              key: "roleKey",
              label: "نقش",
              options: [{ value: "", label: "همه" }, ...options.roles],
            },
            {
              key: "department",
              label: "واحد",
              options: [{ value: "", label: "همه" }, ...options.departments],
            },
          ]}
          value={filters}
          onChange={(next) =>
            setFilters({
              branchId: next.branchId ?? "",
              roleKey: next.roleKey ?? "",
              department: next.department ?? "",
            })
          }
        >
          <div className="flex h-9 min-w-48 flex-1 items-center gap-2 rounded-md border border-line bg-white px-3">
            <Search className="h-4 w-4 shrink-0 text-ink-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              name="user-search"
              placeholder="جستجوی نام…"
              className="w-full bg-transparent text-right text-[12px] outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} className="text-ink-faint hover:text-ink" aria-label="پاک کردن">
                ✕
              </button>
            )}
          </div>
        </FilterBar>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <SkeletonBlock className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="h-3 w-20" />
                </div>
              </div>
              <div className="mt-3 flex gap-1.5">
                <SkeletonBlock className="h-5 w-20 rounded-full" />
                <SkeletonBlock className="h-5 w-16 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UsersRound className="h-10 w-10" />}
            title="همکاری یافت نشد"
            description={q || filters.branchId || filters.roleKey || filters.department
              ? "فیلتر یا عبارت جستجو را عوض کنید"
              : "هنوز کاربری در سیستم ثبت نشده است"}
          />
        </Card>
      ) : isAdmin ? (
        /* ادمین: جدول حرفه‌ای + تنظیمات + دوره‌ها */
        <UsersAvailabilityTable users={visible} isLoading={isLoading} />
      ) : (
        /* بقیه: کارت‌های همکار */
        <div className="space-y-6">
          <p className="text-[11px] text-ink-faint">
            {faNum(visible.length)} نفر
            {visible.length !== users.length ? ` از ${faNum(users.length)}` : ""}
          </p>
          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-ink-faint" />
                <h2 className="text-[13px] font-bold">{group.label}</h2>
                <span className="text-[11px] text-ink-faint">{faNum(group.users.length)} نفر</span>
              </div>
              <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.users.map((u) => (
                  <StaggerItem key={u.id}>
                    <ColleagueCard user={u} isSelf={u.id === me?.id} />
                  </StaggerItem>
                ))}
              </StaggerList>
            </section>
          ))}
        </div>
      )}

      {/* مودال‌های مدیریت کاربر */}
      {um.modals}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="text-[11px] text-ink-soft">{label}</p>
        <p className="mt-0.5 text-lg font-bold">{value}</p>
      </div>
      <div className="text-ink-faint">{icon}</div>
    </Card>
  );
}

function ColleagueCard({ user, isSelf }: { user: Colleague; isSelf: boolean }) {
  const subtitle = [user.jobTitle, user.department].filter(Boolean).join(" · ");

  return (
    <Card className="h-full p-4">
      <div className="flex items-start gap-3">
        <UserAvatar name={user.fullName} src={user.avatarUrl} size="md" variant="soft" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-[13px] font-bold">{user.fullName}</p>
            {isSelf && <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">شما</span>}
          </div>
          <p className={cn("mt-0.5 truncate text-[12px]", subtitle ? "text-ink-soft" : "text-ink-faint")}>
            {subtitle || "سمت ثبت نشده"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {user.roles.map((r) => (
          <span key={r.role.key} className="badge badge-gray">
            {r.role.name}
          </span>
        ))}
        {user.branch && <span className="badge badge-gray">{user.branch.name}</span>}
      </div>
    </Card>
  );
}
