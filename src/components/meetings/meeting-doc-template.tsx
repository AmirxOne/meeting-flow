"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, X, Check, Info, MessageQuestion, ShieldCheck } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { faNum } from "@/lib";

/* ═══════════════════════════════════════════════════════════
   فرم رسمی دستور جلسه — مطابق تمپلیت Word شرکت:
   اطلاعات اصلی (عنوان/دبیر/حاضر) · اهداف جلسه ·
   روند جلسه (ردیف/موضوع/شروع/پایان) ·
   ابهامات و سوالات حاضرین (ردیف/موضوع/سوال‌کننده) ·
   پیشرفت مصوبات قبلی (ردیف/مصوبه/مسئول/مهلت/وضعیت) · پیوست
   ═══════════════════════════════════════════════════════════ */

export interface AgendaTemplateRow {
  title: string;
  presenter: string;
  schedule: string;
}

export interface DecisionTemplateRow {
  text: string;
  owner: string;
  due: string;
}

/** داده‌ی کامل فرم ذخیره‌شده */
export interface DocTemplateData {
  title?: string;
  secretary?: string;
  attendees?: string;
  goals?: string;
  /** روند جلسه */
  flow?: { title: string; start: string; end: string }[];
  /** ابهامات و سوالات حاضرین */
  questions?: { title: string; asker: string }[];
  /** پیشرفت مصوبات قبلی / مصوبات این جلسه */
  progress?: { decision: string; owner: string; due: string; status?: string }[];
  /** پیوست */
  appendix?: string;
}

/* ── هدر بخش با پس‌زمینه سبزآبی مثل تمپلیت ── */
function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-t-lg bg-ink px-3 py-2">
      <p className="text-[12px] font-bold text-white">{label}</p>
      <span className="mr-auto flex size-5 shrink-0 items-center justify-center text-white">{icon}</span>
    </div>
  );
}

const cellInputCls = "h-8 w-full rounded border border-line bg-white px-2 text-[12px] outline-none focus:border-ink";

/* ═════════════════ فرم دستور جلسه ═════════════════ */
export function AgendaTemplate({
  meetingId,
  meetingTitle,
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
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const qc = useQueryClient();

  // فرم کاملاً محلی — روی ذخیره از ریموت پر می‌شود
  const [draft, setDraft] = useState<DocTemplateData | null>(null);

  const { data: tpl } = useQuery({
    queryKey: ["doc-template", meetingId],
    queryFn: () =>
      api<{ template: DocTemplateData | null }>(`/api/meetings/${meetingId}/doc-template`).catch(() => null),
  });
  const saved = tpl?.template;

  function startEdit() {
    const base: DocTemplateData = {
      title: saved?.title ?? meetingTitle,
      secretary: saved?.secretary ?? "",
      attendees: saved?.attendees ?? "",
      goals: saved?.goals ?? "",
      flow:
        saved?.flow?.length
          ? saved.flow
          : items.length
            ? items.map((it) => ({ title: it.title, start: "", end: "" }))
            : [{ title: "", start: "", end: "" }],
      questions: saved?.questions ?? [{ title: "", asker: "" }],
      progress: saved?.progress ?? [],
      appendix: saved?.appendix ?? "",
    };
    setDraft(base);
    setMode("edit");
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await api(`/api/meetings/${meetingId}/doc-template`, { method: "PUT", json: draft });
      push("فرم دستور جلسه ذخیره شد", "success");
      setMode("view");
      await qc.invalidateQueries({ queryKey: ["doc-template", meetingId] });
    } catch (e) {
      push((e as Error).message || "خطا در ذخیره", "error");
    } finally {
      setBusy(false);
    }
  }

  const up = (patch: Partial<DocTemplateData>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const view = mode === "view";

  return (
    <Card data-testid="agenda-template">
      <CardHeader
        title="دستور جلسه"
        subtitle="روند جلسه · ابهامات · مصوبات قبلی · پیوست"
        action={
          canEdit ? (
            view ? (
              <Button size="sm" variant="outline" data-testid="agenda-tpl-edit" onClick={startEdit}>
                <Pencil className="h-4 w-4" />
                پر کردن فرم
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
                  <X className="h-4 w-4" />
                  انصراف
                </Button>
                <Button size="sm" loading={busy} data-testid="agenda-tpl-save" onClick={save}>
                  <Check className="h-4 w-4" />
                  ذخیره
                </Button>
              </div>
            )
          ) : undefined
        }
      />

      <div className="space-y-5 p-5">
        {/* ── اهداف جلسه ── */}
        <div>
          <SectionHeader icon={<Info className="h-4 w-4" />} label="اهداف جلسه" />
          {view ? (
            <div className="min-h-14 rounded-b-lg border border-t-0 border-line bg-white p-3 text-[12px] leading-6">
              {saved?.goals || <span className="text-ink-faint">—</span>}
            </div>
          ) : (
            <textarea
              value={draft?.goals ?? ""}
              onChange={(e) => up({ goals: e.target.value })}
              rows={3}
              className="w-full rounded-b-lg border border-t-0 border-line bg-white p-2.5 text-[12px] leading-6 outline-none focus:border-ink"
              placeholder="اهداف این جلسه…"
            />
          )}
        </div>

        {/* ── روند جلسه (۴ ستون) ── */}
        <div>
          <SectionHeader icon={<ShieldCheck className="h-4 w-4" />} label="روند جلسه" />
          <div className="overflow-x-auto rounded-b-lg border border-t-0 border-line bg-white">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="bg-paper-soft">
                  <th className="w-12 border border-line px-2 py-2 text-[11px] font-bold">ردیف</th>
                  <th className="border border-line px-3 py-2 text-[11px] font-bold">موضوع</th>
                  <th className="w-28 border border-line px-2 py-2 text-[11px] font-bold">ساعت شروع</th>
                  <th className="w-28 border border-line px-2 py-2 text-[11px] font-bold">ساعت پایان</th>
                  {view ? null : <th className="w-10 border border-line px-1 py-2" />}
                </tr>
              </thead>
              <tbody>
                {view ? (
                  (saved?.flow ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="border border-line px-3 py-5 text-center text-[11.5px] text-ink-faint">
                        {canEdit ? "با «پر کردن فرم» روند جلسه را تکمیل کنید" : "برگزارکننده هنوز فرم را تکمیل نکرده است"}
                      </td>
                    </tr>
                  ) : (
                    (saved?.flow ?? []).map((r, i) => (
                      <tr key={i} className="hover:bg-paper-soft/50">
                        <td className="border border-line px-2 py-2 text-center text-[12px] font-bold">{faNum(i + 1)}</td>
                        <td className="border border-line px-3 py-2 text-[12px]">{r.title || "—"}</td>
                        <td className="border border-line px-3 py-2 text-[12px]">{r.start || "—"}</td>
                        <td className="border border-line px-3 py-2 text-[12px]">{r.end || "—"}</td>
                      </tr>
                    ))
                  )
                ) : (
                  <>
                    {(draft?.flow ?? []).map((r, i) => (
                      <tr key={i}>
                        <td className="border border-line px-2 py-1.5 text-center text-[12px] font-bold">{faNum(i + 1)}</td>
                        <td className="border border-line p-1">
                          <input value={r.title} onChange={(e) => up({ flow: (draft?.flow ?? []).map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} className={cellInputCls} placeholder="موضوع" />
                        </td>
                        <td className="border border-line p-1">
                          <input value={r.start} onChange={(e) => up({ flow: (draft?.flow ?? []).map((x, j) => (j === i ? { ...x, start: e.target.value } : x)) })} className={cellInputCls} placeholder="۱۰:۰۰" />
                        </td>
                        <td className="border border-line p-1">
                          <input value={r.end} onChange={(e) => up({ flow: (draft?.flow ?? []).map((x, j) => (j === i ? { ...x, end: e.target.value } : x)) })} className={cellInputCls} placeholder="۱۰:۱۵" />
                        </td>
                        <td className="border border-line px-1 py-1.5 text-center">
                          <button type="button" aria-label={`حذف ردیف ${faNum(i + 1)}`} onClick={() => up({ flow: (draft?.flow ?? []).filter((_, j) => j !== i) })} className="text-ink-faint transition hover:text-red-600">
                            <Trash2 className="mx-auto h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="border border-line p-1.5">
                        <button type="button" onClick={() => up({ flow: [...(draft?.flow ?? []), { title: "", start: "", end: "" }] })} className="flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink">
                          <Plus className="h-3.5 w-3.5" />
                          افزودن ردیف
                        </button>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ابهامات و سوالات حاضرین (۳ ستون) ── */}
        <div>
          <SectionHeader icon={<MessageQuestion className="h-4 w-4" />} label="ابهامات و سوالات حاضرین" />
          <div className="overflow-x-auto rounded-b-lg border border-t-0 border-line bg-white">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="bg-paper-soft">
                  <th className="w-12 border border-line px-2 py-2 text-[11px] font-bold">ردیف</th>
                  <th className="border border-line px-3 py-2 text-[11px] font-bold">موضوع</th>
                  <th className="w-40 border border-line px-3 py-2 text-[11px] font-bold">سوال کننده</th>
                  {view ? null : <th className="w-10 border border-line px-1 py-2" />}
                </tr>
              </thead>
              <tbody>
                {view ? (
                  (saved?.questions ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="border border-line px-3 py-5 text-center text-[11.5px] text-ink-faint">سوالی ثبت نشده</td>
                    </tr>
                  ) : (
                    (saved?.questions ?? []).map((r, i) => (
                      <tr key={i} className="hover:bg-paper-soft/50">
                        <td className="border border-line px-2 py-2 text-center text-[12px] font-bold">{faNum(i + 1)}</td>
                        <td className="border border-line px-3 py-2 text-[12px]">{r.title || "—"}</td>
                        <td className="border border-line px-3 py-2 text-[12px]">{r.asker || "—"}</td>
                      </tr>
                    ))
                  )
                ) : (
                  <>
                    {(draft?.questions ?? []).map((r, i) => (
                      <tr key={i}>
                        <td className="border border-line px-2 py-1.5 text-center text-[12px] font-bold">{faNum(i + 1)}</td>
                        <td className="border border-line p-1">
                          <input value={r.title} onChange={(e) => up({ questions: (draft?.questions ?? []).map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} className={cellInputCls} />
                        </td>
                        <td className="border border-line p-1">
                          <input value={r.asker} onChange={(e) => up({ questions: (draft?.questions ?? []).map((x, j) => (j === i ? { ...x, asker: e.target.value } : x)) })} className={cellInputCls} />
                        </td>
                        <td className="border border-line px-1 py-1.5 text-center">
                          <button type="button" aria-label={`حذف سوال ${faNum(i + 1)}`} onClick={() => up({ questions: (draft?.questions ?? []).filter((_, j) => j !== i) })} className="text-ink-faint transition hover:text-red-600">
                            <Trash2 className="mx-auto h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4} className="border border-line p-1.5">
                        <button type="button" onClick={() => up({ questions: [...(draft?.questions ?? []), { title: "", asker: "" }] })} className="flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink">
                          <Plus className="h-3.5 w-3.5" />
                          افزودن سوال
                        </button>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── پیشرفت مصوبات قبلی (۵ ستون) ── */}
        <div>
          <SectionHeader icon={<Check className="h-4 w-4" />} label="پیشرفت مصوبات قبلی" />
          <div className="overflow-x-auto rounded-b-lg border border-t-0 border-line bg-white">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="bg-paper-soft">
                  <th className="w-12 border border-line px-2 py-2 text-[11px] font-bold">ردیف</th>
                  <th className="border border-line px-3 py-2 text-[11px] font-bold">مصوبه</th>
                  <th className="w-32 border border-line px-3 py-2 text-[11px] font-bold">مسئول</th>
                  <th className="w-24 border border-line px-3 py-2 text-[11px] font-bold">مهلت</th>
                  <th className="w-28 border border-line px-3 py-2 text-[11px] font-bold">وضعیت فعلی</th>
                  {view ? null : <th className="w-10 border border-line px-1 py-2" />}
                </tr>
              </thead>
              <tbody>
                {view ? (
                  (saved?.progress ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="border border-line px-3 py-5 text-center text-[11.5px] text-ink-faint">مصوبه‌ی قبلی ثبت نشده</td>
                    </tr>
                  ) : (
                    (saved?.progress ?? []).map((r, i) => (
                      <tr key={i} className="hover:bg-paper-soft/50">
                        <td className="border border-line px-2 py-2 text-center text-[12px] font-bold">{faNum(i + 1)}</td>
                        <td className="border border-line px-3 py-2 text-[12px]">{r.decision || "—"}</td>
                        <td className="border border-line px-3 py-2 text-[12px]">{r.owner || "—"}</td>
                        <td className="border border-line px-3 py-2 text-[12px]">{r.due || "—"}</td>
                        <td className="border border-line px-3 py-2 text-[12px]">{r.status || "—"}</td>
                      </tr>
                    ))
                  )
                ) : (
                  <>
                    {(draft?.progress ?? []).map((r, i) => (
                      <tr key={i}>
                        <td className="border border-line px-2 py-1.5 text-center text-[12px] font-bold">{faNum(i + 1)}</td>
                        <td className="border border-line p-1">
                          <input value={r.decision} onChange={(e) => up({ progress: (draft?.progress ?? []).map((x, j) => (j === i ? { ...x, decision: e.target.value } : x)) })} className={cellInputCls} />
                        </td>
                        <td className="border border-line p-1">
                          <input value={r.owner} onChange={(e) => up({ progress: (draft?.progress ?? []).map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)) })} className={cellInputCls} />
                        </td>
                        <td className="border border-line p-1">
                          <input value={r.due} onChange={(e) => up({ progress: (draft?.progress ?? []).map((x, j) => (j === i ? { ...x, due: e.target.value } : x)) })} className={cellInputCls} placeholder="۱۴۰۵/۰۷" />
                        </td>
                        <td className="border border-line p-1">
                          <input value={r.status ?? ""} onChange={(e) => up({ progress: (draft?.progress ?? []).map((x, j) => (j === i ? { ...x, status: e.target.value } : x)) })} className={cellInputCls} placeholder="انجام شد" />
                        </td>
                        <td className="border border-line px-1 py-1.5 text-center">
                          <button type="button" aria-label={`حذف مصوبه ${faNum(i + 1)}`} onClick={() => up({ progress: (draft?.progress ?? []).filter((_, j) => j !== i) })} className="text-ink-faint transition hover:text-red-600">
                            <Trash2 className="mx-auto h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={6} className="border border-line p-1.5">
                        <button type="button" onClick={() => up({ progress: [...(draft?.progress ?? []), { decision: "", owner: "", due: "", status: "" }] })} className="flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink">
                          <Plus className="h-3.5 w-3.5" />
                          افزودن مصوبه
                        </button>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── پیوست ── */}
        <div>
          <SectionHeader icon={<Plus className="h-4 w-4" />} label="پیوست" />
          {view ? (
            <div className="min-h-16 rounded-b-lg border border-t-0 border-line bg-white p-3 text-[12px] leading-6">
              {saved?.appendix || <span className="text-ink-faint">—</span>}
            </div>
          ) : (
            <textarea
              value={draft?.appendix ?? ""}
              onChange={(e) => up({ appendix: e.target.value })}
              rows={4}
              className="w-full rounded-b-lg border border-t-0 border-line bg-white p-2.5 text-[12px] leading-6 outline-none focus:border-ink"
              placeholder="محتوای پیوست…"
            />
          )}
        </div>
      </div>
    </Card>
  );
}


/* ═════════════════ صورت‌جلسه (مصوبات این جلسه) ═════════════════ */
export function MinutesTemplate({
  meetingId,
  meetingTitle,
  canEdit,
  initialDecisions,
}: {
  meetingId: string;
  meetingTitle: string;
  place?: string;
  startAt: string;
  canEdit: boolean;
  people?: { id: string; fullName: string }[];
  initialDecisions?: { id: string; text: string; owner?: { fullName: string } | null; dueAt?: string | null }[];
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const qc = useQueryClient();

  const { data: tpl } = useQuery({
    queryKey: ["doc-template", meetingId],
    queryFn: () =>
      api<{ template: DocTemplateData | null }>(`/api/meetings/${meetingId}/doc-template`).catch(() => null),
  });
  const saved = tpl?.template;

  // مصوبات این جلسه: ردیف‌هایی از progress که status «مصوب این جلسه» دارند یا مصوبات مستقل
  const [rows, setRows] = useState<{ text: string; owner: string; due: string }[]>([]);

  function startEdit() {
    const base = (saved?.progress ?? [])
      .filter((p) => p.status === "مصوب این جلسه")
      .map((p) => ({ text: p.decision, owner: p.owner, due: p.due }));
    setRows(base.length > 0 ? base : [{ text: "", owner: "", due: "" }]);
    setMode("edit");
  }

  async function save() {
    setBusy(true);
    try {
      const previous = (saved?.progress ?? []).filter((p) => p.status !== "مصوب این جلسه");
      const newOnes = rows.filter((r) => r.text.trim()).map((r) => ({
        decision: r.text, owner: r.owner, due: r.due, status: "مصوب این جلسه",
      }));
      await api(`/api/meetings/${meetingId}/doc-template`, {
        method: "PUT",
        json: { ...saved, progress: [...previous, ...newOnes] },
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

  const viewRows = (saved?.progress ?? [])
    .filter((p) => p.status === "مصوب این جلسه")
    .map((p) => ({ text: p.decision, owner: p.owner, due: p.due }));

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
                  <input value={row.text} onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="متن مصوبه" className="h-9 w-full rounded-md border border-line bg-white px-2.5 text-[12px] outline-none focus:border-ink" />
                </div>
                <div className="w-40 shrink-0">
                  <label className="mb-1 block text-[10.5px] text-ink-faint">مسئول</label>
                  <input value={row.owner} onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)))} placeholder="نام و نام‌خانوادگی" className="h-9 w-full rounded-md border border-line bg-white px-2.5 text-[12px] outline-none focus:border-ink" />
                </div>
                <div className="w-32 shrink-0">
                  <label className="mb-1 block text-[10.5px] text-ink-faint">مهلت</label>
                  <input value={row.due} onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} placeholder="۱۴۰۵/۰۷/۰۱" className="h-9 w-full rounded-md border border-line bg-white px-2.5 text-[12px] outline-none focus:border-ink" />
                </div>
                <button type="button" aria-label={`حذف ردیف ${faNum(i + 1)}`} onClick={() => setRows((arr) => arr.filter((_, j) => j !== i))} className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-faint transition hover:border-danger/40 hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setRows((arr) => [...arr, { text: "", owner: "", due: "" }])} className="flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[11.5px] font-medium text-ink-soft transition hover:border-accent/50 hover:text-accent">
              <Plus className="h-4 w-4" />
              افزودن مصوبه
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
