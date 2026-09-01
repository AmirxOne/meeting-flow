"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { faNum } from "@/lib";

type PushStatus = {
  configured: boolean;
  vapidPublicKey: string | null;
  subscribed: boolean;
  deviceCount: number;
};

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function WebPushCard() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["web-push"],
    queryFn: () => api<PushStatus>("/api/push"),
  });

  const supported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  async function enable() {
    if (!data?.vapidPublicKey) {
      push("کلید VAPID روی سرور تنظیم نشده", "error");
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        push("اجازهٔ اعلان در مرورگر داده نشد", "error");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.vapidPublicKey) as BufferSource,
      });
      const json = sub.toJSON();
      await api("/api/push", {
        method: "POST",
        json: {
          endpoint: json.endpoint,
          keys: json.keys,
        },
      });
      await qc.invalidateQueries({ queryKey: ["web-push"] });
      await qc.invalidateQueries({ queryKey: ["notification-prefs"] });
      push("اعلان پوش فعال شد", "success");
    } catch (e) {
      push((e as ApiError).message ?? "فعال‌سازی پوش ناموفق بود", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      let endpoint: string | undefined;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        endpoint = sub?.endpoint;
        await sub?.unsubscribe();
      } catch {
        /* browser may already have revoked it */
      }
      await api("/api/push", { method: "DELETE", json: endpoint ? { endpoint } : {} });
      await qc.invalidateQueries({ queryKey: ["web-push"] });
      await qc.invalidateQueries({ queryKey: ["notification-prefs"] });
      push("اعلان پوش خاموش شد", "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card data-tour="web-push" data-testid="web-push-card">
      <CardHeader
        title="اعلان پوش مرورگر"
        subtitle="یادآور و دعوت جلسه روی همین دستگاه — اختیاری است"
      />
      <CardBody className="space-y-4">
        {isLoading ? (
          <SkeletonBlock className="h-20 w-full" />
        ) : (
          <>
            <p className="text-[12px] leading-6 text-ink-soft">
              اگر اجازه بدهید، مهرسا یادآور جلسه و دعوت‌های جدید را به‌صورت اعلان مرورگر می‌فرستد.
              بدون اشتراک هیچ پوشی ارسال نمی‌شود.
            </p>
            {!supported && (
              <p className="text-[12px] text-ink-soft">این مرورگر از اعلان پوش پشتیبانی نمی‌کند.</p>
            )}
            {supported && !data?.configured && (
              <p data-testid="web-push-status" className="text-[13px] text-ink-soft">
                اعلان پوش روی این سرور پیکربندی نشده (کلید VAPID).
              </p>
            )}
            {supported && data?.configured && data.subscribed && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p
                    data-testid="web-push-status"
                    className="flex items-center gap-1.5 text-[13px] font-medium text-ink"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    فعال است
                  </p>
                  {data.deviceCount > 1 && (
                    <p className="text-[12px] text-ink-faint">
                      {faNum(data.deviceCount)} دستگاه ثبت شده
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={busy}
                  onClick={disable}
                  data-testid="web-push-disable"
                >
                  خاموش کردن
                </Button>
              </div>
            )}
            {supported && data?.configured && !data.subscribed && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p data-testid="web-push-status" className="text-[13px] text-ink-soft">
                  هنوز فعال نیست
                </p>
                <Button
                  type="button"
                  size="sm"
                  loading={busy}
                  onClick={enable}
                  data-testid="web-push-enable"
                >
                  <Bell className="h-4 w-4" />
                  اجازهٔ اعلان پوش
                </Button>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
