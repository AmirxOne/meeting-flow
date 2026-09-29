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
import { Briefcase, Building2, Search, Settings2, UsersRound, ChevronDown, Phone, MessageCircle } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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
  const [phoneQ, setPhoneQ] = useState("");
  const [emailQ, setEmailQ] = useState("");
  const [hasAvatar, setHasAvatar] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [filters, setFilters] = useState({ branchId: "", roleKey: "", department: "", accountStatus: "", jobTitle: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["colleagues"],
    queryFn: () => api<{ users: Colleague[] }>("/api/users"),
  });

  const users = data?.users ?? [];
  const options = useMemo(() => uniqueColleagueOptions(users), [users]);
  const visible = useMemo(() => {
    let list = filterColleagues(users, {
      q,
      branchId: filters.branchId,
      roleKey: filters.roleKey,
      department: filters.department,
      accountStatus: filters.accountStatus,
      jobTitle: filters.jobTitle,
    });
    // فیلترهای تکمیلی
    if (phoneQ.trim()) {
      const n = phoneQ.replace(/\D/g, "");
      list = list.filter((u) => (u.phone ?? "").replace(/\D/g, "").includes(n));
    }
    if (emailQ.trim()) {
      const n = emailQ.trim().toLowerCase();
      list = list.filter((u) => (u.email ?? "").toLowerCase().includes(n));
    }
    if (hasAvatar === "yes") list = list.filter((u) => !!u.avatarUrl);
    if (hasAvatar === "no") list = list.filter((u) => !u.avatarUrl);
    // مرتب‌سازی
    const byName = (a: Colleague, b: Colleague) => a.fullName.localeCompare(b.fullName, "fa");
    switch (sort) {
      case "name-desc": list = [...list].sort((a, b) => byName(b, a)); break;
      case "branch": list = [...list].sort((a, b) => (a.branch?.name ?? "zz").localeCompare(b.branch?.name ?? "zz", "fa") || byName(a, b)); break;
      case "role": list = [...list].sort((a, b) => (a.roles[0]?.role.name ?? "zz").localeCompare(b.roles[0]?.role.name ?? "zz", "fa") || byName(a, b)); break;
      case "dept": list = [...list].sort((a, b) => (a.department ?? "zz").localeCompare(b.department ?? "zz", "fa") || byName(a, b)); break;
      case "inactive-first": list = [...list].sort((a, b) => Number(a.isActive === false ? 0 : 1) - Number(b.isActive === false ? 0 : 1) || byName(a, b)); break;
      default: list = [...list].sort(byName);
    }
    return list;
  }, [users, q, phoneQ, emailQ, hasAvatar, sort, filters]);
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
        <Card className="overflow-hidden">
          {/* ردیف ۱: جستجوی اصلی + مرتب‌سازی + شمارنده */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <div className="flex h-10 min-w-52 flex-1 items-center gap-2 rounded-md border border-line bg-white px-3 sm:max-w-md">
              <Search className="h-4 w-4 shrink-0 text-ink-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
                name="user-search"
                placeholder="جستجوی نام، سمت، واحد، شعبه…"
                className="w-full bg-transparent text-right text-[12px] outline-none"
              />
              {q && (
                <button onClick={() => setQ("")} className="text-ink-faint hover:text-ink" aria-label="پاک کردن">✕</button>
              )}
            </div>
            <Select
              value={sort}
              onChange={setSort}
              placeholder="مرتب‌سازی"
              className="w-44"
              options={[
                { value: "name-asc", label: "نام (الف → ی)" },
                { value: "name-desc", label: "نام (ی → الف)" },
                { value: "branch", label: "شعبه" },
                { value: "role", label: "نقش" },
                { value: "dept", label: "واحد سازمانی" },
                { value: "inactive-first", label: "غیرفعال‌ها اول" },
              ]}
            />
            <div className="mr-auto flex items-center gap-2 text-[11px] text-ink-soft">
              <span className="rounded-full bg-paper-soft px-2.5 py-1 font-medium">
                {faNum(visible.length)} از {faNum(users.length)} نفر
              </span>
            </div>
          </div>

          {/* ردیف ۲: فیلترهای گروهی */}
          <div className="px-4 py-3">
            <FilterBar
              groups={[
                { key: "branchId", label: "شعبه", options: [{ value: "", label: "همه" }, ...options.branches] },
                { key: "roleKey", label: "نقش", options: [{ value: "", label: "همه" }, ...options.roles] },
                { key: "department", label: "واحد", options: [{ value: "", label: "همه" }, ...options.departments] },
                { key: "jobTitle", label: "سمت", options: [{ value: "", label: "همه" }, ...options.jobTitles] },
                { key: "accountStatus", label: "وضعیت", options: [{ value: "", label: "همه" }, { value: "active", label: "فعال" }, { value: "inactive", label: "غیرفعال" }] },
                { key: "hasAvatar", label: "آواتار", options: [{ value: "", label: "همه" }, { value: "yes", label: "دارد" }, { value: "no", label: "ندارد" }] },
              ]}
              value={{ ...filters, hasAvatar }}
              onChange={(next) => {
                setFilters({
                  branchId: next.branchId ?? "",
                  roleKey: next.roleKey ?? "",
                  department: next.department ?? "",
                  accountStatus: next.accountStatus ?? "",
                  jobTitle: next.jobTitle ?? "",
                });
                setHasAvatar(next.hasAvatar ?? "");
              }}
            />
          </div>

          {/* ردیف ۳: جستجوی پیشرفته (تلفن/ایمیل) — بازشو */}
          <details className="group border-t border-line">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-2.5 text-[11.5px] font-medium text-ink-soft transition-colors hover:text-ink">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              جستجوی پیشرفته (تلفن / ایمیل)
              {(phoneQ || emailQ) && (
                <span className="rounded-full bg-ink px-1.5 py-0.5 text-[9px] font-bold text-white">فعال</span>
              )}
            </summary>
            <div className="grid gap-2 px-4 pb-3.5 sm:grid-cols-2">
              <div className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3">
                <Phone className="h-4 w-4 shrink-0 text-ink-faint" />
                <input
                  value={phoneQ}
                  onChange={(e) => setPhoneQ(e.target.value)}
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="جستجوی شماره تلفن…"
                  className="w-full bg-transparent text-right text-[12px] outline-none"
                />
                {phoneQ && <button onClick={() => setPhoneQ("")} className="text-ink-faint hover:text-ink">✕</button>}
              </div>
              <div className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3">
                <MessageCircle className="h-4 w-4 shrink-0 text-ink-faint" />
                <input
                  value={emailQ}
                  onChange={(e) => setEmailQ(e.target.value)}
                  inputMode="email"
                  autoComplete="off"
                  dir="ltr"
                  placeholder="جستجوی ایمیل…"
                  className="w-full bg-transparent text-left text-[12px] outline-none"
                />
                {emailQ && <button onClick={() => setEmailQ("")} className="text-ink-faint hover:text-ink">✕</button>}
              </div>
            </div>
          </details>
        </Card>
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
