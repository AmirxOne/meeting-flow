"use client";

/**
 * کارت «اعلام زمان‌های آزاد» — در داشبورد.
 * وقتی کاربر درخواست فعالِ ثبت‌نشده دارد، همین‌جا (بدون مودال مزاحم)
 * روزها و بازه‌هایی که می‌تواند شرکت کند را انتخاب و ثبت می‌کند.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { TimePicker } from "@/components/ui/jalali-date-picker";
import { cn, faNum } from "@/lib";
import { Clock, Plus, Trash2, CalendarClock } from "@/components/ui/icon";

const DAYS_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

interface Slot { date: string; startTime: string; endTime: string }
interface PendingRequest { id: string; periodStart: string; periodEnd: string; deadline: string }

interface DayForm {
  enabled: boolean;
  slots: { startTime: string; endTime: string }[];
}

function isoDate(d: Date | string): string {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}

function faDateFromIso(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d.length <= 10 ? d + "T12:00:00Z" : d) : d;
  return date.toLocaleDateString("fa-IR");
}

function validateForm(days: Record<string, DayForm>): string | null {
  for (const [date, day] of Object.entries(days)) {
    if (!day.enabled) continue;
    const valid = day.slots.filter((s) => s.startTime && s.endTime);
    if (valid.length === 0) return `برای روز فعال‌شده حداقل یک بازه وارد کنید`;
    for (const s of valid) {
      if (s.startTime >= s.endTime) return "ساعت شروع باید قبل از ساعت پایان باشد";
    }
    const sorted = [...valid].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startTime < sorted[i - 1].endTime) return "بازه‌های یک روز هم‌پوشانی دارند";
    }
  }
  const anyEnabled = Object.values(days).some((d) => d.enabled && d.slots.some((s) => s.startTime && s.endTime));
  if (!anyEnabled) return "حداقل یک روز را فعال و یک بازه وارد کنید";
  return null;
}

export function AvailabilityCard() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [days, setDays] = useState<Record<string, DayForm>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["availability-pending"],
    queryFn: () => api<{ request: PendingRequest | null }>(`/api/availability-mgmt?scope=pending`),
    retry: false,
  });
  const current = data?.request ?? null;

  // فرم روزهای بازه — فقط وقتی باز می‌کنیم (نه در هر رندر)
  useEffect(() => {
    if (!current || !expanded || Object.keys(days).length > 0) return;
    const start = isoDate(current.periodStart);
    const end = isoDate(current.periodEnd);
    const form: Record<string, DayForm> = {};
    const d = new Date(start + "T12:00:00Z");
    const endD = new Date(end + "T12:00:00Z");
    while (d <= endD) {
      const iso = d.toISOString().slice(0, 10);
      form[iso] = { enabled: false, slots: [{ startTime: "09:00", endTime: "12:00" }] };
      d.setUTCDate(d.getUTCDate() + 1);
    }
    setDays(form);
    setError(null);
  }, [current?.id, expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitMut = useMutation({
    mutationFn: (payload: { requestId: string; slots: Slot[] }) =>
      api("/api/availability-mgmt", { method: "PUT", json: payload }),
    onSuccess: () => {
      push("زمان‌های آزاد شما ثبت شد", "success");
      setExpanded(false);
      setDays({});
      qc.invalidateQueries({ queryKey: ["availability-pending"] });
    },
    onError: (e) => setError((e as ApiError).message || "خطا در ثبت — دوباره تلاش کنید"),
  });

  const noneMut = useMutation({
    mutationFn: () =>
      api("/api/availability-mgmt", { method: "PUT", json: { requestId: current!.id, slots: [] } }),
    onSuccess: () => {
      push("ثبت شد — در این بازه زمانی برای جلسه آزاد نیستید", "info");
      setExpanded(false);
      setDays({});
      qc.invalidateQueries({ queryKey: ["availability-pending"] });
    },
    onError: (e) => setError((e as ApiError).message || "خطا در ثبت — دوباره تلاش کنید"),
  });

  function submitNone() {
    setError(null);
    noneMut.mutate();
  }

  if (!current) return null;

  function submit() {
    const v = validateForm(days);
    if (v) { setError(v); return; }
    if (totalSlots === 0) { setError("حداقل یک روز را فعال کنید یا «هیچ‌کدام را نمی‌توانم» را بزن"); return; }
    const slots: Slot[] = Object.entries(days)
      .filter(([, d]) => d.enabled)
      .flatMap(([date, d]) =>
        d.slots
          .filter((s) => s.startTime && s.endTime)
          .map((s) => ({ date, startTime: s.startTime, endTime: s.endTime })),
      );
    submitMut.mutate({ requestId: current!.id, slots });
  }

  const dayList = Object.keys(days).sort();
  const deadlineNear = new Date(current.deadline).getTime() - Date.now() < 24 * 3600_000;
  const totalSlots = Object.values(days).filter((d) => d.enabled).length;

  return (
    <Card className={cn("ring-1", deadlineNear ? "ring-red-200" : "ring-amber-100")}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CalendarClock className={cn("h-4 w-4", deadlineNear ? "text-red-500" : "text-amber-500")} />
            اعلام زمان‌های آزاد شما
            {deadlineNear && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10.5px] font-bold text-red-700">مهلت نزدیک</span>
            )}
          </span>
        }
        subtitle={
          expanded
            ? "روزهایی که می‌توانید شرکت کنید را فعال و بازه‌های ساعتی‌تان را وارد کنید"
            : `بازه‌ی ${faDateFromIso(current.periodStart)} تا ${faDateFromIso(current.periodEnd)} — مهلت ثبت: ${new Date(current.deadline).toLocaleDateString("fa-IR")} ساعت ${new Date(current.deadline).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`
        }
        action={
          !expanded ? (
            <Button size="sm" onClick={() => setExpanded(true)}>
              <Clock className="h-3.5 w-3.5" />
              انتخاب زمان‌ها
            </Button>
          ) : undefined
        }
      />

      {expanded ? (
        <>
          <div className="max-h-[46vh] divide-y divide-line overflow-y-auto border-t border-line">
            {dayList.map((date) => {
              const day = days[date];
              const wd = new Date(date + "T12:00:00Z").getUTCDay();
              const dayFa = DAYS_FA[(wd + 1) % 7];
              return (
                <div key={date} className={cn("px-5 py-2.5 transition-colors", day.enabled ? "bg-white" : "bg-transparent")}>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(e) => setDays((prev) => ({ ...prev, [date]: { ...prev[date], enabled: e.target.checked } }))}
                        className="size-4 accent-black"
                      />
                      <span className={cn("text-[13px]", day.enabled ? "font-semibold" : "font-medium text-ink-soft")}>
                        {dayFa}{" "}
                        <span className="text-[11px] font-normal text-ink-faint">
                          {new Date(date + "T12:00:00Z").toLocaleDateString("fa-IR", { month: "long", day: "numeric" })}
                        </span>
                      </span>
                    </label>
                    {day.enabled && (
                      <button
                        type="button"
                        onClick={() => setDays((prev) => ({ ...prev, [date]: { ...prev[date], slots: [...prev[date].slots, { startTime: "15:00", endTime: "18:00" }] } }))}
                        className="flex h-7 items-center gap-1 rounded-md px-2 text-[11.5px] text-ink-soft transition hover:bg-paper-soft hover:text-ink"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        بازه
                      </button>
                    )}
                  </div>
                  {day.enabled && (
                    <div className="mt-2 space-y-1.5">
                      {day.slots.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                          <div className="w-[170px]">
                            <TimePicker
                              value={s.startTime}
                              onChange={(v) => setDays((prev) => {
                                const slots = [...prev[date].slots];
                                slots[i] = { ...slots[i], startTime: v };
                                return { ...prev, [date]: { ...prev[date], slots } };
                              })}
                              className="grid-cols-2 gap-1.5 [&>div>button]:h-9 [&>div>button]:text-[12px]"
                            />
                          </div>
                          <span className="text-ink-faint">—</span>
                          <div className="w-[170px]">
                            <TimePicker
                              value={s.endTime}
                              onChange={(v) => setDays((prev) => {
                                const slots = [...prev[date].slots];
                                slots[i] = { ...slots[i], endTime: v };
                                return { ...prev, [date]: { ...prev[date], slots } };
                              })}
                              className="grid-cols-2 gap-1.5 [&>div>button]:h-9 [&>div>button]:text-[12px]"
                            />
                          </div>
                          <button
                            type="button"
                            aria-label="حذف بازه"
                            onClick={() => setDays((prev) => ({ ...prev, [date]: { ...prev[date], slots: prev[date].slots.filter((_, j) => j !== i) } }))}
                            className="text-ink-faint transition hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && <p className="mx-5 mt-3 rounded-md bg-red-50 p-2 text-[12px] text-red-600" role="alert">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
            <p className="text-[11px] text-ink-faint">
              {totalSlots > 0 ? `${faNum(totalSlots)} روز انتخاب شد` : "روزهایی که می‌توانی را فعال کن — یا «هیچ‌کدام» را بزن"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={submitMut.isPending}
                className="text-red-600 hover:bg-red-50"
                loading={noneMut.isPending}
                onClick={submitNone}
              >
                هیچ‌کدام را نمی‌توانم
              </Button>
              <Button variant="ghost" size="sm" disabled={submitMut.isPending || noneMut.isPending} onClick={() => { setExpanded(false); setDays({}); }}>
                بعداً
              </Button>
              <Button size="sm" loading={submitMut.isPending} onClick={submit} disabled={totalSlots === 0}>
                ثبت زمان‌های آزاد
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="border-t border-line px-5 py-3.5">
          <p className="text-[12px] leading-6 text-ink-soft">
            سازمان برای هماهنگی جلسه از شما زمان‌های آزاد را خواسته است — روی «انتخاب زمان‌ها» بزنید و روزهایی که می‌توانید شرکت کنید را مشخص کنید.
          </p>
        </div>
      )}
    </Card>
  );
}
