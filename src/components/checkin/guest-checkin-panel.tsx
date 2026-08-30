"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "@/components/ui/icon";
import { faStr } from "@/lib";
import { Tooltip } from "@/components/ui/tooltip";
import { CheckinQrCode } from "./checkin-qr-code";

export function GuestCheckinPanel({
  checkinCode,
  arrivedAt,
  guestName,
  meetingTitle,
  onManualCheckin,
  busy,
}: {
  checkinCode: string | null;
  arrivedAt: string | null;
  guestName?: string;
  meetingTitle?: string;
  onManualCheckin: () => void;
  busy: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const checkinUrl = useMemo(() => {
    if (typeof window === "undefined" || !checkinCode) return "";
    return `${window.location.origin}/checkin/${checkinCode}`;
  }, [checkinCode]);

  async function copyLink() {
    if (!checkinUrl) return;
    await navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!checkinCode) {
    return <span className="text-[11px] text-ink-faint">کد ورود ندارد</span>;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {arrivedAt ? (
        <span className="badge badge-gray text-[10px]">حاضر</span>
      ) : (
        <span className="badge badge-amber text-[10px]">در انتظار ورود</span>
      )}

      <CheckinQrCode
        checkinCode={checkinCode}
        size={112}
        guestName={guestName}
        meetingTitle={meetingTitle}
        showActions
      />

      <div className="flex flex-wrap justify-end gap-1">
        <Tooltip content="کپی لینک ورود">
        <button
          type="button"
          onClick={copyLink}
          className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10px] text-ink-soft hover:bg-paper-soft"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          لینک ورود
        </button>
        </Tooltip>
        {!arrivedAt && (
          <button
            type="button"
            disabled={busy}
            onClick={onManualCheckin}
            className="rounded-md bg-ink px-2 py-1 text-[10px] font-medium text-white hover:bg-[#2a2a2e] disabled:opacity-50"
          >
            حضور ثبت شد
          </button>
        )}
      </div>
      <Tooltip content={checkinUrl}>
      <a
        href={`/checkin/${checkinCode}`}
        target="_blank"
        rel="noopener noreferrer"
        className="max-w-[140px] truncate text-[10px] text-ink-faint hover:text-ink"
        dir="ltr"
      >
        /checkin/{checkinCode}
      </a>
      </Tooltip>
      <p className="text-[9px] text-ink-faint">اسکن QR یا باز کردن لینک</p>
    </div>
  );
}
