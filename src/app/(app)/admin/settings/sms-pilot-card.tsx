"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Phone } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { faStr, formatJalali, toEnDigits, stripBidiMarks, withRtlMark } from "@/lib";

type SmsStatus = {
  provider: "mock" | "kavenegar";
  configured: boolean;
  hasApiKey: boolean;
  sender: string | null;
  template: string | null;
  reminderSmsEnabled: boolean;
  lastSend: {
    ok: boolean;
    at: string | null;
    error: string | null;
    meetingTitle: string | null;
  } | null;
  lastTest: {
    ok: boolean;
    at: string;
    receptor: string | null;
    error: string | null;
    provider: string | null;
  } | null;
};

function StatusRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[13px]">
      <span className="shrink-0 text-ink-soft">{label}</span>
      <span className="text-left text-ink" dir="ltr">
        {children}
      </span>
    </div>
  );
}

export function SmsPilotCard() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-sms"],
    queryFn: () => api<SmsStatus>("/api/admin/sms"),
  });

  async function sendTest() {
    setBusy(true);
    try {
      const result = await api<{ ok: boolean; provider: string; receptor: string }>("/api/admin/sms", {
        method: "POST",
        json: { phone: toEnDigits(stripBidiMarks(phone.trim())) },
      });
      push(
        result.provider === "kavenegar"
          ? `پیامک آزمایشی به ${faStr(result.receptor)} ارسال شد`
          : `حالت شبیه‌سازی: پیامک به ${faStr(result.receptor)} فقط در لاگ سرور ثبت شد`,
        "success",
      );
      await qc.invalidateQueries({ queryKey: ["admin-sms"] });
    } catch (e) {
      push((e as ApiError).message, "error");
      await qc.invalidateQueries({ queryKey: ["admin-sms"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card data-tour="sms-pilot" data-testid="sms-pilot-card">
      <CardHeader
        title="پیامک کاوه‌نگار"
        subtitle="پایلوت ارسال واقعی با SMS_API_KEY — در توسعه حالت شبیه‌سازی بماند"
      />
      <CardBody className="space-y-4">
        {isLoading || !data ? (
          <SkeletonBlock className="h-36 w-full" />
        ) : (
          <>
            <div className="space-y-2 rounded-md border border-[#ececf0] bg-paper-soft/40 p-3">
              <StatusRow label="حالت">
                {data.provider === "kavenegar" ? "کاوه‌نگار (ارسال واقعی)" : "شبیه‌سازی (فقط لاگ)"}
              </StatusRow>
              <StatusRow label="کلید API">{data.hasApiKey ? "تنظیم شده" : "نیست"}</StatusRow>
              <StatusRow label="فرستنده">{data.sender ? faStr(data.sender) : "—"}</StatusRow>
              <StatusRow label="قالبکد">
                {data.template ? faStr(data.template) : "بدون قالب (ارسال متنی)"}
              </StatusRow>
              <StatusRow label="کانال یادآور SMS">
                {data.reminderSmsEnabled ? "روشن" : "خاموش — REMINDER_CHANNELS"}
              </StatusRow>
            </div>

            <div className="space-y-1.5" data-testid="sms-last-send">
              <p className="text-[12px] font-medium text-ink-soft">آخرین ارسال یادآور</p>
              {!data.lastSend ? (
                <p className="text-[13px] text-ink-soft">هنوز ارسالی ثبت نشده</p>
              ) : data.lastSend.ok ? (
                <p className="flex items-start gap-1.5 text-[13px] text-ink">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    موفق
                    {data.lastSend.at ? ` — ${formatJalali(new Date(data.lastSend.at), { withTime: true })}` : ""}
                    {data.lastSend.meetingTitle ? ` — «${data.lastSend.meetingTitle}»` : ""}
                  </span>
                </p>
              ) : (
                <p className="flex items-start gap-1.5 text-[13px] text-red-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    خطا
                    {data.lastSend.at ? ` — ${formatJalali(new Date(data.lastSend.at), { withTime: true })}` : ""}
                    {data.lastSend.error ? ` — ${data.lastSend.error}` : ""}
                  </span>
                </p>
              )}
            </div>

            {data.lastTest && (
              <div className="space-y-1.5" data-testid="sms-last-test">
                <p className="text-[12px] font-medium text-ink-soft">آخرین پیام آزمایشی</p>
                <p className="text-[13px] text-ink">
                  {data.lastTest.ok ? "موفق" : "خطا"}
                  {" — "}
                  {formatJalali(new Date(data.lastTest.at), { withTime: true })}
                  {data.lastTest.receptor ? ` — ${faStr(data.lastTest.receptor)}` : ""}
                  {data.lastTest.error ? ` — ${data.lastTest.error}` : ""}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-ink-soft">تست با یک شماره</span>
                <input
                  value={withRtlMark(faStr(phone))}
                  onChange={(e) => setPhone(toEnDigits(stripBidiMarks(e.target.value)))}
                  inputMode="tel"
                  dir="rtl"
                  placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                  className="h-10 w-full rounded-md border border-line px-3 text-[13px] outline-none focus:border-ink"
                  data-testid="sms-test-phone"
                />
              </label>
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  loading={busy}
                  disabled={phone.replace(/\D/g, "").length < 10}
                  onClick={sendTest}
                  data-testid="sms-test-send"
                >
                  <Phone className="h-4 w-4" />
                  ارسال آزمایشی
                </Button>
              </div>
              {data.provider === "mock" && (
                <p className="text-[11px] leading-5 text-ink-faint">
                  الان حالت شبیه‌سازی است. برای ارسال واقعی در `.env`:{" "}
                  <span dir="ltr">NOTIFICATION_SMS_PROVIDER=kavenegar</span> و{" "}
                  <span dir="ltr">SMS_API_KEY</span> سپس worker و سرور را ری‌استارت کنید.
                </p>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
