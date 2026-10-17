"use client";

/**
 * کارت «دعوت به برنامه‌ی نوبت‌دهی» — داشبورد.
 * برنامه‌ی جدیدِ منتشرشده که کاربر هنوز به آن پاسخ نداده:
 *  - «گرفتن نوبت» → مودال سه‌گامی رزرو
 *  - «شرکت نمی‌کنم» → DECLINED، کارت دیگر نشان داده نمی‌شود
 * بعد از رزرو موفق هم (booking دارد) کارت می‌رود.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, faNum } from "@/lib";
import { CalendarClock, X } from "@/components/ui/icon";

interface Invite {
  id: string;
  title: string;
  hostName: string;
  durationMin: number;
  validTo: string;
  windows?: { daysOfWeek: number[]; from: string; to: string }[] | null;
  isConfidential: boolean;
}

const WEEKDAY_FA: Record<number, string> = {
  6: "شنبه", 0: "یکشنبه", 1: "دوشنبه", 2: "سه‌شنبه", 3: "چهارشنبه", 4: "پنجشنبه", 5: "جمعه",
};
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
function hhmm(t: string): string {
  const [h, m] = t.split(":");
  return `${Number(h).toString().replace(/\d/g, (d) => FA_DIGITS[+d])}:${m.replace(/\d/g, (d) => FA_DIGITS[+d])}`;
}
function windowsSummary(windows: Invite["windows"]): string {
  if (!windows?.length) return "";
  return windows
    .slice(0, 2)
    .map((w) => {
      const days = w.daysOfWeek.map((d) => WEEKDAY_FA[d] ?? "").filter(Boolean);
      const dayTxt = days.length >= 6 ? "همه‌ی روزها" : days.length ? `${days.join(" و ")}‌ها` : "";
      return `${dayTxt} ${hhmm(w.from)} تا ${hhmm(w.to)}`.trim();
    })
    .join(" · ");
}

export function ProgramInviteCard({ onBook }: { onBook: (invite: Invite) => void }) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: dash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<{ programInvites: Invite[] }>("/api/dashboard"),
  });
  const invites = dash?.programInvites ?? [];

  const declineMut = useMutation({
    mutationFn: (id: string) => api(`/api/appointments/programs/${id}/respond`, { method: "POST", json: { response: "DECLINED" } }),
    onSuccess: () => {
      push("ثبت شد — در این برنامه شرکت نمی‌کنی", "info");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => push((e as ApiError).message || "ثبت ناموفق بود", "error"),
  });

  if (invites.length === 0) return null;
  const invite = invites[0];
  const summary = windowsSummary(invite.windows);

  return (
    <Card className="ring-1 ring-amber-100">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600")}>
            <CalendarClock className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[13.5px] font-bold">
              نوبت‌دهی جدید: {invite.title}
              {invite.isConfidential && <span title="جلسه محرمانه">🔒</span>}
              {invites.length > 1 && <span className="badge badge-gray">+{faNum(invites.length - 1)} برنامه‌ی دیگر</span>}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-5 text-ink-soft">
              {invite.hostName} برنامه‌ای {faNum(invite.durationMin)} دقیقه‌ای منتشر کرده{summary ? ` — ${summary}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-ink-soft hover:bg-paper-soft"
            disabled={declineMut.isPending && busyId === invite.id}
            onClick={() => { setBusyId(invite.id); declineMut.mutate(invite.id); }}
          >
            <X className="h-3.5 w-3.5" />
            شرکت نمی‌کنم
          </Button>
          <Button size="sm" onClick={() => onBook(invite)}>
            <CalendarClock className="h-3.5 w-3.5" />
            گرفتن نوبت
          </Button>
        </div>
      </div>
    </Card>
  );
}
