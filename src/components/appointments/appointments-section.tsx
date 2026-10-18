"use client";

/**
 * بخش جامع «رزرو نوبت» برای داشبورد:
 *  ۱. نوبت‌های من (پیش‌رو + لغو)
 *  ۲. گرفتن نوبت (کارت همه‌ی برنامه‌ها — رزرو سه‌گامی)
 *  ۳. برنامه‌های نوبت‌دهی من (مسئول: ایجاد/ویرایش/حذف)
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-modal";
import { cn, faNum } from "@/lib";
import { CalendarDays, Clock, CalendarClock, Plus, Pencil, Trash2 } from "@/components/ui/icon";
import { SlotPicker } from "./slot-picker";
import { CreateProgramModal, type ProgramLite } from "./create-program-modal";
import Link from "next/link";

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



export function AppointmentsSection({ hiddenIds = [] }: { hiddenIds?: string[] }) {
  const qc = useQueryClient();

  const [openProgram, setOpenProgram] = useState<Program | null>(null);


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
  const pendingSet = new Set(hiddenIds);
  // برنامه‌هایی که هنوز در کارت «دعوت‌های در انتظار» بی‌پاسخ‌اند → اینجا تکرار نشوند
  const others = programs.filter((p) => !p.isMine && !pendingSet.has(p.id));
  const upcoming = (myData?.bookings ?? []).filter((b) => b.status === "BOOKED" && new Date(b.startAt) > new Date());

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["appointment-programs"] });
    qc.invalidateQueries({ queryKey: ["my-appointments"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <div className="space-y-5">
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
      {others.length > 0 && (
        <section>
          <h2 data-tour="appointments-cards" className="mb-2 text-[13px] font-bold">گرفتن نوبت از مسئولان</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {others.map((p) => (
              <ProgramCard key={p.id} p={p} onOpen={() => setOpenProgram(p)} />
            ))}
          </div>
        </section>
      )}

      {/* مدیریت برنامه‌ها → صفحه‌ی مستقل */}
      {mine.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-ink-soft">
              {faNum(mine.length)} برنامه‌ی نوبت‌دهی فعال داری — کارکنان از آن‌ها وقت می‌گیرند
            </p>
            <Link href="/my-programs" className="shrink-0">
              <Button size="sm" variant="outline">مدیریت برنامه‌ها</Button>
            </Link>
          </div>
        </Card>
      )}

      {openProgram && <SlotPicker program={openProgram} onClose={() => setOpenProgram(null)} onBooked={() => { setOpenProgram(null); invalidateAll(); }} />}
    </div>
  );
}

/* ═══════════ کارت برنامه ═══════════ */

function ProgramCard({ p, onOpen, mine, manageHref, onEdit, onDelete, deleting, onManageTab }: {
  p: Program; onOpen: () => void; mine?: boolean; manageHref?: string; onEdit?: () => void; onDelete?: () => void; deleting?: boolean; onManageTab?: () => void;
}) {
  const summary = windowsSummary(p.windows);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold">
          {p.title}
          {p.isConfidential && <span title="جلسه محرمانه">🔒</span>}
          {p.isMine && <span className="badge badge-gray">برنامه‌ی شما</span>}
        </p>
        {mine && (onEdit || onDelete ? (
          <div className="flex shrink-0 gap-1">
            <button onClick={onEdit} aria-label="ویرایش برنامه" title="ویرایش" className="rounded-md border border-line p-1.5 text-ink-soft transition hover:border-ink/40 hover:text-ink">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} disabled={deleting} aria-label="حذف برنامه" title="حذف" className="rounded-md border border-line p-1.5 text-ink-soft transition hover:border-red-300 hover:text-red-600 disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          null
        ))}
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


/* ═══════════ صفحه‌ی «برنامه‌های من» — مدیریت کامل ═══════════ */

export function MyPrograms() {
  const qc = useQueryClient();
  const { push } = useToast();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [openProgram, setOpenProgram] = useState<Program | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["appointment-programs"],
    queryFn: () => api<{ programs: Program[] }>("/api/appointments/programs"),
  });
  const mine = (data?.programs ?? []).filter((p) => p.isMine);

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

  return (
    <div className="min-w-0 space-y-4 overflow-x-clip p-4 lg:p-6">
      {/* هدر — راست: عنوان و توضیح · چپ: شمارنده و اکشن */}
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          <h1 data-tour="my-programs-header" className="min-w-0 text-lg font-bold">برنامه‌های من</h1>
          <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-ink-soft">
            روزها و ساعت‌های آزادت را به‌صورت برنامه منتشر کن تا کارکنان خودشان از تو وقت بگیرند
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {!isLoading && mine.length > 0 && (
            <span className="tabular-nums shrink-0 rounded-full border border-line bg-paper-soft px-3 py-1.5 text-[11px] font-medium text-ink-soft">
              {faNum(mine.length)} برنامه
            </span>
          )}
          <Button size="sm" onClick={() => setCreating(true)} className="shrink-0">
            <Plus className="h-4 w-4" />
            ایجاد برنامه
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card><div className="space-y-2 p-5">{[0, 1].map((i) => <div key={i} className="skeleton h-24 w-full rounded-md" />)}</div></Card>
      ) : mine.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-10 w-10" />}
            title="هنوز برنامه‌ای نساخته‌ای"
            description="اگر مشاور، HR یا مسئول جلسه‌ای، روزها و ساعت‌های آزادت را تعریف کن تا کارکنان خودشان وقت بگیرند"
            action={<Button size="sm" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />ایجاد برنامه</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {mine.map((p) => (
            <ProgramCard key={p.id} p={p} onOpen={() => setOpenProgram(p)} mine onEdit={() => setEditing(p)} onDelete={() => onDelete(p)} deleting={delMut.isPending} />
          ))}
        </div>
      )}

      {creating && <CreateProgramModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["appointment-programs"] }); }} />}
      {editing && <CreateProgramModal editProgram={editing as unknown as ProgramLite} onClose={() => setEditing(null)} onCreated={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["appointment-programs"] }); }} />}
      {openProgram && <SlotPicker program={openProgram} onClose={() => setOpenProgram(null)} onBooked={() => { setOpenProgram(null); qc.invalidateQueries({ queryKey: ["appointment-programs"] }); }} />}
    </div>
  );
}
