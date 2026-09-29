"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Download, ExternalLink } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { faNum, faStr } from "@/lib";
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_BYTES_DEFAULT } from "@/lib/attachments";

export type AttachmentKind = "AGENDA" | "MINUTES";

interface Row {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface Job {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "error";
  error?: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${faNum(n)} بایت`;
  if (n < 1024 * 1024) return `${faNum(Math.round(n / 1024))} کیلوبایت`;
  return `${faStr((n / (1024 * 1024)).toFixed(1))} مگابایت`;
}

function fileGlyph(mime: string, name: string) {
  if (mime.startsWith("image/")) return { label: "تصویر", chip: "bg-emerald-50 text-emerald-700" };
  if (mime.includes("pdf")) return { label: "PDF", chip: "bg-red-50 text-red-600" };
  if (/sheet|xlsx|xls|csv/i.test(mime) || /\.(xlsx?|csv)$/i.test(name)) return { label: "اکسل", chip: "bg-emerald-50 text-emerald-700" };
  if (/presentation|pptx?/i.test(mime) || /\.pptx?$/i.test(name)) return { label: "پاورپوینت", chip: "bg-amber-50 text-amber-700" };
  if (/word|docx?/i.test(mime) || /\.docx?$/i.test(name)) return { label: "ورد", chip: "bg-blue-50 text-blue-700" };
  return { label: "فایل", chip: "bg-paper-soft text-ink-soft" };
}

/** آپلود با پیشرفت دقیق (XHR) */
function uploadOne(meetingId: string, kind: AttachmentKind, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/meetings/${meetingId}/attachments`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = "خطا در آپلود";
        try { msg = JSON.parse(xhr.responseText)?.error?.message ?? msg; } catch { /* noop */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("خطای شبکه"));
    xhr.withCredentials = true;
    xhr.send(fd);
  });
}

/**
 * بخش «پیوست» داخل تمپلیت‌های دستور جلسه/صورت‌جلسه — آپلودر کامل:
 * انتخاب چندتایی، drag&drop، progress زنده، لیست با دانلود/حذف.
 */
export function TemplateAttachments({
  meetingId,
  kind,
  canManage,
}: {
  meetingId: string;
  kind: AttachmentKind;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);

  const { data } = useQuery({
    queryKey: ["tpl-attachments", meetingId, kind],
    queryFn: () =>
      api<{ attachments: Row[] }>(`/api/meetings/${meetingId}/attachments?kind=${kind}`).catch(() => ({ attachments: [] as Row[] })),
    refetchInterval: jobs.length > 0 ? 1500 : false,
  });
  const rows = data?.attachments ?? [];

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["tpl-attachments", meetingId, kind] });
  }, [qc, meetingId, kind]);

  const startUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!canManage) return;
      for (const file of Array.from(files)) {
        if (file.size > ATTACHMENT_MAX_BYTES_DEFAULT) {
          push(`«${file.name}» از سقف ۱۰ مگابایت بزرگ‌تر است`, "error");
          continue;
        }
        const jid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setJobs((j) => [...j, { id: jid, name: file.name, progress: 0, status: "uploading" }]);
        try {
          await uploadOne(meetingId, kind, file, (pct) =>
            setJobs((j) => j.map((x) => (x.id === jid ? { ...x, progress: pct } : x))),
          );
          setJobs((j) => j.filter((x) => x.id !== jid));
          push(`«${file.name}» پیوست شد`, "success");
          await refresh();
        } catch (e) {
          setJobs((j) => j.map((x) => (x.id === jid ? { ...x, status: "error", error: (e as Error).message } : x)));
        }
      }
    },
    [canManage, meetingId, kind, push, refresh],
  );

  // drag&drop روی ناحیه‌ی خود بخش
  useEffect(() => {
    if (!canManage) return;
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      dragDepth.current += 1;
      setDragOver(true);
    };
    const onLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragOver(false);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setDragOver(false);
      if (e.dataTransfer?.files?.length) startUpload(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [canManage, startUpload]);

  async function remove(id: string) {
    try {
      await api(`/api/meetings/${meetingId}/attachments/${id}`, { method: "DELETE" });
      push("پیوست حذف شد", "success");
      await refresh();
    } catch (e) {
      push((e as ApiError).message, "error");
    }
  }

  const url = (id: string) => `/api/meetings/${meetingId}/attachments/${id}`;

  return (
    <div className="relative">
      {/* ناحیه‌ی آپلود */}
      {canManage && (
        <div
          className={dragOver ? "rounded-b-lg border-2 border-dashed border-ink bg-paper-soft/60" : ""}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ATTACHMENT_ACCEPT}
            multiple
            data-testid={`tpl-attach-input-${kind.toLowerCase()}`}
            onChange={(e) => {
              startUpload(e.target.files ?? []);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <button
            type="button"
            data-testid={`tpl-attach-btn-${kind.toLowerCase()}`}
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-3 text-[12px] font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink"
          >
            <Plus className="h-4 w-4" />
            آپلود پیوست
            <span className="text-[10.5px] text-ink-faint">— هر نوع فایل · سقف ۱۰ مگابایت · چندتایی</span>
          </button>
        </div>
      )}

      {/* صف آپلود */}
      <AnimatePresence>
        {jobs.map((j) => (
          <motion.div
            key={j.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 rounded-md border border-line bg-white px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[11.5px] font-medium">{j.name}</p>
              {j.status === "uploading" ? (
                <span className="shrink-0 text-[10.5px] tabular-nums text-ink-faint">{faNum(j.progress)}٪</span>
              ) : (
                <span className="shrink-0 text-[10.5px] text-red-600">{j.error}</span>
              )}
            </div>
            {j.status === "uploading" && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line/50">
                <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${j.progress}%` }} />
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* لیست فایل‌ها */}
      {rows.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => {
            const g = fileGlyph(r.mimeType, r.originalName);
            return (
              <li key={r.id} className="flex items-center gap-2.5 rounded-md border border-line bg-white px-2.5 py-2">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${g.chip}`}>{g.label}</span>
                <a
                  href={url(r.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-[12px] font-medium hover:underline"
                  title={r.originalName}
                >
                  {r.originalName}
                </a>
                <span className="shrink-0 text-[10.5px] text-ink-faint">{formatBytes(r.sizeBytes)}</span>
                <a href={url(r.id)} download className="shrink-0 text-ink-faint transition hover:text-ink" aria-label="دانلود" title="دانلود">
                  <Download className="h-4 w-4" />
                </a>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    className="shrink-0 text-ink-faint transition hover:text-red-600"
                    aria-label={`حذف ${r.originalName}`}
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rows.length === 0 && jobs.length === 0 && !canManage && (
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
          <ExternalLink className="h-3.5 w-3.5" />
          پیوستی ثبت نشده است
        </p>
      )}
    </div>
  );
}
