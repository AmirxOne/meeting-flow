"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { useToast } from "@/components/ui/toast";
import { faNum, formatJalali, isoDateInTz } from "@/lib";

export interface MeetingDecisionRow {
  id: string;
  sortOrder: number;
  text: string;
  ownerId: string | null;
  dueAt: string | null;
  owner: { id: string; fullName: string } | null;
}

export interface MeetingMinutesData {
  id: string;
  body: string;
  publishedAt: string;
  updatedAt: string;
  publishedBy: { id: string; fullName: string };
  decisions: MeetingDecisionRow[];
}

interface DraftDecision {
  key: string;
  text: string;
  ownerId: string;
  dueAt: string;
}

function toDraft(decisions: MeetingDecisionRow[]): DraftDecision[] {
  return decisions.map((d, i) => ({
    key: d.id || `new-${i}`,
    text: d.text,
    ownerId: d.ownerId ?? "",
    dueAt: d.dueAt ? isoDateInTz(new Date(d.dueAt)) : "",
  }));
}

export function MeetingMinutes({
  meetingId,
  minutes,
  canEdit,
  people,
}: {
  meetingId: string;
  minutes: MeetingMinutesData | null;
  canEdit: boolean;
  people: { id: string; fullName: string }[];
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState<DraftDecision[]>([]);
  const [busy, setBusy] = useState(false);

  const ownerOptions = useMemo(
    () => [
      { value: "", label: "بدون مسئول" },
      ...people.map((p) => ({ value: p.id, label: p.fullName })),
    ],
    [people],
  );

  function startEdit() {
    setBody(minutes?.body ?? "");
    setDraft(toDraft(minutes?.decisions ?? []));
    setOpen(true);
  }

  function update(key: string, patch: Partial<DraftDecision>) {
    setDraft((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function save() {
    const cleaned = draft
      .map((r) => ({
        text: r.text.trim(),
        ownerId: r.ownerId || null,
        dueAt: r.dueAt || null,
      }))
      .filter((r) => r.text.length > 0);
    if (!body.trim()) {
      push("متن صورتجلسه را بنویسید", "error");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/meetings/${meetingId}/minutes`, {
        method: "PUT",
        json: { body: body.trim(), decisions: cleaned },
      });
      push("صورتجلسه ثبت شد", "success");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["meeting", meetingId] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const decisions = minutes?.decisions ?? [];

  return (
    <Card data-testid="meeting-minutes" data-tour="meeting-minutes">
      <CardHeader
        title="صورتجلسه"
        subtitle={
          minutes
            ? `ثبت‌شده توسط ${minutes.publishedBy.fullName} · ${formatJalali(new Date(minutes.publishedAt), { withTime: true })}`
            : "متن جلسه و فهرست تصمیم‌ها"
        }
        action={
          canEdit ? (
            <Button size="sm" variant="outline" data-testid="minutes-edit-btn" onClick={startEdit}>
              <Pencil className="h-4 w-4" />
              {minutes ? "ویرایش" : "ثبت"}
            </Button>
          ) : undefined
        }
      />
      {!minutes ? (
        <div className="p-5">
          <EmptyState
            title="صورتجلسه‌ای ثبت نشده"
            description={
              canEdit
                ? "پس از برگزاری، متن و تصمیم‌ها را اینجا بنویسید."
                : "صورتجلسه پس از شروع یا پایان جلسه توسط برگزارکننده ثبت می‌شود."
            }
          />
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <p
            className="whitespace-pre-wrap text-[13px] leading-7 text-ink"
            data-testid="minutes-body-view"
          >
            {minutes.body}
          </p>
          {decisions.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-medium text-ink-soft">
                تصمیم‌ها ({faNum(decisions.length)})
              </p>
              <ol className="divide-y divide-line rounded-md border border-line">
                {decisions.map((d, i) => (
                  <li
                    key={d.id}
                    className="flex items-start gap-3 px-4 py-3"
                    data-testid="minutes-decision"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper-soft text-[11px] font-bold">
                      {faNum(i + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium">{d.text}</p>
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        {d.owner ? `مسئول: ${d.owner.fullName}` : "بدون مسئول"}
                        {d.dueAt
                          ? ` · مهلت ${formatJalali(new Date(d.dueAt), { monthName: true })}`
                          : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={minutes ? "ویرایش صورتجلسه" : "ثبت صورتجلسه"}
        subtitle="متن جلسه و تصمیم‌ها (مسئول و مهلت اختیاری)"
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button loading={busy} data-testid="minutes-save-btn" onClick={save}>
              ذخیره
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium">متن صورتجلسه</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={8000}
              placeholder="خلاصه بحث و نتایج جلسه…"
              className="w-full resize-y rounded-md border border-[#d9d9e0] px-3 py-2 text-[13px] leading-6 outline-none focus:border-ink"
              data-testid="minutes-body-input"
            />
          </label>
          <div className="space-y-3">
            <p className="text-[12px] font-medium">تصمیم‌ها</p>
            {draft.length === 0 && (
              <p className="text-[12px] text-ink-soft">هنوز تصمیمی نیست — یکی اضافه کنید.</p>
            )}
            {draft.map((row) => (
              <div
                key={row.key}
                className="space-y-2 rounded-md border border-line p-3"
                data-testid="minutes-draft-row"
              >
                <input
                  value={row.text}
                  onChange={(e) => update(row.key, { text: e.target.value })}
                  placeholder="متن تصمیم"
                  maxLength={400}
                  className="w-full rounded-md border border-[#d9d9e0] px-3 py-2 text-[13px] outline-none focus:border-ink"
                  data-testid="minutes-decision-text"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    size="sm"
                    value={row.ownerId}
                    onChange={(v) => update(row.key, { ownerId: v })}
                    options={ownerOptions}
                    placeholder="مسئول"
                  />
                  <JalaliDatePicker
                    value={row.dueAt}
                    onChange={(iso) => update(row.key, { dueAt: iso })}
                    placeholder="مهلت (اختیاری)"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600"
                    aria-label="حذف تصمیم"
                    onClick={() => setDraft((rows) => rows.filter((r) => r.key !== row.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={draft.length >= 20}
              data-testid="minutes-add-decision"
              onClick={() =>
                setDraft((rows) => [
                  ...rows,
                  { key: `new-${Date.now()}`, text: "", ownerId: "", dueAt: "" },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              افزودن تصمیم
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
