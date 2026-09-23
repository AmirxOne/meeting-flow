"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Plus, Trash2, X, ScrollText, Eye, Layers, PlayCircle } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, faNum, faStr, formatJalali } from "@/lib";
import { ATTACHMENT_ACCEPT, ATTACHMENT_ACCEPT_FA, ATTACHMENT_MAX_BYTES_DEFAULT } from "@/lib/attachments";

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

/** pick a glyph + tint by mime type */
function fileVisual(mime: string, name: string) {
  if (mime.startsWith("image/")) return { Icon: Eye, chip: "bg-emerald-50 text-emerald-600", label: "تصویر" };
  if (mime.includes("pdf")) return { Icon: ScrollText, chip: "bg-red-50 text-red-600", label: "PDF" };
  if (/sheet|xlsx|xls/.test(mime) || /\.(xlsx?|csv)$/i.test(name)) return { Icon: Layers, chip: "bg-emerald-50 text-emerald-700", label: "صفحه‌گسترده" };
  if (/presentation|pptx?/.test(mime) || /\.pptx?$/i.test(name)) return { Icon: PlayCircle, chip: "bg-amber-50 text-amber-600", label: "ارائه" };
  return { Icon: ScrollText, chip: "bg-paper-soft text-ink-soft", label: "سند" };
}

/** one queued upload with precise progress (XHR for upload events) */
interface UploadJob {
  id: string;
  file: File;
  progress: number; // 0-100
  status: "uploading" | "error";
  error?: string;
}

function uploadWithProgress(
  meetingId: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/meetings/${meetingId}/attachments`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = "خطا در آپلود";
        try { msg = JSON.parse(xhr.responseText)?.error?.message ?? msg; } catch { /* keep default */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("خطای شبکه"));
    // session cookie
    xhr.withCredentials = true;
    xhr.send(fd);
  });
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
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MeetingAttachmentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<MeetingAttachmentRow | null>(null);
  const dragDepth = useRef(0);

  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: ["meeting", meetingId] }),
    [qc, meetingId],
  );

  const startUpload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!canManage || list.length === 0) return;
      for (const file of list) {
        if (file.size > ATTACHMENT_MAX_BYTES_DEFAULT) {
          push(`«${file.name}» از سقف ۱۰ مگابایت بزرگ‌تر است`, "error");
          continue;
        }
        const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setJobs((j) => [...j, { id: jobId, file, progress: 0, status: "uploading" }]);
        try {
          await uploadWithProgress(meetingId, file, (pct) =>
            setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, progress: pct } : x))),
          );
          setJobs((j) => j.filter((x) => x.id !== jobId));
          push(`«${file.name}» پیوست شد`, "success");
          await refresh();
        } catch (e) {
          setJobs((j) =>
            j.map((x) => (x.id === jobId ? { ...x, status: "error", error: (e as Error).message } : x)),
          );
        }
      }
    },
    [canManage, meetingId, push, refresh],
  );

  // ── window-level drag&drop (works even over child scroll containers) ──
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

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api(`/api/meetings/${meetingId}/attachments/${pendingDelete.id}`, { method: "DELETE" });
      push("پیوست حذف شد", "success");
      setPendingDelete(null);
      await refresh();
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setDeleting(false);
    }
  }

  const attachmentUrl = (id: string) => `/api/meetings/${meetingId}/attachments/${id}`;
  const doneCount = jobs.filter((j) => j.status === "error").length;

  return (
    <Card data-testid="meeting-attachments" data-tour="meeting-attachments">
      <CardHeader
        title={`پیوست‌ها (${faNum(attachments.length + jobs.filter((j) => j.status === "uploading").length)})`}
        subtitle={canManage ? `${ATTACHMENT_ACCEPT_FA} · کشیدن و رها کردن پشتیبانی می‌شود` : ATTACHMENT_ACCEPT_FA}
        action={
          canManage ? (
            <>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={ATTACHMENT_ACCEPT}
                multiple
                data-testid="attachment-file-input"
                onChange={(e) => {
                  startUpload(e.target.files ?? []);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
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

      {/* drop overlay */}
      {canManage && (
        <AnimatePresence>
          {dragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-emerald-500 bg-emerald-50/80 backdrop-blur-[2px]"
              data-testid="attachment-dropzone"
            >
              <div className="flex flex-col items-center gap-2 text-emerald-700">
                <Plus className="h-8 w-8" />
                <p className="text-[13px] font-bold">فایل‌ها را این‌جا رها کنید</p>
                <p className="text-[11px] text-emerald-600/80">PDF، تصویر یا فایل آفیس — تا ۱۰ مگابایت</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* upload queue — precise per-file progress */}
      {jobs.length > 0 && (
        <div className="space-y-2 border-b border-line bg-paper-soft/40 px-5 py-3" data-testid="attachment-upload-queue">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[12px] font-medium">{j.file.name}</p>
                  <span className={cn("shrink-0 text-[11px] tabular-nums", j.status === "error" ? "text-red-600" : "text-ink-faint")}>
                    {j.status === "error" ? "خطا" : `${faNum(j.progress)}٪ · ${formatBytes(j.file.size)}`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-150",
                      j.status === "error" ? "bg-red-500" : "bg-gradient-to-l from-emerald-400 to-emerald-600",
                    )}
                    style={{ width: `${j.status === "error" ? 100 : j.progress}%` }}
                  />
                </div>
                {j.status === "error" && <p className="mt-1 text-[11px] text-red-600">{j.error}</p>}
              </div>
              {j.status === "error" && (
                <button
                  type="button"
                  aria-label="حذف از صف"
                  className="text-ink-faint hover:text-ink"
                  onClick={() => setJobs((all) => all.filter((x) => x.id !== j.id))}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {doneCount > 0 && <p className="text-[11px] text-ink-faint">{faNum(doneCount)} فایل با خطا مواجه شد</p>}
        </div>
      )}

      {attachments.length === 0 && jobs.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="پیوستی نیست"
            description={canManage ? "فایل را این‌جا بکشید و رها کنید، یا از دکمهٔ آپلود اضافه کنید." : "برگزارکننده هنوز فایلی پیوست نکرده است."}
          />
        </div>
      ) : (
        <div className="divide-y divide-line">
          {attachments.map((row) => {
            const { Icon, chip } = fileVisual(row.mimeType, row.originalName);
            const isImage = row.mimeType.startsWith("image/");
            return (
              <div
                key={row.id}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-paper-soft/40"
                data-testid={`attachment-row-${row.id}`}
              >
                {isImage ? (
                  <button
                    type="button"
                    onClick={() => setPreview(row)}
                    className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-line bg-paper-soft"
                    aria-label={`پیش‌نمایش ${row.originalName}`}
                    data-testid={`attachment-thumb-${row.id}`}
                  >
                    <img
                      src={attachmentUrl(row.id)}
                      alt={row.originalName}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md", chip)}>
                    <Icon className="h-5 w-5" />
                  </div>
                )}
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
                {isImage && (
                  <button
                    type="button"
                    onClick={() => setPreview(row)}
                    className="hidden h-8 items-center gap-1 rounded-md px-2 text-[12px] text-ink-soft hover:bg-paper-soft hover:text-ink sm:inline-flex"
                  >
                    <Eye className="h-4 w-4" />
                    پیش‌نمایش
                  </button>
                )}
                <a
                  href={attachmentUrl(row.id)}
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
                    onClick={() => setPendingDelete(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* image lightbox */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
              onClick={() => setPreview(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="relative max-h-full max-w-3xl"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={attachmentUrl(preview.id)}
                  alt={preview.originalName}
                  className="max-h-[80vh] w-full rounded-xl object-contain shadow-2xl"
                />
                <div className="mt-3 flex items-center justify-between text-white">
                  <p className="text-[13px] font-medium">{preview.originalName}</p>
                  <div className="flex items-center gap-2">
                    <a
                      href={attachmentUrl(preview.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-[12px] hover:bg-white/20"
                    >
                      <Download className="h-4 w-4" />
                      دانلود
                    </a>
                    <button
                      type="button"
                      aria-label="بستن"
                      className="flex size-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
                      onClick={() => setPreview(null)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* delete confirmation modal */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {pendingDelete && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !deleting && setPendingDelete(null)}
                className="fixed inset-0 z-50 bg-black/45"
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={(e) => { if (e.target === e.currentTarget) setPendingDelete(null); }}>
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  className="w-[400px] max-w-full rounded-2xl bg-white p-6 shadow-2xl"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                      <Trash2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold">حذف پیوست</h3>
                      <p className="mt-2 text-[13px] leading-6 text-ink-soft">
                        فایل <b className="text-ink">«{pendingDelete.originalName}»</b> برای همیشه حذف می‌شود.
                      </p>
                      <p className="mt-2 text-[11.5px] text-ink-faint">این عمل قابل بازگشت نیست.</p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-end gap-2">
                    <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
                      انصراف
                    </Button>
                    <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
                      <Trash2 className="h-4 w-4" />
                      {deleting ? "در حال حذف…" : "حذف کن"}
                    </Button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Card>
  );
}
