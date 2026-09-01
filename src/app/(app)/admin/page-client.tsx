"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, Contact, DoorOpen, Settings, ScrollText, Building2,
  CalendarDays, Hourglass, UserX, ShieldCheck, ArrowLeft, Activity, SlidersHorizontal, Shield,
} from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, SkeletonBlock } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/ui/motion";
import { useAuth } from "@/lib/auth-store";
import { cn, faNum, formatJalali } from "@/lib";

interface Stats {
  users: { active: number; disabled: number };
  rooms: { total: number; active: number };
  branches: number;
  pendingApprovals: number;
  todayMeetings: number;
  directorySize: number;
  auditToday: number;
  week: { meetings: number; cancelled: number };
  recentLogs: { id: string; action: string; entity: string; actor: string; createdAt: string }[];
}

const ACTION_FA: Record<string, string> = {
  CREATE: "ایجاد",
  UPDATE: "ویرایش",
  DELETE: "حذف",
  APPROVE: "تأیید",
  REJECT: "رد",
  CANCEL: "لغو",
  RESCHEDULE: "زمان‌بندی مجدد",
  ROOM_CHANGE: "تغییر اتاق",
  PARTICIPANT_ADD: "افزودن فرد",
  PARTICIPANT_REMOVE: "حذف فرد",
  START: "شروع",
  END: "پایان",
  EXTEND: "تمدید",
  LOGIN: "ورود",
  ATTACHMENT_UPLOAD: "آپلود پیوست",
  ATTACHMENT_DELETE: "حذف پیوست",
  AGENDA_UPDATE: "ویرایش دستور جلسه",
  MINUTES_PUBLISH: "ثبت صورتجلسه",
  VIDEO_LINK_UPDATE: "ویرایش لینک ویدئو",
  WAITLIST_CLAIM: "قطعی کردن لیست انتظار",
  WAITLIST_DECLINE: "رد پیشنهاد لیست انتظار",
  HOLIDAY_CREATE: "ثبت تعطیلی",
  HOLIDAY_DELETE: "حذف تعطیلی",
  MAP_UPLOAD: "آپلود نقشه شعبه",
  MAP_DELETE: "حذف نقشه شعبه",
  AVATAR_UPLOAD: "آپلود تصویر پروفایل",
  AVATAR_DELETE: "حذف تصویر پروفایل",
  DISPLAY_TOKEN: "توکن نمایشگر اتاق",
  DISPLAY_TOKEN_REVOKE: "باطل کردن نمایشگر اتاق",
};

const ENTITY_FA: Record<string, string> = {
  User: "کاربر",
  MeetingRoom: "اتاق",
  Branch: "شعبه",
  Meeting: "جلسه",
  PersonDirectory: "فرد",
  MeetingPolicy: "سیاست",
  MeetingAttachment: "پیوست",
  Organization: "سازمان",
  Delegate: "نماینده رزرو",
  OrgHoliday: "تعطیلی سازمانی",
};

export function AdminPage() {
  const { me, can } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const r = await api<Stats>("/api/admin/stats");
      return r as unknown as Stats;
    },
    enabled: !!me && can("user:update"),
  });

  const items = [
    { href: "/admin/users", label: "کاربران", desc: "کاربران سیستم، نقش‌ها و دسترسی‌ها", icon: Users },
    ...(can("role:manage")
      ? [{ href: "/admin/roles", label: "نقش‌ها", desc: "تعریف نقش و دسترسی‌های سفارشی", icon: Shield }]
      : []),
    { href: "/admin/people", label: "افراد", desc: "دایرکتوری اعضا و ارتباط‌های خارجی", icon: Contact },
    { href: "/admin/rooms", label: "اتاق‌ها", desc: "ساخت، ویرایش و مدیریت اتاق‌ها", icon: DoorOpen },
    { href: "/admin/policies", label: "سیاست‌ها", desc: "قواعد تأیید، محدودیت‌ها و تعطیلات سازمانی", icon: Settings },
    { href: "/admin/settings", label: "تنظیمات سازمان", desc: "نام، منطقه زمانی و لوگوی سازمان", icon: SlidersHorizontal },
    { href: "/admin/audit-logs", label: "لاگ ممیزی", desc: "تاریخچه کامل عملیات سیستم", icon: ScrollText },
  ];

  if (!can("user:update")) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-[13px] text-ink-soft">
          پنل مدیریت سیستم نیازمند دسترسی user:update است.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck className="h-5 w-5" />
          مدیریت سیستم
        </h1>
        <p className="mt-0.5 text-[12px] text-ink-soft">نمای کلی وضعیت سازمان و دسترسی سریع به بخش‌ها</p>
      </div>

      {/* live stats strip */}
      {isLoading || !data ? (
        <Card className="p-5">
          <SkeletonBlock className="h-16 w-full" />
        </Card>
      ) : (
        <StaggerList className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StaggerItem>
            <Link href="/admin/users" className="block rounded-md border border-line bg-white p-4 transition-colors hover:border-ink-faint">
              <div className="flex items-center justify-between">
                <Users className="h-4 w-4 text-ink-soft" />
                <span className="text-[10px] text-ink-faint">{faNum(data.users.disabled)} غیرفعال</span>
              </div>
              <p className="mt-2 text-xl font-bold">{faNum(data.users.active)}</p>
              <p className="text-[11px] text-ink-soft">کاربر فعال</p>
            </Link>
          </StaggerItem>
          <StaggerItem>
            <Link href="/admin/rooms" className="block rounded-md border border-line bg-white p-4 transition-colors hover:border-ink-faint">
              <div className="flex items-center justify-between">
                <DoorOpen className="h-4 w-4 text-ink-soft" />
                <span className="text-[10px] text-ink-faint">از {faNum(data.rooms.total)}</span>
              </div>
              <p className="mt-2 text-xl font-bold">{faNum(data.rooms.active)}</p>
              <p className="text-[11px] text-ink-soft">اتاق فعال</p>
            </Link>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-md border border-line bg-white p-4">
              <div className="flex items-center justify-between">
                <Building2 className="h-4 w-4 text-ink-soft" />
              </div>
              <p className="mt-2 text-xl font-bold">{faNum(data.branches)}</p>
              <p className="text-[11px] text-ink-soft">شعبه</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className={cn("rounded-md border p-4", data.pendingApprovals > 0 ? "border-amber-200 bg-amber-50/60" : "border-line bg-white")}>
              <div className="flex items-center justify-between">
                <Hourglass className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-xl font-bold">{faNum(data.pendingApprovals)}</p>
              <p className="text-[11px] text-ink-soft">در انتظار تأیید</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-md border border-line bg-white p-4">
              <CalendarDays className="h-4 w-4 text-ink-soft" />
              <p className="mt-2 text-xl font-bold">{faNum(data.todayMeetings)}</p>
              <p className="text-[11px] text-ink-soft">جلسه امروز</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <Link href="/admin/people" className="block rounded-md border border-line bg-white p-4 transition-colors hover:border-ink-faint">
              <Contact className="h-4 w-4 text-ink-soft" />
              <p className="mt-2 text-xl font-bold">{faNum(data.directorySize)}</p>
              <p className="text-[11px] text-ink-soft">فرد در دایرکتوری</p>
            </Link>
          </StaggerItem>
        </StaggerList>
      )}

      {/* management sections */}
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <StaggerItem key={item.href}>
            <Link
              href={item.href}
              className="group flex h-full items-start gap-4 rounded-md border border-line bg-white p-5 transition-colors hover:border-ink-faint"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-paper-soft transition-colors group-hover:bg-ink group-hover:text-white">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[14px] font-bold">
                  {item.label}
                  <ArrowLeft className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                </p>
                <p className="mt-1 text-[12px] leading-5 text-ink-soft">{item.desc}</p>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </StaggerList>

      {/* recent activity */}
      <Card>
        <CardHeader
          title="فعالیت اخیر سیستم"
          subtitle={data ? `${faNum(data.auditToday)} عملیات در ۲۴ ساعت گذشته · ${faNum(data.week.meetings)} جلسه این هفته` : undefined}
          action={
            <Link href="/admin/audit-logs" className="text-[11px] text-ink-soft underline underline-offset-2 hover:text-ink">
              مشاهده همه
            </Link>
          }
        />
        {isLoading || !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : data.recentLogs.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12px] text-ink-faint">فعالیتی ثبت نشده است</p>
        ) : (
          <div className="divide-y divide-line">
            {data.recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-paper-soft">
                  <Activity className="h-3.5 w-3.5 text-ink-soft" />
                </div>
                <p className="min-w-0 flex-1 truncate text-[12px]">
                  <span className="font-medium">{log.actor}</span>
                  <span className="text-ink-soft"> · {ACTION_FA[log.action] ?? log.action} </span>
                  <span className="text-ink-soft">{ENTITY_FA[log.entity] ?? log.entity}</span>
                </p>
                <span className="shrink-0 text-[10px] text-ink-faint">
                  {formatJalali(new Date(log.createdAt), { withTime: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
