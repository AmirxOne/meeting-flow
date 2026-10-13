"use client";

/**
 * کارت «زمان‌بندی هوشمند» — در صف درخواست‌های ادمین.
 * جریان: انتخاب بازه (هفتگی/ماهانی) → تولید Draft → پیش‌نمایش +
 * ویرایش → تأیید نهایی (اعمال تراکنشی).
 * دستی‌سازی فعلی دست‌نخورده می‌ماند.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { faNum, cn } from "@/lib";
import { Sparkles } from "@/components/ui/icon";

interface DraftAssignment {
  requestId: string;
  title: string;
  start: string;
  end: string;
  roomId: string | null;
  roomName: string | null;
  priorityScore: number;
  reason: string;
}

interface PlanDraft {
  id: string;
  createdAt: string;
  windowFrom: string;
  windowTo: string;
  assignments: DraftAssignment[];
  unscheduled: { requestId: string; title: string; reason: string }[];
  aiSummary: string | null;
  aiUsed: boolean;
  aiNotice: string | null;
  stats: { total: number; scheduled: number; unscheduled: number; elapsedMs: number };
}

function faDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fa-IR", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

/** بازه‌ی پیشنهادی: هفته یا ماه آینده از امروز */
function rangeFor(mode: "week" | "month"): { from: string; to: string } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  if (mode === "week") to.setDate(to.getDate() + 7);
  else to.setMonth(to.getMonth() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function SmartScheduleCard() {
  const { push } = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<"week" | "month">("week");
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const range = rangeFor(mode);
      const r = await api<{ draft: PlanDraft }>("/api/admin/smart-schedule", {
        method: "POST",
        json: { windowFrom: range.from, windowTo: range.to, useAi: true },
      });
      push(
        r.draft.aiUsed
          ? `${faNum(r.draft.stats.scheduled)} از ${faNum(r.draft.stats.total)} درخواست زمان‌بندی شد (الگوریتم + تحلیل AI) — پیش‌نمایش در تقویم`
          : `${faNum(r.draft.stats.scheduled)} از ${faNum(r.draft.stats.total)} درخواست زمان‌بندی شد (الگوریتم بومی) — ${r.draft.aiNotice ?? ""}`,
        r.draft.aiUsed ? "success" : "success",
      );
      router.push("/calendar?smart=1&view=month");
    } catch (e) {
      push((e as ApiError).message ?? "تولید برنامه ناموفق بود", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              زمان‌بندی هوشمند
            </span>
          }
          subtitle="درخواست‌های باز را خودکار اولویت‌بندی و زمان‌بندی می‌کند — پیش‌نمایش و تأیید نهایی با شماست"
          action={
            <div className="flex items-center gap-2">
              <Select
                value={mode}
                onChange={(v) => setMode(v as "week" | "month")}
                options={[
                  { value: "week", label: "هفته‌ی آینده" },
                  { value: "month", label: "ماه آینده" },
                ]}
              />
              <Button size="sm" loading={busy} onClick={generate}>
                تولید برنامه
              </Button>
            </div>
          }
        />
        <div className="space-y-1.5 p-5 pt-4 text-[12px] leading-6 text-ink-soft">
          <p>
            قوانین اجباری رعایت می‌شوند: عدم هم‌پوشانی شرکت‌کنندگان، ساعات کاری، تعطیلات، ظرفیت اتاق‌ها و پنجره‌ی ترجیحی هر درخواست.
            زمان‌بندی دستی از طریق همان دکمه‌های فعلی هر درخواست همچنان کار می‌کند.
          </p>
          <p className="text-[11px] text-ink-faint">
            بدون پروایدر هم کار می‌کند (الگوریتم چندلایه روی دیتای جلسات) — با افزودن پروایدر هوش مصنوعی در تنظیمات، تحلیل هوشمندتر و نتیجه‌ی دقیق‌تری بگیرید.
          </p>
        </div>
      </Card>


    </>
  );
}
