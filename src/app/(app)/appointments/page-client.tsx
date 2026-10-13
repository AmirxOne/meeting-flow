"use client";

/**
 * صفحه‌ی «رزرو نوبت» — کارکنان برنامه‌های مجاز را می‌بینند و نوبت می‌گیرند.
 * آدرس: /appointments
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, faNum } from "@/lib";
import { CalendarDays, Clock, Check, X } from "@/components/ui/icon";
import { CreateProgramModal } from "./create-program-modal";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Pencil, Trash2, Menu } from "@/components/ui/icon";

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

function faDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "long" });
}
function faTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

export default function AppointmentsPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [openProgram, setOpenProgram] = useState<Program | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const confirm = useConfirm();

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

  const { data, isLoading } = useQuery({
    queryKey: ["appointment-programs"],
    queryFn: () => api<{ programs: Program[] }>("/api/appointments/programs"),
  });
  const programs = data?.programs ?? [];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">رزرو نوبت</h1>
          <p className="mt-1 text-[12px] text-ink-soft">
            جلسات مشاوره و گفت‌وگوی مسئولان با کارکنان — زمان آزاد را انتخاب و رزرو کنید
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          ایجاد برنامه‌ی نوبت‌دهی
        </Button>
      </div>

      {isLoading ? (
        <Card><div className="space-y-2 p-5">{[0, 1].map((i) => <div key={i} className="skeleton h-16 w-full rounded-md" />)}</div></Card>
      ) : programs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-10 w-10" />}
            title="برنامه‌ای برای رزرو نیست"
            description="در حال حاضر برنامه‌ی نوبت‌دهی فعالی برای شما منتشر نشده است"
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {programs.map((p) => (
            <ProgramCard
              key={p.id}
              p={p}
              onOpen={() => setOpenProgram(p)}
              onEdit={() => setEditing(p)}
              onDelete={() => onDelete(p)}
              deleting={delMut.isPending}
            />
          ))}
        </div>
      )}

      {editing && (
        <CreateProgramModal
          editProgram={editing}
          onClose={() => setEditing(null)}
          onCreated={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["appointment-programs"] });
          }}
        />
      )}

      {creating && (
        <CreateProgramModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["appointment-programs"] });
          }}
        />
      )}

      {openProgram && (
        <SlotPicker
          program={openProgram}
          onClose={() => setOpenProgram(null)}
          onBooked={() => {
            setOpenProgram(null);
            qc.invalidateQueries({ queryKey: ["appointment-programs"] });
            qc.invalidateQueries({ queryKey: ["my-appointments"] });
          }}
        />
      )}
    </div>
  );
}

function ProgramCard({ p, onOpen, onEdit, onDelete, deleting }: { p: Program; onOpen: () => void; onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <Card className="relative p-4">
      {p.isMine && (
        <div className="absolute left-3 top-3 z-10">
          <button
            aria-label="عملیات برنامه"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-1.5 text-ink-faint transition hover:bg-paper-soft hover:text-ink"
          >
            <Menu className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 top-9 z-20 w-36 overflow-hidden rounded-md border border-line bg-white shadow-lg">
                <button onClick={() => { setMenuOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-2 text-right text-[12px] transition hover:bg-paper-soft">
                  <Pencil className="h-3.5 w-3.5" /> ویرایش برنامه
                </button>
                <button disabled={deleting} onClick={() => { setMenuOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2 text-right text-[12px] text-red-600 transition hover:bg-red-50 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" /> حذف برنامه
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-bold">
            {p.title}
            {p.isConfidential && <span title="جلسه محرمانه">🔒</span>}
            {p.isMine && <span className="badge badge-gray">برنامه‌ی شما</span>}
          </p>
          <p className="mt-1 text-[12px] text-ink-soft">مسئول: {p.hostName} · مدت: {faNum(p.durationMin)} دقیقه</p>
          {p.description && <p className="mt-2 text-[12px] leading-6 text-ink-soft">{p.description}</p>}
          {p.topics && (p.topics as { title: string }[]).length > 0 && (
            <ul className="mt-2 space-y-1">
              {(p.topics as { title: string }[]).map((t, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-ink-soft">
                  <Check className="mt-1 h-3 w-3 shrink-0 text-emerald-600" />
                  {t.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-[10.5px] text-ink-faint">
          اعتبار تا {new Date(p.validTo).toLocaleDateString("fa-IR")}
        </p>
        <div className="flex items-center gap-1.5">
          {p.isMine && (
            <>
              <button
                onClick={onEdit}
                aria-label="ویرایش برنامه"
                title="ویرایش برنامه"
                className="rounded-md border border-line p-1.5 text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                aria-label="حذف برنامه"
                title="حذف برنامه"
                className="rounded-md border border-line p-1.5 text-ink-soft transition-colors hover:border-red-300 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <Button size="sm" onClick={onOpen}>
            <Clock className="h-3.5 w-3.5" />
            مشاهده‌ی زمان‌های آزاد
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** انتخاب روز → ساعت‌های آزاد → رزرو */
function SlotPicker({ program, onClose, onBooked }: { program: Program; onClose: () => void; onBooked: () => void }) {
  const { push } = useToast();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<string | null>(null);

  // بازه‌ی ۱۴ روز آینده
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + Math.min(14 * 86400000, new Date(program.validTo).getTime() - from.getTime()));

  const { data, isLoading } = useQuery({
    queryKey: ["appointment-slots", program.id, from.toISOString(), to.toISOString()],
    queryFn: () =>
      api<{ program: Program; slots: Slot[] }>(
        `/api/appointments/programs/${program.id}/slots?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
    staleTime: 30_000, // وضعیت اسلات‌ها تازه بماند — تعارض لحظه‌ای مهم است
  });
  const slots = data?.slots ?? [];

  const days = Array.from(new Set(slots.map((s) => s.startAt.slice(0, 10)))).sort();
  const daySlots = selectedDay ? slots.filter((s) => s.startAt.slice(0, 10) === selectedDay) : [];

  const bookMut = useMutation({
    mutationFn: (startAt: string) =>
      api<{ bookingId: string; room: string }>("/api/appointments/programs/" + program.id + "/book", {
        method: "POST",
        json: { startAt },
      }),
    onSuccess: (r) => {
      push(`نوبت رزرو شد — ${r.room}`, "success");
      onBooked();
    },
    onError: (e) => {
      push((e as ApiError).message || "رزرو ناموفق بود", "error");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-white shadow-2xl sm:max-h-[86vh] sm:max-w-lg sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[14px] font-bold">{program.title}</h2>
            <p className="mt-0.5 text-[11px] text-ink-soft">مسئول: {program.hostName} · {faNum(program.durationMin)} دقیقه</p>
          </div>
          <button onClick={onClose} aria-label="بستن" className="rounded-md p-1.5 text-ink-faint hover:bg-paper-soft hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 w-full rounded-md" />)}</div>
          ) : slots.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-ink-faint">زمان آزادی در بازه‌ی فعلی موجود نیست</p>
          ) : (
            <>
              {/* روزها */}
              <div className="flex flex-wrap gap-1.5">
                {days.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
                      selectedDay === d ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:border-ink/40",
                    )}
                  >
                    {faDay(d + "T12:00:00")}
                  </button>
                ))}
              </div>

              {/* ساعت‌های روز انتخابی */}
              {selectedDay && (
                <div className="mt-4 space-y-1.5">
                  {daySlots.map((s) => (
                    <button
                      key={s.startAt}
                      disabled={bookMut.isPending}
                      onClick={() => { setBusySlot(s.startAt); bookMut.mutate(s.startAt); }}
                      className="flex w-full items-center justify-between rounded-md border border-line bg-white px-3.5 py-2.5 text-[12.5px] transition-colors hover:border-ink/40 hover:bg-paper-soft disabled:opacity-50"
                    >
                      <span className="font-bold tabular-nums">{faTime(s.startAt)} تا {faTime(s.endAt)}</span>
                      <span className="text-[11px] text-ink-soft">{bookMut.isPending && busySlot === s.startAt ? "در حال رزرو…" : "رزرو"}</span>
                    </button>
                  ))}
                </div>
              )}
              {!selectedDay && <p className="mt-4 text-center text-[12px] text-ink-faint">یک روز را انتخاب کنید</p>}
            </>
          )}
        </div>

        <div className="border-t border-line px-5 py-3">
          <p className="text-[10.5px] text-ink-faint">رزرو قطعی است و جلسه در تقویم شما ثبت می‌شود؛ در صورت اشغال لحظه‌ای، زمان دیگری انتخاب کنید.</p>
        </div>
      </div>
    </div>
  );
}
