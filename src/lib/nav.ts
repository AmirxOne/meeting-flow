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
  Plus,
} from "@/components/ui/icon";

export type NavGroupId = "main" | "org" | "system";

export type NavChild = {
  href: string;
  label: string;
  perm?: string | null;
  excludeIfPerm?: string;
};

export type NavItemDef = {
  href: string;
  label: string;
  icon: AppIcon;
  perm: string | null;
  group: NavGroupId;
  excludeIfPerm?: string;
  /** Optional quick-access sub-items (rendered as an expandable submenu). */
  children?: NavChild[];
};

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: "main", label: "اصلی" },
  { id: "org", label: "سازمان" },
  { id: "system", label: "سامانه" },
];

export const NAV: NavItemDef[] = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard, perm: null, group: "main" },
  { href: "/calendar", label: "تقویم", icon: CalendarDays, perm: null, group: "main" },
  {
    href: "/meetings",
    label: "جلسات",
    icon: Users,
    perm: null,
    group: "main",
    children: [{ href: "/meetings/new", label: "جلسه جدید" }],
  },
  { href: "/availability", label: "زمان مناسب", icon: Search, perm: null, group: "main" },
  {
    href: "/people",
    label: "افراد",
    icon: UserRound,
    perm: null,
    group: "org",
  },
  {
    href: "/users",
    label: "کاربران",
    icon: UsersRound,
    perm: "user:update",
    group: "org",
  },
  {
    href: "/rooms",
    label: "اتاق‌ها",
    icon: DoorOpen,
    perm: null,
    group: "org",
  },
  { href: "/branches", label: "شعب", icon: Building2, perm: "report:view", group: "org" },
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
  {
    href: "/admin",
    label: "مدیریت",
    icon: Settings,
    perm: "user:update",
    group: "system",
    children: [
      { href: "/admin/users", label: "کاربران" },
      { href: "/admin/rooms", label: "اتاق‌ها" },
      { href: "/admin/people", label: "افراد" },
      { href: "/admin/policies", label: "سیاست‌ها" },
      { href: "/admin/roles", label: "نقش‌ها" },
      { href: "/admin/settings", label: "تنظیمات" },
      { href: "/admin/audit-logs", label: "لاگ ممیزی" },
    ],
  },
];

export function isNavItemVisible(
  item: Pick<NavItemDef, "perm" | "excludeIfPerm">,
  can: (perm: string) => boolean,
): boolean {
  if (item.excludeIfPerm && can(item.excludeIfPerm)) return false;
  return !item.perm || can(item.perm);
}

/** Visible children of an item (perm-filtered). */
export function visibleChildren(
  item: NavItemDef,
  can: (perm: string) => boolean,
): NavChild[] {
  return (item.children ?? []).filter((c) => {
    if (c.excludeIfPerm && can(c.excludeIfPerm)) return false;
    return !c.perm || can(c.perm);
  });
}

export function groupedVisibleNav(can: (perm: string) => boolean) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: NAV.filter((item) => item.group === group.id && isNavItemVisible(item, can)),
  })).filter((group) => group.items.length > 0);
}

/** Bottom bar on compact viewports — PWA start is «جلسات من». */
export const MOBILE_NAV: { href: string; label: string; icon: AppIcon }[] = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/meetings", label: "جلسات من", icon: Users },
  { href: "/meetings/new", label: "جدید", icon: Plus },
  { href: "/calendar", label: "تقویم", icon: CalendarDays },
  { href: "/notifications", label: "اعلان‌ها", icon: Bell },
];

export function isMobileNavActive(pathname: string, href: string): boolean {
  if (href === "/meetings") {
    return (
      pathname === "/meetings" ||
      (pathname.startsWith("/meetings/") && !pathname.startsWith("/meetings/new"))
    );
  }
  return pathname === href;
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

/** A parent nav item is "open/expanded" relevant when the current path is inside it. */
export function isParentActive(pathname: string, parent: string, children: string[]): boolean {
  if (pathname === parent || pathname.startsWith(`${parent}/`)) return true;
  return children.some((c) => pathname === c || pathname.startsWith(`${c}/`));
}
