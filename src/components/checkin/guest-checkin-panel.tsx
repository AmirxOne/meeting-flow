"use client";

import { useMemo } from "react";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { faStr } from "@/lib";

/** QR-like link display: scannable URL + copyable code (no extra dependency). */
export function GuestCheckinPanel({
  checkinCode,
  arrivedAt,
  onManualCheckin,
  busy,
}: {
  checkinCode: string | null;
  arrivedAt: string | null;
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
    <div className="flex flex-col items-end gap-1.5">
      {arrivedAt ? (
        <span className="badge badge-gray text-[10px]">حاضر</span>
      ) : (
        <span className="badge badge-amber text-[10px]">در انتظار ورود</span>
      )}
      <div
        className="rounded-md border border-dashed border-line bg-paper-soft/60 px-2 py-1 text-center"
        title={checkinUrl}
      >
        <p className="text-[9px] text-ink-faint">کد ورود</p>
        <p className="font-mono text-[13px] font-bold tracking-widest" dir="ltr">
          {faStr(checkinCode)}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        <button
          type="button"
          onClick={copyLink}
          className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10px] text-ink-soft hover:bg-paper-soft"
          title="کپی لینک QR"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          لینک ورود
        </button>
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
      <a
        href={`/checkin/${checkinCode}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-ink-faint hover:text-ink"
        dir="ltr"
      >
        /checkin/{checkinCode}
      </a>
    </div>
  );
}
