"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn, faNum } from "@/lib";
import { AGENDA_DURATION_PRESETS, AGENDA_MAX_ITEMS } from "@/lib/agenda";

export interface MeetingAgendaItemRow {
  id: string;
  sortOrder: number;
  title: string;
  durationMin: number | null;
  ownerId: string | null;
  owner: { id: string; fullName: string } | null;
}

interface DraftItem {
  key: string;
  title: string;
  durationMin: string;
  ownerId: string;
}

function toDraft(items: MeetingAgendaItemRow[]): DraftItem[] {
  return items.map((it, i) => ({
    key: it.id || `new-${i}`,
    title: it.title,
    durationMin: it.durationMin ? String(it.durationMin) : "",
    ownerId: it.ownerId ?? "",
  }));
}

function durationLabel(min: number | null): string {
  if (!min) return "—";
  return `${faNum(min)} دقیقه`;
}

export function MeetingAgenda({
  meetingId,
  items,
  canEdit,
  people,
}: {
  meetingId: string;
  items: MeetingAgendaItemRow[];
  canEdit: boolean;
  people: { id: string; fullName: string }[];
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [busy, setBusy] = useState(false);

  const ownerOptions = useMemo(
    () => [
      { value: "", label: "بدون مسئول" },
      ...people.map((p) => ({ value: p.id, label: p.fullName })),
    ],
    [people],
  );

  const durationOptions = useMemo(
    () => [
      { value: "", label: "بدون مدت" },
      ...AGENDA_DURATION_PRESETS.map((n) => ({
        value: String(n),
        label: `${faNum(n)} دقیقه`,
      })),
    ],
    [],
  );

  function startEdit() {
    setDraft(toDraft(items));
    setOpen(true);
  }

  function update(key: string, patch: Partial<DraftItem>) {
    setDraft((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function move(index: number, dir: -1 | 1) {
    setDraft((rows) => {
      const next = [...rows];
      const j = index + dir;
      if (j < 0 || j >= next.length) return rows;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  async function save() {
    const cleaned = draft
      .map((r) => ({
        title: r.title.trim(),
        durationMin: r.durationMin ? Number(r.durationMin) : null,
        ownerId: r.ownerId || null,
      }))
      .filter((r) => r.title.length > 0);
    setBusy(true);
    try {
      await api(`/api/meetings/${meetingId}/agenda`, {
        method: "PUT",
        json: { items: cleaned },
      });
      push("دستور جلسه ذخیره شد", "success");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["meeting", meetingId] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const totalMin = items.reduce((s, it) => s + (it.durationMin ?? 0), 0);

  return (
    <Card data-testid="meeting-agenda" data-tour="meeting-agenda">
      <CardHeader
        title={`دستور جلسه (${faNum(items.length)})`}
        subtitle={totalMin > 0 ? `جمع مدت تخمینی ${faNum(totalMin)} دقیقه` : "آیتم‌ها با ترتیب، مدت و مسئول"}
        action={
          canEdit ? (
            <Button size="sm" variant="outline" data-testid="agenda-edit-btn" onClick={startEdit}>
              <Pencil className="h-4 w-4" />
              ویرایش
            </Button>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="دستور جلسه‌ای ثبت نشده"
            description={canEdit ? "با ویرایش، آیتم‌ها را به ترتیب اضافه کنید." : "برگزارکننده هنوز دستور جلسه ننوشته است."}
          />
        </div>
      ) : (
        <ol className="divide-y divide-line">
          {items.map((it, i) => (
            <li
              key={it.id}
              className="flex items-start gap-3 px-5 py-3"
              data-testid="agenda-item"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper-soft text-[11px] font-bold">
                {faNum(i + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{it.title}</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  {durationLabel(it.durationMin)}
                  {it.owner ? ` · مسئول: ${it.owner.fullName}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="ویرایش دستور جلسه"
        subtitle={`حداکثر ${faNum(AGENDA_MAX_ITEMS)} آیتم — ترتیب با دکمه‌های بالا/پایین`}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button loading={busy} data-testid="agenda-save-btn" onClick={save}>
              ذخیره
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {draft.length === 0 && (
            <p className="text-[12px] text-ink-soft">هنوز آیتمی نیست — یکی اضافه کنید.</p>
          )}
          {draft.map((row, i) => (
            <div
              key={row.key}
              className="space-y-2 rounded-md border border-line p-3"
              data-testid="agenda-draft-row"
            >
              <input
                value={row.title}
                onChange={(e) => update(row.key, { title: e.target.value })}
                placeholder="عنوان آیتم"
                maxLength={160}
                className="w-full rounded-md border border-[#d9d9e0] px-3 py-2 text-[13px] outline-none focus:border-ink"
                data-testid="agenda-title-input"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  size="sm"
                  value={row.durationMin}
                  onChange={(v) => update(row.key, { durationMin: v })}
                  options={durationOptions}
                  placeholder="مدت تخمینی"
                />
                <Select
                  size="sm"
                  value={row.ownerId}
                  onChange={(v) => update(row.key, { ownerId: v })}
                  options={ownerOptions}
                  placeholder="مسئول"
                />
              </div>
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  className={cn("rounded-md p-1.5 text-ink-faint hover:bg-paper-soft hover:text-ink", i === 0 && "opacity-40")}
                  aria-label="جابه‌جایی به بالا"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md p-1.5 text-ink-faint hover:bg-paper-soft hover:text-ink",
                    i === draft.length - 1 && "opacity-40",
                  )}
                  aria-label="جابه‌جایی به پایین"
                  disabled={i === draft.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600"
                  aria-label="حذف آیتم"
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
            disabled={draft.length >= AGENDA_MAX_ITEMS}
            data-testid="agenda-add-btn"
            onClick={() =>
              setDraft((rows) => [
                ...rows,
                { key: `new-${Date.now()}`, title: "", durationMin: "", ownerId: "" },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            افزودن آیتم
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
