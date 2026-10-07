"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { TimePicker } from "@/components/ui/jalali-date-picker";
import { cn, faNum } from "@/lib";
import { Clock, Plus, Trash2, X } from "@/components/ui/icon";

/**
 * مودال اعلام زمان‌های آزاد — وقتی کاربر درخواست فعالِ ثبت‌نشده دارد،
 * هنگام ورود به اپ باز می‌شود. چند درخواست → صف با دکمه‌ی «بعدی».
 */

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

/** ISO → «۱۴۰۵/۰۷/۱۸» شمسی */
function faDateFromIso(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d.length <= 10 ? d + "T12:00:00Z" : d) : d;
  return date.toLocaleDateString("fa-IR");
}

function validateForm(days: Record<string, DayForm>): string | null {
  for (const [date, day] of Object.entries(days)) {
    if (!day.enabled) continue;
    const valid = day.slots.filter((s) => s.startTime && s.endTime);
    if (valid.length === 0) return `برای روز فعال‌شده حداقل یک بازه وارد کنید (${date})`;
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

export function AvailabilityModal() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<PendingRequest[]>([]);
  const [idx, setIdx] = useState(0);
  const [days, setDays] = useState<Record<string, DayForm>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["availability-pending"],
    queryFn: () => api<{ request: PendingRequest | null }>(`/api/availability-mgmt?scope=pending`),
    retry: false,
  });

  useEffect(() => {
    // مودال فقط برای درخواست PENDING باز می‌شود — SUBMITTED/OVERDUE نه
    // «بعداً» = سکوت ۱۰ دقیقه‌ای برای همان درخواست؛ در هر لود/صفحه دوباره باز نمی‌شود
    if (data?.request && !open && queue.length === 0) {
      try {
        const key = `avail-snooze:${data.request.id}`;
        const until = Number(sessionStorage.getItem(key) ?? 0);
        if (until > Date.now()) return;
      } catch { /* sessionStorage در دسترس نیست — بدون سکوت ادامه بده */ }
      setQueue([data.request]);
      setIdx(0);
      setOpen(true);
    }
  }, [data?.request]); // eslint-disable-line react-hooks/exhaustive-deps

  function snooze() {
    if (current) {
      try {
        sessionStorage.setItem(`avail-snooze:${current.id}`, String(Date.now() + 10 * 60 * 1000));
      } catch { /* ignore */ }
    }
    setOpen(false);
    setQueue([]);
  }

  const current = queue[idx];

  useEffect(() => {
    if (!current) return;
    // فرم را برای روزهای بازه بساز
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
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!current) return;
    const v = validateForm(days);
    if (v) { setError(v); return; }
    setBusy(true);
    setError(null);
    try {
      const slots: Slot[] = Object.entries(days)
        .filter(([, d]) => d.enabled)
        .flatMap(([date, d]) =>
          d.slots
            .filter((s) => s.startTime && s.endTime)
            .map((s) => ({ date, startTime: s.startTime, endTime: s.endTime })),
        );
      await api("/api/availability-mgmt", { method: "PUT", json: { requestId: current.id, slots } });
      push("زمان‌های آزاد ثبت شد", "success");
      await qc.invalidateQueries({ queryKey: ["availability-pending"] });
      // درخواست بعدی صف یا بستن
      if (idx + 1 < queue.length) {
        setIdx(idx + 1);
      } else {
        setOpen(false);
        setQueue([]);
        setIdx(0);
      }
    } catch (e) {
      setError((e as ApiError).message || "خطا در ثبت — دوباره تلاش کنید");
    } finally {
      setBusy(false);
    }
  }

  if (!current) return null;

  const dayList = Object.keys(days).sort();

  return (
    <Modal
      open={open}
      onClose={snooze}
      title={`اعلام زمان‌های آزاد${queue.length > 1 ? ` (${faNum(idx + 1)} از ${faNum(queue.length)})` : ""}`}
      subtitle={`بازه‌ی ${faDateFromIso(current.periodStart)} تا ${faDateFromIso(current.periodEnd)} — مهلت ثبت: ${new Date(current.deadline).toLocaleDateString("fa-IR")} ساعت ${new Date(current.deadline).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-ink-faint">می‌توانید بعداً از اعلان‌ها ادامه دهید</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={snooze} disabled={busy}>
              بعداً
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "در حال ثبت…" : "ثبت زمان‌های آزاد"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="max-h-[52vh] space-y-2 overflow-y-auto pl-1">
        {dayList.map((date) => {
          const day = days[date];
          const wd = new Date(date + "T12:00:00Z").getUTCDay();
          const dayFa = DAYS_FA[(wd + 1) % 7];
          return (
            <div key={date} className={cn("rounded-lg border p-2.5 transition-colors", day.enabled ? "border-ink/30 bg-white" : "border-line bg-paper-soft/40")}>
              <div className="flex items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(e) => setDays((prev) => ({ ...prev, [date]: { ...prev[date], enabled: e.target.checked } }))}
                    className="size-4 accent-black"
                  />
                  <span className="text-[13px] font-medium">{dayFa} <span className="text-[11px] font-normal text-ink-faint">{new Date(date + "T12:00:00Z").toLocaleDateString("fa-IR", { month: "long", day: "numeric" })}</span></span>
                </label>
                {day.enabled && (
                  <button
                    type="button"
                    onClick={() => setDays((prev) => ({ ...prev, [date]: { ...prev[date], slots: [...prev[date].slots, { startTime: "15:00", endTime: "18:00" }] } }))}
                    className="flex h-7 items-center gap-1 rounded-md px-2 text-[11.5px] text-ink-soft hover:bg-paper-soft hover:text-ink"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    بازه
                  </button>
                )}
              </div>
              {day.enabled && (
                <div className="mt-2 space-y-1.5">
                  {day.slots.length === 0 && (
                    <p className="text-[11px] text-ink-faint">بازه‌ای نیست — «بازه» را بزنید</p>
                  )}
                  {day.slots.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                      <div className="w-[190px]">
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
                      <div className="w-[190px]">
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
                        className="text-ink-faint hover:text-red-600"
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
      {error && (
        <p className="mt-3 rounded-md bg-red-50 p-2 text-[12px] text-red-600" role="alert">{error}</p>
      )}
    </Modal>
  );
}
