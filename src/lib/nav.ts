import type { AppIcon } from "@/components/ui/icon";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UsersRound,
  UserRound,
  DoorOpen,
  Building2,
  Bell,
  Search,
  BarChart3,
  Settings,
  ScrollText,
} from "@/components/ui/icon";

export type NavGroupId = "main" | "org" | "system";

export type NavItemDef = {
  href: string;
  label: string;
  icon: AppIcon;
  perm: string | null;
  group: NavGroupId;
  excludeIfPerm?: string;
};

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: "main", label: "اصلی" },
  { id: "org", label: "سازمان" },
  { id: "system", label: "سامانه" },
];

export const NAV: NavItemDef[] = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard, perm: null, group: "main" },
  { href: "/calendar", label: "تقویم", icon: CalendarDays, perm: null, group: "main" },
  { href: "/meetings", label: "جلسات", icon: Users, perm: null, group: "main" },
  { href: "/availability", label: "زمان مناسب", icon: Search, perm: null, group: "main" },
  { href: "/people", label: "افراد", icon: UserRound, perm: null, group: "org" },
  { href: "/users", label: "کاربران", icon: UsersRound, perm: null, group: "org" },
  { href: "/rooms", label: "اتاق‌ها", icon: DoorOpen, perm: null, group: "org" },
  { href: "/branches", label: "شعب", icon: Building2, perm: null, group: "org" },
  { href: "/notifications", label: "اعلان‌ها", icon: Bell, perm: null, group: "system" },
  { href: "/reports", label: "گزارش‌ها", icon: BarChart3, perm: "report:view", group: "system" },
  {
    href: "/admin/audit-logs",
    label: "لاگ ممیزی",
    icon: ScrollText,
    perm: "audit:view",
    excludeIfPerm: "user:update",
    group: "system",
  },
  { href: "/admin", label: "مدیریت", icon: Settings, perm: "user:update", group: "system" },
];

export function isNavItemVisible(
  item: Pick<NavItemDef, "perm" | "excludeIfPerm">,
  can: (perm: string) => boolean,
): boolean {
  if (item.excludeIfPerm && can(item.excludeIfPerm)) return false;
  return !item.perm || can(item.perm);
}

export function groupedVisibleNav(can: (perm: string) => boolean) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: NAV.filter((item) => item.group === group.id && isNavItemVisible(item, can)),
  })).filter((group) => group.items.length > 0);
}

/** True when this href is the most specific visible match for the current path. */
export function isNavActive(pathname: string, href: string, siblings: string[] = []): boolean {
  const matches = pathname === href || pathname.startsWith(`${href}/`);
  if (!matches) return false;
  return !siblings.some(
    (other) =>
      other !== href &&
      other.length > href.length &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
}
