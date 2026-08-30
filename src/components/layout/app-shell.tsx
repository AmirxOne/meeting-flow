"use client";

import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, CalendarDays, Bell,
  LifeBuoy,
  Search, LogOut, Menu, X, Plus, ChevronDown, UserCircle,
} from "@/components/ui/icon";
import type { AppIcon } from "@/components/ui/icon";
import { cn, faNum } from "@/lib";
import { groupedVisibleNav, isNavActive } from "@/lib/nav";
import { useAuth } from "@/lib/auth-store";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { replayCurrentTour } from "@/components/guided-tours";
import { OrgBrandMark, BrandLogoSkeleton } from "@/components/layout/org-brand-mark";
import { easeOut } from "@/components/ui/motion";
import { Tooltip } from "@/components/ui/tooltip";

const MOBILE_NAV = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/calendar", label: "تقویم", icon: CalendarDays },
  { href: "/meetings/new", label: "جلسه جدید", icon: Plus },
  { href: "/notifications", label: "اعلان‌ها", icon: Bell },
];

function useUnreadCount() {
  const { data } = useQuery({
    queryKey: ["notifications", "count"],
    queryFn: () => api<{ unreadCount: number }>("/api/notifications"),
    refetchInterval: 30_000,
  });
  return data?.unreadCount ?? 0;
}

function useOrgBranding() {
  const { data } = useQuery({
    queryKey: ["organization-branding"],
    queryFn: () =>
      api<{ branding: { name: string; logoUrl: string | null } }>("/api/organization/branding"),
    staleTime: 5 * 60_000,
  });
  return {
    orgName: data?.branding.name ?? "مهرسا",
    logoUrl: data?.branding.logoUrl ?? null,
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loaded, refresh, logout, can } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const unread = useUnreadCount();
  const { orgName, logoUrl } = useOrgBranding();

  useEffect(() => {
    if (!loaded) refresh();
  }, [loaded, refresh]);

  useEffect(() => {
    if (loaded && !me) router.replace("/login");
  }, [loaded, me, router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (!loaded || !me) {
    return (
      <div className="flex min-h-screen flex-col bg-white lg:pr-60">
        <aside className="fixed top-0 right-0 hidden h-screen w-60 flex-col border-l border-line bg-paper-soft lg:flex">
          <div className="flex h-16 items-center gap-2.5 border-b border-line px-4">
            <BrandLogoSkeleton size={36} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="skeleton h-3.5 w-24" />
              <div className="skeleton h-2.5 w-32" />
            </div>
          </div>
          <div className="space-y-4 p-3">
            {[4, 4, 2].map((count, g) => (
              <div key={g} className="space-y-1">
                <div className="skeleton mx-2 h-2 w-8" />
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="skeleton h-9 w-full rounded-lg" />
                ))}
              </div>
            ))}
          </div>
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="flex h-16 items-center gap-3 border-b border-line px-4 lg:px-6">
            <div className="skeleton h-10 w-full max-w-xl rounded-md" />
            <div className="skeleton mr-auto h-8 w-8 rounded-full" />
          </header>
          <main className="flex flex-1 items-center justify-center p-6">
            <div className="flex flex-col items-center gap-3">
              <BrandLogoSkeleton size={48} />
              <div className="skeleton h-3 w-28" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  const navGroups = groupedVisibleNav(can);
  const siblingHrefs = navGroups.flatMap((g) => g.items.map((item) => item.href));

  return (
    <div className="min-h-screen bg-white lg:pr-60">
      {/* Desktop sidebar */}
      <aside className="fixed top-0 right-0 z-50 hidden h-screen w-60 flex-col border-l border-line bg-paper-soft lg:flex">
        <Link
          href="/dashboard"
          className="flex h-16 items-center gap-2.5 border-b border-line px-4 transition-colors hover:bg-white/50"
        >
          <OrgBrandMark orgName={orgName} logoUrl={logoUrl} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold leading-4">{orgName}</p>
            <p className="truncate text-[10px] text-ink-faint">مدیریت جلسات سازمانی</p>
          </div>
        </Link>
        <nav data-tour="nav" className="flex-1 overflow-y-auto px-2.5 py-3">
          <LayoutGroup id="desktop-nav">
            {navGroups.map((group) => (
              <div key={group.id} className="mb-4 last:mb-0">
                <p className="mb-1 px-2 text-[10px] font-medium text-ink-faint">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <SidebarNavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={isNavActive(pathname, item.href, siblingHrefs)}
                      unread={item.href === "/notifications" ? unread : 0}
                      layoutId="nav-active-rail"
                    />
                  ))}
                </div>
              </div>
            ))}
          </LayoutGroup>
        </nav>
        <div className="border-t border-line p-2.5">
          <Link
            href="/meetings/new"
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-ink text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a2a2e] active:bg-black"
          >
            <Plus className="h-4 w-4" />
            جلسه جدید
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:px-6 [transform:translateZ(0)]">
          <button
            className="rounded-md p-2 hover:bg-paper-soft lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="منو"
          >
            <Menu className="h-5 w-5" />
          </button>

          <GlobalSearch />

          <div className="mr-auto flex items-center gap-1">
            <Tooltip content="راهنمای این صفحه">
              <button
                onClick={() => replayCurrentTour()}
                aria-label="راهنمای این صفحه"
                className="hidden h-9 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-line hover:bg-paper-soft hover:text-ink sm:flex"
              >
                <LifeBuoy className="h-4 w-4" />
                راهنما
              </button>
            </Tooltip>
            <div className="relative">
            <button
              onClick={() => setUserMenu((v) => !v)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-paper-soft"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white">
                {me.fullName.slice(0, 1)}
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-[13px] font-medium leading-4">{me.fullName}</p>
                <p className="text-[10px] text-ink-faint">
                  {me.roles[0]?.name ?? ""}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
            </button>
            {userMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
                <div dir="rtl" className="absolute left-0 z-20 mt-2 w-52 rounded-md border border-line bg-white p-1.5 shadow-lg">
                  <div className="border-b border-line px-3 py-2">
                    <p className="text-[12px] font-medium">{me.fullName}</p>
                    <p className="text-[11px] text-ink-faint" dir="ltr">{me.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setUserMenu(false)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-ink hover:bg-paper-soft"
                  >
                    <UserCircle className="h-4 w-4" />
                    پروفایل من
                  </Link>
                  <button
                    onClick={logout}
                    className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    خروج از حساب
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col bg-paper-soft shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <OrgBrandMark orgName={orgName} logoUrl={logoUrl} size={32} />
                <p className="truncate text-[14px] font-bold">{orgName}</p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="بستن"
                className="rounded-md p-1.5 text-ink-soft hover:bg-white hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2.5 py-3">
              {navGroups.map((group) => (
                <div key={group.id} className="mb-4 last:mb-0">
                  <p className="mb-1 px-2 text-[10px] font-medium text-ink-faint">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <SidebarNavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        active={isNavActive(pathname, item.href, siblingHrefs)}
                        unread={item.href === "/notifications" ? unread : 0}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <div className="border-t border-line p-2.5">
              <Link
                href="/meetings/new"
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-ink text-[13px] font-medium text-white"
              >
                <Plus className="h-4 w-4" />
                جلسه جدید
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 right-0 left-0 z-40 flex h-16 items-stretch border-t border-line bg-white lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px]",
                active ? "text-ink" : "text-ink-faint",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {item.href === "/notifications" && unread > 0 && (
                <span className="absolute right-1/2 top-1.5 flex h-4 min-w-4 translate-x-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                  {faNum(unread)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarNavLink({
  href,
  label,
  icon: Icon,
  active,
  unread = 0,
  layoutId,
}: {
  href: string;
  label: string;
  icon: AppIcon;
  active: boolean;
  unread?: number;
  layoutId?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-white text-ink shadow-[0_1px_2px_rgba(13,13,13,0.06)]"
          : "text-ink-soft hover:bg-white/70 hover:text-ink",
      )}
    >
      {active && layoutId && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-y-1.5 right-0 w-[3px] rounded-full bg-ink"
          transition={easeOut}
        />
      )}
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
          active ? "bg-ink text-white" : "text-ink-faint group-hover:text-ink-soft",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 truncate">{label}</span>
      {unread > 0 && (
        <motion.span
          key={unread}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={easeOut}
          className="mr-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
        >
          {faNum(unread)}
        </motion.span>
      )}
    </Link>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["search", q],
    queryFn: () =>
      api<{
        results: {
          meetings: { id: string; title: string }[];
          users: { id: string; fullName: string; jobTitle: string | null }[];
          rooms: { id: string; name: string }[];
          guests: { id: string; name: string }[];
          branches: { id: string; name: string }[];
        };
      }>(`/api/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });

  const r = data?.results;
  const hasResults =
    r && (r.meetings.length || r.users.length || r.rooms.length || r.guests.length || r.branches.length);

  return (
    <div data-tour="search" className="relative w-full max-w-xl">
      <div className="flex h-10 items-center gap-2 rounded-md bg-paper-soft px-3">
        <Search className="h-4 w-4 text-ink-faint" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="جستجوی جلسه، فرد، اتاق…"
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
        />
      </div>
      {open && q.trim().length >= 2 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-12 z-20 max-h-96 overflow-y-auto rounded-md border border-line bg-white p-2 shadow-lg">
            {!r && <p className="p-3 text-[12px] text-ink-faint">در حال جستجو…</p>}
            {r && !hasResults && (
              <p className="p-3 text-[12px] text-ink-faint">نتیجه‌ای یافت نشد</p>
            )}
            {r?.meetings.length ? (
              <Section title="جلسات">
                {r.meetings.map((m) => (
                  <ResultRow key={m.id} onClick={() => { setOpen(false); router.push(`/meetings/${m.id}`); }} label={m.title} />
                ))}
              </Section>
            ) : null}
            {r?.users.length ? (
              <Section title="افراد">
                {r.users.map((u) => (
                  <ResultRow key={u.id} onClick={() => setOpen(false)} label={u.fullName} hint={u.jobTitle ?? ""} />
                ))}
              </Section>
            ) : null}
            {r?.rooms.length ? (
              <Section title="اتاق‌ها">
                {r.rooms.map((room) => (
                  <ResultRow key={room.id} onClick={() => { setOpen(false); router.push(`/rooms/${room.id}`); }} label={room.name} />
                ))}
              </Section>
            ) : null}
            {r?.guests.length ? (
              <Section title="مهمان‌ها">
                {r.guests.map((g) => (
                  <ResultRow key={g.id} onClick={() => setOpen(false)} label={g.name} />
                ))}
              </Section>
            ) : null}
            {r?.branches.length ? (
              <Section title="شعب">
                {r.branches.map((b) => (
                  <ResultRow key={b.id} onClick={() => { setOpen(false); router.push("/branches"); }} label={b.name} />
                ))}
              </Section>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-[10px] font-medium text-ink-faint">{title}</p>
      {children}
    </div>
  );
}

function ResultRow({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-right text-[13px] hover:bg-paper-soft"
    >
      <span className="truncate">{label}</span>
      {hint && <span className="shrink-0 text-[11px] text-ink-faint">{hint}</span>}
    </button>
  );
}
