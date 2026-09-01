"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib";
import { VIDEO_PROVIDER_FA, isVideoProvider } from "@/lib/video-link";
import { VideoLinkFields } from "@/components/meetings/video-link-fields";

export function MeetingVideoLink({
  meetingId,
  meetingType,
  videoProvider,
  videoUrl,
  canEdit,
}: {
  meetingId: string;
  meetingType: string;
  videoProvider: string | null;
  videoUrl: string | null;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const isOnline = meetingType === "ONLINE";
  const label = isVideoProvider(videoProvider) ? VIDEO_PROVIDER_FA[videoProvider] : VIDEO_PROVIDER_FA.CUSTOM;

  function startEdit() {
    setProvider(videoProvider ?? "");
    setUrl(videoUrl ?? "");
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      await api(`/api/meetings/${meetingId}/video`, {
        method: "PUT",
        json: {
          videoProvider: provider || null,
          videoUrl: url.trim() || null,
        },
      });
      push("لینک ویدئو ذخیره شد", "success");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["meeting", meetingId] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!videoUrl && !isOnline && !canEdit) return null;

  return (
    <>
      <div
        data-testid="meeting-video-link"
        data-tour="meeting-video-link"
        className={cn(
          "rounded-md p-4",
          isOnline ? "border-2 border-ink bg-paper-soft" : "border border-line bg-white",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-ink-soft">
              {isOnline ? "جلسه آنلاین — لینک ویدئو" : "لینک ویدئو"}
            </p>
            {videoUrl ? (
              <>
                <p className="mt-1 text-[13px] font-medium">{label}</p>
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="mt-1 inline-block break-all text-left text-[12px] text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
                  data-testid="video-url-view"
                >
                  {videoUrl}
                </a>
              </>
            ) : (
              <p className="mt-1 text-[13px] text-ink-soft">
                {canEdit ? "هنوز لینکی ثبت نشده — از ویرایش اضافه کنید." : "لینک ویدئو ثبت نشده است."}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {videoUrl && (
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-[12px] font-medium text-white hover:bg-ink/90"
                data-testid="video-join-btn"
              >
                <ExternalLink className="h-4 w-4" />
                پیوستن
              </a>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" data-testid="video-edit-btn" onClick={startEdit}>
                <Pencil className="h-4 w-4" />
                {videoUrl ? "ویرایش" : "افزودن"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="لینک ویدئو"
        subtitle="گوگل میت، تیمز، زوم یا لینک سفارشی — اختیاری"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button loading={busy} data-testid="video-save-btn" onClick={save}>
              ذخیره
            </Button>
          </div>
        }
      >
        <VideoLinkFields
          provider={provider}
          url={url}
          onProvider={setProvider}
          onUrl={setUrl}
          highlighted={isOnline}
        />
      </Modal>
    </>
  );
}
