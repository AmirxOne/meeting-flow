"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, X, Check, Info, MessageQuestion, ShieldCheck } from "@/components/ui/icon";
import { TemplateAttachments } from "@/components/meetings/template-attachments";
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

import { useAiFeature } from "@/lib/ai-feature";
import { Sparkles } from "@/components/ui/icon";

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
  /** فرم صورت‌جلسه */
  minTitle?: string;
  minAttendees?: string;
  minOptionalAttendees?: string;
  minManager?: string;
  minFlow?: string;
  minAppendix?: string;
}

/* ── هدر بخش با پس‌زمینه سبزآبی مثل تمپلیت ── */
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center rounded-t-lg bg-ink px-3 py-2">
      <p className="text-[12px] font-bold text-white">{label}</p>
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
  const ai = useAiFeature();
  const [aiBusy, setAiBusy] = useState(false);

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
          <SectionHeader label="اهداف جلسه" />
          {view ? (
            <div className="min-h-14 rounded-b-lg border border-t-0 border-line bg-white p-3 text-[12px] leading-6">
              {saved?.goals || <span className="text-ink-faint">—</span>}
            </div>
          ) : (
            <textarea
              value={draft?.goals ?? ""}
              onChange={(e) => up({ goals: e.target.value })}
              rows={3}
              className="w-full rounded-b-lg border border-t-0 border-line bg-white p-2.5 text-[12px] leading-6 outline-none focus:border-ink min-h-[150px] max-h-[400px] resize-y overflow-y-auto"
              placeholder="اهداف این جلسه…"
            />
          )}
        </div>

        {/* ── روند جلسه (۴ ستون) ── */}
        <div>
          <SectionHeader label="روند جلسه" />
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
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => up({ flow: [...(draft?.flow ?? []), { title: "", start: "", end: "" }] })} className="mr-auto flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink">
                            <Plus className="h-3.5 w-3.5" />
                            افزودن ردیف
                          </button>
                          {ai.enabled && (
                            <button
                              type="button"
                              data-testid="ai-flow-suggest"
                              disabled={aiBusy}
                              onClick={async () => {
                                setAiBusy(true);
                                try {
                                  const r = await api<{ topics: { title: string; start: string; end: string }[] }>(`/api/meetings/${meetingId}/ai/agenda-topics`, { method: "POST" });
                                  const cur = draft?.flow ?? [];
                                  const next = [...cur];
                                  r.topics.forEach((t) => {
                                    const emptyIdx = next.findIndex((x) => !x.title.trim());
                                    if (emptyIdx >= 0) next[emptyIdx] = { ...next[emptyIdx], title: t.title, start: t.start, end: t.end };
                                    else next.push({ title: t.title, start: t.start, end: t.end });
                                  });
                                  up({ flow: next });
                                  push("پنج موضوع پیشنهادی هوش مصنوعی اضافه شد", "success");
                                } catch (e) {
                                  push((e as Error).message || "پیشنهاد موضوعات ناموفق بود", "error");
                                } finally {
                                  setAiBusy(false);
                                }
                              }}
                              className="relative flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1 text-[11px] font-semibold transition hover:border-ink/40 hover:bg-paper-soft disabled:cursor-wait disabled:opacity-60"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                              <span
                                style={{
                                  "--bg-size": "300%",
                                  "--color-from": "#b45309",
                                  "--color-to": "#9333ea",
                                } as React.CSSProperties}
                                className={`relative ${aiBusy ? "" : "ai-gradient-text"}`}
                              >
                                {/* متن invisible نگه می‌دارد عرض ثابت — الگوی استاندارد دکمه‌های لودینگ پروژه */}
                                <span className={aiBusy ? "invisible" : undefined}>پیشنهاد ۵ موضوع با هوش مصنوعی</span>
                                {aiBusy && <span className="absolute inset-0 flex items-center justify-center text-ink-soft">در حال بررسی جلسه…</span>}
                              </span>
                            </button>
                          )}
                        </div>
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
          <SectionHeader label="ابهامات و سوالات حاضرین" />
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
                        <button type="button" onClick={() => up({ questions: [...(draft?.questions ?? []), { title: "", asker: "" }] })} className="mr-auto flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink">
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
          <SectionHeader label="پیشرفت مصوبات قبلی" />
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
                        <button type="button" onClick={() => up({ progress: [...(draft?.progress ?? []), { decision: "", owner: "", due: "", status: "" }] })} className="mr-auto flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink">
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

        {/* ── پیوست (آپلود فایل) ── */}
        <div>
          <SectionHeader label="پیوست" />
          <div className="rounded-b-lg border border-t-0 border-line bg-white p-3">
            <TemplateAttachments meetingId={meetingId} kind="AGENDA" canManage={canEdit && !view} />
          </div>
        </div>
      </div>
    </Card>
  );
}


/* ═════════════════ فرم صورت‌جلسه ═════════════════ */
export function MinutesTemplate({
  meetingId,
  meetingTitle,
  canEdit,
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
  const ai = useAiFeature();
  const [aiBusy, setAiBusy] = useState(false);

  const [minDraft, setMinDraft] = useState<DocTemplateData | null>(null);
  const [rows, setRows] = useState<{ text: string; owner: string; due: string }[]>([]);

  function startEdit() {
    setMinDraft({
      ...(saved ?? {}),
      minTitle: saved?.minTitle ?? meetingTitle,
      minAttendees: saved?.minAttendees ?? "",
      minOptionalAttendees: saved?.minOptionalAttendees ?? "",
      minManager: saved?.minManager ?? "",
      minFlow: saved?.minFlow ?? "",
    });
    const base = (saved?.progress ?? [])
      .filter((p) => p.status === "مصوب این جلسه")
      .map((p) => ({ text: p.decision, owner: p.owner, due: p.due }));
    setRows(base.length > 0 ? base : [{ text: "", owner: "", due: "" }]);
    setMode("edit");
  }

  async function save() {
    if (!minDraft) return;
    setBusy(true);
    try {
      const previous = (saved?.progress ?? []).filter((p) => p.status !== "مصوب این جلسه");
      const newOnes = rows.filter((r) => r.text.trim()).map((r) => ({
        decision: r.text, owner: r.owner, due: r.due, status: "مصوب این جلسه",
      }));
      await api(`/api/meetings/${meetingId}/doc-template`, {
        method: "PUT",
        json: { ...saved, ...minDraft, progress: [...previous, ...newOnes] },
      });
      push("فرم صورت‌جلسه ذخیره شد", "success");
      setMode("view");
      await qc.invalidateQueries({ queryKey: ["doc-template", meetingId] });
    } catch (e) {
      push((e as Error).message || "خطا در ذخیره", "error");
    } finally {
      setBusy(false);
    }
  }

  const up = (patch: Partial<DocTemplateData>) => setMinDraft((d) => (d ? { ...d, ...patch } : d));
  const view = mode === "view";
  const viewRows = (saved?.progress ?? [])
    .filter((p) => p.status === "مصوب این جلسه")
    .map((p) => ({ text: p.decision, owner: p.owner, due: p.due }));

  const inp = "h-9 w-full rounded-md border border-line bg-white px-2.5 text-[12px] outline-none focus:border-ink";

  return (
    <Card data-testid="minutes-template">
      <CardHeader
        title="صورت‌جلسه"
        subtitle="روند جلسه · مصوبات · پیوست"
        action={
          canEdit ? (
            view ? (
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

      <div className="space-y-5 p-5">
        {/* ── روند جلسه ── */}
        <div>
          <SectionHeader label="روند جلسه" />
          {view ? (
            <div className="min-h-16 rounded-b-lg border border-t-0 border-line bg-white p-3 text-[12px] leading-6 whitespace-pre-wrap">
              {saved?.minFlow || <span className="text-ink-faint">—</span>}
            </div>
          ) : (
            <textarea
              value={minDraft?.minFlow ?? ""}
              onChange={(e) => up({ minFlow: e.target.value })}
              rows={4}
              className="w-full rounded-b-lg border border-t-0 border-line bg-white p-2.5 text-[12px] leading-6 outline-none focus:border-ink min-h-[150px] max-h-[400px] resize-y overflow-y-auto"
              placeholder="روند برگزاری جلسه…"
            />
          )}
        </div>

        {/* ── مصوبات (۴ ستون) ── */}
        <div>
          <SectionHeader label="مصوبات" />
          <div className="overflow-x-auto rounded-b-lg border border-t-0 border-line bg-white">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="bg-paper-soft">
                  <th className="w-12 border border-line px-2 py-2 text-[11px] font-bold">ردیف</th>
                  <th className="border border-line px-3 py-2 text-[11px] font-bold">مصوبه</th>
                  <th className="w-40 border border-line px-3 py-2 text-[11px] font-bold">مسئول</th>
                  <th className="w-28 border border-line px-3 py-2 text-[11px] font-bold">مهلت</th>
                  {view ? null : <th className="w-10 border border-line px-1 py-2" />}
                </tr>
              </thead>
              <tbody>
                {view ? (
                  viewRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="border border-line px-3 py-5 text-center text-[11.5px] text-ink-faint">
                        {canEdit ? "با «پر کردن فرم» مصوبات را ثبت کنید" : "هنوز مصوبه‌ای ثبت نشده"}
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
                  )
                ) : (
                  <>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td className="border border-line px-2 py-1.5 text-center text-[12px] font-bold">{faNum(i + 1)}</td>
                        <td className="border border-line p-1">
                          <input value={r.text} onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className="h-8 w-full rounded border border-line bg-white px-2 text-[12px] outline-none focus:border-ink" placeholder="متن مصوبه" />
                        </td>
                        <td className="border border-line p-1">
                          <input value={r.owner} onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)))} className="h-8 w-full rounded border border-line bg-white px-2 text-[12px] outline-none focus:border-ink" placeholder="نام و نام‌خانوادگی" />
                        </td>
                        <td className="border border-line p-1">
                          <input value={r.due} onChange={(e) => setRows((arr) => arr.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} className="h-8 w-full rounded border border-line bg-white px-2 text-[12px] outline-none focus:border-ink" placeholder="۱۴۰۵/۰۷/۰۱" />
                        </td>
                        <td className="border border-line px-1 py-1.5 text-center">
                          <button type="button" aria-label={`حذف مصوبه ${faNum(i + 1)}`} onClick={() => setRows((arr) => arr.filter((_, j) => j !== i))} className="text-ink-faint transition hover:text-red-600">
                            <Trash2 className="mx-auto h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="border border-line p-1.5">
                        <button type="button" onClick={() => setRows((arr) => [...arr, { text: "", owner: "", due: "" }])} className="mr-auto flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink">
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

        {/* ── پیوست (آپلود فایل) ── */}
        <div>
          <SectionHeader label="پیوست" />
          <div className="rounded-b-lg border border-t-0 border-line bg-white p-3">
            <TemplateAttachments meetingId={meetingId} kind="MINUTES" canManage={canEdit && !view} />
          </div>
        </div>
      </div>
    </Card>
  );
}

