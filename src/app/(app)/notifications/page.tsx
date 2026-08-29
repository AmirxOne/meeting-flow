"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Card, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, faNum, formatJalali } from "@/lib";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: { meetingId?: string } | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  MEETING_CREATED: "🗓",
  MEETING_APPROVED: "✅",
  MEETING_REJECTED: "❌",
  MEETING_CANCELLED: "🚫",
  MEETING_RESCHEDULED: "🔄",
  ROOM_CHANGED: "🚪",
  PARTICIPANT_ADDED: "👤",
  MEETING_REMINDER: "⏰",
  MEETING_STARTED: "🔴",
  MEETING_EXTENDED: "⏱",
};

/** Where should clicking this notification take you? */
function targetOf(n: Notification): string | null {
  if (n.data?.meetingId) return `/meetings/${n.data.meetingId}`;
  return null;
}

export default function NotificationsPage() {
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

  /** click: mark read + navigate to the related entity */
  async function open(n: Notification) {
    const target = targetOf(n);
    if (target) setMarking(n.id);
    if (!n.readAt) {
      // await the read-mark so the state is committed before navigating away
      await markRead([n.id]).catch(() => {});
    }
    if (target) router.push(target);
  }

  const all = data?.notifications ?? [];
  const notifications = onlyUnread ? all.filter((n) => !n.readAt) : all;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          اعلان‌ها
          {data && data.unreadCount > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {faNum(data.unreadCount)}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyUnread((v) => !v)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-[11px] transition-colors",
              onlyUnread ? "border-ink bg-ink text-white" : "border-line text-ink-soft hover:bg-paper-soft",
            )}
          >
            فقط خوانده‌نشده
          </button>
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
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={i > 0 ? "border-t border-line" : ""}>
              <div className="flex gap-3 px-5 py-4">
                <div className="skeleton mt-0.5 h-5 w-5 shrink-0 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-2.5 w-32" />
                </div>
              </div>
            </div>
          ))}
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="h-10 w-10" />}
            title={onlyUnread ? "همه اعلان‌ها را خوانده‌اید" : "اعلانی ندارید"} description={onlyUnread ? undefined : "دعوت‌ها، تأییدها و یادآورهای جلسات اینجا ظاهر می‌شوند"}
          />
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-line">
            {notifications.map((n) => {
              const target = targetOf(n);
              const clickable = target !== null;
              return (
                <button
                  key={n.id}
                  onClick={() => open(n)}
                  disabled={marking === n.id}
                  className={cn(
                    "flex w-full gap-3 px-5 py-4 text-right transition-colors",
                    clickable ? "cursor-pointer hover:bg-paper-soft" : "cursor-default",
                    !n.readAt && "bg-paper-soft/60",
                  )}
                >
                  <span className="mt-0.5 text-[16px]">{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13px]", !n.readAt ? "font-bold" : "font-medium")}>
                      {n.title}
                    </p>
                    {n.body && <p className="mt-0.5 text-[12px] text-ink-soft">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-ink-faint">
                      {formatJalali(new Date(n.createdAt), { withTime: true })}
                      {clickable && <span className="mr-2 text-ink-soft underline underline-offset-2">مشاهده جزئیات ←</span>}
                    </p>
                  </div>
                  {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
