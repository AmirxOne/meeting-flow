"use client";

import { useState } from "react";
import { UserRound, UsersRound } from "@/components/ui/icon";
import { cn } from "@/lib";
import { UsersPage } from "./page-client";
import { PeopleDirectoryPage } from "@/components/people/people-directory-page";

const TABS_LIST = [
  { id: "company" as const, label: "اعضای شرکت", icon: UsersRound },
  { id: "external" as const, label: "اعضای خارجی", icon: UserRound },
];

export function UsersTabsPage() {
  const [tab, setTab] = useState<"company" | "external">("company");

  return (
    <div className="p-4 lg:p-6">
      {/* هدر صفحه + تب‌ها در یک ردیف افقی */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">اعضا</h1>
          <p className="mt-0.5 text-[12px] leading-6 text-ink-soft">
            اعضای شرکت با حساب لاگین و نقش‌ها · اعضای خارجی = مهمان‌ها و ارتباط‌های بیرونی که در جلسات دعوت می‌شوند
          </p>
        </div>

        {/* تب‌ها */}
        <div className="flex w-full shrink-0 gap-1 rounded-xl border border-line bg-paper-soft/60 p-1 sm:w-auto sm:min-w-90">
          {TABS_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-all",
                tab === t.id ? "bg-white text-ink shadow-sm" : "text-ink-faint hover:text-ink",
              )}
              aria-selected={tab === t.id}
              role="tab"
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* محتوای تب */}
      {tab === "company" ? (
        <UsersPage embedded />
      ) : (
        <PeopleDirectoryPage embedded />
      )}
    </div>
  );
}
