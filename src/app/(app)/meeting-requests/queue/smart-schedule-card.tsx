"use client";

/**
 * کارت «زمان‌بندی هوشمند» — در صف درخواست‌های ادمین.
 * جریان: انتخاب بازه (هفتگی/ماهانی) → تولید Draft → پیش‌نمایش +
 * ویرایش → تأیید نهایی (اعمال تراکنشی).
 * دستی‌سازی فعلی دست‌نخورده می‌ماند.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { faNum, cn } from "@/lib";
import { Sparkles, Check, X, Pencil } from "@/components/ui/icon";

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
  const [mode, setMode] = useState<"week" | "month">("week");
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [editing, setEditing] = useState<DraftAssignment | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    try {
      const range = rangeFor(mode);
      const r = await api<{ draft: PlanDraft }>("/api/admin/smart-schedule", {
        method: "POST",
        json: { windowFrom: range.from, windowTo: range.to, useAi: true },
      });
      setDraft(r.draft);
      push(`${faNum(r.draft.stats.scheduled)} از ${faNum(r.draft.stats.total)} درخواست زمان‌بندی شد (پیش‌نویس)`, "success");
    } catch (e) {
      push((e as ApiError).message ?? "تولید برنامه ناموفق بود", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!draft || !editing) return;
    // فقط HH:MM از ورودی — همان روز نگه می‌داریم
    const day = new Date(editing.start);
    const [sh, sm] = editStart.split(":").map(Number);
    const [eh, em] = editEnd.split(":").map(Number);
    const start = new Date(day);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(day);
    end.setHours(eh, em, 0, 0);
    try {
      const r = await api<{ draft: PlanDraft; validation: { ok: boolean; errors: { message: string }[] } }>(
        "/api/admin/smart-schedule/edit",
        { method: "POST", json: { draftId: draft.id, requestId: editing.requestId, start: start.toISOString(), end: end.toISOString(), roomId: editing.roomId } },
      );
      setDraft(r.draft);
      setEditError(r.validation.ok ? null : r.validation.errors[0]?.message ?? "تداخل جدید");
      if (r.validation.ok) {
        setEditing(null);
        push("زمان جلسه اصلاح و معتبر شد", "success");
      }
    } catch (e) {
      setEditError((e as ApiError).message ?? "اصلاح ناموفق");
    }
  }

  async function apply() {
    if (!draft) return;
    setApplying(true);
    try {
      const r = await api<{ created: number }>("/api/admin/smart-schedule/apply", {
        method: "POST",
        json: { draftId: draft.id },
      });
      push(`${faNum(r.created)} جلسه ساخته و درخواست‌ها بسته شد`, "success");
      setDraft(null);
    } catch (e) {
      push((e as ApiError).message ?? "اعمال برنامه ناموفق بود", "error");
    } finally {
      setApplying(false);
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
        <div className="p-5 pt-4 text-[12px] leading-6 text-ink-soft">
          قوانین اجباری رعایت می‌شوند: عدم هم‌پوشانی شرکت‌کنندگان، ساعات کاری، تعطیلات، ظرفیت اتاق‌ها و پنجره‌ی ترجیحی هر درخواست.
          زمان‌بندی دستی از طریق همان دکمه‌های فعلی هر درخواست همچنان کار می‌کند.
        </div>
      </Card>

      {/* پیش‌نمایش Draft */}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title="پیش‌نمایش برنامه‌ی پیشنهادی"
        subtitle={draft ? `${faNum(draft.stats.scheduled)} زمان‌بندی‌شده · ${faNum(draft.stats.unscheduled)} زمان‌بندی‌نشده — تا تأیید، چیزی ثبت نمی‌شود` : ""}
        wide
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={applying}>
              انصراف
            </Button>
            <Button onClick={apply} loading={applying}>
              تأیید و اعمال برنامه
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="space-y-3">
            {draft.aiSummary && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-[12px] leading-6 text-amber-900">
                <span className="font-bold">تحلیل AI: </span>
                {draft.aiSummary}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "بررسی‌شده", value: draft.stats.total, cls: "" },
                { label: "زمان‌بندی‌شده", value: draft.stats.scheduled, cls: "text-emerald-700" },
                { label: "زمان‌بندی‌نشده", value: draft.stats.unscheduled, cls: "text-amber-700" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-line bg-paper-soft/50 px-3 py-2 text-center">
                  <p className="text-[10.5px] text-ink-soft">{s.label}</p>
                  <p className={cn("text-[18px] font-bold tabular-nums", s.cls)}>{faNum(s.value)}</p>
                </div>
              ))}
            </div>

            <div className="max-h-[40vh] space-y-2 overflow-y-auto pl-1">
              {draft.assignments.map((a) => (
                <div key={a.requestId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{a.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-soft">
                      {faDateShort(a.start)} — {faDateShort(a.end)}
                      {a.roomName ? ` · ${a.roomName}` : ""}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-ink-faint">{a.reason}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(a); setEditStart(new Date(a.start).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))); setEditEnd(new Date(a.end).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))); setEditError(null); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              {draft.unscheduled.map((u) => (
                <div key={u.requestId} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{u.title}</p>
                    <p className="mt-0.5 text-[11px] text-amber-800">
                      <X className="ml-1 inline h-3 w-3" />
                      {u.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ویرایش زمان */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="اصلاح زمان جلسه"
        subtitle={editing?.title}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>انصراف</Button>
            <Button onClick={saveEdit}>
              <Check className="h-4 w-4" />
              ذخیره و بررسی مجدد
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-ink-soft">ساعت شروع</label>
                <input
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  dir="ltr"
                  placeholder="10:00"
                  className="h-10 w-full rounded-md border border-line px-3 font-mono text-[12px] outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-ink-soft">ساعت پایان</label>
                <input
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  dir="ltr"
                  placeholder="11:00"
                  className="h-10 w-full rounded-md border border-line px-3 font-mono text-[12px] outline-none focus:border-ink"
                />
              </div>
            </div>
            <p className="text-[11px] text-ink-faint">تاریخ همان روز پیش‌نمایش می‌ماند؛ فقط ساعت را عوض کنید — تداخل‌ها دوباره بررسی می‌شوند.</p>
            {editError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{editError}</div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
