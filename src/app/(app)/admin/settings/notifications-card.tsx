"use client";

/**
 * کارت واحد «اعلان‌ها و پیام‌رسانی» — SMTP + پیامک کاوه‌نگار در یک‌جا.
 * هر کانال یک ردیف آکاردئونی؛ وضعیت لحظه‌ای در هدر.
 */

import { useState } from "react";
import { ChevronDown, MessageCircle, Phone } from "@/components/ui/icon";
import { SmsPilotCard } from "./sms-pilot-card";
import { EmailPilotCard } from "./email-pilot-card";

export function NotificationsCard() {
  const [openRow, setOpenRow] = useState<"email" | "sms" | null>("email");

  const Row = ({
    id, icon, title, hint, children,
  }: {
    id: "email" | "sms"; icon: React.ReactNode; title: string; hint: string; children: React.ReactNode;
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
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-ink-soft">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold">{title}</span>
            <span className="mt-0.5 block truncate text-[11px] leading-5 text-ink-faint">{hint}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
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
        <Row id="email" icon={<MessageCircle className="h-[18px] w-[18px]" />} title="ایمیل (SMTP)" hint="ارسال دعوت، یادآور و بازیابی رمز">
          <EmailPilotCard />
        </Row>
        <Row id="sms" icon={<Phone className="h-[18px] w-[18px]" />} title="پیامک کاوه‌نگار" hint="پایلوت ارسال واقعی — در توسعه شبیه‌سازی">
          <SmsPilotCard />
        </Row>
      </div>
    </div>
  );
}
