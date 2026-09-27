"use client";

/**
 * صفحه‌ی «کاربران» تب‌دار — ادغام با صفحه‌ی «افراد»:
 * تب «اعضای شرکت»: جدول کاربران + اعلام زمان‌های آزاد (ادمین) / کارت همکاران (بقیه)
 * تب «اعضای خارجی»: دایرکتوری افراد (مهمان‌ها و ارتباط‌های بیرونی)
 */
import { useState } from "react";
import { UsersRound, UserRound, Building2 } from "@/components/ui/icon";
import { cn, faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { PeopleDirectoryPage } from "@/components/people/people-directory-page";
import { UsersPage } from "./page-client";

export function UsersTabsPage() {
  const { me } = useAuth();
  const [tab, setTab] = useState<"company" | "external">("company");

  const tabs = [
    { id: "company" as const, label: "اعضای شرکت", icon: UsersRound },
    { id: "external" as const, label: "اعضای خارجی", icon: UserRound },
  ];

  return (
    <div className="p-4 lg:p-6">
      {/* هدر صفحه */}
      <div className="mb-4">
        <h1 className="text-lg font-bold">اعضا</h1>
        <p className="mt-0.5 text-[12px] leading-6 text-ink-soft">
          اعضای شرکت با حساب لاگین و نقش‌ها · اعضای خارجی = مهمان‌ها و ارتباط‌های بیرونی که در جلسات دعوت می‌شوند
        </p>
      </div>

      {/* تب‌ها */}
      <div className="mb-4 flex w-full max-w-md gap-1 rounded-xl border border-line bg-paper-soft/60 p-1">
        {tabs.map((t) => (
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

      {/* محتوای تب */}
      {tab === "company" ? (
        <UsersPage embedded />
      ) : (
        <PeopleDirectoryPage embedded />
      )}
    </div>
  );
}
