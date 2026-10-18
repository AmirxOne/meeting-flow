"use client";

/**
 * کارت واحد «اعلان‌ها و پیام‌رسانی» — SMTP + پیامک کاوه‌نگار در یک‌جا.
 * آیکون هر ردیف وضعیت را نشان می‌دهد: سبز = ارسال واقعی فعال، خاکستری = شبیه‌سازی/غیرفعال.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib";
import { ChevronDown, MessageCircle, Phone } from "@/components/ui/icon";
import { SmsPilotCard } from "./sms-pilot-card";
import { EmailPilotCard } from "./email-pilot-card";

export function NotificationsCard() {
  const [openRow, setOpenRow] = useState<"email" | "sms" | null>("email");

  // وضعیت زنده برای رنگ آیکون‌ها
  const emailQ = useQuery({
    queryKey: ["admin-email"],
    queryFn: () => api<{ provider: string; configured: boolean }>("/api/admin/email"),
  });
  const smsQ = useQuery({
    queryKey: ["admin-sms"],
    queryFn: () => api<{ provider: string; configured: boolean }>("/api/admin/sms"),
  });

  const emailOn = emailQ.data ? emailQ.data.provider === "smtp" && emailQ.data.configured : null;
  const smsOn = smsQ.data ? smsQ.data.provider === "kavenegar" && smsQ.data.configured : null;

  const Row = ({
    id, icon, title, hint, on, children,
  }: {
    id: "email" | "sms"; icon: React.ReactNode; title: string; hint: string;
    on: boolean | null; children: React.ReactNode;
  }) => {
    const open = openRow === id;
    return (
      <div className={open ? "rounded-lg bg-paper-soft/40" : "rounded-lg"}>
        <button
          type="button"
          onClick={() => setOpenRow(open ? null : id)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-right"
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
              on === null ? "bg-ink/5 text-ink-soft"
                : on ? "bg-emerald-50 text-emerald-600"
                : "bg-paper-soft text-ink-faint ring-1 ring-line",
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-[13px] font-bold">{title}</span>
              {on !== null && (
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[9.5px] font-bold",
                  on ? "bg-emerald-50 text-emerald-700" : "bg-paper-soft text-ink-faint ring-1 ring-line",
                )}>
                  {on ? "فعال" : "شبیه‌سازی"}
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[11px] leading-5 text-ink-faint">{hint}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", open && "rotate-180")} />
        </button>
        {open && <div className="border-t border-line/70 pb-2 pt-2">{children}</div>}
      </div>
    );
  };

  return (
    <div className="rounded-md border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold">اعلان‌ها و پیام‌رسانی</h3>
          <div className="mt-0.5 text-[12px] leading-5 text-ink-soft">کانال‌های اطلاع‌رسانی دعوت‌ها و یادآورها — ایمیل و پیامک</div>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <Row
          id="email"
          icon={<MessageCircle className="h-[18px] w-[18px]" />}
          title="ایمیل (SMTP)"
          hint={emailOn ? "ارسال واقعی فعال است" : "حالت شبیه‌سازی — دعوت‌ها واقعاً ارسال نمی‌شوند"}
          on={emailOn}
        >
          <EmailPilotCard />
        </Row>
        <Row
          id="sms"
          icon={<Phone className="h-[18px] w-[18px]" />}
          title="پیامک کاوه‌نگار"
          hint={smsOn ? "ارسال واقعی با کاوه‌نگار" : "حالت شبیه‌سازی — در توسعه شبیه‌سازی"}
          on={smsOn}
        >
          <SmsPilotCard />
        </Row>
      </div>
    </div>
  );
}
