"use client";

/** مودال سه‌گامی رزرو نوبت — مشترک بین /appointments و داشبورد */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, faNum } from "@/lib";
import { CalendarDays, Check, X } from "@/components/ui/icon";

interface Program {
  id: string;
  title: string;
  description: string | null;
  topics: { title: string }[] | null;
  audienceType?: string;
  audienceIds?: string[];
  roomIds?: string[];
  durationMin: number;
  bufferMin?: number;
  windows?: { daysOfWeek: number[]; from: string; to: string }[];
  validFrom: string;
  validTo: string;
  status: string;
  isConfidential: boolean;
  hostName: string;
  roomCount: number;
  isMine: boolean;
}

interface Slot { startAt: string; endAt: string }

const WEEKDAY_FA: Record<number, string> = {
  6: "شنبه", 0: "یکشنبه", 1: "دوشنبه", 2: "سه‌شنبه", 3: "چهارشنبه", 4: "پنجشنبه", 5: "جمعه",
};

function faTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}
function faDayShort(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "long" });
}

export function SlotPicker({ program, onClose, onBooked }: { program: Program; onClose: () => void; onBooked: () => void }) {
const { push } = useToast();
  const readOnly = program.isMine; // مسئول فقط می‌بیند — رزرو مال کارکنان است
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [confirmSlot, setConfirmSlot] = useState<Slot | null>(null);
  const [success, setSuccess] = useState<{ room: string; startAt: string } | null>(null);

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(Math.min(from.getTime() + 14 * 86400000, new Date(program.validTo).getTime()));

  const { data, isLoading } = useQuery({
    queryKey: ["appointment-slots", program.id, from.toISOString().slice(0, 10)],
    queryFn: () => api<{ slots: Slot[] }>(`/api/appointments/programs/${program.id}/slots?from=${from.toISOString()}&to=${to.toISOString()}`),
    staleTime: 30_000,
  });
  const slots = data?.slots ?? [];

  // روزها + تعداد وقت آزاد هر روز
  const byDay = new Map<string, number>();
  for (const s of slots) {
    const k = s.startAt.slice(0, 10);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const days = Array.from(byDay.keys()).sort();
  const daySlots = selectedDay ? slots.filter((s) => s.startAt.slice(0, 10) === selectedDay) : [];

  const bookMut = useMutation({
    mutationFn: (startAt: string) =>
      api<{ bookingId: string; room: string }>(`/api/appointments/programs/${program.id}/book`, { method: "POST", json: { startAt } }),
    onSuccess: (r) => setSuccess({ room: r.room, startAt: confirmSlot?.startAt ?? "" }),
    onError: (e) => {
      push((e as ApiError).message || "این وقت همین حالا گرفته شد — زمان دیگری انتخاب کن", "error");
      setConfirmSlot(null);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-white shadow-2xl sm:max-h-[86vh] sm:max-w-lg sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[14px] font-bold">{program.title}</h2>
            <p className="mt-0.5 text-[11px] text-ink-soft">با {program.hostName} · جلسه‌ی {faNum(program.durationMin)} دقیقه‌ای</p>
          </div>
          <button onClick={onClose} aria-label="بستن" className="rounded-md p-1.5 text-ink-faint hover:bg-paper-soft hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {success ? (
            /* گام ۳: نتیجه */
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="h-7 w-7" />
              </span>
              <p className="mt-3 text-[14px] font-bold">نوبتت ثبت شد</p>
              <p className="mt-1.5 max-w-xs text-[12px] leading-6 text-ink-soft">
                {faDayShort(success.startAt)} ساعت <b className="tabular-nums">{faTime(success.startAt)}</b> — اتاق {success.room}
              </p>
              <p className="mt-1 text-[11px] text-ink-faint">جلسه در تقویمت ثبت شد؛ از «نوبت‌های من» بالای همین صفحه می‌توانی مدیریتش کنی.</p>
              <Button className="mt-4" onClick={onBooked}>متوجه شدم</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-11 w-full rounded-md" />)}</div>
          ) : slots.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[13px] font-bold">وقت آزادی در ۲ هفته‌ی آینده نیست</p>
              <p className="mt-1 text-[11.5px] leading-6 text-ink-soft">وقت‌های این دوره گرفته شده. بعداً دوباره سر بزن.</p>
            </div>
          ) : (
            <>
              {/* گام ۱: روز */}
              <p className="mb-2 text-[11px] font-medium text-ink-soft">۱. چه روزی؟</p>
              <div className="flex flex-wrap gap-1.5">
                {days.map((d) => {
                  const dt = new Date(d + "T12:00:00");
                  const active = selectedDay === d;
                  return (
                    <button
                      key={d}
                      onClick={() => { setSelectedDay(d); setConfirmSlot(null); }}
                      className={cn(
                        "flex min-w-[76px] flex-col items-center rounded-lg border px-2.5 py-2 transition-colors",
                        active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/40",
                      )}
                    >
                      <span className="text-[11.5px] font-bold">{dt.toLocaleDateString("fa-IR", { weekday: "long" })}</span>
                      <span className={cn("mt-0.5 text-[10px]", active ? "text-white/70" : "text-ink-faint")}>
                        {dt.toLocaleDateString("fa-IR", { day: "numeric", month: "long" })} · {faNum(byDay.get(d) ?? 0)} وقت
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* گام ۲: ساعت */}
              {selectedDay && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-medium text-ink-soft">۲. چه ساعتی؟</p>
                  {readOnly && daySlots.length > 0 && (
                    <p className="mb-2 rounded-md bg-paper-soft px-2.5 py-1.5 text-[10.5px] leading-5 text-ink-soft">
                      👁 حالت مشاهده — این برنامه‌ی شماست؛ کارکنان از این زمان‌ها نوبت می‌گیرند.
                    </p>
                  )}
                  {confirmSlot ? (
                    <div className="rounded-lg border border-line bg-paper-soft/40 p-3.5">
                      <p className="text-[11px] font-medium text-ink-soft">۳. تأیید نهایی</p>
                      <p className="mt-1 text-[13px] font-bold leading-7">
                        {faDayShort(confirmSlot.startAt)} · ساعت <span className="tabular-nums">{faTime(confirmSlot.startAt)}</span> تا <span className="tabular-nums">{faTime(confirmSlot.endAt)}</span>
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-ink-faint">
                        جلسه‌ی {faNum(program.durationMin)} دقیقه‌ای با {program.hostName} — بعد از ثبت، در تقویم و «نوبت‌های من» می‌بینی‌اش.
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" loading={bookMut.isPending} onClick={() => bookMut.mutate(confirmSlot.startAt)}>
                          <Check className="h-3.5 w-3.5" />
                          ثبت نوبت
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmSlot(null)} disabled={bookMut.isPending}>بازگشت</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {daySlots.map((s) => (
                        <button
                          key={s.startAt}
                          onClick={() => { if (!readOnly) setConfirmSlot(s); }}
                          className={cn(
                            "h-11 rounded-lg border border-line bg-white text-[13px] font-bold tabular-nums text-ink transition",
                            readOnly ? "cursor-default" : "hover:border-ink hover:bg-paper-soft",
                          )}
                        >
                          {faTime(s.startAt)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
