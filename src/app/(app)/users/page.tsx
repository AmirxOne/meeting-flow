"use client";

/**
 * Product: colleague directory (read-only) for all authenticated users.
 * Admin CRUD lives at /admin/users — this page intentionally shows only name, role, branch.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UsersRound } from "lucide-react";
import { api } from "@/lib/api";
import { Card, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { cn, faNum } from "@/lib";

interface Colleague {
  id: string;
  fullName: string;
  branch: { id: string; name: string } | null;
  roles: { role: { key: string; name: string } }[];
}

export default function UsersPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["colleagues", q],
    queryFn: () =>
      api<{ users: Colleague[] }>(`/api/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

  const users = data?.users ?? [];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-lg font-bold">کاربران</h1>
        <p className="mt-0.5 text-[12px] text-ink-soft">
          فهرست همکاران سازمان — فقط مشاهده؛ مدیریت کاربران از بخش مدیریت سیستم انجام می‌شود
        </p>
      </div>

      <div className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-white px-3 sm:max-w-72">
        <Search className="h-4 w-4 shrink-0 text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی نام…"
          className="w-full bg-transparent text-[12px] outline-none"
        />
        {q && (
          <button onClick={() => setQ("")} className="text-ink-faint hover:text-ink" aria-label="پاک کردن">
            ✕
          </button>
        )}
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
      ) : users.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UsersRound className="h-10 w-10" />}
            title="همکاری یافت نشد"
            description={q ? "نام دیگری جستجو کنید" : "هنوز کاربری در سیستم ثبت نشده است"}
          />
        </Card>
      ) : (
        <>
          <p className="text-[11px] text-ink-faint">{faNum(users.length)} نفر</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {users.map((u) => (
              <Card key={u.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper-soft text-[14px] font-bold">
                    {u.fullName.slice(0, 1)}
                  </div>
                  <p className="min-w-0 truncate text-[13px] font-bold">{u.fullName}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {u.roles.map((r) => (
                    <span key={r.role.key} className={cn("badge badge-gray")}>
                      {r.role.name}
                    </span>
                  ))}
                  {u.branch && <span className="badge badge-gray">{u.branch.name}</span>}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
