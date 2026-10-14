"use client";

/**
 * صفحه‌ی «رزرو نوبت» — سه بخش با روایت روشن:
 *  ۱. نوبت‌های من (رزروهای پیش‌رو + لغو)
 *  ۲. گرفتن نوبت (کارت‌های مسئولان دیگر)
 *  ۳. برنامه‌های نوبت‌دهی من (مسئول: ایجاد/ویرایش/حذف)
 * آدرس: /appointments
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-modal";
import { cn, faNum } from "@/lib";
import { CalendarDays, Clock, Check, X, Pencil, Trash2, Plus } from "@/components/ui/icon";
import { CreateProgramModal, type ProgramLite } from "./create-program-modal";

interface WindowRow { daysOfWeek: number[]; from: string; to: string }
interface Slot { startAt: string; endAt: string }

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
  windows?: WindowRow[];
  validFrom: string;
  validTo: string;
  status: string;
  isConfidential: boolean;
  hostName: string;
  roomCount: number;
  isMine: boolean;
}

interface MyBooking {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  title: string;
  hostName: string;
  roomName: string;
  meetingId: string;
}

const WEEKDAY_FA: Record<number, string> = {
  6: "شنبه", 0: "یکشنبه", 1: "دوشنبه", 2: "سه‌شنبه", 3: "چهارشنبه", 4: "پنجشنبه", 5: "جمعه",
};

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
function toFaDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

function faTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}
function faDayShort(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "long" });
}
/** HH:MM لاتین → فارسی برای نمایش پنجره‌ها */
function hhmm(t: string): string {
  const [h, m] = t.split(":");
  return `${toFaDigits(Number(h))}:${toFaDigits(m.padStart(2, "0"))}`;
}

/** خلاصه‌ی انسانیِ روزها و ساعت‌های برنامه: «شنبه‌ها ۹ تا ۱۲» */
function windowsSummary(windows: WindowRow[] | null | undefined): string[] {
  if (!windows?.length) return [];
  return windows.slice(0, 2).map((w) => {
    const days = w.daysOfWeek.map((d) => WEEKDAY_FA[d] ?? "").filter(Boolean);
    const dayTxt = days.length >= 6 ? "همه‌ی روزها" : days.length ? `${days.join(" و ")}‌ها` : "";
    return `${dayTxt} ${hhmm(w.from)} تا ${hhmm(w.to)}`.trim();
  });
}

export default function AppointmentsPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const confirm = useConfirm();
  const [openProgram, setOpenProgram] = useState<Program | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["appointment-programs"],
    queryFn: () => api<{ programs: Program[] }>("/api/appointments/programs"),
  });
  const { data: myData } = useQuery({
    queryKey: ["my-appointments"],
    queryFn: () => api<{ bookings: MyBooking[] }>("/api/appointments/my"),
  });

  const programs = data?.programs ?? [];
  const mine = programs.filter((p) => p.isMine);
  const others = programs.filter((p) => !p.isMine);
  const upcoming = (myData?.bookings ?? []).filter((b) => b.status === "BOOKED" && new Date(b.startAt) > new Date());

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/appointments/programs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      push("برنامه حذف شد", "success");
      qc.invalidateQueries({ queryKey: ["appointment-programs"] });
    },
    onError: (e) => push((e as ApiError).message || "حذف ناموفق بود", "error"),
  });

  async function onDelete(p: Program) {
    if (!(await confirm({ title: `حذف برنامه‌ی «${p.title}»`, body: "رزروهای آینده‌ی این برنامه لغو و جلساتشان بسته می‌شود. مطمئنی؟", confirmLabel: "حذف", danger: true }))) return;
    delMut.mutate(p.id);
  }

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["appointment-programs"] });
    qc.invalidateQueries({ queryKey: ["my-appointments"] });
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* ───── سربرگ ───── */}
      <div>
        <h1 className="text-lg font-bold">رزرو نوبت</h1>
        <p className="mt-1 max-w-2xl text-[12px] leading-6 text-ink-soft">
          وقتِ جلسه با مسئولان سازمان (مشاور، منابع انسانی، مدیریت…) — روز و ساعتِ آزاد را ببین و همان‌جا رزرو کن؛ جلسه به‌صورت خودکار در تقویمت ثبت می‌شود.
        </p>
      </div>

      {/* ───── ۱. نوبت‌های من ───── */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-bold">نوبت‌های من</h2>
          <Card className="divide-y divide-line">
            {upcoming.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="flex min-w-[96px] flex-col items-center rounded-lg border border-line bg-paper-soft/50 px-2.5 py-2">
                  <span className="text-[11px] text-ink-soft">{faDayShort(b.startAt)}</span>
                  <span className="mt-0.5 text-[15px] font-bold tabular-nums">{faTime(b.startAt)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">
                    {b.title} <span className="text-[11px] font-normal text-ink-soft">با {b.hostName}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    اتاق {b.roomName} · {faNum(Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000))} دقیقه
                  </p>
                </div>
                <CancelBookingButton bookingId={b.id} onDone={invalidateAll} />
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* ───── ۲. گرفتن نوبت ───── */}
      <section>
        <h2 className="mb-2 text-[13px] font-bold">{mine.length > 0 ? "گرفتن نوبت از مسئولان دیگر" : "گرفتن نوبت"}</h2>
        {isLoading ? (
          <Card><div className="space-y-2 p-5">{[0, 1].map((i) => <div key={i} className="skeleton h-24 w-full rounded-md" />)}</div></Card>
        ) : others.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarDays className="h-10 w-10" />}
              title={mine.length > 0 ? "فعلاً برنامه‌ی دیگری برای رزرو نداری" : "فعلاً برنامه‌ای برای رزرو منتشر نشده"}
              description="وقتی مسئولان (مشاور، HR و…) برنامه انتشار دهند، اینجا وقت آزادشان را می‌بینی و می‌توانی رزرو کنی"
            />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {others.map((p) => (
              <ProgramCard key={p.id} p={p} onOpen={() => setOpenProgram(p)} />
            ))}
          </div>
        )}
      </section>

      {/* ───── ۳. برنامه‌های من ───── */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-bold">برنامه‌های نوبت‌دهی من</h2>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            برنامه‌ی جدید
          </Button>
        </div>
        {mine.length === 0 ? (
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12.5px] font-bold">هنوز برنامه‌ای نساخته‌ای</p>
                <p className="mt-1 max-w-md text-[11.5px] leading-6 text-ink-soft">
                  اگر مشاور یا مسئول جلسه‌ای، روزها و ساعت‌های آزادت را تعریف کن تا کارکنان خودشان وقت بگیرند — بدون پیام‌رفت‌وبرگشت.
                </p>
              </div>
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" />
                ساخت اولین برنامه
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {mine.map((p) => (
              <ProgramCard key={p.id} p={p} onOpen={() => setOpenProgram(p)} mine onEdit={() => setEditing(p)} onDelete={() => onDelete(p)} deleting={delMut.isPending} />
            ))}
          </div>
        )}
      </section>

      {creating && <CreateProgramModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); invalidateAll(); }} />}
      {editing && <CreateProgramModal editProgram={editing as unknown as ProgramLite} onClose={() => setEditing(null)} onCreated={() => { setEditing(null); invalidateAll(); }} />}
      {openProgram && <SlotPicker program={openProgram} onClose={() => setOpenProgram(null)} onBooked={() => { setOpenProgram(null); invalidateAll(); }} />}
    </div>
  );
}

/* ═══════════ کارت برنامه ═══════════ */

function ProgramCard({ p, onOpen, mine, onEdit, onDelete, deleting }: {
  p: Program; onOpen: () => void; mine?: boolean; onEdit?: () => void; onDelete?: () => void; deleting?: boolean;
}) {
  const summary = windowsSummary(p.windows);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold">
          {p.title}
          {p.isConfidential && <span title="جلسه محرمانه">🔒</span>}
        </p>
        {mine && (
          <div className="flex shrink-0 gap-1">
            <button onClick={onEdit} aria-label="ویرایش برنامه" title="ویرایش" className="rounded-md border border-line p-1.5 text-ink-soft transition hover:border-ink/40 hover:text-ink">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} disabled={deleting} aria-label="حذف برنامه" title="حذف" className="rounded-md border border-line p-1.5 text-ink-soft transition hover:border-red-300 hover:text-red-600 disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper-soft text-[12px] font-bold text-ink">
          {p.hostName.trim()[0]}
        </span>
        <div>
          <p className="text-[12px] font-medium">{p.hostName}</p>
          <p className="text-[10px] text-ink-faint">مسئول جلسه</p>
        </div>
      </div>

      {p.description && <p className="mt-2.5 line-clamp-2 text-[12px] leading-6 text-ink-soft">{p.description}</p>}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-paper-soft px-2 py-1 text-[10.5px] font-medium text-ink-soft">
          <Clock className="h-3 w-3" /> جلسه‌ی {faNum(p.durationMin)} دقیقه‌ای
        </span>
        {summary.map((s, i) => (
          <span key={i} className="rounded-full bg-paper-soft px-2 py-1 text-[10.5px] font-medium text-ink-soft">{s}</span>
        ))}
      </div>

      {p.topics && (p.topics as { title: string }[]).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(p.topics as { title: string }[]).slice(0, 3).map((t, i) => (
            <span key={i} className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-ink-faint">{t.title}</span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-[10.5px] text-ink-faint">
          تا {new Date(p.validTo).toLocaleDateString("fa-IR", { day: "numeric", month: "long" })}
        </p>
        <Button size="sm" onClick={onOpen}>
          <CalendarDays className="h-3.5 w-3.5" />
          {mine ? "دیدن زمان‌های آزاد" : "انتخاب زمان و رزرو"}
        </Button>
      </div>
    </Card>
  );
}

/* ═══════════ دکمه‌ی لغو نوبت ═══════════ */

function CancelBookingButton({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const mut = useMutation({
    mutationFn: () => api(`/api/appointments/bookings/${bookingId}/cancel`, { method: "POST", json: {} }),
    onSuccess: () => { push("نوبت لغو شد", "success"); onDone(); },
    onError: (e) => push((e as ApiError).message || "لغو ناموفق بود", "error"),
  });
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-red-600 hover:bg-red-50"
      disabled={mut.isPending}
      onClick={async () => {
        if (!(await confirm({ title: "لغو این نوبت؟", body: "وقت آزاد می‌شود و می‌توانی زمان دیگری بگیری.", confirmLabel: "لغو نوبت", danger: true }))) return;
        mut.mutate();
      }}
    >
      لغو
    </Button>
  );
}

/* ═══════════ مودال رزرو — سه گام ═══════════ */

function SlotPicker({ program, onClose, onBooked }: { program: Program; onClose: () => void; onBooked: () => void }) {
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
