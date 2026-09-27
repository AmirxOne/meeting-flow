"use client";

import { useState } from "react";
import { UserRound, UsersRound, UserPlus } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useUserManagement } from "@/components/users/user-management";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { UsersPage } from "./page-client";
import { PeopleDirectoryPage } from "@/components/people/people-directory-page";

/** دکمه‌های مدیریتی هدر: کاربر جدید + مدیریت کاربران — انتهای چپِ ردیف */
function HeaderActions() {
  const can = useAuth((s) => s.can);
  const isAdmin = can("user:update");
  const um = useUserManagement();
  if (!isAdmin) return null;
  return (
    <div className="mr-auto flex shrink-0 flex-wrap items-center gap-2">
      <Button size="sm" onClick={um.openCreate}>
        <UserPlus className="h-4 w-4" />
        کاربر جدید
      </Button>
      {um.modals}
    </div>
  );
}


/** دکمه «فرد جدید» تب خارجی — از طریق ایونت به مودال PeopleDirectory وصل می‌شود */
function ExternalAddButton() {
  return (
    <div className="mr-auto flex shrink-0 items-center gap-2">
      <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent("mehrsa:people-add"))}>
        <UserPlus className="h-4 w-4" />
        فرد جدید
      </Button>
    </div>
  );
}

const TABS_LIST = [
  { id: "company" as const, label: "اعضای شرکت", icon: UsersRound },
  { id: "external" as const, label: "اعضای خارجی", icon: UserRound },
];

export function UsersTabsPage() {
  const [tab, setTab] = useState<"company" | "external">("company");

  return (
    <div className="p-4 lg:p-6">
      {/* عنوان + توضیح */}
      <div className="mb-4">
        <h1 className="text-lg font-bold">اعضا</h1>
        <p className="mt-0.5 text-[12px] leading-6 text-ink-soft">
          اعضای شرکت با حساب لاگین و نقش‌ها · اعضای خارجی = مهمان‌ها و ارتباط‌های بیرونی که در جلسات دعوت می‌شوند
        </p>
      </div>

      {/* ردیف کنترل‌ها: تب‌ها راست · دکمه‌های مدیریتی چپ (فقط تب شرکت) */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">

        {/* تب‌ها */}
        <SegmentedTabs items={TABS_LIST} value={tab} onChange={setTab} className="shrink-0" />

        {/* دکمه‌های مدیریتی — انتهای چپ ردیف */}
        {tab === "company" ? <HeaderActions /> : <ExternalAddButton />}
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
