"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, ExternalLink } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { faStr, formatJalali } from "@/lib";

interface DisplayTokenStatus {
  enabled: boolean;
  displayCode: string | null;
  createdAt: string | null;
}

interface Rotated {
  token: string;
  displayCode: string;
  url: string;
  createdAt: string;
  enabled: boolean;
}

export function RoomDisplaySetup({ roomId }: { roomId: string }) {
  const { can } = useAuth();
  const { push } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<Rotated | null>(null);
  const [copied, setCopied] = useState<"url" | "code" | null>(null);

  const enabledQuery = can("room:update");
  const { data, isLoading } = useQuery({
    queryKey: ["room-display-token", roomId],
    queryFn: () => api<DisplayTokenStatus>(`/api/rooms/${roomId}/display-token`),
    enabled: enabledQuery,
  });

  if (!enabledQuery) return null;

  async function rotate() {
    setBusy(true);
    try {
      const res = await api<Rotated>(`/api/rooms/${roomId}/display-token`, { method: "POST" });
      setFresh(res);
      await qc.invalidateQueries({ queryKey: ["room-display-token", roomId] });
      push(data?.enabled ? "لینک نمایشگر تازه ساخته شد" : "نمایشگر تبلت فعال شد", "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await api(`/api/rooms/${roomId}/display-token`, { method: "DELETE" });
      setFresh(null);
      await qc.invalidateQueries({ queryKey: ["room-display-token", roomId] });
      push("دسترسی نمایشگر باطل شد", "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function copy(kind: "url" | "code", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      push("کپی نشد", "error");
    }
  }

  const url = fresh?.url;
  const code = fresh?.displayCode ?? data?.displayCode;

  return (
    <Card data-tour="room-display">
      <CardHeader
        title="نمایشگر تبلت کنار در"
        subtitle="صفحهٔ تمام‌صفحه بدون لاگین — توکن در لینک، یا کد ۸ رقمی اتاق"
      />
      <CardBody className="space-y-3 text-[12px]">
        {isLoading ? (
          <p className="text-ink-faint">در حال بارگذاری…</p>
        ) : (
          <>
            <p className="leading-6 text-ink-soft">
              تبلت را روی لینک نمایشگر قفل کنید. عنوان جلسات محرمانه همیشه «جلسه محرمانه» دیده می‌شود.
            </p>
            {data?.enabled && data.createdAt && (
              <p className="text-ink-faint">فعال از {formatJalali(new Date(data.createdAt), { withTime: true })}</p>
            )}
            {code && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-paper-soft px-3 py-2">
                <div>
                  <p className="text-[11px] text-ink-soft">کد اتاق</p>
                  <p className="font-bold tracking-widest" dir="ltr">
                    {faStr(code)}
                  </p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => copy("code", code)}>
                  {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  کپی کد
                </Button>
              </div>
            )}
            {url && (
              <div className="rounded-md border border-line bg-paper-soft px-3 py-2">
                <p className="text-[11px] text-ink-soft">لینک را یک‌بار کپی کنید — بعد از بستن این صفحه دوباره دیده نمی‌شود</p>
                <p className="mt-1 break-all text-[11px] text-ink" dir="ltr">
                  {url}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => copy("url", url)}>
                    {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    کپی لینک
                  </Button>
                  <Link href={url} target="_blank">
                    <Button type="button" size="sm" variant="outline">
                      <ExternalLink className="h-4 w-4" />
                      باز کردن
                    </Button>
                  </Link>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={rotate} loading={busy}>
                {data?.enabled ? "ساخت لینک جدید" : "فعال‌سازی نمایشگر"}
              </Button>
              {data?.enabled && (
                <Button type="button" size="sm" variant="ghost" onClick={revoke} disabled={busy}>
                  باطل کردن
                </Button>
              )}
              <Link href={`/rooms/${roomId}/display`}>
                <Button type="button" size="sm" variant="outline">
                  پیش‌نمایش
                </Button>
              </Link>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
