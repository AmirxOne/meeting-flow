"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { faNum } from "@/lib";
import {
  AVATAR_CROP_VIEW,
  AVATAR_MAX_ZOOM,
  AVATAR_MIN_ZOOM,
  AVATAR_OUTPUT_SIZE,
  squareCoverLayout,
} from "@/lib/avatar";

export function AvatarCropModal({
  open,
  file,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onConfirm: (blob: Blob) => void;
  busy?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const layout = squareCoverLayout(natural.w, natural.h, AVATAR_CROP_VIEW, zoom, pan.x, pan.y);

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, panX: layout.panX, panY: layout.panY };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const next = squareCoverLayout(
      natural.w,
      natural.h,
      AVATAR_CROP_VIEW,
      zoom,
      drag.panX + (e.clientX - drag.x),
      drag.panY + (e.clientY - drag.y),
    );
    setPan({ x: next.panX, y: next.panY });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function confirm() {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cut = squareCoverLayout(
      img.naturalWidth,
      img.naturalHeight,
      AVATAR_CROP_VIEW,
      zoom,
      pan.x,
      pan.y,
    );
    ctx.drawImage(img, cut.sx, cut.sy, cut.sw, cut.sh, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      0.88,
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="برش تصویر پروفایل"
      subtitle="برای جابه‌جایی بکشید؛ با نوار، بزرگ‌نمایی کنید. خروجی مربع است."
      footer={
        <div className="flex gap-2">
          <Button onClick={confirm} loading={busy} disabled={!objectUrl}>
            برش و ذخیره
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative cursor-grab overflow-hidden rounded-2xl border border-line bg-paper-soft active:cursor-grabbing"
          style={{ width: AVATAR_CROP_VIEW, height: AVATAR_CROP_VIEW, touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {objectUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={objectUrl}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: layout.width,
                height: layout.height,
                left: layout.left,
                top: layout.top,
              }}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ w: el.naturalWidth, h: el.naturalHeight });
              }}
            />
          )}
        </div>
        <label className="flex w-full max-w-[280px] flex-col gap-1.5">
          <span className="text-[12px] text-ink-soft">
            بزرگ‌نمایی ({faNum(zoom.toFixed(1))}×)
          </span>
          <input
            type="range"
            min={AVATAR_MIN_ZOOM}
            max={AVATAR_MAX_ZOOM}
            step={0.05}
            value={zoom}
            onChange={(e) => {
              const nextZoom = Number(e.target.value);
              const next = squareCoverLayout(
                natural.w,
                natural.h,
                AVATAR_CROP_VIEW,
                nextZoom,
                pan.x,
                pan.y,
              );
              setZoom(nextZoom);
              setPan({ x: next.panX, y: next.panY });
            }}
            className="w-full accent-ink"
          />
        </label>
      </div>
    </Modal>
  );
}
