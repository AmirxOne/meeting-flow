"use client";

/**
 * صفحه‌ی «برنامه‌های نوبت‌دهی» — داشتن برنامه‌هایی که دیگران از من وقت می‌گیرند.
 * آدرس: /programs  (مثل /meetings/new یک صفحه‌ی عملیاتی مستقل برای مسئولان)
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-modal";
import { cn, faNum } from "@/lib";
import { CalendarClock, Clock, Check, Users, Plus, Pencil, Trash2 } from "@/components/ui/icon";
import { CreateProgramModal, type ProgramLite } from "../appointments/create-program-modal";

interface WindowRow { daysOfWeek: number[]; from: string; to: string }

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

const WEEKDAY_FA: Record<number, string> = {
  6: "شنبه", 0: "یکشنبه", 1: "دوشنبه", 2: "سه‌شنبه", 3: "چهارشنبه", 4: "پنجشنبه", 5: "جمعه",
};
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
function toFa(s: string | number): string {
  return String(s).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}
function hhmm(t: string): string {
  const [h, m] = t.split(":");
  return `${toFa(Number(h))}:${toFa(m.padStart(2, "0"))}`;
}
function windowsSummary(windows: WindowRow[] | null | undefined): string[] {
  if (!windows?.length) return [];
  return windows.slice(0, 3).map((w) => {
    const days = w.daysOfWeek.map((d) => WEEKDAY_FA[d] ?? "").filter(Boolean);
    const dayTxt = days.length >= 6 ? "همه‌ی روزها" : days.length ? `${days.join(" و ")}‌ها` : "";
    return `${dayTxt} ${hhmm(w.from)} تا ${hhmm(w.to)}`.trim();
  });
}
const AUDIENCE_FA: Record<string, string> = { ALL: "همه‌ی کارکنان", BRANCH: "شعبه‌های خاص", USERS: "افراد خاص" };

export default function ProgramsPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["appointment-programs"],
    queryFn: () => api<{ programs: Program[] }>("/api/appointments/programs"),
  });
  const mine = (data?.programs ?? []).filter((p) => p.isMine);
  const others = (data?.programs ?? []).filter((p) => !p.isMine);

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
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">برنامه‌های نوبت‌دهی</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-6 text-ink-soft">
            روزها و ساعت‌های آزادت را به‌صورت برنامه منتشر کن تا کارکنان خودشان از تو وقت بگیرند — بدون پیام‌رفت‌وبرگشت. مثل ثبت جلسه، ولی نوبت‌دهی.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          ایجاد برنامه
        </Button>
      </div>

      {/* ─── برنامه‌های من ─── */}
      <section>
        <h2 className="mb-2 text-[13px] font-bold">برنامه‌های من</h2>
        {isLoading ? (
          <Card><div className="space-y-2 p-5">{[0, 1].map((i) => <div key={i} className="skeleton h-28 w-full rounded-md" />)}</div></Card>
        ) : mine.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarClock className="h-10 w-10" />}
              title="هنوز برنامه‌ای نساخته‌ای"
              description="اگر مشاور، HR یا مسئول جلسه‌ای، یک برنامه بساز: روزها و ساعت‌های آزادت را تعریف کن تا بقیه خودشان نوبت بگیرند"
              action={<Button size="sm" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />ساخت اولین برنامه</Button>}
            />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {mine.map((p) => (
              <ProgramCard key={p.id} p={p} onEdit={() => setEditing(p)} onDelete={() => onDelete(p)} deleting={delMut.isPending} />
            ))}
          </div>
        )}
      </section>

      {/* ─── برنامه‌هایی که من می‌توانم از آنها وقت بگیرم ─── */}
      {others.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-bold">برنامه‌های دیگران (گرفتن نوبت)</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {others.map((p) => (
              <ProgramCard key={p.id} p={p} readOnly onBook={() => { window.location.href = "/appointments"; }} />
            ))}
          </div>
        </section>
      )}

      {creating && <CreateProgramModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["appointment-programs"] }); }} />}
      {editing && <CreateProgramModal editProgram={editing as unknown as ProgramLite} onClose={() => setEditing(null)} onCreated={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["appointment-programs"] }); }} />}
    </div>
  );
}

function ProgramCard({ p, onEdit, onDelete, deleting, readOnly, onBook }: {
  p: Program; onEdit?: () => void; onDelete?: () => void; deleting?: boolean; readOnly?: boolean; onBook?: () => void;
}) {
  const summary = windowsSummary(p.windows);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold">
          {p.title}
          {p.isConfidential && <span title="جلسه محرمانه">🔒</span>}
          {p.status === "DRAFT" && <span className="badge badge-gray">پیش‌نویس</span>}
        </p>
        {onEdit && onDelete && (
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
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper-soft text-[12px] font-bold text-ink">{p.hostName.trim()[0]}</span>
        <div>
          <p className="text-[12px] font-medium">{p.hostName}</p>
          <p className="text-[10px] text-ink-faint">مسئول جلسه</p>
        </div>
        {p.audienceType && (
          <span className="mr-auto inline-flex items-center gap-1 rounded-full bg-paper-soft px-2 py-1 text-[10px] font-medium text-ink-soft">
            <Users className="h-3 w-3" /> {AUDIENCE_FA[p.audienceType] ?? p.audienceType}
          </span>
        )}
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
        <p className="text-[10.5px] text-ink-faint">تا {new Date(p.validTo).toLocaleDateString("fa-IR", { day: "numeric", month: "long" })}</p>
        {readOnly && onBook ? (
          <Button size="sm" variant="outline" onClick={onBook}>
            <CalendarClock className="h-3.5 w-3.5" />
            گرفتن نوبت
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-faint">
            <Check className="h-3 w-3 text-emerald-600" /> {faNum(p.roomCount)} اتاق مجاز
          </span>
        )}
      </div>
    </Card>
  );
}
