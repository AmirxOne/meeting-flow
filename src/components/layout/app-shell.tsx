"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, CalendarDays, Users, UserRound, DoorOpen, Building2, Bell,
  BarChart3, Settings, Search, LogOut, Menu, X, Plus, ChevronDown,
} from "lucide-react";
import { cn, faNum } from "@/lib";
import { useAuth } from "@/lib/auth-store";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard, perm: null },
  { href: "/calendar", label: "تقویم", icon: CalendarDays, perm: null },
  { href: "/meetings", label: "جلسات", icon: Users, perm: null },
  { href: "/availability", label: "زمان مناسب", icon: Search, perm: null },
  { href: "/people", label: "افراد", icon: UserRound, perm: null },
  { href: "/rooms", label: "اتاق‌ها", icon: DoorOpen, perm: null },
  { href: "/branches", label: "شعب", icon: Building2, perm: null },
  { href: "/notifications", label: "اعلان‌ها", icon: Bell, perm: null },
  { href: "/reports", label: "گزارش‌ها", icon: BarChart3, perm: "report:view" },
  { href: "/admin", label: "مدیریت", icon: Settings, perm: "user:update" },
];

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loaded, refresh, logout, can } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const unread = useUnreadCount();

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
      <div className="flex min-h-screen items-center justify-center">
        <div className="skeleton h-8 w-8 rounded-full" />
      </div>
    );
  }

  const visibleNav = NAV.filter((n) => !n.perm || can(n.perm));

  return (
    <div className="flex min-h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-l border-line bg-white lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-line px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-[13px] font-bold text-white">
            م
          </div>
          <div>
            <p className="text-[14px] font-bold leading-4">مرسا</p>
            <p className="text-[10px] text-ink-faint">مدیریت جلسات سازمانی</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {visibleNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors",
                  active ? "bg-paper-soft text-ink" : "text-ink-soft hover:bg-paper-soft hover:text-ink",
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
                {item.href === "/notifications" && unread > 0 && (
                  <span className="mr-auto rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {faNum(unread)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/meetings/new"
          className="m-3 flex h-10 items-center justify-center gap-2 rounded-md bg-ink text-[13px] font-medium text-white hover:bg-[#2a2a2e]"
        >
          <Plus className="h-4 w-4" />
          جلسه جدید
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:px-6">
          <button
            className="rounded-md p-2 hover:bg-paper-soft lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="منو"
          >
            <Menu className="h-5 w-5" />
          </button>

          <GlobalSearch />

          <div className="relative mr-auto">
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
                <div className="absolute left-0 z-20 mt-2 w-52 rounded-md border border-line bg-white p-1.5 shadow-lg">
                  <div className="border-b border-line px-3 py-2">
                    <p className="text-[12px] font-medium">{me.fullName}</p>
                    <p className="text-[11px] text-ink-faint" dir="ltr">{me.email}</p>
                  </div>
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
        </header>

        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[14px] font-bold">مرسا</p>
              <button onClick={() => setDrawerOpen(false)} aria-label="بستن">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-0.5">
              {visibleNav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px]",
                      active ? "bg-paper-soft font-medium" : "text-ink-soft",
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
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
                <span className="absolute right-1/2 top-2 translate-x-4 rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
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
    <div className="relative mx-auto w-full max-w-xl">
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
