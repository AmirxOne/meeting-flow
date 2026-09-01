"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib";
import {
  NOTIF_CHANNEL_FA,
  NOTIF_EVENT_FA,
  type NotifChannel,
  type NotifEvent,
} from "@/lib/notification-prefs";

type PrefsPayload = {
  channels: NotifChannel[];
  hasPhone: boolean;
  hasEmail: boolean;
  hasPush: boolean;
  matrix: Record<NotifEvent, Record<NotifChannel, boolean>>;
  reasons: Partial<Record<NotifChannel, string | null>>;
};

function PrefSwitch({
  on,
  disabled,
  label,
  reason,
  onToggle,
}: {
  on: boolean;
  disabled: boolean;
  label: string;
  reason: string | null;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-disabled={disabled}
      title={disabled && reason ? reason : undefined}
      disabled={disabled}
      onClick={() => onToggle(!on)}
      className={cn(
        "flex h-6 w-11 items-center rounded-full px-0.5 transition",
        disabled && "cursor-not-allowed opacity-40",
        on ? "justify-start bg-ink" : "justify-end bg-[#d9d9e0]",
      )}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow" />
    </button>
  );
}

export function NotificationPrefsCard() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => api<PrefsPayload>("/api/notifications/preferences"),
  });

  async function toggle(event: NotifEvent, channel: NotifChannel, next: boolean) {
    const key = `${event}:${channel}`;
    setBusyKey(key);
    try {
      const updated = await api<PrefsPayload>("/api/notifications/preferences", {
        method: "PATCH",
        json: { [event]: { [channel]: next } },
      });
      qc.setQueryData(["notification-prefs"], updated);
      push(next ? "اعلان این کانال روشن شد" : "اعلان این کانال خاموش شد", "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Card data-tour="notif-prefs" data-testid="notif-prefs-card">
      <CardHeader
        title="ترجیح اعلان"
        subtitle="دعوت، یادآور و تغییر زمان — پیش‌فرض سازمان؛ هر کانال را می‌توانید خاموش کنید"
      />
      <CardBody className="space-y-3">
        {isLoading || !data ? (
          <SkeletonBlock className="h-36 w-full" />
        ) : (
          <>
            <p className="text-[12px] leading-6 text-ink-soft">
              کانال‌های سازمان به‌صورت پیش‌فرض روشن‌اند. اگر شماره یا ایمیل نداشته باشید همان کانال غیرفعال است.
            </p>
            {(Object.keys(NOTIF_EVENT_FA) as NotifEvent[]).map((event) => (
              <div
                key={event}
                className="rounded-md border border-[#ececf0] bg-paper-soft/40 p-3"
                data-testid={`notif-prefs-${event}`}
              >
                <p className="mb-2 text-[13px] font-medium text-ink">{NOTIF_EVENT_FA[event]}</p>
                <ul className="space-y-2">
                  {data.channels.map((channel) => {
                    const reason = data.reasons[channel] ?? null;
                    const locked = !!reason;
                    const on = data.matrix[event][channel];
                    return (
                      <li
                        key={channel}
                        className="flex items-center justify-between gap-3"
                        data-testid={`notif-prefs-${event}-${channel}`}
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] text-ink">{NOTIF_CHANNEL_FA[channel]}</p>
                          {reason ? (
                            <p className="text-[11px] leading-5 text-ink-faint">{reason}</p>
                          ) : null}
                        </div>
                        <PrefSwitch
                          on={on}
                          disabled={locked || busyKey !== null}
                          label={`${NOTIF_EVENT_FA[event]} — ${NOTIF_CHANNEL_FA[channel]}`}
                          reason={reason}
                          onToggle={(next) => {
                            if (locked || busyKey) return;
                            void toggle(event, channel, next);
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </>
        )}
      </CardBody>
    </Card>
  );
}
