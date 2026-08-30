"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";
import { buildCheckinUrl } from "@/lib/checkin-url";
import { faStr } from "@/lib";

interface CheckinQrCodeProps {
  checkinCode: string;
  /** Canvas edge length in CSS pixels */
  size?: number;
  guestName?: string;
  meetingTitle?: string;
  /** Show download / print actions (organizer panel) */
  showActions?: boolean;
  className?: string;
}

export function CheckinQrCode({
  checkinCode,
  size = 128,
  guestName,
  meetingTitle,
  showActions = false,
  className = "",
}: CheckinQrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const url = useMemo(() => buildCheckinUrl(checkinCode), [checkinCode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url) return;
    let cancelled = false;
    QRCode.toCanvas(canvas, url, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1a1a1e", light: "#ffffff" },
    })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const safeName = (guestName ?? checkinCode).replace(/[^\w\u0600-\u06FF-]+/g, "-");
    const link = document.createElement("a");
    link.download = `checkin-${safeName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function printQr() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
    if (!win) return;
    const title = meetingTitle ? `<p><strong>جلسه:</strong> ${escapeHtml(meetingTitle)}</p>` : "";
    const guest = guestName ? `<p><strong>مهمان:</strong> ${escapeHtml(guestName)}</p>` : "";
    win.document.write(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>QR ورود — ${escapeHtml(checkinCode)}</title>
  <style>
    body { font-family: Tahoma, sans-serif; text-align: center; padding: 24px; }
    img { width: 240px; height: 240px; margin: 16px auto; display: block; }
    .code { font-family: monospace; letter-spacing: 0.2em; font-size: 14px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>ثبت حضور مهمان</h1>
  ${guest}
  ${title}
  <img src="${dataUrl}" alt="QR check-in" />
  <p class="code">${escapeHtml(checkinCode)}</p>
  <p style="font-size:12px;color:#666">اسکن کنید یا به ${escapeHtml(url)} بروید</p>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
    win.document.close();
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`} data-testid="checkin-qr">
      <div className="rounded-lg border border-line bg-white p-2 shadow-sm">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`QR ورود مهمان — کد ${checkinCode}`}
          className="block"
          style={{ width: size, height: size }}
        />
      </div>
      <p className="font-mono text-[10px] tracking-widest text-ink-faint" dir="ltr">
        {faStr(checkinCode)}
      </p>
      {showActions && ready && (
        <div className="flex flex-wrap justify-center gap-1">
          <button
            type="button"
            data-testid="checkin-download"
            onClick={downloadPng}
            className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10px] text-ink-soft hover:bg-paper-soft"
          >
            <Download className="h-3 w-3" />
            دانلود QR
          </button>
          <button
            type="button"
            data-testid="checkin-print"
            onClick={printQr}
            className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10px] text-ink-soft hover:bg-paper-soft"
          >
            <Printer className="h-3 w-3" />
            چاپ QR
          </button>
        </div>
      )}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
