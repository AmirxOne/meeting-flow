"use client";

/**
 * Product: colleague directory (read-only) for all authenticated users.
 * Admin CRUD lives at /admin/users — this page never shows email or account status.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Building2, Search, Settings2, UsersRound } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Button } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/ui/motion";
import { useAuth } from "@/lib/auth-store";
import { cn, faNum } from "@/lib";
import {
  filterColleagues,
  groupColleaguesByBranch,
  uniqueColleagueOptions,
  type Colleague,
} from "@/lib/colleague-directory";

export function UsersPage() {
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
  const groups = useMemo(() => groupColleaguesByBranch(visible), [visible]);
  const departmentCount = new Set(users.map((u) => u.department).filter(Boolean)).size;
  const branchCount = new Set(users.map((u) => u.branch?.id).filter(Boolean)).size;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">کاربران</h1>
          <p className="mt-0.5 text-[12px] text-ink-soft">
            فهرست همکاران سازمان — فقط مشاهده؛ مدیریت کاربران از بخش مدیریت سیستم انجام می‌شود
          </p>
        </div>
        {can("user:update") && (
          <Link href="/admin/users">
            <Button size="sm" variant="outline">
              <Settings2 className="h-4 w-4" />
              مدیریت کاربران
            </Button>
          </Link>
        )}
      </div>

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
      ) : (
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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper-soft text-[14px] font-bold">
          {user.fullName.slice(0, 1)}
        </div>
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
