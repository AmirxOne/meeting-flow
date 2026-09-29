"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, X, Check } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { faNum, formatJalali } from "@/lib";

/* ═══════════════════════════════════════════════════════════
   تمپلیت رسمی شرکت — دستور جلسه و صورت‌جلسه
   مطابق فایل‌های «تمپلیت دستور جلسه.docx» و «تمپلیت صورت جلسه.docx»:
   دستور جلسه: ردیف | موضوع | فرد ارائه‌دهنده | زمان‌بندی
   صورت‌جلسه:  ردیف | مصوبه | مسئول | مهلت
   ═══════════════════════════════════════════════════════════ */

export interface AgendaTemplateRow {
  title: string;
  presenter: string; // فرد ارائه‌دهنده — دستی تایپ می‌شود
  schedule: string; // زمان‌بندی — مثلا «۱۰ دقیقه» یا «۱۴:۰۰»
}

export interface DecisionTemplateRow {
  text: string; // مصوبه
  owner: string; // مسئول
  due: string; // مهلت — دستی مثل ۱۴۰۵/۰۷/۰۱
}


/* ───────────────────────── دستور جلسه (تمپلیت) ───────────────────────── */

export function AgendaTemplate({
  meetingId,
  meetingTitle,
  place,
  startAt,
  canEdit,
  items,
}: {
  meetingId: string;
  meetingTitle: string;
  place?: string;
  startAt: string;
  canEdit: boolean;
  items: { id: string; sortOrder: number; title: string; durationMin: number | null; owner?: { fullName: string } | null }[];
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [rows, setRows] = useState<AgendaTemplateRow[]>([]);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const qc = useQueryClient();

  // تمپلیت ذخیره‌شده‌ی جلسه
  const { data: tpl } = useQuery({
    queryKey: ["doc-template", meetingId],
    queryFn: () =>
      api<{ template: { agenda: AgendaTemplateRow[]; decisions: DecisionTemplateRow[] } | null }>(
        `/api/meetings/${meetingId}/doc-template`,
      ).catch(() => null),
  });

  const saved = tpl?.template;
  const d = new Date(new Date(startAt).getTime() + 210 * 60000);

  function startEdit() {
    const base: AgendaTemplateRow[] =
      saved?.agenda?.length
        ? saved.agenda
        : items.map((it) => ({
            title: it.title,
            presenter: it.owner?.fullName ?? "",
            schedule: it.durationMin ? `${faNum(it.durationMin)} دقیقه` : "",
          }));
    // همیشه حداقل یک ردیف خالی برای شروع
    setRows(base.length > 0 ? base : [{ title: "", presenter: "", schedule: "" }]);
    setMode("edit");
  }

  async function save() {
    setBusy(true);
    try {
      await api(`/api/meetings/${meetingId}/doc-template`, {
        method: "PUT",
        json: { agenda: rows.filter((r) => r.title.trim()), decisions: saved?.decisions ?? [] },
      });
      push("دستور جلسه ذخیره شد", "success");
      setMode("view");
      await qc.invalidateQueries({ queryKey: ["doc-template", meetingId] });
    } catch (e) {
      push((e as Error).message || "خطا در ذخیره", "error");
    } finally {
      setBusy(false);
    }
  }

  const viewRows: AgendaTemplateRow[] =
    saved?.agenda?.length
      ? saved.agenda
      : items.map((it) => ({
          title: it.title,
          presenter: it.owner?.fullName ?? "",
          schedule: it.durationMin ? `${faNum(it.durationMin)} دقیقه` : "",
        }));

  return (
    <Card data-testid="agenda-template">
      <CardHeader
        title="دستور جلسه"
        subtitle="روند جلسه · مدت · مسئول"
        action={
          canEdit ? (
            <div className="flex items-center gap-1.5">
              {mode === "view" ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setMode(mode)} className="hidden" />
                  <Button size="sm" variant="outline" data-testid="agenda-tpl-edit" onClick={startEdit}>
                    <Pencil className="h-4 w-4" />
                    پر کردن فرم
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
                    <X className="h-4 w-4" />
                    انصراف
                  </Button>
                  <Button size="sm" loading={busy} data-testid="agenda-tpl-save" onClick={save}>
                    <Check className="h-4 w-4" />
                    ذخیره
                  </Button>
                </>
              )}
            </div>
          ) : undefined
        }
      />
      <div className="p-5">

        {mode === "view" ? (
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="bg-paper-soft">
                <th className="w-12 border border-line px-2 py-2 text-[11px] font-bold">ردیف</th>
                <th className="border border-line px-3 py-2 text-[11px] font-bold">موضوع</th>
                <th className="w-40 border border-line px-3 py-2 text-[11px] font-bold">فرد ارائه‌دهنده</th>
                <th className="w-28 border border-line px-3 py-2 text-[11px] font-bold">زمان‌بندی</th>
              </tr>
            </thead>
            <tbody>
              {viewRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-line px-3 py-6 text-center text-[12px] text-ink-faint">
                    هنوز موردی ثبت نشده — {canEdit ? "با «پر کردن فرم» جدول را تکمیل کنید" : "برگزارکننده هنوز دستور جلسه را تکمیل نکرده است"}
                  </td>
                </tr>
              ) : (
                viewRows.map((r, i) => (
                  <tr key={i} className="hover:bg-paper-soft/50">
                    <td className="border border-line px-2 py-2 text-center text-[12px] font-bold">{faNum(i + 1)}</td>
                    <td className="border border-line px-3 py-2 text-[12px]">{r.title}</td>
                    <td className="border border-line px-3 py-2 text-[12px]">{r.presenter || "—"}</td>
                    <td className="border border-line px-3 py-2 text-[12px]">{r.schedule || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <div className="space-y-2.5">
            {rows.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <span className="mb-2 w-6 shrink-0 text-center text-[12px] font-bold text-ink-faint">{faNum(i + 1)}</span>
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-[10.5px] text-ink-faint">موضوع (روند جلسه)</label>
                  <input
                    value={row.title}
                    onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    placeholder="مثلاً: بازبینی بودجه‌ی فصل"
                    className="h-9 w-full rounded-md border border-line px-2.5 text-[12px] outline-none focus:border-ink"
                  />
                </div>
                <div className="w-40 shrink-0">
                  <label className="mb-1 block text-[10.5px] text-ink-faint">فرد ارائه‌دهنده</label>
                  <input
                    value={row.presenter}
                    onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, presenter: e.target.value } : x)))}
                    placeholder="نام و نام‌خانوادگی"
                    className="h-9 w-full rounded-md border border-line px-2.5 text-[12px] outline-none focus:border-ink"
                  />
                </div>
                <div className="w-32 shrink-0">
                  <label className="mb-1 block text-[10.5px] text-ink-faint">زمان‌بندی (مدت)</label>
                  <input
                    value={row.schedule}
                    onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, schedule: e.target.value } : x)))}
                    placeholder="۱۰ دقیقه"
                    className="h-9 w-full rounded-md border border-line px-2.5 text-[12px] outline-none focus:border-ink"
                  />
                </div>
                <button
                  type="button"
                  aria-label={`حذف ردیف ${faNum(i + 1)}`}
                  onClick={() => setRows((arr) => arr.filter((_, j) => j !== i))}
                  className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-faint transition hover:border-danger/40 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRows((arr) => [...arr, { title: "", presenter: "", schedule: "" }])}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[11.5px] font-medium text-ink-soft transition hover:border-accent/50 hover:text-accent"
            >
              <Plus className="h-4 w-4" />
              افزودن ردیف
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ───────────────────────── صورت‌جلسه (تمپلیت) ───────────────────────── */

export function MinutesTemplate({
  meetingId,
  meetingTitle,
  place,
  startAt,
  canEdit,
  people,
  initialDecisions,
}: {
  meetingId: string;
  meetingTitle: string;
  place?: string;
  startAt: string;
  canEdit: boolean;
  people: { id: string; fullName: string }[];
  initialDecisions: { id: string; text: string; owner?: { fullName: string } | null; dueAt?: string | null }[];
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [rows, setRows] = useState<DecisionTemplateRow[]>([]);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const qc = useQueryClient();

  const { data: tpl } = useQuery({
    queryKey: ["doc-template", meetingId],
    queryFn: () =>
      api<{ template: { agenda: AgendaTemplateRow[]; decisions: DecisionTemplateRow[] } | null }>(
        `/api/meetings/${meetingId}/doc-template`,
      ).catch(() => null),
  });
  const saved = tpl?.template;
  const d = new Date(new Date(startAt).getTime() + 210 * 60000);

  function startEdit() {
    const base: DecisionTemplateRow[] = saved?.decisions?.length
      ? saved.decisions
      : initialDecisions.map((dc) => ({
          text: dc.text,
          owner: dc.owner?.fullName ?? "",
          due: dc.dueAt ? formatJalali(new Date(dc.dueAt), { withTime: false }) : "",
        }));
    // همیشه حداقل یک ردیف خالی برای شروع
    setRows(base.length > 0 ? base : [{ text: "", owner: "", due: "" }]);
    setMode("edit");
  }

  async function save() {
    setBusy(true);
    try {
      await api(`/api/meetings/${meetingId}/doc-template`, {
        method: "PUT",
        json: { agenda: saved?.agenda ?? [], decisions: rows.filter((r) => r.text.trim()) },
      });
      push("صورت‌جلسه ذخیره شد", "success");
      setMode("view");
      await qc.invalidateQueries({ queryKey: ["doc-template", meetingId] });
    } catch (e) {
      push((e as Error).message || "خطا در ذخیره", "error");
    } finally {
      setBusy(false);
    }
  }

  const viewRows: DecisionTemplateRow[] = saved?.decisions?.length
    ? saved.decisions
    : initialDecisions.map((dc) => ({
        text: dc.text,
        owner: dc.owner?.fullName ?? "",
        due: dc.dueAt ? formatJalali(new Date(dc.dueAt), { withTime: false }) : "",
      }));

  return (
    <Card data-testid="minutes-template">
      <CardHeader
        title="صورت‌جلسه"
        subtitle="مصوبه · مسئول · مهلت"
        action={
          canEdit ? (
            mode === "view" ? (
              <Button size="sm" variant="outline" data-testid="minutes-tpl-edit" onClick={startEdit}>
                <Pencil className="h-4 w-4" />
                پر کردن فرم
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
                  <X className="h-4 w-4" />
                  انصراف
                </Button>
                <Button size="sm" loading={busy} data-testid="minutes-tpl-save" onClick={save}>
                  <Check className="h-4 w-4" />
                  ذخیره
                </Button>
              </div>
            )
          ) : undefined
        }
      />
      <div className="p-5">

        {mode === "view" ? (
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="bg-paper-soft">
                <th className="w-12 border border-line px-2 py-2 text-[11px] font-bold">ردیف</th>
                <th className="border border-line px-3 py-2 text-[11px] font-bold">مصوبه</th>
                <th className="w-40 border border-line px-3 py-2 text-[11px] font-bold">مسئول</th>
                <th className="w-28 border border-line px-3 py-2 text-[11px] font-bold">مهلت</th>
              </tr>
            </thead>
            <tbody>
              {viewRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-line px-3 py-6 text-center text-[12px] text-ink-faint">
                    هنوز مصوبه‌ای ثبت نشده — {canEdit ? "با «پر کردن فرم» جدول را تکمیل کنید" : "صورت‌جلسه هنوز تکمیل نشده است"}
                  </td>
                </tr>
              ) : (
                viewRows.map((r, i) => (
                  <tr key={i} className="hover:bg-paper-soft/50">
                    <td className="border border-line px-2 py-2 text-center text-[12px] font-bold">{faNum(i + 1)}</td>
                    <td className="border border-line px-3 py-2 text-[12px]">{r.text}</td>
                    <td className="border border-line px-3 py-2 text-[12px]">{r.owner || "—"}</td>
                    <td className="border border-line px-3 py-2 text-[12px]">{r.due || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <div className="space-y-2.5">
            {rows.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <span className="mb-2 w-6 shrink-0 text-center text-[12px] font-bold text-ink-faint">{faNum(i + 1)}</span>
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-[10.5px] text-ink-faint">مصوبه</label>
                  <input
                    value={row.text}
                    onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                    placeholder="متن مصوبه"
                    className="h-9 w-full rounded-md border border-line px-2.5 text-[12px] outline-none focus:border-ink"
                  />
                </div>
                <div className="w-40 shrink-0">
                  <label className="mb-1 block text-[10.5px] text-ink-faint">مسئول</label>
                  <input
                    value={row.owner}
                    onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)))}
                    placeholder="نام و نام‌خانوادگی"
                    className="h-9 w-full rounded-md border border-line px-2.5 text-[12px] outline-none focus:border-ink"
                  />
                </div>
                <div className="w-32 shrink-0">
                  <label className="mb-1 block text-[10.5px] text-ink-faint">مهلت</label>
                  <input
                    value={row.due}
                    onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))}
                    placeholder="۱۴۰۵/۰۷/۰۱"
                    className="h-9 w-full rounded-md border border-line px-2.5 text-[12px] outline-none focus:border-ink"
                  />
                </div>
                <button
                  type="button"
                  aria-label={`حذف ردیف ${faNum(i + 1)}`}
                  onClick={() => setRows((arr) => arr.filter((_, j) => j !== i))}
                  className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-faint transition hover:border-danger/40 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRows((arr) => [...arr, { text: "", owner: "", due: "" }])}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[11.5px] font-medium text-ink-soft transition hover:border-accent/50 hover:text-accent"
            >
              <Plus className="h-4 w-4" />
              افزودن مصوبه
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
