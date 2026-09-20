"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, ArrowLeft } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { faStr, formatJalali } from "@/lib";

type EmailStatus = {
  provider: "mock" | "smtp";
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  from: string | null;
  missing: string[];
  lastFailure: { at: string; error: string; meetingTitle: string | null } | null;
  lastSent: { at: string; meetingTitle: string | null } | null;
  lastTest: { ok: boolean; at: string; to: string | null; error: string | null; provider: string | null } | null;
};

/** Admin: SMTP email status + one-address pilot test (mirrors SMS pilot card). */
export function EmailPilotCard() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-email"],
    queryFn: () => api<EmailStatus>("/api/admin/email"),
  });

  async function sendTest() {
    if (!email.trim()) {
      push("ایمیل مقصد را وارد کنید", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ ok: boolean; provider: string; to: string }>("/api/admin/email", {
        method: "POST",
        json: { email: email.trim() },
      });
      push(
        result.provider === "smtp"
          ? `ایمیل آزمایشی به ${result.to} ارسال شد`
          : `حالت شبیه‌سازی: ایمیل به ${result.to} فقط در لاگ سرور ثبت شد`,
        "success",
      );
      await qc.invalidateQueries({ queryKey: ["admin-email"] });
    } catch (e) {
      push((e as ApiError).message, "error");
      await qc.invalidateQueries({ queryKey: ["admin-email"] });
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !data) {
    return (
      <Card data-testid="email-pilot-card">
        <CardHeader title="ایمیل (SMTP)" />
        <CardBody>
          <p className="p-4 text-center text-[12px] text-ink-faint">در حال بارگذاری…</p>
        </CardBody>
      </Card>
    );
  }

  const real = data.provider === "smtp" && data.configured;

  return (
    <Card data-tour="email-pilot" data-testid="email-pilot-card">
      <CardHeader
        title="ایمیل (SMTP)"
        subtitle={real ? "ارسال واقعی فعال است" : data.provider === "smtp" ? "SMTP انتخاب شده ولی ناقص" : "حالت شبیه‌سازی (dev)"}
      />
      <CardBody className="space-y-4">
        {/* status */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-soft">حالت ارسال</span>
            <span className={real ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
              {real ? "واقعی (SMTP)" : data.provider === "smtp" ? "ناقص" : "شبیه‌سازی"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-soft">سرور</span>
            <span dir="ltr" className="text-ink">
              {data.host ? `${data.host}:${data.port}${data.secure ? " (TLS)" : ""}` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-soft">فرستنده</span>
            <span dir="ltr" className="text-ink">{data.from ?? "—"}</span>
          </div>
        </div>

        {/* setup guide when mock/incomplete */}
        {!real && (
          <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/70 p-3 text-[11.5px] leading-6 text-amber-900">
            <p className="font-bold">برای فعال‌سازی ارسال واقعی:</p>
            <p className="mt-1">در فایل <code dir="ltr" className="rounded bg-white px-1">.env</code> این متغیرها را تنظیم کنید و سرور را ری‌استارت کنید:</p>
            <pre dir="ltr" className="mt-1.5 overflow-x-auto rounded bg-white p-2 text-left text-[10.5px] leading-5">{`NOTIFICATION_EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=no-reply@example.com
SMTP_PASS=••••••••
SMTP_FROM=مهرسا <no-reply@example.com>`}</pre>
            {data.missing.length > 0 && (
              <p className="mt-1.5">موارد جا افتاده: {data.missing.join(" · ")}</p>
            )}
          </div>
        )}

        {/* pilot test */}
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-ink-soft">ارسال ایمیل آزمایشی به یک نشانی</label>
          <div className="flex gap-2">
            <input
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="h-10 min-w-0 flex-1 rounded-md border border-line px-3 text-left text-[12px] outline-none focus:border-ink"
            />
            <Button onClick={sendTest} disabled={busy} size="sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              {busy ? "در حال ارسال…" : "ارسال آزمایشی"}
            </Button>
          </div>
          {data.lastTest && (
            <p className={`mt-1.5 text-[11px] ${data.lastTest.ok ? "text-emerald-700" : "text-red-600"}`}>
              آخرین تست: {formatJalali(new Date(data.lastTest.at), { withTime: true })}
              {data.lastTest.ok ? ` به ${faStr(data.lastTest.to ?? "")} ✓` : ` — خطا: ${data.lastTest.error?.slice(0, 80)}`}
            </p>
          )}
        </div>

        {/* last activity */}
        {data.lastSent && (
          <p className="border-t border-line pt-3 text-[11px] text-ink-faint">
            آخرین یادآور ارسال‌شده: {formatJalali(new Date(data.lastSent.at), { withTime: true })}
            {data.lastSent.meetingTitle ? ` — «${data.lastSent.meetingTitle}»` : ""}
          </p>
        )}
        {data.lastFailure && (
          <p className="text-[11px] text-red-600">
            آخرین خطای ارسال: {data.lastFailure.error.slice(0, 100)}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
