"use client";

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

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "page"],
    queryFn: () => api<{ notifications: Notification[]; unreadCount: number }>("/api/notifications"),
    refetchInterval: 20_000,
  });

  async function markAll() {
    await api("/api/notifications", { method: "POST", json: {} });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4 lg:p-6">
        <SkeletonBlock className="h-8 w-32" />
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-16" />
        ))}
      </div>
    );
  }

  const notifications = data?.notifications ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">
          اعلان‌ها
          {data && data.unreadCount > 0 && (
            <span className="mr-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {faNum(data.unreadCount)}
            </span>
          )}
        </h1>
        {data && data.unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAll}>
            <CheckCheck className="h-4 w-4" />
            خواندن همه
          </Button>
        )}
      </div>

      <Card>
        {notifications.length === 0 ? (
          <EmptyState icon={<Bell className="h-10 w-10" />} title="اعلانی ندارید" />
        ) : (
          <div className="divide-y divide-line">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn("flex gap-3 px-5 py-4", !n.readAt && "bg-paper-soft/60")}
              >
                <span className="mt-0.5 text-[16px]">{TYPE_ICON[n.type] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[13px]", !n.readAt ? "font-bold" : "font-medium")}>
                    {n.title}
                  </p>
                  {n.body && <p className="mt-0.5 text-[12px] text-ink-soft">{n.body}</p>}
                  <p className="mt-1 text-[10px] text-ink-faint">
                    {formatJalali(new Date(n.createdAt), { withTime: true })}
                  </p>
                </div>
                {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
