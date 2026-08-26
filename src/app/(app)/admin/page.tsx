import Link from "next/link";
import { Users, Settings, DoorOpen, ScrollText } from "lucide-react";
import { getSessionUser, can } from "@/server/auth/session";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user, "user:update")) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-[13px] text-ink-soft">
          دسترسی به بخش مدیریت ندارید.
        </div>
      </div>
    );
  }

  const items = [
    { href: "/admin/users", label: "کاربران", desc: "مدیریت کاربران و نقش‌ها", icon: Users, perm: "user:update" },
    { href: "/admin/rooms", label: "اتاق‌ها", desc: "مدیریت اتاق‌های جلسه", icon: DoorOpen, perm: "room:update" },
    { href: "/admin/policies", label: "سیاست‌ها", desc: "قواعد تأیید و محدودیت‌ها", icon: Settings, perm: "policy:manage" },
    { href: "/admin/audit-logs", label: "لاگ ممیزی", desc: "تاریخچه تمام عملیات", icon: ScrollText, perm: "audit:view" },
  ].filter((i) => can(user, i.perm as never));

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <h1 className="text-lg font-bold">مدیریت سیستم</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="rounded-2xl border border-line bg-white p-5 transition-colors hover:border-ink-faint">
              <item.icon className="h-5 w-5 text-ink-soft" />
              <p className="mt-3 text-[14px] font-bold">{item.label}</p>
              <p className="mt-1 text-[12px] text-ink-soft">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
