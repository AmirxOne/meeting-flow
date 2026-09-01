"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Plus, ScrollText, Trash2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { faNum, faStr, formatJalali } from "@/lib";
import { ATTACHMENT_ACCEPT, ATTACHMENT_ACCEPT_FA } from "@/lib/attachments";

export interface MeetingAttachmentRow {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; fullName: string };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${faNum(n)} بایت`;
  if (n < 1024 * 1024) return `${faNum(Math.round(n / 1024))} کیلوبایت`;
  return `${faStr((n / (1024 * 1024)).toFixed(1))} مگابایت`;
}

export function MeetingAttachments({
  meetingId,
  attachments,
  canManage,
}: {
  meetingId: string;
  attachments: MeetingAttachmentRow[];
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy("upload");
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api(`/api/meetings/${meetingId}/attachments`, { method: "POST", body: fd });
      push("فایل پیوست شد", "success");
      await qc.invalidateQueries({ queryKey: ["meeting", meetingId] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onDelete(row: MeetingAttachmentRow) {
    if (!confirm(`حذف پیوست «${row.originalName}»؟`)) return;
    setBusy(`del-${row.id}`);
    try {
      await api(`/api/meetings/${meetingId}/attachments/${row.id}`, { method: "DELETE" });
      push("پیوست حذف شد", "success");
      await qc.invalidateQueries({ queryKey: ["meeting", meetingId] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card data-testid="meeting-attachments" data-tour="meeting-attachments">
      <CardHeader
        title={`پیوست‌ها (${faNum(attachments.length)})`}
        subtitle={ATTACHMENT_ACCEPT_FA}
        action={
          canManage ? (
            <>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={ATTACHMENT_ACCEPT}
                data-testid="attachment-file-input"
                onChange={(e) => onPick(e.target.files?.[0])}
              />
              <Button
                size="sm"
                variant="outline"
                loading={busy === "upload"}
                data-testid="attachment-upload-btn"
                onClick={() => inputRef.current?.click()}
              >
                <Plus className="h-4 w-4" />
                آپلود فایل
              </Button>
            </>
          ) : undefined
        }
      />
      {attachments.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="پیوستی نیست"
            description={canManage ? "PDF، تصویر یا فایل آفیس را از دکمهٔ آپلود اضافه کنید." : "برگزارکننده هنوز فایلی پیوست نکرده است."}
          />
        </div>
      ) : (
        <div className="divide-y divide-line">
          {attachments.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 px-5 py-3"
              data-testid={`attachment-row-${row.id}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-paper-soft text-ink-soft">
                <ScrollText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium" data-testid="attachment-name">
                  {row.originalName}
                </p>
                <p className="text-[11px] text-ink-faint">
                  {formatBytes(row.sizeBytes)}
                  {` · ${row.uploadedBy.fullName}`}
                  {` · ${formatJalali(new Date(row.createdAt), { withTime: true })}`}
                </p>
              </div>
              <a
                href={`/api/meetings/${meetingId}/attachments/${row.id}`}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] text-ink-soft hover:bg-paper-soft hover:text-ink"
                data-testid="attachment-download"
              >
                <Download className="h-4 w-4" />
                دانلود
              </a>
              {canManage && (
                <button
                  type="button"
                  className="text-ink-faint hover:text-red-600"
                  aria-label="حذف پیوست"
                  data-testid="attachment-delete"
                  disabled={busy === `del-${row.id}`}
                  onClick={() => onDelete(row)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
