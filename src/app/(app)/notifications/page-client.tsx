"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  Ban,
  CalendarClock,
  DoorOpen,
  UserPlus,
  MessageCircle,
  PlayCircle,
  Clock,
  ScrollText,
  type AppIcon,
} from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { IconTipButton, Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/ui/motion";
import { cn, faNum, formatJalali, isoDateInTz } from "@/lib";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: { meetingId?: string } | null;
  readAt: string | null;
  createdAt: string;
}

const NOTIFICATION_META: Record<
  string,
  { label: string; icon: AppIcon; tone: "neutral" | "success" | "danger" | "warn" | "info" }
> = {
  MEETING_CREATED: { label: "دعوت جلسه", icon: CalendarPlus, tone: "info" },
  MEETING_APPROVED: { label: "تأیید جلسه", icon: CheckCircle2, tone: "success" },
  MEETING_REJECTED: { label: "رد جلسه", icon: XCircle, tone: "danger" },
  MEETING_CANCELLED: { label: "لغو جلسه", icon: Ban, tone: "danger" },
  MEETING_RESCHEDULED: { label: "تغییر زمان", icon: CalendarClock, tone: "warn" },
  ROOM_CHANGED: { label: "تغییر اتاق", icon: DoorOpen, tone: "warn" },
  PARTICIPANT_ADDED: { label: "افزودن فرد", icon: UserPlus, tone: "info" },
  PARTICIPANT_RESPONDED: { label: "پاسخ دعوت", icon: MessageCircle, tone: "neutral" },
  MEETING_REMINDER: { label: "یادآور", icon: Bell, tone: "warn" },
  MEETING_STARTED: { label: "شروع جلسه", icon: PlayCircle, tone: "success" },
  MEETING_EXTENDED: { label: "تمدید جلسه", icon: Clock, tone: "info" },
  MINUTES_PUBLISHED: { label: "صورتجلسه", icon: ScrollText, tone: "info" },
  WAITLIST_JOINED: { label: "لیست انتظار", icon: Clock, tone: "info" },
  WAITLIST_OFFERED: { label: "اتاق آزاد شد", icon: CheckCircle2, tone: "success" },
  WAITLIST_EXPIRED: { label: "مهلت لیست انتظار", icon: Ban, tone: "warn" },
};

const TONE_CLASS = {
  neutral: "bg-paper-soft text-ink-soft",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-red-50 text-red-600",
  warn: "bg-amber-50 text-amber-700",
  info: "bg-blue-50 text-blue-700",
} as const;

function targetOf(n: Notification): string | null {
  if (n.data?.meetingId) return `/meetings/${n.data.meetingId}`;
  return null;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "همین الان";
  if (mins < 60) return `${faNum(mins)} دقیقه پیش`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${faNum(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${faNum(days)} روز پیش`;
  return formatJalali(new Date(iso), { withTime: true });
}

function dayBucket(createdAt: string, todayIso: string): string {
  const d = isoDateInTz(new Date(createdAt), "Asia/Tehran");
  if (d === todayIso) return "امروز";
  const todayStart = new Date(`${todayIso}T12:00:00+03:30`).getTime();
  const itemStart = new Date(`${d}T12:00:00+03:30`).getTime();
  const diffDays = Math.round((todayStart - itemStart) / 86400000);
  if (diffDays === 1) return "دیروز";
  if (diffDays < 7) return "این هفته";
  return "قدیم‌تر";
}

export function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [marking, setMarking] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "page"],
    queryFn: () => api<{ notifications: Notification[]; unreadCount: number }>("/api/notifications"),
    refetchInterval: 20_000,
    refetchOnMount: "always",
    staleTime: 0,
  });

  async function markRead(ids: string[]) {
    await api("/api/notifications/read", { method: "POST", json: { ids } });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markAll() {
    await api("/api/notifications/read", { method: "POST", json: {} });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function open(n: Notification) {
    const target = targetOf(n);
    if (target) setMarking(n.id);
    if (!n.readAt) {
      await markRead([n.id]).catch(() => {});
    }
    if (target) router.push(target);
  }

  async function markOne(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setMarking(id);
    await markRead([id]).catch(() => {});
    setMarking(null);
  }

  const all = data?.notifications ?? [];
  const notifications = onlyUnread ? all.filter((n) => !n.readAt) : all;
  const todayIso = isoDateInTz(new Date(), "Asia/Tehran");
  const readCount = all.length - (data?.unreadCount ?? 0);

  const grouped = useMemo(() => {
    const order = ["امروز", "دیروز", "این هفته", "قدیم‌تر"];
    const map = new Map<string, Notification[]>();
    for (const n of notifications) {
      const key = dayBucket(n.createdAt, todayIso);
      (map.get(key) ?? map.set(key, []).get(key)!).push(n);
    }
    return order.filter((k) => map.has(k)).map((k) => ({ label: k, items: map.get(k)! }));
  }, [notifications, todayIso]);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Bell className="h-5 w-5" />
            اعلان‌ها
          </h1>
          {data && (
            <p className="mt-1 text-[12px] text-ink-soft">
              {data.unreadCount > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                  {faNum(data.unreadCount)} خوانده‌نشده · {faNum(readCount)} خوانده‌شده
                </span>
              ) : (
                `همه ${faNum(all.length)} اعلان خوانده شده`
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-line">
            <button
              type="button"
              onClick={() => setOnlyUnread(false)}
              className={cn(
                "px-3 py-1.5 text-[12px] transition-colors",
                !onlyUnread ? "bg-ink text-white" : "text-ink-soft hover:bg-paper-soft",
              )}
            >
              همه
            </button>
            <button
              type="button"
              onClick={() => setOnlyUnread(true)}
              className={cn(
                "px-3 py-1.5 text-[12px] transition-colors",
                onlyUnread ? "bg-ink text-white" : "text-ink-soft hover:bg-paper-soft",
              )}
            >
              فقط خوانده‌نشده
            </button>
          </div>
          {data && data.unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={markAll}>
              <CheckCheck className="h-4 w-4" />
              خواندن همه
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardHeader title="در حال بارگذاری…" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={i > 0 ? "border-t border-line" : ""}>
              <div className="flex gap-3 px-5 py-4">
                <SkeletonBlock className="h-10 w-10 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <SkeletonBlock className="h-3.5 w-16 rounded-full" />
                  <SkeletonBlock className="h-4 w-2/3" />
                  <SkeletonBlock className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="h-10 w-10" />}
            title={onlyUnread ? "همه اعلان‌ها را خوانده‌اید" : "اعلانی ندارید"}
            description={
              onlyUnread
                ? "اعلان خوانده‌نشده‌ای باقی نمانده — فیلتر «همه» را بزنید تا تاریخچه را ببینید."
                : "دعوت‌ها، تأییدها، یادآورها و تغییرات جلسات اینجا نمایش داده می‌شوند."
            }
          />
        </Card>
      ) : (
        <StaggerList className="space-y-4">
          {grouped.map((group) => (
            <StaggerItem key={group.label}>
              <Card className="overflow-hidden">
                <CardHeader
                  title={group.label}
                  subtitle={`${faNum(group.items.length)} اعلان`}
                />
                <div className="divide-y divide-line">
                  {group.items.map((n) => {
                    const target = targetOf(n);
                    const clickable = target !== null;
                    const meta = NOTIFICATION_META[n.type] ?? {
                      label: "اعلان",
                      icon: Bell,
                      tone: "neutral" as const,
                    };
                    const Icon = meta.icon;
                    const unread = !n.readAt;

                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => open(n)}
                        disabled={marking === n.id}
                        className={cn(
                          "group flex w-full gap-3 px-4 py-4 text-right transition-colors sm:px-5",
                          clickable ? "cursor-pointer hover:bg-paper-soft" : "cursor-default",
                          unread && "bg-paper-soft/50",
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                            TONE_CLASS[meta.tone],
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-paper-soft px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                              {meta.label}
                            </span>
                            {unread && (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                                جدید
                              </span>
                            )}
                          </div>
                          <p className={cn("mt-1.5 text-[13px] leading-5", unread ? "font-bold" : "font-medium")}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-ink-soft">{n.body}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
                            <Tooltip content={formatJalali(new Date(n.createdAt), { withTime: true })}>
                              <span>{relativeTime(n.createdAt)}</span>
                            </Tooltip>
                            {clickable && (
                              <span className="text-ink-soft group-hover:text-ink">مشاهده جزئیات</span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
                          {unread && (
                            <>
                              <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                              <IconTipButton
                                tip="علامت‌گذاری به‌عنوان خوانده‌شده"
                                onClick={(e) => markOne(e, n.id)}
                                className="rounded-md p-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-white hover:text-ink group-hover:opacity-100"
                              >
                                <Check className="h-4 w-4" />
                              </IconTipButton>
                            </>
                          )}
                          {clickable && (
                            <ChevronLeft className="h-4 w-4 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
